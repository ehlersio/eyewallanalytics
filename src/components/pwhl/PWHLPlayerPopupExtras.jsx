// components/pwhl/PWHLPlayerPopupExtras.jsx
// The PWHL-only parts of the player popup, plugged into the shared
// HockeyTechPlayerPopup through the PWHL league object's `playerPopup`
// options (see PWHLPlayerPopup.jsx): the percentile radar header panels,
// the goalie heat map, and the Scout tab. Moved verbatim from
// PWHLPlayerPopup.jsx; AHL and ECHL have no percentile pipeline, no goalie
// ids on goal events and no scouting route, so they render none of these.
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { shotArea } from 'react-hockey-rink';
import { useFetch } from '../../hooks/useFetch';
import { fetchPWHLGoalieShots, fetchPWHLLeagueGoalieShots } from '../../utils/pwhlApi';
import { computeRadarAxes, computeGoalieRadarAxes, RADAR_AXIS_ABBR, posLabel } from '../../utils/pwhlPlayerStats';
import { pwhlAreaRows, hasAreaData } from '../../utils/goalieAreas';
import GoalieAreaMap, { GoalieDotMap } from '../GoalieAreaMap';
import { SKELETON_CLASSES } from '../../utils/skeletonClasses';
import {
  PP_HEATMAP_CLASSES, PP_HEATMAP_EMPTY_CLASSES, PP_HEATMAP_ICON_CLASSES, PP_HEATMAP_SUB_CLASSES,
  PP_HEATMAP_SUMMARY_CLASSES, PP_HEATMAP_STAT_CLASSES, PP_HEATMAP_NUM_BASE_CLASSES,
  PP_HEATMAP_NUM_DEFAULT_CLASSES, PP_HEATMAP_NUM_GOAL_CLASSES, PP_HEATMAP_NUM_SOG_CLASSES,
  PP_HEATMAP_FILTERS_CLASSES, PP_HEATMAP_RINK_CLASSES, heatmapChipClasses,
} from '../HockeyTechPlayerPopup';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';

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

const SCOUT_WRAP_CLASSES = 'p-4'
const SCOUT_HEADER_CLASSES = 'flex items-center justify-between mb-3'
const SCOUT_LABEL_CLASSES = 'text-[10px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-dim)] font-[family-name:var(--font-display)]'
const SCOUT_SEASON_CLASSES = 'text-[10px] font-bold py-[2px] px-[7px] rounded-[10px] bg-[var(--red-dim)] text-[color:var(--red-bright)] border-[0.5px] border-[var(--red-border)] uppercase tracking-[0.06em] font-[family-name:var(--font-display)]'
const SCOUT_BLURB_CLASSES = 'text-[14px] leading-[1.65] text-[color:var(--text)] bg-[var(--bg2)] rounded-[10px] py-[14px] px-4 border-[0.5px] border-[var(--border)] whitespace-pre-wrap'
const SCOUT_FOOTER_CLASSES = 'text-[10px] text-[color:var(--text-dim)] mt-[10px] text-center'
const SCOUT_LOADING_CLASSES = 'flex flex-col gap-1 py-1'
const SCOUT_EMPTY_CLASSES = 'py-8 px-4 text-center text-[color:var(--text-muted)] text-[13px] flex flex-col items-center gap-2'
const SCOUT_EMPTY_ICON_CLASSES = 'text-[28px]'

