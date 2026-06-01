# EyeWall Analytics

> Carolina Hurricanes advanced stats and analytics — live shot maps, momentum tracking, special teams analysis, push notifications, AI-generated game summaries, player heat maps, goalie analytics, and WAR/percentile rankings.

**Live at:** [eyewallanalytics.com](https://eyewallanalytics.com)  
**Contact:** matt@eyewallanalytics.com  
**Support the project:** [buymeacoffee.com/mattehlers](https://buymeacoffee.com/mattehlers)

---

## Overview

EyeWall Analytics is a React PWA delivering real-time and historical Carolina Hurricanes data entirely from the public NHL API and MoneyPuck. It combines live polling, a Cloudflare Worker caching layer, Web Push notifications, Claude AI game summaries, player shot heat maps, MoneyPuck-powered WAR/percentile analytics, and true RAPM via ridge regression into a mobile-first experience for Huge Caniacs who want to go deeper than the box score.

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
| AI Summaries | Anthropic Claude Haiku via Worker |
| Analytics Data | MoneyPuck.com CSV (fetched nightly by pipeline) |
| Data Source | NHL public API (no authentication required) |
| Cap Data | Static `carContracts.js` (source: PuckPedia) |
| Accessibility | WCAG 2.1 AA compliant (Section 508) |
| Testing | Vitest (unit tests), GitHub Actions CI |

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
│   ├── nhl-assets/[[path]].js    # → https://assets.nhle.com
│   └── api/notification.js       # Push notification payload proxy
├── src/
│   ├── App.jsx                   # Router, layout, BottomNav
│   ├── views/
│   │   ├── ShotMapView.jsx/.css  # Live shot map, metrics, live insights, PP/PK analysis
│   │   ├── ScheduleView.jsx/.css # Season + playoff schedule, predictions
│   │   ├── TeamView.jsx/.css     # 5-tab team analytics
│   │   ├── PlayersView.jsx/.css  # Roster, player cards, analytics, heat maps
│   │   ├── NewsView.jsx/.css     # News feed (5 sources, filters, pagination)
│   │   └── DevReplayView.jsx/.css # Dev-only live game replay scrubber (/dev)
│   ├── components/
│   │   ├── Topbar.jsx/.css       # Live score, countdown clock, momentum bar
│   │   ├── IceRink.jsx/.css      # SVG rink, heat map, player filter, readOnly mode
│   │   ├── GameEvents.jsx/.css   # Goal/penalty/win/puck drop popups
│   │   ├── ScoutingTab.jsx/.css  # Opponent scouting (side-by-side)
│   │   ├── NotificationBell.jsx  # Push notification opt-in UI
│   │   ├── AboutPopup.jsx/.css   # Logo tap → about + BMC link
│   │   ├── TeamLogo.jsx/.css     # NHL team logo renderer
│   │   ├── StatBar.jsx/.css      # Comparative stat bar
│   │   └── InfoTip.jsx/.css      # Tap-to-open tooltip
│   ├── hooks/
│   │   ├── useFetch.js           # Data fetching + polling hook
│   │   ├── usePushNotifications.js # Web Push subscription management
│   │   └── useWakeLock.js        # Screen wake lock during live games
│   └── utils/
│       ├── nhlApi.js             # All NHL API calls, KV-first caching
│       ├── advancedStats.js      # Corsi, Fenwick, PDO, GSAx, Puck Luck
│       ├── cache.js              # Module-level TTL cache, in-flight dedup
│       ├── carContracts.js       # Static CAR contract + draft pick data
│       ├── predictionStore.js    # localStorage game prediction tracker
│       ├── supabaseClient.js     # Supabase read-only client + data fetchers
│       ├── ppUnits.js            # PP/PK unit configs by season (inferPPUnit, inferPKUnit)
│       ├── DevGameContext.js     # Dev-only context for live game injection
│       └── liveClockStore.js     # Shared pub/sub for synced clock + momentum
├── src/utils/*.test.js           # Vitest unit tests
├── .github/workflows/ci.yml      # GitHub Actions: test + build on push
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
| `news:CAR` | Aggregated news articles (5 sources) | 30 min |
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
| `ANTHROPIC_API_KEY` | Worker (encrypted) | Claude API for game summaries |
| `X_CONSUMER_KEY` | Worker (encrypted) | X/Twitter API key (posting ready, needs Basic tier) |
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

### Momentum Card
- Zone-weighted territorial score combining shot attempts, offensive zone faceoff wins, OZ hits and takeaways — inspired by NHL Edge Ice Tilt
- Zone location matters: OZ shot counts more than a neutral zone attempt; OZ faceoff win scores as 0.6; OZ hit/takeaway as 0.4–0.5
- Selectable window: 5m / 10m / full game
- Waveform showing momentum swings across all periods with period dividers (canvas, DPR-aware for retina)
- Compact momentum bar in topbar during live games (publishes via `liveClockStore`)
- "EyeWall Analytics" text hides in topbar during live games (logo only) to make room

### Live Insights Panel
Auto-generated contextual callouts from PBP data, shown during live games and as post-game "Game Insights":
- Shot advantage by period (e.g. "CAR dominated P2 shots 18–6")
- Momentum indicator (last 10 shot attempts)
- Top scorer callout (2+ point games)
- PK performance (perfect kills highlighted)
- **Coach's challenge and video review** — detected via `stoppage` play `reason` codes (`chlg-hm-*`, `chlg-vis-*`, `video-review`); outcome determined by subsequent `delaying-game-unsuccessful-challenge` penalty
- Score situation alerts (tied game, big lead, late deficit)
- Empty net detection
- **Auto-collapse** during live games (expands on new insight, collapses after 8s, tap to re-expand)

### Metrics Row (7 cards, 2 rows)

**Top row (4 cards)**
- **Shots on Goal** — CAR vs opponent, drill-down by player
- **Hits** — CAR vs opponent, drill-down by player
- **Blocks** — CAR blocks vs opponent
- **Penalties** — CAR vs opponent count

**Bottom row (3 cards)**
- **Faceoff %** — game faceoff win percentage
- **PP %** — game PP% with season avg; shows `—` until first opportunity; tap for full PP Analysis
- **PK %** — game PK% with season avg; shows `—` until first opportunity; tap for full PK Analysis

### Power Play Analysis
Tap the PP% MetCard to drill into every CAR power play opportunity:
- **Summary bar** — goals/opportunities, PP%, total SOG, total xG (MoneyPuck post-game; coordinate estimate live)
- **PP Unit chips** — PP1 and PP2 inferred from hardcoded unit configs (`ppUnits.js`); overlap matching (≥2 players) with explanation note
- **Per-opportunity breakdown** (collapsible) — outcome badge, period/time, PP1/PP2 tag, quick entry indicator (first shot ≤12s)
- **Detail chips** — SOG, SA (shot attempts/Corsi), xG, duration with tooltip
- **Shot type breakdown** — Wrist ×2, Snap ×1 etc.
- **Mini shot map** — IceRink in `readOnly` mode showing CAR shot locations for that PP

### Penalty Kill Analysis
Tap the PK% MetCard to drill into every CAR penalty kill:
- **Summary bar** — kills/opportunities, PK%, SOG against, total blocks, xGA
- **PK Unit chips** — PK1 and PK2 from unit configs; same overlap inference as PP
- **Per-opportunity breakdown** (collapsible) — outcome badge, goals allowed with scorer/assists, PK1/PK2 tag
- **Detail chips** — SOG vs, SA, xGA, blocks, duration with tooltip
- **Blocker attribution** — named chips (🛡️ Slavin ×2) from `blockingPlayerId` in PBP events
- **Shot type breakdown** — OPP shot types against
- **Mini shot map** — OPP shot locations shown in blue (opponent perspective)

### xG — Expected Goals
- **Team xG in Team Stats card** — two sources, automatically selected:
  - *Live games:* coordinate-estimate model (shot distance + angle + shot type bonus)
  - *Completed games:* MoneyPuck 5v5 xG from `game_xg` Supabase table (available ~2–4h post-game)
  - Label shows `xG 5v5` (MoneyPuck) vs `xG (est)` (live estimate)
- **Player xGF/60 and xGA/60** — shown in Analytics tab context row from MoneyPuck `player_seasons` data

### Schedule Page

**Regular Season**
- Game cards with result, score, opponent
- Win probability chip on upcoming games (model + market odds blended 60/40)
- Matchup detail: score prediction, win probability bar with factor breakdown, AI analysis

**Playoffs**
- Collapsible round sections
- Series card with game-by-game results
- 🧹 Sweep badge
- Series record factored into win probability

**AI Game Summary Card** (completed games)
- Claude Haiku generates 3-sentence narrative on game completion
- Stat chips: CF%, GWG scorer, goalie SV%, result

### Team Page (5 tabs)

**Overview** — W-L-OTL, points, goals, PP%, PK%, SOG, blocked shots

**Advanced** — Color-coded stats with league average benchmarks (▲/▼ indicators):
- Corsi For% (CF%) — approximated from SOG + blocked shots
- Fenwick For% (FF%) — SOG-based
- PDO, SH%, SV%
- PP%, Net PP%, PK%, Net PK%, Faceoff Win%
- Goals For/Against per game

**Splits** — Home vs Away detailed breakdown with toggle for Playoffs (when applicable):
- Scoring, Shot Volume, Special Teams, Efficiency, Results
- Green = better split

**Trends** — Rolling result dots, goal differential chart

**Cap** — Salary cap bar, contract table, draft picks

### Players Page

Each player popup has three tabs:

**📊 Stats** — Season/career stats, contract details, contract value rating, P/60
- Regular Season / Playoffs toggle on stats table
- **Skater contract value** — blended score: 60% points/$M (proj. to 82GP) + 40% WAR/$M (×6 scale factor); falls back to points-only when WAR unavailable
- **Goalie contract value** — GSAX/$M; scale: ≥4.0 Exceptional → <−2.0 Overpaid
- ELC contracts excluded from value scoring

**🧮 Analytics** — MoneyPuck-powered, updated nightly:
- **Skaters** — WAR headline + 10 percentile bars + xGF/60 and xGA/60 context chips
- **Goalies** — GSAX headline, GSAX/60, 5on5/HD/MD/PK SV% chips, 6 percentile bars

**🎯 Heat Map** — Shot location maps per player (Supabase `shot_events`)

### Game Event Popups
- **🏒 Puck Drop** — fires once at game start — 6s
- **🚨 CAR Goal** — scorer, assists, shot type, period/time; goal horn — 8s
- **⚡ Opponent Penalty** — player, infraction, duration — 12s
- **🏆 Canes Win** — confetti animation, final score — 12s
- All deduped via `sessionStorage`

### Push Notifications (Web Push)
- Events: CAR goal, game start, opponent penalty (PP), Canes win
- Payloadless push — SW fetches payload from Worker KV on receipt (3 retries, 300ms apart)
- iOS: requires Add to Home Screen (PWA)

### Social Posting (X/Twitter — ready, awaiting Basic tier)
- Posts after each game with score, AI summary snippet, hashtags, app link
- OAuth 1.0a signing built into Worker

### Accessibility (WCAG 2.1 AA / Section 508)
- All color pairs pass AA contrast ratios (verified against hex values)
- Skip link, focus-visible styles, `aria-label` and `aria-expanded` on interactive elements
- Touch targets ≥44×44px (with documented exceptions for inline decorative elements)
- Section 508 compliance achieved via WCAG 2.1 AA (2017 update incorporates WCAG 2.0 AA)

---

## Win Probability Model

8-factor model used on both game card chips and matchup detail:

| Factor | Weight | Notes |
|--------|--------|-------|
| GF/GP | 0.7 | Offensive efficiency |
| GA/GP | 0.7 | Defensive efficiency |
| SOG/GP | 0.5 | Possession proxy |
| PP vs PK | 0.4 | Special teams edge |
| Standings pts | 0.5 | Regular season only |
| Recent form/streak | 0.3 | Win/loss streak |
| Home ice | 0.25 | Venue advantage |
| Series record | up to 1.0 | Playoffs only |

Blended 60/40 with market odds when available.

---

## Data Pipeline (`eyewall-pipeline`)

A separate Python pipeline runs nightly via GitHub Actions (3 AM ET) and populates Supabase.

**Repo:** `github.com/ehlersio/eyewall-pipeline`

| Module | Description |
|--------|-------------|
| `run.py` | Orchestrator — runs all modules in dependency order |
| `nhl_stats.py` | Rosters, skater/goalie/team stats, game log → Supabase |
| `shot_events.py` | League-wide shot coordinates from PBP → `shot_events` |
| `shift_data.py` | League-wide shift charts → `shift_events`; **parallelized** (10 workers); failed games written to `skipped_games` |
| `zone_starts.py` | Per-player OZ/DZ/NZ start counts → `zone_starts`; **parallelized** (8 workers); failed games written to `skipped_games` |
| `rapm.py` | 3-year rolling ridge regression RAPM → `player_seasons.rapm` |
| `moneypuck.py` | WAR + percentiles + goalie GSAX + game-level xG → Supabase |
| `validate_rapm.py` | RAPM quality checks; exits non-zero on fail → GitHub Actions email |

**Run order:** `nhl_stats → shot_events → shift_data → zone_starts → rapm → moneypuck → validate_rapm`

**Supabase tables:** `players`, `player_seasons`, `goalie_seasons`, `team_seasons`, `shot_events`, `shift_events`, `zone_starts`, `game_log`, `game_xg`, `rapm_validation`, `skipped_games`

**Dependencies:** `requirements.txt` includes `scikit-learn` and `scipy` for RAPM ridge regression.

### RAPM methodology (beta)

True Regularized Adjusted Plus-Minus via ridge regression:

- **Pool:** 3-year rolling window (~420k 5v5 shot events across all 32 teams)
- **Formulation:** Signed xG — positive for reference team, negative for opponent
- **Zone-start adjustment:** `weight = 1.0 + (0.50 - OZS%) × 0.5`
- **Score-state adjustment:** Pending (`home_team` column needed in `shot_events`)
- **Ridge alpha:** 2500 (will be tuned after 3+ full seasons)
- **Minimum sample:** 150 minutes EV ice time across 3-season pool
- **Validation:** Quarterly correlation vs Evolving Hockey public RAPM (target r ≥ 0.85)
- **Labeled beta in UI**

### Game-level xG (MoneyPuck)

`moneypuck.py` fetches the all-teams game-by-game CSV (`careers/gameByGame/all_teams.csv`), filters to 5v5 and the current season, and writes `xgf`, `xga`, `xgf_pct` per team per game to the `game_xg` table. Available ~2–4h post-game; frontend falls back to coordinate-estimate xG during live games.

---

## MoneyPuck Analytics

The pipeline fetches `skaters.csv` from MoneyPuck nightly and computes analytics for all NHL players.

**WAR methodology** (RAPM-derived, beta):
1. **EV component** — 5v5 RAPM × EV ice time hours
2. **PP component** — PP xGF/60 above average × PP ice time (min 300s)
3. **PK component** — PK xGA/60 below average × PK ice time (min 300s)
4. **Finishing** — goals above xGoals × 0.3
5. **Penalties** — penalty minutes × 0.11 goals × 0.3
6. Convert to wins: sum ÷ 5.4 + 0.5

Falls back to xGoals-above-average for players without RAPM data.

**Goalie analytics** (`goalie_seasons` table):
- **GSAX** — flurry-adjusted xGoals minus actual goals against
- **GSAX/60** — rate-adjusted
- **5on5 SV%**, **HD/MD/PK SV%** — from MoneyPuck situation splits
- All metrics include percentile rankings vs all NHL goalies (min 10 GP)

### Special Teams Unit Configs (`ppUnits.js`)

Hardcoded unit configurations used for PP/PK unit detection in the drill-down panels. Updated each season and after trades.

**20252026:**
- PP1: Jarvis, Aho, Ehlers, Gostisbehere, Svechnikov
- PP2: Hall, Stankoven, Ehlers, Blake, K'Andre Miller
- PK1: Staal, Martinook, Slavin, Chatfield
- PK2: Aho, Jarvis, K'Andre Miller, Walker

Unit detection uses ≥2 player overlap matching against event participant IDs (shooters, scorers, assisters, blockers). Note in UI explains players who didn't touch the puck may not appear.

---

## Data Sources

| Data | Source | Update frequency |
|------|--------|-----------------|
| Schedule, scores, PBP | NHL API (`api-web.nhle.com/v1`) | Live (60s poll) |
| Team stats, standings | NHL Stats API (`api.nhle.com/stats/rest/en`) | Every 5–10 min |
| Team logos, headshots | NHL Assets (`assets.nhle.com`) | Cached |
| Salary cap, contracts | Static `carContracts.js` (PuckPedia) | Manual |
| Game summaries | Claude Haiku (Anthropic) | On game completion |
| Player/goalie/team stats | NHL API → Supabase via pipeline | Nightly (3 AM ET) |
| Shot events (league-wide) | NHL PBP → Supabase via pipeline | Nightly |
| Shift events (league-wide) | NHL shift charts → Supabase via pipeline | Nightly |
| Zone starts (league-wide) | NHL PBP faceoffs → Supabase via pipeline | Nightly |
| Skater WAR + RAPM + percentiles | MoneyPuck CSV + ridge regression → Supabase | Nightly |
| Goalie GSAX + percentiles | MoneyPuck CSV → Supabase | Nightly |
| Game-level xG (5v5) | MoneyPuck all-teams game-by-game CSV → Supabase | Nightly |
| News | Canes Country, Google News, ESPN, Sportsnet, r/canes | 30 min |

**Cap data last updated:** May 2026 · Source: PuckPedia

---

## Local Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Run unit tests
npm run test:watch # Watch mode
npm run build      # Production build
```

**Dev tools** — visit `http://localhost:5173/dev` for the live game replay scrubber (DEV only, stripped from prod build).

**Debug panel** — tap the score bar 5 times during a live game to open. Works in prod. Sections: Popups, Insights (including challenge/review), Situation, Push.

```
VITE_WORKER_URL=https://eyewall-poller.billowing-queen-bf23.workers.dev
VITE_VAPID_PUBLIC_KEY=BHuReh0oBGitFpWQpzEkxM-0m2XHxDX3hqfvX6lpA-IfKSivoB892Jvs64Uz7oNOF-NvDIpPeeBAcWwsIRpnKX4
```

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

**To backfill shot data:**
```
GET /shots/backfill?secret=POLL_SECRET&batch=5
```
Call repeatedly until `remaining: 0`.

**To refresh MoneyPuck analytics:**
```
GET /moneypuck/refresh?secret=POLL_SECRET
```

**To backfill game xG** (new season or after pipeline fix):
```bash
python -c "from db import get_client; from moneypuck import run_game_xg, NHL_SEASON; run_game_xg(get_client(), NHL_SEASON)"
```

---

## Testing

```bash
npm test            # Run all tests once
npm run test:watch  # Watch mode
```

Test files:
- `src/utils/prediction.test.js` — win probability model (7 tests)
- `src/utils/news.test.js` — HTML stripping, time formatting, URL cleaning (16 tests)
- `src/utils/advancedStats.test.js` — Corsi, PDO, GSAx, Puck Luck (15 tests)

CI runs `npm test` + `npm run build` on every push to `main` or `dev`.

---

## Advanced Stats Definitions

| Stat | Formula | Context |
|------|---------|---------|
| **CF%** | CAR shot attempts ÷ total (SOG + missed + blocked) | ≥50% = controlling play |
| **FF%** | CAR unblocked attempts ÷ total unblocked | Excludes shot-blocking luck |
| **PDO** | (SH% + SV%) × 100 | League avg = 100; far from 100 = luck |
| **Puck Luck** | Actual GF − expected GF from shot share | Positive = scoring above shot quality |
| **GSAx** | Saves − (shots × .900) | Game-level estimate; real GSAX used from Supabase when available |
| **GSAX** | Flurry-adjusted xGoals − actual goals against | MoneyPuck model; accounts for shot quality and volume |
| **WAR** | RAPM EV component × EV hours ÷ 5.4 + PP/PK/finishing + 0.5 | Beta — RAPM-derived EV, xGoals PP/PK |
| **RAPM** | Ridge regression marginal xG/60 at 5v5 | Beta — zone-start adjusted, score-state pending |
| **xGF%** | On-ice expected goals for ÷ total | Possession quality metric |
| **xG (coordinate)** | Distance + angle + shot type model | Live estimate; replaced by MoneyPuck post-game |
| **xG (MoneyPuck)** | Full shot quality model (pre-shot movement, traffic, distance, angle) | Available ~2–4h post-game |
| **GSAX/$M** | Season GSAX ÷ cap hit in $M | Goalie contract value — quality-adjusted |
| **Blended value** | (Points/$M × 0.6) + (WAR/$M × 6 × 0.4) | Skater contract value — rewards two-way play |
| **Momentum%** | Weighted zone events: shots (1.0/0.7), OZ faceoff wins (0.6), OZ hits/takeaways (0.4–0.5) | Inspired by NHL Edge Ice Tilt |

---

## Known Limitations

- **Cron minimum:** 1-minute polling intervals — live data is 0–60s behind NHL API.
- **Cap data:** NHL API doesn't expose salary. Static file requires manual updates.
- **iOS push:** Requires Add to Home Screen — browser-tab Safari cannot receive Web Push.
- **WAR/RAPM beta:** Score-state adjustment pending (`home_team` in `shot_events`). Zone-start OZS% for some players (e.g. Slavin) still being refined. Validated periodically vs Evolving Hockey public RAPM.
- **PP/PK unit detection:** Based on players who touched the puck in each opportunity. Players who didn't handle the puck won't appear. Some opportunities may be untagged when fewer than 2 config players are detectable.
- **Cross-team players:** RAPM reflects 3-year history, not just current team.
- **Opponent goalie GSAX:** Only CAR goalies have Supabase GSAX; opposing goalies fall back to estimated game-level GSAx.
- **Playoff analytics:** MoneyPuck only provides regular season data. PP/PK percentiles and WAR reflect regular season only.
- **X/Twitter posting:** Code is built and tested. Requires Basic tier ($100/mo) to post.
- **skipped_games table:** Games that fail shift/zone_starts fetching are permanently skipped after one attempt. Re-process by deleting relevant rows from `skipped_games`.

---

## Offseason Roadmap

- [ ] `app_config` Supabase table for season constant (`current_season`) — eliminate hardcoded `20252026` across frontend and pipeline
- [ ] `pp_units` / `pk_units` Supabase table — replace static `ppUnits.js` so unit changes from trades don't require a deploy
- [ ] MoneyPuck skaters URL — derive `/2025/regular/` from `NHL_SEASON[:4]` instead of hardcoding
- [ ] RAPM score-state adjustment (add `home_team` to league-wide `shot_events`)
- [ ] RAPM alpha tuning via cross-validation (after 3+ full seasons of data)
- [ ] RAPM validation chip in UI (`r=X.XX vs EH`) surfacing `rapm_validation` table
- [ ] Update `SMOKE_TESTS.md` with RAPM, PP/PK analysis, xG, challenge/review test cases
- [ ] 32-team expansion (team picker, parameterize CAR-specific code)
- [ ] PuckPedia API integration (pending access approval)
- [ ] X/Twitter auto-posting (when Basic tier active)
- [ ] Year-over-year player comparison view
- [ ] NHL EDGE zone time endpoint for live Momentum card improvement

---

*Built with 🌀 for Canes Nation*
