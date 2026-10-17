// src/utils/scoreCardClasses.js
// The shot maps' score card (ShotMapView.jsx, PWHLShotMapView.jsx,
// hockeytech/HockeyTechShotMapView.jsx): one set of classes instead of the
// three identical copies each view used to carry. Same precedent as
// pageClasses.js / rinkBtnClasses.js.
//
// .score-card stays a literal marker class (index.css and Cypress read it).
// .team-primary-text is the unlayered marker ShotMapView.jsx explains: a
// Tailwind color utility could never override it.

export const SCORE_CARD_CLASSES = 'score-card card mb-[10px]';
// flex-wrap (not a single-line row): on narrow phones our side + the center
// info + their side + the season-selector column don't all fit on one line
// (confirmed on a real device: the selector was clipped and unreachable).
// Wrapping keeps every control reachable; the selector column takes
// `ml-auto` so it lands at the right edge of its own line when wrapped.
export const SCORE_INNER_CLASSES = 'flex items-center justify-between gap-[10px] flex-wrap';
export const SCORE_TEAM_WRAP_CLASSES = 'flex flex-col items-center gap-1';
export const SCORE_TEAM_CLASSES = 'flex items-center gap-2';

export const scoreAbbrClasses = (variant) => {
  const base = 'font-[family-name:var(--font-display)] text-[18px] font-bold tracking-[.04em]';
  if (variant === 'team-primary') return `${base} team-primary-text`;
  const color = variant === 'red' ? 'text-[color:var(--red-bright)]'
    : variant === 'muted' ? 'text-[color:var(--text-muted)]' : '';
  return `${base} ${color}`;
};

export const scoreNumClasses = (variant) => {
  const base = 'font-[family-name:var(--font-display)] text-[36px] font-bold leading-none';
  if (variant === 'team-primary') return `${base} team-primary-text`;
  const color = variant === 'red' ? 'text-[color:var(--red-bright)]'
    : variant === 'muted' ? 'text-[color:var(--text-muted)]' : '';
  return `${base} ${color}`;
};

export const SCORE_CENTER_CLASSES = 'text-center';
export const SCORE_PERIOD_CLASSES = 'text-[11px] text-[color:var(--amber)] font-semibold uppercase tracking-[.06em]';
export const SCORE_CLOCK_CLASSES = 'font-[family-name:var(--font-mono)] text-[22px] text-[color:var(--text)] leading-[1.2]';
export const SCORE_STATE_CLASSES = 'text-[10px] text-[color:var(--text-dim)]';

// .pill/.pill-red (index.css, Phase 7b): shape + live-state color.
export const PILL_RED_CLASSES = 'inline-flex items-center gap-[5px] py-[3px] px-[10px] rounded-[20px] text-[11px] font-medium bg-[var(--red-dim)] text-[color:var(--red-bright)] border-[0.5px] border-[color:var(--red-border)]';

// The card's trailing season-selector column: a right-aligned stack on wide
// screens, a wrapping row under the score line on phones (where a tall
// column would leave a dead gap beside it).
export const SCORE_SELECTOR_COL_CLASSES = 'relative flex flex-col items-end gap-1.5 ml-auto max-[640px]:w-full max-[640px]:flex-row max-[640px]:flex-wrap max-[640px]:items-center max-[640px]:justify-end';
// SeasonChipRow's className inside that column.
export const SCORE_SEASON_CHIPS_CLASSES = 'max-[640px]:flex-row max-[640px]:flex-wrap max-[640px]:justify-end max-[640px]:items-center';
