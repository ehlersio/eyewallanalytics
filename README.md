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
| Styling | CSS custom properties (design tokens); Tailwind (`@tailwindcss/vite`) — single global entry point (`src/tailwind.css`, Session 94), utilities layer only, no preflight, so it can't leak a reset into the rest of the app's plain-CSS components. Full-app migration in progress (see `SESSION_94_FINDINGS_tailwind_migration.md`): `PlayerComparisonPopup.jsx` (Phase 0); the shared UI atoms — `TeamPicker`, `Topbar`, `PlayerSearch`, `NotificationBell`, `AccountSection`, `AboutPopup`, `TriviaFeed`, `SeasonComparisonPicker`, `SeasonOverlayChart`, `StatBar`, `InfoTip`, `TeamLogo`, `TeamOpponentPicker` (Phase 1); `ShareButtons` (Phase 2, shared by `LeagueView`, `PeriodSummary`, `PWHLPeriodSummary`, `PredictionShareCanvas`, `ScoutingTab`); `PlayersView`, `PWHLPlayersView`, `PWHLLeagueView`, `PlayerPopup`, `PWHLPlayerPopup`, `PercentileBar`, `StatTileGrid`, `TeamComparisonPopup`, `PlayerComparisonPopup` (Phase 3, sub-PRs 1–3 — `PlayersView.css` is fully deleted; a handful of nested-context overrides that two unrelated components both need — `.stat-section-peers` compaction, `.player-card` hover/padding — live on as small real CSS in `index.css` rather than PlayersView.css, documented inline there); `DevReplayView`, `PWHLDevReplayView` (Phase 4, sub-PR 1 — `DevReplayView.css` deleted, confirmed clean 2-consumer pair, no transitive dependencies); `GameEvents`, `PWHLGameEvents` + their transitive consumers `ShotMapView`, `PWHLShotMapView` (Phase 4, sub-PR 2 — `GameEvents.css` deleted; `.pp-indicator`/`.car-pp`/`.opp-pp`/`.score-team-wrap` were undeclared transitive consumers pulled in via `ShotMapView.jsx`/`PWHLShotMapView.jsx` importing popup components rather than the CSS directly; `PWHLGameEvents.jsx`'s `PWHLLiveInsights`/`PWHLInsightsCard` sub-component and `ShotMapView.css`'s own `.en-indicator`/`.car-en`/`.opp-en` empty-net variants are out of scope and left untouched — the latter's `!important` rules keep overriding `.pp-indicator`'s new Tailwind base regardless of layer order; fixed a live `.event-dismiss`/`.game-event-dismiss` classname mismatch bug along the way; dropped 5 confirmed-dead classes — `.penalty-title`, `.penalty-clock`, `.penalty-sub`, `.pp-time`, `.win-sub` — with zero real consumers anywhere in the tree); `TeamView`, `PWHLTeamView` (Phase 4, sub-PR 3 — `TeamView.css` deleted, confirmed clean 2-consumer pair; ~28% of the file was dead CSS from replaced UI iterations — an old `.score-state-row`/`.ss-*` system, an old `.split-compare`/`.split-col`/etc layout, an old `.gd-bar-wrap`/`.gd-baseline` chart, and an entirely-unused `.ha-grid-*` family — dropped rather than migrated; `light-mode-overrides.css`'s "TeamView.css additions" block kept applying via literal marker classnames on the migrated elements; found and fixed a real bug where PWHL's `otw` (overtime win) result-dot state had zero CSS coverage; hit the same-layer `bg-transparent`-vs-active-background collision (lesson #9) twice more in `.team-tab`/`.adv-toggle-btn`; hit a real `.card`/`.empty-state` padding cascade-layer collision (lesson #1/#5), fixed the same way as `.player-card`); `NewsView`, `PWHLNewsView`, `MilestonesFeed`, `TriviaFeed` (Phase 4, sub-PR 4 — `NewsView.css` deleted, confirmed 4 real consumers per the original investigation, all reusing the same card/chip classes by explicit design; shared Tailwind constants live in `src/utils/newsViewClasses.js` and are imported by all 4 files rather than duplicated, since — unlike every other pair in this migration — there's no NHL/PWHL variation to justify per-file copies; finished `TriviaFeed.jsx`'s Phase-1-deferred migration of the NewsView.css classes it reuses; caught and deterministically replicated a real cascade collision already present in the original CSS — `.news-card-title`'s `display:-webkit-box` line-clamp loses to `.milestone-card-title`'s `display:flex` on milestone titles, so those never actually truncate today; hit the `.card`-padding collision again on `.news-header`/`.news-error`/`.news-empty` (fixed the same way as `.player-card`/`.empty-state`), while `.news-card`/`.news-skeleton` needed no fix since their own padding already matched `.card`'s exactly; hit a real `@keyframes shimmer` name collision — `NewsView.css`'s own opacity-based shimmer and `index.css`'s pre-existing background-position-based one shared a name, hoisted as `news-skel-shimmer` instead); the in-app popup half of `PeriodSummary`/`PWHLPeriodSummary` (Phase 4, sub-PR 5a — `PeriodSummary.css`'s ~93 popup/carousel classes migrated, its ~71 `ps-canvas-*` share-image-export classes deliberately deferred to sub-PR 5b since they're structurally separate, dark-only, off-screen export markup; checked `light-mode-overrides.css` up front this time — 7 of its 8 "PeriodSummary.css" selectors turned out to be stale/dead and were removed, only `.ps-carousel-dot`'s override was real; found and fixed a real bug where PWHL's `strengthLabel()` can return `'en'` (empty net) but `.ps-strength-badge` only ever defined `.pp`/`.sh`/`.ev`, so empty-net goal badges rendered unstyled — given the same treatment as `.sh`; confirmed `.ps-goals`/`.ps-goal-row` are genuinely dead CSS, matching `period-summary.cy.js`'s own defensive `if ($body.find('.ps-goals').length)` checks that have always been no-ops); the share-image-export canvas half of `PeriodSummary`/`PWHLPeriodSummary` (Phase 4, sub-PR 5b — `PeriodSummary.css` now fully deleted, both halves migrated; 20 of the file's 58 `ps-canvas-*` classes were confirmed dead, an older single-column canvas layout superseded by the current two-column one, and were not migrated; several classes were defined twice in the original CSS (a base value, then a later "lighter theme"/"additions" section overriding it) — only the final resolved value was carried forward; zero Cypress markers and zero `light-mode-overrides.css` dependency for any canvas class, confirmed via full-tree grep — the canvas is intentionally dark-only regardless of the app theme; found the same `strengthLabel()` returning `'en'` (empty net) gap discovered in sub-PR 5a also affects `.ps-canvas-strength`, given the same treatment as `.sh`); the shared shell (tab bar, filter row, legend, empty/loading/error states, scroll-to-top, mobile polish) + Standings tab + Draft-tab loading skeleton of `LeagueView`/`PWHLLeagueView`/`DraftTab` (Phase 4, `LeagueView.css` sub-PR 1 of ~4 — `LeagueView.css` NOT deleted yet, Leaders/Bracket/SeriesModal/PowerRankings classes migrate in later sub-PRs and the file stays imported until the last one; `LoadingRows`/`ErrorState`/`SeasonNotStartedState`/`ScrollTopButton` are single shared components reused across every tab, so migrating them here retires their classes everywhere at once; `.lv-row:not(:last-child) .lv-td` (row divider) and `.lv-row--you .lv-td`/`.lv-row--you .lv-td--team` (accent-row background) are deliberately kept as real, unlayered CSS rather than force-fit into Tailwind, same judgment as `PeriodSummary.css`'s `--team-canvas`/`--bkt-line` custom-property patterns — `.lv-row`/`.lv-td`/`.lv-row--you`/`.lv-td--team` are kept as literal marker classes on the migrated elements so those rules keep applying; found 3 more instances of the base+modifier same-CSS-property race beyond the previously-known `background`-only shape — `.league-tab`/`--active` and `.lv-filter-btn`/`--active` also raced on `color`/`border-color`, and `.lv-th`/`--team` raced on `text-align`; found `.pp-close` is a coincidental same-name-but-independent marker in 5 unrelated already-migrated files (Phase 3), not a real `LeagueView.css` dependency; `.bkt-abbr--lit`, `.bkt-dot--won` (applied via inline `style`, not this class), and `.lv-you-badge` confirmed genuinely dead and dropped — while `l10-dot--w/-o/-l` and `lv-magic-badge--clinch/--elim`, built via runtime template-literal suffix interpolation, were initially flagged as false-positive-dead by a naive literal-string grep before being confirmed real); the Leaders tab of `LeagueView`/`PWHLLeagueView` (Phase 4, `LeagueView.css` sub-PR 2 of ~4 — checked the same 3 things sub-PR 1 found real issues in: found one more light-mode divider needing an override (`.lv-leaders-row`, same `rgba(255,255,255,0.04)`-invisible-on-light shape), found zero new property-race collisions (`.lv-leaders-row`'s base sets no background/color that `--you`/`--clickable` also set; `--clickable`'s own races are all `:hover`/`:active`-pseudo-scoped, already established as safe), found zero interpolated-suffix dead-code false positives (`--you`/`--clickable` are static ternaries, not template-literal-built). Unlike Standings' `.lv-row--you .lv-td` (a descendant selector), `.lv-leaders-row--you` is a direct class on the row, so it migrated cleanly to a Tailwind arbitrary-value utility instead of staying real CSS. Confirmed PWHL's Leaders rows are always clickable and never highlight "your" team (no `--you` equivalent there) — a real, deliberate NHL/PWHL feature asymmetry, not a bug); the Bracket panel + Series Modal of `LeagueView`/`PWHLLeagueView` (Phase 4, `LeagueView.css` sub-PR 3 of ~4 — tightly-coupled pairing per the original split plan, the modal is only ever reachable from a bracket-card click; re-checked against the same 3 things again: found one more real light-mode spot (`.series-modal__game-row:nth-child(even)`'s persistent zebra-stripe background, same shape as every other row background fixed this migration — `.bkt-card--clickable`'s hover-only tint was considered and left alone, matching the established pattern), confirmed the 2 already-known property-race collisions from the original investigation (`.series-modal__team-score`/`--home` on `justify-content`, `.series-modal__score`/`--win` on `color`+`font-weight`) plus the already-known `.bkt-card`/`--empty`/`--primary` (background AND border — `--primary` changes border-width 0.5px→1px too, not just color, so border was split out of the shared base entirely) PLUS one new instance this pass found: `.bkt-abbr`/`--dim` racing on `opacity` — the first time this migration hit a race on that property. Zero interpolated-suffix false positives (every modifier here is a static ternary/array-join in both files). `--bkt-line` (the connector-line custom property, consumed via `stroke="var(--bkt-line)"` on inline SVG lines) and `.popup-backdrop--centered`'s mobile-forced-centering override both stay real, unlayered CSS — the latter modifies `.popup-backdrop`, a class shared by 13 other files across the app and defined in `index.css`, so per the cascade-layers rule a Tailwind utility could never safely override it. `.series-modal__header .pp-close`'s 14px positioning (vs. `PP_CLOSE_CLASSES`'s own default 12px) is likewise kept as real CSS via the same unlayered-beats-layered mechanism. Also migrated NHL's Bracket-tab `.lv-empty`/`.lv-empty-msg` call site and PWHL's now-permanently-orphaned Leaders `.lv-empty` call site (sub-PR 2 already shipped and won't revisit it) — only PWHL's PowerRankings call site remains, for sub-PR 4); the Power Rankings tab of `LeagueView`/`PWHLLeagueView` (Phase 4, `LeagueView.css` sub-PR 4 of 4 — the LAST sub-PR for this file, `LeagueView.css` is now fully deleted and Phase 4 is complete. PWHL's own rankings table is entirely inline-styled and never used any `.pr-*` class — only the shared "How is this calculated?" toggle is real there, so that's the only piece migrated on the PWHL side. Closed out the 2 property-race collisions flagged from the original investigation — `.pr-rank-num`/`--top`/`--bot` and `.pr-col-stat`/`--gd-pos`/`--neg`, both racing on `color`. Found one more real light-mode spot: `.pr-how-item`'s background looked theme-reactive (`var(--surface-dim, rgba(255,255,255,0.03))`) but `--surface-dim` is never actually defined anywhere in the app, so it always resolved to the hardcoded fallback — a persistent background needing the same fix as every other row/card background this migration. **This fix was initially identified but not actually implemented** — caught only by live-verifying in the browser (`.pr-how-item` rendered the identical `rgba(255,255,255,0.03)` tint in both dark and light theme before the fix), a reminder that noting a finding in a comment isn't the same as shipping the fix; corrected in the same sub-PR before merge. The 3 real-CSS-only mechanisms accumulated across sub-PRs 1–3 (`--bkt-line`, `.series-modal__header .pp-close`, `.popup-backdrop--centered`'s mobile override) were hoisted into `index.css` alongside this app's other cascade-layer collision fixes rather than dropped, since `LeagueView.css` no longer exists to host them) — are migrated. The score bar, metrics grid, context banner, period-by-period grid, shot danger grid, scorer rows, goalie row, game-level team stat bars, event log, and dead record/legacy classes of `ShotMapView`/`PWHLShotMapView` (Phase 5, `ShotMapView.css` sub-PR 1 of ~6 — `ShotMapView.css` NOT deleted yet, the remaining ~5 feature areas migrate in later sub-PRs and the file stays imported until the last one; the investigation's "4 known consumers spanning 3 pages" estimate was corrected twice over — it's 4 files across 4 distinct routes not 3 (`/` redirects to `/pwhl/shots` for PWHL users but renders `ShotMapView` directly for NHL, so both are genuinely separate live routes), and 2 of the 4 files — `PWHLTeamView.jsx`, `PWHLScheduleView.jsx` — turned out to be narrow single-class borrowers (`.metrics-grid`, `.context-pill`) rather than full consumers; found and fixed a real bug along the way in `PWHLScheduleView.jsx` — 2 of 3 `.context-pill` usages applied the modifier as `playoff` (singular) while the CSS only ever defined `.playoffs` (plural), so those "Playoff" tags rendered with zero green styling; `.log-badge` and the separate-class pair `.goalie-stat-val`/`.goalie-svpct` both raced on `background`/`color` (the latter is the same shape as `.game-chip`/`.game-chip-active` — two independent same-specificity classes resolved only by source order, not a compound modifier — fixed the same way regardless); `.danger-cell`'s `.high`/`.med`/`.lo` modifiers only ever colored the nested `.danger-num` via a descendant selector, so the level was threaded directly into a `dangerNumClasses()` helper instead of preserving those modifier classes as literal markers; `PWHLTeamView.jsx`/`PWHLScheduleView.jsx` both dropped their now-unnecessary `ShotMapView.css` imports entirely, since `ShotMapView.jsx`/`PWHLShotMapView.jsx` each import it directly and still need its unmigrated rules; `light-mode-overrides.css`'s existing "ShotMapView.css additions" block needed no changes — the first file this migration where that up-front check came back clean); the Stat Drill-Down Popup of `ShotMapView`/`PWHLShotMapView` (Phase 5, `ShotMapView.css` sub-PR 2 of ~6 — `.drill-tabs`/`.drill-tab`/`.drill-totals-row`/`.drill-totals-label`/`.pen-row*` fully retired and removed from the CSS file; `.drill-overlay`/`.drill-popup`/`.drill-close`/`.drill-row-grid`/`.pen-row` kept as literal marker classnames — the first three for Cypress (`pwhl-shot-map.cy.js`), the last two so `light-mode-overrides.css`'s existing row-divider override keeps matching now that the CSS rule itself is gone; `.drill-period-badge`/`.drill-assists` confirmed genuinely dead and dropped; `.drill-val` raced with its `dim`/`total`/`green`/`red` modifiers on `color` (including a `total`+`dim` compound case combining both modifiers on one element); `.drill-col-header`/`.drill-row-grid`'s `> *` child-alignment rule (right-align every column except the first) reproduced via Tailwind's arbitrary child-selector syntax (`[&>*]:...`), the same technique already used in `TeamView.jsx`/`PWHLTeamView.jsx`'s `SPLIT_ADV_HEADER_CLASSES`; `.drill-row-grid`+`.drill-totals-row` and `.drill-totals-row`+`.pen-totals` are both separate-class pairs (lesson #18's shape) that raced on `padding-top` via source order — each real combination was given its own precomputed constant with the already-resolved values rather than composed from the two original classes; found and fixed a real bug in `PlayersView.jsx`/`PWHLPlayersView.jsx` along the way — both used a bare `className="drill-empty"` that coincidentally shared `ShotMapView.css`'s class name but never imported that file, so their "no stats yet" empty-states had been rendering completely unstyled since before this migration touched anything; `PPAnalysisPanel`/`PKAnalysisPanel`'s own `.drill-empty` usages (both files) are out of this sub-PR's scope — `ShotMapView.css`'s `.drill-empty` rule stays in the file until the PP Analysis Panel sub-PR migrates those too); the On-Ice Panel of `ShotMapView` (Phase 5, `ShotMapView.css` sub-PR 3 of ~6 — NHL-only, `OnIcePanel` has no PWHL equivalent at all, the first sub-PR in this file where the two sports' consumer graphs genuinely diverge rather than just differing in which classes each borrows; `.onice-chip`/`.onice-goalie` and `.onice-team-label`/`.car-label` are both separate-class pairs racing on `background`+`color` and `color` respectively (lesson #18's shape); `.onice-team`/`.onice-opp` raced on `padding-top` via source order, given its own precomputed constant; `.onice-card` collides with the shared `.card` class on `padding` (10px 12px vs 14px) — same cascade-layer fix as `.player-card`/`.empty-state`, a small real CSS rule added to `index.css`; `.situation-pill`/`.pill-green`/`.pill-amber` — flagged during the original investigation as a possible collision between `index.css`'s and `ShotMapView.css`'s differently-valued copies — turned out to be 100% dead CSS with zero consumers anywhere in the app, so both copies were simply dropped rather than reconciled); the Shot Volume Bar, Advanced Game Panel chips, Live Insights, and Debug panel of `ShotMapView`/`PWHLShotMapView` (Phase 5, `ShotMapView.css` sub-PR 4 of ~6 — `.sv-corsi-note`/`.sv-note-text`, `.goalie-gsax`, `.hm-player-chips`/`.hm-chip` were all confirmed genuinely dead and dropped; `.shotmap-top-btn` is NHL-only (no PWHL equivalent); Live Insights turned out to also be used by `PWHLGameEvents.jsx`'s `PWHLInsightsCard` — found via full-tree grep, flagged out-of-scope back in Phase 4 sub-PR 2 (`GameEvents.css`) with a comment saying so, migrated here directly since it's the exact same classes; `.shot-volume-section` collides with the shared `.card` on padding, same fix as `.onice-card` (sub-PR 3); `.sv-num`/`.sv-num.red` raced on `text-align` (flagged in the original investigation), `.insights-header`/`.insights-header-collapsed` raced on `margin-bottom` (a new separate-class pair instance, lesson #18's shape); found a real gap in the marker-audit methodology itself — the word-boundary exact-class-selector audit came back clean for the Live Insights section, but `shot-map.cy.js` selects via the substring attribute selector `` `[class*="insight"]` ``, which the audit doesn't check; caught only by running the actual spec, fixed by keeping `.insight-row` as a literal marker); the PP/PK Analysis Panel of `ShotMapView`/`PWHLShotMapView` (Phase 5, `ShotMapView.css` sub-PR 5 of 6 — the CSS was already written generically ("pp-" prefixed) for both `PPAnalysisPanel` and `PKAnalysisPanel`, no separate PK classes exist; the first section this migration with zero property races found anywhere (every base+modifier pair splits cleanly); zero Cypress markers needed, re-checked against both exact-class and `[class*=]` substring selector patterns (lesson #20) this time rather than just the word-boundary audit; PWHL's PP/PK panels are structurally simpler — no PP/PK units feature, no assists shown, no shot-type/blocker breakdown — confirmed via full-file grep, a real asymmetry not a bug; `.drill-empty` (kept real CSS since sub-PR 2 specifically for these two panels) is now fully retired and removed from `ShotMapView.css`; the Cypress suite doesn't click through to this panel's actual content (only checks the summary MetCards exist), so live-pixel verification wasn't reachable here either — same limitation as the On-Ice Panel in sub-PR 3, relied on manual value-by-value verification against the original CSS instead); the Game chips (`GameChipsRow.jsx`), Season archive dropdown (`SeasonChipRow.jsx`), Season type toggle (`SeasonTypeToggle.jsx`), and disabled-selector hint (`DisabledHint.jsx`) shared components (Phase 5, `ShotMapView.css` sub-PR 6 of 6 — the LAST sub-PR for this file, `ShotMapView.css` is now fully deleted and Phase 5 is complete. `.game-chip`/`.game-chip-active` — flagged all the way back in the original investigation (lesson #18) as two separate classes of equal specificity resolved only by source order, a collision waiting to happen — converted into a single `gameChipClasses()` helper returning a complete non-competing utility set per state, rather than left alone since it "wasn't broken yet"; the full resolved-state math (worth remembering) included a genuine pre-existing quirk where `.game-chip-active`'s `!important` border-color beat a selected `LiveGameChip`'s inline red border, while its non-`!important` inline text color still won — faithfully preserved rather than "fixed" as an unrequested behavior change. `.season-type-toggle-btn`/`.on` raced on `background`+`color` (standard compound base+modifier shape). `.season-archive-item`/`.active` raced on `color`; its `:hover` override was deliberately only added to the inactive variant, matching the original CSS's active-always-wins-over-hover resolution instead of introducing a new same-property race between two Tailwind utilities. `.chip-disabled`'s cross-file descendant-selector rule (grays out `.rink-btn` from `IceRink.css`, `.game-chip`, and `.season-type-toggle-btn` together) was hoisted to `index.css` rather than force-converted, the same "selector shape is the hard part" judgment used throughout this migration — `.chip-disabled`/`.game-chip`/`.season-type-toggle-btn` are kept as literal markers specifically so it keeps resolving. `.en-indicator`/`.car-en`/`.opp-en` (kept real, `!important` CSS since Phase 4 sub-PR 2) were also hoisted to `index.css` now that the host file is gone. **Found and fixed a real regression during this final cleanup pass, not caught by any prior sub-PR's own verification**: sub-PR 1's `.scorer-chip` conversion had dropped the literal `scorer-chip` classname entirely (correct per the Cypress-marker check available at the time, but predates lesson #19's broader "check light-mode-overrides.css before dropping ANY marker" rule) — silently orphaning `light-mode-overrides.css`'s `.scorer-chip.assist` rule since sub-PR 1 shipped, undetected for 4 sub-PRs; fixed by restoring `scorer-chip` (and the variant name) as literal markers in `scorerChipClasses()`); the Game cards + results list of `ScheduleView`/`PWHLScheduleView` (Phase 6, `ScheduleView.css` sub-PR 1 of 5 — `ScheduleView.css` NOT deleted yet, still 1610 lines pre-sub-PR-1, the remaining ~4 feature areas migrate in later sub-PRs and the file stays imported until the last one; `GameCard.jsx` is itself a 3-function multi-sub-PR file — only its `GameCard` function was touched, `SeriesCard`/`SortBar` stay untouched for their own later sub-PRs; `.game-card`/`.gc-*` turned out to be NHL-only in practice despite `ScheduleView.css` itself being genuinely shared — PWHL's schedule has no upcoming-game preview card at all, it renders `.result-card` unconditionally for both upcoming and completed games, confirmed via full-tree grep for any `gc-` classname in `PWHLScheduleView.jsx` coming back empty; `.result-card`/`.result-*` by contrast IS shared, touched in both `ScheduleView.jsx` and `PWHLScheduleView.jsx` (2 separate independently-implemented usages there, not a shared component); `.sched-sub` and `.gc-record` confirmed dead (zero JSX consumers) and dropped; `.matchup-detail` collides with `.card` on 3 properties at once (background/border-color/border-radius, plus a `border-top:none` cutout) rather than just padding — hoisted to `index.css` alongside the redundant `border-top-left-radius:0`/`border-top-right-radius:0` declarations it carried (already implied by the border-radius shorthand, dropped as dead weight); `.empty-state` turned out to already be a shared, unlayered `index.css` rule from Phase 4's `TeamView.css` work — `ScheduleView.css` had its own competing, slightly different copy (28px 14px + margin-bottom:8px vs index.css's 28px 16px) that had been winning on the Schedule page alone via cascade/import order the whole time; absorbed into the shared 16px value as an imperceptible 2px simplification, margin-bottom:8px kept as an additive Tailwind utility since it doesn't collide; `.result-abbr.team-primary-text`/`.result-num.team-primary-text` is a genuine higher-specificity compound-selector override (font-weight 600 vs the base classes' 700), not a source-order race — caught by re-deriving the cascade math rather than trusting the base rule's value; found 2 more redundant duplicate declarations while trimming the file — `.game-card.upcoming-clickable`/`.game-card.selected` at the bottom of the file exactly repeated rules the top of the file already set unconditionally, dropped as dead weight rather than migrated)); the Tab switcher, Record header, Series card, and Round section grouping of `ScheduleView`/`PWHLScheduleView` (Phase 6, `ScheduleView.css` sub-PR 2 of 5 -- `.sched-tabs`/`.sched-tab`/`.tab-badge`, `.sched-record`/`.pts-badge`/`.div-badge`, `.series-card` and its series- family, `.pip` and its variants, `.round-section` and its round- family, `.series-sweep`/`.series-swept`, `.md-series-score`/`.md-series-label` all migrated; `.sched-tabs` stays a literal marker on `ScheduleView.jsx` own usage specifically so `ScheduleView.css`'s `.sched-tabs .view-mode-toggle { margin-left: auto }` descendant rule keeps resolving until `.view-mode-toggle` itself migrates in sub-PR 4. Found and fixed a real regression from sub-PR 1's own merge, not caught by that sub-PR's own verification: `PWHLScheduleView.jsx` also renders `.sched-header`/`.sched-title` (a second consumer sub-PR 1's page-count check missed), so deleting that CSS rule from `ScheduleView.css` had left PWHL's schedule header completely unstyled since sub-PR 1 shipped -- fixed by adding the same Tailwind utilities there. `.series-card.series-active` collides with `.card` on background+border-color at once, same shape as `.matchup-detail` -- hoisted to `index.css`; `.series-card` own non-active `border-color` was already a no-op (matched `.card` own default) and was dropped rather than migrated. Fixed a second real pre-existing bug along the way, in `GameCard.jsx`'s `SeriesCard`: the CAR-side `.series-abbr` used the literal inline style string "var(team-primary)" -- missing the -- prefix, silently invalid CSS the browser had always ignored, so the CAR abbreviation had never actually rendered in team color there. Confirmed `.round-section`/`.series-card` are NHL/PWHL-shared but independently-implemented (not a shared component), same shape as sub-PR 1's `.result-card` finding -- both files needed the identical conversion applied separately; PWHL's round-section genuinely omits `.round-series-opp`/`.round-sweep-badge` (no opponent-abbreviation or sweep-emoji rendering there), a real UI asymmetry not a bug)); the Game popup shell and box-score tables of `ScheduleView` (Phase 6, `ScheduleView.css` sub-PR 3 of 5 -- NHL-only, single real consumer `GameStatsPopup.jsx`/`GameStatsComponents.jsx` (PWHL's box score system is a fully separate, already-self-contained sibling: `PWHLGameStatsPopup.css`/`.pgs-*`/`.pbs-*`); migrates `.popup-backdrop`/`.game-popup`/`.gp-header`/`.gp-body`, period table, team-stat rows, the full skater/goalie tables, the two-column goals layout, the skater team toggle, and the advanced Corsi/Fenwick/PDO/Puck-Luck stats grid. `.gp-summary-*` (AI Game Summary Card) is deliberately left in this file -- out of scope, migrates in sub-PR 5. The "Goals list" block this file used to also carry (`.goals-list`/`.goal-row`/`.goal-meta`/`.goal-detail`/bare `.goal-scorer`/`.goal-strength`) was confirmed genuinely dead -- zero JSX consumers -- and dropped; `.goal-season-num` (a bare class the dead block also happened to target) kept its real cascade-resolved value (font-weight from the dead rule, color from the live one, since it came later in source -- confirmed neither rule's wrapper classes needed to exist for this to matter, since both targeted the same bare classname directly). `.gp-star-row`/`.gp-star-num`/`.gp-star-name`/`.gp-star-team` and `.goals-col-header` were each split across two non-adjacent sections with real value conflicts (gap, padding, width vs. flex-shrink, font-size) -- migrated using the final cascade-resolved values throughout, not either section's raw values alone. `.gp-adv-fill.red` and `.gp-help` were confirmed genuinely dead (zero JSX consumers) and dropped. Found and fixed a real pre-existing bug along the way: the "OPP" label in the advanced-stats header row used a bare `.muted` class that was never actually defined anywhere in the app (only ever `.X.muted` compound modifiers existed elsewhere, e.g. `.gp-stat-val.opp`) -- it rendered with zero styling instead of the dimmed color every sibling label like it uses. Also caught and fixed a genuine hover/active-state cascade risk before it shipped: `.skater-toggle-btn:hover` and `.active-car`/`.active-opp`'s own color are equal-specificity compound selectors in the original CSS, with the active state winning on hover too since it's later in source -- a naive Tailwind `hover:` utility would instead win on specificity regardless of source order, so the hover color is only added to the non-active variant rather than stacked unconditionally)); the Sort bar and Calendar view of `ScheduleView`/`PWHLScheduleView` (Phase 6, `ScheduleView.css` sub-PR 4 of 5 -- migrates `.sort-bar` and its family (`GameCard.jsx`'s `SortBar`, `PWHLScheduleView.jsx`'s `PWHLSortBar`), `.scroll-top-btn`, `.view-mode-toggle`/`.vm-btn`, and `.calendar-wrap`/`.cal-*` + responsive (`CalendarView.jsx`, `PWHLCalendarView.jsx`). `.sort-btn:hover`/`.active` and `.vm-btn:hover`/`.active` are both the same equal-specificity hover-vs-active-wins-on-source-order shape as `.skater-toggle-btn` (sub-PR 3) -- hover scoped to the non-active variant only. `.cal-cell`'s combinatorial state (result x today x playoff) was converted into a `calCellClasses()` helper computing the full resolved class set per combination, rather than stacking independent conditional classes, given the real cross-cutting cascade rules involved (`.has-game.upcoming`'s 3-class-compound border-color override always wins regardless of source order since it's genuinely more specific; `.today`'s `!important` border wins over everything, including result color and playoff dashing, but not background). PWHL's calendar genuinely never renders `.playoff-cell`/`.cal-playoff-badge` (no equivalent branch in `PWHLCalendarView.jsx`), a real UI asymmetry confirmed via its own consumer, not a bug. **Caught the same class-stacking bug twice more while building this sub-PR's own `.sort-btn`/`.vm-btn` helpers** -- a shared base string carrying an unconditional `bg-transparent` (and, for `.sort-btn`, an unconditional border-color) while the active branch appended a second, conflicting `bg-[...]`/`border-[...]` utility on top, the same ambiguous-two-conflicting-arbitrary-utilities shape as the `.goal-entry-assists` fix in sub-PR 3 -- caught this time by live-testing rather than static review, since the resulting Tailwind CSS silently picked one winner rather than erroring. Went back and audited every earlier `bg-transparent` usage in files this migration had already touched and found the identical bug already shipped in sub-PR 3's own `.skater-toggle-btn` (`GameStatsPopup.jsx`) -- its `active-opp` state's `bg-[var(--blue-dim)]` was silently losing to the shared base's `bg-transparent`, fixed retroactively in this same sub-PR rather than left for a future pass)); the Prediction tab, AI Game Summary Card, and MatchupDetail tabs of `MatchupDetail`/`GameStatsPopup` (Phase 6, `ScheduleView.css` sub-PR 5 of 5 -- the LAST sub-PR for this file, `ScheduleView.css` is now fully deleted and Phase 6's `ScheduleView.css` migration is complete. Migrates `.md-tabs`/`.md-tab`, `.md-prediction`/`.md-pred-*`, `.md-odds-*` (2 call sites -- the early-return no-standings guard and the main render), `.md-factors`/`.md-factor`, `.md-score-pred*`/`.md-pred-note`, `.md-topline-*` (`TopLineCard`), `.md-ai-*` (`PredictionAnalysis`), and `.gp-summary-*` (the AI Game Summary Card, deferred from sub-PR 3 since it's a self-contained AI/prediction feature -- migrated in `GameStatsPopup.jsx` alongside the rest of the AI/prediction surface here). `.md-tab:hover`/`.active` is the same equal-specificity hover-vs-active-wins-on-source-order shape as `.sort-btn`/`.vm-btn`/`.skater-toggle-btn` from earlier sub-PRs. `.md-factor.opp-edge span:first-child` (a genuine descendant-selector override, not a race) reproduced via Tailwind's `[&>span:first-child]` arbitrary-child-selector syntax. `.md-export-btn`, `.md-ai-btn`, and `.md-save-pred-btn` were confirmed genuinely dead (zero JSX consumers) and dropped; `.md-track-record`'s CSS rule had been left behind in sub-PR 1 even though its own JSX was already migrated then -- a loose end cleaned up here, no JSX change needed. **Caught 2 more real bugs during live verification, both violating this app's own documented "avoid named Tailwind radius utilities" rule** (see the bottom of this row) -- `rounded-xl` on `.gp-summary-card` resolved to 10.5px instead of the intended 12px, and `rounded-sm` on `CalendarView.jsx`/`PWHLCalendarView.jsx`'s `.cal-leg-dot` (from sub-PR 4) resolved to 1.75px instead of 2px, both because Tailwind's named radius scale is rem-based against a 16px-assumed root while this app's real root is 14px; fixed by switching both to explicit `rounded-[Npx]` values, and swept every file touched across all 5 `ScheduleView.css` sub-PRs to confirm no other named-radius utilities had slipped through)); `PWHLGameStatsPopup`/`PWHLBoxScoreTable`/`PWHLGamePreviewPopup` (Phase 6, file pair 1 of the 6-file continuation -- `PWHLGameStatsPopup.css`/`PWHLGamePreviewPopup.css` both fully deleted. `PWHLBoxScoreTable.jsx` is a hidden/indirect consumer -- it never imported `PWHLGameStatsPopup.css` itself, relying on its parent `PWHLGameStatsPopup.jsx` having already loaded it, the same "child depends on an unrelated parent's import" shape as `ShotMapView.css`'s transitive consumers in Phase 5 -- migrated in the same PR rather than treated as out of scope. `.pgs-toggle-btn.active`'s color/border are 100% inline-style-driven (never a CSS class rule), so there's no hover-vs-active cascade race to guard against here, unlike every other toggle-button family this migration has touched. `.pbs-row.has-points`'s `rgba(255,255,255,0.02)` background is a real light-mode gap, same invisible-on-light shape fixed throughout this migration -- `.pbs-row`/`.has-points` kept as literal markers on the migrated `PWHLBoxScoreTable.jsx` elements so `light-mode-overrides.css`'s new override keeps applying. Both files are self-contained siblings to NHL's `GameStatsPopup.jsx`/`GameStatsComponents.jsx` (sub-PR 3) by original design -- team color always comes from an explicit prop, never `var(--team-primary)` -- so no NHL/PWHL shared-class parity check was needed. Zero `var(word)`-missing-`--`-prefix typos and zero named-radius-scale mistakes found on a full sweep of all 3 files); the rest of the app still uses per-component plain CSS. Named Tailwind radius utilities (`rounded-lg`, `rounded-md`, etc.) are avoided app-wide in favor of explicit `rounded-[Npx]` — the app's 14px root font-size (vs. Tailwind's assumed 16px) scales rem-based utilities, and three radius step names collide with this app's own pre-existing `--radius`/`--radius-sm`/`--radius-lg` tokens; `tailwind.css`'s `--spacing` override compensates the numeric spacing scale for the same 14px-root mismatch |
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
│   │   ├── ShotMapView.jsx             # NHL live shot map — season/game history selector (Session 77) lets you browse past seasons/games; disabled+tooltip (not hidden) while a game is live, since a live game always wins the display. Tailwind (Phase 5, all 6 sub-PRs) — ShotMapView.css fully deleted
│   │   ├── ScheduleView.jsx            # NHL schedule — Tailwind (Phase 6, all 5 sub-PRs) — ScheduleView.css fully deleted
│   │   ├── TeamView.jsx                # NHL 6-tab team analytics (Advanced tab: xGF% sparkline) — Tailwind (Phase 4, sub-PR 3), no .css file
│   │   ├── PlayersView.jsx/.css        # NHL players
│   │   ├── LeagueView.jsx              # NHL 5-tab league page — Tailwind (Phase 4, sub-PRs 1-4), no .css file
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
│   │   ├── PeriodSummary.jsx           # Period/game summary popup + share canvas + hat trick badges — fully Tailwind (Phase 4, sub-PRs 5a/5b; PeriodSummary.css deleted)
│   │   ├── PWHLPeriodSummary.jsx       # PWHL period/game summary popup + share canvas — fully Tailwind, same as above
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
│       ├── SportContext.jsx            # Sport state (NHL/PWHL), derived from the current route (/pwhl/* vs everything else) rather than localStorage — see "Sport/route mismatch" below. localStorage['eyewall:sport'] still holds the user's stored default, used by TeamPicker/favoriteTeamSync/onboarding
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
- **Milestone card titles never truncate (pre-existing, found during the Tailwind migration):** `MilestoneCard`'s `<h3>` combines two classes whose original CSS both set `display` — `.news-card-title`'s 3-line clamp (`display: -webkit-box`) loses to `.milestone-card-title`'s `display: flex`, which wins since it's defined later in the same stylesheet. The Tailwind migration (Phase 4, sub-PR 4) deliberately preserved this exact behavior rather than silently fixing it as a migration side effect — see `src/utils/newsViewClasses.js`'s `MILESTONE_CARD_TITLE_CLASSES` comment. If milestone titles should actually truncate, that's a real fix to make deliberately, not something to rediscover as a regression.

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
