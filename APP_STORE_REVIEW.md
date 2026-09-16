# App Store Review — Guideline 2.1 Information Needed

Reply for App Store Connect, also pasted into **App Review Information → Notes** (4,000-char limit; the reply below is ~3,300).

> ⚠️ The reply describes the fixes on branch `app-store-review-fixes` (eyewall-analytics) and
> `delete-own-account-rpc` (eyewall-pipeline). Before sending it:
> 1. Run `eyewall-pipeline/docs/delete_own_account_rpc.sql` in the Supabase SQL editor.
> 2. Merge + deploy the app branch, then `npm run build && npx cap sync ios`, archive in Xcode, and upload a new build.
> 3. Record the screen recording on that new build and attach it.

---

## Reply (paste this)

Hello, and thanks for reviewing EyeWall Analytics. Here is the information you requested.

**1. Screen recording**
Attached, recorded on an iPhone running the latest iOS release. It starts at app launch and shows: choosing a league and team, the live Shot Map, the Schedule and a game preview, the Team, Players and League pages, News and Daily Trivia, turning on push notifications, the optional email sign-in, and in-app account deletion. The app has no user-generated content and no paid content or features.

**2. Purpose and audience**
EyeWall Analytics is a free advanced-stats app for hockey fans who want to go deeper than the box score. It covers the NHL, PWHL, AHL and ECHL. It shows live shot maps, game and period summaries, team and player analytics (shot heat maps, goalie save stats, percentile rankings), standings, playoff projections, injury reports, transactions, and a daily hockey trivia quiz. Stats-based predictions, such as a win probability or a likely starting goalie, are shown as plain probabilities with a public scorecard of how accurate they have been. It is an independent, fan-built project with no ads, no in-app purchases and no subscriptions.

**3. Setup and access**
No login is required. Every feature works without an account. On first launch, pick a league and team; the bottom tabs (Shot Map, Schedule, Players, Team, News) then cover the main features. Settings (gear icon) holds appearance, language, notifications and the account section.
Sign-in is optional and passwordless. It only syncs your favorite team and trivia history across devices. Go to Settings → "Sign in", enter any email address you can read, and tap the link in the email; it opens the app signed in. To delete the account, go to Settings → "Delete account" (just below "Sign out") → "Delete permanently". This permanently deletes the account and its data right away.
No sample files are needed. Live game features need a game in progress; outside game times, the Shot Map and Schedule show the most recent completed games.

**4. External services**
- Supabase: database, and the optional passwordless email sign-in
- Resend: delivers sign-in emails
- Cloudflare Pages and Workers: hosting, API and caching
- Apple Push Notification service: opt-in game alerts
- PostHog: anonymous product analytics (no ads, no tracking across apps)
- Anthropic (Claude) and OpenRouter: AI-written game summaries, matchup write-ups and trivia questions, generated on our servers from stats data. Users never enter prompts or free text.
- Sports data: NHL public stats APIs, HockeyTech/LeagueStat (PWHL, AHL, ECHL), MoneyPuck, ESPN (injuries, transactions), Tankathon (draft order)
- News: public RSS feeds from sports outlets. Headlines link out to the publisher's own site.

**5. Regional differences**
The app works the same way in every region. The interface is in English or French, based on the device language. Content and features do not vary by region.

**6. Regulated industries and third-party material**
The app is not in a regulated industry. It has no gambling, betting or wagering features or content, and no payments. Team names, logos and player photos come from the leagues' own public data sources. They are used only to identify teams and players alongside statistics. The app states in-app that it is independent and not affiliated with, endorsed by, or sponsored by the NHL, PWHL, AHL, ECHL or any team.

Contact: matt@eyewallanalytics.com

---

## Screen recording shot list (physical iPhone, latest iOS)

Use Control Center's Screen Recording, with the microphone off. Aim for 3–5 minutes.

1. Start on the Home Screen, then tap the app icon. The recording must begin with the launch.
2. First-launch league/team picker → pick an NHL team.
3. Shot Map → tap a MetCard drill-down.
4. Schedule → tap an upcoming game → Matchup Detail (win probability, AI preview, probable starters).
5. Team → Overview (playoff odds, injuries) → Advanced.
6. Players → open a player → Analytics / Heat Map tabs.
7. League → Standings → Scorecard.
8. News → Trivia → answer a question.
9. Settings → turn on notifications, and accept the iOS permission prompt.
10. Settings → Sign in → enter email → switch to Mail → tap the magic link → app opens signed in ("Synced").
11. Settings → **Delete account** → **Delete permanently** → back to the signed-out row.
12. About popup (shows the independence disclaimer and privacy policy link).

If you delete the app first to get a true first launch, step 2 appears naturally.

---

## Pre-resubmission fixes (found in code review 2026-09-14, built the same day)

