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

// Reports Live Activity push tokens to eyewall-poller, natively.
//
// Two kinds (see eyewall-poller's /live-activity/* routes):
//   - each activity's update token -> POST /live-activity/register, so the
//     poller can keep it current and end it at the final;
//   - with "Follow my team's games" on (iOS 17.2+), the app's push-to-start
//     token for the user's team -> POST /live-activity/start-token, so the
//     poller can START an activity when that team's game goes live, whether
//     or not the app is open.
//
// Native, not JS: a server-started activity is the reason iOS wakes the app
// in the background, briefly, for exactly this -- the web view may never
// load. start() runs from application(_:didFinishLaunchingWithOptions:), so
// it also covers those background launches.
@available(iOS 16.2, *)
final class LiveActivityRegistrar {
    static let shared = LiveActivityRegistrar()

    private let defaults = UserDefaults.standard
    private enum Key {
        static let enabled = "la.autoFollow.enabled"
        static let team = "la.autoFollow.team"
        static let locale = "la.autoFollow.locale"
        static let workerURL = "la.workerURL"
        static let startToken = "la.autoFollow.startToken"
    }
    // Touched from Capacitor's plugin queue and from these Tasks alike.
    private let lock = NSLock()
    private var watched = Set<String>()
    private var startTokenTask: Task<Void, Never>?

    var autoFollowEnabled: Bool { defaults.bool(forKey: Key.enabled) }
    var autoFollowTeam: String? { defaults.string(forKey: Key.team) }

    func start() {
        for activity in Activity<GameActivityAttributes>.activities { watch(activity) }
        Task {
            for await activity in Activity<GameActivityAttributes>.activityUpdates {
                await self.dropDuplicate(of: activity)
                self.watch(activity)
            }
        }
        if autoFollowEnabled { observeStartToken() }
    }

    // Saved for background launches, which have no JS to ask.
    func configure(enabled: Bool, team: String, locale: String, workerURL: String) {
        let wasEnabled = autoFollowEnabled
        defaults.set(enabled, forKey: Key.enabled)
        defaults.set(team, forKey: Key.team)
        defaults.set(locale, forKey: Key.locale)
        defaults.set(workerURL, forKey: Key.workerURL)
        if enabled {
            if let token = defaults.string(forKey: Key.startToken) { sendStartToken(token, enabled: true) }
            observeStartToken()
        } else if wasEnabled, let token = defaults.string(forKey: Key.startToken) {
            sendStartToken(token, enabled: false)
        }
    }

    func watch(_ activity: Activity<GameActivityAttributes>) {
        lock.lock()
        let isNew = watched.insert(activity.id).inserted
        lock.unlock()
        guard isNew else { return }
        Task {
            for await data in activity.pushTokenUpdates {
                self.post("/live-activity/register", ["gameId": activity.attributes.gameId, "token": Self.hex(data)])
            }
        }
    }

    // The app may have started a game's activity itself (the user was in
    // the app at puck drop) and the poller started one too. Keep the first.
    private func dropDuplicate(of activity: Activity<GameActivityAttributes>) async {
        let same = Activity<GameActivityAttributes>.activities.filter { $0.attributes.gameId == activity.attributes.gameId }
        if same.count > 1, same.first?.id != activity.id {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }

    private func observeStartToken() {
        guard #available(iOS 17.2, *) else { return }
        lock.lock()
        defer { lock.unlock() }
        guard startTokenTask == nil else { return }
        startTokenTask = Task {
            for await data in Activity<GameActivityAttributes>.pushToStartTokenUpdates {
                let token = Self.hex(data)
                self.defaults.set(token, forKey: Key.startToken)
                if self.autoFollowEnabled { self.sendStartToken(token, enabled: true) }
            }
        }
    }

    private func sendStartToken(_ token: String, enabled: Bool) {
        post("/live-activity/start-token", [
            "token": token,
            "team": autoFollowTeam ?? "",
            "enabled": enabled,
            "locale": defaults.string(forKey: Key.locale) ?? "en",
        ])
    }

    private func post(_ path: String, _ body: [String: Any]) {
        guard let base = defaults.string(forKey: Key.workerURL), !base.isEmpty,
              let url = URL(string: base + path),
              let data = try? JSONSerialization.data(withJSONObject: body) else { return }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = data
        URLSession.shared.dataTask(with: request).resume()
    }

    private static func hex(_ data: Data) -> String {
        data.map { String(format: "%02x", $0) }.joined()
    }
}

// Starts/ends the lock-screen Live Activity for a game (useLiveActivity.js)
// and holds the "Follow my team's games" setting. Push tokens are reported
// natively by LiveActivityRegistrar, not through JS.
@objc(LiveGamePlugin)
public class LiveGamePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveGamePlugin"
    public let jsName = "LiveGame"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "activeGameIds", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "autoFollowSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAutoFollow", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setAutoFollow", returnType: CAPPluginReturnPromise),
    ]

    @objc func isSupported(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            call.resolve(["supported": ActivityAuthorizationInfo().areActivitiesEnabled])
        } else {
            call.resolve(["supported": false])
        }
    }

    // Server-started activities need iOS 17.2's push-to-start.
    @objc func autoFollowSupported(_ call: CAPPluginCall) {
        if #available(iOS 17.2, *) {
            call.resolve(["supported": ActivityAuthorizationInfo().areActivitiesEnabled])
        } else {
            call.resolve(["supported": false])
        }
    }

    @objc func getAutoFollow(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            call.resolve(["enabled": LiveActivityRegistrar.shared.autoFollowEnabled])
        } else {
            call.resolve(["enabled": false])
        }
    }

    // Called on every launch too, so a changed favorite team or language
    // reaches the poller.
    @objc func setAutoFollow(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { return call.resolve(["enabled": false]) }
        guard let team = call.getString("team"), let workerURL = call.getString("workerUrl") else {
            return call.reject("team and workerUrl are required")
        }
        let enabled = call.getBool("enabled") ?? false
        LiveActivityRegistrar.shared.configure(
            enabled: enabled, team: team, locale: call.getString("locale") ?? "en", workerURL: workerURL
        )
        if !enabled {
            // Turning it off ends what it started.
            Task {
                for activity in Activity<GameActivityAttributes>.activities { await activity.end(nil, dismissalPolicy: .immediate) }
            }
        }
        call.resolve(["enabled": enabled])
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
            LiveActivityRegistrar.shared.watch(existing)
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
            LiveActivityRegistrar.shared.watch(activity)
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
}
