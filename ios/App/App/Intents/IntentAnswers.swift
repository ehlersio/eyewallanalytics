//
//  IntentAnswers.swift
//  App
//
//  The sentences Siri says (and Shortcuts returns) for each intent, built
//  from the same Worker routes the web app reads:
//
//    score     /nhl/today, /{pwhl,ahl,echl}/today?season=
//    next game /schedule?team=&season=, /{league}/schedule?teamId=&season=
//    record    /cache/standings (NHL; the site's /nhl-api proxy when the
//              Worker's copy is missing or another season's), /{league}/standings?season=
//    playoffs  /playoff-odds?team=, /{league}/playoff-odds?teamId=
//    goals     /nhl-api/v1/gamecenter/{id}/landing (NHL), /{league}/live/{id}
//    recap     /cache/narrative:game:{id}:{abbr} and the other leagues' keys
//    ranking   /power-rankings?team=&season=, /{league}/power-rankings?teamId=
//
//  Every number comes from one of those responses. When a route has nothing,
//  the answer says so rather than filling in a figure.
//
//  English or French, following the language iOS picked for the app (the
//  device's, which is also Siri's when it's one the app has).
//

import Foundation

enum L10n {
    static var isFrench: Bool { Bundle.main.preferredLocalizations.first?.hasPrefix("fr") == true }
    static func t(_ en: String, _ fr: String) -> String { isFrench ? fr : en }
    static var locale: Locale { Locale(identifier: isFrench ? "fr_CA" : "en_US") }

    static func ordinal(_ n: Int) -> String {
        if isFrench { return n == 1 ? "1er" : "\(n)e" }
        let suffix: String
        switch (n % 10, n % 100) {
        case (_, 11...13): suffix = "th"
        case (1, _): suffix = "st"
        case (2, _): suffix = "nd"
        case (3, _): suffix = "rd"
        default: suffix = "th"
        }
        return "\(n)\(suffix)"
    }

    static func percent(_ p: Double) -> String {
        if p > 0 && p < 0.005 { return t("under 1%", "moins de 1 %") }
        if p < 1 && p > 0.995 { return t("over 99%", "plus de 99 %") }
        let n = Int((p * 100).rounded())
        return t("\(n)%", "\(n) %")
    }

    /// "La LNH", "La LPHF", "La LAH", "L'ECHL"
    static func frenchLeague(_ league: String) -> String {
        switch league {
        case "nhl": return "La LNH"
        case "pwhl": return "La LPHF"
        case "ahl": return "La LAH"
        default: return "L'ECHL"
        }
    }

    static func number(_ n: Int) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.locale = locale
        return f.string(from: NSNumber(value: n)) ?? String(n)
    }
}

@available(iOS 16.0, *)
enum IntentAnswers {

    // MARK: Score

    static func score(_ team: IntentTeam) async throws -> String {
        if let game = try await todayGame(team) { return describeToday(game, for: team) }
        let next = try await nextGame(team)
        return L10n.t("No \(team.spokenName) game today. ", "Pas de match des \(team.spokenName) aujourd'hui. ") + next
    }

    static func todayGame(_ team: IntentTeam) async throws -> JSONObject? {
        let path: String
        if team.league == "nhl" {
            path = "/nhl/today"
        } else {
            let season = try await Seasons.load().current(team.league)
            path = "/\(team.league)/today?season=\(season)"
        }
        return try await Worker.rows(path).first { involves($0, team) }
    }

    private static func involves(_ game: JSONObject, _ team: IntentTeam) -> Bool {
        if let home = game.int("homeTeamId"), let away = game.int("awayTeamId") {
            return home == team.teamId || away == team.teamId
        }
        return game.string("homeTeamCode") == team.abbr || game.string("awayTeamCode") == team.abbr
    }

