# EyeWall Analytics

> Carolina Hurricanes advanced stats and analytics — live shot maps, period summaries, momentum tracking, special teams analysis, push notifications, AI-generated game summaries, player heat maps, goalie analytics, and WAR/percentile rankings.

**Live at:** [eyewallanalytics.com](https://eyewallanalytics.com)  
**Contact:** matt@eyewallanalytics.com  
**Support the project:** [buymeacoffee.com/mattehlers](https://buymeacoffee.com/mattehlers)

---

## Overview

EyeWall Analytics is a React PWA delivering real-time and historical Carolina Hurricanes data entirely from the public NHL API and MoneyPuck. It combines live polling, a Cloudflare Worker caching layer, Web Push notifications, Claude AI period and game summaries, player shot heat maps, MoneyPuck-powered WAR/percentile analytics, and true RAPM via ridge regression into a mobile-first experience for Canes fans who want to go deeper than the box score.

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
| Database | Supabase Pro (player/team/goalie stats, shot events, RAPM, game xG) |
| Data Pipeline | Python (`eyewall-pipeline`) — NHL API + MoneyPuck → Supabase |
| Pipeline CI | GitHub Actions nightly cron (3 AM ET) |
| Push Notifications | Web Push API (VAPID), Service Worker |
| AI Summaries | Anthropic Claude Haiku (period/game summaries via Vite proxy in dev; Worker in prod) |
| Analytics Data | MoneyPuck.com CSV (fetched nightly by pipeline) |
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
│   ├── App.jsx                   # Router, layout, BottomNav, PeriodSummaryProvider
│   ├── views/
│   │   ├── ShotMapView.jsx/.css  # Live shot map, metrics, live insights, PP/PK, period summaries
│   │   ├── ScheduleView.jsx/.css # Season + playoff schedule, predictions
│   │   ├── TeamView.jsx/.css     # 5-tab team analytics
│   │   ├── PlayersView.jsx/.css  # Roster, player cards, analytics, heat maps
│   │   ├── NewsView.jsx/.css     # News feed (4 sources, filters)
│   │   └── DevReplayView.jsx/.css # Dev-only live game replay scrubber (/dev)
│   ├── components/
│   │   ├── Topbar.jsx/.css       # Live score, countdown clock, momentum bar
│   │   ├── IceRink.jsx/.css      # SVG rink, heat map, player filter, readOnly mode
│   │   ├── GameEvents.jsx/.css   # Goal/penalty/win/puck drop popups
│   │   ├── ScoutingTab.jsx/.css  # Opponent scouting (side-by-side)
│   │   ├── NotificationBell.jsx  # ⚡ Game Center — push notification opt-in + period summary chips
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
│       ├── nhlApi.js             # All NHL API calls, KV-first caching
│       ├── advancedStats.js      # Corsi, Fenwick, PDO, GSAx, Puck Luck
│       ├── cache.js              # Module-level TTL cache, in-flight dedup
│       ├── carContracts.js       # Static CAR contract + draft pick data
│       ├── predictionStore.js    # localStorage game prediction tracker
│       ├── supabaseClient.js     # Supabase read-only client + data fetchers
│       ├── ppUnits.js            # PP/PK unit configs by season (inferPPUnit, inferPKUnit)
│       ├── PeriodSummaryContext.jsx # React context bridging ShotMapView → Game Center bell
│       ├── DevGameContext.js     # Dev-only context for live game injection
│       └── liveClockStore.js     # Shared pub/sub for synced clock + momentum
├── src/utils/__tests__/          # Vitest unit tests
│   ├── advancedStats.test.js     # Corsi, PDO, GSAx, Puck Luck (15 tests)
│   ├── periodSummary.test.js     # HDC formula, strengthLabel, corsiColor, rosterMap (30 tests)
│   ├── rolling.test.js           # Rolling win%, GF/GA, score-first, streak (28 tests)
│   └── statFormatting.test.js    # groupStats formatting (10 tests)
├── cypress/
│   ├── e2e/
│   │   ├── navigation.cy.js      # Route navigation (7 tests)
│   │   ├── news.cy.js            # News view, source filters (15 tests)
│   │   ├── period-summary.cy.js  # Game Center, period/game summary popups (23 tests)
│   │   ├── players.cy.js         # Roster, skater card, goalie card (30 tests)
│   │   ├── schedule.cy.js        # Schedule view (3 tests)
│   │   ├── shot-map.cy.js        # Shot Map all sections + rink controls (31 tests)
│   │   ├── team.cy.js            # All 5 team tabs (19 tests)
│   │   └── viewports.cy.js       # 4 viewports × 5 views (44 tests)
│   └── support/e2e.js            # Custom commands: waitForContent, goTo, navTo, assertNoErrors
├── scripts/
│   ├── cypress-full.mjs          # clean → run → report (always generates HTML regardless of failures)
│   └── generate-report.mjs       # Mochawesome JSON merge → HTML report
├── .github/workflows/test.yml    # GitHub Actions: Vitest + Cypress on push to main/staging
├── SMOKE_TESTS.md                # Manual pre-merge checklist
└── .env.local.example            # Environment variable template
```

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

### Environment Variables

| Variable | Where | Notes |
|----------|-------|-------|
| `POLL_SECRET` | Worker | Protects manual trigger endpoints |
| `VAPID_PUBLIC_KEY` | Worker + Pages | Web Push VAPID public key |
| `VAPID_PRIVATE_KEY` | Worker (encrypted) | Web Push VAPID private key |
| `VAPID_SUBJECT` | Worker | `mailto:matt@eyewallanalytics.com` |
| `ANTHROPIC_API_KEY` | Worker (encrypted) | Claude API for Worker-generated game summaries |
| `VITE_ANTHROPIC_API_KEY` | `.env.local` (dev only) | Claude API for period summary narratives via Vite proxy — **never committed** |
| `X_CONSUMER_KEY` | Worker (encrypted) | X/Twitter API key |
| `X_CONSUMER_SECRET` | Worker (encrypted) | X/Twitter API secret |
| `X_ACCESS_TOKEN` | Worker (encrypted) | X/Twitter access token |
| `X_ACCESS_SECRET` | Worker (encrypted) | X/Twitter access secret |
| `VITE_WORKER_URL` | Pages (build-time) | Worker base URL |
| `VITE_VAPID_PUBLIC_KEY` | Pages (build-time) | Web Push public key for browser |

---

## Features

### Shot Map (Live + Post-game)
- SVG ice rink drawn to NHL spec (200×85ft at 3px/ft)
- Shot dots: CAR red, opponent blue, goals highlighted
- Heat map mode: Gaussian KDE density overlay
- Player filter: dropdown — filters dots + heat map to one player
- Period filter: P1 / P2 / P3 / OT
- Full rink / half rink toggle
- Live polling: 10s during games, 5min otherwise
- Countdown clock: ticks in real-time between polls
- Zone labels: "CAR offensive zone" / "OPP offensive zone"
- Screen wake lock: prevents device sleep during live games (Screen Wake Lock API)

### ⚡ Game Center (Period Summaries)

The ⚡ button in the top-right corner is the Game Center hub — it combines push notification management with period and full-game summaries in a single drawer.

**Automatic period summaries** are built at the end of each period during live games (detected via `pbp.clock.inIntermission` transition) and for all periods of completed games on page load. Each summary is persisted to `sessionStorage` keyed by `gameId` so it survives page refreshes and component remounts.

**Per-period summary card:**
- Score at end of period with team logos
- 6-stat grid: CAR Corsi For%, Shots on Goal, CAR Fenwick For%, CAR Hits, Faceoff Win%, High Danger Chances (CAR vs OPP)
- High Danger Chances uses the same formula as the Shot Map: `dist < 15ft` strict, includes blocked shots
- EyeWall AI narrative (Claude Haiku) — 2-3 sentences generated via Vite proxy in dev, Cloudflare Worker in prod
- Goals carousel — swipe left/right through each goal; Brightcove video highlight embedded per goal (`autoplay=false`); goal dot colors: red=CAR, grey=OPP
- Penalties — collapsed to 3 with "Show more" toggle; includes player name, infraction type, duration, and time
- Share image export (1080×1080 PNG via `html-to-image`) — includes EyeWall logo, score, 6 stats, goals, AI narrative
- Copy Caption button — pre-formatted post text for Instagram/X

**Full game summary card** (FINAL chip — built once when `game-end` play is detected):
- Score + AI narrative side by side (score left, narrative right) — maximizes vertical space
- Same 6-stat grid (game totals)
- Two-column goals layout: CAR goals left, OPP goals right — all goals shown, last name + period + time
- Period breakdown bar chart: CF% per period color-coded (green ≥55%, red ≤45%)
- Three stars with player headshots (proxied via `/nhl-assets/` to avoid CORS during export)
- AI narrative: 3-4 sentences covering turning points and whether result matched underlying play

**Game Center drawer (⚡ bell):**
- Push notification toggle (same functionality as before, now labeled "🔔 Push Notifications")
- Period summary chips below: P1/P2/P3 with period-end goal score; FINAL chip styled distinctly in red
- Tapping any chip closes the drawer and opens that summary

### Momentum Card
- Zone-weighted territorial score combining shot attempts, offensive zone faceoff wins, OZ hits and takeaways
- Selectable window: 5m / 10m / full game
- Waveform showing momentum swings across all periods with period dividers
- Compact momentum bar in topbar during live games

### Live Insights Panel
Auto-generated contextual callouts from PBP data:
- Shot advantage by period, momentum indicator, top scorer callout, PK performance
- Coach's challenge and video review detection via `stoppage` reason codes
- Score situation alerts, empty net detection
- Auto-collapse during live games (expands on new insight, collapses after 8s)

### Metrics Row (7 cards, 2 rows)
- **SOG, Hits, Blocks, Penalties** (top row)
- **Faceoff %, PP %, PK %** (bottom row) — PP/PK cards tap to open full drill-down analysis

### Power Play / Penalty Kill Analysis
- Summary bar, unit chips (PP1/PP2, PK1/PK2), per-opportunity breakdown, shot type breakdown, mini shot map

### xG — Expected Goals
- Live games: coordinate-estimate model; completed games: MoneyPuck 5v5 xG from Supabase

### Schedule Page
- Regular season game cards with win probability chips
- Playoff round sections with series records
- AI Game Summary card on completed games (Claude Haiku via Worker)

### Team Page (5 tabs)
- **Overview, Advanced, Splits, Trends, Cap & Picks**

### Players Page
- Skater and goalie cards with Stats, Analytics (WAR/GSAX), and Heat Map tabs
- Dual goalie rankings by SV% and GAA

### Game Event Popups
- Puck Drop, CAR Goal (with goal horn), Opponent Penalty, Canes Win — all deduped via `sessionStorage`

### Push Notifications
- Events: CAR goal, game start, opponent penalty (PP), Canes win
- Payloadless push — SW fetches payload from Worker KV on receipt

---

## Win Probability Model

8-factor model (GF/GP, GA/GP, SOG/GP, PP vs PK, standings pts, form/streak, home ice, series record). Blended 60/40 with market odds when available.

---

## Data Pipeline (`eyewall-pipeline`)

**Repo:** `github.com/ehlersio/eyewall-pipeline`

| Module | Description |
|--------|-------------|
| `run.py` | Orchestrator |
| `nhl_stats.py` | Rosters, skater/goalie/team stats, game log → Supabase |
| `shot_events.py` | League-wide shot coordinates from PBP |
| `shift_data.py` | League-wide shift charts (parallelized, 10 workers) |
| `zone_starts.py` | Per-player OZ/DZ/NZ start counts (parallelized, 8 workers) |
| `rapm.py` | 3-year rolling ridge regression RAPM |
| `moneypuck.py` | WAR + percentiles + goalie GSAX + game-level xG |
| `validate_rapm.py` | RAPM quality checks — CAR players expected top 40%; non-CAR players (low-sample, 2-5 games vs CAR) expected above bottom quartile only |

**Supabase tables:** `players`, `player_seasons`, `goalie_seasons`, `team_seasons`, `shot_events`, `shift_events`, `zone_starts`, `game_log`, `game_xg`, `rapm_validation`, `skipped_games`

### RAPM methodology (beta)

- **Pool:** 3-year rolling window (~420k 5v5 shot events, all 32 teams)
- **Formulation:** Signed xG differential; zone-start adjusted; score-state pending
- **Ridge alpha:** 2500; **min sample:** 150 min EV ice time across 3-season pool
- **Validation:** `validate_rapm.py` — CAR players (reliable 82-game estimates) vs non-CAR players (low-sample, 2–5 games vs CAR per season, high variance expected)

---

## MoneyPuck Analytics

WAR (RAPM-derived), GSAX, SV% splits, percentile rankings — all fetched nightly from MoneyPuck CSV.

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
```

> The `VITE_ANTHROPIC_API_KEY` is injected server-side by the Vite proxy at `/anthropic` — it never appears in the client bundle. In production, period summary AI calls are handled by the same Cloudflare Worker that powers AI game summaries, using the existing `ANTHROPIC_API_KEY` Worker secret.

**Dev tools** — visit `http://localhost:5173/dev` for the live game replay scrubber.

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

---

## Testing

### Vitest (unit tests)

```bash
npm test            # Run all tests once
npm run test:watch  # Watch mode
```

**83 tests across 4 files:**

| File | Coverage | Tests |
|------|----------|-------|
| `advancedStats.test.js` | `computeShotAttempts`, `seasonPDO` | 15 |
| `periodSummary.test.js` | `isHighDanger` (HDC formula), `strengthLabel`, `corsiColor`, `buildRosterMap`, HDC counting integration | 30 |
| `rolling.test.js` | Rolling win%, GF/GA, score-first rate, streak calculation | 28 |
| `statFormatting.test.js` | `groupStats` formatting for all stat types | 10 |

### Cypress (E2E tests)

```bash
npm run cypress:open    # Interactive mode
npm run cypress:run     # Headless
npm run cypress:full    # Clean → run → generate HTML report (always generates regardless of pass/fail)
```

**HTML report:** `cypress/reports/html/merged.html`

**169 tests across 8 specs:**

| Spec | What it tests | Tests |
|------|--------------|-------|
| `navigation.cy.js` | All routes, bottom nav | 7 |
| `news.cy.js` | Source filter chips, article list, refresh, attribution | 15 |
| `period-summary.cy.js` | Game Center (⚡) drawer, period summary popup, final game summary | 23 |
| `players.cy.js` | Roster, skater card (all tabs, defensive stats, GSAX), goalie card (dual rankings, GSAX analytics) | 30 |
| `schedule.cy.js` | Playoffs rounds, regular season list, stats popup | 3 |
| `shot-map.cy.js` | All sections: insights, shot attempts, momentum, rink controls | 31 |
| `team.cy.js` | All 5 tabs including trends charts and cap table | 19 |
| `viewports.cy.js` | 4 viewports (375/430/768/1280px) × all 5 views | 44 |

CI runs Vitest + Cypress headless on every push to `main` or `staging`. GitHub Actions uploads HTML report as artifact (14-day retention) and screenshots on failure (7-day retention).

---

## Advanced Stats Definitions

| Stat | Formula | Context |
|------|---------|---------|
| **CF%** | CAR shot attempts ÷ total (SOG + missed + blocked) | ≥50% = controlling play |
| **FF%** | CAR unblocked attempts ÷ total unblocked | Excludes shot-blocking luck |
| **PDO** | (SH% + SV%) × 100 | League avg = 100; far from 100 = luck |
| **Puck Luck** | Actual GF − expected GF from shot share | Positive = scoring above shot quality |
| **GSAx** | Saves − (shots × .900) | Game-level estimate |
| **GSAX** | Flurry-adjusted xGoals − actual goals against | MoneyPuck model |
| **WAR** | RAPM EV component × EV hours ÷ 5.4 + PP/PK/finishing + 0.5 | Beta — RAPM-derived EV |
| **RAPM** | Ridge regression marginal xG/60 at 5v5 | Beta — zone-start adjusted |
| **xGF%** | On-ice expected goals for ÷ total | Possession quality metric |
| **GSAX/$M** | Season GSAX ÷ cap hit in $M | Goalie contract value |
| **Blended value** | (Points/$M × 0.6) + (WAR/$M × 6 × 0.4) | Skater contract value |
| **Momentum%** | Weighted zone events: shots (1.0/0.7), OZ faceoff wins (0.6), OZ hits/takeaways (0.4–0.5) | Inspired by NHL Edge Ice Tilt |
| **High Danger Chances** | Shot attempts (incl. blocked) within 15ft of net: `dist(|x|-89, y) < 15` | Matches Shot Map formula |

---

## Known Limitations

- **Cron minimum:** 1-minute polling intervals — live data is 0–60s behind NHL API.
- **Cap data:** NHL API doesn't expose salary. Static file requires manual updates.
- **iOS push:** Requires Add to Home Screen — browser-tab Safari cannot receive Web Push.
- **WAR/RAPM beta:** Score-state adjustment pending. Zone-start OZS% still being refined.
- **RAPM non-CAR players:** Non-CAR players only appear in 2–5 games vs CAR per season. Their RAPM estimates have high variance — validation thresholds are relaxed accordingly.
- **Period summary AI (prod):** In production, period summary narratives should be routed through the Cloudflare Worker rather than a direct browser call. Currently uses the same `ANTHROPIC_API_KEY` Worker secret.
- **Period summary sessionStorage:** Summaries persist for the current game session only. Clearing storage or loading a new game clears all summaries.
- **X/Twitter posting:** Code is built and tested. Requires Basic tier ($100/mo) to post.

---

## Offseason Roadmap

- [ ] Route period summary AI narrative calls through Cloudflare Worker in production (currently proxied via Vite dev server only)
- [ ] `app_config` Supabase table for season constant — eliminate hardcoded `20252026`
- [ ] `pp_units` / `pk_units` Supabase table — replace static `ppUnits.js`
- [ ] RAPM score-state adjustment (add `home_team` to league-wide `shot_events`)
- [ ] RAPM alpha tuning via cross-validation (after 3+ full seasons)
- [ ] RAPM validation chip in UI surfacing `rapm_validation` table
- [ ] Update `SMOKE_TESTS.md` with period summary, Game Center, share image test cases
- [ ] 32-team expansion (team picker, parameterize CAR-specific code)
- [ ] PuckPedia API integration (pending access approval)
- [ ] X/Twitter auto-posting (when Basic tier active)
- [ ] Year-over-year player comparison view
- [ ] NHL EDGE zone time endpoint for live Momentum card improvement

---

*Built with 🌀 for Canes Nation*
