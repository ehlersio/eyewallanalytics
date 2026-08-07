// components/ShareButtons.jsx
//
// Reusable share button row for all EyeWall export cards.
// Renders: [📸 Save Image] [𝕏 Share to X] [📤 Share] (mobile only)
//
// Props:
//   onSave          — async fn, called on Save click
//   onShareX        — fn, called on X click
//   onNativeShare   — async fn, called on Share click
//   canNativeShare  — bool, if false the Share button is hidden on desktop
//   saving          — bool, disables Save button + shows spinner
//   sharing         — bool, disables Share button + shows spinner
//   className       — optional wrapper class
//
// Tailwind migration (Session 96, Phase 2) -- previously ShareButtons.css,
// imported redundantly by all 5 consumers (LeagueView, PeriodSummary,
// PWHLPeriodSummary, PredictionShareCanvas, ScoutingTab) even though this
// file itself never imported its own CSS -- each of those 5 imports is
// removed as part of this migration.
//
// .share-buttons-row is kept as a literal marker string alongside the
// Tailwind utilities -- league.cy.js and period-summary.cy.js select on it
// directly. Carries no CSS of its own anymore; Tailwind owns the visuals,
// this is a pure test hook now.
//
// PeriodSummary.css had its own `.ps-share-section .share-buttons-row {
// justify-content: center }` override -- redundant with this component's
// own base centering (verified: same value both ways), removed as part of
// this migration rather than left dangling. That file also had a
// `.ps-share-btn`/`.primary`/`.secondary` class family with zero JSX
// consumers anywhere in the codebase (confirmed via grep) -- dead CSS
// found along the way, removed too; not a rename of anything this
// component ever used.
const ROW_CLASSES = 'share-buttons-row flex gap-2 flex-wrap items-center justify-center';
const BTN_BASE = 'inline-flex items-center justify-center gap-1.5 py-[11px] px-4 rounded-[12px] border-0 text-[13px] font-bold cursor-pointer [transition:opacity_0.15s,transform_0.1s] whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]';
const BTN_SAVE = 'flex-[1.5] bg-[var(--red-bright)] text-[#fff] enabled:hover:opacity-[0.88]';
const BTN_X = 'flex-1 bg-[#000] text-[#fff] border-[0.5px] border-[rgba(255,255,255,0.15)] font-[family-name:Georgia,_serif] enabled:hover:bg-[#111]';
const BTN_NATIVE = 'flex-1 bg-[var(--bg3)] text-[color:var(--text)] border-[0.5px] border-[var(--border)] enabled:hover:bg-[var(--bg2)]';
// Hides on hover-capable, fine-pointer devices (desktop) when the Web
// Share API isn't supported -- deliberately NOT a viewport-width
// breakpoint, so it stays correct on a touch-only device even at a wide
// viewport. Written as a raw arbitrary media-query variant (not a named
// Tailwind shorthand) to guarantee it matches the original CSS's
// `@media (hover: hover) and (pointer: fine)` exactly.
const BTN_HIDDEN_DESKTOP = '[@media(hover:hover)_and_(pointer:fine)]:hidden';

export default function ShareButtons({
  onSave,
  onShareX,
  onNativeShare,
  canNativeShare,
  saving   = false,
  sharing  = false,
  className = '',
}) {
  return (
    <div className={`${ROW_CLASSES} ${className}`}>
      {/* Save image */}
      <button
        className={`${BTN_BASE} ${BTN_SAVE}`}
        onClick={onSave}
        disabled={saving || sharing}
        aria-label="Save image"
      >
        {saving ? '⏳' : '📸'} {saving ? 'Saving…' : 'Save Image'}
      </button>

      {/* Share to X */}
      <button
        className={`${BTN_BASE} ${BTN_X}`}
        onClick={onShareX}
        disabled={saving || sharing}
        aria-label="Share to X (Twitter)"
      >
        𝕏 Post to X
      </button>

      {/* Native share — always render but hidden on desktop via CSS when unsupported */}
      <button
        className={`${BTN_BASE} ${BTN_NATIVE} ${!canNativeShare ? BTN_HIDDEN_DESKTOP : ''}`}
        onClick={onNativeShare}
        disabled={saving || sharing}
        aria-label="Share via device share sheet"
      >
        {sharing ? '⏳' : '📤'} {sharing ? 'Sharing…' : 'Share'}
      </button>
    </div>
  );
}
