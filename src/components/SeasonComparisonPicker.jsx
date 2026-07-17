import { useFetch } from '../hooks/useFetch';
import { fetchComparisonSeasons } from '../utils/seasonClient';
import { normalizeComparisonSeasons } from '../utils/seasonComparison';
import './SeasonComparisonPicker.css';

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
      <div className="season-picker season-picker-loading" role="status" aria-label="Loading seasons">
        <div className="season-picker-skeleton" />
        <div className="season-picker-skeleton" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="season-picker season-picker-error">
        <span>Couldn't load seasons.</span>
        <button className="season-picker-retry" onClick={refetch}>Retry</button>
      </div>
    );
  }

  if (seasons.length === 0) {
    return <div className="season-picker season-picker-empty">No seasons available to compare yet.</div>;
  }

  return (
    <div className="season-picker" role="group" aria-label="Select seasons to compare">
      {seasons.map(s => {
        const isSelected = selected.includes(s.value);
        const atCap = maxSelected != null && selected.length >= maxSelected && !isSelected;
        return (
          <button
            key={s.value}
            type="button"
            className={
              'season-chip' +
              (isSelected ? ' season-chip-selected' : '') +
              (!s.comparable ? ' season-chip-partial' : '') +
              (atCap ? ' season-chip-disabled' : '')
            }
            aria-pressed={isSelected}
            disabled={atCap}
            onClick={() => toggle(s.value)}
            title={s.comparable ? undefined : `Only ${s.teamCount} team${s.teamCount === 1 ? '' : 's'} have data for this season so far`}
          >
            {s.label}
            {!s.comparable && <span className="season-chip-badge">Partial</span>}
          </button>
        );
      })}
    </div>
  );
}
