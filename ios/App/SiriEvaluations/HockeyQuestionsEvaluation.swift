//
//  HockeyQuestionsEvaluation.swift
//  EyeWallSiriEvaluations
//
//  Scripted Siri requests against the Siri AI developer preview: which
//  EyeWall tool Siri calls, with which team, and whether it loads the
//  hockey-questions skill. Prints each transcript (tool, arguments, outcome,
//  what Siri said) so a run doubles as a report.
//
//  A UI test target (SiriService refuses to run anywhere else:
//  .notRunningInUITestTarget). Device only: SiriEvaluations has no Simulator
//  slice, and Siri AI needs an Apple Intelligence device on iOS 27.3. Run
//  with the "App Siri Preview" scheme (its Test action builds the
//  SiriPreview app, where the intents are tools):
//    DEVELOPER_DIR=<Xcode-beta>/Contents/Developer xcodebuild test \
//      -project ios/App/App.xcodeproj -scheme "App Siri Preview" \
//      -destination 'id=<device UDID>' -allowProvisioningUpdates
//  Open EyeWall once on the device first, so the intents know the followed
//  teams. Answers depend on live data and on Siri, so a failure is a prompt
//  to read the transcript, not proof of a bug.
//

#if canImport(SiriEvaluations)
import Testing
import SiriEvaluations

private let app = IntentDefinitions(bundleIdentifier: "com.eyewallanalytics.app")
private let team = app.entities["TeamEntity"]  // spotlightFindsTeam
private let skill = app.skills["hockey-questions"]
private let score = app.intents["GetScoreIntent"]
private let nextGame = app.intents["GetNextGameIntent"]
private let record = app.intents["GetRecordIntent"]
private let playoffChances = app.intents["GetPlayoffChancesIntent"]
private let goals = app.intents["GetGoalsIntent"]

struct SiriCase: Sendable, CustomTestStringConvertible {
    let name: String
    let scenario: SiriScenario
    var testDescription: String { name }
}

@Suite(.serialized)
struct HockeyQuestionsEvaluation {
    static let cases: [SiriCase] = [
        // The primary team, no team named.
        SiriCase(name: "score, my team", scenario: SiriScenario {
            UserTurn("What's the score in EyeWall") {
                Calls { score }
                Loads(.preferred) { skill }
            }
        }),
        SiriCase(name: "next game, nickname", scenario: SiriScenario {
            UserTurn("When do the Canes play next in EyeWall") {
                Calls { nextGame }
                SiriResponse(.contains("Canes"))
            }
        }),
        // Who scored: today's game or the last one. Every answer that found a
        // game names a goal or says there are none.
        SiriCase(name: "who scored, my team", scenario: SiriScenario {
            UserTurn("Who scored in EyeWall") {
                Calls { goals }
                Loads(.preferred) { skill }
            }
        }),
        SiriCase(name: "who scored, Iowa Wild", scenario: SiriScenario {
            UserTurn("Who scored for the Iowa Wild in EyeWall") {
                Calls { goals }
                SiriResponse(.contains("Iowa Wild"))
            }
        }),
        // Named teams: the preview build's intents take the name as text
        // (teamName), matched by TeamCatalog.match. Shared short name: the
        // NHL team unless the user says otherwise.
        SiriCase(name: "record, Bruins means Boston", scenario: SiriScenario {
            UserTurn("What's the Bruins record in EyeWall") {
                Calls { record }
                SiriResponse(.contains("Boston Bruins"))
            }
        }),
        SiriCase(name: "record, Providence Bruins", scenario: SiriScenario {
            UserTurn("What's the Providence Bruins record in EyeWall") {
                Calls { record }
                SiriResponse(.contains("Providence Bruins"))
            }
        }),
        // AHL: the playoff format isn't published, so projected points only.
        SiriCase(name: "playoff chances, Iowa Wild", scenario: SiriScenario {
            UserTurn("What are the Iowa Wild's playoff chances in EyeWall") {
                Calls { playoffChances }
                SiriResponse(.contains("Iowa Wild"))
            }
        }),
        // PWHL, a city with three teams.
        SiriCase(name: "score, Toronto Sceptres", scenario: SiriScenario {
            UserTurn("How are the Toronto Sceptres doing in EyeWall") {
                Calls { score }
                SiriResponse(.contains("Sceptres"))
            }
        }),
        // A nickname that isn't in the team data.
        SiriCase(name: "record, Habs", scenario: SiriScenario {
            UserTurn("What's the Habs record in EyeWall") {
                Calls { record }
                SiriResponse(.contains("Canadiens"))
            }
        }),
        // A follow-up that refers back to the first answer.
        SiriCase(name: "follow-up, they", scenario: SiriScenario {
            UserTurn("What's the Hurricanes score in EyeWall") {
                Calls { score }
                SiriResponse(.contains("Canes"))
            }
            // No Calls check: Siri may answer from the first turn's tool
            // result (the score tool also gives the next game), which is
            // EyeWall's data, or call the next game tool again.
            UserTurn("And when do they play next?")
        }),
        // Two answers in one request.
        SiriCase(name: "two tools, record and chances", scenario: SiriScenario {
            UserTurn("What's the Canes record and their playoff chances in EyeWall") {
                Calls(.unordered) { record; playoffChances }
            }
        }),
        // Outside EyeWall's leagues: Siri declines, or the tool says it
        // doesn't know the team. Either way it lists the four leagues and
        // never answers for the primary team.
        SiriCase(name: "college hockey, declined", scenario: SiriScenario {
            UserTurn("What's the score of the Michigan Wolverines hockey game in EyeWall") {
                SiriResponse(.contains("ECHL"))
            }
        }),
    ]

    /// Siri finds teams the user doesn't follow through Spotlight
    /// (TeamIndex in SiriAIPreview.swift, indexed when the app opens).
    @Test(arguments: [("Iowa Wild", "ahl:IA"), ("Providence Bruins", "ahl:PRO"), ("Toronto Sceptres", "pwhl:TOR")])
    func spotlightFindsTeam(_ query: String, _ id: String) async throws {
        let found = try await team.spotlightQuery(query).map { "\($0.identifier)" }
        print("spotlight \(query): \(found)")
        #expect(found.contains { $0.contains(id) }, "Spotlight didn't return \(id) for \"\(query)\"")
    }

    @Test(arguments: cases)
    func siriAnswers(_ siriCase: SiriCase) async throws {
        let subject = try await SiriService.run(scenario: siriCase.scenario)
        print(report(siriCase.name, subject.siriTranscript))
        let metrics = try await SiriExpectationEvaluator().metrics(subject: subject, input: siriCase.scenario)
        for metric in metrics {
            print("  metric: \(metric)")
            if metric.value == .failing {
                Issue.record("\(siriCase.name): \(metric.name) failed. \(metric.rationale ?? "")")
            }
        }
    }

    private func report(_ name: String, _ transcript: SiriTranscript) -> String {
        var lines = ["=== \(name)"]
        for (index, turn) in transcript.turns.enumerated() {
            lines.append("  turn \(index + 1)")
            for skill in turn.loadedSkills { lines.append("    loads skill: \(skill.value.skillName)") }
            for entity in turn.foundEntities { lines.append("    finds: \(entity.value.identifier)") }
            for call in turn.intentInvocations {
                lines.append("    calls: \(call.value.intent.identifier) \(call.value.arguments) -> \(call.value.outcome)")
            }
            lines.append("    says: \(turn.response.value)")
        }
        return lines.joined(separator: "\n")
    }
}
#endif
