//
//  IntentPlayers.swift
//  App
//
//  "How's Seth Jarvis doing?": a player's season line, for the Get Player
//  Stats intent. Players are found by name in the Worker's
//  /players-search-index (every NHL, PWHL, AHL and ECHL player the app's
//  search knows, about 5,000), kept in the Caches directory for six hours
//  so a question doesn't download it again. The line comes from the same
//  routes the player popups read:
//
//    NHL         /player/landing?id=           featuredStats, last5Games
//    PWHL        /pwhl/player/landing?id=      latest regular season
//    AHL/ECHL    /{league}/player/landing?id=&season=
//
//  Siri hands the player over as the text the user said, not as an entity:
//  with teams, Siri AI never sent the spoken name to an entity query (see
//  SiriAIPreview.swift), and 5,000 players are too many for Spotlight.
//

import Foundation

@available(iOS 16.0, *)
struct IndexedPlayer: Decodable, Hashable {
    let id: Int
    let name: String
    /// The index's team code; nil for a player not on a roster this season
    /// (NHL goalies always: the index takes NHL teams from skater stats).
    let team: String?
    let position: String?
    /// "nhl" | "pwhl" | "ahl" | "echl"
    let sport: String

    var isGoalie: Bool { position == "G" }
    var lastName: String { PlayerCatalog.normalize(name).split(separator: " ").last.map(String.init) ?? "" }
}

@available(iOS 16.0, *)
enum PlayerCatalog {
    private static let ttl: TimeInterval = 6 * 3600
    private static var fileURL: URL? {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?
            .appendingPathComponent("players-search-index.json")
    }

    /// The index, from the cache when it's fresh, else the Worker (and the
    /// stale copy if the Worker can't be reached).
    static func load() async throws -> [IndexedPlayer] {
        let decoder = JSONDecoder()
        var stale: [IndexedPlayer]?
        if let url = fileURL, let data = try? Data(contentsOf: url),
           let players = try? decoder.decode([IndexedPlayer].self, from: data) {
            let age = (try? url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate)
                .map { Date().timeIntervalSince($0) } ?? .infinity
            if age < ttl { return players }
            stale = players
        }
        do {
            guard let rows = try await Worker.get("/players-search-index") as? [Any], !rows.isEmpty else {
                if let stale { return stale }
                throw IntentFailure.unavailable
            }
            let data = try JSONSerialization.data(withJSONObject: rows)
            let players = try decoder.decode([IndexedPlayer].self, from: data)
            if let url = fileURL { try? data.write(to: url, options: .atomic) }
            return players
        } catch {
            if let stale { return stale }
            throw error
        }
    }

    enum Match {
        case one(IndexedPlayer, alternates: [IndexedPlayer])
        case several([IndexedPlayer])
        case none
    }

    /// The player a spoken name means. A full name decides it (one person
    /// can be listed in the NHL and the AHL: those come back as alternates);
    /// a last name alone goes to a player on a followed team, else stands
    /// only if one rostered player has it; then a near spelling of the full
    /// or last name, for speech recognition's slips ("Svetchnikov").
    static func match(_ spoken: String, in players: [IndexedPlayer], followed: [IntentTeam]) -> Match {
        let query = normalize(spoken)
        guard !query.isEmpty else { return .none }
        let rostered = players.filter { $0.team != nil || $0.isGoalie }
        func onFollowed(_ p: IndexedPlayer) -> Bool {
            followed.contains { $0.league == p.sport && $0.abbr == p.team }
        }
        func pick(_ found: [IndexedPlayer]) -> Match {
            guard !found.isEmpty else { return .none }
            // The same full name: one person in two leagues, or namesakes.
            // A followed team's player first, then the NHL, then a rostered one.
            let ordered = found.sorted { a, b in
                if onFollowed(a) != onFollowed(b) { return onFollowed(a) }
                if (a.sport == "nhl") != (b.sport == "nhl") { return a.sport == "nhl" }
                return (a.team != nil) && (b.team == nil)
            }
            return .one(ordered[0], alternates: Array(ordered.dropFirst()))
        }

        // 1. The full name.
        let full = players.filter { normalize($0.name) == query }
        if !full.isEmpty { return pick(full) }

        // 2. A last name alone.
        if !query.contains(" ") {
            let byLast = rostered.filter { $0.lastName == query }
            let followedOnes = byLast.filter(onFollowed)
            if followedOnes.count == 1 { return pick(followedOnes) }
            if byLast.count == 1 { return pick(byLast) }
            if byLast.count > 1 {
                // One person listed twice (NHL and AHL) is still one player.
                let names = Set(byLast.map { normalize($0.name) })
                if names.count == 1 { return pick(byLast) }
                return .several(byLast)
            }
        }

        // 3. A near spelling, rostered players only.
        let near = rostered.filter { p in
            let name = normalize(p.name)
            if query.contains(" ") { return query.count >= 8 && distance(name, query) <= 2 }
            return query.count >= 6 && distance(p.lastName, query) <= 1
        }
        let nearNames = Set(near.map { normalize($0.name) })
        if nearNames.count == 1 { return pick(near) }
        if nearNames.count > 1 { return .several(near) }
        return .none
    }

