// src/utils/newsViewClasses.js
// Shared Tailwind class constants for NewsView.css's classes (Phase 4 --
// NewsView.css deleted). Unlike the NHL/PWHL-paired files elsewhere in this
// migration, these are genuinely shared across 4 files with zero variation
// (NewsView.jsx, PWHLNewsView.jsx, MilestonesFeed.jsx, TriviaFeed.jsx all
// explicitly reuse NewsView.css's card/chip classes by original design --
// see each file's own header comment) -- so they live in one module and are
// imported, rather than duplicated 4x, matching the existing precedent of
// HatTrickPopup being imported across GameEvents.jsx/PWHLGameEvents.jsx.
//
// .news-card/.news-skeleton's own padding (14px) happens to exactly match
// .card's unlayered padding, so neither sets padding here -- .card's own
// padding passes through unchanged. .news-header and .news-error/.news-empty
// do NOT match .card's padding, so those collisions are fixed as real
// unlayered CSS in index.css (same pattern as .player-card/.empty-state),
// not as Tailwind utilities that would silently lose.
//
// .news-chip/.news-view-toggle-btn/.ms-team-select-btn/.ms-team-option all
// have an .active modifier that sets background/color/border-color -- their
// base states also set background/color/border-color unconditionally, so
// (per lesson #9) base carries NO color-family properties; each state
// (default vs active) supplies a complete, mutually exclusive set instead.

export const NEWS_VIEW_CLASSES = 'pb-5';

export const NEWS_HEADER_CLASSES = 'news-header mb-2';
export const NEWS_HEADER_ROW_CLASSES = 'flex justify-between items-start mb-[10px]';
export const NEWS_TITLE_CLASSES = 'font-[family-name:var(--font-display)] text-[18px] font-extrabold text-[color:var(--text)]';
export const NEWS_UPDATED_CLASSES = 'news-updated text-[10px] text-[color:var(--text-dim)] mt-[2px]';

export const NEWS_REFRESH_BTN_CLASSES = 'news-refresh-btn bg-[var(--bg3)] border-[0.5px] border-[var(--border)] text-[color:var(--text-muted)] text-[16px] w-8 h-8 rounded-[8px] cursor-pointer flex items-center justify-center p-0 [transition:background_0.15s] enabled:hover:bg-[var(--bg4)] disabled:opacity-40';

export const NEWS_FILTER_CHIPS_CLASSES = 'news-filter-chips flex gap-[6px] flex-wrap';
const CHIP_BASE = 'news-chip text-[11px] font-medium py-1 px-[10px] rounded-[20px] cursor-pointer [transition:all_0.12s]';
const CHIP_INACTIVE = 'bg-[var(--bg3)] border-[0.5px] border-[var(--border)] text-[color:var(--text-muted)] hover:bg-[var(--bg4)] hover:text-[color:var(--text)]';
const CHIP_ACTIVE = 'active bg-[rgba(204,34,0,0.2)] border-[0.5px] border-[rgba(204,34,0,0.4)] text-[color:var(--red-bright)] font-bold';
export function newsChipClasses(active) {
  return `${CHIP_BASE} ${active ? CHIP_ACTIVE : CHIP_INACTIVE}`;
}

export const NEWS_FEED_CLASSES = 'news-feed flex flex-col gap-2';

