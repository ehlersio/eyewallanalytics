import { useFetch } from '../hooks/useFetch';
import { fetchComparisonSeasons } from '../utils/seasonClient';
import { normalizeComparisonSeasons } from '../utils/seasonComparison';

// Tailwind migration (Session 95, Phase 1) -- previously the
// .season-picker*/.season-chip* rules in SeasonComparisonPicker.css (that
// file also carries TeamComparisonPopup's .h2h-*/.compare-mode-*/.cvt-*
// rules, a later-phase file's styles that only ended up in this file
// because TeamComparisonPopup renders this component as a child and never
// imports its own CSS for them -- those rules are left untouched).
//
// Chip color/background/border precedence (partial > selected > base) is
// resolved explicitly in JS below rather than by stacking multiple
// Tailwind utility classes for the same property and hoping generated
// stylesheet order matches the original CSS's source-order tiebreak --
// selected+hover intentionally has no separate hover classes: its resting
// background (--red-dim) is identical to its original hover background,
// so there's nothing for hover to change.
//
// CHIP_BASE keeps the literal "season-chip" class name alongside the
// Tailwind utilities -- team.cy.js/pwhl-team.cy.js select on it directly.
// It carries no CSS of its own anymore; Tailwind owns the visuals, this is
// a pure test hook now.
const PICKER_CLASSES = 'flex flex-wrap gap-2 ml-4';
const PICKER_LOADING_CLASSES = `${PICKER_CLASSES} items-center`;
const PICKER_MESSAGE_CLASSES = 'flex items-center gap-2.5 ml-4 text-[12px] text-[color:var(--text-dim)]';
const SKELETON_CLASSES = 'w-[72px] h-[30px] rounded-[var(--radius-sm)] bg-[var(--bg2)] animate-[seasonPickerPulse_1.2s_ease-in-out_infinite]';
const RETRY_CLASSES = 'bg-transparent border-[0.5px] border-[var(--border-2)] rounded-[var(--radius-sm)] text-[color:var(--text-muted)] text-[11px] py-1 px-2.5 cursor-pointer hover:text-[color:var(--text)] hover:bg-[var(--bg3)]';
const CHIP_BASE = 'season-chip relative inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] py-[5px] px-[9px] font-[family-name:var(--font-body)] text-[12px] font-semibold cursor-pointer [transition:background_0.15s,border-color_0.15s,color_0.15s] disabled:opacity-40 disabled:cursor-not-allowed';
const CHIP_BADGE_CLASSES = 'text-[9px] font-bold uppercase tracking-[0.04em] text-[color:var(--amber)] bg-[rgba(240,160,48,0.14)] rounded-[4px] py-0.5 px-[5px]';

// Generic N-season selector (Session 64) — one component for both leagues,
// not a PWHL-specific toggle. Renders correctly whether the league has 2
// comparable seasons (PWHL today) or 4+ (NHL today, growing every year).
// Consumers (player-level, team-level comparison) own what to DO with the
// selection; this component only owns picking it.
//
// `comparable: false` seasons (per /config/seasons/comparison) stay
// selectable — they're not hidden or blocked — but get a distinct "Partial
// data" badge and muted styling so a user isn't comparing against a
// half-filled season with no explanation (per SESSION_64_BUILD's explicit
// requirement).
export default function SeasonComparisonPicker({
  league,               // 'nhl' | 'pwhl'
  selected,             // array of season values currently selected
  onChange,             // (nextSelectedArray) => void
  maxSelected = null,   // null = unlimited
  filterSeasons = null, // optional (normalizedSeason) => boolean, applied before rendering
}) {
  const { data, loading, error, refetch } = useFetch(fetchComparisonSeasons, []);

  const rawSeasons = data?.[league]?.seasons ?? [];
  let seasons = normalizeComparisonSeasons(league, rawSeasons);
  if (filterSeasons) seasons = seasons.filter(filterSeasons);

  function toggle(value) {
    const isSelected = selected.includes(value);
    if (isSelected) {
      onChange(selected.filter(v => v !== value));
      return;
    }
    if (maxSelected != null && selected.length >= maxSelected) return; // at cap, ignore
    onChange([...selected, value]);
  }

  if (loading) {
    return (
      <div className={PICKER_LOADING_CLASSES} role="status" aria-label="Loading seasons">
        <div className={SKELETON_CLASSES} />
        <div className={SKELETON_CLASSES} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={PICKER_MESSAGE_CLASSES}>
        <span>Couldn't load seasons.</span>
        <button className={RETRY_CLASSES} onClick={refetch}>Retry</button>
      </div>
    );
  }

  if (seasons.length === 0) {
    return <div className={PICKER_MESSAGE_CLASSES}>No seasons available to compare yet.</div>;
  }

  return (
    <div className={PICKER_CLASSES} role="group" aria-label="Select seasons to compare">
      {seasons.map(s => {
        const isSelected = selected.includes(s.value);
        const atCap = maxSelected != null && selected.length >= maxSelected && !isSelected;
        // Precedence matches the original CSS's source order when multiple
        // states combine: partial's dimmed text wins over selected's,
        // background/border only ever come from selected (partial never
        // touched them).
        const textClass = !s.comparable
          ? 'text-[color:var(--text-dim)]'
          : isSelected
          ? 'text-[color:var(--text)]'
          : 'text-[color:var(--text-muted)]';
        const bgBorderClass = isSelected
          ? 'bg-[var(--red-dim)] border-[0.5px] border-[var(--red-border)]'
          : 'bg-[var(--bg2)] border-[0.5px] border-[var(--border-2)]';
        // Selected's resting background already equals its old hover
        // background, so hover only needs its own classes when unselected.
        const hoverClass = isSelected ? '' : 'enabled:hover:bg-[var(--bg3)] enabled:hover:text-[color:var(--text)]';
        return (
          <button
            key={s.value}
            type="button"
            className={`${CHIP_BASE} ${textClass} ${bgBorderClass} ${hoverClass}`}
            aria-pressed={isSelected}
            disabled={atCap}
            onClick={() => toggle(s.value)}
            title={s.comparable ? undefined : `Only ${s.teamCount} team${s.teamCount === 1 ? '' : 's'} have data for this season so far`}
          >
            {s.label}
            {!s.comparable && <span className={CHIP_BADGE_CLASSES}>Partial</span>}
          </button>
        );
      })}
    </div>
  );
}
