// components/PercentileHeaderPanel.jsx
// The player popup's percentile radar header (radar + quick stats), for
// every league HockeyTechPlayerPopup serves that has percentiles: the PWHL
// (per-60 rates) and, from the C4 routes, AHL/ECHL (per game played --
// `rateBasis: 'perGP'`: the radar says so, a goalie's GSAX axis reads
// GSAX/GP, and the TOI pill, which those box scores lack, is GP).
// Moved out of pwhl/PWHLPlayerPopupExtras.jsx so the AHL/ECHL league
// objects can use it without importing the popup.
import { useTranslation } from 'react-i18next';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { computeRadarAxes, computeGoalieRadarAxes, RADAR_AXIS_ABBR } from '../utils/pwhlPlayerStats';

const PP_QUICKSTAT_CLASSES = 'flex flex-col items-center bg-[var(--bg2)] rounded-md py-1 px-[2px] min-w-0'
const PP_QUICKSTAT_VAL_CLASSES = 'font-[family-name:var(--font-display)] text-[13px] font-bold text-[color:var(--text)] leading-[1.1]'
const PP_QUICKSTAT_LABEL_CLASSES = 'text-[8px] text-[color:var(--text-dim)] uppercase tracking-[0.06em]'
const PP_HEADER_RADAR_CLASSES = 'flex items-center gap-2 flex-[1_1_auto] min-w-0 max-[340px]:flex-col'
// Radar chart classes (added 2026-08, matching NHL PlayerPopup's own
// pp-radar-wrap/-note classes) -- shared by both PWHLHeaderPanel (skaters,
// 4-axis) and PWHLGoalieHeaderPanel (goalies, 6-axis); both render a real
// PWHLRadarChart now, not a tile grid.
const PP_RADAR_WRAP_CLASSES = 'pp-radar-wrap flex-[1_1_0%] min-w-[50px] max-w-[130px] max-[340px]:max-w-full'
const PP_RADAR_NOTE_CLASSES = 'text-[9px] text-[color:var(--text-dim)] text-center leading-[1.4] px-1 mt-[-6px]'
const PP_QUICKSTATS_COL_CLASSES = 'pp-quickstats-col flex flex-col gap-1 flex-none'
const PP_QUICKSTATS_CLASSES = 'grid [grid-template-columns:38px_38px] gap-1 max-[340px]:w-full'

// Displays a value as-is, no rounding. Matches NHL PlayerPopup's
// QuickStatPill exactly.
function QuickStatPill({ label, value }) {
  return (
    <div className={PP_QUICKSTAT_CLASSES}>
      <span className={PP_QUICKSTAT_VAL_CLASSES}>{value ?? '—'}</span>
      <span className={PP_QUICKSTAT_LABEL_CLASSES}>{label}</span>
    </div>
  );
}


// codebase's established convention for popup-owned UI helpers is
// duplicate-per-file rather than cross-import. Abbreviates axis labels for the same reason NHL's does: this
// radar renders inside a ~130px-wide flex slot, nowhere near enough room
// for two-word labels like "5v5 SV%" at any legible size -- full names
// are still available via the native SVG <title> on hover/tap.
//
// Shared between skaters and goalies (added 2026-08) -- nothing here is
// goalie-specific despite the name it originally shipped under; only the
// axis DATA differs (computeRadarAxes' 4 skater categories vs
// computeGoalieRadarAxes' 6 goalie ones), both already keyed into the same
// RADAR_AXIS_ABBR map.
function RadarAxisTick({ x, y, payload, textAnchor }) {
  const full = payload.value;
  const short = RADAR_AXIS_ABBR[full] || full;
  return (
    <text x={x} y={y} textAnchor={textAnchor} fill="var(--text-dim)" fontSize={8.5}>
      {short}
      <title>{full}</title>
    </text>
  );
}

function PercentileRadarChart({ data, color, perGame }) {
  const { t } = useTranslation();
  const missing = data.filter(d => !d.hasData).map(d => d.axis);
  return (
    <div className={PP_RADAR_WRAP_CLASSES}>
      <ResponsiveContainer width="100%" height={150}>
        <RadarChart data={data} outerRadius="62%">
          <PolarGrid stroke="var(--border-2)" />
          <PolarAngleAxis dataKey="axis" tick={RadarAxisTick} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} tickCount={2} />
          <Radar dataKey="value" stroke={color} fill={color} fillOpacity={0.35} strokeWidth={2} isAnimationActive={false} />
        </RadarChart>
      </ResponsiveContainer>
      {missing.length > 0 && (
        <div className={PP_RADAR_NOTE_CLASSES}>{t('playerPopup.radar.notEnoughData', { missing: missing.join(', ') })}</div>
      )}
      {perGame && <div className={PP_RADAR_NOTE_CLASSES}>{t('playerPopup.radar.perGameNote')}</div>}
    </div>
  );
}