// .news-card's own 14px padding matches .card's unlayered 14px exactly --
// omitted here, .card's padding passes through unchanged.
export const NEWS_CARD_CLASSES = 'news-card flex items-start gap-[10px] cursor-pointer [transition:background_0.12s] relative hover:bg-[var(--bg2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--red-bright)]';
export const NEWS_CARD_IMG_CLASSES = 'flex-shrink-0 w-20 h-[60px] rounded-[6px] overflow-hidden bg-[var(--bg3)] [&>img]:w-full [&>img]:h-full [&>img]:object-cover';
export const NEWS_CARD_BODY_CLASSES = 'flex-1 min-w-0';
export const NEWS_CARD_META_CLASSES = 'flex items-center gap-[6px] mb-[5px]';
export const NEWS_SOURCE_BADGE_CLASSES = 'news-source-badge text-[9px] font-bold uppercase tracking-[0.05em] py-[2px] px-[6px] rounded-[4px] flex-shrink-0';
export const NEWS_CARD_TIME_CLASSES = 'news-card-time text-[10px] text-[color:var(--text-dim)]';
// Text styling only -- kept separate from the -webkit-box clamp below
// because MilestoneCard's title needs a DIFFERENT display value (see that
// constant's comment).
const NEWS_CARD_TITLE_TEXT_CLASSES = 'news-card-title text-[13px] font-semibold text-[color:var(--text)] leading-[1.4] m-0 mb-1';
export const NEWS_CARD_TITLE_CLASSES = `${NEWS_CARD_TITLE_TEXT_CLASSES} [display:-webkit-box] [-webkit-line-clamp:3] [-webkit-box-orient:vertical] overflow-hidden`;
export const NEWS_CARD_EXCERPT_CLASSES = 'text-[11px] text-[color:var(--text-muted)] leading-[1.5] m-0 [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden';
export const NEWS_CARD_ARROW_CLASSES = 'text-[14px] text-[color:var(--text-dim)] flex-shrink-0 self-center';

export const NEWS_LOADING_CLASSES = 'news-loading flex flex-col gap-2';
// .news-skeleton's own 14px padding matches .card's unlayered 14px exactly --
// omitted here, same reasoning as .news-card above.
export const NEWS_SKELETON_CLASSES = 'news-skeleton flex flex-col gap-2';
// news-skel-shimmer, not shimmer -- index.css already has an unrelated
// @keyframes shimmer (background-position slide, used by .skeleton);
// NewsView.css's own shimmer was a same-named but different (opacity-based)
// animation, which would silently collide if hoisted under the existing name.
const SKEL_BASE = 'skel bg-[var(--bg3)] rounded-[4px] animate-[news-skel-shimmer_1.4s_ease-in-out_infinite]';
export const SKEL_BADGE_CLASSES = `${SKEL_BASE} w-[60px] h-4`;
export const SKEL_TITLE_CLASSES = `${SKEL_BASE} w-[90%] h-[14px]`;
export const SKEL_TEXT_CLASSES = `${SKEL_BASE} w-[70%] h-[11px]`;

// text-align/flex layout only -- padding (32px 20px, differs from .card's
// 14px) lives in index.css as real unlayered CSS, see that file's comment.
export const NEWS_ERROR_CLASSES = 'news-error text-center flex flex-col items-center gap-[10px] text-[color:var(--text-muted)] text-[13px]';
export const NEWS_EMPTY_CLASSES = 'news-empty text-center flex flex-col items-center gap-[10px] text-[color:var(--text-muted)] text-[13px]';
export const NEWS_ERROR_ICON_CLASSES = 'news-error-icon text-[32px]';
export const NEWS_ERROR_MSG_CLASSES = 'news-error-msg text-[12px]';

export const NEWS_FOOTER_CLASSES = 'text-center text-[10px] text-[color:var(--text-dim)] pt-4 px-2 leading-[1.5]';

export const NEWS_PAGINATION_CLASSES = 'flex items-center justify-center gap-4 py-4 pb-2';
export const NEWS_PAGE_BTN_CLASSES = 'news-page-btn bg-[var(--bg2)] border-[0.5px] border-[var(--border)] text-[color:var(--text-muted)] text-[13px] font-semibold py-2 px-[18px] rounded-[8px] cursor-pointer [transition:background_0.12s] enabled:hover:bg-[var(--bg3)] enabled:hover:text-[color:var(--text)] disabled:opacity-30 disabled:cursor-default';
export const NEWS_PAGE_INFO_CLASSES = 'text-[12px] text-[color:var(--text-dim)]';

export const NEWS_VIEW_TOGGLE_CLASSES = 'flex gap-[6px] mb-[10px]';
const TOGGLE_BTN_BASE = 'news-view-toggle-btn text-[12px] py-[6px] px-[14px] rounded-[20px] font-medium cursor-pointer [transition:all_0.12s]';
const TOGGLE_BTN_INACTIVE = 'bg-[var(--bg3)] border-[0.5px] border-[var(--border)] text-[color:var(--text-muted)] hover:bg-[var(--bg4)] hover:text-[color:var(--text)]';
const TOGGLE_BTN_ACTIVE = 'active bg-[rgba(204,34,0,0.2)] border-[0.5px] border-[rgba(204,34,0,0.4)] text-[color:var(--red-bright)] font-bold';
export function newsViewToggleBtnClasses(active) {
  return `${TOGGLE_BTN_BASE} ${active ? TOGGLE_BTN_ACTIVE : TOGGLE_BTN_INACTIVE}`;
}
export const NEWS_VIEW_TOGGLE_DOT_CLASSES = 'news-view-toggle-dot inline-block w-[6px] h-[6px] ml-[5px] rounded-full bg-[var(--red-bright)] align-middle';

