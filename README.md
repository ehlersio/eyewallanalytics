# EyeWall Analytics

> Advanced NHL analytics for all 32 teams — live shot maps, period summaries, momentum tracking, special teams analysis, push notifications, AI-generated game summaries, player heat maps, goalie analytics, WAR/percentile rankings, AI-powered league power rankings, and live draft board.

**Live at:** [eyewallanalytics.com](https://eyewallanalytics.com)  
**Contact:** matt@eyewallanalytics.com  
**Support the project:** [buymeacoffee.com/mattehlers](https://buymeacoffee.com/mattehlers)

---

## Overview

EyeWall Analytics is a React PWA delivering real-time and historical NHL data entirely from the public NHL API and MoneyPuck. It combines live polling, a Cloudflare Worker caching layer, Web Push notifications, Workers AI-generated period/game summaries and matchup analysis, player shot heat maps, MoneyPuck-powered WAR/percentile analytics, true RAPM via ridge regression, AI-powered nightly power rankings, and a live draft board with Central Scouting rankings and AI pick analysis into a mobile-first experience for hockey fans who want to go deeper than the box score.

Users select their team on first launch — all views, colors, and data scope to the selected team. The team and theme preference are persisted to `localStorage` and applied on every subsequent load.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite, react-router-dom v7 |
| Styling | CSS custom properties (design tokens), no CSS framework |
| Charts | D3 v7, SVG-based IceRink component |
| Hosting | Cloudflare Pages (auto-deploys from `main`; `dev` branch → preview) |
| API Proxy | Cloudflare Pages Functions (`functions/`) |
| Cache Layer | Cloudflare Worker + KV (`eyewall-poller`) |
| Database | Supabase Pro (player/team/goalie stats, shot events, RAPM, game xG, power rankings, draft data) |
| Data Pipeline | Python (`eyewall-pipeline`) — NHL API + MoneyPuck + Tankathon → Supabase |
| Pipeline CI | GitHub Actions — nightly data cron (3 AM ET) + AI pipeline + draft day ingest |
| Push Notifications | Web Push API (VAPID), Service Worker |
| AI Summaries | Cloudflare Workers AI — `@cf/meta/llama-3.1-8b-instruct-fp8-fast` (period/game summaries, predictions, matchup analysis, scouting blurbs, power rankings narratives, draft pick analysis) |
| Analytics Data | MoneyPuck.com CSV (fetched nightly by pipeline) |
| Draft Data | NHL Central Scouting API (rankings) + NHL API (live picks) + Tankathon (2026 pick order) |
| User Analytics | PostHog (anonymous event tracking, cookieless) |
| Data Source | NHL public API (no authentication required) |
| Cap Data | Static `carContracts.js` (source: PuckPedia) |
| Accessibility | WCAG 2.1 AA compliant (Section 508) |
| Testing | Vitest (unit tests), Cypress (E2E), GitHub Actions CI |

---

## Repository Structure

```
canes-analytics-starter/
├── index.html                    # PWA entry point, manifest links
├── public/
│   ├── sw.js                     # Service worker (Web Push handler)
│   ├── manifest.json             # PWA manifest (Add to Home Screen)
│   ├── goal-horn.mp3             # CAR goal horn audio
│   ├── _headers                  # Cloudflare cache control headers
│   ├── eyewall-logo.svg/.png     # App logo
│   └── favicon-*.png / .ico      # Favicons
├── functions/                    # Cloudflare Pages Functions (API proxy)
│   ├── nhl-api/[[path]].js       # → https://api-web.nhle.com
│   ├── nhl-stats/[[path]].js     # → https://api.nhle.com
│   ├── nhl-assets/[[path]].js    # → https://assets.nhle.com (logos, headshots)
│   └── api/notification.js       # Push notification payload proxy
├── src/
│   ├── App.jsx                   # Router, layout, BottomNav, PeriodSummaryProvider, theme init
│   ├── index.css                 # Global design tokens (:root dark mode + [data-theme="light"] overrides)
│   ├── light-mode-overrides.css  # Per-component light mode overrides (scoped to [data-theme="light"])
│   ├── views/
│   │   ├── ShotMapView.jsx/.css  # Live shot map, metrics, live insights, PP/PK, period summaries
│   │   ├── ScheduleView.jsx/.css # Season + playoff schedule, predictions
│   │   ├── TeamView.jsx/.css     # 6-tab team analytics (Overview, Advanced, Splits, Trends, Cap, Picks)
│   │   ├── PlayersView.jsx/.css  # Roster, player cards, analytics, heat maps
│   │   ├── LeagueView.jsx/.css   # 5-tab league page: Standings, Playoff bracket, Leaders, Power rankings, Draft
│   │   ├── NewsView.jsx/.css     # News feed (4 sources, filters)
│   │   ├── DevReplayView.jsx/.css # Dev-only live game replay scrubber (/dev)
│   │   └── DevDraftView.jsx      # Dev-only draft simulator (/dev/draft)
│   ├── components/
│   │   ├── Topbar.jsx/.css       # Live score, countdown clock, momentum bar
│   │   ├── IceRink.jsx/.css      # SVG rink, heat map, player filter, readOnly mode
│   │   ├── GameEvents.jsx/.css   # Goal/penalty/win/puck drop popups
│   │   ├── ScoutingTab.jsx/.css  # Opponent scouting (side-by-side)
│   │   ├── MatchupDetail.jsx      # Prediction + Scouting tab detail view
│   │   ├── CalendarView.jsx       # Calendar month view for schedule
│   │   ├── GameCard.jsx           # Game card + series card components
│   │   ├── GameStatsPopup.jsx     # Completed game stats popup (shell)
│   │   ├── GameStatsComponents.jsx # PeriodTable, SkaterTable, GoalsList
│   │   ├── PredictionShareCanvas.jsx # 1080×1080 prediction export card
│   │   ├── PredictionCanvas.css   # Shared export card styles (used by prediction + power rankings canvas)
│   │   ├── DraftTab.jsx/.css      # Draft board — rankings, live board, pick popups, AI analysis
│   │   ├── NotificationBell.jsx  # ⚙️ Settings — push notification opt-in, theme toggle, period summary chips
│   │   ├── PeriodSummary.jsx/.css # Period and game summary popup + share image canvas
│   │   ├── AboutPopup.jsx/.css   # Logo tap → about + BMC link
│   │   ├── TeamLogo.jsx/.css     # NHL team logo renderer
│   │   ├── StatBar.jsx/.css      # Comparative stat bar
│   │   └── InfoTip.jsx/.css      # Tap-to-open tooltip
│   ├── hooks/
│   │   ├── useFetch.js           # Data fetching + polling hook
│   │   ├── usePushNotifications.js # Web Push subscription management
│   │   ├── usePeriodSummary.js   # Period + game summary build, sessionStorage persistence
│   │   └── useWakeLock.js        # Screen wake lock during live games
│   └── utils/
│       ├── nhlApi.js             # All NHL API calls, KV-first caching, draft endpoints
│       ├── advancedStats.js      # Corsi, Fenwick, PDO, GSAx, Puck Luck
│       ├── cache.js              # Module-level TTL cache, in-flight dedup
│       ├── carContracts.js       # Static CAR contract data
│       ├── draftFixtures.js      # Dev/test fixture data for draft simulator and Cypress
│       ├── predictionStore.js    # localStorage game prediction tracker
│       ├── supabaseClient.js     # Supabase read-only client + data fetchers
│       ├── ppUnits.js            # PP/PK unit configs by season (inferPPUnit, inferPKUnit)
│       ├── teamConfig.js         # All 32 team configs — primaryColor + displayColor + team picker. CURRENT_SEASON single flip point.
│       ├── themeConfig.js        # Light/dark mode persistence (localStorage eyewall:theme)
│       ├── applyTeamTheme.js     # Sets --team-primary, --team-primary-rgb, --team-canvas, --team-canvas-rgb on :root
│       ├── PeriodSummaryContext.jsx # React context bridging ShotMapView → Game Center bell
│       ├── DevGameContext.js     # Dev-only context for live game injection
│       ├── liveClockStore.js     # Shared pub/sub for synced clock + momentum
│       └── analytics.js          # PostHog wrapper (capture, identify) — no-op outside production
├── src/utils/__tests__/          # Vitest unit tests
│   ├── advancedStats.test.js     # Corsi, PDO, GSAx, Puck Luck
│   ├── periodSummary.test.js     # HDC formula, strengthLabel, corsiColor, rosterMap
│   ├── rolling.test.js           # Rolling win%, GF/GA, score-first, streak
│   ├── statFormatting.test.js    # groupStats formatting
│   ├── leagueUtils.test.js       # Standings grouping functions
│   ├── news.test.js              # News deduplication and filtering
│   ├── prediction.test.js        # Win probability model
│   └── staticLines.test.js       # Static line combination logic
├── cypress/
│   ├── e2e/
│   │   ├── navigation.cy.js      # Route navigation
│   │   ├── news.cy.js            # News view, source filters
│   │   ├── period-summary.cy.js  # Game Center, period/game summary popups
│   │   ├── players.cy.js         # Roster, skater card, goalie card
│   │   ├── schedule.cy.js        # Schedule view
│   │   ├── shot-map.cy.js        # Shot Map all sections + rink controls
│   │   ├── team.cy.js            # All 6 team tabs
│   │   ├── league.cy.js          # League page — all 5 tabs incl. draft
│   │   ├── draft.cy.js           # Draft board — pre-draft, live, complete, team picks tab
│   │   └── viewports.cy.js       # 4 viewports × 5 views
│   └── support/e2e.js            # Custom commands: waitForContent, goTo, navTo, assertNoErrors
├── scripts/
│   ├── cypress-full.mjs          # clean → run → report
│   └── generate-report.mjs       # Mochawesome JSON merge → HTML report
├── .github/workflows/test.yml    # GitHub Actions: Vitest + Cypress on push to main/staging
├── SMOKE_TESTS.md                # Manual pre-merge checklist
└── .env.local.example            # Environment variable template
```

---

## Team Selection & Theming

### Team picker
On first launch the user selects their team from all 32 NHL teams. The selection is stored in `localStorage` under `eyewall:team` and read by `getTeamConfig()` on every load. All views, API calls, and color tokens scope to the selected team automatically.

### Color tokens
`applyTeamTheme(team, mode)` is called once on mount and again on any team or theme change. It sets four CSS custom properties on `:root`:

| Token | Value | Used for |
|-------|-------|----------|
| `--team-primary` | `displayColor` (dark) or `primaryColor` (light) | All in-app UI accents |
| `--team-primary-rgb` | RGB components of `--team-primary` | `rgba()` tints in CSS |
| `--team-canvas` | Always `displayColor` | Export card accents (always dark bg) |
| `--team-canvas-rgb` | RGB components of `--team-canvas` | `rgba()` tints in export CSS |

### Season constant
`CURRENT_SEASON = '20252026'` in `teamConfig.js` is the single flip point for all season-dependent logic in the app. The pipeline repo reads `NHL_SEASON` from a GitHub Actions secret. Both must be updated each October.

---

## Cloudflare Worker (`eyewall-poller`)

A separate Cloudflare Worker polls the NHL API every 60 seconds and writes to KV. The app reads from KV first, falling back to direct NHL API calls.

**Worker URL:** `https://eyewall-poller.billowing-queen-bf23.workers.dev`

### KV Keys

| Key | Content | TTL |
|-----|---------|-----|
| `schedule:CAR` | Full season schedule | 10 min |
| `live:gameId` | Current live game ID or null | 60s |
| `pbp:{gameId}` | Play-by-play data | 60s (live), 1hr (final) |
| `boxscore:{gameId}` | Boxscore data | 60s (live), 1hr (final) |
| `standings` | League standings | 5 min |
| `teamstats:CAR` | CAR team summary stats | 10 min |
| `push:subs` | Web Push subscription array | 1 year |
| `push:gamestate:{id}` | Last known score/play count | 24hr |
| `push:gameover:{id}` | Game-over dedup flag | 24hr |
| `summary:{gameId}` | AI game summary card | 30 days |
| `latest-notification` | Last push payload (SW fetch) | 5 min |
| `news:CAR` | Aggregated news articles | 30 min |
| `shots:CAR:{playerId}` | Season shot coordinates per player | 8 months |
| `shots:CAR:index` | Player shot count index | 8 months |
| `shots:done:{gameId}` | Shot aggregation dedup flag | 8 months |
| `moneypuck:skaters` | WAR + percentile analytics for all CAR players | 4 hrs |
| `draft:rankings:{categoryId}` | NHL Central Scouting rankings by category | 6 hrs |
| `draft:picks:2026:{chunk}` | Live draft picks (chunked) | 5 min (live), 24hr (post-draft) |
| `draft:order:2026:{team}` | 2026 pick order per team from Tankathon | 24 hrs |

### Worker Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Status, live game ID, subscriber count |
| `GET /cache/{key}` | Read any KV key |
| `POST /push/subscribe` | Save a push subscription |
| `POST /push/unsubscribe` | Remove a push subscription |
| `GET /poll?secret=` | Manual poll trigger |
| `GET /push/test?secret=` | Send test notification |
| `GET /news/refresh?secret=` | Force news feed refresh |
| `GET /summary/generate?secret=&force=1` | Generate AI summary for most recent game |
| `GET /shots/backfill?secret=&batch=5` | Backfill shot data for completed games (batched) |
| `GET /moneypuck/refresh?secret=` | Force refresh MoneyPuck analytics |
| `GET /social/test?secret=&post=1` | Preview (or post) test X/social post |
| `GET /draft/rankings?category=` | Central Scouting rankings (all or by category) |
| `GET /draft/picks?team=` | Live/completed draft picks (optionally filtered by team) |
| `GET /draft/order?team=` | 2026 pick order slots per team |
| `POST /draft/picks/ingest` | Bulk insert draft picks (called by pipeline `draft_ingest.py`) |

---

## Features

### Shot Map (Live + Post-game)
- SVG ice rink drawn to NHL spec (200×85ft at 3px/ft)
- Shot dots: team primary color, opponent blue, goals highlighted
- Heat map mode: Gaussian KDE density overlay
- Player filter: dropdown — filters dots + heat map to one player
- Period filter: P1 / P2 / P3 / OT
- Full rink / half rink toggle
- Live polling: 10s during games, 5min otherwise
- Countdown clock: ticks in real-time between polls
- Zone labels: offensive / defensive zone relative to selected team
- Screen wake lock: prevents device sleep during live games (Screen Wake Lock API)

### ⚙️ Settings Drawer
The ⚙️ gear icon in the top-right corner opens the Settings drawer. It contains:
- **My Team** — displays current team with logo; Change button clears `eyewall:team` and reloads to team picker
- **Appearance** — light/dark mode toggle; preference persisted to `localStorage` under `eyewall:theme`
- **Push Notifications** — opt-in/out toggle with event list
- **Game Summaries** — period and game summary chips when available

### ⚡ Game Center (Period Summaries)

**Automatic period summaries** are built at the end of each period during live games (detected via `pbp.clock.inIntermission` transition) and for all periods of completed games on page load. Each summary is persisted to `sessionStorage` keyed by `gameId` so it survives page refreshes and component remounts.

**Per-period summary card:**
- Score at end of period with team logos
- 6-stat grid: CF%, SOG, FF%, Hits, Faceoff Win%, High Danger Chances (team vs OPP)
- EyeWall AI narrative (Cloudflare Workers AI) — 2-3 sentences generated via Vite proxy in dev, Cloudflare Worker in prod
- Goals carousel — swipe left/right through each goal; Brightcove video highlight embedded per goal
- Penalties — collapsed to 3 with "Show more" toggle
- Share image export (1080×1080 PNG via `html-to-image`) — always renders on dark background with `--team-canvas` color
- Copy Caption button — pre-formatted post text for Instagram/X

**Full game summary card** (FINAL chip):
- Score + AI narrative, same 6-stat grid (game totals)
- Two-column goals layout, period breakdown bar chart, three stars with headshots

### Momentum Card
- Zone-weighted territorial score combining shot attempts, offensive zone faceoff wins, OZ hits and takeaways
- Selectable window: 5m / 10m / full game
- Waveform showing momentum swings across all periods with period dividers
- Compact momentum bar in topbar during live games

### Live Insights Panel
Auto-generated contextual callouts from PBP data — shot advantage, momentum, top scorer, PK performance, score situation alerts, empty net detection.

### Schedule Page
- Regular season game cards with win probability chips
- Playoff round sections with series records
- AI Game Summary card on completed games (Workers AI via Worker)

### Team Page (6 tabs)
**Overview, Advanced, Splits, Trends, Cap, Picks**

The **Cap** tab (CAR only) shows salary cap bar, contract table with UFA/RFA status, and cap projections. The **Picks** tab (all 32 teams) shows that team's 2026 draft picks — pre-draft shows confirmed pick slots from Tankathon, live/post-draft shows actual selections with AI analysis popups.

### Players Page
Skater and goalie cards with Stats, Analytics (WAR/GSAX), and Heat Map tabs. Dual goalie rankings by SV% and GAA.

### League Page (5 tabs)

**Standings** — division, conference, league, and wild card views. L10 dot indicators, clinch/WC legend, YOU row highlight in team color.

**Playoff bracket** — dot-style series wins, connector lines, all 4 rounds through Cup Final. WCAG AA-compliant team colors from `teamConfig.js`. Falls back to `OFFSEASON_BRACKET` (hardcoded last season results) when API returns null — never shows a blank screen.

**Leaders** — points, goals, GAA, SV% top 10. YOU row highlight for your team's players.

**Power Rankings** — 32-team ranking updated nightly. Formula blends five components:

| Component | Weight | Source |
|-----------|--------|--------|
| Points % | 25% | NHL standings |
| L10 points % | 25% | NHL standings |
| Goal diff/GP | 20% | NHL standings |
| 5v5 xGF% | 20% | MoneyPuck (nightly) |
| Special teams avg | 10% | NHL standings |
| Roster WAR | 0–15% | EyeWall RAPM model (tapers to 0% by game 20) |

**Draft** — NHL Central Scouting rankings with four category sub-tabs (NA Skaters, Intl Skaters, NA Goalies, Intl Goalies). Pre-draft shows rankings table with rank delta (midterm → final), height, weight, club, league, country. Auto-switches to live draft board when picks begin — round-grouped pick rows with CS rank badges and AI analysis popups ("Sticks" persona). Rankings/Board toggle remains available during and after the draft. Export cards for individual picks. The per-team Picks tab on the Team page also shows live picks filtered to that team.

### Game Event Popups
Puck Drop, Goal (with goal horn), Opponent Penalty, Win — all deduped via `sessionStorage`.

### Push Notifications
Events: goal, game start, opponent penalty (PP), win. Payloadless push — SW fetches payload from Worker KV on receipt.

---

## Win Probability Model

8-factor model (GF/GP, GA/GP, SOG/GP, PP vs PK, standings pts, form/streak, home ice, series record). Blended 60/40 with market odds when available.

---

## Data Pipeline (`eyewall-pipeline`)

**Repo:** `github.com/ehlersio/eyewall-pipeline`

| Module | Description |
|--------|-------------|
| `run.py` | Orchestrator |
| `nhl_stats.py` | Rosters, skater/goalie/team stats, game log → Supabase (all 32 teams) |
| `shot_events.py` | League-wide shot coordinates from PBP |
| `shift_data.py` | League-wide shift charts — JSON API + HTML fallback, RPC distinct lookup |
| `zone_starts.py` | Per-player OZ/DZ/NZ start counts (parallelized, 8 workers) |
| `score_state.py` | Per-player score-state ice time distribution across 3-season pool |
| `rapm.py` | 3-year rolling ridge regression RAPM with score-state normalization |
| `moneypuck.py` | WAR + percentiles + goalie GSAX + game-level xG + season xGF% aggregation |
| `power_rankings.py` | Roster WAR scores + 32-team rankings + nightly AI narratives → Supabase |
| `special_teams.py` | PP/PK unit inference from shift + shot events → `special_teams_units` table |
| `draft_ingest.py` | Live draft pick polling — NHL API → Supabase + AI analysis via Worker |
| `tankathon_ingest.py` | 2026 draft pick order scraper (Tankathon) → `draft_pick_order_2026` |
| `validate_rapm.py` | RAPM quality checks — league-wide, uniform 60th percentile threshold |

**Supabase tables:** `players`, `player_seasons`, `goalie_seasons`, `team_seasons` (incl. `xgf_pct`, `roster_war_score`), `shot_events`, `shift_events`, `zone_starts`, `game_log`, `game_xg`, `power_rankings_narratives`, `rapm_validation`, `skipped_games`, `player_score_state_dist`, `special_teams_units`, `draft_rankings_2026`, `draft_picks_2026`, `draft_pick_order_2026`

### Pipeline GitHub Actions workflows

| Workflow | Schedule | Description |
|----------|----------|-------------|
| `nightly.yml` | 3 AM ET daily | Full pipeline run (nhl_stats → rapm → moneypuck → power_rankings → ai_summaries) |
| `moneypuck-ingest.yml` | Nightly | MoneyPuck CSV fetch via GH runner (Cloudflare IPs blocked) |
| `reddit-ingest.yml` | Every 30 min | Reddit (32 subreddits) + SBNation atom feeds → Worker |
| `tankathon-sync.yml` | Weekly (Tue 8am ET) | Tankathon draft order scrape → Supabase |
| `draft-ingest.yml` | Jun 26 10:45pm UTC + Jun 27 2pm UTC | Live draft pick polling loop (exit 99 when 224 picks complete) |

### Draft Day Ingest

`draft_ingest.py --poll-picks` fetches live picks from the NHL API, diffs against `draft_picks_2026`, inserts new picks with AI analysis (via Worker), and exits with code 99 when all 224 picks are inserted. `draft-ingest.yml` loops this every 60 seconds with a 6-hour timeout covering both draft nights. A KV purge step runs before polling starts to clear any stale cached pick data.

### Pipeline run order (nightly, via `run.py`)

```
nhl_stats         → game_log, player/team seasons
shot_events       → shot events league-wide
shift_data        → shifts
zone_starts       → zone starts
rapm              → RAPM regression
moneypuck         → WAR, percentiles, xGF%, game xG
special_teams     → PP/PK unit inference
power_rankings    → roster WAR scores + rankings + AI narratives
ai_summaries      → post-game summaries
ai_scouting       → missing scouting blurbs
validate_rapm     → sanity checks (non-zero exit on failure)
```

### RAPM methodology (beta)

- **Pool:** 3-year rolling window (~420k 5v5 shot events, all 32 teams)
- **Formulation:** Signed xG differential; zone-start adjusted; score-state normalized via `player_score_state_dist`
- **Ridge alpha:** 2500; **min sample:** 150 min EV ice time across 3-season pool
- **Known limitations:** Draisaitl/Makar rank anomaly due to dominant linemate collinearity; injury-shortened seasons produce high-variance estimates — both documented in `validate_rapm.py`

---

## Local Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Run Vitest unit tests
npm run test:watch # Watch mode
npm run build      # Production build
```

**Required `.env.local` variables:**
```
VITE_WORKER_URL=https://eyewall-poller.billowing-queen-bf23.workers.dev
VITE_VAPID_PUBLIC_KEY=BHuReh0oBGitFpWQpzEkxM-0m2XHxDX3hqfvX6lpA-IfKSivoB892Jvs64Uz7oNOF-NvDIpPeeBAcWwsIRpnKX4
VITE_ANTHROPIC_API_KEY=sk-ant-...   # Claude API key for period summary AI narratives (dev only)
VITE_POSTHOG_KEY=phc_...             # PostHog project API key (optional locally — analytics disabled in dev)
```

> The `VITE_ANTHROPIC_API_KEY` is injected server-side by the Vite proxy at `/anthropic` — it never appears in the client bundle. In production, period summary AI calls are handled by the Cloudflare Worker.

**Dev tools:**
- `http://localhost:5173/dev` — live game replay scrubber
- `http://localhost:5173/dev/draft` — draft board simulator (pre-draft / live / complete states, all 16 teams, play/pause/step controls)

**Debug panel** — tap the score bar 5 times to open. Sections: Popups, Insights, Situation, Push.

---

## Development Workflow

```
dev branch → dev.eyewallanalytics.pages.dev (preview)
main branch → eyewallanalytics.com (production)
```

1. Work on `dev` branch
2. Test locally with `npm run dev`
3. Push to `dev` → verify on preview URL
4. Run through `SMOKE_TESTS.md` checklist
5. Merge to `main` → production deploys automatically

---

## Deployment

**To update the app:** push to `dev`, verify, merge to `main`.

**To update the Worker:** edit `eyewall-worker/worker.js`, paste into Cloudflare Workers dashboard → Deploy.

**To backfill shot data:** `GET /shots/backfill?secret=POLL_SECRET&batch=5` — call repeatedly until `remaining: 0`.

**To refresh MoneyPuck analytics:** `GET /moneypuck/refresh?secret=POLL_SECRET`

**To run power rankings manually:** `python power_rankings.py` (all teams) or `python power_rankings.py --team CAR --dry-run` (preview one team's prompt).

**To sync draft order:** `python tankathon_ingest.py` — upserts all 224 picks into `draft_pick_order_2026`. Run weekly or after any known trades involving picks.

**October season prep checklist:**
1. Update `CURRENT_SEASON` in `teamConfig.js` (app repo)
2. Update `NHL_SEASON` GitHub Actions secret (pipeline repo)
3. Update `MP_SEASON` in `moneypuck.py`
4. Update `OFFSEASON_BRACKET` in `LeagueView.jsx` with prior season results
5. Review Dependabot PRs (ESLint 10, Vite 8, supabase-ecosystem 2.31.0)
6. Re-run `tankathon_ingest.py` for new draft year

---

## Testing

### Vitest (unit tests)

```bash
npm test            # Run all tests once
npm run test:watch  # Watch mode
```

**138 tests across 8 files:**

| File | Coverage | Tests |
|------|----------|-------|
| `advancedStats.test.js` | `computeShotAttempts`, `seasonPDO` | 13 |
| `periodSummary.test.js` | HDC formula, `strengthLabel`, `corsiColor`, `buildRosterMap` | 26 |
| `rolling.test.js` | Rolling win%, GF/GA, score-first rate, streak | 18 |
| `statFormatting.test.js` | `groupStats` formatting | 14 |
| `leagueUtils.test.js` | Standings grouping functions | 15 |
| `news.test.js` | News deduplication and filtering | 16 |
| `prediction.test.js` | Win probability model | 7 |
| `staticLines.test.js` | Static line combination logic | 29 |

### Cypress (E2E tests)

```bash
npm run cypress:open    # Interactive mode
npm run cypress:run     # Headless
npm run cypress:full    # Clean → run → generate HTML report
```

**HTML report:** `cypress/reports/html/merged.html`

**Tests across 10 specs:**

| Spec | What it tests |
|------|--------------|
| `navigation.cy.js` | All routes, bottom nav |
| `news.cy.js` | Source filter chips, article list, refresh, attribution |
| `period-summary.cy.js` | Game Center drawer, period summary popup, final game summary |
| `players.cy.js` | Roster, skater card (all tabs), goalie card (dual rankings, GSAX) |
| `schedule.cy.js` | Playoffs rounds, Prediction/Scouting tabs, AI matchup analysis, stats popup |
| `shot-map.cy.js` | All sections: insights, shot attempts, momentum, rink controls |
| `team.cy.js` | All 6 tabs including Cap and Picks |
| `league.cy.js` | All 5 tabs: standings filters, bracket, leaders, power rankings, draft |
| `draft.cy.js` | Pre-draft rankings, live board, complete state, team Picks tab (CAR + non-CAR) |
| `viewports.cy.js` | 4 viewports (375/430/768/1280px) × all 5 views |

CI runs Vitest + Cypress headless on every push to `main` or `staging`. GitHub Actions uploads HTML report as artifact (14-day retention) and screenshots on failure (7-day retention).

---

## Advanced Stats Definitions

| Stat | Formula | Context |
|------|---------|---------|
| **CF%** | Team shot attempts ÷ total (SOG + missed + blocked) | ≥50% = controlling play |
| **FF%** | Team unblocked attempts ÷ total unblocked | Excludes shot-blocking luck |
| **PDO** | (SH% + SV%) × 100 | League avg = 100; far from 100 = luck |
| **Puck Luck** | Actual GF − expected GF from shot share | Positive = scoring above shot quality |
| **GSAx** | Saves − (shots × .900) | Game-level estimate |
| **GSAX** | Flurry-adjusted xGoals − actual goals against | MoneyPuck model |
| **WAR** | RAPM EV component × EV hours ÷ 5.4 + PP/PK/finishing + 0.5 | Beta — RAPM-derived EV |
| **RAPM** | Ridge regression marginal xG/60 at 5v5 | Beta — zone-start + score-state adjusted |
| **xGF%** | On-ice expected goals for ÷ total | Possession quality metric |
| **GSAX/$M** | Season GSAX ÷ cap hit in $M | Goalie contract value |
| **Blended value** | (Points/$M × 0.6) + (WAR/$M × 6 × 0.4) | Skater contract value |
| **Momentum%** | Weighted zone events: shots (1.0/0.7), OZ faceoff wins (0.6), OZ hits/takeaways (0.4–0.5) | Inspired by NHL Edge Ice Tilt |
| **High Danger Chances** | Shot attempts (incl. blocked) within 15ft of net: `dist(\|x\|-89, y) < 15` | Matches Shot Map formula |
| **Power Rankings score** | Weighted sum of 5 normalised components + early-season roster WAR prior | See League Page section |

---

## Known Limitations

- **Cron minimum:** 1-minute polling intervals — live data is 0–60s behind NHL API.
- **Cap data:** NHL API doesn't expose salary. Static file requires manual updates.
- **Future draft picks:** Per-team future pick inventory (beyond current draft year) deferred pending reliable data source. PuckPedia picks tab appears to load dynamically — scraping approach TBD.
- **iOS push:** Requires Add to Home Screen — browser-tab Safari cannot receive Web Push.
- **WAR/RAPM beta:** Zone-start OZS% still being refined.
- **RAPM non-CAR players:** Non-CAR players only appear in 2–5 games vs CAR per season. Their RAPM estimates have high variance — validation thresholds are relaxed accordingly.
- **RAPM linemate collinearity:** Draisaitl and Makar rank anomalously low due to dominant co-deployment. Documented in `validate_rapm.py` — treat as known artifact, not pipeline error.
- **Period summary sessionStorage:** Summaries persist for the current game session only.
- **Matchup analysis availability:** `matchup_text` only exists for upcoming games — scouting export card AI section is blank for completed games.
- **X/Twitter posting:** Code is built and tested. Requires Basic tier ($100/mo) to post.
- **Reddit ingest:** All 32 subreddits currently failing — Reddit blocks unauthenticated GH Actions IPs. Deferred to October; consider OAuth or alternative source.
- **STATIC_LINES / PP_UNITS / PK_UNITS:** Only have CAR entries. Add other teams' data as needed; graceful null fallback exists for teams without entries.
- **Power rankings xGF%:** Shows `—` until first nightly pipeline run after the `migration_add_xgf_pct.sql` migration.
- **Transactions / Injuries tabs:** Deferred pending PuckPedia API access.

---

## Offseason Roadmap

- [x] League page — Standings, Playoff bracket, Leaders, Power Rankings
- [x] League page — Draft tab with Central Scouting rankings + live board
- [x] Team page — Cap/Picks split into separate tabs
- [x] Draft day pipeline — `draft_ingest.py` polling loop + `draft-ingest.yml` workflow
- [x] Tankathon scraper — `tankathon_ingest.py` + `tankathon-sync.yml`
- [x] Special teams pipeline — `special_teams.py` replacing static `ppUnits.js`
- [x] Season hardcoding eliminated — `CURRENT_SEASON` single flip point
- [x] Supabase RLS enabled on all public tables
- [ ] Reddit ingest fix (GH Actions IPs blocked — revisit OAuth or alternative source)
- [ ] Future draft picks per team — PuckPedia scraping or alternative source
- [ ] PuckPedia integration — contracts + cap for all 32 teams (pending scraping approach)
- [ ] `app_config` Supabase table for season constant — eliminate hardcoded `20252026`
- [ ] `score_state.py` backfill for 20242025 and 20232024 seasons
- [ ] RAPM alpha tuning via cross-validation (after 3+ full seasons)
- [ ] Expand `STATIC_LINES` / `PP_UNITS` / `PK_UNITS` for additional teams
- [ ] X/Twitter auto-posting (when Basic tier active)
- [ ] Season-over-season player comparison view
- [ ] xGF% sparkline trend on team page
- [ ] Line combinations tracker (extension of special_teams inference)
- [ ] Standings clinching indicators (magic numbers)
- [ ] Hat tricks / natural hat tricks / SHG milestone feed
- [ ] PostHog funnel analysis
- [ ] Capacitor PWA wrapper for App Store / Play Store
- [ ] Dependabot: supabase-ecosystem 2.3.4→2.31.0, ESLint 9→10, Vite 5→8 (revisit October)
- [ ] October season prep: bump `CURRENT_SEASON`, `NHL_SEASON`, `MP_SEASON`, `OFFSEASON_BRACKET`

---

*Built with 🌀 for hockey fans*
