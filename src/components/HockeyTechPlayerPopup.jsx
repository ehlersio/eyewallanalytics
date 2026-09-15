// components/HockeyTechPlayerPopup.jsx
// Player detail popup shared by AHL and ECHL -- same HockeyTech feed, same
// data depth, same Worker routes (eyewall-poller's hockeytech.js), so the
// two popups used to be near-copies. AHLPlayerPopup.jsx/ECHLPlayerPopup.jsx
// now only pass their league config.
//
// Tabs: Stats, Heat Map, and Compare -- season-over-season, like PWHL's:
// one stat card per selected season plus a per-game trend chart built from
// /{league}/player-game-log. Deliberately absent, all real data walls
// rather than scope choices:
//   - Percentile radar header / percentile-highlighted tiles -- neither
//     league has a percentile pipeline.
//   - "vs Player" comparison entry (PlayerComparisonEntry) -- that
//     component hardcodes an nhl/pwhl branch throughout.
//   - Goalie heat map -- both leagues' PBP goal events carry
//     goalie_id: null, so a heat map would silently under-count goals.
//     Shown as an honest "not available" state instead.
//
// Props: league {object} (see AHLPlayerPopup.jsx for its shape);
// player {object} -- minimum shape { player_id }; season {number};
// seasonLabel {string}; onClose.
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetch } from '../hooks/useFetch';
import { fetchComparisonSeasons } from '../utils/seasonClient';
import { normalizeComparisonSeasons } from '../utils/seasonComparison';
import { perGameValue, seasonRampColor, CHART_DASH_PATTERNS } from '../utils/seasonChart';
import { formatDate } from '../utils/formatters';
import { SKELETON_CLASSES } from '../utils/skeletonClasses';
import { HockeyRink } from 'react-hockey-rink';
import { toHockeyRinkEvents } from '../utils/hockeyRinkEvents';
import { TileStatSection } from './StatTileGrid';
import SeasonComparisonPicker from './SeasonComparisonPicker';
import SeasonOverlayChart from './SeasonOverlayChart';
import InfoTip from './InfoTip';

// Reuses PlayerPopup.jsx/PWHLPlayerPopup.jsx's Tailwind class constants
// verbatim -- same popup-owned-helper convention (duplicate per file
// rather than cross-import between the NHL/PWHL/HockeyTech component trees).
const PP_HEATMAP_CLASSES = 'py-3 px-4'
const PP_HEATMAP_EMPTY_CLASSES = 'pp-heatmap-empty py-8 px-4 text-center text-[color:var(--text-muted)] text-[13px] flex flex-col items-center gap-2'
const PP_HEATMAP_ICON_CLASSES = 'text-[28px]'
const PP_HEATMAP_SUB_CLASSES = 'text-[11px] text-[color:var(--text-dim)]'
const PP_HEATMAP_SUMMARY_CLASSES = 'flex justify-around py-[8px_0_12px] border-b-[0.5px] border-[var(--border)] mb-[10px]'
const PP_HEATMAP_STAT_CLASSES = 'flex flex-col items-center gap-[2px] text-[10px] text-[color:var(--text-dim)]'
const PP_HEATMAP_NUM_BASE_CLASSES = 'text-[18px] font-bold font-[family-name:var(--font-mono)]'
const PP_HEATMAP_NUM_DEFAULT_CLASSES = 'text-[color:var(--text)]'
const PP_HEATMAP_NUM_GOAL_CLASSES = 'text-[#f87171]'
const PP_HEATMAP_NUM_SOG_CLASSES = 'text-[#4ade80]'
const PP_HEATMAP_FILTERS_CLASSES = 'flex gap-[6px] flex-wrap mb-[10px]'
const PP_HEATMAP_RINK_CLASSES = 'rounded-lg overflow-hidden w-full'
const HEATMAP_CHIP_BASE_CLASSES = 'py-1 px-[10px] rounded-xl text-[11px] font-semibold leading-none border-[0.5px] border-[var(--border)] bg-[var(--bg2)] text-[color:var(--text-muted)] cursor-pointer'
const HEATMAP_CHIP_ACTIVE_CLASSES = 'bg-[var(--red-bright)] text-[#fff] border-[var(--red-bright)]'
function heatmapChipClasses(active) { return `${HEATMAP_CHIP_BASE_CLASSES} ${active ? HEATMAP_CHIP_ACTIVE_CLASSES : ''}` }

