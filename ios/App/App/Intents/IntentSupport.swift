//
//  IntentSupport.swift
//  App
//
//  What the Siri / Shortcuts intents (EyeWallIntents.swift) share: the team
//  list, the followed teams and Worker URL the web app hands over, and the
//  Worker reads.
//
//  These run without the web view -- often with the app not open at all --
//  so nothing here can reach localStorage or the JS modules. The web side
//  sends what's needed through AppIntentsPlugin (src/utils/siriIntents.js),
//  and Teams.json is generated from the web config by
//  src/utils/__tests__/siriIntents.test.js (UPDATE_IOS_TEAMS=1).
//

import Foundation

// MARK: - Teams

struct IntentTeam: Codable, Hashable {
    /// "nhl:CAR"
    let id: String
    /// "nhl" | "pwhl" | "ahl" | "echl"
    let league: String
    let abbr: String
    /// The id the league's Worker routes take: the NHL's own, HockeyTech's elsewhere.
    let teamId: Int
    /// "Carolina Hurricanes"
    let name: String
    /// "Hurricanes"
    let shortName: String

    var leagueLabel: String { league.uppercased() }
}

enum TeamCatalog {
    static let all: [IntentTeam] = {
        guard let url = Bundle.main.url(forResource: "Teams", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let teams = try? JSONDecoder().decode([IntentTeam].self, from: data) else { return [] }
        return teams
    }()

    static let byId: [String: IntentTeam] = Dictionary(all.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })

    static func team(league: String, abbr: String) -> IntentTeam? { byId["\(league):\(abbr)"] }

    static func team(league: String, teamId: Int) -> IntentTeam? {
        all.first { $0.league == league && $0.teamId == teamId }
    }
}

// MARK: - What the web app hands over

enum IntentContext {
    private static let teamsKey = "intents.teams"          // ["nhl:CAR", "ahl:CHI"], primary first
    private static let workerURLKey = "intents.workerURL"
    // LiveActivityRegistrar's copies, from a launch before AppIntentsPlugin
    // existed (only saved with Lock Screen auto-follow on).
    private static let laTeamsKey = "la.autoFollow.teams"
    private static let laWorkerURLKey = "la.workerURL"

    private static var defaults: UserDefaults { .standard }

    static func save(teams: [String], workerURL: String) {
        defaults.set(teams, forKey: teamsKey)
        // A web build without VITE_WORKER_URL sends "": keep the last good URL
        // (or LiveActivityRegistrar's) rather than saving "" over it.
        if !workerURL.isEmpty { defaults.set(workerURL, forKey: workerURLKey) }
    }

    static var followedTeams: [IntentTeam] {
        let ids = defaults.stringArray(forKey: teamsKey) ?? defaults.stringArray(forKey: laTeamsKey) ?? []
        return ids.compactMap { TeamCatalog.byId[$0] }
    }

    static var workerURL: String? {
        [workerURLKey, laWorkerURLKey].lazy.compactMap { defaults.string(forKey: $0) }.first { !$0.isEmpty }
    }

    /// The team asked about, else the primary followed team.
    @available(iOS 16.0, *)
    static func resolve(_ id: String?) throws -> IntentTeam {
        if let id, let team = TeamCatalog.byId[id] { return team }
        guard let team = followedTeams.first else { throw IntentFailure.noTeam }
        return team
    }
}

@available(iOS 16.0, *)
enum IntentFailure: Error, CustomLocalizedStringResourceConvertible {
    /// No team asked about and none followed.
    case noTeam
    /// The app hasn't been opened since this build was installed.
    case notSetUp
    /// The Worker didn't answer, or answered with something unreadable.
    case unavailable

    var localizedStringResource: LocalizedStringResource {
        switch self {
        case .noTeam: return "Open EyeWall and pick a team first."
        case .notSetUp: return "Open EyeWall once, then try again."
        case .unavailable: return "EyeWall couldn't load that right now. Try again in a minute."
        }
    }
}

// MARK: - Worker reads

typealias JSONObject = [String: Any]

@available(iOS 16.0, *)
enum Worker {
    /// The deployed site, for the NHL proxy (functions/nhl-api), as
    /// utils/nativeOrigin.js does in the app.
    static let siteOrigin = "https://eyewallanalytics.com"

    static func get(_ path: String) async throws -> Any {
        guard let base = IntentContext.workerURL, let url = URL(string: base + path) else {
            throw IntentFailure.notSetUp
        }
        return try await fetch(url)
    }

    static func fetch(_ url: URL) async throws -> Any {
        let request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 8)
        let data: Data, response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw IntentFailure.unavailable
        }
        guard (response as? HTTPURLResponse)?.statusCode == 200,
              let json = try? JSONSerialization.jsonObject(with: data) else {
            throw IntentFailure.unavailable
        }
        return json
    }

    static func rows(_ path: String) async throws -> [JSONObject] {
        (try await get(path) as? [JSONObject]) ?? []
    }

    static func object(_ path: String) async throws -> JSONObject? {
        try await get(path) as? JSONObject
    }
}

/// The Worker's /config/seasons: each league's current season.
@available(iOS 16.0, *)
struct Seasons {
    let nhl: String?
    let pwhl: Int?
    /// 2025 for 2025-26
    let pwhlStartYear: Int?
    /// The next PWHL season's preseason and regular season, which have the
    /// next games between seasons.
    let pwhlUpcoming: [Int]
    let ahl: Int?
    let echl: Int?

    static func load() async throws -> Seasons {
        guard let config = try await Worker.object("/config/seasons") else { throw IntentFailure.unavailable }
        let nhl = config.object("nhl"), pwhl = config.object("pwhl"), next = pwhl?.object("next")
        return Seasons(
            nhl: nhl?.string("seasonId") ?? nhl?.int("seasonId").map(String.init),
            pwhl: pwhl?.int("seasonId"),
            pwhlStartYear: pwhl?.int("startYear"),
            pwhlUpcoming: [next?.object("preseason")?.int("seasonId"), next?.int("seasonId")].compactMap { $0 },
            ahl: config.object("ahl")?.int("seasonId"),
            echl: config.object("echl")?.int("seasonId")
        )
    }

    /// The current HockeyTech season id for pwhl/ahl/echl.
    func current(_ league: String) throws -> Int {
        let id: Int?
        switch league {
        case "pwhl": id = pwhl
        case "ahl": id = ahl
        case "echl": id = echl
        default: id = nil
        }
        guard let id else { throw IntentFailure.unavailable }
        return id
    }
}

// MARK: - Loose JSON access

extension Dictionary where Key == String, Value == Any {
    func object(_ key: String) -> JSONObject? { self[key] as? JSONObject }

    func string(_ key: String) -> String? {
        if let s = self[key] as? String { return s }
        return nil
    }

    func int(_ key: String) -> Int? {
        switch self[key] {
        case let n as NSNumber: return n.intValue
        case let s as String: return Int(s)
        default: return nil
        }
    }

    func double(_ key: String) -> Double? {
        switch self[key] {
        case let n as NSNumber: return n.doubleValue
        case let s as String: return Double(s)
        default: return nil
        }
    }

    func bool(_ key: String) -> Bool { (self[key] as? NSNumber)?.boolValue ?? false }

    /// NHL API names: { "default": "Hurricanes", "fr": ... }
    func localized(_ key: String) -> String? { object(key)?.string("default") }
}
