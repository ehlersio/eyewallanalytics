//
//  EyeWallIntents.swift
//  App
//
//  Siri and Shortcuts: the score, goals, next game, record and playoff chances of
//  any team in the app, the primary followed team when none is named.
//  Answers come from IntentAnswers.swift; the phrases Siri listens for are
//  in EyeWallShortcuts below (French in fr.lproj/AppShortcuts.strings).
//
//  Plain App Intents on the release SDK. Apple's Siri AI (developer preview
//  in iOS 27.3, App Store submissions from spring 2027) uses these same
//  intents as tools: SiriAIPreview.swift marks them, only in the SiriPreview
//  build configuration (SIRI_AI_PREVIEW). Siri picks a tool and fills its
//  team from the titles and descriptions here, so keep them accurate.
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

    // What Siri and Shortcuts can read about a team, to tell teams apart.
    // Property descriptions need the iOS 27.3 SDK, so only the SiriPreview
    // build (deployment target 27.3) has them.
    #if SIRI_AI_PREVIEW
    @Property(title: "Name", description: "The team's full name, such as Carolina Hurricanes.")
    var name: String
    @Property(title: "Short Name", description: "The short name fans use for the team, such as Canes.")
    var shortName: String
    @Property(title: "League", description: "The team's league: NHL, PWHL, AHL or ECHL.")
    var league: String
    #else
    @Property(title: "Name")
    var name: String
    @Property(title: "Short Name")
    var shortName: String
    @Property(title: "League")
    var league: String
    #endif

    init(_ team: IntentTeam) {
        id = team.id
        self.team = team
        name = team.name
        shortName = team.shortName
        league = team.leagueLabel
    }

    var displayRepresentation: DisplayRepresentation {
        #if SIRI_AI_PREVIEW
        // Siri AI picks teams by title, and short names repeat across leagues
        // (Bruins, Wild, Penguins...): it took "Providence Bruins" for Boston.
        // The full name as the title, the short name as a synonym.
        DisplayRepresentation(title: "\(team.name)", subtitle: "\(team.leagueLabel)", synonyms: ["\(team.shortName)"])
        #else
        DisplayRepresentation(title: "\(team.shortName)", subtitle: "\(team.leagueLabel) · \(team.name)")
        #endif
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

/// The preview build's teamName parameter. Siri AI picks a TeamEntity from
/// a list and only reads its start, so it answered "Iowa Wild" with the
/// user's AHL team; given the name as text, TeamCatalog.match finds the team.
/// nil in release builds, which have only the team parameter.
@available(iOS 16.0, *)
private protocol SpokenTeam {
    var spokenTeam: String? { get }
}

@available(iOS 16.0, *)
struct GetScoreIntent: AppIntent, SpokenTeam {
    static let title: LocalizedStringResource = "Get Score"
    static let description = IntentDescription("Today's score for a team, or its next game when it isn't playing today.")

    @Parameter(title: "Team", description: "The team to ask about, in any league EyeWall covers. Leave it empty for the user's primary team.")
    var team: TeamEntity?

    #if SIRI_AI_PREVIEW
    @Parameter(title: "Team Name", description: "The team's name exactly as the user said it, such as Iowa Wild, Habs or Toronto Sceptres. Leave it empty for the user's primary team.")
    var teamName: String?
    #endif

    static var parameterSummary: some ParameterSummary { Summary("Get the score for \(\.$team)") }

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let text = try await IntentAnswers.score(IntentContext.resolve(team?.id, name: spokenTeam))
        return .result(value: text, dialog: IntentDialog(stringLiteral: text))
    }
}

@available(iOS 16.0, *)
struct GetNextGameIntent: AppIntent, SpokenTeam {
    static let title: LocalizedStringResource = "Get Next Game"
    static let description = IntentDescription("When a team plays next, and who against.")

    @Parameter(title: "Team", description: "The team to ask about, in any league EyeWall covers. Leave it empty for the user's primary team.")
    var team: TeamEntity?

    #if SIRI_AI_PREVIEW
    @Parameter(title: "Team Name", description: "The team's name exactly as the user said it, such as Iowa Wild, Habs or Toronto Sceptres. Leave it empty for the user's primary team.")
    var teamName: String?
    #endif

    static var parameterSummary: some ParameterSummary { Summary("Get the next game for \(\.$team)") }

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let text = try await IntentAnswers.nextGame(IntentContext.resolve(team?.id, name: spokenTeam))
        return .result(value: text, dialog: IntentDialog(stringLiteral: text))
    }
}

