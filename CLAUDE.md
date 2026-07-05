# eyewall-analytics

React/Vite frontend for EyeWall Analytics, deployed on Cloudflare Pages at eyewallanalytics.com. Covers NHL (Carolina Hurricanes focus) and PWHL game analytics, standings, players, milestones, news.

## Stack
- React, Vite, Cloudflare Pages
- Cypress for E2E tests — **run before every push**
- ESLint 9 (pinned — do not bump to 10 without checking peer deps)
- PostHog for analytics

## Sibling repos
Lives in `eyewall/` alongside `eyewall-poller` (Cloudflare Workers backend, the API this app talks to) and `eyewall-pipeline` (Python data pipeline that populates Supabase). This repo only reads from `eyewall-poller`'s Worker endpoints — it does not talk to Supabase directly.

## Live season resolution (built Session 35–36)

`seasonClient.js` is a shared, memoized fetch wrapper for `GET /config/seasons` on the Worker. `teamConfig.js` (NHL) and `pwhlConfig.js` (PWHL) both consume it — loading both on the same page triggers only one real fetch, not two.

Mechanism worth understanding before touching this:
- `CURRENT_SEASON` / `PWHL_CURRENT_SEASON` are `let`, not `const` — seeded with a fallback, updated in place by a fire-and-forget fetch at module load.
- Every team object's `season` field is a **getter**, not a plain value — this is what lets `team.season` reflect the live-resolved value everywhere it's read without touching every consuming component. Don't refactor this into a plain property without understanding why it's a getter.
- `PWHLPlayersView.jsx`'s season-picker default only reads `PWHL_CURRENT_SEASON` once at `useState` mount — if the component mounts before live resolution finishes, it locks in the fallback forever. Fixed via listening for an `eyewall:pwhl-season-updated` event, without overriding a season the user picked manually. Keep this pattern in mind for any other component with a season-dependent initial state.

Manual override exists on the Worker side (`config:season:nhl:override` / `config:season:pwhl:override` KV keys) if live resolution ever misjudges the real Sept/Oct boundary — **that transition has never actually been observed by this logic yet.**

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
