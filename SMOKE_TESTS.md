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
- [ ] Shot dots appear on the rink
- [ ] MetCards update between polls

## Notifications
- [ ] Bell icon visible in Topbar
- [ ] Tapping bell shows opt-in prompt
