# EyeWall Analytics

> Advanced NHL + PWHL analytics — live shot maps, period summaries, momentum tracking, special teams analysis, push notifications, AI-generated game summaries, player heat maps, goalie analytics, WAR/percentile rankings, AI-powered league power rankings, live draft board, full PWHL analytics suite, hat trick detection with live popups + game summary badges, milestone tracking (hat tricks, shutouts, shorthanded goals, season/career thresholds) with a league-wide feed, xGF% per-game sparkline, and per-team AI narratives.

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
| Database | Supabase Pro (NHL + PWHL player/team/goalie stats, shot events, RAPM, game xG, power rankings, draft data, salaries, milestones) |
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
│   │   ├── TeamView.jsx/.css           # NHL 6-tab team analytics (Advanced tab: xGF% sparkline)
│   │   ├── PlayersView.jsx/.css        # NHL players
│   │   ├── LeagueView.jsx/.css         # NHL 5-tab league page
│   │   ├── NewsView.jsx/.css           # NHL news feed + Milestones tab toggle
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
│   │   ├── PeriodSummary.jsx/.css      # Period/game summary popup + share canvas + hat trick badges
│   │   ├── PWHLPeriodSummary.jsx/.css  # PWHL period/game summary popup + share canvas
│   │   ├── ShareButtons.jsx/.css       # Shared Save/X/Share buttons across all export cards
│   │   ├── HatTrickPopup              # (in GameEvents.jsx) — live hat trick celebration overlay
│   │   ├── MilestonesFeed.jsx          # League-wide milestone feed (hat tricks, shutouts, SH goals, season/career thresholds) — tappable into PlayerPopup
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
│       ├── supabaseClient.js           # DB queries; getTeamXgTrend, getGoalieShots (no car_game filter)
│       └── analytics.js
├── src/utils/__tests__/
│   └── *.test.js                       # Vitest unit tests (8 files, 138 tests)
├── cypress/
│   ├── e2e/
│   │   ├── navigation.cy.js            # NHL + PWHL route navigation (all 8 PWHL teams)
│   │   ├── news.cy.js                  # NHL news
│   │   ├── milestones.cy.js            # Milestones feed, team filter dropdown, tap-to-open popup
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
On first launch the user selects NHL or PWHL, then their team. The sport is stored under `eyewall:sport` and the team under `eyewall:team` (NHL) or `eyewall:pwhl_team` (PWHL). `SportContext` exposes `isPWHL` throughout the app — all routing, `BottomNav` tabs, and data fetching scope accordingly. `hasTeamConfig()` is sport-aware: checks `eyewall:pwhl_team` when sport is PWHL, `eyewall:team` otherwise. On team change, the app navigates to `/` (NHL) or `/pwhl/shots` (PWHL) before reloading so the correct route initializes.

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

### NHL KV Keys

| Key | Content | TTL |
|-----|---------|-----|
| `draft:rankings:2026:{category&#124;all}` | NHL Central Scouting rankings | 24 hr |
| `draft:picks:2026:{team&#124;all}:{round&#124;all}` | Draft picks (live + historical) | 60s while draft in progress (0 &lt; count &lt; 224), 24 hr once complete |
| `draft:order:2026:{team&#124;all}` | Known R1 pick order | 24 hr |
| `narrative:{period}:{gameId}:{carAbbr}` | AI period/game narrative per team perspective | 24 hr |
| `milestones:{team&#124;all}:{limit}` | Recent milestones (hat tricks, shutouts, SH goals, season/career thresholds) | 1 hr |
| `player:landing:{id}` | NHL API player landing proxy (bio, headshot, career totals) | 1 hr |

### NHL Worker Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /draft/rankings?category=` | NHL Central Scouting rankings by category |
| `GET /draft/picks?team=&round=` | Draft picks, filterable by team and/or round |
| `GET /draft/order?team=` | Known R1 pick order |
| `POST /draft/analyze` | Workers AI draft pick analysis (secret-protected, `X-Poll-Secret` header) — called by `draft_ingest.py` on draft day |
| `GET /milestones?team=&limit=` | Recent milestones, league-wide by default, optional team filter (default limit 50, max 100) |
| `GET /player/landing?id=` | Proxies NHL API's `/player/{id}/landing` — browser can't call it directly (no CORS headers on the NHL side) |