1. **In-app account deletion (Guideline 5.1.1(v)).** Done. Settings has a "Delete account" row under Sign out, with a confirm panel. It calls the `delete_own_account()` Postgres function (security definer, scoped to `auth.uid()`), and `user_preferences`/`trivia_answers` cascade from `auth.users`. No Worker route or service-role key was needed. `delete-account.html` now points to the in-app flow, with email as the fallback.
2. **Sportsbook odds.** Done: removed everywhere in the app (game cards, the game preview, the share image's odds and O/U line, and the `nhlApi.js` helpers). The win % was already pure Elo. The Odds API integration is also gone from `eyewall-poller` (`fetchOdds()`, `/nhl/odds`; branch `remove-odds-api`), and `docs/drop_nhl_odds.sql` there drops the unused table.
3. **Buy Me a Coffee link.** Done: hidden when `Capacitor.getPlatform() === 'ios'`, still shown on the web and Android.
4. **Privacy policy.** Done: mentions iOS, lists Resend and Cloudflare as processors, and describes in-app deletion.
5. **In-app disclaimer.** Done: added to the About popup in English and French. The About popup also scrolls now, because on a 390×844 screen its bottom used to be cut off behind the nav bar.

---

# Beta App Review — Guideline 2.1(a), September 2026

TestFlight build rejected with the "provide a demo account" boilerplate. There is
no sign-in in this app, so the demo-account request was Apple's generic wording
for "we opened it and couldn't see it do anything."

## What the reviewer saw

First launch → league picker → NHL → a team lands on the Shot Map, the default
tab. Reproduced on a 375×844 viewport on 2026-09-15:

- header stuck on **"Loading game data…"**, indefinitely
- Shots on Goal 0, Hits —, Blocks 0, Penalties —
- an empty rink

Nothing was broken server-side. The 2026-27 season simply had not started —
first game 2026-09-29 — and the Shot Map defaulted to a season with zero
completed games. `activeGame` was null, and the score bar's null branch rendered
the *loading* copy, so "no games exist yet" was indistinguishable from "still
fetching". Every other tab (Schedule, Team, Players, League, News) was fully
populated the whole time.

AHL and ECHL had a second version of the same problem: their season resolver
points at the most recent season with league-wide data, which for most of the
off-season is the playoffs — so any team that missed the playoffs got an all-zero
shot map on the app's first screen. PWHL was already correct and is unchanged.

## Fix (branch `offseason-shot-map-fallback`)

1. **NHL** (`ShotMapView.jsx`) — until the current season has a completed game,
   the view shows the newest season that does, and says so in a notice above the
   game chips ("The 2026-27 season hasn't started yet — showing 2025-26. First
   game Tue, Sep 29."). Derived from the schedule, so it stops applying by itself
   on opening night. `activeGame` also falls back to the newest completed game of
   whatever season is on screen.
2. **NHL empty state** — when a season genuinely has nothing to show (the user
   picks the not-yet-started season themselves), the score bar now reads "No
   games yet / Season starts Tue, Sep 29" instead of a permanent fake spinner.
3. **AHL / ECHL** (`AHLShotMapView.jsx`, `ECHLShotMapView.jsx`) — if the resolved
   current season has no shots for this team, hop once to that playoff season's
   regular season (or the newest regular season otherwise), with the same kind of
   notice. Teams that *do* have playoff data are untouched.

Verified against live data: NHL/TOR now opens on the 2025-26 finale with 2,316
shots; AHL/HFD on 2025-26 (190 G, 2,025 SOG); ECHL/NOR on 2025-26 (211 G, 2,055
SOG); ECHL/ADK correctly stays on the 2026 Kelly Cup Playoffs. 234 unit tests,
48 shot-map e2e, 144 related e2e all pass.

## Reply (paste this)

Thank you for the review. EyeWall Analytics has no accounts and no login — every
feature is available to any user on first launch, so there are no demo
credentials to provide. Sign-in is optional and only syncs a favorite team and
trivia history across devices.

What you most likely saw: the app opens on the Shot Map tab, which displays the
current or most recent game. The 2026-27 NHL season had not started yet — the
first game is September 29, 2026 — so that tab had no game to draw and showed a
placeholder. This build fixes that: the Shot Map now falls back to the most
recent completed season whenever the current one has no games played, and states
on screen which season it is showing.

Everything is reachable without an account:
- Shot Map — opens on the most recent completed season, with a full season of
  shot data, per-game chips and shot-quality breakdowns. The season selector at
  the top right switches between seasons.
- Schedule — upcoming games; tap "Matchup breakdown" for win probabilities and
  probable starters.
- Team — record, playoff odds, simulations, and the Advanced / Splits / Trends tabs.
- Players, League and News are fully populated.

Contact: matt@eyewallanalytics.com