@available(iOS 16.0, *)
struct GetRecordIntent: AppIntent, SpokenTeam {
    static let title: LocalizedStringResource = "Get Team Record"
    static let description = IntentDescription("A team's record and points this season, and its place in the division for NHL teams.")

    @Parameter(title: "Team", description: "The team to ask about, in any league EyeWall covers. Leave it empty for the user's primary team.")
    var team: TeamEntity?

    #if SIRI_AI_PREVIEW
    @Parameter(title: "Team Name", description: "The team's name exactly as the user said it, such as Iowa Wild, Habs or Toronto Sceptres. Leave it empty for the user's primary team.")
    var teamName: String?
    #endif

    static var parameterSummary: some ParameterSummary { Summary("Get the record for \(\.$team)") }

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let text = try await IntentAnswers.record(IntentContext.resolve(team?.id, name: spokenTeam))
        return .result(value: text, dialog: IntentDialog(stringLiteral: text))
    }
}

@available(iOS 16.0, *)
struct GetPlayoffChancesIntent: AppIntent, SpokenTeam {
    static let title: LocalizedStringResource = "Get Playoff Chances"
    static let description = IntentDescription("How often a team makes the playoffs in EyeWall's 10,000 simulations of the season, and its projected points.")

    @Parameter(title: "Team", description: "The team to ask about, in any league EyeWall covers. Leave it empty for the user's primary team.")
    var team: TeamEntity?

    #if SIRI_AI_PREVIEW
    @Parameter(title: "Team Name", description: "The team's name exactly as the user said it, such as Iowa Wild, Habs or Toronto Sceptres. Leave it empty for the user's primary team.")
    var teamName: String?
    #endif

    static var parameterSummary: some ParameterSummary { Summary("Get the playoff chances for \(\.$team)") }

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let text = try await IntentAnswers.playoffChances(IntentContext.resolve(team?.id, name: spokenTeam))
        return .result(value: text, dialog: IntentDialog(stringLiteral: text))
    }
}

@available(iOS 16.0, *)
struct GetGoalsIntent: AppIntent, SpokenTeam {
    static let title: LocalizedStringResource = "Get Goals"
    static let description = IntentDescription("Who scored in a team's game today, or in its last game: the latest goal with its assists, then every scorer.")

    @Parameter(title: "Team", description: "The team to ask about, in any league EyeWall covers. Leave it empty for the user's primary team.")
    var team: TeamEntity?

    #if SIRI_AI_PREVIEW
    @Parameter(title: "Team Name", description: "The team's name exactly as the user said it, such as Iowa Wild, Habs or Toronto Sceptres. Leave it empty for the user's primary team.")
    var teamName: String?
    #endif

    static var parameterSummary: some ParameterSummary { Summary("Get the goals for \(\.$team)") }

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let text = try await IntentAnswers.goals(IntentContext.resolve(team?.id, name: spokenTeam))
        return .result(value: text, dialog: IntentDialog(stringLiteral: text))
    }
}

@available(iOS 16.0, *)
struct GetRecapIntent: AppIntent, SpokenTeam {
    static let title: LocalizedStringResource = "Get Game Recap"
    static let description = IntentDescription("How a team's last game went: the EyeWall AI recap of it, or the final score and scorers when there's no recap.")

    @Parameter(title: "Team", description: "The team to ask about, in any league EyeWall covers. Leave it empty for the user's primary team.")
    var team: TeamEntity?

    #if SIRI_AI_PREVIEW
    @Parameter(title: "Team Name", description: "The team's name exactly as the user said it, such as Iowa Wild, Habs or Toronto Sceptres. Leave it empty for the user's primary team.")
    var teamName: String?
    #endif

    static var parameterSummary: some ParameterSummary { Summary("Get the game recap for \(\.$team)") }

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let text = try await IntentAnswers.recap(IntentContext.resolve(team?.id, name: spokenTeam))
        return .result(value: text, dialog: IntentDialog(stringLiteral: text))
    }
}

@available(iOS 16.0, *)
struct GetPowerRankingIntent: AppIntent, SpokenTeam {
    static let title: LocalizedStringResource = "Get Power Ranking"
    static let description = IntentDescription("Where a team sits in EyeWall's power rankings, how it moved since the previous ranking, and the EyeWall AI write-up.")

    @Parameter(title: "Team", description: "The team to ask about, in any league EyeWall covers. Leave it empty for the user's primary team.")
    var team: TeamEntity?

    #if SIRI_AI_PREVIEW
    @Parameter(title: "Team Name", description: "The team's name exactly as the user said it, such as Iowa Wild, Habs or Toronto Sceptres. Leave it empty for the user's primary team.")
    var teamName: String?
    #endif

