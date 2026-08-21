// Shared `.rink-btn` toolbar-button style, originally IceRink.css (Phase 6
// migration, back when IceRink.jsx was this app's own in-tree rink
// component -- since extracted to the standalone react-hockey-rink npm
// package and deleted from this tree; its own toolbar buttons now use a
// bundled, library-scoped copy of this same class-building logic instead).
// Reused by SeasonChipRow.jsx (season chips), PWHLShotMapView.jsx
// (period-summary buttons), and ShotMapView.jsx (Momentum window buttons) --
// none of which ever imported IceRink.css themselves; they relied on
// IceRink.jsx having already loaded it elsewhere on the page (back when that
// was a real CSS-file side-effect import), the same hidden-consumer shape as
// PWHLBoxScoreTable.jsx/PWHLGameStatsPopup.css. Tailwind's JIT scan no longer
// depends on that import order -- the literal utility-class strings below
// are enough on their own -- but the "rink-btn" classname itself still has
// to stay literal for the Cypress assertions noted below.
// "rink-btn"/"on" are kept as literal marker classnames on every call site:
// shot-map.cy.js/pwhl-shot-map.cy.js assert `.rink-btn` and
// `have.class('on')` directly, and index.css's `.chip-disabled .rink-btn`
// cross-file descendant rule also depends on the literal "rink-btn"
// classname staying present regardless of which component renders it.
//
// `.rink-btn:hover:not(:disabled)` is genuinely higher-specificity than
// `.rink-btn.on` in the original CSS (3 pseudo-class/class selectors vs. 2),
// so hovering an active button always won on text/border-color there
// regardless of source order -- the same incidental-not-deliberate shape
// already found and deliberately NOT replicated in DevReplayView.jsx's
// `.dev-btn.active` vs. `.dev-btn:hover:not(:disabled)`. Treated the same
// way here: active and hover are mutually exclusive Tailwind states rather
// than chasing that specificity quirk.
const BASE = 'rink-btn py-1 px-[11px] rounded-[20px] text-[11px] font-medium border-[0.5px] whitespace-nowrap [transition:all_0.15s] disabled:opacity-30 disabled:cursor-default';

export function rinkBtnClasses({ active = false, variant = null } = {}) {
  if (variant === 'ot') {
    // .rink-btn.ot-btn / .ot-btn.on -- amber tint, OT period buttons only
    return active
      ? `${BASE} on ot-btn bg-[rgba(240,160,48,0.15)] border-[rgba(240,160,48,0.5)] text-[color:var(--amber)]`
      : `${BASE} ot-btn border-[rgba(240,160,48,0.3)] text-[color:var(--amber)] enabled:hover:border-[rgba(240,160,48,0.6)]`;
  }
  if (variant === 'heat') {
    // .rink-btn.heat-on -- declared after .rink-btn.on in the original file,
    // so on the Heat toggle (which always carries both classes at once when
    // active) heat-on's background/border/color win outright over .on's,
    // same specificity, later source. Reproduced directly rather than
    // stacked, since there's never a heat-on-without-on state in this app.
    return active
      ? `${BASE} on heat-on bg-[rgba(255,100,0,0.18)] border-[rgba(255,100,0,0.5)] text-[#ff6600]`
      : `${BASE} bg-transparent border-[color:var(--border-2)] text-[color:var(--text-muted)] enabled:hover:text-[color:var(--text)] enabled:hover:border-[color:var(--border-2)]`;
  }
  if (variant === 'filter') {
    // .rink-filter-btn.on -- declared after the generic .rink-btn.on, wins
    // on background/border-color (color happens to already match).
    return active
      ? `${BASE} on rink-filter-btn flex items-center gap-[5px] bg-[rgba(204,34,0,0.2)] border-[rgba(204,34,0,0.4)] text-[color:var(--red-bright)]`
      : `${BASE} rink-filter-btn flex items-center gap-[5px] bg-transparent border-[color:var(--border-2)] text-[color:var(--text-muted)] enabled:hover:text-[color:var(--text)] enabled:hover:border-[color:var(--border-2)]`;
  }
  return active
    ? `${BASE} on bg-[var(--red-dim)] border-[color:var(--red-border)] text-[color:var(--red-bright)]`
    : `${BASE} bg-transparent border-[color:var(--border-2)] text-[color:var(--text-muted)] enabled:hover:text-[color:var(--text)] enabled:hover:border-[color:var(--border-2)]`;
}
