# eyewall-analytics

React/Vite frontend for EyeWall Analytics, deployed on Cloudflare Pages at eyewallanalytics.com. Covers NHL (all 32 teams, user-selectable via `TeamPicker.jsx` — originally Carolina Hurricanes-only, expanded 2026-07) and PWHL (all 12 teams) game analytics, standings, players, milestones, news.

## Stack
- React, Vite, Cloudflare Pages
- Cypress for E2E tests — **run before every push**
- ESLint 9 (pinned — do not bump to 10 without checking peer deps)
- PostHog for analytics

## Sibling repos
Lives in `eyewall/` alongside `eyewall-poller` (Cloudflare Workers backend, the API this app talks to) and `eyewall-pipeline` (Python data pipeline that populates Supabase). Every data read goes through `eyewall-poller`'s Worker endpoints, not Supabase directly. **One deliberate exception (Session 90):** `supabaseAuth.js` talks to Supabase Auth directly (`signInWithOtp`, session handling) — that's inherently a browser-to-Supabase-Auth-endpoint flow with no Worker route to proxy it through. `trivia_answers`/`user_preferences` writes for signed-in users go the same direct route. Don't use `supabaseAuth.js` for data reads — that's still `supabaseClient.js`'s job, Worker-proxied as before.

## Git branch hygiene (standing rule — read before any session)

Before making any file changes in a new session, always run:

```
git status
git branch
```

If the current branch is not `main`, or if `main` locally is behind `origin/main`, stop and do this first:

```
git checkout main
git pull origin main
```