    /// TeamCatalog's normalizing: lowercased, accents off ("Štrbák" -> "strbak").
    static func normalize(_ text: String) -> String {
        TeamCatalog.normalize(text.replacingOccurrences(of: ".", with: ""))
    }

    /// Levenshtein distance.
    static func distance(_ a: String, _ b: String) -> Int {
        let a = Array(a), b = Array(b)
        if a.isEmpty { return b.count }
        if b.isEmpty { return a.count }
        var row = Array(0...b.count)
        for i in 1...a.count {
            var prev = row[0]
            row[0] = i
            for j in 1...b.count {
                let cur = row[j]
                row[j] = min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] == b[j - 1] ? 0 : 1))
                prev = cur
            }
        }
        return row[b.count]
    }
}

@available(iOS 16.0, *)
extension IntentAnswers {

    static func playerStats(_ spoken: String, followed: [IntentTeam]) async throws -> String {
        let players = try await PlayerCatalog.load()
        switch PlayerCatalog.match(spoken, in: players, followed: followed) {
        case .none:
            return L10n.t("EyeWall couldn't find a player called \(spoken) in the NHL, PWHL, AHL or ECHL.",
                          "EyeWall n'a trouvé aucun joueur nommé \(spoken) dans la LNH, la LPHF, la LAH ou l'ECHL.")
        case .several(let found):
            // Each person once, a few at most: "Quinn Hughes (NHL), Jack Hughes (NHL), Gabbie Hughes (PWHL)".
            var seen = Set<String>(), listed: [String] = []
            for p in found where seen.insert(PlayerCatalog.normalize(p.name) + p.sport).inserted {
                listed.append("\(p.name) (\(p.sport.uppercased()))")
            }
            let shown = listed.prefix(4)
            let list = shown.count > 1 ? shown.dropLast().joined(separator: ", ") + L10n.t(" and ", " et ") + shown.last! : shown[0]
            return L10n.t("EyeWall has more than one player called \(spoken): \(list). Which one?",
                          "EyeWall a plus d'un joueur nommé \(spoken) : \(list). Lequel?")
        case .one(let player, _):
            // Someone listed in the NHL and the AHL (a goalie the index has
            // on a followed AHL team, say): the listing with games this season.
            let key = PlayerCatalog.normalize(player.name)
            let sameName = players.filter { $0 != player && PlayerCatalog.normalize($0.name) == key }
                .sorted { ($0.sport == "nhl") && ($1.sport != "nhl") }
            var best: (PlayerLine, IndexedPlayer)?
            for candidate in [player] + sameName.prefix(2) {
                guard let line = try await playerLine(candidate) else { continue }
                // This season's games first, then the most games.
                func rank(_ l: PlayerLine) -> (Int, Int) { (l.current && l.gamesPlayed > 0 ? 1 : 0, l.gamesPlayed) }
                if best == nil || rank(line) > rank(best!.0) { best = (line, candidate) }
                if line.current && line.gamesPlayed > 0 && candidate.sport == "nhl" { break }
            }
            guard let (line, chosen) = best else {
                return L10n.t("EyeWall has no stats for \(player.name) this season.",
                              "EyeWall n'a pas de statistiques pour \(player.name) cette saison.")
            }
            return describe(line, chosen)
        }
    }