    private static func describeToday(_ game: JSONObject, for team: IntentTeam) -> String {
        let isHome: Bool
        if let home = game.int("homeTeamId") { isHome = home == team.teamId } else { isHome = game.string("homeTeamCode") == team.abbr }
        let opponent = teamName(league: team.league,
                                id: game.int(isHome ? "awayTeamId" : "homeTeamId"),
                                code: game.string(isHome ? "awayTeamCode" : "homeTeamCode"))
        let us = game.int(isHome ? "homeScore" : "awayScore") ?? 0
        let them = game.int(isHome ? "awayScore" : "homeScore") ?? 0
        let me = team.spokenName

        switch game.string("status") {
        case "live":
            let score = "\(me) \(us), \(opponent) \(them)"
            let number = game.int("period") ?? leadingNumber(game.string("periodLabel"))
            if game.bool("inIntermission"), let number, number <= 3 {
                return L10n.t("\(score), \(L10n.ordinal(number)) intermission.", "\(score), \(L10n.ordinal(number)) entracte.")
            }
            let period = periodName(number: number, type: game.string("periodType"), label: game.string("periodLabel"))
            let clock = game.string("clock").map(trimClock)
            switch (period, clock) {
            case let (period?, clock?) where clock != "0:00":
                return L10n.t("\(score), \(clock) left in the \(period).", "\(score), \(clock) à jouer en \(period).")
            case let (period?, _):
                return L10n.t("\(score), \(period).", "\(score), \(period).")
            default:
                return L10n.t("\(score), in progress.", "\(score), en cours.")
            }
        case "final":
            let ended = game.string("endedIn") ?? { let t = game.string("periodType"); return t == "OT" || t == "SO" ? t : nil }()
            let suffix: String
            switch ended {
            case "OT": suffix = L10n.t(" in overtime", " en prolongation")
            case "SO": suffix = L10n.t(" in a shootout", " en tirs de barrage")
            default: suffix = ""
            }
            return us > them
                ? L10n.t("Final: the \(me) beat the \(opponent) \(us)–\(them)\(suffix).",
                         "Final : les \(me) ont battu les \(opponent) \(us)-\(them)\(suffix).")
                : L10n.t("Final: the \(me) lost to the \(opponent) \(them)–\(us)\(suffix).",
                         "Final : les \(me) ont perdu \(them)-\(us) contre les \(opponent)\(suffix).")
        default:
            let matchup = isHome
                ? L10n.t("The \(me) host the \(opponent)", "Les \(me) reçoivent les \(opponent)")
                : L10n.t("The \(me) visit the \(opponent)", "Les \(me) visitent les \(opponent)")
            if let start = game.string("startTimeUTC").flatMap(parseISO) {
                return L10n.t("\(matchup) today at \(time(start)).", "\(matchup) aujourd'hui à \(time(start)).")
            }
            if let detail = game.string("statusDetail"), let t = feedTime(detail) {
                return L10n.t("\(matchup) today at \(t).", "\(matchup) aujourd'hui à \(t).")
            }
            return L10n.t("\(matchup) today.", "\(matchup) aujourd'hui.")
        }
    }

    // MARK: Next game

    /// The next game not yet started: during a game, the one after it.
    static func nextGame(_ team: IntentTeam) async throws -> String {
        let seasons = try await Seasons.load()
        if team.league == "nhl" {
            guard let season = seasons.nhl else { throw IntentFailure.unavailable }
            let rows = try await Worker.rows("/schedule?team=\(team.abbr)&season=\(season)")
            let upcoming = rows
                .filter { ["FUT", "PRE"].contains($0.string("gameState") ?? "") }
                .sorted { ($0.string("startTimeUTC") ?? "") < ($1.string("startTimeUTC") ?? "") }
            guard let game = upcoming.first else { return noUpcoming(team) }
            let isHome = game.object("homeTeam")?.string("abbrev") == team.abbr
            let other = game.object(isHome ? "awayTeam" : "homeTeam")
            let opponent = teamName(league: "nhl", id: nil, code: other?.string("abbrev"), fallback: other?.localized("commonName"))
            guard let start = game.string("startTimeUTC").flatMap(parseISO) else { return noUpcoming(team) }
            return nextSentence(team, opponent: opponent, isHome: isHome, day: day(start), at: time(start))
        }

        var seasonIds = [try seasons.current(team.league)]
        if team.league == "pwhl" { seasonIds += seasons.pwhlUpcoming.filter { !seasonIds.contains($0) } }
        let today = localDateString(Date())
        for season in seasonIds {
            let rows = try await Worker.rows("/\(team.league)/schedule?teamId=\(team.teamId)&season=\(season)")
            let upcoming = rows
                .filter { ($0.string("game_date") ?? "") >= today && !isFinal($0) && $0.int("game_status_code") != 2 }
                .sorted { ($0.string("game_date") ?? "") < ($1.string("game_date") ?? "") }
            guard let game = upcoming.first else { continue }
            let isHome = game.int("home_team_id") == team.teamId
            let opponent = teamName(league: team.league, id: game.int(isHome ? "away_team_id" : "home_team_id"), code: nil)
            guard let date = game.string("game_date").flatMap(parseDay) else { continue }
            return nextSentence(team, opponent: opponent, isHome: isHome, day: day(date, utc: true),
                                at: game.string("game_state").flatMap(feedTime))
        }
        return noUpcoming(team)
    }

    private static func isFinal(_ game: JSONObject) -> Bool {
        game.int("game_status_code") == 4 || (game.string("game_state") ?? "").lowercased().hasPrefix("final")
    }

    private static func nextSentence(_ team: IntentTeam, opponent: String, isHome: Bool, day: String, at time: String?) -> String {
        let matchup = isHome
            ? L10n.t("the \(team.spokenName) host the \(opponent)", "les \(team.spokenName) reçoivent les \(opponent)")
            : L10n.t("the \(team.spokenName) visit the \(opponent)", "les \(team.spokenName) visitent les \(opponent)")
        let when = time.map { L10n.t("\(day) at \($0)", "\(day) à \($0)") } ?? day
        return L10n.t("Next game: \(matchup) \(when).", "Prochain match : \(matchup) \(when).")
    }

