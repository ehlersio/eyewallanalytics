//
//  GameActivityAttributes.swift
//  EyeWallLiveActivity
//
//  The data a game Live Activity carries. KEEP IN SYNC with the copy in
//  App/SceneDelegate.swift (the app starts the activity, this extension
//  draws it; ActivityKit matches the two by type name and field shape) and
//  with liveActivityState() in eyewall-poller's nhl.js, which pushes
//  ContentState as JSON -- the key names below are that JSON's keys.
//

import ActivityKit

struct GameActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var homeScore: Int
        var awayScore: Int
        /// "1st", "2nd", "3rd", "OT", "2OT", "SO"
        var periodLabel: String
        /// Game clock snapshot, "12:34" -- updated about once a minute, not ticking
        var clock: String
        var inIntermission: Bool
        /// "live" | "final"
        var status: String
        /// "GOAL · Aho (3) · 2nd 12:02", the latest goal or penalty
        var lastEvent: String?
        /// "CAR PP", "FLA PP 5v3", "EN" -- nil at even strength
        var strength: String?
    }

    var gameId: Int
    var homeAbbr: String
    var awayAbbr: String
    /// On-dark team colors, "#rrggbb"
    var homeColor: String
    var awayColor: String
    /// The team the user follows
    var followAbbr: String
}
