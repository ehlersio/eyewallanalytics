# EyeWall Analytics

> Advanced NHL + PWHL analytics — live shot maps, period summaries, momentum tracking, special teams analysis, push notifications, AI-generated game summaries, player heat maps, goalie analytics, WAR/percentile rankings, AI-powered league power rankings, live draft board, full PWHL analytics suite, hat trick detection with live popups + game summary badges, milestone tracking (hat tricks, shutouts, shorthanded goals, season/career thresholds) with a league-wide feed, xGF% per-game sparkline, per-team AI narratives, optional passwordless sign-in with cross-device favorite-team sync, and daily trivia (three difficulty tiers, guardrailed AI generation).

**Live at:** [eyewallanalytics.com](https://eyewallanalytics.com)  
**Contact:** matt@eyewallanalytics.com  
**Support the project:** [buymeacoffee.com/mattehlers](https://buymeacoffee.com/mattehlers)

---

## Overview

EyeWall Analytics is a React PWA delivering real-time and historical NHL and PWHL data from the public NHL API, MoneyPuck, HockeyTech, and PWHLPA. It combines live polling, a Cloudflare Worker caching layer, Web Push notifications, AI-generated period/game summaries and matchup analysis, player shot heat maps, MoneyPuck-powered WAR/percentile analytics, true RAPM via ridge regression, AI-powered nightly power rankings, a live draft board with Central Scouting rankings and AI pick analysis, and a full PWHL analytics suite into a mobile-first experience for hockey fans who want to go deeper than the box score.

Users select their league (NHL or PWHL) and team on first launch. All views, colors, and data scope to the selected team. The sport, team, and theme preference are persisted to `localStorage` and applied on every subsequent load.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite, react-router-dom v7 |
| Styling | Tailwind (`@tailwindcss/vite`) — single global entry point (`src/tailwind.css`), utilities layer only, no preflight, so it can't leak a reset into the app's own base styles. **Migration complete app-wide** — virtually every component renders via Tailwind utility classes, using arbitrary-value syntax throughout rather than named scale steps (the app's 14px root font-size and its own pre-existing `--radius`/`--radius-sm`/`--radius-lg` design tokens both collide with Tailwind's assumed-16px, rem-based named scales — see `tailwind.css`'s own comments for the compensation). A small amount of real, unlayered CSS remains by deliberate design, not as migration debt: `index.css` (design tokens, base resets, shared `@keyframes`, and a handful of classes — `.card`, `.popup-backdrop`, etc. — that must reliably win the cascade regardless of Tailwind's layer order); `light-mode-overrides.css` (the matching `[data-theme="light"]` overrides for those same classes); `PlayerComparisonPopup.css` (a few pieces that read better as real CSS than arbitrary-value utility strings) |
| Charts | D3 v7; SVG-based shot map/rink via the `react-hockey-rink` npm package (extracted from this app's own IceRink.jsx, published standalone); Recharts (radar charts — single-player header, Session 66/80; two-player overlay in Player vs Player Comparison, Session 91) |
| Player Search | Fuse.js — client-side fuzzy match against the Worker's flat NHL+PWHL player index (`GET /players-search-index`, ~1,600 players — small enough to ship once per session rather than query per keystroke) |
| Hosting | Cloudflare Pages (auto-deploys from `main`; `dev` branch → preview) |
| API Proxy | Cloudflare Pages Functions (`functions/`) |
| Cache Layer | Cloudflare Worker + KV (`eyewall-poller`) |
| Database | Supabase Pro (NHL + PWHL player/team/goalie stats, shot events, RAPM, game xG, power rankings, draft data, salaries, milestones) |
| Auth | Supabase Auth — passwordless magic-link sign-in (`@supabase/supabase-js`, Session 90). The one deliberate exception to "this app only reads from the Worker" — `signInWithOtp`/session handling is inherently a browser-to-Supabase-Auth flow, no Worker route to proxy it through. Email delivery via custom SMTP (Resend). |
| NHL Data Pipeline | Python (`eyewall-pipeline`) — NHL API + MoneyPuck + Tankathon → Supabase |
| PWHL Data Pipeline | Python (`eyewall-pipeline`) — HockeyTech + PWHLPA → Supabase |
| Pipeline CI | GitHub Actions — nightly data cron (3 AM ET) + AI pipeline + draft day ingest + PWHL news |
| Push Notifications | Web Push API (VAPID), Service Worker |
| AI | OpenRouter — `google/gemma-4-26b-a4b-it` (period/game summaries, predictions, matchup analysis, scouting blurbs, power rankings narratives, draft pick analysis). Switched 2026-08 from Cloudflare Workers AI (`@cf/meta/llama-3.1-8b-instruct-fp8-fast`) — see `eyewall-poller`'s README for the full reasoning (real accuracy problems found in the old model, and why OpenRouter rather than Cloudflare's own hosting of the same new Gemma model) |
| Analytics Data | MoneyPuck.com CSV (fetched nightly by pipeline) |
| PWHL Data | HockeyTech API (stats, PBP, schedules), PWHLPA PDF (salaries) |
| Draft Data | NHL Central Scouting API + NHL API (live picks) + Tankathon; PWHL static (2025, 2026) |
| User Analytics | PostHog (anonymous event tracking, cookieless) |
| Cap Data | Static `carContracts.js` (source: PuckPedia); PWHL salaries from PWHLPA PDF |
| Accessibility | WCAG 2.1 AA compliant (Section 508) |
| Testing | Vitest (unit tests), Cypress (E2E), GitHub Actions CI |

---

## Repository Structure

```
canes-analytics-starter/
├── index.html
├── public/
│   ├── sw.js                     # Service worker (Web Push handler)
│   ├── manifest.json             # PWA manifest
│   ├── goal-horn.mp3
│   ├── _headers                  # Cloudflare cache control headers
│   ├── eyewall-logo.svg/.png     # Bright-colors mark, thin black outline baked into the pixels (Session 100) so it holds up against non-dark-theme backgrounds too. Rendered directly (not via EyeWallLogo.jsx) by the fixed-dark share-canvas components (PeriodSummary.jsx, PredictionShareCanvas.jsx, PWHLPeriodSummary.jsx, PWHLPredictionShareCanvas.jsx, LeagueView.jsx's PowerRankingsCanvas, ScoutingTab.jsx) since their canvas bg is always dark regardless of app theme. .svg is a base64-PNG wrapper (not real vector paths) — this was an image-processing fix (Pillow: alpha-dilate + composite), not a code change
│   ├── eyewall-logo-light.svg/.png # Same mark + outline, with the low-saturation (white/gray) fills darkened (red accent untouched) for genuinely light backgrounds — og:image uses this (social link-preview cards are almost always white), and it's the [data-theme="light"] half of EyeWallLogo.jsx's toggle. Regenerate both -light and non--light files together from the same source if the art ever changes
│   └── favicon-*.png / .ico
├── functions/                    # Cloudflare Pages Functions (API proxy)
│   ├── nhl-api/[[path]].js
│   ├── nhl-stats/[[path]].js
│   ├── nhl-assets/[[path]].js
│   └── api/notification.js
├── src/
│   ├── App.jsx                   # Router, layout, sport context, theme init
│   ├── views/
│   │   ├── ShotMapView.jsx             # NHL live shot map — season/game history selector (Session 77) lets you browse past seasons/games; disabled+tooltip (not hidden) while a game is live, since a live game always wins the display. Tailwind (Phase 5, all 6 sub-PRs) — ShotMapView.css fully deleted. Live games only (Session 100): a `LiveEventRink` + relocated/widened `EventLog` ticker row renders between Live Insights and the metric cards — see `components/LiveEventRink.jsx`
│   │   ├── ScheduleView.jsx            # NHL schedule — Tailwind (Phase 6, all 5 sub-PRs) — ScheduleView.css fully deleted
│   │   ├── TeamView.jsx                # NHL 6-tab team analytics (Advanced tab: xGF% sparkline) — Tailwind (Phase 4, sub-PR 3), no .css file
│   │   ├── PlayersView.jsx/.css        # NHL players
│   │   ├── LeagueView.jsx              # NHL 5-tab league page — Tailwind (Phase 4, sub-PRs 1-4), no .css file
│   │   ├── NewsView.jsx                # NHL news feed + News/Milestones/Trivia tab toggle (Trivia added Session 92) — Tailwind (Phase 4, sub-PR 4), no .css file
│   │   ├── PWHLShotMapView.jsx         # PWHL shot map + PBP metrics — season/game history + Regular Season/Playoffs toggle (Session 77, new capability, not just NHL parity)
│   │   ├── PWHLScheduleView.jsx        # PWHL schedule + calendar + playoffs. Auto-records prediction outcomes for completed games via `recordPWHLOutcome()` (Session 100), mirroring NHL `ScheduleView.jsx`'s own effect
│   │   ├── PWHLTeamView.jsx            # PWHL 5-tab team analytics
│   │   ├── PWHLPlayersView.jsx         # PWHL roster + stats + player popup
│   │   ├── PWHLLeagueView.jsx          # PWHL 5-tab league page
│   │   ├── PWHLNewsView.jsx            # PWHL news feed + News/Milestones/Trivia/Transactions tab toggle
│   │   ├── AHLShotMapView.jsx          # AHL shot map — deliberately leaner than PWHLShotMapView.jsx: season-aggregate rink + PP/PK summary only, no per-game history browser, no Corsi/Fenwick/PDO (no `blocked_shot` event type exists in AHL's HockeyTech feed at all). Live-tracking layer (score chip, event popups, dev-only debug panel) added in AHL/PWHL parity Phase 6
│   │   ├── AHLScheduleView.jsx         # AHL schedule + calendar + game box/preview popups + predictions (parity Phase 3). No separate Regular Season/Playoffs tab — `AHL_SEASONS` lists "2026 Playoffs" as its own selectable season tab instead; no round-based bracket view (Calder Cup's up-to-4-round format was never ported/verified against PWHL's fixed-2-round bracket logic)
│   │   ├── AHLTeamView.jsx             # AHL 4-tab team analytics (Overview/Stats/Splits/Trends) — Advanced (Corsi/Fenwick/PDO) and Salaries tabs dropped, both real data walls not scope choices. "Compare Seasons" (parity Phase 4) opens `TeamComparisonPopup.jsx`'s `'ahl'` branch
│   │   ├── AHLPlayersView.jsx          # AHL roster (photo grid) + sortable stats table + player popup (parity Phase 2). Skater columns drop `shot_pct`/`gw_goals` — confirmed absent from AHL's HockeyTech feed entirely
│   │   ├── AHLLeagueView.jsx           # AHL standings, grouped by AHL's real Atlantic/North/Central/Pacific division structure (unlike PWHL's flat table) + Leaders tab — no Bracket or Power Rankings tabs (infrastructure never built for AHL)
│   │   ├── AHLNewsView.jsx             # AHL news feed, News tab only — no Milestones/Trivia/Transactions toggle; genuinely no pipeline data source for any of the three (not a missing branch in a generic component)
│   │   ├── ECHLShotMapView.jsx         # ECHL shot map — mirrors AHLShotMapView.jsx's exact shape (season-aggregate rink + PP/PK summary, same live-tracking layer added in ECHL's own Phase 6 equivalent)
│   │   ├── ECHLScheduleView.jsx        # ECHL schedule + calendar + game box/preview popups + predictions — port of AHLScheduleView.jsx, same Reg/Playoffs and bracket scope cuts
│   │   ├── ECHLTeamView.jsx            # ECHL 4-tab team analytics — mirrors AHLTeamView.jsx exactly, same Advanced/Salaries data walls
│   │   ├── ECHLPlayersView.jsx         # ECHL roster + stats + player popup — mirrors AHLPlayersView.jsx (same `shot_pct`/`gw_goals` column drop)
│   │   ├── ECHLLeagueView.jsx          # ECHL standings, grouped by ECHL's real North/South/Central/Mountain divisions (different alignment than AHL's) + Leaders — mirrors AHLLeagueView.jsx
│   │   ├── ECHLNewsView.jsx            # ECHL news feed, News tab only — mirrors AHLNewsView.jsx; only 2 real RSS sources exist for ECHL vs. AHL's 3 (echl.com itself has no RSS feed at all — Laravel/Livewire rebuild, same reason its HockeyTech key isn't network-tab-discoverable either)
│   │   ├── DevReplayView.jsx/.css      # Dev-only live game replay (/dev)
│   │   └── DevDraftView.jsx            # Dev-only draft simulator (/dev/draft)
│   ├── components/
│   │   ├── Topbar.jsx/.css             # Live score, countdown clock, sport switcher
│   │   ├── BottomNav.jsx               # Sport-aware bottom navigation
│   │   ├── TeamPicker.jsx              # Sport + team selection (NHL + PWHL); active/expansion PWHL split derives from comingSoon (fixed 2026-07 — used to be a 2nd hardcoded list, ignored comingSoon entirely)
│   │   ├── (season shot map rink)      # Was IceRink.jsx — extracted to the standalone `react-hockey-rink` npm package (github.com/ehlersio/react-hockey-rink) and deleted from this tree. App-side integration: `src/utils/hockeyRinkEvents.js` adapts this app's `isCanes`-boolean event shape to the package's `team: 'primary'|'opponent'` schema at each call site; `src/index.css` aliases the package's `--rink-*` CSS tokens onto this app's own theme-reactive tokens so light/dark mode and the live team color both still apply with zero drift. `RinkMarkings` + the `W`/`H`/`CX`/`CY` coordinate constants are named exports from the package — still the single source of truth for rink geometry, also consumed by LiveEventRink.jsx
│   │   ├── LiveEventRink.jsx           # Live-game-only compact rink (Session 100) — plots shots/hits/faceoffs/giveaways/takeaways as dots that fade over real elapsed time since first observed (not a hard count/window cutoff), goals pinned/no decay. Renders `react-hockey-rink`'s own exported `RinkMarkings` (not an approximation) so it's pixel-identical to the season shot map; only the coordinate-transform one-liner (`toSvg`) is a local copy, driven by the package's own exported W/H/CX/CY. Normalized via each play's own `homeTeamDefendingSide` so home's net is always on the left, stable across period parity. Dot fill = team color (who), dot stroke ring = event-type color matching EventLog's ticker badges exactly (what) — every dot gets a ring, not just goals. Intermission: tracked events clear and a Zamboni resurfacing animation runs for the whole break, overlaid with the same ordinal+countdown treatment the score bar already shows. The Zamboni is a real PixelLab-generated top-down raster sprite (8 directions × 9 drive-cycle frames each, `/zamboni/{dir}/frame-{n}.png`), replacing an earlier hand-built SVG version — a single `ZAMBONI_PATH` waypoint list (position + facing direction) drives both a lane-by-lane resurfacing sweep and a full perimeter lap so every generated direction actually gets screen time, interpolated + frame-cycled on one JS interval. NHL-only for now — PWHL's HockeyTech feed lacks penalty coordinates and has no giveaway/takeaway event type at all, scoped as a separate follow-up
│   │   ├── PWHLPlayerPopup.jsx         # PWHL player popup (Stats, Heat Map, Scout, Compare — season-over-season, up to 4 seasons, one fetch per season; Compare tab adds a per-game trend chart for chart-ready metrics (6/11 skater, 2/9 goalie — box-score-backed via /pwhl/player-game-log) alongside the existing tile rows, Session 70; header also renders a "vs Player" entry point, Session 91 — a separate affordance from the "🆚 Compare" tab, which means something different (own-season history, not another player)). Header renders a real Recharts radar for both skaters and goalies now (PWHLHeaderPanel/PWHLGoalieHeaderPanel, sharing one PWHLRadarChart component) — skaters' 4-axis PWHLHeaderPanel used to be a 2x2 percentile-tile grid instead (the "not radar-worthy" call didn't hold up once goalies shipped a real radar from the same category-count class, 2026-08); goalies' 6-axis PWHLGoalieHeaderPanel shipped alongside eyewall-pipeline's pwhl_goalie_percentiles.py, same richness as NHL's own goalie radar. Heat Map tab now covers goalies too (Session 100) — `PWHLGoalieHeatMap`, a zone-SV%/dot-map view matching NHL's own goalie heat map, fed by a new `/pwhl/goalie-shots` poller route against `pwhl_shot_events.goalie_id` (already populated, this was purely an unwired frontend gap — the Heat Map tab button itself was hidden for goalies via `!isGoalie`)
│   │   ├── PlayerPopup.jsx             # NHL player popup (Stats, Analytics, Heat Map, Compare — season-over-season, reuses the seasonTotals already fetched for Stats; Compare tab adds a per-game trend chart for chart-ready metrics (11/18 skater, 8/11 goalie — via the NHL API's own game-log endpoint) alongside the existing tile rows, Session 70; header also renders a "vs Player" entry point, Session 91, stacked under the radar's quickstats grid rather than inline so it doesn't compress the radar). Goalies get their own header radar too (added 2026-08) — `GoalieHeaderPanel`, reusing the same `PlayerRadarChart` skaters use, fed by `computeGoalieRadarAxes()`'s 6-axis GSAX/GSAX-60/5v5/HD/MD/PK set (the data this already fed to the Analytics tab's percentile bars and the goalie-vs-goalie comparison radar since Session 91 — this was purely a missing wire-up in the single-player header, not a data gap). Required a companion `eyewall-poller` fix (`/goalie-analytics` gained the same whole-season-empty fallback `/player-analytics` already had, since the live season can resolve ahead of any real games).
│   │   ├── PlayerComparisonEntry.jsx   # "vs Player" button + same-league (Fuse.js) search panel mounted in both player popups' headers (Session 91) — opens PlayerComparisonPopup once a second player is picked
│   │   ├── PlayerComparisonPopup.jsx/.css # Player-vs-Player Comparison (Session 91) — same-league only (NHL-NHL or PWHL-PWHL); two-series Recharts radar (5-axis NHL skater / 6-axis NHL+PWHL goalie / 4-axis PWHL skater); tabbed detail (Scoring/Possession/Physical/Special Teams for skaters, Record/Performance/Advanced for goalies) reusing the shared StatTileGrid; goalie-vs-skater is hard-blocked (non-overlapping stat schema); F-vs-D pairing shows a non-blocking mismatch badge. PWHL goalie-vs-goalie was ALSO hard-blocked until 2026-08 ("no PWHL goalie percentile data yet") — unblocked once pwhl_goalie_percentiles.py/`/pwhl/goalie/percentiles` shipped for PWHLPlayerPopup.jsx's own goalie radar and got reused here. First and only consumer of Tailwind in this repo.
│   │   ├── PercentileBar.jsx           # Single percentile row (bar + tier label) — extracted from PlayerPopup.jsx (Session 91) so PlayerComparisonPopup.jsx can reuse it without importing PlayerPopup.jsx back (would create a circular import, since PlayerPopup.jsx renders the entry point that opens the comparison popup)
│   │   ├── GameEvents.jsx              # Goal/penalty/win/puck drop popups — Tailwind (Phase 4, sub-PR 2), no .css file
│   │   ├── ScoutingTab.jsx             # NHL opponent scouting — Tailwind (Phase 6), no .css file
│   │   ├── DraftTab.jsx                # NHL draft board — Tailwind (Phase 6), no .css file
│   │   ├── NotificationBell.jsx        # ⚙️ Settings drawer — Account section (sign-in/out, Session 90) at top, Preferences (My Team/Appearance/Language/Push Notifications/Game Summaries) below
│   │   ├── AccountSection.jsx/.css     # Sign-in UI inside Settings (Session 90) — signed-out row, two-step email sign-in, signed-in row (avatar/email/Synced badge) + sign-out
│   │   ├── TriviaFeed.jsx              # Daily Trivia tab content (Session 92) — three tier cards, answer/reveal flow, aggregate correct/attempted stats. Same "rendered as a tab inside NewsView" pattern as MilestonesFeed.jsx. Tailwind (Phase 1 own classes; NewsView.css-owned classes finished Phase 4, sub-PR 4, imported from utils/newsViewClasses.js)
│   │   ├── PeriodSummary.jsx           # Period/game summary popup + share canvas + hat trick badges — fully Tailwind (Phase 4, sub-PRs 5a/5b; PeriodSummary.css deleted)
│   │   ├── PWHLPeriodSummary.jsx       # PWHL period/game summary popup + share canvas — fully Tailwind, same as above
│   │   ├── PWHLPredictionShareCanvas.jsx # PWHL prediction track-record + share canvas (Session 100) — right-sized PWHL analogue of PredictionShareCanvas.jsx, scoped to what /pwhl/prediction actually returns (win%, expected score, narrative, streak, shot-attempt share); no odds/PP-PK-factors/line-combos section, since PWHLGamePreviewPopup.jsx doesn't fetch that for its Prediction section. Auto-save/track-record logic lives in utils/pwhlPredictionStore.js, an independent store (own localStorage key) rather than reusing predictionStore.js's Carolina-era `carActual`/`predictedCarWin` field names
│   │   ├── ShareButtons.jsx/.css       # Shared Save/X/Share buttons across all export cards
│   │   ├── HatTrickPopup              # (in GameEvents.jsx) — live hat trick celebration overlay
│   │   ├── MilestonesFeed.jsx          # League-wide milestone feed (hat tricks, shutouts, SH goals, season/career thresholds) — tappable into PlayerPopup
│   │   ├── TransactionsFeed.jsx        # PWHL-only league-wide signings/moves feed, fourth tab on PWHLNewsView.jsx alongside News/Milestones/Trivia. Live proxy of HockeyTech's view=transactions (GET /pwhl/transactions) — not persisted to Supabase. Same card-reuse pattern as MilestonesFeed.jsx but non-tappable (transaction rows carry no player_id, just a display name) and no team filter
│   │   ├── PlayerSearch.jsx/.css       # Global NHL+PWHL player search (Topbar) — Fuse.js fuzzy match against the Worker's flat player index
│   │   ├── TeamLogo.jsx/.css           # NHL + PWHL team logo renderer
│   │   ├── EyeWallLogo.jsx             # Theme-aware EyeWall wordmark (Session 100) — renders both eyewall-logo.svg (bright) and eyewall-logo-light.svg (contrast-darkened) stacked, toggled purely via CSS on [data-theme] (index.css), not a JS getTheme() check, so it reacts instantly to a live theme toggle. Only for logo placements on the app's own themed background (TeamPicker.jsx, AboutPopup.jsx) — the fixed-dark share-canvas components render /eyewall-logo.svg directly instead, since their canvas bg never changes with app theme
│   │   ├── CalendarView.jsx            # NHL calendar month view
│   │   ├── PWHLCalendarView.jsx        # PWHL calendar month view
│   │   ├── InfoTip.jsx/.css            # Tap-to-open tooltip
│   │   ├── StatBar.jsx/.css            # Comparative stat bar
│   │   ├── SeasonComparisonPicker.jsx/.css # Generic N-season selector for season-over-season comparison (NHL + PWHL, not league-specific)
│   │   ├── TeamComparisonPopup.jsx     # Team-level season-over-season comparison dialog (NHL + PWHL, box-score stats only) — reuses PlayersView.css's popup/stat-section styles; its Head-to-Head tab also renders an AI narrative card (Session 90) via HeadToHeadNarrativeCard
│   │   ├── GameChipsRow.jsx            # Shot map game-selector chip row (NHL + PWHL, shared) — normalized {id, opponentAbbr, opponentColor, myScore, oppScore, isHome} shape, each sport maps its own schedule-row into it
│   │   ├── SeasonChipRow.jsx           # Shot map season-selector chip stack (NHL + PWHL, shared) — recent seasons inline + a "More seasons" overflow dropdown for older ones
│   │   ├── SeasonTypeToggle.jsx        # Regular Season/Playoffs segmented toggle (NHL + PWHL, shared) — same UI, different wiring per sport (PWHL swaps season_id; NHL filters the fetched season's games by gameType)
│   │   ├── DisabledHint.jsx            # Tap-triggered "why is this grayed out" tooltip — used by the shot map selector while a game is live
│   │   ├── AHLGameEvents.jsx           # AHL live game event popups (goal/penalty/win/puck drop) — port of PWHLGameEvents.jsx's sessionStorage-deduped popup layer (parity Phase 6). Deliberately does NOT port PWHLLiveInsights — several of its callouts (faceoff dominance in particular) depend on event types AHL's PBP doesn't have at all
│   │   ├── AHLPlayerPopup.jsx          # AHL player detail popup (Stats + Heat Map tabs only, parity Phase 2) — no percentile radar header, no Scout/Compare tabs (no `ahl_percentiles.py`-equivalent pipeline computation), no goalie heat map (AHL's PBP goal events carry `goalie_id: null`, a real structural gap from PWHL's feed)
│   │   ├── AHLGameStatsPopup.jsx       # AHL box-score popup (parity Phase 3) — team-stat comparison bars drop hits/blocked-shots/faceoff% entirely (always 0 in AHL's feed, never ingested); no "View Shot Map" CTA (AHLShotMapView.jsx is season-aggregate, not per-game)
│   │   ├── AHLBoxScoreTable.jsx        # Per-player skater/goalie table for AHLGameStatsPopup — drops HIT/BLK/FO%/skater-TOI columns entirely; AHL's gameSummary reports these as a hardcoded 0 regardless of real ice time, so the pipeline never ingested them
│   │   ├── AHLGamePreviewPopup.jsx     # AHL pre-game preview popup (parity Phase 3) — real field-NAME differences from PWHL's `gameCenterPreview` shape (`teamRecord.overall`/`.past_10_games` not `overallRecord`/`last10Record`, `powerPlayStats`/`penaltyKillStats` not `powerPlay`/`penaltyKill`, `previousMeetings` not `seasonSeries`); no shot-attempt-share row at all (no `corsiForPct` data source)
│   │   ├── AHLCalendarView.jsx         # AHL monthly schedule grid — port of PWHLCalendarView.jsx; no distinct OT/shootout-loss cell variant since `ahl_game_log` has no ot/shootout boolean columns, so every non-win renders as a plain loss
│   │   ├── ECHLGameEvents.jsx          # ECHL live game event popups — port of AHLGameEvents.jsx (ECHL parity pass, Phase 6 equivalent), same faceoff-data-gap reasoning for dropping a live-insights panel
│   │   ├── ECHLPlayerPopup.jsx         # ECHL player detail popup (Stats + Heat Map tabs only) — direct port of AHLPlayerPopup.jsx, same data walls; confirmed live that ECHL's goal events also carry `goalie_id: null`
│   │   ├── ECHLGameStatsPopup.jsx      # ECHL box-score popup — port of AHLGameStatsPopup.jsx, same dropped-stat reasoning
│   │   ├── ECHLBoxScoreTable.jsx       # Per-player skater/goalie table for ECHLGameStatsPopup — same dropped-columns shape as AHLBoxScoreTable.jsx
│   │   ├── ECHLGamePreviewPopup.jsx    # ECHL pre-game preview popup — confirmed live 2026-08-30 that ECHL's `gameCenterPreview` shape is byte-identical to AHL's (same HockeyTech vendor generation)
│   │   └── ECHLCalendarView.jsx        # ECHL monthly schedule grid — port of AHLCalendarView.jsx
│   ├── hooks/
│   │   ├── useFetch.js                 # Data fetching + polling (cache: no-store)
│   │   ├── usePushNotifications.js
│   │   ├── usePeriodSummary.js
│   │   ├── useWakeLock.js
│   │   └── useReadState.js             # Unseen-content badges for News/Milestones/Trivia tabs + BottomNav's combined dot (Session 92) — local-only, boolean-only; reuses SportContext.jsx's window.CustomEvent cross-component convention rather than a new Context
│   └── utils/
│       ├── nhlApi.js                   # NHL API calls + KV caching
│       ├── pwhlApi.js                  # PWHL Worker API calls
│       ├── seasonComparison.js         # Pure label/normalization helpers for season-over-season comparison
│       ├── pwhlConfig.js               # PWHL team configs (12 teams: 8 established + 4 expansion, all live/selectable)
│       ├── teamConfig.js               # NHL 32-team configs; CURRENT_SEASON live-resolved (fallback seed only)
│       ├── seasonClient.js             # Shared memoized fetch for /config/seasons (teamConfig.js + pwhlConfig.js) and /config/seasons/comparison (SeasonComparisonPicker)
│       ├── SportContext.jsx            # Sport state (NHL/PWHL), derived from the current route (/pwhl/* vs everything else) rather than localStorage — see "Sport/route mismatch" below. localStorage['eyewall:sport'] still holds the user's stored default, used by TeamPicker/favoriteTeamSync/onboarding
│       ├── advancedStats.js
│       ├── supabaseClient.js           # DB queries; getTeamXgTrend, getGoalieShots (no car_game filter) — Worker-proxied, NOT direct Supabase (see supabaseAuth.js for the one exception)
│       ├── supabaseAuth.js             # Supabase Auth client (Session 90) — the only place this app imports @supabase/supabase-js directly; signInWithOtp/session handling only, never used for data reads
│       ├── AuthContext.jsx             # Auth state (Session 90) — mirrors SportContext.jsx's context+provider+hook pattern. Also runs favoriteTeamSync.js/triviaAnswers.js's sign-in reconciliation
│       ├── favoriteTeamSync.js         # Favorite-team sync for signed-in users (Session 91) — write-on-switch (awaited before the team-change reload) + reconcile-on-session-load (first sign-in uploads local; existing server value wins on a new device)
│       ├── triviaAnswers.js            # Trivia answer tracking (Session 92) — local-first for everyone; signed-in users get a union merge on sign-in (not favoriteTeamSync's overwrite rule — answer history is append-only, so a second device's local answers must never be discarded)
│       ├── playerSearch.js             # Fuzzy player search — fetches GET /players-search-index once per session, matches via Fuse.js
│       ├── nhlPlayerStats.js           # NHL skater/goalie stat defs, formatters, and radar-axis composites — extracted from PlayerPopup.jsx (Session 91) so PlayerComparisonPopup.jsx can reuse them without a circular import
│       ├── pwhlPlayerStats.js          # PWHL equivalent of nhlPlayerStats.js — extracted from PWHLPlayerPopup.jsx (Session 91)
│       ├── ahlApi.js                   # AHL Worker API calls — parallel to pwhlApi.js, only covers the routes that actually exist (see eyewall-poller's `ahl.js`); no transactions/salaries/scouting/narrative endpoints for AHL
│       ├── ahlConfig.js                # AHL team configs — 32 teams, real Atlantic/North/Central/Pacific division structure; `AHL_CURRENT_SEASON` live-resolved via the same getter pattern as NHL/PWHL; real per-team colors for 31/32 teams (Ontario Reign is still the one team on the neutral placeholder — their June 2026 rebrand has no published hex anywhere yet)
│       ├── ahlPlayerStats.js           # AHL skater/goalie stat defs + formatters — mirrors pwhlPlayerStats.js's `{group, items: [{def, fmt}]}` shape; no percentile map or radar-axis functions (no AHL percentile pipeline exists)
│       ├── ahlPredictionStore.js       # AHL prediction tracking (localStorage-only) — trivial port of pwhlPredictionStore.js, same neutral team/opponent field-name convention
│       ├── echlApi.js                  # ECHL Worker API calls — parallel to ahlApi.js; foundation + full 6-phase-parity routes only, no transactions/salaries/scouting endpoints (same limitation as AHL)
│       ├── echlConfig.js               # ECHL team configs — 30 teams, real North/South/Central/Mountain division structure (different alignment than AHL's); all 30 teams still render on one shared neutral color placeholder — real per-team colors are an explicit deferred follow-up, matching AHL's own two-pass color history
│       ├── echlPlayerStats.js          # ECHL skater/goalie stat defs + formatters — mirrors ahlPlayerStats.js
│       ├── echlPredictionStore.js      # ECHL prediction tracking (localStorage-only) — mirrors ahlPredictionStore.js
│       └── analytics.js
├── src/utils/__tests__/
│   ├── *.test.js                       # Vitest unit tests (13 files, 179 tests)
│   └── testHelpers/mockSupabaseAuth.js # Shared vi.mock() query-builder + localStorage/window stubs for favoriteTeamSync.test.js / triviaAnswers.test.js (Session 93)
├── cypress/
│   ├── e2e/
│   │   ├── auth.cy.js                  # Sign-in flow (Session 93) — OTP request intercepted (never hits real Supabase Auth), signed-in state via an injected fake session, sign-out
│   │   ├── trivia.cy.js                # Daily Trivia tab (Session 93) — /trivia/today stubbed with fixtures, three tier cards, answer/reveal, aggregate stats, empty state, PWHL smoke
│   │   ├── read-state-badges.cy.js     # Unseen-content dots (Session 93) — News/Milestones/Trivia tab dots, BottomNav's combined dot, clear-on-answer (Trivia) vs. clear-on-visit (News/Milestones)
│   │   ├── navigation.cy.js            # NHL + PWHL route navigation smoke (all 12 PWHL teams)
│   │   ├── news.cy.js                  # NHL news
│   │   ├── milestones.cy.js            # Milestones feed, team filter dropdown, tap-to-open popup (incl. PWHL milestone self-fetch popup)
│   │   ├── player-search.cy.js         # Global player search — open/close, debounce, typo tolerance, NHL+PWHL result correctness, popup opens for both
│   │   ├── player-comparison.cy.js     # Player vs Player Comparison (Session 91) — "vs Player" entry point, same-league search scoping, NHL skater/goalie + PWHL skater/goalie comparison rendering (PWHL goalie unblocked 2026-08), goalie-vs-skater hard block, position-mismatch badge
│   │   ├── pwhl-news.cy.js             # PWHL news
│   │   ├── period-summary.cy.js        # Game Center
│   │   ├── players.cy.js               # NHL players
│   │   ├── pwhl-players.cy.js          # PWHL players (4 established teams, full features + 1 expansion team empty-state)
│   │   ├── schedule.cy.js              # NHL schedule
│   │   ├── pwhl-schedule.cy.js         # PWHL schedule smoke (all 12 teams) + full features (BOS)
│   │   ├── shot-map.cy.js              # NHL shot map
│   │   ├── pwhl-shot-map.cy.js         # PWHL shot map smoke (all 12 teams) + full features (BOS)
│   │   ├── pwhl-shots-live.cy.js       # PWHL + NHL shot map live-mode debug panel, popups, situation chips
│   │   ├── pwhl-dev.cy.js              # PWHL dev game replay scrubber
│   │   ├── team.cy.js                  # NHL team (4 teams, all 6 tabs)
│   │   ├── pwhl-team.cy.js             # PWHL team (4 established teams, all 5 tabs, full features + 1 expansion team empty-state)
│   │   ├── league.cy.js                # NHL league (all 5 tabs)
│   │   ├── pwhl-league.cy.js           # PWHL league (all 5 tabs; standings/leaders scoped to established teams — see Known gaps)
│   │   ├── draft.cy.js                 # NHL draft board
│   │   ├── TeamPicker.cy.js            # Sport + team picker — all 12 PWHL teams selectable with real colors
│   │   ├── theme.cy.js                 # Light/dark mode
│   │   ├── topnav-safe-area.cy.js      # Topbar safe-area regression (mobile viewports)
│   │   └── viewports.cy.js             # 4 viewports × all views
│   └── support/e2e.js                  # Custom commands incl. cy.setPWHLTeam()
└── .github/workflows/test.yml
```

---

## Sport Selection & Theming

### Sport picker
On first launch the user selects NHL or PWHL, then their team. The sport is stored under `eyewall:sport` and the team under `eyewall:team` (NHL) or `eyewall:pwhl_team` (PWHL). `SportContext` exposes `isPWHL` throughout the app — all routing, `BottomNav` tabs, and data fetching scope accordingly. `hasTeamConfig()` is sport-aware: checks `eyewall:pwhl_team` when sport is PWHL, `eyewall:team` otherwise. On team change, the app navigates to `/` (NHL) or `/pwhl/shots` (PWHL) before reloading so the correct route initializes.

### PWHL teams
12 teams, all live and selectable in `TeamPicker`: BOS (Boston Fleet), MIN (Minnesota Frost), MTL (Montréal Victoire), NY (New York Sirens), OTT (Ottawa Charge), TOR (Toronto Sceptres), SEA (Seattle Torrent), VAN (Vancouver Goldeneyes), plus 4 expansion teams flipped live 2026-07: DET (Detroit), HAM (Hamilton), LV (Las Vegas), SJS (San Jose). Expansion team colors are real (pulled from each team's own `*_colors.css` design tokens), but logos/team names are still temporary placeholders — no permanent branding revealed yet.

### AHL teams (3rd league, added 2026-08)
32 teams, grouped into 4 real conference/division groupings unlike PWHL's flat table: Atlantic (HFD, PRO, LV, WBS, HER, CLT, SPR), North (ROC, SYR, TOR, CLE, UTC, BEL, LAV, HAM), Central (MB, MIL, GR, CHI, RFD, TEX, IA), Pacific (BAK, ONT, SD, SJ, TUC, COL, HSK, ABB, CGY, CV). Team logos are hosted directly from HockeyTech's own asset CDN (`assets.leaguestat.com/ahl/logos/`) rather than bundled locally — AHL logos are stable/official, unlike PWHL's early-days placeholders, so there's no "swap once branding drops" reason to self-host. 31 of 32 teams have real, WCAG-AA-checked colors (sourced from Wikipedia infoboxes + teamcolorcodes.com for 5 teams whose Wikipedia "primary" was a generic near-black template default); Ontario Reign is the one team still on the shared neutral placeholder (`AHL_PLACEHOLDER_COLOR`, `#6B7280`) since their June 2026 "Inland Blue"/"Empire Gold" rebrand has no published hex anywhere yet. `team_id` 317 (BRI, Bridgeport Islanders) is carried alongside 457 (HAM, Hamilton Hammers) as that franchise's pre-2026-27-relocation identity, so historical-season views can still resolve it.

### ECHL teams (4th league, added 2026-08)
30 teams across North/South/Central/Mountain divisions (a different division layout than AHL's Atlantic/North/Central/Pacific, confirmed live rather than assumed to match). Same HockeyTech/LeagueStat vendor as AHL/PWHL, but scoped as a foundation + basic-display pass first, then brought to full 6-phase parity with AHL in the same session — see [AHL & ECHL Frontend Build](#ahl--echl-frontend-build) below. All 30 teams currently render on one shared neutral color placeholder (`ECHL_PLACEHOLDER_COLOR`, `#6B7280`) — real per-team colors are an explicit deferred follow-up, matching AHL's own two-pass color history rather than an oversight. Team logos are hosted from HockeyTech's CDN the same way AHL's are; 4 of 30 teams (JAX, NM, TAH, TRE — all recent expansion/relocation franchises) needed a season-suffixed logo filename instead of the bare `{teamId}.png` pattern, the same versioning quirk AHL's own logo map already documents.

### Color tokens
Same mechanism as NHL — `applyTeamTheme()` sets `--team-primary`, `--team-primary-rgb`, `--team-canvas`, `--team-canvas-rgb` on `:root` from `displayColor`.

### Season constants — now live-resolved, not a manual flip point (2026-07)
`CURRENT_SEASON` (`teamConfig.js`) and `PWHL_CURRENT_SEASON` (`pwhlConfig.js`) are `let`, not `const` — seeded with a fallback value, then updated in place by a fire-and-forget fetch to the Worker's `GET /config/seasons` at module load (via the shared `seasonClient.js`). Every team object's `season` field is a **getter**, not a plain value, so `team.season` reflects the live value everywhere it's read without any consuming component needing to change.

**One real limitation:** if a component destructures `const { season } = someTeam` once and holds onto that local variable indefinitely instead of re-reading `someTeam.season`, it'll keep whatever value existed at that moment — a normal JS stale-closure situation, not something the getter mechanism can fix. Confirmed this actually happening in `PWHLPlayersView.jsx` (its season-picker default via `useState(PWHL_CURRENT_SEASON)`) — fixed by having it listen for the `eyewall:pwhl-season-updated` event both `teamConfig.js`/`pwhlConfig.js` dispatch on resolution, but any *new* component built the same naive way could reintroduce this.

---

## Live Season Resolution

Added 2026-07, replacing what used to be a yearly manual flip of `CURRENT_SEASON`/`PWHL_CURRENT_SEASON` here, `NHL_SEASON` in the Worker, and equivalent constants in the pipeline. The Worker's `seasons.js` is the single source of truth — everything else reads from it rather than resolving independently.

**How the frontend consumes it:** `teamConfig.js` and `pwhlConfig.js` each fire a fetch to `GET /config/seasons` at module load (via the shared `seasonClient.js`, which memoizes the in-flight promise so both modules loading on the same page only trigger one real request, not two). The fetch is fire-and-forget — first paint uses the hardcoded fallback seed, and the `let` binding updates in place once the real value resolves. Every team object's `season` field is a getter reading that `let`, so `team.season` stays live everywhere without touching every consuming component.

**Manual override**, if live resolution ever misjudges the real season boundary (this has happened once already, from a real bug — see Known Limitations below):
```powershell
wrangler kv key put --binding=CACHE "config:season:nhl:override" '"20262027"' --remote
wrangler kv key put --binding=CACHE "config:season:pwhl:override" '{"seasonId":9,"seasonType":"regular","startYear":2026}' --remote
```
Note the `--remote` flag — without it, `wrangler kv` commands operate on the local/preview namespace, not the one the deployed Worker actually reads.

Full detail (the NHL/PWHL resolution logic itself, the `feed=statviewfeed` vs `modulekit` bug, why PWHL resolution prefers regular seasons over more-recent playoffs) lives in `eyewall-poller`'s own README — this section only covers the frontend-facing side.

**AHL and ECHL (added 2026-08) use the identical mechanism**, not a separate one: `ahlConfig.js`/`echlConfig.js` each fire their own fetch to `GET /config/seasons` at module load and update their own `let AHL_CURRENT_SEASON`/`ECHL_CURRENT_SEASON` bindings in place, dispatching `eyewall:ahl-season-updated`/`eyewall:echl-season-updated` the same way `teamConfig.js`/`pwhlConfig.js` do. The same manual-override mechanism applies (`config:season:ahl:override`/`config:season:echl:override` KV keys). Both leagues hit the exact recurring gotcha PWHL's own resolver already has: AHL/ECHL's live-resolved "current" season is itself a **playoffs** season_id for most of the long off-season (AHL resolves to 92 "2026 Playoffs" rather than 90 "2025-26" until the 2026-27 season starts Oct 2; ECHL resolves to 76 "2026 Kelly Cup Playoffs" rather than 73 "2025-26" for the same reason) — `AHL_REGULAR_SEASON_MAP`/`ECHL_REGULAR_SEASON_MAP` (in each config file) exist specifically to map a resolved playoffs id back to its regular-season id for any view that wants "this season's regular-season numbers" specifically rather than just whatever's current.

---

## Cloudflare Worker (`eyewall-poller`)

**Worker URL:** `https://eyewall-poller.billowing-queen-bf23.workers.dev`

### NHL KV Keys

| Key | Content | TTL |
|-----|---------|-----|
| `draft:rankings:2026:{category&#124;all}` | NHL Central Scouting rankings | 24 hr |
| `draft:picks:2026:{team&#124;all}:{round&#124;all}` | Draft picks (live + historical) | 60s while draft in progress (0 &lt; count &lt; 224), 24 hr once complete |
| `draft:order:2026:{team&#124;all}` | Known R1 pick order | 24 hr |
| `narrative:{period}:{gameId}:{carAbbr}` | AI period/game narrative per team perspective | 24 hr |
| `milestones:{sport}:{team&#124;all}:{limit}:{season}` | Recent milestones (hat tricks, shutouts, SH goals, season/career thresholds) — scoped to the live-resolved current season (added 2026-08, see [Live Season Resolution](#live-season-resolution)) so a leftover milestone from a prior season can't sit in the feed indefinitely once the table stops getting new rows (e.g. NHL offseason) | 1 hr |
| `player:landing:{id}` | NHL API player landing proxy (bio, headshot, career totals) | 1 hr |
| `config:season:nhl` | Live-resolved current NHL season (see [Live Season Resolution](#live-season-resolution)) | 6 hr |
| `config:season:nhl:override` | Manual override, bypasses live resolution entirely | none (manual) |

### NHL Worker Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /draft/rankings?category=` | NHL Central Scouting rankings by category |
| `GET /draft/picks?team=&round=` | Draft picks, filterable by team and/or round |
| `GET /draft/order?team=` | Known R1 pick order |
| `POST /draft/analyze` | AI draft pick analysis (secret-protected, `X-Poll-Secret` header) — called by `draft_ingest.py` on draft day |
| `GET /milestones?team=&sport=&limit=` | Recent milestones, NHL by default (`sport=pwhl` for PWHL), optional team filter (default limit 50, max 100) — scoped to the live-resolved current season |
| `GET /player/landing?id=` | Proxies NHL API's `/player/{id}/landing` — browser can't call it directly (no CORS headers on the NHL side) |
| `GET /config/seasons` | Live-resolved current NHL + PWHL season, both leagues in one response (see [Live Season Resolution](#live-season-resolution)) — consumed by `seasonClient.js` at app boot and by the pipeline's `season_lookup.py` |
| `GET /players-search-index` | Flat NHL + PWHL player list (`{id, name, team, position, sport}`, ~1,600 players) for the global player-search autocomplete — see `playerSearch.js` / `PlayerSearch.jsx`. NHL entries may carry `teamStale: true` + `teamSeason` when the live season's own roster data doesn't exist yet (e.g. right after an early season flip) and `team` fell back to the prior season — `PlayerSearch.jsx` renders these dimmed/italic with a "As of `<season>`" tooltip rather than presenting a possibly-wrong team as current fact. |
| `GET /config/seasons/comparison` | Per-league season list with team counts and a `comparable` flag (season-over-season comparison feature, Session 64) — consumed by `SeasonComparisonPicker.jsx` via `fetchComparisonSeasons()` |
| `GET /team-seasons/compare?team=&seasons=` | Box-score fields only for one team across a comma-separated season list — consumed by `TeamComparisonPopup.jsx` via `fetchTeamSeasonsCompare()` |
| `GET /team-seasons/compare-teams?teams=,&season=` | Box-score fields only for two teams at one shared season — backs the "vs Team" mode's Full Stat Comparison (Session 86), consumed by `TeamComparisonPopup.jsx` via `fetchTeamSeasonsCompareTeams()` |
| `GET /team-seasons/head-to-head?teams=,` | All-time head-to-head record/recent-window/current-streak between two teams across every season — backs the "vs Team" mode's Head-to-Head tab (Session 88), consumed via `fetchTeamHeadToHead()` |
| `POST /team-seasons/head-to-head/narrative` | AI narrative layer on top of the head-to-head stats above (Session 90) — posts the already-fetched record/window/streak payload back to the Worker, called directly via `fetch()` (not through `nhlApi.js`) by `HeadToHeadNarrativeCard` in `TeamComparisonPopup.jsx`, same pattern as `PeriodSummary.jsx`'s narrative calls |
| `GET /trivia/today?sport=&team=` | All three trivia tiers (easy/medium/hard) in one response, `team` optional (Session 92) — consumed by `TriviaFeed.jsx` and `useReadState.js` (the latter to compute Trivia's unseen-state badge without rendering the full feed) |
| `GET /news/latest?sport=&team=` | Cheap "anything new" check for the News tab's read-state badge (Session 92) — consumed by `useReadState.js` only, not the main news fetch |
| `GET /milestones/latest?sport=` | Same badge purpose as `/news/latest`, for Milestones (Session 92) |

---

## Cloudflare Worker (`eyewall-poller`) — PWHL

### PWHL KV Keys

| Key | Content | TTL |
|-----|---------|-----|
| `pwhl:standings:{season}` | All 12 teams' standings + L10 + streak | 1 hr |
| `pwhl:players:{teamId}:{season}` | Skaters + goalies + roster | 1 hr |
| `pwhl:schedule:{teamId}:{season}` | Team schedule with scores + dates | 30 min |
| `pwhl:shots:{teamId}:{gameId}` | Shot events for a game | 6 hr |
| `pwhl:pshots:{playerId}:{season}` | Player shot coordinates for heat map | 6 hr |
| `pwhl:salaries:{teamId}:{season}` | Team salary data | 24 hr |
| `pwhl:leagueplayers:{season}` | All 12 teams' skaters + goalies | 2 hr |
| `pwhl:news` | Aggregated PWHL news articles | 30 min |
| `pwhl:narrative:{period}:{gameId}:{carAbbr}` | AI period/game narrative per team perspective | 24 hr |
| `config:season:pwhl` | Live-resolved current PWHL season `{seasonId, seasonType, startYear}` | 6 hr |
| `config:season:pwhl:override` | Manual override, bypasses live resolution entirely | none (manual) |

### PWHL Worker Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /pwhl/standings?season=` | Standings + L10 + streak from game log |
| `GET /pwhl/players?teamId=&season=` | Team skaters + goalies + roster |
| `GET /pwhl/schedule?teamId=&season=` | Team schedule |
| `GET /pwhl/shots?teamId=&gameId=` | Game shot events |
| `GET /pwhl/player-shots?playerId=&season=` | Player shot history for heat map |
| `GET /pwhl/goalie-shots?goalieId=&season=` | Shots faced by a goalie, for the goalie heat map (Session 100) |
| `GET /pwhl/pbp?gameId=` | Play-by-play events |
| `GET /pwhl/scout` (POST) | AI scouting report |
| `GET /pwhl/salaries?teamId=&season=` | Team salary data |
| `GET /pwhl/league-players?season=` | All 12 teams' players (Leaders tab) |
| `GET /pwhl/player/landing?id=&season=` | Single player's identity + one season's stat line, merged — powers `PWHLPlayerPopup`'s self-fetch-by-id (same role `/player/landing` plays for NHL's `PlayerPopup`). `season` pins the stat line to that `season_id`; omitted, falls back to the most recent regular-season row |
| `GET /pwhl/player/career?id=` | Career Regular Season / Playoffs totals — powers `PWHLPlayerPopup`'s Career tile sections. `playoffs` is `null` if the player hasn't made the playoffs yet |
| `GET /pwhl/news` | PWHL news feed |
| `POST /pwhl/news/ingest` | Accept articles from GH Actions pipeline |
| `POST /pwhl/news/bust` | Invalidate news cache |
| `POST /pwhl/cache/bust?secret=&teamId=&season=` | Invalidate one team's KV caches for a given season. **Bust only after confirming the underlying data is actually correct** (direct Supabase query or a fresh Worker hit) — busting first just repopulates the same stale/empty entry if the fix hasn't landed yet. Learned this the hard way during the 2026-07 expansion rollout. |
| `GET /pwhl/summary?gameId=` | HockeyTech gameSummary normalized (goals, MVPs, team stats) |
| `POST /pwhl/summary/narrative?gameId=&period=&carAbbr=` | AI period/game narrative per team perspective |
| `GET /pwhl/team-seasons/compare?teamId=&seasons=` | Box-score fields only for one team across a comma-separated `season_id` list — PWHL analog of `/team-seasons/compare`, consumed by `TeamComparisonPopup.jsx` via `fetchPWHLTeamSeasonsCompare()` |
| `GET /pwhl/team-seasons/compare-teams?teamIds=,&season=` | Box-score fields only for two teams at one shared `season_id` — PWHL analog of `/team-seasons/compare-teams` (Session 86), consumed by `TeamComparisonPopup.jsx` via `fetchPWHLTeamSeasonsCompareTeams()` |
| `GET /pwhl/team-seasons/head-to-head?teamIds=,` | All-time head-to-head record/recent-window/current-streak between two teams — PWHL analog of `/team-seasons/head-to-head` (Session 88), consumed via `fetchPWHLTeamHeadToHead()` |
| `POST /pwhl/team-seasons/head-to-head/narrative` | AI narrative layer on top of the head-to-head stats above (Session 90) — PWHL analog of `/team-seasons/head-to-head/narrative` |

---

## Cloudflare Worker (`eyewall-poller`) — AHL

Added 2026-08 as the 3rd league, brought to full feature parity with PWHL across 6 phases (see [AHL & ECHL Frontend Build](#ahl--echl-frontend-build) below). Every route below is consumed via `src/utils/ahlApi.js`.

### AHL Worker Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /ahl/standings?season=` | Standings, grouped by real division |
| `GET /ahl/players?teamId=&season=` | Team skaters + goalies + roster |
| `GET /ahl/league-players?season=` | All 32 teams' players (Leaders tab) |
| `GET /ahl/roster?teamId=` | Roster only (player_id → name resolution for box scores) |
| `GET /ahl/schedule?teamId=&season=` | Team schedule |
| `GET /ahl/shots?teamId=&season=` | Season shot/goal events with coordinates — no `blocked_shot` event type exists in this data source, a strict subset of `/pwhl/shots`'s shape |
| `GET /ahl/team-season-summary?teamId=&season=` | Season-aggregate SOG + PP%/PK% for the Shot Map's summary card — no hits/blocked/faceoff/penalties sections, no data source for those |
| `GET /ahl/lastgame?teamId=&season=` | Most recent completed game, opponent abbr resolved |
| `GET /ahl/game-box?gameId=` | Per-player skater/goalie box score — no hits/faceoff/blocked-shots/skater-TOI fields |
| `GET /ahl/summary?gameId=` | Period scoring + MVPs/three stars for a completed game |
| `GET /ahl/preview?gameId=` | Pre-game preview — raw HockeyTech `gameCenterPreview` passthrough |
| `GET /ahl/prediction?gameId=` | Win probability + AI narrative — no `corsiForPct` field (no shot-attempts data source) |
| `GET /ahl/player/landing?id=&season=` | Player identity + one season's stat line, powers `AHLPlayerPopup`'s self-fetch |
| `GET /ahl/player/career?id=` | Career Regular Season / Playoffs totals + recent-form games + bio + draft info |
| `GET /ahl/player-shots?playerId=&season=` | Player shot history for the heat map — no goalie equivalent (goal events carry no `goalie_id`) |
| `GET /ahl/team-seasons/compare?teamId=&seasons=` | Box-score fields for one team across seasons — AHL analog of `/team-seasons/compare` |
| `GET /ahl/team-seasons/compare-teams?teamIds=,&season=` | Box-score fields for two teams at one shared season |
| `GET /ahl/team-seasons/head-to-head?teamIds=,` | All-time head-to-head record/recent-window/streak |
| `POST /ahl/team-seasons/head-to-head/narrative` | AI narrative layer on the head-to-head stats above |
| `GET /ahl/news` / `POST /ahl/news/ingest` / `POST /ahl/news/bust` | AHL news feed (fetched by `eyewall-pipeline`'s `ahl_news.py`) |
| `GET /ahl/today?season=` | Today's games (Eastern time) with a derived pre/live/final status |
| `GET /ahl/live/:gameId` | Live (or completed) normalized PBP — no `goalieStats`/`faceoffStats` fields, unlike PWHL's equivalent |

---

## Cloudflare Worker (`eyewall-poller`) — ECHL

Added 2026-08 as the 4th league. Brought to full 6-phase parity with AHL in the same pass it was introduced (a foundation pass first, then the remaining 5 phases, per the user's explicit staging choice — see [AHL & ECHL Frontend Build](#ahl--echl-frontend-build) below). Every route below is consumed via `src/utils/echlApi.js` and mirrors AHL's own route set exactly.

### ECHL Worker Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /echl/standings?season=` | Standings, grouped by real division |
| `GET /echl/players?teamId=&season=` | Team skaters + goalies + roster |
| `GET /echl/league-players?season=` | All 30 teams' players (Leaders tab) |
| `GET /echl/roster?teamId=` | Roster only |
| `GET /echl/schedule?teamId=&season=` | Team schedule |
| `GET /echl/shots?teamId=&season=` | Season shot/goal events — same no-`blocked_shot` limitation as AHL's |
| `GET /echl/team-season-summary?teamId=&season=` | Season-aggregate SOG + PP%/PK% |
| `GET /echl/lastgame?teamId=&season=` | Most recent completed game |
| `GET /echl/game-box?gameId=` | Per-player skater/goalie box score — same dropped-columns shape as AHL's |
| `GET /echl/summary?gameId=` | Period scoring + MVPs/three stars |
| `GET /echl/preview?gameId=` | Pre-game preview — confirmed live that ECHL's payload shape is byte-identical to AHL's |
| `GET /echl/prediction?gameId=` | Win probability + AI narrative — no `corsiForPct` field |
| `GET /echl/player/landing?id=&season=` | Player identity + one season's stat line |
| `GET /echl/player/career?id=` | Career totals + recent-form games + bio + draft info |
| `GET /echl/player-shots?playerId=&season=` | Player shot history for heat map — no goalie equivalent |
| `GET /echl/team-seasons/compare?teamId=&seasons=` | One team across seasons |
| `GET /echl/team-seasons/compare-teams?teamIds=,&season=` | Two teams, one shared season |
| `GET /echl/team-seasons/head-to-head?teamIds=,` | All-time head-to-head record |
| `POST /echl/team-seasons/head-to-head/narrative` | AI narrative layer on the head-to-head stats |
| `GET /echl/news` / `POST /echl/news/ingest` / `POST /echl/news/bust` | ECHL news feed — only 2 real sources exist (`thehockeywriters.com`'s ECHL category feed + OurSportsCentral's ECHL press releases, league id 18), since echl.com itself publishes no RSS feed at all |
| `GET /echl/today?season=` | Today's games with derived pre/live/final status |
| `GET /echl/live/:gameId` | Live (or completed) normalized PBP — same no-`goalieStats`/`faceoffStats` gap as AHL's |

---

## Features

### NHL Features
All existing NHL features unchanged — see original documentation. Key features:
- Live shot map with momentum, insights, PP/PK drill-downs
- Period summaries with AI narrative, goals carousel, share export
- 6-tab team page (Overview, Advanced, Splits, Trends, Cap, Picks)
- League page (Standings, Bracket, Leaders, Power Rankings, Draft)
- Player analytics (WAR, RAPM, GSAX, heat maps)
- Players page: Roster / Stats / Prospects tabs, historical-season picker on the Roster tab (`GET /v1/roster/{team}/{season}`) alongside the live current roster
- Push notifications (goal, game start, penalty, win)
- Player vs Player Comparison (Session 91, NHL + PWHL) — "vs Player" entry point on the player popup opens a same-league two-player comparison: overlaid radar chart, tabbed detail sections reusing the existing stat-tile grid. Goalie-vs-skater is hard-blocked; forward-vs-defenceman pairing shows a non-blocking mismatch badge. PWHL goalie-vs-goalie was hard-blocked too until 2026-08 (no percentile data existed) — unblocked once `pwhl_goalie_percentiles.py` shipped.

### PWHL Features

**Shot Map** — Same `react-hockey-rink` component as NHL. Corsi/Fenwick panel (no missed shots in HockeyTech — FF% is SOG-based proxy). PP/PK analysis drill-downs. Season picker (2023-24 / 2024-25 / 2025-26). Faceoff events from PBP (HockeyTech `homeWin` string `"0"`/`"1"` fix applied).

**Schedule** — Regular season cards with SortBar (newest/oldest), calendar toggle, venue city. Playoffs tab with best-of-5 SeriesCards (3 pips), Walter Cup Final label, "View Shot Map →" navigation.

**Team Page (5 tabs):**
- **Overview** — W–OTW–OTL–L record (3-2-1-0 points system), season stats grid (GF/GP, GA/GP, Diff, PP%, PK%, SOG/GP, SA/GP) with league rank badges, top scorers, starting goalie card
- **Advanced** — CF%/FF% from `pwhl_shot_events`, PDO, special teams PP%/PK%, league context rankings, playoff toggle
- **Splits** — Home vs Away side-by-side (Pts%, GF/GP, GA/GP, Diff), Regular Season / Playoffs toggle
- **Trends** — Streak, L10, result dots, rolling 10-game win%, rolling 5-game GF/GA, goal differential waterfall
- **Salaries** — Total payroll vs $1.3M cap ceiling, CBA target ($58,349.50/player ±10%), Avg vs Target, player salary bars

**Players Page** — Photo grid roster (Forwards / Defencemen / Goalies), season picker, sortable stats tables. Player popup with Stats, Heat Map (from `pwhl_shot_events`), and Scout (AI on-demand) tabs.

**League Page (5 tabs):**
- **Standings** — W/OTW/OTL/L columns, PTS, Pt%, GF, GA, DIFF, L10 dots, STRK. 3-2-1-0 points note. Sortable.
- **Playoff Bracket** — Semifinals + Walter Cup Final, best-of-5 (3-win pips), series modal with game-by-game results and dates
- **Leaders** — Points, Goals, GAA, SV% top 10. Click → player popup
- **Power Rankings** — 5-factor weighted formula (Pts% 35%, L10 20%, GD/GP 20%, CF% 15%, Special Teams 10%), collapsible formula card
- **Draft** — 2026 (72 picks, 12 teams) and 2025 (48 picks, 8 teams) with position and round filters

**News** — Aggregated from Sportsnet, The Score, and others. Fetched by GH Actions `pwhl_news.py` and POSTed to Worker (CF datacenter IPs are blocked by RSS sources). 25hr KV cache (fixed from 30min during the news-ingestion investigation — the short TTL meant it sat empty most of the day between this script's own infrequent runs).

### AHL Features (3rd league, added 2026-08)

Brought to full 6-phase feature parity with PWHL — see [AHL & ECHL Frontend Build](#ahl--echl-frontend-build) for the phase-by-phase history and the real bugs found while shipping it. Every feature below has a real, confirmed data-source reason for anything dropped relative to PWHL — none are unfinished scope.

**Shot Map** — Season-aggregate `react-hockey-rink` view + PP/PK summary card. No Corsi/Fenwick/PDO panel (no `blocked_shot` event type in AHL's HockeyTech feed, ever). No per-game history browser — shot markers don't open a player popup. Live-tracking layer (score chip, goal/penalty/win/puck-drop popups, dev-only 5-tap debug panel) added in Phase 6.

**Schedule** — Game cards + calendar toggle + box-score/preview popups + win predictions (Phase 3). No separate Regular Season/Playoffs tab (playoffs is its own selectable season entry instead); no round-based playoff bracket (Calder Cup's format is up to 4 rounds, never ported).

**Team Page (4 tabs)** — Overview, Stats, Splits, Trends. No Advanced tab (no shot-attempts data for CF%/FF%/PDO) and no Salaries tab (no AHL salary data source anywhere). "Compare Seasons" button (Phase 4) opens the shared `TeamComparisonPopup` in all 3 modes (Compare Seasons, Full Stat Comparison, Head-to-Head), including a live AI narrative on the Head-to-Head tab.

**Players Page** — Photo grid roster + sortable stats table (drops `shot_pct`/`gw_goals`, absent from the feed). Player popup (Phase 2) with Stats + Heat Map tabs only — no percentile radar, Scout, or Compare tab (no percentile pipeline for AHL yet), and no goalie heat map (AHL's PBP goal events carry no `goalie_id`).

**League Page (2 tabs)** — Standings (grouped by real Atlantic/North/Central/Pacific divisions, 3-column OTL split into ot_losses + shootout_losses) + Leaders (clickable into the player popup). No Bracket or Power Rankings tabs.

**News** — Single News tab, no Milestones/Trivia/Transactions toggle (no pipeline source for any of the three). 3 real RSS sources: `theahl.com/feed` (the only one of the four leagues with an official-league-site RSS feed at all), `thehockeywriters.com`'s AHL category feed, and OurSportsCentral's AHL press releases (league id 17 on that site).

**Live Tracking (Phase 6)** — Score chip + goal/penalty/win/puck-drop popups layered onto the season-aggregate Shot Map. No live-insights panel (faceoff-dependent callouts can't be built — AHL's PBP has no faceoff events). Verified via a dev-only debug panel (5 taps on the header) rather than a real game — AHL's 2026-27 season hadn't started as of this writing (preseason 2026-09-26, regular season 2026-10-02).

### ECHL Features (4th league, added 2026-08)

Same HockeyTech/LeagueStat vendor as AHL/PWHL. Started as a foundation + basic-display pass (Shot Map/Players/Schedule/League/Team, no player popups/comparisons/news/live-tracking), then brought to the same full 6-phase parity as AHL within the same session, per the user's explicit choice to stage it exactly the way AHL itself was staged rather than build everything in one pass. Every feature and every scope cut below mirrors AHL's own, confirmed live rather than assumed to transfer.

**Shot Map** — Same season-aggregate rink + PP/PK summary shape as AHL's, including the Phase 6 live-tracking layer (score chip, event popups, debug panel).

**Schedule** — Game cards + calendar + box-score/preview popups + predictions, same Reg/Playoffs and bracket scope cuts as AHL's.

**Team Page (4 tabs)** — Overview/Stats/Splits/Trends, same Advanced/Salaries data walls as AHL. "Compare Seasons" uses ECHL's own real playoffs-label convention (`"{year} Kelly Cup Playoffs"`, from `echlConfig.js`'s hand-verified season list) rather than assuming AHL's bare `"{year} Playoffs"` format transfers.

**Players Page** — Same roster/stats/popup shape as AHL's `AHLPlayersView`/`AHLPlayerPopup`, including the same dropped `shot_pct`/`gw_goals` columns and the same no-goalie-heat-map gap (confirmed live that ECHL's goal events also carry `goalie_id: null`).

**League Page (2 tabs)** — Standings grouped by ECHL's real North/South/Central/Mountain divisions (a different division layout than AHL's) + Leaders.

**News** — Single News tab. Only 2 real sources, not AHL's 3 — `echl.com` has no RSS feed at all (confirmed live: `/feed` and `/rss` both 404, the same Laravel/Livewire site rebuild that also means its HockeyTech API key isn't network-tab-discoverable the way AHL's/PWHL's are). The two real sources: `thehockeywriters.com`'s ECHL category feed, and OurSportsCentral's ECHL press releases — league id **18**, confirmed live rather than assumed to be sequential with AHL's id 17.

**Live Tracking (Phase 6)** — Same score-chip + event-popup layer as AHL's, verified via the identical dev-only 5-tap debug panel (no real 2026-27 ECHL game existed yet either as of this writing).

---

## Authentication

Optional, passwordless sign-in via Supabase Auth (`signInWithOtp`) — Session 90. **Fully additive**: the app behaves identically for anyone who never signs in. Two-step flow in the Settings drawer's new Account section (`AccountSection.jsx`): email entry → "check your email." Session persistence/refresh is handled entirely by `supabase-js` itself (`persistSession`/`autoRefreshToken` in `supabaseAuth.js`, backed by `localStorage`) — `AuthContext.jsx` just mirrors that state into React.

**The one deliberate exception to "this app only talks to the Worker":** `signInWithOtp`/session handling is inherently a browser-to-Supabase-Auth-endpoint flow — there's no Worker route to proxy it through, and the anon/publishable key is already safe to expose client-side by design. Every data read still goes through the Worker, unchanged.

**Email delivery:** custom SMTP via Resend (configured in the Supabase dashboard — not something this repo's code touches). Supabase's default shared sender caps at 2 emails/hour, which doesn't survive real usage; Resend removes that ceiling.

**`user_preferences` table** (`auth.uid()`-scoped RLS, `docs/session90_user_preferences_table.sql` + `docs/session91_favorite_sport_column.sql` in `eyewall-pipeline`) backs two things:

- **Favorite team sync** (`favoriteTeamSync.js`, Session 91) — a signed-in user's team switch (`TeamPicker.jsx`, the sole write site) writes through immediately, awaited before the team-change reload so the very next reconciliation pass doesn't read back a stale value. On session load, the server value is reconciled once: first sign-in with no server row yet uploads the local pick; a second device where a server value already exists wins and overwrites local (one corrective reload). `AuthProvider` wraps `TeamPicker` (not just the post-onboarding app shell) so this can work on the "Change team" path too — a short-lived `eyewall:team-change-pending` flag stops reconciliation from clobbering a re-pick in progress with the *old* server value.
- **Trivia answer history** (`triviaAnswers.js`, Session 92) — see [Daily Trivia](#daily-trivia) below; deliberately a different merge rule than favorite team.

Neither sync mechanism is a live subscription — server changes on another device are picked up on this device's *next load*, not instantly. A stated v1 scope decision, not an oversight.

---

## Daily Trivia

Third tab on the News page (`TriviaFeed.jsx`, alongside News/Milestones — Session 92), NHL and PWHL both. Three tiers per day, fetched in one call to `GET /trivia/today?sport=&team=`:

- **Easy** — league-wide, AI-generated (guardrailed — see `eyewall-pipeline`'s [Daily Trivia](https://github.com/ehlersio/eyewall-pipeline#daily-trivia) section for the generation-side detail, including two real prompt bugs found and fixed during live verification)
- **Medium** — the user's own team, AI-generated. Question text is deliberately team-name-free (the model can't be trusted to reproduce a proper noun correctly, confirmed live) — team identity is instead conveyed by a `TeamLogo` next to the tier badge, driven by the row's own real `team` column
- **Hard** — historic/rules deep-cuts, hand-curated directly in Supabase (no admin UI in v1)

**Answer tracking** (`triviaAnswers.js`): local-first for everyone (`eyewall:trivia-answers` in `localStorage`). Signed-in users write through to `trivia_answers` immediately on answering, and get a **union merge** on sign-in — local-only and server-only answered questions both survive; nothing is ever overwritten or discarded. This is a deliberately different rule from favorite-team's overwrite-on-second-device sync above: answer history is an append-only log, and Phase 1's "server wins" rule would silently delete real answers a second device already has. Verified live in both directions with a real two-device simulation.

**Stats display:** aggregate correct/attempted ratio (e.g. "12/15 correct — 80%"), not a streak counter — a stated v1 scope choice.

**Read-state badges** (`useReadState.js`) — Trivia's tab dot needs no storage of its own; it's derived from today's questions vs. the answered map, so *answering* a question clears it, not merely viewing the tab. News/Milestones use a real `localStorage` "last seen item id" marker instead (`GET /news/latest`/`GET /milestones/latest`), cleared on tab visit. `BottomNav`'s News icon shows a combined dot — an OR across all three tabs' own unseen state, reusing the same cross-component reactivity `SportContext.jsx` already established for season updates rather than introducing a new Context.

---

## PWHL Points System

The PWHL uses a **3-2-1-0 points system**:
| Result | Points |
|--------|--------|
| Regulation win | 3 |
| OT/SO win | 2 |
| OT/SO loss | 1 |
| Regulation loss | 0 |

All standings, record displays (W–OTW–OTL–L), and Splits calculations use this system.

---

## AHL & ECHL Frontend Build

AHL (3rd league) and ECHL (4th league — NHL, PWHL, AHL, ECHL in build order) were both added in 2026-08, each following the **same 6-phase progression** PWHL itself was originally built through: foundation display → player popups → game popups/predictions → team comparison → news → live tracking. Every phase is its own PR (or small PR set) across `eyewall-pipeline`, `eyewall-poller`, and this repo. AHL went through this as two separate passes (foundation first, full parity later); ECHL's user explicitly chose to stage it the same way rather than build the full set in one pass, even though by the time ECHL started, AHL's own full-parity build was already a known, repeatable template.

### Build history

**AHL:**
1. **Foundation** — `AHLShotMapView`/`AHLScheduleView`/`AHLPlayersView`/`AHLLeagueView` (standings/leaders only, no team page yet), wired as a 3rd selectable sport across `SportContext`/`TeamPicker`/`App.jsx`/`BottomNav`. Real per-team colors and a real AHL shield logo followed as same-day fast-follow PRs. Deliberately smaller than PWHL's equivalents (no live tracking, no player popups, no Corsi/Fenwick/PDO, no calendar/predictions, no bracket/power-rankings) — re-confirmed with Matt mid-session rather than assumed.
2. **AHLTeamView** (Overview/Stats/Splits/Trends, Advanced+Salaries dropped) + **AHLPlayerPopup** (Stats + Heat Map tabs only — no percentile radar/Scout/Compare tabs, no goalie heat map).
3. **Game box score + schedule popups + calendar + predictions** — `AHLBoxScoreTable`/`AHLGameStatsPopup`/`AHLGamePreviewPopup`/`AHLCalendarView`/`ahlPredictionStore.js`, wired into `AHLScheduleView`.
4. **Team comparison / head-to-head** — `TeamComparisonPopup.jsx` gained a full `'ahl'` branch (fetch functions, logo sport, team-option lists), wired into `AHLTeamView`'s new "Compare Seasons" button. All 3 modes (Compare Seasons, Full Stat Comparison, Head-to-Head, the last with a live AI narrative) verified with real data.
5. **News feed** — `AHLNewsView.jsx`, News tab only (no Milestones/Trivia/Transactions — no pipeline source for any of the three). 3 real RSS sources found and verified live.
6. **Live game tracking** — `AHLGameEvents.jsx` (goal/penalty/win/puck-drop popups, ports `PWHLGameEvents.jsx`'s layer minus the faceoff-dependent insights panel) + a live-tracking layer on `AHLShotMapView.jsx` (score chip, dev-only 5-tap debug panel). Required a prerequisite pipeline fix first: PWHL's own `game_state` column was only ever updated by the once-nightly pipeline run, meaning the Worker's per-minute cron could never actually observe "live" for a real game — fixed for **both** AHL and PWHL with a new 5-minute `*_live_refresh.py` GH Actions cron, not just scoped narrowly to AHL.

**ECHL** (started after AHL's full parity was already shipped, so its build reused AHL's exact template phase-for-phase):
1. **Foundation** — pipeline ingestion (stats/box-score/shot-events/penalty-shots), 7 poller routes, 5 frontend views (ShotMap/Players/Schedule/League/Team), wired as the 4th league. Explicitly scoped smaller than full parity per the user's own choice, matching AHL's two-pass history rather than attempting everything at once.
2. **ECHLPlayerPopup** — direct port of `AHLPlayerPopup.jsx` (Stats + Heat Map only), plus a real self-hosted ECHL shield logo for the league picker tile.
3. **Game box score + preview + calendar + predictions** — `ECHLBoxScoreTable`/`ECHLGameStatsPopup`/`ECHLGamePreviewPopup`/`ECHLCalendarView`/`echlPredictionStore.js`. Confirmed live that ECHL's `gameSummary`/`gameCenterPreview` payload shapes are byte-identical to AHL's (same HockeyTech vendor generation) — no reshaping surprises this phase.
4. **Team comparison / head-to-head** — `TeamComparisonPopup.jsx`'s `'echl'` branch. Uses ECHL's own real `"{year} Kelly Cup Playoffs"` label format rather than assuming AHL's bare `"{year} Playoffs"` transfers.
5. **News feed** — `ECHLNewsView.jsx`. Only 2 real sources exist (not AHL's 3) — `echl.com` has no RSS feed of its own at all.
6. **Live game tracking** — `ECHLGameEvents.jsx` + a live-tracking layer on `ECHLShotMapView.jsx`, direct port of AHL's Phase 6. No DDL needed this time — the prerequisite `game_status_code` column ECHL needed already existed from its own foundation-pass schema.

Both leagues now sit at full feature parity with each other (and, apart from the real data-source gaps below, with PWHL) — treat AHL and ECHL going forward the same way PWHL/AHL are already treated relative to each other. This same phase-by-phase template applies to any future league addition.

### The debug-panel live-tracking verification pattern

Neither league had a real live game to test against as of this writing — AHL's 2026-27 season starts 2026-10-02 (preseason 2026-09-26); ECHL's 2026-27 season similarly hasn't started (season id 78, not yet begun; the live-resolved "current" ECHL season is 76, the 2026 Kelly Cup Playoffs). Both `AHLShotMapView.jsx` and `ECHLShotMapView.jsx` reuse `PWHLShotMapView.jsx`'s own dev-only verification mechanism instead of waiting for a real game:

- **5 taps on the view's header** (within a 2-second window, tracked via a tap-count ref + timeout) toggles a fixed debug panel above the bottom nav.
- The panel and the tap handler itself are **both** gated behind `import.meta.env.DEV` independently — the handler no-ops immediately in production (`if (!import.meta.env.DEV) return`), and the panel's render condition repeats the same check, so there's no code path where a production build can expose it.
- Panel buttons fire the same popup components (`AHLGoalPopup`/`AHLPenaltyPopup`/`AHLWinPopup`/`AHLPuckDropPopup`, and their ECHL equivalents) with hand-built sample event payloads shaped exactly like a real `/ahl/live/:gameId` (or `/echl/live/:gameId`) response, so the popups are exercised with realistic data even without a real game.

**Browser-automation lesson from verifying this pattern live:** a tight synchronous loop of simulated clicks against the same element reads a stale React-state closure between each click (no re-render happens between synchronous calls), which can look like the debug panel "isn't counting taps right" when the real issue is the verification method itself. The fix is to use ref-based clicks (not screenshot-inferred pixel coordinates, which can land on a sticky top nav bar instead of the page's own header underneath it) with explicit waits between each tap, and — more generally — to always split a "click, then read resulting state" check into two separate tool round-trips rather than one script, since React's render doesn't necessarily flush before a synchronous script continues to its next line.

### Cross-cutting wiring

Bringing AHL (and then ECHL) in as real selectable sports meant touching every file that used to hardcode an NHL/PWHL binary choice:

- **`SportContext.jsx`** — sport is derived from the route (`/ahl/*`/`/echl/*` prefixes, same `/pwhl/*` convention already established), with `isAHL`/`isECHL` added alongside `isPWHL`/`isNHL`; `allTeams`/`currentSeason` both branch across all 4 sports.
- **`TeamLogo.jsx`** — `sport` prop gained `'ahl'`/`'echl'` branches; unlike NHL/PWHL's abbreviation-keyed lookups, AHL/ECHL logos are resolved by HockeyTech's numeric `teamId` (`ahlLogoUrl(getAHLTeamConfig(abbr)?.teamId)`), since that's how HockeyTech's own asset CDN keys them.
- **`TeamPicker.jsx`** — dedicated `AHLTeamStep`/`ECHLTeamStep` components, each grouped by that league's own real divisions, rendering directly against `ahlLogoUrl`/`echlLogoUrl` rather than routing through `TeamLogo`'s abbr-keyed path.
- **`App.jsx`/`BottomNav.jsx`** — `/ahl/*`/`/echl/*` route tables and `AHL_TABS`/`ECHL_TABS` nav arrays, plus the root-redirect logic (`isAHL`/`isECHL` sport → that league's shot map).
- **`useReadState.js`** — the News tab's unseen-badge hook gained `isAHL`/`isECHL` branches; Milestones/Trivia fetches are explicitly skipped for both leagues (`if (isAHL || isECHL) return`) rather than hitting routes with no real backing data.
- **`favoriteTeamSync.js`** — signed-in users' team-switch sync gained `'ahl'`/`'echl'` read/write branches so a signed-in AHL/ECHL user's team pick actually persists across devices instead of silently no-oping.
- **`TeamComparisonPopup.jsx`** — the shared team-comparison dialog's `league === 'ahl' ? ... : league === 'echl' ? ...` branches run through fetch functions, `TeamLogo`'s sport prop, opponent-option lists, and the "Since 2023/Since 2025" scoreboard label, all four ways.

### Real bugs found and fixed while shipping this

A recurring bug **class**, not a one-off: any file with a hardcoded `isPWHL ? ... : isAHL ? ...`-shape (or `league === 'ahl' ? ... : league === 'echl' ? ...`) dispatcher is a candidate for silently missing a branch for whichever league was added most recently — nothing catches this except actually clicking through the flow for that specific league. Confirmed repeatedly across both AHL's and ECHL's builds:

- **`hasTeamConfig()` had no `ahl`/`echl` branch** — selecting a team for either league reverted straight back to the league picker instead of navigating through, on first wiring each league in.
- **`NotificationBell.jsx`'s "Change team" cleanup didn't clear `eyewall:ahl_team`/`eyewall:echl_team`** — fixed for both.
- **`favoriteTeamSync.js`'s read/write helpers only handled `pwhl`** at first, then only `pwhl`/`ahl` once AHL shipped — each new league needed its own explicit branch added, never inherited automatically.
- **`useReadState.js`'s `sport`/`team` ternaries had no `isECHL` branch** even after AHL's own branch existed — fell through to `'nhl'`, so an ECHL user's News-tab badge check was silently querying `sport=nhl` against the wrong team. The exact same bug class as the foundation-pass findings above, just resurfacing in a file that hadn't been touched again until ECHL's Phase 5 needed it — confirms the lesson generalizes to "any file with this shape," not just the files caught in the original grep sweep.
- **A shared `useFetch` out-of-order-response race** (`src/hooks/useFetch.js`) — no guard existed against two fetches resolving out of order (e.g. a deps change firing a second fetch right after mount, before any user interaction): the newer, correct response could arrive first, then get silently overwritten by an older, slower response arriving after. Fixed with a generation-token ref bumped at the start of every `load()` call — a result only commits if no newer call has started since, preserving the existing stale-while-revalidate behavior (old data stays visible mid-fetch) while preventing a stale response from winning. Not AHL/ECHL-specific in the fix itself, but found via a live reproduction against a fresh ECHL team pick — every view using the `useRef(userPickedSeason)` + live-season-update-event pattern (AHL/PWHL schedule/players/league views too) was equally exposed.
- **A `SportContext`/route-derivation gap, generalized rather than special-cased**: `SportContext.jsx`'s sport-from-route logic already had to be taught `/ahl/*` and `/echl/*` prefixes alongside the existing `/pwhl/*` check (and its `seasonFor()`/`eventNameFor()` helpers extended to 4 branches each) — done deliberately as a 4-way ternary chain rather than nested boolean flags, specifically so the next league addition extends the same pattern instead of requiring a structural rewrite.
- **Team-logo asset versioning (AHL, then rediscovered independently for ECHL)**: neither league's logos follow a bare `{teamId}.png` pattern — HockeyTech versions a team's logo file with a season-id suffix (e.g. `335_94.png`) whenever a rebrand happens, without reliably keeping the old bare filename as an alias. 9 of 32 AHL teams and 4 of 30 ECHL teams needed the season-suffixed filename; both logo maps are now built from the feed's own `team_logo_url` field for every team rather than a guessed pattern.
- **Season-label formatting differences, confirmed rather than assumed to transfer**: AHL's playoffs label is a bare single calendar year (`"2026 Playoffs"`); PWHL's is a season-range (`"2025-26 Playoffs"`); ECHL's is its own real named format (`"2026 Kelly Cup Playoffs"`). Each league also needed its own `*_REGULAR_SEASON_MAP` reverse lookup (see [Live Season Resolution](#live-season-resolution) above) since each one's live-resolved "current" season can itself be a playoffs id for most of the off-season.
- **A JSONP-unwrap bug affecting AHL roster fetches for months, only found while building ECHL**: `_modulekit_get()` (the pipeline's shared HockeyTech fetch helper) treated the *first* `"("` anywhere in a response as a wrapper open-paren and the *last* `")"` as its close — but `modulekit/roster` responses are plain JSON, never actually JSONP-wrapped, and routinely contain literal parentheses in real field values (e.g. a `draft_status` like `"Prince George Cougars (WHL) (College) 2019"`), which silently corrupted otherwise-valid JSON before it was ever parsed. Found while writing ECHL's own roster fetch (a real Florida Everblades player has parens in that field) and reproduced directly against AHL's own data — 32 of 33 AHL teams' rosters failed under the old logic, 0 failed after fixing the check to `if text.startswith("(") and text.endswith(")")`. Three earlier, narrower guesses at this same AHL symptom (a suspected cache-regeneration race against HockeyTech's CDN) were all wrong — the underlying lesson: when a diagnostic keeps returning "no answer" across several iterations, consider that the working theory itself may be wrong, not just under-instrumented.
- **`/config/seasons/comparison` never actually built an `ahl` key**, despite a code comment in `AHLTeamView.jsx` claiming it did since AHL's own Phase 4 — meaning AHL's "Compare Seasons" mode had been silently showing its empty "no seasons available" state in production since that phase shipped, undetected until ECHL's own Phase 4 work built the missing `ahl`/`echl` config-route entries side by side and caught the gap by comparison. A reminder that a code comment claiming "X already exists" is a claim about the state at the time it was written, not a verified fact.

### Real, permanent data walls (not scope choices)

Both AHL and ECHL's HockeyTech feeds share the same structural ceiling, confirmed against production rather than assumed from PWHL's richer feed:

- **No shift data, ever** — no TOI, no on-ice Corsi, no WAR/RAPM equivalent is buildable for either league from this data source.
- **No `blocked_shot`, `hit`, or `faceoff` event types** — Corsi/Fenwick/PDO panels, hit totals, and faceoff% are all unbuildable; box-score hits/faceoff fields are hardcoded 0 in the raw feed itself, not merely unparsed.
- **No goalie attribution on goal events** (`goalie_id: null` on every PBP goal row for both leagues) — blocks a goalie heat map specifically, shipped as an honest "not available" state rather than an approximation.
- **No salary data source** for either league, anywhere.
- **No milestones/trivia/transactions pipeline** for either league — `MilestonesFeed.jsx`/`TriviaFeed.jsx`/`TransactionsFeed.jsx` are not generic components missing a branch; they hardcode `isPWHL`/`isNHL` with no third state, and there is no data to back a third state regardless.

---

## Data Pipeline (`eyewall-pipeline`)

**Repo:** `github.com/ehlersio/eyewall-pipeline`

### NHL Pipeline Modules
| Module | Description |
|--------|-------------|
| `nhl_stats.py` | Rosters, skater/goalie/team stats, game log → Supabase |
| `shot_events.py` | League-wide shot coordinates |
| `shift_data.py` | Shift charts |
| `zone_starts.py` | Per-player OZ/DZ/NZ start counts |
| `score_state.py` | Score-state ice time distribution |
| `rapm.py` | 3-year rolling ridge regression RAPM |
| `moneypuck.py` | WAR + percentiles + GSAX + xGF% |
| `power_rankings.py` | 32-team rankings + AI narratives (per-team KV cache) |
| `ai_scouting.py` | AI scouting blurbs for skaters + goalies (all 32 teams) |
| `special_teams.py` | PP/PK unit inference |
| `draft_ingest.py` | Live draft pick polling + AI analysis + one-time backfill (`/draft/picks/{year}/all`) for a completed draft |
| `tankathon_ingest.py` | 2026 pick order scraper |
| `milestones.py` | Nightly milestone detection (hat tricks, natural hat tricks, shorthanded goals, shutouts, season goal/point thresholds, career point/win thresholds via live NHL API lookup) → `milestones` table |

### Shared pipeline modules

| Module | Description |
|--------|-------------|
| `db.py` | Supabase client (`get_client()`, tuned `postgrest_client_timeout=120`), `NHL_SEASON` (live-resolved via `season_lookup.py` as of 2026-07, `.env` value now just a fallback), `PRIMARY_TEAM_ABBR`, batched `upsert()`. The canonical shared module — everything below imports from here rather than creating its own Supabase client. |
| `pipeline_common.py` | Everything `db.py` doesn't cover: `nhl_get()` (NHL API GET helper) and `get_logger()` (shared logging config). |
| `season_lookup.py` | Added 2026-07. Reads the current NHL/PWHL season from the Worker's `GET /config/seasons`, with the `.env` values as fallback if the Worker's unreachable. `db.py`, `pwhl_stats.py`, `pwhl_salaries.py` all consume this rather than resolving independently. See `eyewall-poller`'s README for the full resolution chain. |

`nhl_stats.py`, `draft_ingest.py`, `milestones.py`, `ai_context.py`, and `ai_scouting.py` all import from `db.py`/`pipeline_common.py` rather than duplicating Supabase client setup — consolidated after `draft_ingest.py` and `milestones.py` were briefly built against a since-retired standalone `pipeline_common.get_supabase()` before `db.py`'s existing role was accounted for.

### PWHL Pipeline Modules
| Module | Description |
|--------|-------------|
| `pwhl_stats.py` | Rosters, skater/goalie/team stats, special teams (PP%/PK%), game log with dates, Corsi/Fenwick from shot events. `TEAM_ID_MAP`/`CITY_TEAM_MAP` include the 4 expansion teams (2026-07). |
| `pwhl_pbp_events.py` | PBP events (faceoffs, hits, penalties) → `pwhl_pbp_events` |
| `pwhl_shot_events.py` | Shot events with coordinates → `pwhl_shot_events` |
| `pwhl_salaries.py` | PWHLPA PDF salary scraper → `pwhl_salaries` (190/194 player matches). `SEASON_LABEL` now derived from the live-resolved season (2026-07 fix — used to be separately hardcoded, same bug shape as `moneypuck.py`'s old `MP_URL`). |
| `pwhl_news.py` | RSS news fetcher → POST to Worker `/pwhl/news/ingest` |
| `pwhl_milestones.py` | Nightly milestone detection (hat tricks, natural hat tricks, shorthanded goals, shutouts, season goal/point thresholds, career point/win thresholds — no external API needed, unlike NHL's live lookup) → shared `milestones` table, `is_pwhl=true`. Thresholds tuned to real PWHL scoring volume, not scaled from NHL's. |

### PWHL Supabase Tables
`pwhl_players` (no season dimension — one row per player, current team assignment only), `pwhl_player_seasons`, `pwhl_goalie_seasons`, `pwhl_team_seasons` (incl. `pp_pct`, `pk_pct`, `corsi_for_pct`, `fenwick_for_pct`), `pwhl_game_log` (incl. `game_date`, `venue_name`, `venue_city`), `pwhl_shot_events`, `pwhl_pbp_events`, `pwhl_salaries`, `pwhl_teams` (team master — `pwhl_players.team_id` has a foreign key against this table; a new team_id must be seeded here first or roster upserts fail with a `23503` FK violation)

### PWHL Season ID Map
| ID | Season | Type |
|----|--------|------|
| 1 | 2023-24 | Regular |
| 3 | 2023-24 | Playoffs |
| 5 | 2024-25 | Regular |
| 6 | 2024-25 | Playoffs |
| 8 | 2025-26 | Regular |
| 9 | 2025-26 | Playoffs |
| 10 | 2026-27 | Pre-Season (current as of 2026-07; hidden from standings, no games yet) |

IDs 2, 4, 7 are real preseason entries confirmed via HockeyTech's `bootstrap` response (2026-07) — not missing/gapped as previously assumed here, just hidden from standings with little game data. Separately: `pwhl_stats.py`'s `SEASON_TYPE_MAP` labels ID 2 as `"showcase"`, but the real `bootstrap` response names it `"2024 Preseason"` — an unresolved discrepancy, not silently changed either way. See the pipeline README for detail.

### Pipeline GitHub Actions Workflows

| Workflow | Schedule | Description |
|----------|----------|-------------|
| `nightly.yml` | 3 AM ET daily | Full NHL pipeline (NHL-only after split) + `milestones.py` (runs after `python run.py`, once `game_scoring` is fresh) |
| `pwhl-nightly.yml` | 3:20 AM ET daily | PWHL PBP events + PWHL news (20 min offset to avoid Supabase contention) |
| `moneypuck-ingest.yml` | Nightly | MoneyPuck CSV fetch via GH runner |
| `reddit-ingest.yml` | Every 30 min | Reddit (32 subreddits) + SBNation atom feeds → Worker |
| `tankathon-sync.yml` | Weekly (Tue 8am ET) | Tankathon draft order scrape |
| `draft-ingest.yml` | Jun 26 + Jun 27 | Live NHL draft pick polling loop |

---

## Testing

### Vitest (179 tests, 13 files)
```bash
npm test
npm run test:watch
```

### Cypress (E2E)
```bash
npm run cypress:open
npm run cypress:run
npm run cypress:full    # Clean → run → HTML report
```

### Visual regression (Tailwind migration, Session 94)
```bash
npm run cypress:visual:baseline   # (re)generate baseline screenshots -- run this after a verified, intentional visual change
npm run cypress:visual            # diff current rendering against the committed baselines
```
48 baseline screenshots (`cypress/snapshots/base/`, committed) covering every NHL + PWHL route × mobile/desktop × dark/light. These routes hit the live Worker API with no fixture seeding, so a small amount of pixel drift between a baseline capture and a diff run is expected (real content changing, not a bug) — `errorThreshold: 1` (%) in `cypress/support/e2e.js` absorbs that noise; a real layout/spacing/color regression runs far higher and still fails. Intended workflow: capture a baseline immediately before a migration phase, diff immediately after.

**28 spec files** (none of them cover AHL or ECHL yet — see [Known Limitations](#known-limitations) — the two newest leagues' only automated coverage is Vitest-level, `seasonComparison.test.js`'s AHL/ECHL season-label tests):

**Note (2026-08, Session 94):** `visual-regression.cy.js` added as part of Phase 0 of the full Tailwind migration (see `SESSION_94_FINDINGS_tailwind_migration.md`) — the parity-verification tooling that migration's later phases depend on.

**Note (2026-08, Session 93):** `auth.cy.js`, `trivia.cy.js`, and `read-state-badges.cy.js` added, closing the gap flagged when Sessions 90-92 first shipped Auth/Trivia/Badges with zero automated coverage. `auth.cy.js` intercepts the Supabase Auth OTP request rather than hitting it for real (avoids sending a real email against Resend's rate limit on every CI run) and exercises the signed-in UI state via an injected fake session, matching supabase-js's own storage shape, rather than a real sign-in. `trivia.cy.js`/`read-state-badges.cy.js` stub `/trivia/today` with fixture questions — same reasoning as `draft.cy.js` stubbing `/draft/*`: deterministic, and NHL genuinely has zero real trivia data outside the regular season.

**Note (2026-07, Session 38):** the PWHL expansion coverage gap flagged below (Session 34, carried through Session 37) is now closed. `navigation.cy.js`, `pwhl-schedule.cy.js`, and `pwhl-shot-map.cy.js` smoke-test all 12 PWHL teams; `pwhl-team.cy.js` and `pwhl-players.cy.js` add an explicit expansion-team (DET) case asserting the correct empty state (no games played yet — see [Known gaps](#known-gaps)); `pwhl-league.cy.js`'s standings/leaders tests are scoped to the 8 established teams on purpose, with an explicit assertion that expansion teams are *not* yet present (real data fact, not a bug); `TeamPicker.cy.js` is new and covers all 12 teams rendering as selectable with real brand colors.

| Spec | Coverage |
|------|---------|
| `auth.cy.js` | Sign-in flow — signed-out row, two-step email form, OTP request/error handling (intercepted), signed-in row (avatar/email/Synced badge, via an injected fake session), sign-out |
| `trivia.cy.js` | Daily Trivia tab — three tier cards, team logo (not team name) on medium, answer/reveal flow, aggregate stats, empty state, PWHL smoke |
| `read-state-badges.cy.js` | Unseen-content dots — News/Milestones/Trivia tab dots, BottomNav's combined dot, Trivia clearing only on answer vs. News/Milestones clearing on visit |
| `navigation.cy.js` | NHL routes + PWHL 12-team smoke (all 7 PWHL routes) |
| `news.cy.js` | NHL news, source filters |
| `milestones.cy.js` | Milestones feed, team filter dropdown, card structure, tap-to-open player popup |
| `player-search.cy.js` | Global player search — open/close, debounce, typo tolerance, NHL+PWHL result correctness, popup opens for both |
| `player-comparison.cy.js` | Player vs Player Comparison — "vs Player" entry point vs. the existing season-over-season Compare tab, same-league search scoping/self-exclusion, NHL skater comparison (radar + all 4 tabs), NHL + PWHL goalie comparison (own 3-tab set each, PWHL unblocked 2026-08), PWHL skater comparison, goalie-vs-skater hard block, F-vs-D position-mismatch badge, tab-click and radar-squeeze regressions |
| `pwhl-news.cy.js` | PWHL news, source chips, article list |
| `period-summary.cy.js` | Game Center, period/game summary popups |
| `players.cy.js` | NHL roster, skater/goalie cards (4 teams) |
| `pwhl-players.cy.js` | PWHL roster, stats, player popup (4 established teams) + 1 expansion team (empty stats state) |
| `schedule.cy.js` | NHL schedule, predictions |
| `pwhl-schedule.cy.js` | PWHL schedule smoke (12 teams), full features (BOS), playoffs tab |
| `shot-map.cy.js` | NHL shot map, all sections; season/game history selector (chips, "More seasons" overflow, Reg/Playoffs toggle), disabled+tooltip state during a live game |
| `pwhl-shot-map.cy.js` | PWHL shot map smoke (12 teams), full features (BOS), PBP metrics, Reg/Playoffs toggle |
| `pwhl-shots-live.cy.js` | PWHL + NHL shot map live-mode debug panel, goal/penalty/win popups, situation chips |
| `pwhl-dev.cy.js` | PWHL dev game replay scrubber |
| `team.cy.js` | NHL 6 tabs (4 teams incl. Cap + Picks) |
| `pwhl-team.cy.js` | PWHL 5 tabs (4 established teams incl. Salaries) + 1 expansion team (empty-state across Splits/Trends/Salaries) |
| `league.cy.js` | NHL 5 tabs |
| `pwhl-league.cy.js` | PWHL 5 tabs incl. Draft (72 picks); standings/leaders scoped to established teams, expansion absence asserted |
| `draft.cy.js` | NHL draft board |
| `TeamPicker.cy.js` | Sport + team picker — all 12 PWHL teams selectable, real colors |
| `theme.cy.js` | Light/dark mode |
| `topnav-safe-area.cy.js` | Topbar safe-area regression (mobile viewports) |
| `viewports.cy.js` | 4 viewports × all views |
| `visual-regression.cy.js` | Pixel-level baseline screenshots — every NHL + PWHL route × mobile/desktop × dark/light (48 total); parity evidence for the Tailwind migration |

---

## Local Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test
npm run build
```

**Required `.env.local`:**
```
VITE_WORKER_URL=https://eyewall-poller.billowing-queen-bf23.workers.dev
VITE_VAPID_PUBLIC_KEY=BHuReh0oBGitFpWQpzEkxM-0m2XHxDX3hqfvX6lpA-IfKSivoB892Jvs64Uz7oNOF-NvDIpPeeBAcWwsIRpnKX4
VITE_POSTHOG_KEY=phc_...
VITE_SUPABASE_URL=https://mqgasjzywoibdgxjjkux.supabase.co
VITE_SUPABASE_ANON=sb_publishable_...
```
`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON` (Session 90) back `supabaseAuth.js` only — both have hardcoded fallback literals in that file (a publishable key, safe to expose client-side by design), so local dev works even without setting them explicitly.

**Dev tools:**
- `http://localhost:5173/dev` — live game replay scrubber
- `http://localhost:5173/dev/draft` — draft simulator

---

## Deployment

**App:** push to `dev` → verify → merge to `main` → auto-deploys to Cloudflare Pages.

**Worker:** edit `worker.js`, paste into Cloudflare Workers dashboard → Deploy.

**October season prep checklist:**

**Most of this is now automatic (2026-07)** — see [Live Season Resolution](#live-season-resolution). What's left:

1. ~~Update `CURRENT_SEASON` in `teamConfig.js`~~ — automatic now, live-resolved at app boot
2. ~~Update `PWHL_CURRENT_SEASON` in `pwhlConfig.js`~~ — automatic now
3. ~~Update `NHL_SEASON` and `PWHL_SEASON` GitHub Actions secrets~~ — fallback-only now, safe to leave stale
4. ~~Update `MP_SEASON` in `moneypuck.py`~~ — automatic now, derived from `NHL_SEASON`
5. Update `OFFSEASON_BRACKET` in `LeagueView.jsx` — **still manual**, not touched during the 2026-07 season-resolution work
6. ~~Add PWHL expansion team IDs to `pwhlConfig.js`~~ — done 2026-07 (DET=10, HAM=11, LV=12, SJS=13)
7. Review Dependabot PRs (ESLint 10, Vite 8, supabase 2.31.x) — still manual, unrelated to season resolution
8. **New for future expansion waves:** if HockeyTech assigns another new team_id, remember: `pwhl_teams` needs the new team_id seeded before roster fetches succeed (FK constraint), roster data needs the literal current/preseason season_id rather than the "current regular season" default, and bust the Worker's KV cache only *after* confirming the data is actually correct — not before. All three cost real debugging time during the 2026-07 rollout; see `eyewall-poller` and `eyewall-pipeline` READMEs for the full story.

---

## Known Limitations

- **Cron minimum:** 1-minute polling — live NHL data is 0–60s behind the API.
- **PWHL news:** RSS feeds block Cloudflare datacenter IPs. GH Actions runner fetches and POSTs to Worker. Low volume in offseason; improves when season starts.
- **PWHL Corsi/Fenwick:** No missed shot data in HockeyTech — FF% is SOG-based proxy, not true Fenwick.
- **PWHL PDO (playoffs):** Requires playoff player-level shot data not yet separated in pipeline. Regular season PDO only.
- **PWHL Analytics tab:** Post-launch work — requires building PWHL xG model and WAR equivalent.
- **Cap data:** NHL API doesn't expose salary. Static file requires manual updates.
- **iOS push:** Requires Add to Home Screen — browser Safari cannot receive Web Push.
- **WAR/RAPM:** Beta — zone-start OZS% still being refined. Non-CAR players have high variance.
- **Reddit ingest:** Blocked by Reddit on GH Actions IPs. Deferred to October.
- **X/Twitter posting:** Built but requires Basic tier ($100/mo).
- **PWHL expansion team logos/names:** Real colors and roster data are live (2026-07), but logos and permanent team names are still placeholders — no official branding revealed yet. Expected this fall.
- **PWHL expansion teams have no games yet (confirmed 2026-07 against the live Worker):** DET/HAM/LV/SJS have real rosters but empty schedule/skater-goalie-stats/standings/salaries until the 2026-27 season starts. Every data-driven view handles this gracefully (`PWHLScheduleView`, `PWHLShotMapView`, `PWHLPlayersView`'s Stats tab, and `PWHLTeamView`'s Splits/Trends/Salaries tabs all show an explicit empty-state message) — except `PWHLTeamView`'s Advanced tab, which shows "Loading advanced stats…" permanently for these teams instead of an explicit no-data message, since it early-returns on a missing standings row rather than distinguishing "still loading" from "no row will ever exist yet." Worth a copy fix, not covered by Cypress on purpose (would be asserting on a known-misleading string).
- **Cache-busting order matters (learned 2026-07):** busting the Worker's KV cache *before* confirming the underlying data fix has actually landed just repopulates the same stale/empty entry. Always confirm the data first, then bust.
- **Auth/Trivia/Badges test coverage (Session 93):** `favoriteTeamSync.js`/`triviaAnswers.js` have Vitest coverage (supabaseAuth mocked via `vi.mock`; localStorage/window stubbed via `vi.stubGlobal` since this repo's Vitest runs under `environment: 'node'`, not jsdom — see `src/utils/__tests__/testHelpers/mockSupabaseAuth.js`). `AuthContext.jsx`/`useReadState.js` (React hooks) are covered at the Cypress layer instead (`auth.cy.js`, `trivia.cy.js`, `read-state-badges.cy.js`) rather than adding a `@testing-library/react` dependency for hook-level unit tests.
- **Hard-tier trivia has no ongoing content pipeline:** only the 2 questions seeded for Session 92's live verification exist. No admin UI in v1 (intentional) — new hard questions need direct Supabase SQL editor inserts.
- **HockeyTech `bootstrap` feed type:** it's `feed=statviewfeed`, not `feed=modulekit` — the latter returns a 200 OK with no real payload, which silently masqueraded as a working fallback for a while. If a HockeyTech URL is built from a written description rather than a captured real request, verify against actual DevTools traffic before trusting it.
- **PWHL season resolution prefers regular seasons over playoffs, deliberately:** almost every `/pwhl/*` Worker endpoint filters `season_type=eq.regular` downstream, so resolving to a playoffs-type season_id breaks every PWHL view even for teams that played in that postseason. Shipped once without this preference and broke Cypress across every PWHL view before being caught.
- **Milestone card titles never truncate (pre-existing, found during the Tailwind migration):** `MilestoneCard`'s `<h3>` combines two classes whose original CSS both set `display` — `.news-card-title`'s 3-line clamp (`display: -webkit-box`) loses to `.milestone-card-title`'s `display: flex`, which wins since it's defined later in the same stylesheet. The Tailwind migration (Phase 4, sub-PR 4) deliberately preserved this exact behavior rather than silently fixing it as a migration side effect — see `src/utils/newsViewClasses.js`'s `MILESTONE_CARD_TITLE_CLASSES` comment. If milestone titles should actually truncate, that's a real fix to make deliberately, not something to rediscover as a regression.
- **AHL/ECHL have zero Cypress E2E coverage** — no `*.cy.js` spec file references either league anywhere in `cypress/e2e/`, unlike PWHL's own 12+ dedicated/shared specs. The one piece of automated coverage either league has is Vitest-level: `seasonComparison.test.js`'s `ahlSeasonLabel`/`echlSeasonLabel`/`normalizeComparisonSeasons('ahl'/'echl')` tests (added as a byproduct of the season-label formatting bug found during ECHL's Phase 4). Live-tracking (Phase 6) for both leagues has been verified only via the dev-only debug panel (see [AHL & ECHL Frontend Build](#ahl--echl-frontend-build)), not against a real game — neither league's 2026-27 season had started as of this writing.
- **AHL's push-notification settings panel (`NotificationBell.jsx`) has no ECHL branch, and neither league has a real push backend**: `activeTeam`/`leagueTeamKey`/the header `TeamLogo`'s `sport` prop are all still a 3-way `isPWHL ? ... : isAHL ? ... : NHL` ternary with no `isECHL` case — an ECHL user opening notification settings currently sees/acts on the NHL team's info, the same bug class documented above for other cross-cutting files, just not yet caught for this one. Separately, AHL's own branch exists structurally ("shows the right team") but there is no live-game-tracking Worker route wired to actually send a push for either league — subscribing has nothing to notify about server-side yet either way.
- **AHL expansion/relocation team colors — one gap remains**: 31 of 32 AHL teams have real, WCAG-checked colors; Ontario Reign's June 2026 rebrand ("Inland Blue"/"Empire Gold") has no published hex anywhere checked (official press release, Mayor's Manor, teamcolorcodes.com all still show the pre-rebrand scheme) — correctly left on the shared neutral placeholder rather than guessed.
- **ECHL real team colors are a full deferred follow-up**: all 30 teams currently render on one shared neutral placeholder — unlike AHL, where this was closed out for 31/32 teams in a dedicated follow-up pass. Matches AHL's own two-pass history (colors landed well after AHL's initial display shipped), not an oversight.
- **HockeyTech logo asset versioning (AHL and ECHL both)**: neither league's team logos follow a bare `{teamId}.png` URL pattern — a rebrand gets a season-id-suffixed filename (e.g. `335_94.png`) with no reliable bare-filename alias kept. Both `AHL_LOGO_FILES`/`ECHL_LOGO_FILES` are hand-built from the feed's own `team_logo_url` field per team; re-pull and update either map on a future season flip if new 404s show up (9/32 AHL teams and 4/30 ECHL teams needed the suffixed form as of the last check).

---

## Offseason Roadmap

### Completed this offseason
- [x] PWHL full analytics suite (Shot Map, Schedule, Players, Team, League, News)
- [x] PWHL pipeline (stats, PBP events, shot events, salaries, news)
- [x] PWHL salary data from PWHLPA PDF (190/194 player matches)
- [x] PWHL Corsi/Fenwick from shot events
- [x] PWHL special teams (PP%/PK%) from HockeyTech
- [x] PWHL L10 + streak in standings
- [x] PWHL 2026 draft tab (72 picks, 12 teams) + 2025 draft
- [x] PWHL power rankings (5-factor formula with CF%)
- [x] PWHL playoff bracket with series modal
- [x] PWHL player heat maps + AI scouting
- [x] Sport picker (NHL/PWHL) with full team picker
- [x] Cypress tests for all PWHL views (20 spec files total)
- [x] ESLint clean (0 errors, 0 warnings) — maintained throughout offseason
- [x] xGF% per-game sparkline on Advanced tab (L10 / Season toggle, hover tooltip)
- [x] Per-team AI narrative KV caching (carAbbr in key — all 32 teams get own perspective)
- [x] AI scouting blurbs for goalies (goalie-specific prompt, GSAX/SV% metrics)
- [x] Goalie heat map car_game filter removed (now shows all shots faced, not just CAR games)
- [x] PWHL/NHL sport switching bug fixed (hasTeamConfig sport-aware, correct root redirect)
- [x] Period summaries centered modal (not bottom sheet)
- [x] ShareButtons centered across all export cards
- [x] Power rankings AI narrative fixed (CF API key + Workers AI permission scope)
- [x] DevReplayView Clear & Reset button + auto-clear session keys on game load
- [x] PWHL news pipeline fixed (1 → 22 articles/run; Women's Hockey Life + OurSports Central)
- [x] Share buttons unified across all 5 export card types (useShareCard hook)
- [x] NHL Draft Board shipped (Sessions 19-20)
- [x] Hat trick live popup (NHL + PWHL) — Phase A complete
- [x] Hat trick badge in period/game summary cards (natural hat trick detection) — Phase B complete
- [x] Hat trick / milestones pipeline + feed — Phase C complete: `milestones.py` nightly detection (hat tricks, natural hat tricks, SH goals, shutouts, season goal/point thresholds, career point/win thresholds via live NHL API lookup), `/milestones` + `/player/landing` Worker endpoints, league-wide Milestones tab on News page with team-logo filter dropdown, tappable into PlayerPopup
- [x] Draft pick field-name bug fixed (`firstName`/`lastName` are top-level `{"default": ...}` objects, not nested under `prospect`/`draftedPlayer` — was silently writing blank names for all round-1 picks) + one-time `--backfill-picks` mode using `/draft/picks/{year}/all`
- [x] Cloudflare KV cache TTL bug fixed (empty results were getting the 24hr branch instead of 60s — could pin a stale/empty snapshot for a full day)
- [x] `draft-ingest.yml` KV purge step fixed (was calling the wrong Cloudflare endpoint — `/keys/` instead of `/values/` — silently never worked)
- [x] Shared pipeline modules consolidated — `draft_ingest.py`, `milestones.py`, `ai_context.py`, `ai_scouting.py` now all use `db.py`'s `get_client()` instead of each duplicating Supabase client setup
- [x] Live season resolution (2026-07) — `NHL_SEASON`/`PWHL_CURRENT_SEASON`/etc. no longer need a yearly manual flip across 3 repos. Worker's `seasons.js` resolves live from NHL/HockeyTech APIs, exposed via `GET /config/seasons`; frontend (`seasonClient.js`) and pipeline (`season_lookup.py`) both read from it with fallback. Caught and fixed two real bugs along the way: a wrong HockeyTech feed type (`modulekit` vs `statviewfeed`) that silently masked all along, and a season-type mismatch (playoffs vs regular) that broke every PWHL view in production before being caught via Cypress.
- [x] PWHL expansion teams (DET, HAM, LV, SJS) fully wired 2026-07 — HockeyTech IDs, real rosters (confirmed via direct HockeyTech fetches), real WCAG-checked colors from each team's own `*_colors.css`, `TeamPicker` selectable (fixed a real bug where it had its own hardcoded active/expansion list, ignoring `comingSoon` entirely)
- [x] Vitest test suite added for `eyewall-poller` (previously had zero test infrastructure) — covers `seasons.js`'s resolution logic, including regression tests for both bugs found above
- [x] Cypress PWHL expansion team coverage gap closed (2026-07, Session 38) — `navigation.cy.js`/`pwhl-schedule.cy.js`/`pwhl-shot-map.cy.js` smoke all 12 teams; `pwhl-team.cy.js`/`pwhl-players.cy.js` add an expansion-team (DET) case asserting the correct empty state; `pwhl-league.cy.js` standings/leaders explicitly assert expansion teams are absent (real data fact — no games played yet, not a bug); new `TeamPicker.cy.js` covers the Session 34 `comingSoon` bug with an actual regression test (previously had zero coverage)
- [x] Player vs Player Comparison (Session 91, NHL + PWHL) — "vs Player" entry point on both player popups, same-league Fuse.js search, two-series Recharts radar (position-agnostic NHL skater set reused as-is; new 6-axis NHL goalie set; new thinner 4-axis PWHL skater set), tabbed detail reusing the shared `StatTileGrid`. First and only Tailwind consumer in the codebase (utilities-only, no preflight, so it can't leak into the rest of the app's plain-CSS components). `player-comparison.cy.js` added, 16 tests.
- [x] Supabase Auth magic-link sign-in (Session 90) — optional, fully additive passwordless sign-in via `signInWithOtp`. New Account section in Settings (`AccountSection.jsx`), `AuthContext.jsx` mirroring `SportContext.jsx`'s pattern, `user_preferences` table with `auth.uid()`-scoped RLS validated live with two real accounts. Custom SMTP (Resend) configured for email delivery.
- [x] Favorite-team sync for signed-in users (Session 91) — write-on-switch + reconcile-on-session-load, verified live in both directions (first-sign-in upload, second-device server-wins). Found and fixed a real bug during live testing: reconciliation was silently defeating the "Change team" button for signed-in users.
- [x] Daily Trivia (Session 92, NHL + PWHL) — three tiers (easy/medium AI-generated with a verified-value guardrail, hard hand-curated), new Trivia tab on the News page, union-merge answer sync for signed-in users, read-state badges on News/Milestones/Trivia + `BottomNav`. Found and fixed two real guardrail bugs during live generation (a misread team abbreviation, then a hallucinated team-name substitution even when given the correct name) — team identity is now conveyed via a logo, never AI-generated text.
- [x] AHL added as the 3rd league (2026-08) — foundation display pass (Shot Map/Schedule/Players/League standings-leaders), then brought to full 6-phase parity with PWHL (player popups, game popups/predictions, team comparison, news, live tracking) — see [AHL & ECHL Frontend Build](#ahl--echl-frontend-build) for the complete phase-by-phase history. 31/32 teams have real WCAG-checked colors; found and fixed a wrong-season data gap (the actual 2025-26 regular season had zero rows anywhere in Supabase, only the playoffs season had ever been ingested), the shared `useFetch` out-of-order-response race, and a JSONP-unwrap bug that had been silently breaking most AHL roster fetches for months (root-caused while building ECHL, not from AHL's own debugging).
- [x] ECHL added as the 4th league (2026-08) — same HockeyTech vendor as AHL/PWHL, staged the same two-pass way AHL itself was (foundation first, user's explicit choice), then brought to the same full 6-phase parity as AHL within the same session. Found and fixed the Web Push NUL-byte encryption bug (`shared.js`'s `encryptPushPayload()`, unrelated to ECHL itself but discovered while building it), plus a real pre-existing bug where `/config/seasons/comparison` never actually built an `ahl` key despite a code comment claiming it did — AHL's own "Compare Seasons" mode had been silently empty in production since its own Phase 4 shipped.

### Pending
- [x] French/English localization — **Track A (UI chrome) complete.** `i18next`/`react-i18next` infra, `localeConfig.js`/`localeSync.js`, Settings-popup Language toggle, and every view/component/popup in the app's tree — 30 A2 sub-PRs total — are now fully translated: global chrome, `LeagueView.jsx`+`PWHLLeagueView.jsx`, `TeamView.jsx`+`PWHLTeamView.jsx`, `PlayersView.jsx`+`PWHLPlayersView.jsx`, `ShotMapView.jsx`+`PWHLShotMapView.jsx`, `GameEvents.jsx`+`PWHLGameEvents.jsx`, `ScheduleView.jsx`+`PWHLScheduleView.jsx`, `GameCard.jsx`+`CalendarView.jsx`+`PWHLCalendarView.jsx`, `MatchupDetail.jsx`+`PWHLGamePreviewPopup.jsx`, `GameStatsPopup.jsx`+`GameStatsComponents.jsx`+`PWHLGameStatsPopup.jsx`+`PWHLBoxScoreTable.jsx`, `TriviaFeed.jsx`, `StatTileGrid.jsx`, `MilestonesFeed.jsx`, `NewsView.jsx`+`PWHLNewsView.jsx`, `PredictionShareCanvas.jsx`+`PWHLPredictionShareCanvas.jsx`+`ShareButtons.jsx`, `ScoutingTab.jsx`, `PeriodSummary.jsx`, `PWHLPeriodSummary.jsx`, `PlayerPopup.jsx`, `PWHLPlayerPopup.jsx`, `AboutPopup.jsx`, `PlayerSearch.jsx`, `App.jsx`, `InfoTip.jsx`, `SeasonTypeToggle.jsx`, `SeasonChipRow.jsx`, `GameChipsRow.jsx`, `TeamOpponentPicker.jsx`, `SeasonOverlayChart.jsx`, `LiveEventRink.jsx`, `PlayerComparisonEntry.jsx`, `SeasonComparisonPicker.jsx`, `TeamPicker.jsx`, `PlayerComparisonPopup.jsx`, `TeamComparisonPopup.jsx`, and now `DraftTab.jsx`. The final sub-PR covers `DraftTab.jsx`'s draft popup (bio grid, pick context, rank badges, the "Sticks says" AI section — first use of `Trans`/`components={{ strong: <strong /> }}` for a JSX-embedded tag in this migration's own new keys, matching the pattern `PWHLTeamView.jsx` had already established), the Rankings table and category tabs (`getCategoryLabel()` helper shared between `DraftTab` and `DraftPopup`, replacing a plain `label` field so both components can independently call their own `useTranslation()`), the Draft board's per-round tables, and the pre-draft/live/complete banners. Heavy reuse from already-translated files: `playerPopup.bio.height/weight/weightLbs`, `pwhlLeagueView.draft.colTeam/colPos`, `teamView.picks.roundLabel`, `nav.league`, `common.close`, and `leagueView.loading.ariaLabel` (not `common.loading`, since that key's "Loading…" isn't byte-identical to this file's ellipsis-free "Loading" aria-label). All 41 keys (including the dynamic per-category keys and the `Trans` key) audited to resolve in both locale files; ESLint and the full vitest suite (185/185) clean; `league.cy.js` (34/34) and `draft.cy.js` (55/55) both green after ruling out an interleaved dev-server crash as the session's known local-sandbox instability, not a regression. Live-verified extensively in French: the full 7-round, 224-pick draft board, the 4-category Rankings table with live counts, and both popup modes (prospect and pick, the latter showing a live AI scouting blurb under "STICKS DIT"). **This closes Track A of the localization plan — every user-facing view, popup, and shared component in the app now renders in French.** `DevReplayView.jsx`/`PWHLDevReplayView.jsx`/`DevDraftView.jsx` remain deliberately untranslated — dev-only routes gated behind `import.meta.env.DEV`, never shipped to real users.
- [x] French/English localization — **Track A completeness follow-up.** A fresh full-codebase audit after declaring Track A done (learning from a past "last file" claim in this same migration that turned out to miss a second leftover) found 3 real gaps, all now fixed: `ShotMapView.jsx`'s live Event Log ticker had 8 hardcoded English badge labels (GOAL/SHOT/HIT/etc.) plus several sub-text fragments ("hit {{name}}", "won vs {{name}}", "drawn by {{name}}", "{{n}} min", zone labels) that were missed during that file's original translation pass — reuses `shotMapView.ppkShared.assists`/`gameStatsPopup.goals.unassisted` byte-for-byte, mints a new `shotMapView.eventLog.*` namespace for the rest (raw NHL API values like shot type and penalty description stay untranslated, matching this migration's established policy for external data, not UI copy); `BottomNav.jsx` had one isolated hardcoded `aria-label="Main navigation"` despite using `useTranslation()` everywhere else in the file; `PWHLShotMapView.jsx` had a hardcoded "No PWHL team selected." empty-state guard (reused `pwhlTeamView.noTeamSelected` byte-for-byte). Also found and fixed two more latent `t`-shadowing hazards in `ShotMapView.jsx` (a `const t = playTimeSecs(p)` and a `for (let t = ...)` loop variable, both inside `MomentumCard`, renamed to `evtTime`/`sampleT`) — no functional bug today since neither called `t()` internally, but the same latent-confusion shape fixed proactively elsewhere this migration. **Found and fixed a real, unrelated production bug along the way, not a translation issue:** `ShotMapView.jsx`'s "5 taps on score bar" debug panel — a comment literally says "dev only" — had no actual `import.meta.env.DEV` gate anywhere, unlike its PWHL sibling (`PWHLShotMapView.jsx`, correctly gated) — meaning any production user could reveal internal debug tooling via the tap gesture, including a "Test Push" button hitting a hardcoded secret endpoint. Fixed by mirroring PWHL's exact gating pattern (`if (!import.meta.env.DEV) return` in the tap handler, `import.meta.env.DEV &&` on the panel's render condition). All keys resolve in both locale files; ESLint and the full vitest suite (185/185) clean; `shot-map.cy.js` (48/48), `pwhl-shot-map.cy.js` (48/48), and `pwhl-shots-live.cy.js` (25/25) all green. Live-verified in French via the `?mockGame=<id>` dev trigger: 4 of the 8 Event Log badge types confirmed rendering correctly against a real completed game's play-by-play (BLOQUÉ/MISE AU JEU/TIR/REVIREMENT with correctly-interpolated sub-text), plus the `BottomNav` aria-label fix.
- [x] French/English localization — **Track B (AI-generated narrative content) complete.** `game_summaries`/`player_scouting`/`player_narratives`/`trivia_questions` (`eyewall-pipeline`) each carry a `locale` column now, widened into each table's upsert conflict key (Phase B0). All 4 AI-generation scripts default to generating both `en`/`fr` per run, going forward only — no historical backfill (Phase B1). `eyewall-poller`'s `/game-summary`, `/player-scouting`, `/player-results-vs-process`, and `/trivia/today` routes accept a `?locale=` param, filtering the Supabase query and suffixing the KV cache key so both languages cache independently (Phase B2 backend). This repo's own piece of Phase B2: `PeriodSummary.jsx`'s DB-first game-summary lookup, `supabaseClient.js`'s `getScoutingBlurb()`/`getResultsVsProcessNarrative()`, and `TriviaFeed.jsx` all now pass `i18n.language` as `locale` — reactive, so a mid-view language toggle refetches trivia and any not-yet-cached scouting/results-vs-process blurb live (game-summary narratives don't refetch once `summary.aiNarrative` is already set by the parent — a pre-existing caching guard, not revisited here). Live-verified end-to-end against the deployed Worker: toggling to French in Settings sent `locale=fr` on the wire and the Trivia tab's hard tier correctly switched to its empty state, matching the documented gap (hard-tier rows are hand-curated and all default to `locale='en'` — no French hard content exists yet). Known gap flagged, not fixed here: `PeriodSummary.jsx`'s DB lookup calls Supabase directly rather than through the Worker (a pre-existing architectural exception found while doing this work, unrelated to locale) — see the spawned follow-up task.
- [ ] PWHL Analytics tab (xG model, WAR equivalent) — post-launch
- [ ] PWHL PDO in playoffs (needs playoff player shot data)
- [ ] Reddit ingest fix — October
- [ ] PuckPedia integration (contracts + future picks, all 32 teams)
- [ ] ~~`app_config` Supabase table to eliminate hardcoded season constants~~ — **solved differently, 2026-07:** ended up as Worker-resolved + KV-cached (`seasons.js` + `GET /config/seasons`) rather than a Supabase table. Same goal, different mechanism — closing this out rather than leaving it looking unstarted.
- [ ] Season-over-season player comparison
- [ ] Standings clinching indicators
- [ ] Capacitor PWA wrapper for App Store / Play Store
- [ ] Dependabot: supabase 2.31.x, ESLint 10, Vite 8 (October)
- [ ] October: bump `OFFSEASON_BRACKET` — the only one of these four left after 2026-07's live season resolution work; `CURRENT_SEASON`/`PWHL_CURRENT_SEASON`/`NHL_SEASON` no longer need a manual bump
- [x] ~~PWHL milestones (hat tricks, shutouts, etc.) — deferred pending PWHL schema confirmation~~ — actually shipped some time ago (`pwhl_milestones.py`, same shared `milestones` table as NHL) but this roadmap line was never checked off; caught during the 2026-08-13 milestones staleness/`sh_goal` naming-mismatch investigation
- [ ] `ai_summaries.py`/`ai_predictions.py` appear to run twice nightly — once inside `run.py`'s `run_all()`, again via `ai_pipeline.yml`'s separate cron an hour later. Worth confirming whether that's intentional redundancy or wasted GH Actions minutes / duplicate OpenRouter calls.
- [ ] Migrate remaining pipeline scripts (`ai_summaries.py`, `ai_predictions.py`, `moneypuck.py`, etc.) to `db.py`/`pipeline_common.py` if they don't already use them
- [ ] Expansion team logos/permanent names — still placeholders, waiting on official branding reveal (likely this fall)
- [ ] `pwhl_stats.py`'s `SEASON_TYPE_MAP` labels season ID 2 as `"showcase"`, but HockeyTech's own `bootstrap` response calls it `"2024 Preseason"` — unresolved discrepancy, worth checking against real 2024 game data before changing either one
- [ ] ECHL real per-team colors — all 30 teams still on the shared neutral placeholder; a genuine research task (colors + a WCAG-AA contrast pass), same as AHL's own colors were before its dedicated follow-up pass
- [ ] AHL's one remaining color gap — Ontario Reign's June 2026 rebrand has no published hex anywhere yet; revisit once real branding is documented somewhere
- [ ] Live-game verification for AHL and ECHL against a real game — both leagues' live-tracking (Phase 6) has only been verified via the dev-only debug panel; AHL's 2026-27 season starts 2026-10-02, ECHL's hadn't started as of this writing either. Worth a deliberate live-game check-in once either season opener passes, rather than assuming the debug-panel verification generalizes perfectly.
- [ ] Cypress E2E coverage for AHL and ECHL — currently zero spec files for either league (only Vitest-level `seasonComparison.test.js` coverage exists), unlike PWHL's dedicated + shared spec coverage
- [ ] `NotificationBell.jsx`'s missing `isECHL` branch (`activeTeam`/`leagueTeamKey`/header `TeamLogo` sport prop all still 3-way NHL/PWHL/AHL only) — an ECHL user's notification settings panel currently shows/acts on the NHL team's info instead

---

## Disclaimer

EyeWall Analytics is an independent, fan-built analytics project and is not
affiliated with, endorsed by, or sponsored by the National Hockey League
(NHL), the Professional Women's Hockey League (PWHL), or any of their
member teams. All team names, logos, and related marks are the property of
their respective owners and are used here for informational and editorial
purposes only.

---

*Built with 🌀 for hockey fans*
