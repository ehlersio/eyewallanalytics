import UIKit
import Capacitor
import ActivityKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = AppViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

// Registers the app's own in-target plugins. Kept in this file rather than
// new ones so the Xcode project's file list doesn't need touching.
class AppViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(KeepAwakePlugin())
        bridge?.registerPluginInstance(LiveGamePlugin())
    }
}

// Keeps the screen on during a live game (useWakeLock.js). The web Screen
// Wake Lock API that hook used on its own isn't reliably honored inside the
// app's WKWebView, so the screen still dimmed and locked mid-game; the idle
// timer is the native switch for exactly this. iOS turns it back on by
// itself once the app is no longer in the foreground.
@objc(KeepAwakePlugin)
public class KeepAwakePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "KeepAwakePlugin"
    public let jsName = "KeepAwake"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "keepAwake", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "allowSleep", returnType: CAPPluginReturnPromise),
    ]

    @objc func keepAwake(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            UIApplication.shared.isIdleTimerDisabled = true
            call.resolve()
        }
    }

    @objc func allowSleep(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            UIApplication.shared.isIdleTimerDisabled = false
            call.resolve()
        }
    }
}

// KEEP IN SYNC with EyeWallLiveActivity/GameActivityAttributes.swift -- the
// extension draws what this starts, and ActivityKit matches the two copies
// by type name and field shape. (Duplicated rather than shared because the
// App target's files are listed one by one in the Xcode project.)
struct GameActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var homeScore: Int
        var awayScore: Int
        var periodLabel: String
        var clock: String
        var inIntermission: Bool
        var status: String
        var lastEvent: String?
        var strength: String?
    }

    var gameId: Int
    var homeAbbr: String
    var awayAbbr: String
    var homeColor: String
    var awayColor: String
    var followAbbr: String
}

// Starts/ends the lock-screen Live Activity for a game (useLiveActivity.js).
// Once started, eyewall-poller keeps it current over APNs using the push
// token this reports ("pushToken" event -> POST /live-activity/register).
@objc(LiveGamePlugin)
public class LiveGamePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveGamePlugin"
    public let jsName = "LiveGame"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "activeGameIds", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
    ]

    @objc func isSupported(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            call.resolve(["supported": ActivityAuthorizationInfo().areActivitiesEnabled])
        } else {
            call.resolve(["supported": false])
        }
    }

    @objc func activeGameIds(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            call.resolve(["gameIds": Activity<GameActivityAttributes>.activities.map { $0.attributes.gameId }])
        } else {
            call.resolve(["gameIds": []])
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { return call.reject("Live Activities need iOS 16.2") }
        guard let gameId = call.getInt("gameId"),
              let s = call.getObject("state"),
              let home = call.getString("homeAbbr"), let away = call.getString("awayAbbr") else {
            return call.reject("gameId, homeAbbr, awayAbbr and state are required")
        }
        // One activity per game: re-following reuses it.
        if let existing = Activity<GameActivityAttributes>.activities.first(where: { $0.attributes.gameId == gameId }) {
            observeToken(existing)
            return call.resolve(["id": existing.id])
        }
        let attrs = GameActivityAttributes(
            gameId: gameId, homeAbbr: home, awayAbbr: away,
            homeColor: call.getString("homeColor") ?? "#e4e8f0",
            awayColor: call.getString("awayColor") ?? "#e4e8f0",
            followAbbr: call.getString("followAbbr") ?? home
        )
        let state = GameActivityAttributes.ContentState(
            homeScore: s["homeScore"] as? Int ?? 0,
            awayScore: s["awayScore"] as? Int ?? 0,
            periodLabel: s["periodLabel"] as? String ?? "",
            clock: s["clock"] as? String ?? "",
            inIntermission: s["inIntermission"] as? Bool ?? false,
            status: s["status"] as? String ?? "live",
            lastEvent: s["lastEvent"] as? String,
            strength: s["strength"] as? String
        )
        do {
            let activity = try Activity.request(
                attributes: attrs,
                content: ActivityContent(state: state, staleDate: Date().addingTimeInterval(5 * 60)),
                pushType: .token
            )
            observeToken(activity)
            call.resolve(["id": activity.id])
        } catch {
            call.reject("Couldn't start the Live Activity: \(error.localizedDescription)")
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { return call.resolve() }
        let gameId = call.getInt("gameId")
        Task {
            for activity in Activity<GameActivityAttributes>.activities where gameId == nil || activity.attributes.gameId == gameId {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            call.resolve()
        }
    }

    // The token can change over the activity's life; each one is reported.
    @available(iOS 16.2, *)
    private func observeToken(_ activity: Activity<GameActivityAttributes>) {
        Task { [weak self] in
            for await data in activity.pushTokenUpdates {
                let token = data.map { String(format: "%02x", $0) }.joined()
                self?.notifyListeners("pushToken", data: ["gameId": activity.attributes.gameId, "token": token])
            }
        }
    }
}