    private static func noUpcoming(_ team: IntentTeam) -> String {
        L10n.t("The \(team.spokenName) have no upcoming games on the schedule.",
               "Aucun match des \(team.spokenName) n'est prévu au calendrier.")
    }

    // MARK: Goals

    /// Who scored: the last goal in detail, then every scorer by team. Today's
    /// game (live or final), else the team's most recent game.
    static func goals(_ team: IntentTeam) async throws -> String {
        let today = try await todayGame(team)
        if let today, today.string("status") == "pre" {
            return describeToday(today, for: team) + L10n.t(" No goals yet.", " Aucun but pour l'instant.")
        }
        let game: GameRef
        if let today, let id = today.int("gameId") {
            game = GameRef(id: id, label: nil, final: today.string("status") == "final")
        } else if let last = try await lastGame(team) {
            game = last
        } else {
            return notPlayed(team)
        }
        return try await goals(team, in: game)
    }

    private static func goals(_ team: IntentTeam, in game: GameRef) async throws -> String {
        let feed = team.league == "nhl" ? try await nhlGoals(game.id) : try await hockeyTechGoals(team.league, game.id)
        guard let feed else { throw IntentFailure.unavailable }
        let prefix = game.label.map { L10n.t("Last game, \($0). ", "Dernier match, \($0). ") }
            ?? (game.final ? L10n.t("Final. ", "Final. ") : "")
        let home = teamName(league: team.league, id: feed.homeId, code: feed.homeCode)
        let away = teamName(league: team.league, id: feed.awayId, code: feed.awayCode)
        let scoreLine = L10n.t("\(away) \(feed.awayScore), \(home) \(feed.homeScore)", "\(away) \(feed.awayScore), \(home) \(feed.homeScore)")
        guard let last = feed.goals.last else {
            return prefix + L10n.t("No goals yet. \(scoreLine).", "Aucun but pour l'instant. \(scoreLine).")
        }

        func scorerTeam(_ goal: Goal) -> String { goal.isHome ? home : away }
        var kind = ""
        if last.emptyNet { kind = L10n.t(", into an empty net", ", dans un filet désert") }
        else if last.penaltyShot { kind = L10n.t(", on a penalty shot", ", sur un tir de pénalité") }
        else if last.powerPlay { kind = L10n.t(", on the power play", ", en avantage numérique") }
        else if last.shortHanded { kind = L10n.t(", shorthanded", ", en désavantage numérique") }
        let when: String
        if last.period > 3, let name = periodName(number: last.period, type: "OT", label: nil) {
            // "at 3:13 of overtime", "at 4:02 of the 2nd overtime"
            when = last.period > 4 ? L10n.t(" at \(last.time) of the \(name)", " à \(last.time) de la \(name)")
                                   : L10n.t(" at \(last.time) of overtime", " à \(last.time) de la prolongation")
        } else if let name = periodName(number: last.period, type: "REG", label: nil) {
            when = L10n.t(" at \(last.time) of the \(name)", " à \(last.time) de la \(name)")
        } else {
            when = ""
        }
        let assisted: String
        switch last.assists.count {
        case 0: assisted = L10n.t(", unassisted", ", sans aide")
        case 1: assisted = L10n.t(", from \(last.assists[0])", ", aidé de \(last.assists[0])")
        default: assisted = L10n.t(", from \(last.assists[0]) and \(last.assists[1])", ", aidé de \(last.assists[0]) et \(last.assists[1])")
        }
        var text = prefix + L10n.t("Last goal: \(last.scorer) for the \(scorerTeam(last))\(kind)\(when)\(assisted). ",
                                   "Dernier but : \(last.scorer) pour les \(scorerTeam(last))\(kind)\(when)\(assisted). ")
        text += scoreLine + "."

        // Scorers by team, in order: "Predators goals: Perbix, Josi and Edstrom."
        guard feed.goals.count > 1 else { return text }
        for (name, goals) in [(away, feed.goals.filter { !$0.isHome }), (home, feed.goals.filter { $0.isHome })] where !goals.isEmpty {
            // Each scorer once, in order of their first goal: "Lindauer twice and Leyh".
            var order: [String] = [], counts: [String: Int] = [:]
            for name in goals.map(\.scorerLastName) {
                if counts[name] == nil { order.append(name) }
                counts[name, default: 0] += 1
            }
            let names = order.map { name -> String in
                switch counts[name] ?? 1 {
                case 1: return name
                case 2: return L10n.t("\(name) twice", "\(name) deux fois")
                case let n: return L10n.t("\(name) \(n) times", "\(name) \(n) fois")
                }
            }
            let list = names.count > 1 ? names.dropLast().joined(separator: ", ") + L10n.t(" and ", " et ") + names.last! : names[0]
            text += L10n.t(" \(name) goals: \(list).", " Buts des \(name) : \(list).")
        }
        return text
    }

