//
//  EyeWallIntents.swift
//  App
//
//  Siri and Shortcuts: the score, next game, record and playoff chances of
//  any team in the app, the primary followed team when none is named.
//  Answers come from IntentAnswers.swift; the phrases Siri listens for are
//  in EyeWallShortcuts below (French in fr.lproj/AppShortcuts.strings).
//
//  Plain App Intents on the release SDK. Apple's Siri AI (developer preview
//  in iOS 27.3, App Store submissions from spring 2027) builds on these same
//  intents with @AppIntent(.tool) and descriptions once it can ship.
//

import AppIntents

// MARK: - Team

@available(iOS 16.0, *)
struct TeamEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Team"
    static let defaultQuery = TeamQuery()

    /// "nhl:CAR"
    let id: String
    let team: IntentTeam

    init(_ team: IntentTeam) {
        id = team.id
        self.team = team
    }

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(team.shortName)", subtitle: "\(team.leagueLabel) · \(team.name)")
    }
}

@available(iOS 16.0, *)
struct TeamQuery: EntityStringQuery {
    func entities(for identifiers: [String]) async throws -> [TeamEntity] {
        identifiers.compactMap { TeamCatalog.byId[$0] }.map(TeamEntity.init)
    }

    func entities(matching string: String) async throws -> [TeamEntity] {
        let query = string.trimmingCharacters(in: .whitespaces).lowercased()
        guard !query.isEmpty else { return ordered().map(TeamEntity.init) }
        return ordered().filter {
            $0.name.lowercased().contains(query) || $0.shortName.lowercased().contains(query) || $0.abbr.lowercased() == query
        }.map(TeamEntity.init)
    }

    /// The followed teams: the ones Siri can hear in "What's the Canes
    /// score in EyeWall", and the first ones Shortcuts offers. Not every
    /// team -- each suggested team gets its own tile in the Shortcuts app.
    /// Any other team is a search away (entities(matching:)).
    func suggestedEntities() async throws -> [TeamEntity] {
        IntentContext.followedTeams.map(TeamEntity.init)
    }

    private func ordered() -> [IntentTeam] {
        let followed = IntentContext.followedTeams
        return followed + TeamCatalog.all.filter { !followed.contains($0) }
    }
}

// MARK: - Intents

@available(iOS 16.0, *)
struct GetScoreIntent: AppIntent {
    static let title: LocalizedStringResource = "Get Score"
    static let description = IntentDescription("Today's score for a team, or its next game when it isn't playing today.")

    @Parameter(title: "Team")
    var team: TeamEntity?

    static var parameterSummary: some ParameterSummary { Summary("Get the score for \(\.$team)") }

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let text = try await IntentAnswers.score(IntentContext.resolve(team?.id))
        return .result(value: text, dialog: IntentDialog(stringLiteral: text))
    }
}

@available(iOS 16.0, *)
struct GetNextGameIntent: AppIntent {
    static let title: LocalizedStringResource = "Get Next Game"
    static let description = IntentDescription("When a team plays next, and who against.")

    @Parameter(title: "Team")
    var team: TeamEntity?

    static var parameterSummary: some ParameterSummary { Summary("Get the next game for \(\.$team)") }

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let text = try await IntentAnswers.nextGame(IntentContext.resolve(team?.id))
        return .result(value: text, dialog: IntentDialog(stringLiteral: text))
    }
}

@available(iOS 16.0, *)
struct GetRecordIntent: AppIntent {
    static let title: LocalizedStringResource = "Get Team Record"
    static let description = IntentDescription("A team's record and points this season, and its place in the division for NHL teams.")

    @Parameter(title: "Team")
    var team: TeamEntity?

    static var parameterSummary: some ParameterSummary { Summary("Get the record for \(\.$team)") }

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let text = try await IntentAnswers.record(IntentContext.resolve(team?.id))
        return .result(value: text, dialog: IntentDialog(stringLiteral: text))
    }
}

@available(iOS 16.0, *)
struct GetPlayoffChancesIntent: AppIntent {
    static let title: LocalizedStringResource = "Get Playoff Chances"
    static let description = IntentDescription("How often a team makes the playoffs in EyeWall's simulations of the rest of the season, and its projected points.")

    @Parameter(title: "Team")
    var team: TeamEntity?

    static var parameterSummary: some ParameterSummary { Summary("Get the playoff chances for \(\.$team)") }

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let text = try await IntentAnswers.playoffChances(IntentContext.resolve(team?.id))
        return .result(value: text, dialog: IntentDialog(stringLiteral: text))
    }
}

// MARK: - Siri phrases

// Every phrase has to name the app; "EyeWall" works as well as the full
// name (INAlternativeAppNames in Info.plist).
@available(iOS 17.0, *)
struct EyeWallShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: GetScoreIntent(),
            phrases: [
                "What's the score in \(.applicationName)",
                "\(.applicationName) score",
                "What's the \(\.$team) score in \(.applicationName)",
                "How are the \(\.$team) doing in \(.applicationName)",
            ],
            shortTitle: "Score",
            systemImageName: "sportscourt"
        )
        AppShortcut(
            intent: GetNextGameIntent(),
            phrases: [
                "When is the next game in \(.applicationName)",
                "\(.applicationName) next game",
                "When do the \(\.$team) play next in \(.applicationName)",
            ],
            shortTitle: "Next Game",
            systemImageName: "calendar"
        )
        AppShortcut(
            intent: GetRecordIntent(),
            phrases: [
                "What's our record in \(.applicationName)",
                "\(.applicationName) standings",
                "What's the \(\.$team) record in \(.applicationName)",
            ],
            shortTitle: "Record",
            systemImageName: "list.number"
        )
        AppShortcut(
            intent: GetPlayoffChancesIntent(),
            phrases: [
                "What are our playoff chances in \(.applicationName)",
                "\(.applicationName) playoff chances",
                "What are the \(\.$team) playoff chances in \(.applicationName)",
            ],
            shortTitle: "Playoff Chances",
            systemImageName: "chart.line.uptrend.xyaxis"
        )
    }
}
