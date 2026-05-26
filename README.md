# EyeWall Analytics

> Carolina Hurricanes advanced stats and analytics — live shot maps, possession metrics, push notifications, and AI-generated game summaries.

**Live at:** [eyewallanalytics.com](https://eyewallanalytics.com)  
**Contact:** matt@eyewallanalytics.com  
**Support the project:** [buymeacoffee.com/mattehlers](https://buymeacoffee.com/mattehlers)

---

## Overview

EyeWall Analytics is a React PWA delivering real-time and historical Carolina Hurricanes data entirely from the public NHL API. It combines live polling, a Cloudflare Worker caching layer, Web Push notifications, and Claude AI game summaries into a mobile-first experience for Canes fans who want to go deeper than the box score.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite, react-router-dom v6 |
| Styling | CSS custom properties (design tokens), no CSS framework |
| Charts | D3 v7, SVG-based IceRink component |
| Hosting | Cloudflare Pages (auto-deploys from GitHub `main`) |
| API Proxy | Cloudflare Pages Functions (`functions/`) |
| Cache Layer | Cloudflare Worker + KV (`eyewall-poller`) |
| Push Notifications | Web Push API (VAPID), Service Worker |
| AI Summaries | Anthropic Claude Haiku via Worker |
| Data Source | NHL public API (no authentication required) |
| Cap Data | Static `carContracts.js` (source: PuckPedia) |

---

## Repository Structure

```
canes-analytics-starter/
├── index.html                    # PWA entry point, manifest links
├── public/
│   ├── sw.js                     # Service worker (Web Push handler)
│   ├── manifest.json             # PWA manifest (Add to Home Screen)
│   ├── goal-horn.mp3             # CAR goal horn audio
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
│   │   ├── ShotMapView.jsx/.css  # Live shot map, metrics, events
│   │   ├── ScheduleView.jsx/.css # Season + playoff schedule, predictions
│   │   ├── TeamView.jsx/.css     # 5-tab team analytics
│   │   └── PlayersView.jsx/.css  # Roster, player cards, contracts
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

### Worker Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Status, live game ID, subscriber count |
| `GET /cache/{key}` | Read any KV key |
| `POST /push/subscribe` | Save a push subscription |
| `POST /push/unsubscribe` | Remove a push subscription |
| `GET /poll?secret=` | Manual poll trigger |
| `GET /push/test?secret=` | Send test notification |
| `GET /summary/generate?secret=&force=1` | Generate AI summary for most recent game |

### Environment Variables

| Variable | Where | Notes |
|----------|-------|-------|
| `POLL_SECRET` | Worker | Protects `/poll` and `/push/test` endpoints |
| `VAPID_PUBLIC_KEY` | Worker + Pages | Web Push VAPID public key |
| `VAPID_PRIVATE_KEY` | Worker (encrypted) | Web Push VAPID private key |
| `VAPID_SUBJECT` | Worker | `mailto:matt@eyewallanalytics.com` |
| `ANTHROPIC_API_KEY` | Worker (encrypted) | Claude API for game summaries |
| `VITE_WORKER_URL` | Pages (build-time) | Worker base URL |
| `VITE_VAPID_PUBLIC_KEY` | Pages (build-time) | Web Push public key for browser |

---

## Features

### Shot Map (Live)
- SVG ice rink drawn to NHL spec (200×85ft at 3px/ft)
- Shot dots: CAR red, opponent blue, goals highlighted
- Heat map mode: Gaussian KDE density overlay
- Player filter: dropdown selector — filters dots + heat map to one player
- Period filter: P1 / P2 / P3 / OT
- Full rink / half rink toggle
- Live polling: 10s during games, 5min otherwise
- Countdown clock: ticks in real-time between polls, resyncs on each fetch

### Metrics Row (5 cards)
- **Shots on Goal** — CAR vs opponent, drill-down by player
- **Hits** — CAR vs opponent, drill-down by player
- **Blocks** — CAR blocks vs opponent, drill-down by player  
- **Faceoff %** — game faceoff win percentage
- **PP %** — season power play percentage

### Advanced Stats Panel
- Corsi For% (CF%) — all shot attempts share
- Fenwick For% (FF%) — unblocked attempt share
- PDO — shooting% + save% × 100 (league avg = 100)
- Puck Luck — actual goals vs expected from shot share
- GSAx — goals saved above expected vs .900 baseline

### CAR Scoring / Recent Events
- Scorer list built from PBP goals (no boxscore lag)
- Scrollable event log: goals, penalties, hits, blocks
- Assist attribution from PBP play details

### Game Events (Live)
- 🚨 **Goal popup** — scorer + assists, CAR goal horn audio, 8s auto-dismiss
- ⚡ **Penalty popup** — power play countdown timer from penalty duration
- 🏆 **Win popup** — confetti, 12s auto-dismiss, once per session
- All events detected from PBP delta — first load skipped to prevent false triggers
- OT goals captured even after `isLive` flips false

### Schedule Page

**Regular Season**
- Game cards with result, score, opponent
- Upcoming games: matchup detail with score prediction and scouting tab
- Completed games: full stats popup with scoring by period, goalie stats

**Playoffs**
- Collapsible round sections (current round open, older collapsed)
- Series card embedded in each round header
- 🧹 Sweep badge for 4-0 series results
- Game list within each round

**Matchup Detail**
- **Prediction tab**: Pythagorean expectation model (√(attack × defense) ± home/away adj), auto-saved on card open, track record displayed
- **Scouting tab**: both teams side-by-side — stat comparison bars, recent form dots, top skaters, goalies with GSAx

**AI Game Summary Card** (completed games)
- Claude Haiku generates 3-sentence narrative on game completion
- Stat chips: CF%, GWG scorer, goalie SV%, result
- Share button: Web Share API (mobile) / clipboard (desktop)

### Team Page (5 tabs)
- **Overview**: W-L-OTL, points, goals, PP%, PK%, SOG, blocks, live badge
- **Advanced**: Corsi proxy, PDO, Puck Luck, blocked shots for/against, PP/PK net%
- **Splits**: Home vs away, playoff vs regular season
- **Trends**: Rolling result dots, goal differential, form bars
- **Cap**: Salary cap bar, full contract table (cap hit, type, expiry), draft picks by year

### Players Page
- Full roster with positions and jersey numbers
- Player popup: season stats, contract details, cap hit visualization
- Contract value rating based on points per million

### Push Notifications (Web Push)
- Browser permission opt-in via bell icon in Topbar
- Notifications: CAR goal, game start, opponent penalty (PP), Canes win
- Payloadless push strategy — SW fetches payload from Worker KV on receipt
- iOS: requires Add to Home Screen (PWA) for push to work
- VAPID-authenticated delivery to Chrome (FCM) and Firefox (Mozilla Push)

### Topbar
- Live score with team logos
- Countdown clock (shared `liveClockStore` — pixel-perfect sync with Shot Map clock)
- 🔔 Notification bell with opt-in popup
- Logo tap → About popup with Buy Me a Coffee link

---

## Data Sources

| Data | Source | Endpoint |
|------|--------|----------|
| Schedule, scores, PBP | NHL API | `api-web.nhle.com/v1` |
| Team stats, standings | NHL Stats API | `api.nhle.com/stats/rest/en` |
| Team logos, player headshots | NHL Assets | `assets.nhle.com` |
| Salary cap, contracts | Static file | `src/utils/carContracts.js` |
| Draft picks | Static file | `src/utils/carContracts.js` |
| Game summaries | Claude Haiku (Anthropic) | Via Worker on game completion |

**Cap data last updated:** May 2026 · Source: PuckPedia

---

## Local Development

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Build for production
npm run build
```

**Environment variables for local dev** — create `.env.local` in project root:

```
VITE_WORKER_URL=https://eyewall-poller.billowing-queen-bf23.workers.dev
VITE_VAPID_PUBLIC_KEY=BHuReh0oBGitFpWQpzEkxM-0m2XHxDX3hqfvX6lpA-IfKSivoB892Jvs64Uz7oNOF-NvDIpPeeBAcWwsIRpnKX4
```

The Vite dev server proxies NHL API calls via `vite.config.js`. KV cache reads go directly to the live Worker URL.

---

## Deployment

Cloudflare Pages auto-deploys on every push to `main`.

**Build settings:**
- Build command: `npm install && node node_modules/vite/bin/vite.js build`
- Build output: `dist`
- Root directory: *(blank)*

**To force a deploy without code changes:**
```bash
git commit --allow-empty -m "Trigger Cloudflare build"
git push
```

**To update the Worker:**
1. Edit `eyewall-worker/worker.js`
2. Paste into Cloudflare Workers dashboard editor → Deploy
3. Or use Wrangler CLI: `wrangler deploy`

---

## Advanced Stats Definitions

| Stat | Formula | Context |
|------|---------|---------|
| **CF%** | CAR shot attempts ÷ total shot attempts | ≥50% = controlling play |
| **FF%** | CAR unblocked attempts ÷ total unblocked | More predictive than CF% |
| **PDO** | (SH% + SV%) × 100 | League avg = 100; far from 100 = luck component |
| **Puck Luck** | Actual GF − expected GF from shot share | Positive = scoring above shot quality |
| **GSAx** | Saves − (shots × .900) | Goals saved vs league-average goaltending |

---

## Score Prediction Model

Game predictions use a Pythagorean expectation model:

```
Expected CAR goals = √(CAR GF/GP × OPP GA/GP) ± 0.12 (home/away)
Expected OPP goals = √(OPP GF/GP × CAR GA/GP) ∓ 0.12 (home/away)
```

Clamped to realistic NHL range (1.5–5.0 goals). Predictions are auto-saved when a matchup card opens and outcomes auto-recorded when completed games load. Track record displayed inline.

---

## Salary Cap Data

Contract data is manually maintained in `src/utils/carContracts.js`. To update:

1. Check PuckPedia or official NHL transactions
2. Edit the `CONTRACTS` array (cap hit in dollars, e.g. `7_500_000`)
3. Update draft picks in `DRAFT_PICKS`
4. Update `CONTRACT_DATA_DATE` to current month/year
5. Commit and push — deploys automatically

**Note:** PuckPedia API access is being evaluated. If viable, the static file will be replaced with live Worker-cached data.

---

## Push Notification VAPID Keys

VAPID keys are generated once and stored permanently. The public key is baked into the Vite build; the private key lives as an encrypted Worker secret.

**Do not regenerate VAPID keys** unless all existing push subscriptions are acceptable to invalidate — they are tied to the public key and will stop working if the key changes.

---

## Known Limitations

- **Cron minimum:** Cloudflare free Workers allow 1-minute cron intervals. Live data is 0–60s behind the NHL API at any moment.
- **Cap data:** NHL API does not expose salary data. Static file requires manual updates.
- **iOS push:** Requires Add to Home Screen — browser-tab Safari cannot receive Web Push.
- **OT clock:** NHL API doesn't stream clock data during overtime stoppages.
- **32-team expansion:** Currently CAR-only. Expansion planned — most infrastructure is already parameterized.

---

## Roadmap

- [ ] 32-team expansion (team picker, parameterize CAR-specific code)
- [ ] PuckPedia API integration (pending access approval)
- [ ] Weekly digest card
- [ ] Season-level true Corsi/Fenwick (PBP aggregation across all games)
- [ ] Historic player heat maps on player card
- [ ] Social posting automation

---

*Built with 🌀 for Canes Nation*