    private struct GameRef { let id: Int; let label: String?; var final = true }

    private struct Goal {
        let scorer: String, scorerLastName: String, assists: [String]
        let period: Int, time: String, isHome: Bool
        let powerPlay: Bool, shortHanded: Bool, emptyNet: Bool, penaltyShot: Bool
    }

    private struct GoalFeed {
        let homeId: Int?, awayId: Int?, homeCode: String?, awayCode: String?
        let homeScore: Int, awayScore: Int, goals: [Goal]
    }

    /// The team's most recent finished game, labelled with its day.
    private static func lastGame(_ team: IntentTeam) async throws -> GameRef? {
        let seasons = try await Seasons.load()
        if team.league == "nhl" {
            guard let season = seasons.nhl else { throw IntentFailure.unavailable }
            let rows = try await Worker.rows("/schedule?team=\(team.abbr)&season=\(season)")
            guard let game = rows.filter({ ["OFF", "FINAL"].contains($0.string("gameState") ?? "") })
                .max(by: { ($0.string("startTimeUTC") ?? "") < ($1.string("startTimeUTC") ?? "") }),
                  let id = game.int("id") else { return nil }
            return GameRef(id: id, label: game.string("startTimeUTC").flatMap(parseISO).map { day($0) })
        }
        let rows = try await Worker.rows("/\(team.league)/schedule?teamId=\(team.teamId)&season=\(try seasons.current(team.league))")
        guard let game = rows.filter(isFinal).max(by: { ($0.string("game_date") ?? "") < ($1.string("game_date") ?? "") }),
              let id = game.int("game_id") else { return nil }
        return GameRef(id: id, label: game.string("game_date").flatMap(parseDay).map { day($0, utc: true) })
    }

    /// The NHL's game landing (through the site's proxy): summary.scoring.
    private static func nhlGoals(_ gameId: Int) async throws -> GoalFeed? {
        guard let url = URL(string: "\(Worker.siteOrigin)/nhl-api/v1/gamecenter/\(gameId)/landing"),
              let landing = try await Worker.fetch(url) as? JSONObject else { return nil }
        let homeCode = landing.object("homeTeam")?.string("abbrev"), awayCode = landing.object("awayTeam")?.string("abbrev")
        var goals: [Goal] = []
        for period in (landing.object("summary")?["scoring"] as? [JSONObject]) ?? [] {
            let descriptor = period.object("periodDescriptor")
            guard descriptor?.string("periodType") != "SO" else { continue }
            for goal in (period["goals"] as? [JSONObject]) ?? [] {
                let first = goal.localized("firstName") ?? "", last = goal.localized("lastName") ?? ""
                let assists = ((goal["assists"] as? [JSONObject]) ?? []).map {
                    "\($0.localized("firstName") ?? "") \($0.localized("lastName") ?? "")".trimmingCharacters(in: .whitespaces)
                }
                let modifier = goal.string("goalModifier")
                goals.append(Goal(scorer: "\(first) \(last)".trimmingCharacters(in: .whitespaces), scorerLastName: last, assists: assists,
                                  period: descriptor?.int("number") ?? 0, time: trimClock(goal.string("timeInPeriod") ?? ""),
                                  isHome: goal.bool("isHome"),
                                  powerPlay: goal.string("strength") == "pp", shortHanded: goal.string("strength") == "sh",
                                  emptyNet: modifier == "empty-net", penaltyShot: modifier == "penalty-shot"))
            }
        }
        return GoalFeed(homeId: nil, awayId: nil, homeCode: homeCode, awayCode: awayCode,
                        homeScore: landing.object("homeTeam")?.int("score") ?? 0, awayScore: landing.object("awayTeam")?.int("score") ?? 0,
                        goals: goals)
    }

    /// The Worker's normalized play-by-play for PWHL/AHL/ECHL games.
    private static func hockeyTechGoals(_ league: String, _ gameId: Int) async throws -> GoalFeed? {
        guard let live = try await Worker.object("/\(league)/live/\(gameId)") else { return nil }
        let homeId = live.int("homeTeamId")
        func person(_ p: JSONObject?) -> String {
            "\(p?.string("firstName") ?? "") \(p?.string("lastName") ?? "")".trimmingCharacters(in: .whitespaces)
        }
        let goals = ((live["events"] as? [JSONObject]) ?? []).filter { $0.string("eventType") == "goal" }.map { event in
            Goal(scorer: person(event.object("scoredBy")), scorerLastName: event.object("scoredBy")?.string("lastName") ?? "",
                 assists: ((event["assists"] as? [JSONObject]) ?? []).map(person),
                 period: event.int("period") ?? 0, time: trimClock(event.string("time") ?? ""),
                 isHome: event.int("teamId") == homeId,
                 powerPlay: event.bool("isPowerPlay"), shortHanded: event.bool("isShortHanded"),
                 emptyNet: event.bool("isEmptyNet"), penaltyShot: event.bool("isPenaltyShot"))
        }
        return GoalFeed(homeId: homeId, awayId: live.int("awayTeamId"), homeCode: nil, awayCode: nil,
                        homeScore: live.int("homeScore") ?? 0, awayScore: live.int("awayScore") ?? 0, goals: goals)
    }

