// components/AHLPlayerPopup.jsx
// Player detail popup for AHL -- port of PWHLPlayerPopup.jsx, scoped to
// Stats + Heat Map tabs only (AHL/PWHL parity plan Phase 2). Deliberately
// drops, all real data walls rather than scope choices:
//   - Percentile radar header / percentile-highlighted tiles -- no
//     ahl_percentiles.py-equivalent pipeline computation exists for AHL.
//   - Scout tab (AI narrative) and Compare tab (season-over-season) --
//     out of this phase's scope; Compare in particular is fully portable
//     data-wise (fetchAHLPlayerLanding per season already works) but adds
//     real UI surface (SeasonComparisonPicker/SeasonOverlayChart wiring)
//     not worth bundling into this pass.
//   - "vs Player" comparison entry (PlayerComparisonEntry) -- that
//     component hardcodes an nhl/pwhl branch throughout; needs its own
//     AHL branch + search-index work, not this phase.
//   - Goalie heat map -- AHL's PBP goal events carry goalie_id: null (see
//     eyewall-poller's ahl.js /ahl/player-shots docstring), a real
//     structural gap vs PWHL's feed. Shown as an honest "not available"
//     state instead of a heat map that would silently under-count goals.
//
// Props: player {object} — minimum shape { player_id }, season {number},
// seasonLabel {string}, onClose.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetch } from '../hooks/useFetch';
import { fetchAHLPlayerShots, fetchAHLPlayerLanding, fetchAHLPlayerCareer } from '../utils/ahlApi';
import { AHL_CURRENT_SEASON, getAHLTeamById } from '../utils/ahlConfig';
import { formatDate } from '../utils/formatters';
import { HockeyRink } from 'react-hockey-rink';
import { toHockeyRinkEvents } from '../utils/hockeyRinkEvents';
import { TileStatSection } from './StatTileGrid';
import InfoTip from './InfoTip';
import { SKATER_STATS, GOALIE_STATS, posLabel, groupStats } from '../utils/ahlPlayerStats';

// Reuses PlayerPopup.jsx/PWHLPlayerPopup.jsx's Tailwind class constants
// verbatim -- same popup-owned-helper convention (duplicate per file
// rather than cross-import between the NHL/PWHL/AHL component trees).
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

// Goalie decision letter -- AHL's ahl_game_log has no ot/shootout boolean
// columns (see ahlConfig.js's docstring), so gameByGame rows (from
// /ahl/player/career) can't distinguish an OT/SO loss from a regulation
// one the way PWHL's decision helper can -- only W/L are derivable here.
function ahlGoalieDecision(g) {
  if (g.win) return 'W';
  if (g.loss || g.ot_loss || g.shootout_loss) return 'L';
  return null;
}
function ahlDecisionColor(decision) {
  return decision === 'W' ? 'var(--green)' : decision === 'L' ? 'var(--red-bright)' : 'var(--amber)';
}

// ── Heat Map (skaters only) ──────────────────────────────────────────────
function AHLHeatMap({ playerId, season, isGoalie, teamId }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('all');

  const { data: shotData, loading } = useFetch(
    () => !isGoalie && playerId ? fetchAHLPlayerShots(playerId, season) : Promise.resolve(null),
    [playerId, season, isGoalie]
  );

  if (isGoalie) {
    return (
      <div className={PP_HEATMAP_EMPTY_CLASSES}>
        <div className={PP_HEATMAP_ICON_CLASSES}>🥅</div>
        <div>{t('ahlPlayerPopup.heatMap.goalieUnavailable')}</div>
        <div className={PP_HEATMAP_SUB_CLASSES}>{t('ahlPlayerPopup.heatMap.goalieUnavailableSub')}</div>
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

  const tAbbr = getAHLTeamById(teamId)?.abbr || null;
  const tColor = getAHLTeamById(teamId)?.displayColor || 'var(--team-primary)';

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

// ── Main popup ────────────────────────────────────────────────
export default function AHLPlayerPopup({ player: initial, seasonLabel, season = AHL_CURRENT_SEASON, onClose }) {
  const { t } = useTranslation();
  const [imgErr, setImgErr] = useState(false);
  const [ppTab, setPpTab] = useState('stats');
  const [bioExpanded, setBioExpanded] = useState(false);

  const playerId = initial.player_id;
  const { data: landing, loading: statsLoading } = useFetch(
    () => playerId ? fetchAHLPlayerLanding(playerId, season) : Promise.resolve(null),
    [playerId, season]
  );
  const p = { ...initial, ...(landing || {}) };

  const isGoalie = p.position === 'G';
  const defs = isGoalie ? GOALIE_STATS : SKATER_STATS;
  const currentGroups = groupStats(defs, p);

  const { data: career } = useFetch(
    () => playerId ? fetchAHLPlayerCareer(playerId) : Promise.resolve(null),
    [playerId]
  );
  const careerRegGroups = groupStats(defs, career?.regularSeason);
  const careerPOGroups = groupStats(defs, career?.playoffs);

  const name = p.player_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
  const firstName = p.first_name || name.split(' ')[0] || '';
  const lastName = p.last_name || name.split(' ').slice(1).join(' ') || '';
  const headshot = p.headshot || `https://assets.leaguestat.com/ahl/240x240/${p.player_id}.jpg`;
  const initials = (firstName[0] || '') + (lastName[0] || '');

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div className={PLAYER_POPUP_CLASSES} onClick={e => e.stopPropagation()}>

        {/* ── Header — always the plain identity layout (no percentile-driven
            radar reflow the way PWHL's/NHL's headers get, since AHL has no
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

        {/* ── Player Spotlight — draft + bio bullets, from /ahl/player/career
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
                      <InfoTip text={isGoalie ? t('ahlPlayerPopup.recentForm.legendGoalie') : t('playerPopup.recentForm.legendSkater')} position="above" />
                    </div>
                    <div className={PP_FORM_STRIP_CLASSES}>
                      {career.recentGames.map((g, i) => {
                        const decision = isGoalie ? ahlGoalieDecision(g) : null;
                        const main = isGoalie
                          ? (decision || '—')
                          : `${g.goals ?? 0}-${g.assists ?? 0}-${g.points ?? 0}`;
                        const color = isGoalie
                          ? ahlDecisionColor(decision)
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
                      // seasonLabel is a pre-formatted label ("2025-26",
                      // "2026 Playoffs") -- rendered as-is, not run through
                      // playerPopup.sections.seasonRegularPwhl's "{{season}}
                      // Regular Season" template like PWHL's popup does.
                      // That template silently produces "2026 Playoffs
                      // Regular Season" whenever the label passed in is
                      // itself a playoffs season, which is AHL's actual
                      // live state for most of its long off-season (see
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
          <AHLHeatMap playerId={p.player_id} season={season} isGoalie={isGoalie} teamId={p.team_id} />
        )}

      </div>
    </div>
  );
}