const PP_PHOTO_CLASSES = 'w-[80px] h-[80px] object-cover object-top rounded-[var(--radius)] bg-[var(--bg3)] border-[0.5px] border-[var(--border-2)]'
const PP_PHOTO_FALLBACK_CLASSES = 'w-[80px] h-[80px] rounded-[var(--radius)] bg-[var(--bg3)] border-[0.5px] border-[var(--border-2)] flex items-center justify-center font-[family-name:var(--font-display)] text-[24px] font-bold text-[color:var(--text-dim)]'
const PP_NUM_CLASSES = 'font-[family-name:var(--font-display)] text-[11px] font-bold text-[color:var(--red-bright)] tracking-[0.06em]'
const PP_LAST_CLASSES = 'pp-last font-[family-name:var(--font-display)] text-[20px] font-bold text-[color:var(--text)]'
const PP_CHIPS_CLASSES = 'flex gap-[5px] flex-wrap mt-[2px]'
const PP_POS_CHIP_CLASSES = 'pp-pos-chip font-[family-name:var(--font-display)] text-[10px] font-bold bg-[var(--red-dim)] text-[color:var(--red-bright)] border-[0.5px] border-[var(--red-border)] py-[2px] px-[7px] rounded'
const PP_CHIP_CLASSES = 'pp-chip text-[10px] text-[color:var(--text-muted)] bg-[var(--bg3)] py-[2px] px-[6px] rounded'
const PP_BIRTH_CLASSES = 'text-[10px] text-[color:var(--text-dim)] mt-[2px]'

const PP_SPOTLIGHT_CLASSES = 'py-3 px-4 bg-[var(--bg2)] border-b-[0.5px] border-[var(--border)]'
const PP_SPOTLIGHT_ROW_CLASSES = 'flex flex-wrap gap-1.5 items-center justify-center mb-2'
const PP_DRAFT_CHIP_CLASSES = 'text-[10px] font-medium text-[color:var(--text-muted)] bg-[var(--bg3)] py-[3px] px-2 rounded-[10px]'
const PP_BIO_LIST_CLASSES = 'flex flex-col gap-1 text-[11px] text-[color:var(--text-muted)] leading-[1.4] list-disc pl-4'
const PP_BIO_TOGGLE_CLASSES = 'text-[10px] font-semibold text-[color:var(--red-bright)] bg-transparent border-0 cursor-pointer mt-1.5 p-0 hover:underline'
const BIO_COLLAPSED_COUNT = 3

const PP_FORM_LABEL_CLASSES = 'flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-dim)] font-[family-name:var(--font-display)] py-1 px-4 border-b-[0.5px] border-[var(--border)] mb-1.5'
const PP_FORM_STRIP_CLASSES = 'flex gap-1.5 overflow-x-auto pb-1 mb-3 px-4'
const PP_FORM_CARD_CLASSES = 'flex flex-col items-center gap-0.5 shrink-0 bg-[var(--bg2)] border-[0.5px] border-[var(--border)] rounded-[var(--radius-sm)] py-1.5 px-2 min-w-[64px]'

const PP_TABS_CLASSES = 'flex border-b-[0.5px] border-[var(--border)] mx-[-16px] px-4'
const PP_TAB_BASE_CLASSES = 'pp-tab flex-1 py-[10px] text-[13px] font-semibold bg-transparent border-0 border-b-2 cursor-pointer [transition:all_0.15s]'
const PP_TAB_INACTIVE_CLASSES = 'text-[color:var(--text-muted)] border-b-transparent'
const PP_TAB_ACTIVE_CLASSES = 'text-[color:var(--red-bright)] border-b-[var(--red-bright)]'
function ppTabClasses(active) { return `${PP_TAB_BASE_CLASSES} ${active ? PP_TAB_ACTIVE_CLASSES : PP_TAB_INACTIVE_CLASSES}` }