    // MARK: Recap

    /// The EyeWall AI recap of the team's last finished game: the one the
    /// app's game summary shows, read back from the Worker's KV (/cache/),
    /// never generated here. Only games someone followed in the app have
    /// one, so without it the answer is the final score and the scorers.
    /// NHL and PWHL recaps are written in English only: in French those
    /// games get the score and scorers.
    static func recap(_ team: IntentTeam) async throws -> String {
        let today = try await todayGame(team)
        if let today, today.string("status") == "live" {
            return describeToday(today, for: team)
                + L10n.t(" EyeWall AI writes its recap after the final.", " EyeWall AI écrit son résumé après le match.")
        }
        let game: GameRef
        if let today, today.string("status") == "final", let id = today.int("gameId") {
            game = GameRef(id: id, label: nil)
        } else if let last = try await lastGame(team) {
            game = last
        } else {
            return notPlayed(team)
        }
        if let text = await cachedRecap(team, gameId: game.id) {
            let prefix = game.label.map { L10n.t("Last game, \($0). ", "Dernier match, \($0). ") } ?? L10n.t("Final. ", "Final. ")
            return prefix + spokenRecords(text)
        }
        let note = L10n.isFrench && ["nhl", "pwhl"].contains(team.league)
            ? "EyeWall AI écrit ses résumés de la \(team.league == "nhl" ? "LNH" : "LPHF") en anglais seulement. "
            : L10n.t("EyeWall AI has no recap of that game for the \(team.spokenName). ",
                     "EyeWall AI n'a pas de résumé de ce match pour les \(team.spokenName). ")
        return note + (try await goals(team, in: game))
    }

    /// The game recap the Worker filed for this team (narrativeCache.js's keys).
    private static func cachedRecap(_ team: IntentTeam, gameId: Int) async -> String? {
        // NHL and PWHL recaps are English only.
        if L10n.isFrench && ["nhl", "pwhl"].contains(team.league) { return nil }
        let key: String
        switch team.league {
        case "nhl": key = "narrative:game:\(gameId):\(team.abbr.uppercased())"
        case "pwhl": key = "pwhl:narrative:game:\(gameId):\(team.abbr.uppercased())"
        default: key = "\(team.league):narrative:game:\(gameId):\(team.teamId)\(L10n.isFrench ? ":fr" : "")"
        }
        guard let encoded = key.addingPercentEncoding(withAllowedCharacters: .alphanumerics),
              let cached = try? await Worker.object("/cache/\(encoded)"),
              let text = cached.string("narrative"), !text.isEmpty else { return nil }
        return text
    }

    // MARK: Power ranking

    /// EyeWall's power ranking: the rank, the move since the previous run,
    /// and the EyeWall AI write-up that goes with it (the League tab's).
    static func powerRanking(_ team: IntentTeam) async throws -> String {
        let rank: Int, prior: Int?, of: Int?, text: String?
        if team.league == "nhl" {
            let season = try await Seasons.load().nhl
            guard let season, let row = try await Worker.rows("/power-rankings?team=\(team.abbr)&season=\(season)&limit=1").first,
                  let r = row.int("rank") else { return noRanking(team) }
            // NHL write-ups are English only.
            rank = r; prior = row.int("prior_rank"); of = TeamCatalog.all.filter { $0.league == "nhl" }.count
            text = L10n.isFrench ? nil : row.string("narrative")
        } else {
            let locale = L10n.isFrench ? "fr" : "en"
            guard let data = try await Worker.object("/\(team.league)/power-rankings?teamId=\(team.teamId)&locale=\(locale)"),
                  let latest = data["latest"] as? [JSONObject],
                  let row = latest.first(where: { $0.int("team_id") == team.teamId }),
                  let r = row.int("rank") else { return noRanking(team) }
            rank = r; prior = row.int("prior_rank"); of = latest.count
            text = data.object("narrative")?.string("text")
        }
        let ofText = of.map { L10n.t(" of \($0)", " sur \($0)") } ?? ""
        var sentence = L10n.t("The \(team.spokenName) are \(L10n.ordinal(rank))\(ofText) in EyeWall's power rankings",
                              "Les \(team.spokenName) sont au \(L10n.ordinal(rank)) rang\(ofText) du classement de puissance d'EyeWall")
        if let prior, prior != rank {
            sentence += prior > rank ? L10n.t(", up from \(L10n.ordinal(prior))", ", en hausse du \(L10n.ordinal(prior)) rang")
                                     : L10n.t(", down from \(L10n.ordinal(prior))", ", en baisse du \(L10n.ordinal(prior)) rang")
        } else if prior != nil {
            sentence += L10n.t(", unchanged", ", sans changement")
        }
        sentence += "."
        if let text, !text.isEmpty { sentence += " " + spokenRecords(text) }
        return sentence
    }

