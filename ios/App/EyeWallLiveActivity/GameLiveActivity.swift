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
        gameActivityConfiguration().smallFamilyWhereAvailable()
    }
}

extension WidgetConfiguration {
    // iOS 18+: also the small layout, which iOS 26 shows in CarPlay and
    // Apple Watch's Smart Stack. Without it CarPlay falls back to the
    // Dynamic Island's compact views -- just the abbreviations and the
    // score. (WidgetBundleBuilder can't branch on #available; an opaque
    // return can, SE-0360.)
    func smallFamilyWhereAvailable() -> some WidgetConfiguration {
        if #available(iOS 18.0, *) {
            return supplementalActivityFamilies([.small])
        } else {
            return self
        }
    }
}

private func gameActivityConfiguration() -> some WidgetConfiguration {
    ActivityConfiguration(for: GameActivityAttributes.self) { context in
        Group {
            if #available(iOS 18.0, *) {
                FamilyView(attrs: context.attributes, state: context.state)
            } else {
                LockScreenView(attrs: context.attributes, state: context.state)
            }
        }
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

// The Lock Screen, or the small layout where iOS asks for it.
@available(iOS 18.0, *)
private struct FamilyView: View {
    @Environment(\.activityFamily) private var family
    let attrs: GameActivityAttributes
    let state: GameActivityAttributes.ContentState

    var body: some View {
        if family == .small {
            SmallView(attrs: attrs, state: state)
        } else {
            LockScreenView(attrs: attrs, state: state)
        }
    }
}

// CarPlay / Smart Stack: glanceable, three short lines -- the score, where
// the game is, and the power play or shots.
private struct SmallView: View {
    let attrs: GameActivityAttributes
    let state: GameActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 6) {
                side(attrs.awayAbbr, attrs.awayColor, state.awayScore)
                Text("–").foregroundStyle(muted)
                side(attrs.homeAbbr, attrs.homeColor, state.homeScore)
            }
            .font(.system(.headline, design: .rounded).weight(.heavy))
            .monospacedDigit()
            HStack(spacing: 6) {
                Text(statusText).font(.caption.weight(.bold)).foregroundStyle(.white)
                if let strength = state.strength {
                    Text(strength).font(.caption2.weight(.bold)).foregroundStyle(live)
                }
            }
            .lineLimit(1)
            if let away = state.awaySog, let home = state.homeSog {
                Text("SOG \(away)–\(home)").font(.caption2.monospacedDigit()).foregroundStyle(muted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
    }

    private func side(_ abbr: String, _ color: String, _ score: Int) -> some View {
        HStack(spacing: 4) {
            Text(abbr).foregroundStyle(Color(hex: color))
            Text("\(score)").foregroundStyle(.white)
        }
    }

    private var statusText: String {
        if state.status == "final" {
            return state.periodLabel == "OT" || state.periodLabel == "SO" ? "FINAL/\(state.periodLabel)" : "FINAL"
        }
        if state.inIntermission { return "\(state.periodLabel) INT" }
        return state.clock.isEmpty ? state.periodLabel : "\(state.periodLabel) · \(state.clock)"
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
