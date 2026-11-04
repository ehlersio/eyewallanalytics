//
//  SiriAIPreview.swift
//  App
//
//  Apple's Siri AI developer preview (iOS 27.3 beta): makes the four
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

@available(iOS 27.3, *)
extension GetScoreIntent: ToolIntent {}

@available(iOS 27.3, *)
extension GetNextGameIntent: ToolIntent {}

@available(iOS 27.3, *)
extension GetRecordIntent: ToolIntent {}

@available(iOS 27.3, *)
extension GetPlayoffChancesIntent: ToolIntent {}

/// Siri finds entities through Spotlight or, failing that, an enumerable
/// query. All 106 teams, followed ones first. Only here: in Shortcuts on the
/// release SDK this would list every team as a suggestion.
@available(iOS 27.3, *)
extension TeamQuery: EnumerableEntityQuery {
    func allEntities() async throws -> [TeamEntity] {
        try await entities(matching: "")
    }
}
#endif