    struct PlayerLine {
        var team: IntentTeam?
        var gamesPlayed = 0
        var goals = 0, assists = 0, points = 0
        var plusMinus: Int?
        var wins = 0, losses = 0, otLosses = 0, shutouts = 0
        var savePct: Double?, gaa: Double?
        var goalie = false
        /// The line is this season's (a PWHL line can be the season the
        /// Worker calls current and still carry its "2025–26" label).
        var current = false
        /// "2025–26" when the line isn't this season's.
        var seasonLabel: String?
        /// NHL only: "Last game, Tuesday, November 3, against the Predators: ..."
        var lastGame: String?
    }

    private static func playerLine(_ player: IndexedPlayer) async throws -> PlayerLine? {
        let seasons = try await Seasons.load()
        var line = PlayerLine(goalie: player.isGoalie)

        if player.sport == "nhl" {
            guard let landing = try? await Worker.object("/player/landing?id=\(player.id)") else { return nil }
            line.team = landing.string("currentTeamAbbrev").flatMap { TeamCatalog.team(league: "nhl", abbr: $0) }
            line.goalie = landing.string("position") == "G"
            guard let featured = landing.object("featuredStats"),
                  let stats = featured.object("regularSeason")?.object("subSeason") else { return line }
            let season = featured.int("season").map(String.init) ?? featured.string("season")
            if let season, let current = seasons.nhl, season != current { line.seasonLabel = seasonLabel(season) } else { line.current = true }
            line.gamesPlayed = stats.int("gamesPlayed") ?? 0
            line.goals = stats.int("goals") ?? 0
            line.assists = stats.int("assists") ?? 0
            line.points = stats.int("points") ?? 0
            line.plusMinus = stats.int("plusMinus")
            line.wins = stats.int("wins") ?? 0
            line.losses = stats.int("losses") ?? 0
            line.otLosses = stats.int("otLosses") ?? 0
            line.shutouts = stats.int("shutouts") ?? 0
            line.savePct = stats.double("savePctg")
            line.gaa = stats.double("goalsAgainstAvg")
            if line.seasonLabel == nil, !line.goalie,
               let last = (landing["last5Games"] as? [JSONObject])?.first {
                line.lastGame = lastGameSentence(last)
            }
            return line
        }

        let path: String
        if player.sport == "pwhl" {
            // No season: the latest regular season the player has a row in.
            path = "/pwhl/player/landing?id=\(player.id)"
        } else {
            path = "/\(player.sport)/player/landing?id=\(player.id)&season=\(try seasons.current(player.sport))"
        }
        guard let landing = try? await Worker.object(path) else { return nil }
        line.team = landing.int("team_id").flatMap { TeamCatalog.team(league: player.sport, teamId: $0) }
        line.goalie = landing.string("position") == "G"
        guard let gp = landing.int("gp") else { return line }
        if player.sport == "pwhl" {
            if let row = landing.int("season_id"), row != seasons.pwhl { return line }
            line.seasonLabel = seasons.pwhlStartYear.map { "\($0)–\(String(($0 + 1) % 100))" }
        }
        line.current = true
        line.gamesPlayed = gp
        line.goals = landing.int("goals") ?? 0
        line.assists = landing.int("assists") ?? 0
        line.points = landing.int("points") ?? 0
        line.plusMinus = landing.int("plus_minus")
        line.wins = landing.int("wins") ?? 0
        line.losses = landing.int("losses") ?? 0
        line.otLosses = landing.int("ot_losses") ?? 0
        line.shutouts = landing.int("shutouts") ?? 0
        line.savePct = landing.double("sv_pct")
        line.gaa = landing.double("gaa")
        return line
    }

    private static func lastGameSentence(_ game: JSONObject) -> String? {
        guard let date = game.string("gameDate").flatMap(parseDay) else { return nil }
        let opponent = teamName(league: "nhl", id: nil, code: game.string("opponentAbbrev"))
        let goals = game.int("goals") ?? 0, assists = game.int("assists") ?? 0
        let did: String
        switch (goals, assists) {
        case (0, 0): did = L10n.t("no points", "aucun point")
        default: did = goalsAndAssists(goals, assists)
        }
        let shots: String
        switch game.int("shots") {
        case nil: shots = ""
        case 0?: shots = L10n.t(" and no shots", " et aucun tir")
        case let n?: shots = L10n.t(" on \(n) \(n == 1 ? "shot" : "shots")", " sur \(n) \(n <= 1 ? "tir" : "tirs")")
        }
        return L10n.t("Last game, \(day(date, utc: true)), against the \(opponent): \(did)\(shots).",
                      "Dernier match, \(day(date, utc: true)), contre les \(opponent) : \(did)\(shots).")
    }

