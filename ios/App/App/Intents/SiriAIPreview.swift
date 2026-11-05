//
//  SiriAIPreview.swift
//  App
//
//  Apple's Siri AI developer preview (iOS 27.3 beta): makes the five
//  EyeWall intents tools Siri can call, and lets Siri list every team.
//
//  Compiled only in the SiriPreview build configuration (the "App Siri
//  Preview" scheme, built with Xcode 27.3 beta), which sets SIRI_AI_PREVIEW.
//  Debug and Release never see this file's contents, so App Store builds from
//  Xcode 27.0 are unchanged. The preview runs only in development builds and
//  internal TestFlight until Apple opens App Store submissions (spring 2027).
//
//  The SiriPreview configuration's deployment target is iOS 27.3 (the
//  preview runs nowhere older). Conformance to ToolIntent is what
//  @AppIntent(.tool) adds; declared here instead so the intents themselves
//  stay buildable on the release SDK. TeamEntity's property descriptions are
//  behind the same flag in EyeWallIntents.swift.
//  The skill Siri reads alongside these tools is in
//  Intents/Skills.skillsbundle/Skills/hockey-questions/SKILL.md.
//

#if SIRI_AI_PREVIEW
import AppIntents
import CoreSpotlight

@available(iOS 27.3, *)
extension GetScoreIntent: ToolIntent {}

@available(iOS 27.3, *)
extension GetNextGameIntent: ToolIntent {}

@available(iOS 27.3, *)
extension GetRecordIntent: ToolIntent {}

@available(iOS 27.3, *)
extension GetPlayoffChancesIntent: ToolIntent {}

@available(iOS 27.3, *)
extension GetGoalsIntent: ToolIntent {}

@available(iOS 27.3, *)
extension GetRecapIntent: ToolIntent {}

@available(iOS 27.3, *)
extension GetPowerRankingIntent: ToolIntent {}

// No EnumerableEntityQuery: given all 106 teams, Siri picked from the start
// of the list (followed teams, then the NHL) and answered "Iowa Wild" with
// the user's AHL team. With Spotlight (below) it searches for the team.

// MARK: - Spotlight

/// Every team in Spotlight, so Siri can find one the user doesn't follow.
/// Without it Siri only saw the followed teams (suggestedEntities) and
/// answered "Iowa Wild" with the user's AHL team, or with no EyeWall data
/// at all. The title comes from displayRepresentation (the full name).
@available(iOS 27.3, *)
extension TeamEntity: IndexedEntity {
    var attributeSet: CSSearchableItemAttributeSet {
        let attributes = CSSearchableItemAttributeSet()
        attributes.keywords = TeamIndex.keywords(team)
        attributes.contentDescription = "\(team.leagueLabel) hockey team"
        return attributes
    }
}

@available(iOS 27.3, *)
extension TeamQuery: IndexedEntityQuery {
    func reindexEntities(for identifiers: [TeamEntity.ID], indexDescription: CSSearchableIndexDescription) async throws {
        try await TeamIndex.index.indexAppEntities(identifiers.compactMap { TeamCatalog.byId[$0] }.map(TeamEntity.init))
    }

    func reindexAllEntities(indexDescription: CSSearchableIndexDescription) async throws {
        try await TeamIndex.indexAll()
    }
}

@available(iOS 27.3, *)
enum TeamIndex {
    static let index = CSSearchableIndex(name: "EyeWall_Teams")

    /// Called from AppIntentsPlugin.setContext on every launch. Re-indexing
    /// an identifier updates its entry; the team list only changes with an
    /// app update.
    static func indexAll() async throws {
        try await index.indexAppEntities(TeamCatalog.all.map(TeamEntity.init))
    }

    /// The short name, city, abbreviation and league in both languages:
    /// "Iowa Wild" -> Wild, Iowa, IA, AHL, LAH.
    static func keywords(_ team: IntentTeam) -> [String] {
        var words = [team.shortName, team.abbr, team.leagueLabel] + TeamCatalog.soundAlikes(of: team)
        if team.name.hasSuffix(team.shortName) {
            let city = team.name.dropLast(team.shortName.count).trimmingCharacters(in: .whitespaces)
            if !city.isEmpty { words.append(city) }
        }
        switch team.league {
        case "nhl": words.append("LNH")
        case "pwhl": words.append("LPHF")
        case "ahl": words.append("LAH")
        default: break
        }
        return words
    }
}

/// Opens EyeWall from a team's Spotlight result.
@available(iOS 27.3, *)
struct OpenTeamIntent: OpenIntent {
    static let title: LocalizedStringResource = "Open Team"

    @Parameter(title: "Team")
    var target: TeamEntity

    func perform() async throws -> some IntentResult { .result() }
}
#endif
