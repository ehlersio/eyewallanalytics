# EyeWall Analytics

> Advanced NHL + PWHL analytics — live shot maps, period summaries, momentum tracking, special teams analysis, push notifications, AI-generated game summaries, player heat maps, goalie analytics, WAR/percentile rankings, AI-powered league power rankings, live draft board, and full PWHL analytics suite.

**Live at:** [eyewallanalytics.com](https://eyewallanalytics.com)  
**Contact:** matt@eyewallanalytics.com  
**Support the project:** [buymeacoffee.com/mattehlers](https://buymeacoffee.com/mattehlers)

---

## Overview

EyeWall Analytics is a React PWA delivering real-time and historical NHL and PWHL data from the public NHL API, MoneyPuck, HockeyTech, and PWHLPA. It combines live polling, a Cloudflare Worker caching layer, Web Push notifications, Workers AI-generated period/game summaries and matchup analysis, player shot heat maps, MoneyPuck-powered WAR/percentile analytics, true RAPM via ridge regression, AI-powered nightly power rankings, a live draft board with Central Scouting rankings and AI pick analysis, and a full PWHL analytics suite into a mobile-first experience for hockey fans who want to go deeper than the box score.

Users select their league (NHL or PWHL) and team on first launch. All views, colors, and data scope to the selected team. The sport, team, and theme preference are persisted to `localStorage` and applied on every subsequent load.

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
| Database | Supabase Pro (NHL + PWHL player/team/goalie stats, shot events, RAPM, game xG, power rankings, draft data, salaries) |
| NHL Data Pipeline | Python (`eyewall-pipeline`) — NHL API + MoneyPuck + Tankathon → Supabase |
| PWHL Data Pipeline | Python (`eyewall-pipeline`) — HockeyTech + PWHLPA → Supabase |
| Pipeline CI | GitHub Actions — nightly data cron (3 AM ET) + AI pipeline + draft day ingest + PWHL news |
| Push Notifications | Web Push API (VAPID), Service Worker |
| AI | Cloudflare Workers AI — `@cf/meta/llama-3.1-8b-instruct-fp8-fast` (period/game summaries, predictions, matchup analysis, scouting blurbs, power rankings narratives, draft pick analysis) |
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
│   ├── eyewall-logo.svg/.png
│   └── favicon-*.png / .ico
├── functions/                    # Cloudflare Pages Functions (API proxy)
│   ├── nhl-api/[[path]].js
│   ├── nhl-stats/[[path]].js
│   ├── nhl-assets/[[path]].js
│   └── api/notification.js
├── src/
│   ├── App.jsx                   # Router, layout, sport context, theme init
│   ├── views/
│   │   ├── ShotMapView.jsx/.css        # NHL live shot map
│   │   ├── ScheduleView.jsx/.css       # NHL schedule
│   │   ├── TeamView.jsx/.css           # NHL 6-tab team analytics
│   │   ├── PlayersView.jsx/.css        # NHL players
│   │   ├── LeagueView.jsx/.css         # NHL 5-tab league page
│   │   ├── NewsView.jsx/.css           # NHL news feed
│   │   ├── PWHLShotMapView.jsx         # PWHL shot map + PBP metrics
│   │   ├── PWHLScheduleView.jsx        # PWHL schedule + calendar + playoffs
│   │   ├── PWHLTeamView.jsx            # PWHL 5-tab team analytics
│   │   ├── PWHLPlayersView.jsx         # PWHL roster + stats + player popup
│   │   ├── PWHLLeagueView.jsx          # PWHL 5-tab league page
│   │   ├── PWHLNewsView.jsx            # PWHL news feed
│   │   ├── DevReplayView.jsx/.css      # Dev-only live game replay (/dev)
│   │   └── DevDraftView.jsx            # Dev-only draft simulator (/dev/draft)
│   ├── components/
│   │   ├── Topbar.jsx/.css             # Live score, countdown clock, sport switcher
│   │   ├── BottomNav.jsx               # Sport-aware bottom navigation
│   │   ├── TeamPicker.jsx              # Sport + team selection (NHL + PWHL)
│   │   ├── IceRink.jsx/.css            # SVG rink — shots, heat map, team-aware
│   │   ├── PWHLPlayerPopup.jsx         # PWHL player popup (Stats, Heat Map, Scout)
│   │   ├── PlayerPopup.jsx             # NHL player popup (Stats, Analytics, Heat Map)
│   │   ├── GameEvents.jsx/.css         # Goal/penalty/win/puck drop popups
│   │   ├── ScoutingTab.jsx/.css        # NHL opponent scouting
│   │   ├── DraftTab.jsx/.css           # NHL draft board
│   │   ├── NotificationBell.jsx        # ⚙️ Settings drawer
│   │   ├── PeriodSummary.jsx/.css      # Period/game summary popup + share canvas
│   │   ├── TeamLogo.jsx/.css           # NHL + PWHL team logo renderer
│   │   ├── CalendarView.jsx            # NHL calendar month view
│   │   ├── PWHLCalendarView.jsx        # PWHL calendar month view
│   │   ├── InfoTip.jsx/.css            # Tap-to-open tooltip
│   │   └── StatBar.jsx/.css            # Comparative stat bar
│   ├── hooks/
│   │   ├── useFetch.js                 # Data fetching + polling (cache: no-store)
│   │   ├── usePushNotifications.js
│   │   ├── usePeriodSummary.js
│   │   └── useWakeLock.js
│   └── utils/
│       ├── nhlApi.js                   # NHL API calls + KV caching
│       ├── pwhlApi.js                  # PWHL Worker API calls
│       ├── pwhlConfig.js               # PWHL team configs (8 active + 4 expansion)
│       ├── teamConfig.js               # NHL 32-team configs; CURRENT_SEASON flip point
│       ├── SportContext.jsx            # Sport state (NHL/PWHL) + localStorage persistence
│       ├── advancedStats.js
│       ├── supabaseClient.js
│       └── analytics.js
├── src/utils/__tests__/
│   └── *.test.js                       # Vitest unit tests (8 files, 138 tests)
├── cypress/
│   ├── e2e/
│   │   ├── navigation.cy.js            # NHL + PWHL route navigation (all 8 PWHL teams)
│   │   ├── news.cy.js                  # NHL news
│   │   ├── pwhl-news.cy.js             # PWHL news
│   │   ├── period-summary.cy.js        # Game Center
│   │   ├── players.cy.js               # NHL players
│   │   ├── pwhl-players.cy.js          # PWHL players (4 teams)
│   │   ├── schedule.cy.js              # NHL schedule
│   │   ├── pwhl-schedule.cy.js         # PWHL schedule (8 teams)
│   │   ├── shot-map.cy.js              # NHL shot map
│   │   ├── pwhl-shot-map.cy.js         # PWHL shot map (8 teams)
│   │   ├── team.cy.js                  # NHL team (4 teams, all 6 tabs)
│   │   ├── pwhl-team.cy.js             # PWHL team (4 teams, all 5 tabs)
│   │   ├── league.cy.js                # NHL league (all 5 tabs)
│   │   ├── pwhl-league.cy.js           # PWHL league (all 5 tabs)
│   │   ├── draft.cy.js                 # NHL draft board
│   │   ├── theme.cy.js                 # Light/dark mode
│   │   └── viewports.cy.js             # 4 viewports × all views
│   └── support/e2e.js                  # Custom commands incl. cy.setPWHLTeam()
└── .github/workflows/test.yml
```

---

## Sport Selection & Theming

### Sport picker
On first launch the user selects NHL or PWHL, then their team. The sport is stored under `eyewall:sport` and the team under `eyewall:team` (NHL) or `eyewall:pwhl_team` (PWHL). `SportContext` exposes `isPWHL` throughout the app — all routing, `BottomNav` tabs, and data fetching scope accordingly.

### PWHL teams
8 active teams: BOS (Boston Fleet), MIN (Minnesota Frost), MTL (Montréal Victoire), NY (New York Sirens), OTT (Ottawa Charge), TOR (Toronto Sceptres), SEA (Seattle Torrent), VAN (Vancouver Goldeneyes).

4 expansion teams (2026–27, deferred until HockeyTech assigns IDs in October 2026): DET, HAM, LAS, SJS.

### Color tokens
Same mechanism as NHL — `applyTeamTheme()` sets `--team-primary`, `--team-primary-rgb`, `--team-canvas`, `--team-canvas-rgb` on `:root` from `displayColor`.

### Season constants
- `CURRENT_SEASON = '20252026'` in `teamConfig.js` — NHL flip point
- `PWHL_CURRENT_SEASON = 8` in `pwhlConfig.js` — PWHL regular season ID
- Both must be updated each October along with `NHL_SEASON` and `PWHL_SEASON` GH Actions secrets

---

## Cloudflare Worker (`eyewall-poller`)

**Worker URL:** `https://eyewall-poller.billowing-queen-bf23.workers.dev`

### PWHL KV Keys

| Key | Content | TTL |
|-----|---------|-----|
| `pwhl:standings:{season}` | All 8 teams' standings + L10 + streak | 1 hr |
| `pwhl:players:{teamId}:{season}` | Skaters + goalies + roster | 1 hr |
| `pwhl:schedule:{teamId}:{season}` | Team schedule with scores + dates | 30 min |
| `pwhl:shots:{teamId}:{gameId}` | Shot events for a game | 6 hr |
| `pwhl:pshots:{playerId}:{season}` | Player shot coordinates for heat map | 6 hr |
| `pwhl:salaries:{teamId}:{season}` | Team salary data | 24 hr |
| `pwhl:leagueplayers:{season}` | All 8 teams' skaters + goalies | 2 hr |
| `pwhl:news` | Aggregated PWHL news articles | 30 min |

### PWHL Worker Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /pwhl/standings?season=` | Standings + L10 + streak from game log |
| `GET /pwhl/players?teamId=&season=` | Team skaters + goalies + roster |
| `GET /pwhl/schedule?teamId=&season=` | Team schedule |
| `GET /pwhl/shots?teamId=&gameId=` | Game shot events |
| `GET /pwhl/player-shots?playerId=&season=` | Player shot history for heat map |
| `GET /pwhl/pbp?gameId=` | Play-by-play events |
| `GET /pwhl/scout` (POST) | Workers AI scouting report |
| `GET /pwhl/salaries?teamId=&season=` | Team salary data |
| `GET /pwhl/league-players?season=` | All 8 teams' players (Leaders tab) |
| `GET /pwhl/news` | PWHL news feed |
| `POST /pwhl/news/ingest` | Accept articles from GH Actions pipeline |
| `POST /pwhl/news/bust` | Invalidate news cache |
| `POST /pwhl/cache/bust?teamId=&season=` | Invalidate team KV cache |

---

## Features

### NHL Features
All existing NHL features unchanged — see original documentation. Key features:
- Live shot map with momentum, insights, PP/PK drill-downs
- Period summaries with AI narrative, goals carousel, share export
- 6-tab team page (Overview, Advanced, Splits, Trends, Cap, Picks)
- League page (Standings, Bracket, Leaders, Power Rankings, Draft)
- Player analytics (WAR, RAPM, GSAX, heat maps)
- Push notifications (goal, game start, penalty, win)

### PWHL Features

**Shot Map** — Same IceRink component as NHL. Corsi/Fenwick panel (no missed shots in HockeyTech — FF% is SOG-based proxy). PP/PK analysis drill-downs. Season picker (2023-24 / 2024-25 / 2025-26). Faceoff events from PBP (HockeyTech `homeWin` string `"0"`/`"1"` fix applied).

**Schedule** — Regular season cards with SortBar (newest/oldest), calendar toggle, venue city. Playoffs tab with best-of-5 SeriesCards (3 pips), Walter Cup Final label, "View Shot Map →" navigation.

**Team Page (5 tabs):**
- **Overview** — W–OTW–OTL–L record (3-2-1-0 points system), season stats grid (GF/GP, GA/GP, Diff, PP%, PK%, SOG/GP, SA/GP) with league rank badges, top scorers, starting goalie card
- **Advanced** — CF%/FF% from `pwhl_shot_events`, PDO, special teams PP%/PK%, league context rankings, playoff toggle
- **Splits** — Home vs Away side-by-side (Pts%, GF/GP, GA/GP, Diff), Regular Season / Playoffs toggle
- **Trends** — Streak, L10, result dots, rolling 10-game win%, rolling 5-game GF/GA, goal differential waterfall
- **Salaries** — Total payroll vs $1.3M cap ceiling, CBA target ($58,349.50/player ±10%), Avg vs Target, player salary bars

**Players Page** — Photo grid roster (Forwards / Defencemen / Goalies), season picker, sortable stats tables. Player popup with Stats, Heat Map (from `pwhl_shot_events`), and Scout (Workers AI on-demand) tabs.

**League Page (5 tabs):**
- **Standings** — W/OTW/OTL/L columns, PTS, Pt%, GF, GA, DIFF, L10 dots, STRK. 3-2-1-0 points note. Sortable.
- **Playoff Bracket** — Semifinals + Walter Cup Final, best-of-5 (3-win pips), series modal with game-by-game results and dates
- **Leaders** — Points, Goals, GAA, SV% top 10. Click → player popup
- **Power Rankings** — 5-factor weighted formula (Pts% 35%, L10 20%, GD/GP 20%, CF% 15%, Special Teams 10%), collapsible formula card
- **Draft** — 2026 (72 picks, 12 teams) and 2025 (48 picks, 8 teams) with position and round filters

**News** — Aggregated from Sportsnet, The Score, and others. Fetched by GH Actions `pwhl_news.py` and POSTed to Worker (CF datacenter IPs are blocked by RSS sources). 30-min KV cache.

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
| `power_rankings.py` | 32-team rankings + AI narratives |
| `special_teams.py` | PP/PK unit inference |
| `draft_ingest.py` | Live draft pick polling + AI analysis |
| `tankathon_ingest.py` | 2026 pick order scraper |

### PWHL Pipeline Modules
| Module | Description |
|--------|-------------|
| `pwhl_stats.py` | Rosters, skater/goalie/team stats, special teams (PP%/PK%), game log with dates, Corsi/Fenwick from shot events |
| `pwhl_pbp_events.py` | PBP events (faceoffs, hits, penalties) → `pwhl_pbp_events` |
| `pwhl_shot_events.py` | Shot events with coordinates → `pwhl_shot_events` |
| `pwhl_salaries.py` | PWHLPA PDF salary scraper → `pwhl_salaries` (190/194 player matches) |
| `pwhl_news.py` | RSS news fetcher → POST to Worker `/pwhl/news/ingest` |

### PWHL Supabase Tables
`pwhl_players`, `pwhl_player_seasons`, `pwhl_goalie_seasons`, `pwhl_team_seasons` (incl. `pp_pct`, `pk_pct`, `corsi_for_pct`, `fenwick_for_pct`), `pwhl_game_log` (incl. `game_date`, `venue_name`, `venue_city`), `pwhl_shot_events`, `pwhl_pbp_events`, `pwhl_salaries`

### PWHL Season ID Map
| ID | Season | Type |
|----|--------|------|
| 1 | 2023-24 | Regular |
| 3 | 2023-24 | Playoffs |
| 5 | 2024-25 | Regular |
| 6 | 2024-25 | Playoffs |
| 8 | 2025-26 | Regular |
| 9 | 2025-26 | Playoffs |

### Pipeline GitHub Actions Workflows

| Workflow | Schedule | Description |
|----------|----------|-------------|
| `nightly.yml` | 3 AM ET daily | Full NHL pipeline + PWHL PBP events + PWHL news fetch |
| `moneypuck-ingest.yml` | Nightly | MoneyPuck CSV fetch via GH runner |
| `reddit-ingest.yml` | Every 30 min | Reddit (32 subreddits) + SBNation atom feeds → Worker |
| `tankathon-sync.yml` | Weekly (Tue 8am ET) | Tankathon draft order scrape |
| `draft-ingest.yml` | Jun 26 + Jun 27 | Live NHL draft pick polling loop |

---

## Testing

### Vitest (138 tests, 8 files)
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

**17 spec files:**

| Spec | Coverage |
|------|---------|
| `navigation.cy.js` | NHL routes + PWHL 8-team smoke (all 6 PWHL routes) |
| `news.cy.js` | NHL news, source filters |
| `pwhl-news.cy.js` | PWHL news, source chips, article list |
| `period-summary.cy.js` | Game Center, period/game summary popups |
| `players.cy.js` | NHL roster, skater/goalie cards (4 teams) |
| `pwhl-players.cy.js` | PWHL roster, stats, player popup (4 teams) |
| `schedule.cy.js` | NHL schedule, predictions |
| `pwhl-schedule.cy.js` | PWHL schedule (8 teams), playoffs tab |
| `shot-map.cy.js` | NHL shot map, all sections |
| `pwhl-shot-map.cy.js` | PWHL shot map (8 teams), PBP metrics |
| `team.cy.js` | NHL 6 tabs (4 teams incl. Cap + Picks) |
| `pwhl-team.cy.js` | PWHL 5 tabs (4 teams incl. Salaries) |
| `league.cy.js` | NHL 5 tabs |
| `pwhl-league.cy.js` | PWHL 5 tabs incl. Draft (72 picks) |
| `draft.cy.js` | NHL draft board |
| `theme.cy.js` | Light/dark mode |
| `viewports.cy.js` | 4 viewports × all views |

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
```

**Dev tools:**
- `http://localhost:5173/dev` — live game replay scrubber
- `http://localhost:5173/dev/draft` — draft simulator

---

## Deployment

**App:** push to `dev` → verify → merge to `main` → auto-deploys to Cloudflare Pages.

**Worker:** edit `worker.js`, paste into Cloudflare Workers dashboard → Deploy.

**October season prep checklist:**
1. Update `CURRENT_SEASON` in `teamConfig.js`
2. Update `PWHL_CURRENT_SEASON` in `pwhlConfig.js` (regular season ID)
3. Update `NHL_SEASON` and `PWHL_SEASON` GitHub Actions secrets
4. Update `MP_SEASON` in `moneypuck.py`
5. Update `OFFSEASON_BRACKET` in `LeagueView.jsx`
6. Add PWHL expansion team IDs to `pwhlConfig.js` once HockeyTech assigns them (DET, HAM, LAS, SJS — expected October 2026)
7. Review Dependabot PRs (ESLint 10, Vite 8, supabase 2.31.x)

---

## Known Limitations

- **Cron minimum:** 1-minute polling — live NHL data is 0–60s behind the API.
- **PWHL news:** RSS feeds block Cloudflare datacenter IPs. GH Actions runner fetches and POSTs to Worker. Low volume in offseason; improves when season starts.
- **PWHL Corsi/Fenwick:** No missed shot data in HockeyTech — FF% is SOG-based proxy, not true Fenwick.
- **PWHL PDO (playoffs):** Requires playoff player-level shot data not yet separated in pipeline. Regular season PDO only.
- **PWHL expansion teams:** Detroit, Hamilton, Las Vegas, San Jose deferred until HockeyTech assigns IDs (October 2026).
- **PWHL Analytics tab:** Post-launch work — requires building PWHL xG model and WAR equivalent.
- **Cap data:** NHL API doesn't expose salary. Static file requires manual updates.
- **iOS push:** Requires Add to Home Screen — browser Safari cannot receive Web Push.
- **WAR/RAPM:** Beta — zone-start OZS% still being refined. Non-CAR players have high variance.
- **Reddit ingest:** Blocked by Reddit on GH Actions IPs. Deferred to October.
- **X/Twitter posting:** Built but requires Basic tier ($100/mo).

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
- [x] Cypress tests for all PWHL views (17 spec files total)
- [x] ESLint clean (0 errors, 0 warnings)
- [x] NHL Draft Board shipped (Sessions 19-20)

### Pending
- [ ] PWHL expansion teams (DET, HAM, LAS, SJS) — October 2026
- [ ] PWHL Analytics tab (xG model, WAR equivalent) — post-launch
- [ ] PWHL PDO in playoffs (needs playoff player shot data)
- [ ] Reddit ingest fix — October
- [ ] PuckPedia integration (contracts + future picks, all 32 teams)
- [ ] `app_config` Supabase table to eliminate hardcoded season constants
- [ ] Season-over-season player comparison
- [ ] Standings clinching indicators
- [ ] Hat tricks / SHG milestone feed
- [ ] Capacitor PWA wrapper for App Store / Play Store
- [ ] Dependabot: supabase 2.31.x, ESLint 10, Vite 8 (October)
- [ ] October: bump `CURRENT_SEASON`, `PWHL_CURRENT_SEASON`, `NHL_SEASON`, `OFFSEASON_BRACKET`

---

*Built with 🌀 for hockey fans*