    private static func noRanking(_ team: IntentTeam) -> String {
        L10n.t("EyeWall hasn't ranked the \(team.spokenName) yet this season.",
               "EyeWall n'a pas encore classé les \(team.spokenName) cette saison.")
    }

    /// EyeWall AI's text writes records as "7-2-1", which Siri reads as
    /// "7 to 2 to 1": spell out every three-number record. In English, "a
    /// 5-5-1 record" becomes "a record of 5 wins, 5 losses and 1 overtime
    /// loss" (French already writes "une fiche de 5-5-1").
    static func spokenRecords(_ text: String) -> String {
        let record = #"(?<![\d.\-])(\d{1,2})-(\d{1,2})-(\d{1,2})(?![\d\-])"#
        var out = text
        if !L10n.isFrench {
            // "an 8-1-2 start" -> "a start of ...": the article goes with the new first word.
            for (articles, template) in [("an", "a $5 of $2-$3-$4"), ("a|the|its|their", "$1 $5 of $2-$3-$4")] {
                guard let regex = try? NSRegularExpression(pattern: #"\b("# + articles + #")\s+"# + record + #"\s+(record|start|mark|run|stretch)\b"#,
                                                           options: .caseInsensitive) else { continue }
                out = regex.stringByReplacingMatches(in: out, range: NSRange(out.startIndex..., in: out), withTemplate: template)
            }
        }
        guard let regex = try? NSRegularExpression(pattern: record) else { return out }
        let source = out as NSString
        for match in regex.matches(in: out, range: NSRange(location: 0, length: source.length)).reversed() {
            let n = (1...3).map { Int(source.substring(with: match.range(at: $0))) ?? 0 }
            out = (out as NSString).replacingCharacters(in: match.range,
                                                         with: recordWords(wins: n[0], losses: n[1], otLosses: n[2], shootoutLosses: nil))
        }
        return out
    }

    // MARK: Record

    static func record(_ team: IntentTeam) async throws -> String {
        let seasons = try await Seasons.load()
        if team.league == "nhl" {
            guard let row = try await nhlStandingsRow(team, season: seasons.nhl) else { return noRecord(team) }
            let gp = row.int("gamesPlayed") ?? 0
            guard gp > 0 else { return notPlayed(team) }
            let rec = recordWords(wins: row.int("wins") ?? 0, losses: row.int("losses") ?? 0,
                                  otLosses: row.int("otLosses") ?? 0, shootoutLosses: nil)
            let pts = row.int("points") ?? 0
            let rowSeason = row.int("seasonId").map(String.init) ?? row.string("seasonId")
            let label = rowSeason != nil && rowSeason != seasons.nhl ? " (\(seasonLabel(rowSeason!)))" : ""
            var text = L10n.t("\(team.spokenName)\(label): \(rec). \(pts) points in \(gp) games",
                              "\(team.spokenName)\(label) : \(rec). \(pts) points en \(gp) matchs")
            if let place = row.int("divisionSequence"), let division = row.string("divisionName") ?? row.localized("divisionName") {
                text += L10n.t(", \(L10n.ordinal(place)) in the \(division) Division", ", \(L10n.ordinal(place)) de la division \(division)")
            }
            return text + "."
        }

        let season = try seasons.current(team.league)
        let rows = try await Worker.rows("/\(team.league)/standings?season=\(season)")
        guard let row = rows.first(where: { $0.int("team_id") == team.teamId }) else { return noRecord(team) }
        let gp = row.int("gp") ?? 0
        guard gp > 0 else { return notPlayed(team) }
        let rec = recordWords(wins: row.int("wins") ?? 0, losses: row.int("losses") ?? 0,
                              otLosses: row.int("ot_losses") ?? 0, shootoutLosses: row.int("shootout_losses"))
        let pts = row.int("points") ?? 0
        let label = team.league == "pwhl" ? seasons.pwhlStartYear.map { " (\($0)–\(String(($0 + 1) % 100)))" } ?? "" : ""
        return L10n.t("\(team.spokenName)\(label): \(rec). \(pts) points in \(gp) games.",
                      "\(team.spokenName)\(label) : \(rec). \(pts) points en \(gp) matchs.")
    }

