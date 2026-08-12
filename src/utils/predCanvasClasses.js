// Shared classes for the 1080x1080 off-screen share-canvas shell, originally
// PredictionCanvas.css (Phase 6 migration). Reused by both
// PredictionShareCanvas.jsx (its original single consumer) and
// LeagueView.jsx's PowerRankingsCanvas, which imported PredictionCanvas.css
// directly and reused .pred-canvas/-header/-logo/-badge/-ai*/-footer for its
// own unrelated export card -- a hidden cross-file dependency, the same
// shape as IceRink.css's .rink-btn (Phase 6). All classnames kept as
// literal markers for dev-tooling recognizability, though none of them are
// Cypress markers -- these canvases are dark-only, off-screen export
// surfaces never asserted on directly (same as PeriodSummary.css's
// ps-canvas-* and ScoutingTab.css's sc-canvas precedent).
export const PRED_CANVAS_CLASSES = 'pred-canvas fixed left-[-9999px] top-0 w-[1080px] h-[1080px] bg-[#1a1a2e] flex flex-col [font-family:-apple-system,BlinkMacSystemFont,\'Segoe_UI\',sans-serif] overflow-hidden text-white';
export const PRED_CANVAS_HEADER_CLASSES = 'pred-canvas-header flex items-center justify-between py-9 px-[52px] pb-4';
export const PRED_CANVAS_LOGO_CLASSES = 'pred-canvas-logo w-20 h-20 object-contain';
export const PRED_CANVAS_BADGE_CLASSES = 'pred-canvas-badge text-[13px] font-extrabold tracking-[0.14em] uppercase text-[color:var(--team-canvas)] bg-[rgba(var(--team-canvas-rgb),0.12)] py-1.5 px-4 rounded-[20px]';
export const PRED_CANVAS_AI_CLASSES = 'pred-canvas-ai py-2.5 px-[52px] border-t-[0.5px] border-t-[rgba(255,255,255,0.06)] border-b-[0.5px] border-b-[rgba(255,255,255,0.06)]';
export const PRED_CANVAS_AI_LABEL_CLASSES = 'pred-canvas-ai-label text-[11px] font-extrabold tracking-[0.12em] uppercase text-[color:var(--team-canvas)] mb-[5px]';
export const PRED_CANVAS_AI_TEXT_CLASSES = 'pred-canvas-ai-text text-[13px] leading-[1.55] text-[rgba(255,255,255,0.65)]';
export const PRED_CANVAS_FOOTER_CLASSES = 'pred-canvas-footer flex justify-between py-2.5 px-[52px] pb-7 text-[13px] text-[rgba(255,255,255,0.18)] mt-auto';