// Header panel (Session 85, upgraded 2026-08) — PWHL's equivalent of NHL
// PlayerPopup's SkaterHeaderPanel. Originally substituted a 2x2
// percentile-tile grid for NHL's radar + G/A/P/TOI totals, on the
// reasoning that PWHL's 4 percentile categories weren't "radar-worthy."
// That reasoning didn't hold up once PWHL goalies shipped a real 6-axis
// radar from the exact same category *count* class (see
// PWHLGoalieHeaderPanel below) -- 4 categories is exactly what
// PlayerComparisonPopup.jsx's own PWHL skater radar has already been
// plotting since Session 91, just never in this single-player header.
// `boxStats` is the current-season raw stat object (same `p` shape
// pwhlGroupStats/SKATER_STATS already read) -- goals/assists/points/
// toi_per_game reused directly for the quickstat pills rather than
// re-fetching anything. toi_per_game comes back from the Worker as a
// string (Postgres bigint, PostgREST's string-serialization convention
// for those -- see pwhl_percentiles.py's own gotcha comment), in seconds;
// formatted to mm:ss matching NHL's own TOI/G convention exactly.
// `comparisonEntry` (the "vs Player" button, Session 91) stacks below the
// quickstats grid rather than sitting inline as a sibling of this panel --
// matching the fix applied to NHL's SkaterHeaderPanel after the inline
// placement was reported to squeeze that header row.
export function PWHLHeaderPanel({ percentiles, rateBasis, boxStats, teamColor, comparisonEntry }) {
  if (!percentiles) return null;
  const perGame = rateBasis === 'perGP';
  const radarData = computeRadarAxes(percentiles);
  const fmtToi = (raw) => {
    if (raw == null) return null;
    const secs = Number(raw);
    if (isNaN(secs)) return null;
    const m = Math.floor(secs / 60), s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };
  return (
    <div className={PP_HEADER_RADAR_CLASSES}>
      <PercentileRadarChart data={radarData} color={teamColor} perGame={perGame} />
      <div className={PP_QUICKSTATS_COL_CLASSES}>
        <div className={PP_QUICKSTATS_CLASSES}>
          <QuickStatPill label="G"   value={boxStats?.goals} />
          <QuickStatPill label="A"   value={boxStats?.assists} />
          <QuickStatPill label="P"   value={boxStats?.points} />
          {/* AHL/ECHL box scores have no TOI: games played instead. */}
          {perGame && boxStats?.toi_per_game == null
            ? <QuickStatPill label="GP" value={boxStats?.gp} />
            : <QuickStatPill label="TOI" value={fmtToi(boxStats?.toi_per_game)} />}
        </div>
        {comparisonEntry}
      </div>
    </div>
  );
}

// PWHL goalie header panel (added 2026-08) -- goalie-side counterpart to
// PWHLHeaderPanel above, same radar-chart treatment (6 genuinely
// radar-worthy categories, same richness as NHL's own goalie radar).
// `boxStats` is the current-season raw stat object (same `p` shape
// pwhlGroupStats/GOALIE_STATS already read) -- wins/sv_pct/gaa/shutouts
// reused directly for the quickstat pills rather than re-fetching
// anything. sv_pct formatting matches this file's own groupStats()
// convention (leading zero stripped, e.g. ".902" not "0.902"), not NHL's
// (which keeps the leading zero) -- these are two independently-evolved
// per-league formatting conventions, not a bug to unify here.
export function PWHLGoalieHeaderPanel({ percentiles, rateBasis, boxStats, teamColor, comparisonEntry }) {
  if (!percentiles) return null;
  const perGame = rateBasis === 'perGP';
  const radarData = computeGoalieRadarAxes(percentiles, { perGame });
  const fmtSvPct = (raw) => raw == null ? null : Number(raw).toFixed(3).replace(/^0\./, '.');
  const fmtGaa = (raw) => raw == null ? null : Number(raw).toFixed(2);
  return (
    <div className={PP_HEADER_RADAR_CLASSES}>
      <PercentileRadarChart data={radarData} color={teamColor} perGame={perGame} />
      <div className={PP_QUICKSTATS_COL_CLASSES}>
        <div className={PP_QUICKSTATS_CLASSES}>
          <QuickStatPill label="W"   value={boxStats?.wins} />
          <QuickStatPill label="SV%" value={fmtSvPct(boxStats?.sv_pct)} />
          <QuickStatPill label="GAA" value={fmtGaa(boxStats?.gaa)} />
          <QuickStatPill label="SO"  value={boxStats?.shutouts} />
        </div>
        {comparisonEntry}
      </div>
    </div>
  );
}

// Skater or goalie panel, by `isGoalie`.
export default function PercentileHeaderPanel({ isGoalie, ...props }) {
  return isGoalie ? <PWHLGoalieHeaderPanel {...props} /> : <PWHLHeaderPanel {...props} />;
}
