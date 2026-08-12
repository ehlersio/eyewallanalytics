// src/utils/skeletonClasses.js
// Shared Tailwind class constant for index.css's .skeleton (Phase 7b) --
// the shimmer-loading placeholder used across 14 real consumers (confirmed
// via literal-string grep, interpolation-pattern grep, cross-CSS-file grep,
// and Cypress spec grep -- the only Cypress hits are .lv-skeleton-wrap and
// .player-card-skeleton, unrelated already-migrated classes, not this one).
//
// Every real consumer pairs className="skeleton" with an inline `style`
// prop for sizing (height/width/margin) and, in several call sites, its own
// borderRadius override -- inline styles always win over class-based CSS
// regardless of cascade layer, so migrating .skeleton's own border-radius
// to a Tailwind utility carries none of the collision risk documented
// elsewhere in this file (e.g. .card's unlayered padding) -- there's no
// competing class-based rule to lose to, only inline style overrides that
// already won before this change and still do.
//
// border-radius uses the app's own --radius-sm token (not a named Tailwind
// radius utility -- see tailwind.css's header comment on why those are
// avoided app-wide). @keyframes shimmer stays in index.css as permanent
// infrastructure (referenced here via an `animate-[shimmer_...]` arbitrary
// value) -- it has exactly one consumer, this class.
export const SKELETON_CLASSES = 'bg-[linear-gradient(90deg,var(--bg2)_25%,var(--bg3)_50%,var(--bg2)_75%)] [background-size:400px_100%] animate-[shimmer_1.4s_infinite] rounded-[var(--radius-sm)]';
