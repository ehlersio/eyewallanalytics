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
        return L10n.t("No \(team.shortName) game today. ", "Pas de match des \(team.shortName) aujourd'hui. ") + next
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
        let me = team.shortName

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
            ? L10n.t("the \(team.shortName) host the \(opponent)", "les \(team.shortName) reçoivent les \(opponent)")
            : L10n.t("the \(team.shortName) visit the \(opponent)", "les \(team.shortName) visitent les \(opponent)")
        let when = time.map { L10n.t("\(day) at \($0)", "\(day) à \($0)") } ?? day
        return L10n.t("Next game: \(matchup) \(when).", "Prochain match : \(matchup) \(when).")
    }

    private static func noUpcoming(_ team: IntentTeam) -> String {
        L10n.t("The \(team.shortName) have no upcoming games on the schedule.",
               "Aucun match des \(team.shortName) n'est prévu au calendrier.")
    }

    // MARK: Record

    static func record(_ team: IntentTeam) async throws -> String {
        let seasons = try await Seasons.load()
        if team.league == "nhl" {
            guard let row = try await nhlStandingsRow(team, season: seasons.nhl) else { return noRecord(team) }
            let gp = row.int("gamesPlayed") ?? 0
            guard gp > 0 else { return notPlayed(team) }
            let rec = "\(row.int("wins") ?? 0)-\(row.int("losses") ?? 0)-\(row.int("otLosses") ?? 0)"
            let pts = row.int("points") ?? 0
            let rowSeason = row.int("seasonId").map(String.init) ?? row.string("seasonId")
            let label = rowSeason != nil && rowSeason != seasons.nhl ? " (\(seasonLabel(rowSeason!)))" : ""
            var text = L10n.t("\(team.shortName)\(label): \(rec), \(pts) points in \(gp) games",
                              "\(team.shortName)\(label) : \(rec), \(pts) points en \(gp) matchs")
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
        var rec = "\(row.int("wins") ?? 0)-\(row.int("losses") ?? 0)-\(row.int("ot_losses") ?? 0)"
        if let sol = row.int("shootout_losses") { rec += "-\(sol)" }
        let pts = row.int("points") ?? 0
        let label = team.league == "pwhl" ? seasons.pwhlStartYear.map { " (\($0)–\(String(($0 + 1) % 100)))" } ?? "" : ""
        return L10n.t("\(team.shortName)\(label): \(rec), \(pts) points in \(gp) games.",
                      "\(team.shortName)\(label) : \(rec), \(pts) points en \(gp) matchs.")
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
        L10n.t("EyeWall has no standings for the \(team.shortName) right now.",
               "EyeWall n'a pas de classement pour les \(team.shortName) pour l'instant.")
    }

    private static func notPlayed(_ team: IntentTeam) -> String {
        L10n.t("The \(team.shortName) haven't played a game yet this season.",
               "Les \(team.shortName) n'ont pas encore joué cette saison.")
    }

    // MARK: Playoff chances

    static func playoffChances(_ team: IntentTeam) async throws -> String {
        let path = team.league == "nhl"
            ? "/playoff-odds?team=\(team.abbr)"
            : "/\(team.league)/playoff-odds?teamId=\(team.teamId)"
        guard let odds = try await Worker.object(path), let latest = odds.object("latest") else {
            return L10n.t("EyeWall hasn't run a season simulation for the \(team.shortName) yet.",
                          "EyeWall n'a pas encore simulé la saison des \(team.shortName).")
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
            parts.append(L10n.t("The \(team.shortName) make the playoffs in \(L10n.percent(pct)) of EyeWall's \(simsText) of the season.",
                                "Les \(team.shortName) font les séries dans \(L10n.percent(pct)) des \(simsText) de la saison par EyeWall."))
        } else if latest.string("format") == "unverified" {
            parts.append(L10n.t("The \(team.leagueLabel) hasn't published this season's playoff format, so EyeWall has no playoff probability for the \(team.shortName) yet.",
                                "\(L10n.frenchLeague(team.league)) n'a pas publié le format des séries de cette saison, donc EyeWall n'a pas encore de probabilité de séries pour les \(team.shortName)."))
        } else {
            parts.append(L10n.t("EyeWall has no playoff probability for the \(team.shortName) yet.",
                                "EyeWall n'a pas encore de probabilité de séries pour les \(team.shortName)."))
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
        if let id, let team = TeamCatalog.team(league: league, teamId: id) { return team.shortName }
        if let code, let team = TeamCatalog.team(league: league, abbr: code) { return team.shortName }
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