    /// "1 goal and 6 assists", "2 goals", "no goals and 3 assists"
    private static func goalsAndAssists(_ goals: Int, _ assists: Int) -> String {
        let g = L10n.t("\(goals) \(goals == 1 ? "goal" : "goals")", "\(goals) \(goals <= 1 ? "but" : "buts")")
        let a = L10n.t("\(assists) \(assists == 1 ? "assist" : "assists")", "\(assists) \(assists <= 1 ? "passe" : "passes")")
        if assists == 0 { return g }
        if goals == 0 { return a }
        return g + L10n.t(" and ", " et ") + a
    }

    private static func describe(_ line: PlayerLine, _ player: IndexedPlayer) -> String {
        let who = line.team.map { "\(player.name), \($0.spokenName)" } ?? player.name
        let when = line.seasonLabel.map { L10n.t(" in \($0)", " en \($0)") } ?? L10n.t(" this season", " cette saison")
        guard line.gamesPlayed > 0 else {
            return L10n.t("\(player.name) hasn't played\(line.team.map { " for the \($0.spokenName)" } ?? "") this season.",
                          "\(player.name) n'a pas joué\(line.team.map { " pour les \($0.spokenName)" } ?? "") cette saison.")
        }
        let games = L10n.t("\(line.gamesPlayed) \(line.gamesPlayed == 1 ? "game" : "games")",
                           "\(line.gamesPlayed) \(line.gamesPlayed <= 1 ? "match" : "matchs")")

        if line.goalie {
            var parts = [recordWords(wins: line.wins, losses: line.losses, otLosses: line.otLosses, shootoutLosses: nil)]
            if let sv = line.savePct { parts.append(L10n.t("a \(savePercentage(sv)) save percentage", "un taux d'arrêts de \(savePercentage(sv))")) }
            if let gaa = line.gaa { parts.append(L10n.t("a \(twoDecimals(gaa)) goals-against average", "une moyenne de buts alloués de \(twoDecimals(gaa))")) }
            if line.shutouts > 0 {
                parts.append(L10n.t("\(line.shutouts) \(line.shutouts == 1 ? "shutout" : "shutouts")",
                                    "\(line.shutouts) \(line.shutouts <= 1 ? "blanchissage" : "blanchissages")"))
            }
            let last = parts.removeLast()
            let list = parts.isEmpty ? last : parts.joined(separator: ", ") + L10n.t(" and ", " et ") + last
            return L10n.t("\(who): \(list), in \(games)\(when).", "\(who) : \(list), en \(games)\(when).")
        }

        let scoring = line.goals == 0 && line.assists == 0
            ? L10n.t("no points", "aucun point")
            : goalsAndAssists(line.goals, line.assists) + L10n.t(" for \(line.points) \(line.points == 1 ? "point" : "points")",
                                                                 ", \(line.points) \(line.points <= 1 ? "point" : "points")")
        var text = L10n.t("\(who): \(scoring) in \(games)\(when)", "\(who) : \(scoring) en \(games)\(when)")
        if let pm = line.plusMinus {
            text += pm == 0 ? L10n.t(", even", ", différentiel nul")
                : pm > 0 ? L10n.t(", plus \(pm)", ", plus \(pm)") : L10n.t(", minus \(-pm)", ", moins \(-pm)")
        }
        text += "."
        if let last = line.lastGame { text += " " + last }
        return text
    }

    /// 0.893688 -> ".894" (English), "0,894" (French)
    private static func savePercentage(_ value: Double) -> String {
        let three = String(format: "%.3f", value)
        return L10n.isFrench ? three.replacingOccurrences(of: ".", with: ",")
                             : (three.hasPrefix("0") ? String(three.dropFirst()) : three)
    }

    private static func twoDecimals(_ value: Double) -> String {
        let s = String(format: "%.2f", value)
        return L10n.isFrench ? s.replacingOccurrences(of: ".", with: ",") : s
    }
}