const PLAYER_POPUP_CLASSES = 'player-popup bg-[var(--bg1)] border-[0.5px] border-[var(--border-2)] rounded-t-[var(--radius-lg)] w-full max-w-[420px] max-h-[90vh] overflow-y-auto overflow-x-hidden shadow-[0_-8px_40px_rgba(0,0,0,0.5)] animate-[slide-up_0.2s_cubic-bezier(0.34,1.2,0.64,1)] min-[560px]:rounded-[var(--radius-lg)] min-[560px]:animate-[pop-in_0.2s_cubic-bezier(0.34,1.2,0.64,1)]'
const PP_HEADER_CLASSES = 'pp-header flex items-start gap-[14px] p-4 border-b-[0.5px] border-[var(--border)] [background:linear-gradient(135deg,rgba(204,34,0,0.07)_0%,transparent_55%)] relative'
const PP_IDENTITY_CLASSES = 'flex-1 min-w-0 flex flex-col gap-1'
const PP_NAME_CLASSES = 'pp-name flex flex-col leading-[1.1]'
const PP_FIRST_CLASSES = 'pp-first text-[12px] text-[color:var(--text-muted)]'
const PP_CLOSE_CLASSES = 'pp-close absolute top-3 right-3 w-[28px] h-[28px] rounded-full bg-[var(--bg3)] text-[color:var(--text-muted)] text-[12px] flex items-center justify-center [transition:all_0.12s] hover:bg-[var(--bg4)] hover:text-[color:var(--text)]'
const PP_BODY_CLASSES = 'pp-body pt-2 pb-4'
const PP_NO_STATS_CLASSES = 'text-center p-5 text-[12px] text-[color:var(--text-dim)] italic'
const PP_PHOTO_WRAP_CLASSES = 'shrink-0'
const PP_METRIC_SELECT_CLASSES = 'text-[11px] text-[color:var(--text)] bg-[var(--bg2)] border-[0.5px] border-[var(--border)] rounded-md py-[3px] px-[6px]'