Then sweep local branches from prior sessions: for each `sessionNN-*` branch still present locally, confirm on GitHub that its PR merged, then delete the local branch (`git branch -d <branch>`; use `-D` only if it's confirmed merged but not fast-forward-mergeable locally). Remote branches auto-delete on merge in this repo (and the other two EyeWall repos), so this sweep is local-only. Do not delete a branch whose PR hasn't merged, even if it looks stale.

Once `main` is current and stale local branches are cleared, cut a fresh branch for the new session:

```
git checkout -b <new-branch-name-for-this-session>
```

Only start editing files after confirming you're on a fresh branch cut from an up-to-date `main`. Do not assume the working directory is already in the right state, even if the previous session ended with a merge — branch switches are a manual step and are easy to forget.

Name the new branch for what the session is actually doing (e.g. `session43-line-combinations`), not a generic name, so it's identifiable later if it needs recovering.

## README hygiene (standing rule — read before opening any PR)

Before opening a PR, check whether the change affects anything `README.md` documents — setup/install steps, environment variables, available scripts/commands, API routes or endpoints, known limitations, test counts, or architecture description. If yes, update the README in the same PR. Purely internal changes (refactors, bug fixes with no behavior/interface change) don't need a README touch — don't pad PRs with unnecessary doc churn.

## Versioning (standing rule — read before opening any PR)

The app follows semantic versioning (MAJOR.MINOR.PATCH), one version per merged PR. `package.json`'s `version` is the only source of truth; it's shown in the About popup (injected as `__APP_VERSION__` by `vite.config.js`).

- **Never edit the version in a PR.** `.github/workflows/version.yml` bumps it when the PR merges, commits `Release vX.Y.Z (#PR)` to main and tags it. Several PRs are often open at once; if each bumped the version itself they'd all conflict on the same line, or carry a stale number.
- **Label every PR with exactly one of these** (e.g. `gh pr create --label semver:minor`). The `Version / label` check fails until it has one:
  - `semver:major` — breaks or resets things for users: a redesign, dropping a league, saved settings invalidated. Rare.
  - `semver:minor` — something new a user can see or use (e.g. #354, tappable Scoreboard teams).
  - `semver:patch` — a fix, a behind-the-scenes change users only notice as "works better", a dependency update (e.g. #352).
  - `semver:none` — doesn't ship to users: tests only, CI, docs (e.g. #355).
- Unsure between two levels? Pick the higher one and say why in the PR description.
- Dependabot labels its own PRs (`.github/dependabot.yml`): npm updates `semver:patch`, GitHub Actions updates `semver:none`.
- **iOS:** cut an iOS build with `npm run ios:release`: it builds the web app, `cap sync`s it into the iOS project, runs `ios:version`, and opens Xcode ready to archive. Don't archive from an Xcode that wasn't opened by it -- 1.3.0's first TestFlight attempt went out of an Xcode still on 1.1.0 (build 2) because `ios:version` had never run. `ios:version` on its own copies `package.json`'s version into the Xcode project's `MARKETING_VERSION` and adds one to `CURRENT_PROJECT_VERSION` (App Store Connect needs a new build number for every upload). Don't hand-edit those in `project.pbxproj`. The iOS version skipping numbers between App Store releases is expected.

## Live season resolution (built Session 35–36)

`seasonClient.js` is a shared, memoized fetch wrapper for `GET /config/seasons` on the Worker. `teamConfig.js` (NHL) and `pwhlConfig.js` (PWHL) both consume it — loading both on the same page triggers only one real fetch, not two.

Mechanism worth understanding before touching this:
- `CURRENT_SEASON` / `PWHL_CURRENT_SEASON` are `let`, not `const` — seeded with a fallback, updated in place by a fire-and-forget fetch at module load.
- Every team object's `season` field is a **getter**, not a plain value — this is what lets `team.season` reflect the live-resolved value everywhere it's read without touching every consuming component. Don't refactor this into a plain property without understanding why it's a getter.
- `PWHLPlayersView.jsx`'s season-picker default only reads `PWHL_CURRENT_SEASON` once at `useState` mount — if the component mounts before live resolution finishes, it locks in the fallback forever. Fixed via listening for an `eyewall:pwhl-season-updated` event, without overriding a season the user picked manually. Keep this pattern in mind for any other component with a season-dependent initial state.

Manual override exists on the Worker side (`config:season:nhl:override` / `config:season:pwhl:override` KV keys) if live resolution ever misjudges the real Sept/Oct boundary — **that transition has never actually been observed by this logic yet.**

## NHL team config (multi-team, expanded 2026-07)
`teamConfig.js` mirrors `pwhlConfig.js`'s pattern: `ALL_TEAMS` has all 32 NHL teams (abbr/teamId/franchiseId/colors), `TEAM_CONFIG` is the currently-selected team (default CAR, backed by `localStorage['eyewall:team']`), switchable via `setTeamConfig()`/`TeamPicker.jsx`. This app was originally Carolina-only — a lot of code still assumes CAR structurally, not just by default. Known open items (deliberately not fixed as part of the 2026-07 live-bug pass):
- `CAR_ABBR = TEAM_CONFIG.abbr`-style local aliases exist in several files (`ShotMapView.jsx` heaviest, ~50+ call sites, also `ScheduleView.jsx`, `GameStatsPopup.jsx`, `nhlApi.js`, `advancedStats.js`). Currently harmless — every team switch does a full page reload — but the same *shape* as a real bug once caused a team_id clobber (see Session 44 memory). Don't add a hot-swap team-switch path without auditing these first.
- `carContracts.js` / the Cap tab genuinely only has real data for Carolina — that's fine (correctly gated to `TEAM_CONFIG.abbr === 'CAR'` in both `TeamView.jsx` and `PlayerPopup.jsx`), not a bug to "fix" by fabricating other teams' contract data.
- The poller's push-notification / live-game-detection / AI-game-summary pipeline (`eyewall-poller`'s `poll()`) is still structurally single-team — see that repo's CLAUDE.md. Not something this repo's code can fix on its own.

## PWHL team config
`pwhlConfig.js` has all current + 2026-27 expansion teams (DET, HAM, LV, SJS) with real HockeyTech `teamId`s, real colors extracted from each team's own CSS design tokens (not press-release color names — WCAG AA contrast computed properly, Detroit's dark-mode margin is thin at 4.51:1, worth checking if it's ever adjusted), and `comingSoon: false`.

`TeamPicker.jsx`'s active/expansion split derives from the `comingSoon` flag directly now — it used to have its own separate hardcoded `PWHL_ACTIVE_ABBRS`/`PWHL_EXPANSION_ABBRS` arrays that silently never read the flag despite a comment claiming they did. If you ever see a second hardcoded team list anywhere in this codebase, be suspicious of it — check whether it's actually derived from the real flag or a stale duplicate.

This same team-ID map is independently duplicated in `eyewall-poller`'s `pwhl.js` and `eyewall-pipeline`'s `pwhl_stats.py`/`pwhl_salaries.py`. A future expansion wave needs all of these touched — confirm via grep, don't assume from memory.

Expansion team logos and permanent names are still placeholders — no official branding revealed yet, expected fall 2026.

## Known gaps
- Cypress PWHL specs likely don't cover the 4 expansion teams yet — not verified/updated as of Session 36. Endpoints do return all 12 teams' data correctly; this is undercounted coverage, not broken coverage.
- `OFFSEASON_BRACKET` in `LeagueView.jsx` is still a manual flip each October — not yet part of the automated season resolution.

## Testing
Run the full Cypress suite before every push — this is a hard rule for this repo, not optional. `VITE_WORKER_URL` must be present in GH Actions env blocks or `news.cy.js` (and likely others) will fail.

## Hard-won lessons
- Don't reconstruct HockeyTech-derived URLs/values from written notes — verify against the real Worker response via DevTools if something looks off.
- Cache-busting the Worker's KV before confirming a data fix has actually landed just repopulates the stale/empty entry — this bit the season-resolution and roster-backfill work twice in one session.
- A Cypress assertion that waits on live Worker data must outlast the app's *own* fetch budget, not match it. The `*Api.js` modules abort at 8s and render a terminal "Failed to load..." card; specs that asserted with `{ timeout: 8000 }` were in a dead heat with that, so a slow-but-successful load failed the test at the same instant the app gave up. That is what made `pwhl-players.cy.js`'s "renders Defencemen section" flake while its sibling assertions on the same page passed. `DATA_TIMEOUT` in `cypress/support/e2e.js` is now the single ceiling for every live-data wait — use it rather than a fresh literal.
- `main.jsx` renders under React `StrictMode`, so the **dev server double-mounts and fires every fetch twice**. Cypress runs against the dev server, so E2E tests cannot distinguish app-level retry logic from StrictMode's second request — a retry test written against it passed with `retries: 0`. Verify that kind of logic in Vitest instead. Production builds have no StrictMode, so a stalled request there really is a single attempt.