    static var parameterSummary: some ParameterSummary { Summary("Get the power ranking for \(\.$team)") }

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let text = try await IntentAnswers.powerRanking(IntentContext.resolve(team?.id, name: spokenTeam))
        return .result(value: text, dialog: IntentDialog(stringLiteral: text))
    }
}

@available(iOS 16.0, *)
extension SpokenTeam {
    fileprivate var spokenTeam: String? { nil }
}

#if SIRI_AI_PREVIEW
extension GetScoreIntent { fileprivate var spokenTeam: String? { teamName } }
extension GetNextGameIntent { fileprivate var spokenTeam: String? { teamName } }
extension GetRecordIntent { fileprivate var spokenTeam: String? { teamName } }
extension GetPlayoffChancesIntent { fileprivate var spokenTeam: String? { teamName } }
extension GetGoalsIntent { fileprivate var spokenTeam: String? { teamName } }
extension GetRecapIntent { fileprivate var spokenTeam: String? { teamName } }
extension GetPowerRankingIntent { fileprivate var spokenTeam: String? { teamName } }
#endif

// MARK: - Siri phrases

// Every phrase has to name the app; "EyeWall" and "Eye Wall" work as well
// as the full name (INAlternativeAppNames in Info.plist). The two-word
// spelling is there because Siri sometimes hears the one-word name as "Iowa".
@available(iOS 17.0, *)
struct EyeWallShortcuts: AppShortcutsProvider {
    #if SIRI_AI_PREVIEW
    // No phrases naming a team: App Shortcuts match those against the
    // followed teams only, so "What are the Iowa Wild's playoff chances"
    // ran with the user's AHL team before Siri AI saw the request (the
    // skill never loaded). Without them Siri AI resolves the team itself,
    // through Spotlight (TeamIndex).
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: GetScoreIntent(),
            phrases: [
                "What's the score in \(.applicationName)",
                "\(.applicationName) score",
            ],
            shortTitle: "Score",
            systemImageName: "sportscourt"
        )
        AppShortcut(
            intent: GetGoalsIntent(),
            phrases: [
                "Who scored in \(.applicationName)",
                "\(.applicationName) goals",
            ],
            shortTitle: "Goals",
            systemImageName: "hockey.puck"
        )
        AppShortcut(
            intent: GetNextGameIntent(),
            phrases: [
                "When is the next game in \(.applicationName)",
                "\(.applicationName) next game",
            ],
            shortTitle: "Next Game",
            systemImageName: "calendar"
        )
        AppShortcut(
            intent: GetRecordIntent(),
            phrases: [
                "What's our record in \(.applicationName)",
                "\(.applicationName) standings",
            ],
            shortTitle: "Record",
            systemImageName: "list.number"
        )
        AppShortcut(
            intent: GetPlayoffChancesIntent(),
            phrases: [
                "What are our playoff chances in \(.applicationName)",
                "\(.applicationName) playoff chances",
            ],
            shortTitle: "Playoff Chances",
            systemImageName: "chart.line.uptrend.xyaxis"
        )
        AppShortcut(
            intent: GetRecapIntent(),
            phrases: [
                "How did we play in \(.applicationName)",
                "\(.applicationName) game recap",
            ],
            shortTitle: "Game Recap",
            systemImageName: "text.quote"
        )
        AppShortcut(
            intent: GetPowerRankingIntent(),
            phrases: [
                "Where are we in the \(.applicationName) power rankings",
                "\(.applicationName) power rankings",
            ],
            shortTitle: "Power Ranking",
            systemImageName: "trophy"
        )
    }
    #else
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
            intent: GetGoalsIntent(),
            phrases: [
                "Who scored in \(.applicationName)",
                "\(.applicationName) goals",
                "Who scored for the \(\.$team) in \(.applicationName)",
            ],
            shortTitle: "Goals",
            systemImageName: "hockey.puck"
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
        AppShortcut(
            intent: GetRecapIntent(),
            phrases: [
                "How did we play in \(.applicationName)",
                "\(.applicationName) game recap",
                "How did the \(\.$team) play in \(.applicationName)",
            ],
            shortTitle: "Game Recap",
            systemImageName: "text.quote"
        )
        AppShortcut(
            intent: GetPowerRankingIntent(),
            phrases: [
                "Where are we in the \(.applicationName) power rankings",
                "\(.applicationName) power rankings",
                "Where are the \(\.$team) in the \(.applicationName) power rankings",
            ],
            shortTitle: "Power Ranking",
            systemImageName: "trophy"
        )
    }
    #endif
}
