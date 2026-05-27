# EyeWall Analytics

> Carolina Hurricanes advanced stats and analytics — live shot maps, possession metrics, push notifications, AI-generated game summaries, player heat maps, and WAR/percentile rankings.

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
| Push Notifications | Web Push API (VAPID), Service Worker |
| AI Summaries | Anthropic Claude Haiku via Worker |
| Analytics Data | MoneyPuck.com CSV (fetched nightly by Worker) |
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
│   │   ├── ShotMapView.jsx/.css  # Live shot map, metrics, live insights
│   │   ├── ScheduleView.jsx/.css # Season + playoff schedule, predictions
│   │   ├── TeamView.jsx/.css     # 5-tab team analytics
│   │   ├── PlayersView.jsx/.css  # Roster, player cards, analytics, heat maps
│   │   └── NewsView.jsx/.css     # News feed (5 sources, filters, pagination)
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
│       └── liveClockStore.js     # Shared pub/sub for synced countdown clock
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

### Live Insights Panel
Auto-generated contextual callouts from PBP data, shown during live games and as post-game "Game Insights":
- Shot advantage by period (e.g. "CAR dominated P2 shots 18–6")
- Momentum indicator (last 10 shot attempts)
- Top scorer callout (2+ point games)
- PK performance (perfect kills highlighted)
- Score situation alerts (tied game, big lead, late deficit)
- Empty net detection

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

**🧮 Analytics** — MoneyPuck-powered, updated nightly:
- **WAR** (Wins Above Replacement) — simplified xGoals-based model
- **Percentile rankings** vs all NHL forwards or defensemen:
  - EV Offence (on-ice xGF% at 5-on-5)
  - EV Defence (on-ice xGA/60, inverted)
  - Power Play (xGF/60 on PP — N/A if insufficient PP time)
  - Penalty Kill (xGA/60 on PK — N/A if insufficient PK time)
  - Finishing (goals above xGoals per 60)
  - Goals (goals per 60)
  - 1st Assists (primary assists per 60)
  - Penalties (discipline: drawn minus taken)
  - Competition (quality of opponents faced)
  - Teammates (on-ice vs off-ice xGF% delta)
- Color-coded bars: green ≥67th, amber 33–66th, red ≤33rd

**🎯 Heat Map** — Season shot locations on the rink:
- All shots aggregated across completed games
- Filter chips: All / Goals / SOG / Missed
- Summary: Goals, SOG, missed, total, SH%
- Data builds up game by game via Worker shot aggregation

### News Page
- 5 sources: Canes Country (Atom), Google News RSS, ESPN, Sportsnet, Reddit r/canes
- Source filter chips (built from actual article data)
- Pagination (10 per page)
- Reddit posts show upvote count and comment count
- Reddit posts include preview images when available

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

## MoneyPuck Analytics

The Worker fetches `https://moneypuck.com/moneypuck/playerData/seasonSummary/2025/regular/skaters.csv` nightly and computes analytics for all CAR players. The CSV has 154 columns per player across multiple situations (`5on5`, `powerPlay`, `penaltyKill`, `all`).

**WAR methodology** (simplified approximation — not full prior-informed RAPM):
1. On-ice xGF/60 and xGA/60 at 5-on-5 compared to positional league average
2. Multiply by EV ice time to get goals above average
3. Add penalty impact (0.11 goals per penalty minute, from TopDownHockey methodology)
4. Add individual finishing (goals vs xGoals)
5. Convert to wins using ~5.4 goals per win
6. Add replacement level baseline (~+0.5 per 82 games)

**Note:** This is clearly labeled as an approximation. True RAPM requires shift-level ridge regression (~600k rows/season) which is beyond browser/Worker compute capacity.

---

## Data Sources

| Data | Source | Update frequency |
|------|--------|-----------------|
| Schedule, scores, PBP | NHL API (`api-web.nhle.com/v1`) | Live (60s poll) |
| Team stats, standings | NHL Stats API (`api.nhle.com/stats/rest/en`) | Every 5–10 min |
| Team logos, headshots | NHL Assets (`assets.nhle.com`) | Cached |
| Salary cap, contracts | Static `carContracts.js` (PuckPedia) | Manual |
| Game summaries | Claude Haiku (Anthropic) | On game completion |
| Shot heat map data | Aggregated from NHL PBP | After each game |
| WAR + percentiles | MoneyPuck.com CSV | Nightly |
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

**Environment variables** — copy `.env.local.example` to `.env.local`:

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
| **GSAx** | Saves − (shots × .900) | Goals saved vs league-average goaltending |
| **WAR** | Goals above average ÷ goals per win | Approximate — xGoals model, not full RAPM |
| **xGF%** | On-ice expected goals for ÷ total | Possession quality metric |

---

## Known Limitations

- **Cron minimum:** 1-minute polling intervals — live data is 0–60s behind NHL API.
- **Cap data:** NHL API doesn't expose salary. Static file requires manual updates.
- **iOS push:** Requires Add to Home Screen — browser-tab Safari cannot receive Web Push.
- **WAR approximation:** True RAPM requires shift-level ridge regression not feasible in Workers. Current WAR uses xGoals above average as a proxy.
- **32-team expansion:** Currently CAR-only. Infrastructure is parameterized for expansion.
- **X/Twitter posting:** Code is built and tested. Requires Basic tier ($100/mo) to post.

---

## Roadmap

- [ ] 32-team expansion (team picker, parameterize CAR-specific code)
- [ ] PuckPedia API integration (pending access approval)
- [ ] X/Twitter auto-posting (when Basic tier active)
- [ ] Threads/Instagram posting (pending Meta developer access)
- [ ] Weekly digest card
- [ ] True RAPM (would require separate Python compute service)

---

*Built with 🌀 for Canes Nation*