function fmtBirth(str) {
  if (!str) return null;
  const d = new Date(str + 'T12:00:00');
  return formatDate(d, { month: 'long', day: 'numeric', year: 'numeric' });
}
function calcAge(str) {
  if (!str) return null;
  const today = new Date(), dob = new Date(str);
  let age = today.getFullYear() - dob.getFullYear();
  if (today.getMonth() < dob.getMonth() ||
      (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
  return age;
}

// Goalie decision letter -- the {league}_game_log tables have no OT/shootout
// columns, so gameByGame rows (from /{league}/player/career) can't tell an
// OT/SO loss from a regulation one the way PWHL's helper can: W/L only.
function goalieDecision(g) {
  if (g.win) return 'W';
  if (g.loss || g.ot_loss || g.shootout_loss) return 'L';
  return null;
}
function decisionColor(decision) {
  return decision === 'W' ? 'var(--green)' : decision === 'L' ? 'var(--red-bright)' : 'var(--amber)';
}

// ── Heat Map (skaters only) ──────────────────────────────────────────────
function HeatMap({ league, playerId, season, isGoalie, teamId }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('all');

  const { data: shotData, loading } = useFetch(
    () => !isGoalie && playerId ? league.fetchShots(playerId, season) : Promise.resolve(null),
    [playerId, season, isGoalie]
  );

  if (isGoalie) {
    return (
      <div className={PP_HEATMAP_EMPTY_CLASSES}>
        <div className={PP_HEATMAP_ICON_CLASSES}>🥅</div>
        <div>{t(`${league.key}PlayerPopup.heatMap.goalieUnavailable`)}</div>
        <div className={PP_HEATMAP_SUB_CLASSES}>{t(`${league.key}PlayerPopup.heatMap.goalieUnavailableSub`)}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={PP_HEATMAP_EMPTY_CLASSES}>
        <div className={PP_HEATMAP_ICON_CLASSES}>🎯</div>
        <div>{t('playerPopup.heatMap.loading')}</div>
      </div>
    );
  }

  if (!shotData || !shotData.shots?.length) {
    return (
      <div className={PP_HEATMAP_EMPTY_CLASSES}>
        <div className={PP_HEATMAP_ICON_CLASSES}>🎯</div>
        <div>{t('playerPopup.heatMap.skater.emptyPwhl')}</div>
        <div className={PP_HEATMAP_SUB_CLASSES}>{t('playerPopup.heatMap.skater.emptySub')}</div>
      </div>
    );
  }

  const shots = shotData.shots;
  const allEvents = shots.map((s, i) => ({
    id: i, x: s.x, y: s.y,
    type: s.t === 'g' ? 'goal' : 'shot-on-goal',
    period: s.p,
    isCanes: true,
    shooterId: 'player',
  }));

  const filtered = filter === 'goals' ? allEvents.filter(e => e.type === 'goal')
    : filter === 'sog' ? allEvents.filter(e => e.type === 'shot-on-goal')
    : allEvents;

  const goals = allEvents.filter(e => e.type === 'goal').length;
  const sog = allEvents.filter(e => e.type === 'shot-on-goal').length;
  const total = allEvents.length;
  const sh = (goals + sog) > 0 ? ((goals / (goals + sog)) * 100).toFixed(1) : '—';

  const tAbbr = league.getTeamById(teamId)?.abbr || null;
  const tColor = league.getTeamById(teamId)?.displayColor || 'var(--team-primary)';

  return (
    <div className={PP_HEATMAP_CLASSES}>
      <div className={PP_HEATMAP_SUMMARY_CLASSES}>
        <div className={PP_HEATMAP_STAT_CLASSES}><span className={`${PP_HEATMAP_NUM_BASE_CLASSES} ${PP_HEATMAP_NUM_GOAL_CLASSES}`}>{goals}</span><span>{t('gameStatsPopup.sections.goals')}</span></div>
        <div className={PP_HEATMAP_STAT_CLASSES}><span className={`${PP_HEATMAP_NUM_BASE_CLASSES} ${PP_HEATMAP_NUM_SOG_CLASSES}`}>{sog}</span><span>SOG</span></div>
        <div className={PP_HEATMAP_STAT_CLASSES}><span className={`${PP_HEATMAP_NUM_BASE_CLASSES} ${PP_HEATMAP_NUM_DEFAULT_CLASSES}`}>{total}</span><span>{t('shotMapView.drillPopup.total')}</span></div>
        <div className={PP_HEATMAP_STAT_CLASSES}><span className={`${PP_HEATMAP_NUM_BASE_CLASSES} ${PP_HEATMAP_NUM_DEFAULT_CLASSES}`}>{sh}%</span><span>SH%</span></div>
      </div>
      <div className={PP_HEATMAP_FILTERS_CLASSES}>
        {[
          { key: 'all',   label: t('playerPopup.heatMap.skater.filterAll', { count: total }) },
          { key: 'goals', label: t('playerPopup.heatMap.skater.filterGoals', { count: goals }) },
          { key: 'sog',   label: t('playerPopup.heatMap.skater.filterSog', { count: sog }) },
        ].map(f => (
          <button key={f.key} className={heatmapChipClasses(filter === f.key)}
            onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>
      <div className={PP_HEATMAP_RINK_CLASSES}>
        <HockeyRink events={toHockeyRinkEvents(filtered)} hidePlayerFilter
          teamAbbr={tAbbr || 'TOR'} teamColor={tColor} />
      </div>
    </div>
  );
}

// ── Compare tab: one season's stat card ───────────────────────────────────
// Each selected season needs its own /player/landing fetch (one season per
// call), so each card owns exactly one useFetch -- same pattern as
// PWHLCompareSeasonCard, which keeps it legal under the rules of hooks.
function CompareSeasonCard({ league, playerId, season, label, defs }) {
  const { t } = useTranslation();
  const { data: landing, loading } = useFetch(
    () => playerId ? league.fetchLanding(playerId, season) : Promise.resolve(null),
    [playerId, season]
  );
  const groups = landing ? league.stats.groupStats(defs, landing) : [];

  if (loading) {
    return (
      <div className="stat-section">
        <div className="stat-section-header"><span className="stat-section-label">{label}</span></div>
        <div className="stat-section-body"><div className={SKELETON_CLASSES} style={{ height: 11, width: '60%', margin: '8px 0' }} /></div>
      </div>
    );
  }
  if (!groups.length) {
    return (
      <div className="stat-section">
        <div className="stat-section-header"><span className="stat-section-label">{label}</span></div>
        <div className="stat-section-body"><div className={PP_NO_STATS_CLASSES}>{t('playerPopup.compareTab.noData', { label })}</div></div>
      </div>
    );
  }
  return <TileStatSection label={label} groups={groups} />;
}

// ── Main popup ────────────────────────────────────────────────
export default function HockeyTechPlayerPopup({ league, player: initial, seasonLabel, season, onClose }) {
  const { t } = useTranslation();
  const [imgErr, setImgErr] = useState(false);
  const [ppTab, setPpTab] = useState('stats');
  const [bioExpanded, setBioExpanded] = useState(false);
  const [compareSeasons, setCompareSeasons] = useState([]);
  const [chartMetricKey, setChartMetricKey] = useState(null);

  const playerId = initial.player_id;
  const { data: landing, loading: statsLoading } = useFetch(
    () => playerId ? league.fetchLanding(playerId, season) : Promise.resolve(null),
    [playerId, season]
  );
  const p = { ...initial, ...(landing || {}) };

  const { SKATER_STATS, GOALIE_STATS, posLabel, groupStats } = league.stats;
  const isGoalie = p.position === 'G';
  const defs = isGoalie ? GOALIE_STATS : SKATER_STATS;
  const currentGroups = groupStats(defs, p);
  const teamColor = league.getTeamById(p.team_id)?.displayColor || '#4d80f0';

  const { data: career } = useFetch(
    () => playerId ? league.fetchCareer(playerId) : Promise.resolve(null),
    [playerId]
  );
  const careerRegGroups = groupStats(defs, career?.regularSeason);
  const careerPOGroups = groupStats(defs, career?.playoffs);

  // ── Compare tab ──────────────────────────────────────────────
  // Season labels come from the same memoized /config/seasons/comparison
  // fetch SeasonComparisonPicker makes -- no second request.
  const { data: comparisonConfig } = useFetch(fetchComparisonSeasons, []);
  const seasonOptions = normalizeComparisonSeasons(league.key, comparisonConfig?.[league.key]?.seasons);
  const compareLabel = (val) => seasonOptions.find(s => s.value === val)?.label || `Season ${val}`;

  const chartableStatDefs = defs.filter(d => d.perGame);
  const activeChartDef = chartableStatDefs.find(d => d.key === chartMetricKey) || chartableStatDefs[0] || null;

  const { data: gameLogsBySeason, loading: gameLogLoading } = useFetch(
    () => (compareSeasons.length
      ? Promise.all(compareSeasons.map(s => league.fetchGameLog(playerId, s)))
      : Promise.resolve([])),
    [playerId, compareSeasons.join(',')]
  );

  const compareSeasonsSortedDesc = useMemo(
    () => [...compareSeasons].sort((a, b) => b - a),
    [compareSeasons]
  );

  const chartSeries = useMemo(() => {
    if (!activeChartDef || !gameLogsBySeason) return [];
    const logBySeason = new Map(compareSeasons.map((s, i) => [s, gameLogsBySeason[i]]));
    return compareSeasonsSortedDesc.map((s, idx) => {
      const log = logBySeason.get(s);
      // The route returns games oldest first, so index + 1 is the game number.
      const games = (isGoalie ? log?.goalies : log?.skaters) || [];
      return {
        seasonLabel: compareLabel(s),
        color: seasonRampColor(teamColor, idx, compareSeasonsSortedDesc.length),
        dashPattern: CHART_DASH_PATTERNS[idx % CHART_DASH_PATTERNS.length],
        dataPoints: games.map((g, i) => ({ gameNumber: i + 1, value: perGameValue(activeChartDef, g) })),
      };
    });
    // comparisonConfig: compareLabel reads the season options derived from it.
  }, [activeChartDef, gameLogsBySeason, compareSeasons, compareSeasonsSortedDesc, isGoalie, teamColor, comparisonConfig]);

  const name = p.player_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
  const firstName = p.first_name || name.split(' ')[0] || '';
  const lastName = p.last_name || name.split(' ').slice(1).join(' ') || '';
  const headshot = p.headshot || `https://assets.leaguestat.com/${league.key}/${league.headshotSize}/${p.player_id}.jpg`;
  const initials = (firstName[0] || '') + (lastName[0] || '');

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div className={PLAYER_POPUP_CLASSES} onClick={e => e.stopPropagation()}>

        {/* ── Header — always the plain identity layout (no percentile-driven
            radar reflow the way PWHL's/NHL's headers get, since there's no
            percentile data to drive one) ── */}
        <div className={PP_HEADER_CLASSES}>
          <div className={PP_PHOTO_WRAP_CLASSES}>
            {!imgErr ? (
              <img src={headshot} alt={name} className={PP_PHOTO_CLASSES} onError={() => setImgErr(true)} />
            ) : (
              <div className={PP_PHOTO_FALLBACK_CLASSES}>{initials}</div>
            )}
          </div>
          <div className={PP_IDENTITY_CLASSES}>
            {p.jersey_number && <div className={PP_NUM_CLASSES}>#{p.jersey_number}</div>}
            <div className={PP_NAME_CLASSES}>
              <span className={PP_FIRST_CLASSES}>{firstName}</span>
              <span className={PP_LAST_CLASSES}>{lastName}</span>
            </div>
            <div className={PP_CHIPS_CLASSES}>
              {p.position && <span className={PP_POS_CHIP_CLASSES}>{posLabel(p.position)}</span>}
              {p.shoots && <span className={PP_CHIP_CLASSES}>{isGoalie ? t('playerPopup.bio.catches') : t('playerPopup.bio.shoots')} {p.shoots === 'L' ? t('playerPopup.bio.left') : p.shoots === 'R' ? t('playerPopup.bio.right') : p.shoots}</span>}
            </div>
            {p.birth_date && (
              <div className={PP_BIRTH_CLASSES}>
                {t('playerPopup.bio.birthAge', { birth: fmtBirth(p.birth_date), age: calcAge(p.birth_date) })}
                {p.birth_place ? ` · ${p.birth_place}` : ''}
              </div>
            )}
          </div>
          <button className={PP_CLOSE_CLASSES} onClick={onClose} aria-label={t('common.close')}>✕</button>
        </div>

        {/* ── Player Spotlight — draft + bio bullets, from /{league}/player/career
            (already fetched above) ── */}
        {career && (career.draft || career.bioPoints?.length > 0) && (
          <div className={PP_SPOTLIGHT_CLASSES}>
            {career.draft && (
              <div className={PP_SPOTLIGHT_ROW_CLASSES}>
                <span className={PP_DRAFT_CHIP_CLASSES}>
                  {t('playerPopup.spotlight.draftLabelPwhl', {
                    team:  career.draft.draft_team,
                    round: career.draft.draft_round,
                    year:  career.draft.draft_year,
                  })}
                </span>
              </div>
            )}
            {career.bioPoints?.length > 0 && (
              <>
                <ul className={PP_BIO_LIST_CLASSES}>
                  {(bioExpanded ? career.bioPoints : career.bioPoints.slice(0, BIO_COLLAPSED_COUNT)).map((pt, i) => <li key={i}>{pt}</li>)}
                </ul>
                {career.bioPoints.length > BIO_COLLAPSED_COUNT && (
                  <button className={PP_BIO_TOGGLE_CLASSES} onClick={() => setBioExpanded(e => !e)}>
                    {bioExpanded
                      ? t('playerPopup.spotlight.bioShowLess')
                      : t('playerPopup.spotlight.bioShowMore', { count: career.bioPoints.length - BIO_COLLAPSED_COUNT })}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className={PP_TABS_CLASSES}>
          <button className={ppTabClasses(ppTab === 'stats')} onClick={() => setPpTab('stats')}>{t('playerPopup.tabs.stats')}</button>
          <button className={ppTabClasses(ppTab === 'heatmap')} onClick={() => setPpTab('heatmap')}>{t('playerPopup.tabs.heatMap')}</button>
          <button className={ppTabClasses(ppTab === 'compare')} onClick={() => setPpTab('compare')}>{t('playerPopup.tabs.compare')}</button>
        </div>

        {/* ── Stats tab ── */}
        {ppTab === 'stats' && (
          <div className={PP_BODY_CLASSES}>
            {statsLoading ? (
              <div className={PP_HEATMAP_EMPTY_CLASSES}>
                <div className={PP_HEATMAP_ICON_CLASSES}>📊</div>
                <div>{t('playerPopup.loadingStats')}</div>
              </div>
            ) : (
              <>
                {career?.recentGames?.length > 0 && (
                  <div>
                    <div className={PP_FORM_LABEL_CLASSES}>
                      {t('playerPopup.recentForm.label')}
                      <InfoTip text={isGoalie ? t(`${league.key}PlayerPopup.recentForm.legendGoalie`) : t('playerPopup.recentForm.legendSkater')} position="above" />
                    </div>
                    <div className={PP_FORM_STRIP_CLASSES}>
                      {career.recentGames.map((g, i) => {
                        const decision = isGoalie ? goalieDecision(g) : null;
                        const main = isGoalie
                          ? (decision || '—')
                          : `${g.goals ?? 0}-${g.assists ?? 0}-${g.points ?? 0}`;
                        const color = isGoalie
                          ? decisionColor(decision)
                          : ((g.goals ?? 0) + (g.assists ?? 0) > 0 ? 'var(--green)' : 'var(--text-muted)');
                        return (
                          <div key={i} className={PP_FORM_CARD_CLASSES}>
                            <span className="text-[9px] text-[color:var(--text-dim)] whitespace-nowrap">{g.game}</span>
                            <span className="text-[13px] font-bold font-[family-name:var(--font-mono)]" style={{ color }}>{main}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {currentGroups.length > 0
                  ? <TileStatSection
                      // seasonLabel is pre-formatted ("2025-26", "2026
                      // Playoffs") and rendered as-is -- not run through
                      // PWHL's "{{season}} Regular Season" template, which
                      // would produce "2026 Playoffs Regular Season" for a
                      // playoff label (both leagues' live current season
                      // is a playoff id for most of the offseason; see
                      // ahlConfig.js's AHL_REGULAR_SEASON_MAP comment).
                      label={seasonLabel}
                      groups={currentGroups}
                      highlight
                    />
                  : <div className={PP_NO_STATS_CLASSES}>{t('playerPopup.bio.noStats')}</div>}
                {(careerRegGroups.length > 0 || careerPOGroups.length > 0) && (
                  <div className="stat-section-peers">
                    {careerRegGroups.length > 0 && <TileStatSection label={t('playerPopup.sections.careerRegularPwhl')} groups={careerRegGroups} />}
                    {careerPOGroups.length > 0 && <TileStatSection label={t('playerPopup.sections.careerPlayoffs')} groups={careerPOGroups} />}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Heat map tab ── */}
        {ppTab === 'heatmap' && (
          <HeatMap league={league} playerId={p.player_id} season={season} isGoalie={isGoalie} teamId={p.team_id} />
        )}

        {/* ── Compare tab — season-over-season ── */}
        {ppTab === 'compare' && (
          <div className={PP_BODY_CLASSES}>
            <SeasonComparisonPicker
              league={league.key}
              selected={compareSeasons}
              onChange={setCompareSeasons}
              maxSelected={4}
            />
            {compareSeasons.length === 0 && (
              <div className={PP_NO_STATS_CLASSES}>{t('playerPopup.compareTab.selectSeasons')}</div>
            )}
            {chartableStatDefs.length > 0 && compareSeasons.length > 0 && (
              <div className="stat-section xg-overlay-section">
                <div className="stat-section-header">
                  <span className="stat-section-label">{t('playerPopup.compareTab.perGameTrend')}</span>
                  <select
                    className={PP_METRIC_SELECT_CLASSES}
                    value={activeChartDef?.key || ''}
                    onChange={e => setChartMetricKey(e.target.value)}
                    aria-label={t('playerPopup.compareTab.trendMetricAriaLabel')}
                  >
                    {chartableStatDefs.map(d => (
                      <option key={d.key} value={d.key}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div className="stat-section-body">
                  {gameLogLoading
                    ? <div className={PP_NO_STATS_CLASSES}>{t('playerPopup.compareTab.loadingChart')}</div>
                    : <SeasonOverlayChart series={chartSeries} metricLabel={activeChartDef.label} />}
                </div>
              </div>
            )}
            {compareSeasonsSortedDesc.map(s => (
              <CompareSeasonCard
                key={s}
                league={league}
                playerId={p.player_id}
                season={s}
                label={compareLabel(s)}
                defs={defs}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