    /// "11 wins, 4 losses, 1 overtime loss". Siri reads the answer aloud, and
    /// "11-4-1" comes out as "11 to 4 to 1".
    static func recordWords(wins: Int, losses: Int, otLosses: Int, shootoutLosses: Int?) -> String {
        // English: singular for 1 only. French: singular for 0 and 1.
        func count(_ n: Int, _ en: String, _ enPlural: String, _ fr: String, _ frPlural: String) -> String {
            L10n.t("\(n) \(n == 1 ? en : enPlural)", "\(n) \(n <= 1 ? fr : frPlural)")
        }
        // Wins and losses always; overtime and shootout losses only when
        // there are some ("5 wins and 6 losses", not "..., 0 overtime losses").
        var parts = [
            count(wins, "win", "wins", "victoire", "victoires"),
            count(losses, "loss", "losses", "défaite", "défaites"),
        ]
        if otLosses > 0 {
            parts.append(count(otLosses, "overtime loss", "overtime losses", "défaite en prolongation", "défaites en prolongation"))
        }
        if let shootoutLosses, shootoutLosses > 0 {
            parts.append(count(shootoutLosses, "shootout loss", "shootout losses", "défaite en tirs de barrage", "défaites en tirs de barrage"))
        }
        let last = parts.removeLast()
        return parts.joined(separator: ", ") + L10n.t(" and ", " et ") + last
    }

    /// The Worker's standings, else the NHL's own through the site's proxy
    /// (as nhlApi.js's fetchLatestStandings does): the Worker's copy expires
    /// every few minutes and can be another season's early on.
    private static func nhlStandingsRow(_ team: IntentTeam, season: String?) async throws -> JSONObject? {
        let match: (JSONObject) -> Bool = { $0.localized("teamAbbrev") == team.abbr }
        if let rows = try? await Worker.rows("/cache/standings?team=\(team.abbr)"), let row = rows.first(where: match) {
            let rowSeason = row.int("seasonId").map(String.init) ?? row.string("seasonId")
            if season == nil || rowSeason == nil || rowSeason == season { return row }
        }
        guard let index = try await Worker.fetch(URL(string: "\(Worker.siteOrigin)/nhl-api/v1/standings-season")!) as? JSONObject
        else { return nil }
        let today = index.string("currentDate")
        let windows = (index["seasons"] as? [JSONObject] ?? [])
            .filter { $0.string("standingsStart") != nil && $0.string("standingsEnd") != nil }
            .filter { today == nil || $0.string("standingsStart")! <= today! }
            .sorted { $0.string("standingsStart")! > $1.string("standingsStart")! }
        guard let latest = windows.first, let end = latest.string("standingsEnd") else { return nil }
        let date = today.map { $0 < end ? $0 : end } ?? end
        let standings = try await Worker.fetch(URL(string: "\(Worker.siteOrigin)/nhl-api/v1/standings/\(date)")!) as? JSONObject
        return (standings?["standings"] as? [JSONObject])?.first(where: match)
    }

    private static func noRecord(_ team: IntentTeam) -> String {
        L10n.t("EyeWall has no standings for the \(team.spokenName) right now.",
               "EyeWall n'a pas de classement pour les \(team.spokenName) pour l'instant.")
    }

    private static func notPlayed(_ team: IntentTeam) -> String {
        L10n.t("The \(team.spokenName) haven't played a game yet this season.",
               "Les \(team.spokenName) n'ont pas encore joué cette saison.")
    }

    // MARK: Playoff chances

    static func playoffChances(_ team: IntentTeam) async throws -> String {
        let path = team.league == "nhl"
            ? "/playoff-odds?team=\(team.abbr)"
            : "/\(team.league)/playoff-odds?teamId=\(team.teamId)"
        guard let odds = try await Worker.object(path), let latest = odds.object("latest") else {
            return L10n.t("EyeWall hasn't run a season simulation for the \(team.spokenName) yet.",
                          "EyeWall n'a pas encore simulé la saison des \(team.spokenName).")
        }
        let nhl = team.league == "nhl"
        let pct = latest.double(nhl ? "playoff_pct" : "make_playoffs_pct")
        let proj = latest.double(nhl ? "proj_points" : "proj_points_p50").map { Int($0.rounded()) }
        let low = latest.int(nhl ? "points_p10" : "proj_points_p10")
        let high = latest.int(nhl ? "points_p90" : "proj_points_p90")
        let sims = latest.int("sims")

        var parts: [String] = []
        if let pct {
            let simsText = sims.map { L10n.t("\(L10n.number($0)) simulations", "\(L10n.number($0)) simulations") }
                ?? L10n.t("its simulations", "ses simulations")
            parts.append(L10n.t("The \(team.spokenName) make the playoffs in \(L10n.percent(pct)) of EyeWall's \(simsText) of the season.",
                                "Les \(team.spokenName) font les séries dans \(L10n.percent(pct)) des \(simsText) de la saison par EyeWall."))
        } else if latest.string("format") == "unverified" {
            parts.append(L10n.t("The \(team.leagueLabel) hasn't published this season's playoff format, so EyeWall has no playoff probability for the \(team.spokenName) yet.",
                                "\(L10n.frenchLeague(team.league)) n'a pas publié le format des séries de cette saison, donc EyeWall n'a pas encore de probabilité de séries pour les \(team.spokenName)."))
        } else {
            parts.append(L10n.t("EyeWall has no playoff probability for the \(team.spokenName) yet.",
                                "EyeWall n'a pas encore de probabilité de séries pour les \(team.spokenName)."))
        }
        if let proj {
            let range = (low != nil && high != nil) ? L10n.t(" (\(low!) to \(high!))", " (de \(low!) à \(high!))") : ""
            parts.append(L10n.t("Projected points: \(proj)\(range).", "Points projetés : \(proj)\(range)."))
        }
        if odds.bool("stale"), let run = latest.string("run_date").flatMap(parseDay) {
            parts.append(L10n.t("Last run \(day(run, utc: true)).", "Dernière simulation : \(day(run, utc: true))."))
        }
        return parts.joined(separator: " ")
    }

