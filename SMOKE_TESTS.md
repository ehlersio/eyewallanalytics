# EyeWall Analytics — Smoke Test Checklist

Run through this before merging `dev` → `main`.

## Setup
- [ ] App loads at preview URL without console errors
- [ ] Bottom nav shows all 5 tabs: Shot Map, Schedule, Players, Team, News
- [ ] No `500` errors in Network tab

## Shot Map
- [ ] Score bar renders (shows "No game in progress" or live score)
- [ ] Ice rink SVG draws correctly (blue lines, red goal lines, face-off circles)
- [ ] MetCards show: Shots, Hits, Blocks, Faceoff%, PP%
- [ ] MetCard layout: 3 on top row, 2 on bottom row on mobile
- [ ] Top button appears after scrolling

## Schedule
- [ ] Regular season tab shows game cards
- [ ] Playoffs tab shows collapsible rounds
- [ ] Tapping an upcoming game shows Matchup Detail
- [ ] Matchup Detail shows: win probability bar, predicted score, EyeWall AI section
- [ ] Prediction tooltip (ⓘ) opens on tap
- [ ] Completed game popup shows score, period breakdown

## Team
- [ ] Overview tab loads without crash (no `corsiReg is not defined`)
- [ ] Advanced tab loads without crash (no `stats is not defined`)
- [ ] Cap tab shows salary bar and contract table

## Players
- [ ] Roster list renders
- [ ] Tapping a player shows their popup

## News
- [ ] News page loads and shows articles
- [ ] Source filter chips appear and filter correctly
- [ ] Pagination shows when >10 articles
- [ ] Tapping an article opens it in a new tab
- [ ] Canes Country articles have clean titles (no HTML tags)
- [ ] Google News articles show outlet name in badge

## Live Game (when a game is in progress)
- [ ] Topbar shows live score
- [ ] Countdown clock ticks in real time
- [ ] Topbar and Shot Map clocks are in sync
- [ ] Topbar shows period (e.g. P2)
- [ ] "EyeWall Analytics" text hides in topbar during live game (logo only)
- [ ] Momentum bar appears in topbar below score row
- [ ] Shot dots appear on the rink
- [ ] MetCards update between polls
- [ ] Live Insights card collapses after ~8 seconds
- [ ] Tapping collapsed Live Insights card re-expands it
- [ ] Chevron rotates on expand/collapse

## Momentum Card
- [ ] Momentum card appears below Shot Attempts card
- [ ] Bar shows CAR vs OPP shot attempt share
- [ ] 5m / 10m / Full window buttons update the bar
- [ ] Waveform renders (no blur on retina screens)
- [ ] Period divider lines visible on waveform

## Players — Analytics Tab
- [ ] Skater analytics tab loads for a forward (shows WAR, 10 percentile bars)
- [ ] Power Play and Penalty Kill bars show a value (not N/A) for PP/PK players
- [ ] PP/PK bars show N/A for players with no special teams time
- [ ] Goalie analytics tab loads (shows GSAX, 6 percentile bars)
- [ ] GSAX headline shows correct sign (+/-)

## Players — Heat Map Tab
- [ ] Skater heat map renders shot dots
- [ ] Goalie heat map renders in dot map mode
- [ ] Goalie heat map zone SV% toggle works
- [ ] Zone colors visible against ice background
- [ ] Zone text (SV% + shot count) readable
- [ ] SV% displayed as decimal (e.g. 0.918 not 91.8%)

## Players — Contract Value
- [ ] Skater value badge shows "blended/$M" when WAR data available
- [ ] Skater value badge shows "pts/$M" fallback for players without WAR
- [ ] Goalie value badge shows "GSAX +X/$M" format
- [ ] ELC players show "ELC — value score N/A"
- [ ] Tooltip explains blended methodology

## Players — Stats Tab
- [ ] Regular Season / Playoffs toggle appears
- [ ] Switching to Playoffs shows playoff stats or "No playoff stats yet" message

## Shot Map — Goalies
- [ ] Goalie card shows GSAX (real value) for CAR goalies
- [ ] GSAX tooltip mentions "regular season" and GP count
- [ ] Opposing goalie falls back to estimated GSAx

## Blocks Drill-Down
- [ ] Tapping Blocks MetCard shows drill-down
- [ ] CAR table contains only CAR players (no OPP players in list)

## Dev Replay (/dev — local only)
- [ ] `/dev` route loads without error
- [ ] Recent CAR games appear as quick-pick buttons
- [ ] Loading a game ID populates the scrubber
- [ ] Scrubbing updates score in topbar
- [ ] Play button advances the game
- [ ] Period markers (P2, P3) appear below scrubber and are clickable
- [ ] Topbar shows period and clock
- [ ] Win popup fires when scrubbing to end of a CAR win
- [ ] Clock shows correctly (no phantom OT after regulation games)
- [ ] `/dev` route returns 404 or blank on production

## Notifications
- [ ] Bell icon visible in Topbar
- [ ] Tapping bell shows opt-in prompt
