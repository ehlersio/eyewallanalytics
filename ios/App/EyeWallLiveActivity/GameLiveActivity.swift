//
//  GameLiveActivity.swift
//  EyeWallLiveActivity
//
//  Lock screen + Dynamic Island for a followed NHL game. Started from the
//  Shot Map ("Follow on Lock Screen"), updated by eyewall-poller over APNs
//  (goals/penalties/periods right away, the clock about once a minute),
//  ended by the poller at the final.
//

import ActivityKit
import SwiftUI
import WidgetKit

private let background = Color(hex: "#080c14")
private let muted = Color(hex: "#8a99aa")
private let live = Color(hex: "#ff4422")

struct GameLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: GameActivityAttributes.self) { context in
            LockScreenView(attrs: context.attributes, state: context.state)
                .activityBackgroundTint(background)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            let a = context.attributes, s = context.state
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    TeamScore(abbr: a.awayAbbr, color: a.awayColor, score: s.awayScore, followed: a.followAbbr == a.awayAbbr)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    TeamScore(abbr: a.homeAbbr, color: a.homeColor, score: s.homeScore, followed: a.followAbbr == a.homeAbbr)
                }
                DynamicIslandExpandedRegion(.center) {
                    GameStatus(state: s)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if let event = s.lastEvent {
                        Text(event).font(.caption).foregroundStyle(muted).lineLimit(1)
                    }
                }
            } compactLeading: {
                Text("\(a.awayAbbr) \(s.awayScore)").font(.caption.weight(.bold)).foregroundStyle(Color(hex: a.awayColor))
            } compactTrailing: {
                Text("\(s.homeScore) \(a.homeAbbr)").font(.caption.weight(.bold)).foregroundStyle(Color(hex: a.homeColor))
            } minimal: {
                Text("\(s.awayScore)–\(s.homeScore)").font(.caption2.weight(.bold))
            }
            .keylineTint(live)
        }
    }
}

private struct LockScreenView: View {
    let attrs: GameActivityAttributes
    let state: GameActivityAttributes.ContentState

    var body: some View {
        VStack(spacing: 10) {
            HStack {
                TeamScore(abbr: attrs.awayAbbr, color: attrs.awayColor, score: state.awayScore,
                          followed: attrs.followAbbr == attrs.awayAbbr, dim: state.status == "final" && state.awayScore < state.homeScore)
                Spacer()
                GameStatus(state: state)
                Spacer()
                TeamScore(abbr: attrs.homeAbbr, color: attrs.homeColor, score: state.homeScore,
                          followed: attrs.followAbbr == attrs.homeAbbr, dim: state.status == "final" && state.homeScore < state.awayScore,
                          trailing: true)
            }
            if state.lastEvent != nil || state.strength != nil {
                HStack(spacing: 8) {
                    if let strength = state.strength {
                        Text(strength)
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(live.opacity(0.2), in: Capsule())
                            .foregroundStyle(live)
                    }
                    if let event = state.lastEvent {
                        Text(event).font(.caption).foregroundStyle(muted).lineLimit(1)
                    }
                    Spacer(minLength: 0)
                }
            }
        }
        .padding(16)
    }
}

private struct TeamScore: View {
    let abbr: String
    let color: String
    let score: Int
    var followed = false
    var dim = false
    var trailing = false

    var body: some View {
        HStack(spacing: 8) {
            if trailing { scoreText }
            VStack(spacing: 2) {
                Text(abbr)
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(Color(hex: color))
                if followed {
                    Capsule().fill(Color(hex: color)).frame(width: 18, height: 3)
                }
            }
            if !trailing { scoreText }
        }
        .opacity(dim ? 0.55 : 1)
    }

    private var scoreText: some View {
        Text("\(score)")
            .font(.system(size: 34, weight: .heavy, design: .rounded))
            .foregroundStyle(.white)
            .monospacedDigit()
    }
}

private struct GameStatus: View {
    let state: GameActivityAttributes.ContentState

    var body: some View {
        VStack(spacing: 2) {
            if state.status == "final" {
                Text(state.periodLabel == "OT" || state.periodLabel == "SO" ? "FINAL/\(state.periodLabel)" : "FINAL")
                    .font(.subheadline.weight(.heavy)).foregroundStyle(.white)
            } else if state.inIntermission {
                Text("\(state.periodLabel) INT").font(.subheadline.weight(.heavy)).foregroundStyle(.white)
            } else {
                Text(state.periodLabel).font(.subheadline.weight(.heavy)).foregroundStyle(.white)
                Text(state.clock).font(.caption.monospacedDigit()).foregroundStyle(muted)
            }
        }
    }
}

extension Color {
    init(hex: String) {
        var value: UInt64 = 0
        Scanner(string: hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))).scanHexInt64(&value)
        self.init(
            red: Double((value >> 16) & 0xff) / 255,
            green: Double((value >> 8) & 0xff) / 255,
            blue: Double(value & 0xff) / 255
        )
    }
}
