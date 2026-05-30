# EyeWall Analytics

> Carolina Hurricanes advanced stats and analytics — live shot maps, momentum tracking, push notifications, AI-generated game summaries, player heat maps, goalie analytics, and WAR/percentile rankings.

**Live at:** [eyewallanalytics.com](https://eyewallanalytics.com)  
**Contact:** matt@eyewallanalytics.com  
**Support the project:** [buymeacoffee.com/mattehlers](https://buymeacoffee.com/mattehlers)

---

## Overview

EyeWall Analytics is a React PWA delivering real-time and historical Carolina Hurricanes data entirely from the public NHL API and MoneyPuck. It combines live polling, a Cloudflare Worker caching layer, Web Push notifications, Claude AI game summaries, player shot heat maps, and MoneyPuck-powered WAR/percentile analytics into a mobile-first experience for Canes fans who want to go deeper than the box score.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite, react-router-dom v6 |
| Styling | CSS custom properties (design tokens), no CSS framework |
| Charts | D3 v7, SVG-based IceRink component |
| Hosting | Cloudflare Pages (auto-deploys from `main`; `dev` branch → preview) |
| API Proxy | Cloudflare Pages Functions (`functions/`) |
| Cache Layer | Cloudflare Worker + KV (`eyewall-poller`) |
| Database | Supabase (player/team/goalie stats, shot events) |
| Data Pipeline | Python (`eyewall-pipeline`) — NHL API + MoneyPuck → Supabase |
| Pipeline CI | GitHub Actions nightly cron (3 AM ET) |
| Push Notifications | Web Push API (VAPID), Service Worker |
| AI Summaries | Anthropic Claude Haiku via Worker |
| Analytics Data | MoneyPuck.com CSV (fetched nightly by pipeline) |
| Data Source | NHL public API (no authentication required) |
| Cap Data | Static `carContracts.js` (source: PuckPedia) |
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
│   │   ├── ShotMapView.jsx/.css  # Live shot map, metrics, live insights, momentum
│   │   ├── ScheduleView.jsx/.css # Season + playoff schedule, predictions
│   │   ├── TeamView.jsx/.css     # 5-tab team analytics
│   │   ├── PlayersView.jsx/.css  # Roster, player cards, analytics, heat maps
│   │   ├── NewsView.jsx/.css     # News feed (5 sources, filters, pagination)
│   │   └── DevReplayView.jsx/.css # Dev-only live game replay scrubber (/dev)
│   ├── components/
│   │   ├── Topbar.jsx/.css       # Live score, countdown clock, bells
│   │   ├── IceRink.jsx/.css      # SVG rink, heat map, player filter
│   │   ├── GameEvents.jsx/.css   # Goal/penalty/win popups
│   │   ├── ScoutingTab.jsx/.css  # Opponent scouting (side-by-side)
│   │   ├── NotificationBell.jsx  # Push notification opt-in UI
│   │   ├── AboutPopup.jsx/.css   # Logo tap → about + BMC link
│   │   ├── TeamLogo.jsx/.css     # NHL team logo renderer
│   │   ├── StatBar.jsx/.css      # Comparative stat bar
│   │   └── InfoTip.jsx/.css      # Tap-to-open tooltip
│   ├── hooks/
│   │   ├── useFetch.js           # Data fetching + polling hook
│   │   └── usePushNotifications.js # Web Push subscription management
│   └── utils/
│       ├── nhlApi.js             # All NHL API calls, KV-first caching
│       ├── advancedStats.js      # Corsi, Fenwick, PDO, GSAx, Puck Luck
│       ├── cache.js              # Module-level TTL cache, in-flight dedup
│       ├── carContracts.js       # Static CAR contract + draft pick data
│       ├── predictionStore.js    # localStorage game prediction tracker
│       ├── supabaseClient.js     # Supabase read-only client + data fetchers
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
- Score situation alerts (tied game, big lead, late deficit)
- Empty net detection
- **Auto-collapse** during live games (expands on new insight, collapses after 8s, tap to re-expand)

### Metrics Row (5 cards)
- **Shots on Goal** — CAR vs opponent, drill-down by player
- **Hits** — CAR vs opponent, drill-down by player
- **Blocks** — CAR blocks vs opponent
- **Faceoff %** — game faceoff win percentage
- **PP %** — season (or playoff) power play percentage

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
- **Skater contract value** — blended score: 60% points/$M (proj. to 82GP) + 40% WAR/$M (×6 scale factor); falls back to points-only when WAR unavailable; badge shows method (`blended/$M` vs `pts/$M`)
- **Goalie contract value** — GSAX/$M (goals saved above expected per $1M cap hit); scale: ≥4.0 Exceptional → <−2.0 Overpaid
- ELC contracts excluded from value scoring

**🧮 Analytics** — MoneyPuck-powered, updated nightly:
- **Skaters** — WAR headline + 10 percentile bars vs position group (EV offence/defence, PP, PK, finishing, goals, 1st assists, penalties, competition, teammates)
- PP/PK use `onIce_xGoalsPercentage` at 5on4/4on5 (min 300s ice time); N/A for non-PP/PK players
- **Goalies** — GSAX headline (flurry-adjusted, +/− color coded), GSAX/60, 5on5/HD/MD/PK SV% chips, 6 percentile bars vs all NHL goalies (min 10 GP)

**🎯 Heat Map** — Shot location maps per player:
- **Skaters** — CAR shot locations; filter by all/goals/SOG/missed; summary stats
- **Goalies** — shots faced (team='OPP' in `shot_events`); dot map + zone SV% toggle; shooter perspective; color-coded zones (green = strong, red = weak); SV% shown as decimal; min 5 shots per zone
- Data sourced from Supabase `shot_events` table (nightly pipeline, includes `goalie_id`)

**Goalie GSAX in Shot Map** — real season GSAX shown in goalie cards on the Shot Map page; falls back to estimated game-level GSAx for opposing goalies not in Supabase

**Scouting Tab (Schedule Page)** — goalie GSAX sourced from Supabase (same real data); `playerId` added to `getTeamTopPlayers` goalie objects to enable the lookup

### News Page
- 5 sources: Canes Country (Atom), Google News RSS, ESPN, Sportsnet, Reddit r/canes
- Source filter chips (built from actual article data)
- Pagination (10 per page)
- Reddit posts show upvote count and comment count
- Reddit posts include preview images when available

### Game Event Popups
In-app popups triggered by live PBP events — all auto-dismiss, tap to close early:
- **🏒 Puck Drop** — fires once at game start (P1, first play); text: "Pucks in deep. Pucks on net. Win the battles. Here we go, boys!" — 6s
- **🚨 CAR Goal** — scorer, assists, shot type, period/time; plays goal horn — 8s
- **⚡ Opponent Penalty** — player, infraction, duration; "CHEATERS NEVER WIN" — 12s
- **🏆 Canes Win** — confetti animation, final score — 12s
- All deduped via `sessionStorage` so page refresh doesn't retrigger
- Debug panel (5 taps on score bar) fires all four popups

### Push Notifications (Web Push)
- Notifications: CAR goal, game start, opponent penalty (PP), Canes win/loss
- Payloadless push — SW fetches payload from Worker KV on receipt
- iOS: requires Add to Home Screen (PWA) for push to work

### Social Posting (X/Twitter — ready, awaiting Basic tier)
- Posts after each game with score, AI summary snippet, hashtags, app link
- Hashtags: #LetsGoCanes #Canes #NHL #CarolinaHurricanes #SoundTheSiren + opponent + context
- OAuth 1.0a signing built into Worker (no external library)
- Test endpoint: `/social/test?secret=&post=1`

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

Blended 60/40 with market odds when available. Same function used by both game card chip and matchup detail bar — results are always consistent.

---

## Data Pipeline (`eyewall-pipeline`)

A separate Python pipeline runs nightly via GitHub Actions (3 AM ET) and populates Supabase with NHL and MoneyPuck data.

**Repo:** `github.com/ehlersio/eyewall-pipeline`

| Module | Description |
|--------|-------------|
| `run.py` | Orchestrator — runs all modules in dependency order |
| `nhl_stats.py` | Rosters, skater/goalie/team stats, game log → Supabase |
| `shot_events.py` | League-wide shot coordinates from PBP → `shot_events` table |
| `shift_data.py` | League-wide shift charts → `shift_events` table |
| `zone_starts.py` | Per-player OZ/DZ/NZ start counts from PBP faceoffs → `zone_starts` table |
| `rapm.py` | 3-year rolling ridge regression RAPM → `player_seasons.rapm` |
| `moneypuck.py` | WAR (RAPM-derived EV + PP/PK/finishing) + percentiles + goalie GSAX → Supabase |

**Run order:** `nhl_stats → shot_events → shift_data → zone_starts → rapm → moneypuck`

**Supabase tables:** `players`, `player_seasons`, `goalie_seasons`, `team_seasons`, `shot_events`, `shift_events`, `zone_starts`, `game_log`, `rapm_validation`

All tables store both regular season (`game_type=2`) and playoff (`game_type=3`) data. Historical seasons are preserved — new seasons add rows without overwriting.

### RAPM methodology (beta)

True Regularized Adjusted Plus-Minus via ridge regression:

- **Pool:** 3-year rolling window (~420k 5v5 shot events across all 32 teams)
- **Formulation:** Signed xG — positive for reference team, negative for opponent. Measures xG *differential* so forwards and defensemen are treated symmetrically.
- **Zone-start adjustment:** Players with DZ-heavy deployment get upward weight. `weight = 1.0 + (0.50 - OZS%) × 0.5`
- **Score-state adjustment:** Pending (requires `home_team` column in `shot_events` for non-CAR games)
- **Ridge alpha:** 2500 (standard starting point — will be tuned after 3+ full seasons)
- **Minimum sample:** 150 minutes EV ice time across 3-season pool
- **Validation:** Quarterly correlation vs Evolving Hockey public RAPM (target r ≥ 0.85)
- **Labeled beta in UI** — zone-start data still being refined; defensive defensemen may be slightly undervalued in current model

---

## MoneyPuck Analytics

The pipeline fetches `skaters.csv` and `goalies.csv` from MoneyPuck nightly and computes analytics for all NHL players, stored in Supabase.

**Skater analytics** (`player_seasons` table):

**WAR methodology** (RAPM-derived, beta):
1. **EV component** — 5v5 RAPM coefficient × EV ice time hours (ridge regression, 3-year rolling pool)
2. **PP component** — PP xGF/60 above average × PP ice time (MoneyPuck)
3. **PK component** — PK xGA/60 below average × PK ice time (MoneyPuck)
4. **Finishing** — goals above xGoals × 0.3 (individual finishing luck/skill)
5. **Penalties** — penalty minutes × 0.11 goals × 0.3
6. Convert to wins: sum ÷ 5.4 + 0.5 (replacement level)

Falls back to xGoals-above-average for players without RAPM data (rare).

PP/PK percentiles use `onIce_xGoalsPercentage` at 5on4/4on5 respectively (min 300s ice time).

**Goalie analytics** (`goalie_seasons` table):
- **GSAX** — flurry-adjusted xGoals minus actual goals against (positive = better than expected)
- **GSAX/60** — rate-adjusted
- **5on5 SV%**, **High/Medium danger SV%**, **PK SV%** — from MoneyPuck situation splits
- All metrics include percentile rankings vs all NHL goalies (min 10 GP)

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
| Shot events (all NHL at CAR) | NHL PBP → Supabase via pipeline | Nightly |
| Skater WAR + percentiles | MoneyPuck.com CSV → Supabase | Nightly |
| Goalie GSAX + percentiles | MoneyPuck.com CSV → Supabase | Nightly |
| News | Canes Country, Google News, ESPN, Sportsnet, r/canes | 30 min |

**Cap data last updated:** May 2026 · Source: PuckPedia

---

## Local Development

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Build for production
npm run build
```

**Dev tools** — visit `http://localhost:5173/dev` for the live game replay scrubber:
- Load any completed game by ID or pick from recent CAR games
- Scrub through the game or play at 10s–5m/s speed
- Period markers on the scrubber for quick jumps (P2, P3, OT)
- All live UI responds: topbar score/period/clock, momentum card, live insights, win popup
- Dev-only — completely absent from production build (`import.meta.env.DEV` guard)

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

**To update the Worker:**
1. Edit `eyewall-worker/worker.js`
2. Paste into Cloudflare Workers dashboard editor → Deploy

**To backfill shot data** (after a gap or new season):
```
GET /shots/backfill?secret=POLL_SECRET&batch=5
```
Call repeatedly until `remaining: 0`.

**To refresh MoneyPuck analytics:**
```
GET /moneypuck/refresh?secret=POLL_SECRET
```

---

## Testing

```bash
npm test          # Run all tests once
npm run test:watch  # Watch mode
```

Test files:
- `src/utils/prediction.test.js` — win probability model (7 tests)
- `src/utils/news.test.js` — HTML stripping, time formatting, URL cleaning (16 tests)
- `src/utils/advancedStats.test.js` — Corsi, PDO, GSAx, Puck Luck (15 tests)

CI runs `npm test` + `npm run build` on every push to `main` or `dev` via GitHub Actions.

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
| **GSAX/$M** | Season GSAX ÷ cap hit in $M | Goalie contract value — quality-adjusted |
| **Blended value** | (Points/$M × 0.6) + (WAR/$M × 6 × 0.4) | Skater contract value — rewards two-way play |
| **Momentum%** | Weighted zone events: shots (1.0/0.7), OZ faceoff wins (0.6), OZ hits/takeaways (0.4–0.5) | Inspired by NHL Edge Ice Tilt; zone location weighted |

---

## Known Limitations

- **Cron minimum:** 1-minute polling intervals — live data is 0–60s behind NHL API.
- **Cap data:** NHL API doesn't expose salary. Static file requires manual updates.
- **iOS push:** Requires Add to Home Screen — browser-tab Safari cannot receive Web Push.
- **WAR/RAPM beta:** 5v5 RAPM-derived WAR is a meaningful improvement over raw on-ice numbers but zone-start adjustment is still being refined. Score-state adjustment pending (requires `home_team` in league-wide `shot_events`). Defensive defensemen with heavy DZ deployment may be slightly undervalued. Validated periodically vs Evolving Hockey public RAPM.
- **Cross-team players:** Players traded mid-season have RAPM coefficients reflecting their entire 3-year history, not just their current team's system. Values will converge over time as current-team data accumulates.
- **32-team expansion:** Currently CAR-only. Infrastructure is parameterized for expansion.
- **X/Twitter posting:** Code is built and tested. Requires Basic tier ($100/mo) to post.
- **Opponent goalie GSAX:** Only CAR goalies have Supabase GSAX; opposing goalies fall back to estimated game-level GSAx.
- **Playoff analytics:** MoneyPuck only provides regular season data. PP/PK percentiles and WAR reflect regular season only.

---

## Roadmap

- [ ] 32-team expansion (team picker, parameterize CAR-specific code)
- [ ] PuckPedia API integration (pending access approval)
- [ ] X/Twitter auto-posting (when Basic tier active)
- [ ] Threads/Instagram posting (pending Meta developer access)
- [ ] Weekly digest card
- [ ] RAPM score-state adjustment (add `home_team` to league-wide `shot_events`)
- [ ] RAPM alpha tuning via cross-validation (after 3+ full seasons of data)
- [ ] RAPM validation chip in UI (`r=X.XX vs EH`) surfacing `rapm_validation` table
- [ ] Year-over-year player comparison view (data already stored by season)
- [ ] NHL EDGE zone time endpoint integration for live Momentum card improvement

---

*Built with 🌀 for Canes Nation*