// Displays a value as-is, no rounding. Matches NHL PlayerPopup's
// QuickStatPill exactly.
function PWHLQuickStatPill({ label, value }) {
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
function PWHLRadarAxisTick({ x, y, payload, textAnchor }) {
  const full = payload.value;
  const short = RADAR_AXIS_ABBR[full] || full;
  return (
    <text x={x} y={y} textAnchor={textAnchor} fill="var(--text-dim)" fontSize={8.5}>
      {short}
      <title>{full}</title>
    </text>
  );
}

function PWHLRadarChart({ data, color }) {
  const { t } = useTranslation();
  const missing = data.filter(d => !d.hasData).map(d => d.axis);
  return (
    <div className={PP_RADAR_WRAP_CLASSES}>
      <ResponsiveContainer width="100%" height={150}>
        <RadarChart data={data} outerRadius="62%">
          <PolarGrid stroke="var(--border-2)" />
          <PolarAngleAxis dataKey="axis" tick={PWHLRadarAxisTick} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} tickCount={2} />
          <Radar dataKey="value" stroke={color} fill={color} fillOpacity={0.35} strokeWidth={2} isAnimationActive={false} />
        </RadarChart>
      </ResponsiveContainer>
      {missing.length > 0 && (
        <div className={PP_RADAR_NOTE_CLASSES}>{t('playerPopup.radar.notEnoughData', { missing: missing.join(', ') })}</div>
      )}
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
export function PWHLHeaderPanel({ percentiles, boxStats, teamColor, comparisonEntry }) {
  if (!percentiles) return null;
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
      <PWHLRadarChart data={radarData} color={teamColor} />
      <div className={PP_QUICKSTATS_COL_CLASSES}>
        <div className={PP_QUICKSTATS_CLASSES}>
          <PWHLQuickStatPill label="G"   value={boxStats?.goals} />
          <PWHLQuickStatPill label="A"   value={boxStats?.assists} />
          <PWHLQuickStatPill label="P"   value={boxStats?.points} />
          <PWHLQuickStatPill label="TOI" value={fmtToi(boxStats?.toi_per_game)} />
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
export function PWHLGoalieHeaderPanel({ percentiles, boxStats, teamColor, comparisonEntry }) {
  if (!percentiles) return null;
  const radarData = computeGoalieRadarAxes(percentiles);
  const fmtSvPct = (raw) => raw == null ? null : Number(raw).toFixed(3).replace(/^0\./, '.');
  const fmtGaa = (raw) => raw == null ? null : Number(raw).toFixed(2);
  return (
    <div className={PP_HEADER_RADAR_CLASSES}>
      <PWHLRadarChart data={radarData} color={teamColor} />
      <div className={PP_QUICKSTATS_COL_CLASSES}>
        <div className={PP_QUICKSTATS_CLASSES}>
          <PWHLQuickStatPill label="W"   value={boxStats?.wins} />
          <PWHLQuickStatPill label="SV%" value={fmtSvPct(boxStats?.sv_pct)} />
          <PWHLQuickStatPill label="GAA" value={fmtGaa(boxStats?.gaa)} />
          <PWHLQuickStatPill label="SO"  value={boxStats?.shutouts} />
        </div>
        {comparisonEntry}
      </div>
    </div>
  );
}

// ── Heat Map ──────────────────────────────────────────────────

// The goalie heat map: shots faced as dots, or save % in each of the NHL's
// 17 shot areas (GoalieAreaMap) colored against the PWHL's own save % in that
// area -- from every shot on goal any PWHL goalie faced that season
// (/pwhl/league-goalie-shots), classified with the same react-hockey-rink
// shotArea the NHL popup uses. Zone SV% is offered only once an area has
// enough shots. Replaced a hand-drawn 7-zone grid whose zones overlapped
// (a shot could count in two) (2026-10).
function PWHLGoalieHeatMap({ goalieShotData, season }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('all');
  const [mapMode, setMapMode] = useState('dots');
  const { data: leagueShots } = useFetch(
    () => (season && goalieShotData?.shots?.length) ? fetchPWHLLeagueGoalieShots(season).catch(() => null) : Promise.resolve(null),
    [season, !!goalieShotData?.shots?.length]
  );
  const shots = goalieShotData?.shots || [];
  const areaRows = useMemo(
    () => pwhlAreaRows(shots.map(s => [s.x, s.y, s.t === 'g' ? 1 : 0]), leagueShots?.shots, shotArea),
    [shots, leagueShots]
  );

  if (!shots.length) {
    return (
      <div className={PP_HEATMAP_EMPTY_CLASSES}>
        <div className={PP_HEATMAP_ICON_CLASSES}>🥅</div>
        <div>{t('playerPopup.heatMap.goalie.empty')}</div>
        <div className={PP_HEATMAP_SUB_CLASSES}>{t('playerPopup.heatMap.goalie.emptySub')}</div>
      </div>
    );
  }

  const goals = shots.filter(s => s.t === 'g').length;
  const saves = shots.filter(s => s.t === 's').length;
  const total = goals + saves;
  const svPct = total > 0 ? (saves / total).toFixed(3) : '—';
  const showZones = hasAreaData(areaRows);
  const mode = showZones ? mapMode : 'dots';

  const dotFiltered = filter === 'goals' ? shots.filter(s => s.t === 'g')
    : filter === 'saves' ? shots.filter(s => s.t === 's')
    : shots.filter(s => s.t === 'g' || s.t === 's');

  return (
    <div className={PP_HEATMAP_CLASSES}>
      <div className={PP_HEATMAP_SUMMARY_CLASSES}>
        <div className={PP_HEATMAP_STAT_CLASSES}><span className={`${PP_HEATMAP_NUM_BASE_CLASSES} ${PP_HEATMAP_NUM_GOAL_CLASSES}`}>{goals}</span><span>{t('gameStatsPopup.sections.goals')}</span></div>
        <div className={PP_HEATMAP_STAT_CLASSES}><span className={`${PP_HEATMAP_NUM_BASE_CLASSES} ${PP_HEATMAP_NUM_SOG_CLASSES}`}>{saves}</span><span>{t('playerPopup.heatMap.goalie.saves')}</span></div>
        <div className={PP_HEATMAP_STAT_CLASSES}><span className={`${PP_HEATMAP_NUM_BASE_CLASSES} ${PP_HEATMAP_NUM_DEFAULT_CLASSES}`}>{total}</span><span>{t('playerPopup.heatMap.goalie.shotsFaced')}</span></div>
        <div className={PP_HEATMAP_STAT_CLASSES}><span className={`${PP_HEATMAP_NUM_BASE_CLASSES} ${PP_HEATMAP_NUM_DEFAULT_CLASSES}`}>{svPct}</span><span>SV%</span></div>
      </div>
      {showZones && (
        <div className={PP_HEATMAP_FILTERS_CLASSES} style={{ marginBottom: 6 }}>
          <button className={heatmapChipClasses(mode === 'dots')} onClick={() => setMapMode('dots')}>{t('playerPopup.heatMap.goalie.dotMapToggle')}</button>
          <button className={heatmapChipClasses(mode === 'zones')} onClick={() => setMapMode('zones')}>{t('playerPopup.heatMap.goalie.zoneToggle')}</button>
        </div>
      )}
      {mode === 'dots' && (
        <div className={PP_HEATMAP_FILTERS_CLASSES}>
          {[
            { key: 'all', label: t('playerPopup.heatMap.goalie.filterAll', { count: total }) },
            { key: 'goals', label: t('playerPopup.heatMap.goalie.filterGoals', { count: goals }) },
            { key: 'saves', label: t('playerPopup.heatMap.goalie.filterSaves', { count: saves }) },
          ].map(f => (
            <button key={f.key} className={heatmapChipClasses(filter === f.key)}
              onClick={() => setFilter(f.key)}>{f.label}</button>
          ))}
        </div>
      )}
      <div className={PP_HEATMAP_RINK_CLASSES}>
        {mode === 'zones' ? (
          <GoalieAreaMap rows={areaRows} mode="pwhl" />
        ) : (
          <GoalieDotMap shots={dotFiltered} caption={t('playerPopup.heatMap.goalie.dotCaption')} ariaLabel={t('playerPopup.heatMap.goalie.dotMapToggle')} />
        )}
      </div>
    </div>
  );
}


// Picks the skater or goalie radar panel (playerPopup.HeaderPanel).
export function PWHLPopupHeaderPanel({ isGoalie, ...props }) {
  return isGoalie ? <PWHLGoalieHeaderPanel {...props} /> : <PWHLHeaderPanel {...props} />;
}

// Goalie decision letter, derived from PWHL's own win/loss/ot_loss/
// shootout_loss flags -- unlike AHL/ECHL's game logs, PWHL's gameByGame
// rows carry OT and shootout losses separately.
export function pwhlGoalieDecision(g) {
  if (g.win) return 'W'
  if (g.loss) return 'L'
  if (g.ot_loss) return 'OTL'
  if (g.shootout_loss) return 'SOL'
  return null
}

// Goalie Heat Map tab: fetches this goalie's shots faced, then the map.
export function PWHLGoalieHeatMapTab({ playerId, season }) {
  const { t } = useTranslation();
  const { data: goalieShotData, loading: goalieLoading } = useFetch(
    () => playerId ? fetchPWHLGoalieShots(playerId, season) : Promise.resolve(null),
    [playerId, season, true]
  );
  if (goalieLoading) {
    return (
      <div className={PP_HEATMAP_EMPTY_CLASSES}>
        <div className={PP_HEATMAP_ICON_CLASSES}>🥅</div>
        <div>{t('playerPopup.heatMap.loading')}</div>
      </div>
    );
  }
  return <PWHLGoalieHeatMap goalieShotData={goalieShotData} season={season} />;
}


// ── Scouting blurb ────────────────────────────────────────────

export function PWHLScout({ player, isGoalie, seasonLabel }) {
  const { t } = useTranslation();
  const [blurb, setBlurb] = useState(undefined); // undefined=loading, null=failed, string=ready
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const name   = player.player_name || `${player.first_name || ''} ${player.last_name || ''}`.trim();
  const pos    = posLabel(player.position);

  async function generate() {
    setLoading(true);
    setGenerated(true);
    try {
      const res = await fetch(`${WORKER_URL}/pwhl/scout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          position: pos,
          isGoalie,
          seasonLabel,
          stats: player,
        }),
      });
      const data = await res.json();
      setBlurb(data.blurb || null);
    } catch {
      setBlurb(null);
    }
    setLoading(false);
  }

  if (!generated) {
    return (
      <div className={SCOUT_WRAP_CLASSES}>
        <div className={SCOUT_EMPTY_CLASSES}>
          <div className={SCOUT_EMPTY_ICON_CLASSES}>📋</div>
          <div style={{ marginBottom: 12 }}>{t('playerPopup.pwhlScout.generatePrompt', { name })}</div>
          <button
            onClick={generate}
            style={{
              padding: '8px 20px', background: 'var(--team-primary)',
              color: '#fff', border: 'none', borderRadius: 8,
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>
            {t('playerPopup.pwhlScout.generateButton')}
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={SCOUT_WRAP_CLASSES}>
        <div className={SCOUT_LOADING_CLASSES}>
          {[95, 88, 72, 90, 65].map((w, i) => (
            <div key={i} className={SKELETON_CLASSES} style={{ height: 11, width: `${w}%`, marginBottom: 10, borderRadius: 4 }} />
          ))}
        </div>
      </div>
    );
  }

  if (!blurb) {
    return (
      <div className={SCOUT_WRAP_CLASSES}>
        <div className={SCOUT_EMPTY_CLASSES}>
          <div className={SCOUT_EMPTY_ICON_CLASSES}>📋</div>
          <div>{t('playerPopup.pwhlScout.failedState')}</div>
          <button onClick={() => { setGenerated(false); }} style={{ marginTop: 8, padding: '6px 16px', cursor: 'pointer' }}>{t('playerPopup.pwhlScout.retryButton')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className={SCOUT_WRAP_CLASSES}>
      <div className={SCOUT_HEADER_CLASSES}>
        <span className={SCOUT_LABEL_CLASSES}>{t('playerPopup.scoutingBlurb.header')}</span>
        <span className={SCOUT_SEASON_CLASSES}>{seasonLabel}</span>
      </div>
      <div className={SCOUT_BLURB_CLASSES}>{blurb}</div>
      <div className={SCOUT_FOOTER_CLASSES}>{t('playerPopup.pwhlScout.footer')}</div>
    </div>
  );
}