---

## Cloudflare Worker (`eyewall-poller`) — PWHL

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
| `pwhl:narrative:{period}:{gameId}:{carAbbr}` | AI period/game narrative per team perspective | 24 hr |

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
| `GET /pwhl/summary?gameId=` | HockeyTech gameSummary normalized (goals, MVPs, team stats) |
| `POST /pwhl/summary/narrative?gameId=&period=&carAbbr=` | AI period/game narrative per team perspective |

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
| `power_rankings.py` | 32-team rankings + AI narratives (per-team KV cache) |
| `ai_scouting.py` | AI scouting blurbs for skaters + goalies (all 32 teams) |
| `special_teams.py` | PP/PK unit inference |
| `draft_ingest.py` | Live draft pick polling + AI analysis + one-time backfill (`/draft/picks/{year}/all`) for a completed draft |
| `tankathon_ingest.py` | 2026 pick order scraper |
| `milestones.py` | Nightly milestone detection (hat tricks, natural hat tricks, shorthanded goals, shutouts, season goal/point thresholds, career point/win thresholds via live NHL API lookup) → `milestones` table |

### Shared pipeline modules

| Module | Description |
|--------|-------------|
| `db.py` | Supabase client (`get_client()`, tuned `postgrest_client_timeout=120`), `NHL_SEASON`, `PRIMARY_TEAM_ABBR`, batched `upsert()`. The canonical shared module — everything below imports from here rather than creating its own Supabase client. |
| `pipeline_common.py` | Everything `db.py` doesn't cover: `nhl_get()` (NHL API GET helper) and `get_logger()` (shared logging config). |

`nhl_stats.py`, `draft_ingest.py`, `milestones.py`, `ai_context.py`, and `ai_scouting.py` all import from `db.py`/`pipeline_common.py` rather than duplicating Supabase client setup — consolidated after `draft_ingest.py` and `milestones.py` were briefly built against a since-retired standalone `pipeline_common.get_supabase()` before `db.py`'s existing role was accounted for.

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
| `nightly.yml` | 3 AM ET daily | Full NHL pipeline (NHL-only after split) + `milestones.py` (runs after `python run.py`, once `game_scoring` is fresh) |
| `pwhl-nightly.yml` | 3:20 AM ET daily | PWHL PBP events + PWHL news (20 min offset to avoid Supabase contention) |
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

**18 spec files:**

| Spec | Coverage |
|------|---------|
| `navigation.cy.js` | NHL routes + PWHL 8-team smoke (all 6 PWHL routes) |
| `news.cy.js` | NHL news, source filters |
| `milestones.cy.js` | Milestones feed, team filter dropdown, card structure, tap-to-open player popup |
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

### Pending
- [ ] PWHL expansion teams (DET, HAM, LAS, SJS) — October 2026
- [ ] PWHL Analytics tab (xG model, WAR equivalent) — post-launch
- [ ] PWHL PDO in playoffs (needs playoff player shot data)
- [ ] Reddit ingest fix — October
- [ ] PuckPedia integration (contracts + future picks, all 32 teams)
- [ ] `app_config` Supabase table to eliminate hardcoded season constants
- [ ] Season-over-season player comparison
- [ ] Standings clinching indicators
- [ ] Capacitor PWA wrapper for App Store / Play Store
- [ ] Dependabot: supabase 2.31.x, ESLint 10, Vite 8 (October)
- [ ] October: bump `CURRENT_SEASON`, `PWHL_CURRENT_SEASON`, `NHL_SEASON`, `OFFSEASON_BRACKET`
- [ ] PWHL milestones (hat tricks, shutouts, etc.) — deferred pending PWHL schema confirmation, same pattern as NHL `milestones.py`
- [ ] `ai_summaries.py`/`ai_predictions.py` appear to run twice nightly — once inside `run.py`'s `run_all()`, again via `ai_pipeline.yml`'s separate cron an hour later. Worth confirming whether that's intentional redundancy or wasted GH Actions minutes / duplicate Workers AI calls.
- [ ] Migrate remaining pipeline scripts (`ai_summaries.py`, `ai_predictions.py`, `moneypuck.py`, etc.) to `db.py`/`pipeline_common.py` if they don't already use them

---

*Built with 🌀 for hockey fans*