    // MARK: Formatting

    private static func teamName(league: String, id: Int?, code: String?, fallback: String? = nil) -> String {
        if let id, let team = TeamCatalog.team(league: league, teamId: id) { return team.spokenName }
        if let code, let team = TeamCatalog.team(league: league, abbr: code) { return team.spokenName }
        return fallback ?? code ?? L10n.t("their opponent", "leur adversaire")
    }

    private static func periodName(number: Int?, type: String?, label: String?) -> String? {
        let kind = type ?? label.map { $0.uppercased().hasSuffix("OT") ? "OT" : ($0.uppercased() == "SO" ? "SO" : "REG") }
        switch kind {
        case "SO": return L10n.t("shootout", "tirs de barrage")
        case "OT":
            if let number, number > 4 { return L10n.t("\(L10n.ordinal(number - 3)) overtime", "\(number - 3)e prolongation") }
            return L10n.t("overtime", "prolongation")
        default:
            guard let number else { return nil }
            return L10n.t("\(L10n.ordinal(number)) period", "\(L10n.ordinal(number)) période")
        }
    }

    private static func leadingNumber(_ s: String?) -> Int? {
        guard let s else { return nil }
        return Int(s.prefix(while: \.isNumber))
    }

    /// "08:26" -> "8:26"
    private static func trimClock(_ clock: String) -> String {
        clock.hasPrefix("0") && clock.count > 4 ? String(clock.dropFirst()) : clock
    }

    /// A start time as HockeyTech gives it ("7:00PM", "3:00 pm EST"), or nil
    /// for anything else ("Final", "TBD"). Without a zone, it's the arena's.
    private static func feedTime(_ s: String) -> String? {
        let trimmed = s.trimmingCharacters(in: .whitespaces)
        guard trimmed.range(of: #"^\d{1,2}:\d{2}"#, options: .regularExpression) != nil else { return nil }
        let hasZone = trimmed.range(of: #"[A-Za-z]{2,}T$"#, options: .regularExpression) != nil
        return hasZone ? trimmed : L10n.t("\(trimmed) local time", "\(trimmed) heure locale")
    }

    private static func parseISO(_ s: String) -> Date? {
        let f = ISO8601DateFormatter()
        return f.date(from: s)
    }

    /// "2026-11-06" as midnight UTC.
    private static func parseDay(_ s: String) -> Date? {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f.date(from: String(s.prefix(10)))
    }

    private static func localDateString(_ date: Date) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    private static func time(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = L10n.locale
        f.timeStyle = .short
        f.dateStyle = .none
        return f.string(from: date)
    }

    /// "today", "tomorrow" or "Thursday, November 6". `utc` for a bare
    /// calendar date (parseDay), which must not shift with the time zone.
    private static func day(_ date: Date, utc: Bool = false) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = utc ? TimeZone(identifier: "UTC")! : .current
        let todayString = localDateString(Date())
        let f = DateFormatter()
        f.calendar = calendar
        f.timeZone = calendar.timeZone
        f.dateFormat = "yyyy-MM-dd"
        let dayString = f.string(from: date)
        if dayString == todayString { return L10n.t("today", "aujourd'hui") }
        if let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Date()), dayString == localDateString(tomorrow) {
            return L10n.t("tomorrow", "demain")
        }
        f.locale = L10n.locale
        f.setLocalizedDateFormatFromTemplate("EEEEMMMMd")
        return f.string(from: date)
    }

    /// "20262027" -> "2026–27"
    private static func seasonLabel(_ id: String) -> String {
        guard id.count == 8 else { return id }
        return "\(id.prefix(4))–\(id.suffix(2))"
    }
}
