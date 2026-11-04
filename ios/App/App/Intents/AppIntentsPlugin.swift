//
//  AppIntentsPlugin.swift
//  App
//
//  Hands the Siri / Shortcuts intents what they can't read themselves: the
//  followed teams (the default team) and the Worker URL. Sent by
//  src/utils/siriIntents.js on every launch and whenever the followed teams
//  change.
//

import Capacitor
import AppIntents

@objc(AppIntentsPlugin)
public class AppIntentsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppIntentsPlugin"
    public let jsName = "AppIntents"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setContext", returnType: CAPPluginReturnPromise),
    ]

    @objc func setContext(_ call: CAPPluginCall) {
        let teams = (call.getArray("teams") as? [String]) ?? []
        IntentContext.save(teams: teams, workerURL: call.getString("workerUrl") ?? "")
        // The followed teams are the ones Siri hears in "What's the
        // Hurricanes score"; tell it they may have changed.
        if #available(iOS 17.0, *) { EyeWallShortcuts.updateAppShortcutParameters() }
        call.resolve()
    }
}