export const MILESTONES_FEED_CLASSES = 'milestones-feed flex flex-col';
export const MILESTONE_ICON_BADGE_CLASSES = 'milestone-icon-badge text-[9px] font-bold uppercase tracking-[0.05em] py-[2px] px-[6px] rounded-[4px] flex-shrink-0 inline-flex items-center gap-1 bg-[var(--bg3)] text-[color:var(--text-muted)]';
// .news-card-title's own `display: -webkit-box` (for the 3-line clamp) and
// .milestone-card-title's `display: flex` collide in the ORIGINAL CSS too --
// both are real classes on the same <h3>, and .milestone-card-title (defined
// later in NewsView.css) wins there, meaning milestone titles never actually
// get clamped/truncated today. Replicated deterministically here: this
// constant is combined with NEWS_CARD_TITLE_TEXT_CLASSES (styling only, no
// display/clamp), not the full NEWS_CARD_TITLE_CLASSES -- see
// MilestonesFeed.jsx's usage -- rather than concatenating two Tailwind
// utilities that both set `display` and relying on generation-order luck
// (lesson #9).
export const MILESTONE_CARD_TITLE_CLASSES = `${NEWS_CARD_TITLE_TEXT_CLASSES} milestone-card-title flex items-center gap-2`;
export const MILESTONE_DETAIL_ROW_CLASSES = 'text-[11px] text-[color:var(--text-dim)] mt-1 flex flex-wrap gap-x-[10px] gap-y-1';
// ::before pseudo-element separator dot -- first item skips it (Tailwind
// arbitrary variant targets :first-child directly, no JS branching needed).
export const MILESTONE_DETAIL_ITEM_CLASSES = "before:content-['·'] before:mr-[10px] before:text-[color:var(--border)] first:before:content-none first:before:mr-0";

export const MS_TEAM_SELECT_WRAP_CLASSES = 'relative';
const MS_BTN_BASE = 'ms-team-select-btn flex items-center gap-[6px] text-[11px] font-medium py-1 px-[10px] rounded-[20px] cursor-pointer [transition:all_0.12s]';
const MS_BTN_INACTIVE = 'bg-[var(--bg3)] border-[0.5px] border-[var(--border)] text-[color:var(--text-muted)] hover:bg-[var(--bg4)] hover:text-[color:var(--text)]';
const MS_BTN_ACTIVE = 'active bg-[rgba(204,34,0,0.2)] border-[0.5px] border-[rgba(204,34,0,0.4)] text-[color:var(--red-bright)] font-bold';
export function msTeamSelectBtnClasses(active) {
  return `${MS_BTN_BASE} ${active ? MS_BTN_ACTIVE : MS_BTN_INACTIVE}`;
}
export const MS_TEAM_MENU_CLASSES = 'ms-team-menu absolute top-[calc(100%+6px)] right-0 z-20 bg-[var(--bg2)] border-[0.5px] border-[var(--border)] rounded-[10px] p-[6px] w-[200px] max-h-[320px] overflow-y-auto shadow-[0_8px_24px_rgba(0,0,0,0.35)]';
const MS_OPTION_BASE = 'ms-team-option flex items-center gap-2 w-full border-0 text-left text-[color:var(--text)] text-[12px] font-medium py-[7px] px-2 rounded-[6px] cursor-pointer';
const MS_OPTION_INACTIVE = 'bg-transparent hover:bg-[var(--bg3)]';
const MS_OPTION_ACTIVE = 'active bg-[rgba(204,34,0,0.15)] text-[color:var(--red-bright)] font-bold';
export function msTeamOptionClasses(active) {
  return `${MS_OPTION_BASE} ${active ? MS_OPTION_ACTIVE : MS_OPTION_INACTIVE}`;
}
