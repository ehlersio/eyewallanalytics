# EyeWall Analytics

> Advanced NHL + PWHL analytics — live shot maps, period summaries, momentum tracking, special teams analysis, push notifications, AI-generated game summaries, player heat maps, goalie analytics, WAR/percentile rankings, AI-powered league power rankings, live draft board, full PWHL analytics suite, hat trick detection with live popups + game summary badges, milestone tracking (hat tricks, shutouts, shorthanded goals, season/career thresholds) with a league-wide feed, xGF% per-game sparkline, per-team AI narratives, optional passwordless sign-in with cross-device favorite-team sync, and daily trivia (three difficulty tiers, guardrailed AI generation).

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
| Styling | CSS custom properties (design tokens); Tailwind (`@tailwindcss/vite`) — single global entry point (`src/tailwind.css`, Session 94), utilities layer only, no preflight, so it can't leak a reset into the rest of the app's plain-CSS components. Full-app migration in progress (see `SESSION_94_FINDINGS_tailwind_migration.md`): `PlayerComparisonPopup.jsx` (Phase 0); the shared UI atoms — `TeamPicker`, `Topbar`, `PlayerSearch`, `NotificationBell`, `AccountSection`, `AboutPopup`, `TriviaFeed`, `SeasonComparisonPicker`, `SeasonOverlayChart`, `StatBar`, `InfoTip`, `TeamLogo`, `TeamOpponentPicker` (Phase 1); `ShareButtons` (Phase 2, shared by `LeagueView`, `PeriodSummary`, `PWHLPeriodSummary`, `PredictionShareCanvas`, `ScoutingTab`); `PlayersView`, `PWHLPlayersView`, `PWHLLeagueView`, `PlayerPopup`, `PWHLPlayerPopup`, `PercentileBar`, `StatTileGrid`, `TeamComparisonPopup`, `PlayerComparisonPopup` (Phase 3, sub-PRs 1–3 — `PlayersView.css` is fully deleted; a handful of nested-context overrides that two unrelated components both need — `.stat-section-peers` compaction, `.player-card` hover/padding — live on as small real CSS in `index.css` rather than PlayersView.css, documented inline there); `DevReplayView`, `PWHLDevReplayView` (Phase 4, sub-PR 1 — `DevReplayView.css` deleted, confirmed clean 2-consumer pair, no transitive dependencies); `GameEvents`, `PWHLGameEvents` + their transitive consumers `ShotMapView`, `PWHLShotMapView` (Phase 4, sub-PR 2 — `GameEvents.css` deleted; `.pp-indicator`/`.car-pp`/`.opp-pp`/`.score-team-wrap` were undeclared transitive consumers pulled in via `ShotMapView.jsx`/`PWHLShotMapView.jsx` importing popup components rather than the CSS directly; `PWHLGameEvents.jsx`'s `PWHLLiveInsights`/`PWHLInsightsCard` sub-component and `ShotMapView.css`'s own `.en-indicator`/`.car-en`/`.opp-en` empty-net variants are out of scope and left untouched — the latter's `!important` rules keep overriding `.pp-indicator`'s new Tailwind base regardless of layer order; fixed a live `.event-dismiss`/`.game-event-dismiss` classname mismatch bug along the way; dropped 5 confirmed-dead classes — `.penalty-title`, `.penalty-clock`, `.penalty-sub`, `.pp-time`, `.win-sub` — with zero real consumers anywhere in the tree); `TeamView`, `PWHLTeamView` (Phase 4, sub-PR 3 — `TeamView.css` deleted, confirmed clean 2-consumer pair; ~28% of the file was dead CSS from replaced UI iterations — an old `.score-state-row`/`.ss-*` system, an old `.split-compare`/`.split-col`/etc layout, an old `.gd-bar-wrap`/`.gd-baseline` chart, and an entirely-unused `.ha-grid-*` family — dropped rather than migrated; `light-mode-overrides.css`'s "TeamView.css additions" block kept applying via literal marker classnames on the migrated elements; found and fixed a real bug where PWHL's `otw` (overtime win) result-dot state had zero CSS coverage; hit the same-layer `bg-transparent`-vs-active-background collision (lesson #9) twice more in `.team-tab`/`.adv-toggle-btn`; hit a real `.card`/`.empty-state` padding cascade-layer collision (lesson #1/#5), fixed the same way as `.player-card`); `NewsView`, `PWHLNewsView`, `MilestonesFeed`, `TriviaFeed` (Phase 4, sub-PR 4 — `NewsView.css` deleted, confirmed 4 real consumers per the original investigation, all reusing the same card/chip classes by explicit design; shared Tailwind constants live in `src/utils/newsViewClasses.js` and are imported by all 4 files rather than duplicated, since — unlike every other pair in this migration — there's no NHL/PWHL variation to justify per-file copies; finished `TriviaFeed.jsx`'s Phase-1-deferred migration of the NewsView.css classes it reuses; caught and deterministically replicated a real cascade collision already present in the original CSS — `.news-card-title`'s `display:-webkit-box` line-clamp loses to `.milestone-card-title`'s `display:flex` on milestone titles, so those never actually truncate today; hit the `.card`-padding collision again on `.news-header`/`.news-error`/`.news-empty` (fixed the same way as `.player-card`/`.empty-state`), while `.news-card`/`.news-skeleton` needed no fix since their own padding already matched `.card`'s exactly; hit a real `@keyframes shimmer` name collision — `NewsView.css`'s own opacity-based shimmer and `index.css`'s pre-existing background-position-based one shared a name, hoisted as `news-skel-shimmer` instead) — are migrated. The rest of the app still uses per-component plain CSS. Named Tailwind radius utilities (`rounded-lg`, `rounded-md`, etc.) are avoided app-wide in favor of explicit `rounded-[Npx]` — the app's 14px root font-size (vs. Tailwind's assumed 16px) scales rem-based utilities, and three radius step names collide with this app's own pre-existing `--radius`/`--radius-sm`/`--radius-lg` tokens; `tailwind.css`'s `--spacing` override compensates the numeric spacing scale for the same 14px-root mismatch |
| Charts | D3 v7, SVG-based IceRink component; Recharts (radar charts — single-player header, Session 66/80; two-player overlay in Player vs Player Comparison, Session 91) |
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
│   │   ├── ShotMapView.jsx/.css        # NHL live shot map — season/game history selector (Session 77) lets you browse past seasons/games; disabled+tooltip (not hidden) while a game is live, since a live game always wins the display
│   │   ├── ScheduleView.jsx/.css       # NHL schedule
│   │   ├── TeamView.jsx                # NHL 6-tab team analytics (Advanced tab: xGF% sparkline) — Tailwind (Phase 4, sub-PR 3), no .css file
│   │   ├── PlayersView.jsx/.css        # NHL players
│   │   ├── LeagueView.jsx/.css         # NHL 5-tab league page
│   │   ├── NewsView.jsx                # NHL news feed + News/Milestones/Trivia tab toggle (Trivia added Session 92) — Tailwind (Phase 4, sub-PR 4), no .css file
│   │   ├── PWHLShotMapView.jsx         # PWHL shot map + PBP metrics — season/game history + Regular Season/Playoffs toggle (Session 77, new capability, not just NHL parity)
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
│   │   ├── TeamPicker.jsx              # Sport + team selection (NHL + PWHL); active/expansion PWHL split derives from comingSoon (fixed 2026-07 — used to be a 2nd hardcoded list, ignored comingSoon entirely)
│   │   ├── IceRink.jsx/.css            # SVG rink — shots, heat map, team-aware
│   │   ├── PWHLPlayerPopup.jsx         # PWHL player popup (Stats, Heat Map, Scout, Compare — season-over-season, up to 4 seasons, one fetch per season; Compare tab adds a per-game trend chart for chart-ready metrics (6/11 skater, 2/9 goalie — box-score-backed via /pwhl/player-game-log) alongside the existing tile rows, Session 70; header also renders a "vs Player" entry point, Session 91 — a separate affordance from the "🆚 Compare" tab, which means something different (own-season history, not another player))
│   │   ├── PlayerPopup.jsx             # NHL player popup (Stats, Analytics, Heat Map, Compare — season-over-season, reuses the seasonTotals already fetched for Stats; Compare tab adds a per-game trend chart for chart-ready metrics (11/18 skater, 8/11 goalie — via the NHL API's own game-log endpoint) alongside the existing tile rows, Session 70; header also renders a "vs Player" entry point, Session 91, stacked under the radar's quickstats grid rather than inline so it doesn't compress the radar)
│   │   ├── PlayerComparisonEntry.jsx   # "vs Player" button + same-league (Fuse.js) search panel mounted in both player popups' headers (Session 91) — opens PlayerComparisonPopup once a second player is picked
│   │   ├── PlayerComparisonPopup.jsx/.css # Player-vs-Player Comparison (Session 91) — same-league only (NHL-NHL or PWHL-PWHL); two-series Recharts radar (5-axis NHL skater / 6-axis NHL goalie / 4-axis PWHL skater); tabbed detail (Scoring/Possession/Physical/Special Teams for skaters, Record/Performance/Advanced for goalies) reusing the shared StatTileGrid; goalie-vs-skater and PWHL goalie-vs-goalie are hard-blocked (non-overlapping stat schema / no PWHL goalie percentile data yet, respectively); F-vs-D pairing shows a non-blocking mismatch badge. First and only consumer of Tailwind in this repo.
│   │   ├── PercentileBar.jsx           # Single percentile row (bar + tier label) — extracted from PlayerPopup.jsx (Session 91) so PlayerComparisonPopup.jsx can reuse it without importing PlayerPopup.jsx back (would create a circular import, since PlayerPopup.jsx renders the entry point that opens the comparison popup)
│   │   ├── GameEvents.jsx              # Goal/penalty/win/puck drop popups — Tailwind (Phase 4, sub-PR 2), no .css file
│   │   ├── ScoutingTab.jsx/.css        # NHL opponent scouting
│   │   ├── DraftTab.jsx/.css           # NHL draft board
│   │   ├── NotificationBell.jsx        # ⚙️ Settings drawer — Account section (sign-in/out, Session 90) at top, Preferences (My Team/Appearance/Push Notifications/Game Summaries) below
│   │   ├── AccountSection.jsx/.css     # Sign-in UI inside Settings (Session 90) — signed-out row, two-step email sign-in, signed-in row (avatar/email/Synced badge) + sign-out
│   │   ├── TriviaFeed.jsx              # Daily Trivia tab content (Session 92) — three tier cards, answer/reveal flow, aggregate correct/attempted stats. Same "rendered as a tab inside NewsView" pattern as MilestonesFeed.jsx. Tailwind (Phase 1 own classes; NewsView.css-owned classes finished Phase 4, sub-PR 4, imported from utils/newsViewClasses.js)
│   │   ├── PeriodSummary.jsx/.css      # Period/game summary popup + share canvas + hat trick badges
│   │   ├── PWHLPeriodSummary.jsx/.css  # PWHL period/game summary popup + share canvas
│   │   ├── ShareButtons.jsx/.css       # Shared Save/X/Share buttons across all export cards
│   │   ├── HatTrickPopup              # (in GameEvents.jsx) — live hat trick celebration overlay
│   │   ├── MilestonesFeed.jsx          # League-wide milestone feed (hat tricks, shutouts, SH goals, season/career thresholds) — tappable into PlayerPopup
│   │   ├── PlayerSearch.jsx/.css       # Global NHL+PWHL player search (Topbar) — Fuse.js fuzzy match against the Worker's flat player index
│   │   ├── TeamLogo.jsx/.css           # NHL + PWHL team logo renderer
│   │   ├── CalendarView.jsx            # NHL calendar month view
│   │   ├── PWHLCalendarView.jsx        # PWHL calendar month view
│   │   ├── InfoTip.jsx/.css            # Tap-to-open tooltip
│   │   ├── StatBar.jsx/.css            # Comparative stat bar
│   │   ├── SeasonComparisonPicker.jsx/.css # Generic N-season selector for season-over-season comparison (NHL + PWHL, not league-specific)
│   │   ├── TeamComparisonPopup.jsx     # Team-level season-over-season comparison dialog (NHL + PWHL, box-score stats only) — reuses PlayersView.css's popup/stat-section styles; its Head-to-Head tab also renders an AI narrative card (Session 90) via HeadToHeadNarrativeCard
│   │   ├── GameChipsRow.jsx            # Shot map game-selector chip row (NHL + PWHL, shared) — normalized {id, opponentAbbr, opponentColor, myScore, oppScore, isHome} shape, each sport maps its own schedule-row into it
│   │   ├── SeasonChipRow.jsx           # Shot map season-selector chip stack (NHL + PWHL, shared) — recent seasons inline + a "More seasons" overflow dropdown for older ones
│   │   ├── SeasonTypeToggle.jsx        # Regular Season/Playoffs segmented toggle (NHL + PWHL, shared) — same UI, different wiring per sport (PWHL swaps season_id; NHL filters the fetched season's games by gameType)
│   │   └── DisabledHint.jsx            # Tap-triggered "why is this grayed out" tooltip — used by the shot map selector while a game is live
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
│       ├── SportContext.jsx            # Sport state (NHL/PWHL) + localStorage persistence
│       ├── advancedStats.js
│       ├── supabaseClient.js           # DB queries; getTeamXgTrend, getGoalieShots (no car_game filter) — Worker-proxied, NOT direct Supabase (see supabaseAuth.js for the one exception)
│       ├── supabaseAuth.js             # Supabase Auth client (Session 90) — the only place this app imports @supabase/supabase-js directly; signInWithOtp/session handling only, never used for data reads
│       ├── AuthContext.jsx             # Auth state (Session 90) — mirrors SportContext.jsx's context+provider+hook pattern. Also runs favoriteTeamSync.js/triviaAnswers.js's sign-in reconciliation
│       ├── favoriteTeamSync.js         # Favorite-team sync for signed-in users (Session 91) — write-on-switch (awaited before the team-change reload) + reconcile-on-session-load (first sign-in uploads local; existing server value wins on a new device)
│       ├── triviaAnswers.js            # Trivia answer tracking (Session 92) — local-first for everyone; signed-in users get a union merge on sign-in (not favoriteTeamSync's overwrite rule — answer history is append-only, so a second device's local answers must never be discarded)
│       ├── playerSearch.js             # Fuzzy player search — fetches GET /players-search-index once per session, matches via Fuse.js
│       ├── nhlPlayerStats.js           # NHL skater/goalie stat defs, formatters, and radar-axis composites — extracted from PlayerPopup.jsx (Session 91) so PlayerComparisonPopup.jsx can reuse them without a circular import
│       ├── pwhlPlayerStats.js          # PWHL equivalent of nhlPlayerStats.js — extracted from PWHLPlayerPopup.jsx (Session 91)
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
│   │   ├── player-comparison.cy.js     # Player vs Player Comparison (Session 91) — "vs Player" entry point, same-league search scoping, NHL skater/goalie + PWHL skater comparison rendering, goalie-vs-skater + PWHL goalie-vs-goalie hard blocks, position-mismatch badge
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
| `config:season:nhl` | Live-resolved current NHL season (see [Live Season Resolution](#live-season-resolution)) | 6 hr |
| `config:season:nhl:override` | Manual override, bypasses live resolution entirely | none (manual) |

### NHL Worker Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /draft/rankings?category=` | NHL Central Scouting rankings by category |
| `GET /draft/picks?team=&round=` | Draft picks, filterable by team and/or round |
| `GET /draft/order?team=` | Known R1 pick order |
| `POST /draft/analyze` | Workers AI draft pick analysis (secret-protected, `X-Poll-Secret` header) — called by `draft_ingest.py` on draft day |
| `GET /milestones?team=&limit=` | Recent milestones, league-wide by default, optional team filter (default limit 50, max 100) |
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
| `GET /pwhl/pbp?gameId=` | Play-by-play events |
| `GET /pwhl/scout` (POST) | Workers AI scouting report |
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

## Features

### NHL Features
All existing NHL features unchanged — see original documentation. Key features:
- Live shot map with momentum, insights, PP/PK drill-downs
- Period summaries with AI narrative, goals carousel, share export
- 6-tab team page (Overview, Advanced, Splits, Trends, Cap, Picks)
- League page (Standings, Bracket, Leaders, Power Rankings, Draft)
- Player analytics (WAR, RAPM, GSAX, heat maps)
- Push notifications (goal, game start, penalty, win)
- Player vs Player Comparison (Session 91, NHL + PWHL) — "vs Player" entry point on the player popup opens a same-league two-player comparison: overlaid radar chart, tabbed detail sections reusing the existing stat-tile grid. Goalie-vs-skater and PWHL goalie-vs-goalie (no percentile data yet) are hard-blocked; forward-vs-defenceman pairing shows a non-blocking mismatch badge.

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

**28 spec files:**

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
| `player-comparison.cy.js` | Player vs Player Comparison — "vs Player" entry point vs. the existing season-over-season Compare tab, same-league search scoping/self-exclusion, NHL skater comparison (radar + all 4 tabs), NHL goalie comparison (own 3-tab set), PWHL skater comparison, goalie-vs-skater + PWHL goalie-vs-goalie hard blocks, F-vs-D position-mismatch badge, tab-click and radar-squeeze regressions |
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

### Pending
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
- [ ] PWHL milestones (hat tricks, shutouts, etc.) — deferred pending PWHL schema confirmation, same pattern as NHL `milestones.py`
- [ ] `ai_summaries.py`/`ai_predictions.py` appear to run twice nightly — once inside `run.py`'s `run_all()`, again via `ai_pipeline.yml`'s separate cron an hour later. Worth confirming whether that's intentional redundancy or wasted GH Actions minutes / duplicate Workers AI calls.
- [ ] Migrate remaining pipeline scripts (`ai_summaries.py`, `ai_predictions.py`, `moneypuck.py`, etc.) to `db.py`/`pipeline_common.py` if they don't already use them
- [ ] Expansion team logos/permanent names — still placeholders, waiting on official branding reveal (likely this fall)
- [ ] `pwhl_stats.py`'s `SEASON_TYPE_MAP` labels season ID 2 as `"showcase"`, but HockeyTech's own `bootstrap` response calls it `"2024 Preseason"` — unresolved discrepancy, worth checking against real 2024 game data before changing either one

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
