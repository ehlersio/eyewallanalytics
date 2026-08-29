// views/AHLLeagueView.jsx
// Standings (grouped by division -- AHL has real conference/division
// structure, unlike PWHL's flat table) + Leaders. No Bracket or Power
// Rankings tabs -- both depend on infrastructure not built for AHL this
// pass (playoff bracket data, AI-driven power rankings) -- see
// AHL_BUILD_BRIEF.md's scope notes. Leader rows now open AHLPlayerPopup
// (AHL/PWHL parity plan Phase 2).
import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetch } from '../hooks/useFetch';
import { fetchAHLStandings, fetchAHLLeaguePlayers, AHL_TEAM_ID } from '../utils/ahlApi';
import { AHL_CURRENT_SEASON, AHL_SEASONS, getAHLTeamById } from '../utils/ahlConfig';
import TeamLogo from '../components/TeamLogo';
import AHLPlayerPopup from '../components/AHLPlayerPopup';
import { SKELETON_CLASSES } from '../utils/skeletonClasses';

const LEAGUE_VIEW_CLASSES = 'league-view flex flex-col pt-[14px] px-[14px]';
const LEAGUE_CONTENT_CLASSES = 'league-content pb-6';
const LEAGUE_TABS_CLASSES = 'league-tabs flex flex-wrap mb-[14px] pb-[10px] border-b-[0.5px] border-[var(--border)]';
const LEAGUE_TAB_BASE_CLASSES = 'league-tab py-[6px] px-4 rounded-[20px] text-[13px] font-medium border-[0.5px] flex items-center cursor-pointer [transition:all_0.15s]';
const LEAGUE_TAB_INACTIVE_CLASSES = 'text-[color:var(--text-muted)] bg-transparent border-transparent';
const LEAGUE_TAB_ACTIVE_CLASSES = 'text-[color:var(--red-bright)] bg-[var(--red-dim)] border-[var(--red-border)]';
function leagueTabClasses(isActive) {
  return `${LEAGUE_TAB_BASE_CLASSES} ${isActive ? LEAGUE_TAB_ACTIVE_CLASSES : LEAGUE_TAB_INACTIVE_CLASSES}`;
}

const LV_DIV_CARD_BASE_CLASSES = 'lv-div-card bg-[var(--bg1)] border-[0.5px] border-[var(--border)] rounded-[var(--radius)] overflow-hidden mb-3';
const LV_DIV_CARD_HEADER_CLASSES = 'text-[12px] font-semibold text-[color:var(--text-muted)] py-2 px-3 border-b-[0.5px] border-[var(--border)] bg-[var(--bg2)]';
const LV_TABLE_CLASSES = 'lv-table w-full border-collapse text-[12px]';
const LV_TH_BASE_CLASSES = 'lv-th text-[11px] font-bold text-[color:var(--text-dim)] py-[5px] px-2 border-b-[0.5px] border-[var(--border)] whitespace-nowrap bg-[var(--bg2)]';
function lvThClasses(isTeam) {
  return `${LV_TH_BASE_CLASSES} ${isTeam ? 'text-left' : 'text-right'}`;
}
const LV_TD_SHARED_CLASSES = 'lv-td py-[5px] pr-[4px] whitespace-nowrap';
function lvTdClasses(variant) {
  switch (variant) {
    case 'rank': return `${LV_TD_SHARED_CLASSES} pl-[4px] text-center text-[11px] min-w-[18px] text-[color:var(--text-dim)] font-sans`;
    case 'team': return `${LV_TD_SHARED_CLASSES} pl-[6px] text-left max-w-[110px] text-[color:var(--text)] font-sans`;
    case 'pts':  return `${LV_TD_SHARED_CLASSES} pl-[4px] text-right font-bold text-[color:var(--text)] font-[family-name:var(--font-mono)]`;
    default:     return `${LV_TD_SHARED_CLASSES} pl-[4px] text-right text-[color:var(--text-muted)] font-[family-name:var(--font-mono)]`;
  }
}
const LV_TEAM_CELL_CLASSES = 'flex items-center gap-[5px]';
const LV_TEAM_ABBREV_CLASSES = 'font-[family-name:var(--font-display)] font-bold tracking-[0.02em]';
const LV_EMPTY_CLASSES = 'py-8 text-center text-[color:var(--text-dim)]';

const LV_LEADERS_GRID_CLASSES = 'grid grid-cols-2 gap-3 max-[600px]:grid-cols-1';
const LV_LEADERS_CARD_CLASSES = 'lv-leaders-card bg-[var(--bg1)] border-[0.5px] border-[var(--border)] rounded-[var(--radius)] overflow-hidden';
const LV_LEADERS_CARD_HEADER_CLASSES = 'text-[12px] font-semibold text-[color:var(--text-muted)] py-2 px-3 border-b-[0.5px] border-[var(--border)] bg-[var(--bg2)] flex justify-between items-center';
const LV_LEADERS_CARD_STAT_LABEL_CLASSES = 'font-bold text-[color:var(--text-dim)] text-[11px] font-[family-name:var(--font-display)]';
const LV_LEADERS_ROW_CLASSES = 'lv-leaders-row flex items-center py-[6px] px-3 text-[12px] border-b-[0.5px] border-[rgba(255,255,255,0.04)] gap-[6px] last:border-b-0 cursor-pointer [transition:background_0.1s] hover:bg-[var(--bg3)]';
const LV_LEADERS_RANK_CLASSES = 'text-[color:var(--text-dim)] min-w-[16px] text-[11px]';
const LV_LEADERS_NAME_CLASSES = 'flex-1 text-[color:var(--text)] whitespace-nowrap overflow-hidden text-ellipsis';
const LV_LEADERS_TEAM_CLASSES = 'text-[11px] min-w-[28px] text-right font-[family-name:var(--font-display)] font-bold';
const LV_LEADERS_STAT_CLASSES = 'font-bold text-[color:var(--text)] min-w-[36px] text-right font-[family-name:var(--font-mono)]';

const DIVISION_ORDER = ['Atlantic', 'North', 'Central', 'Pacific'];

function teamAbbr(teamId) {
  return getAHLTeamById(teamId)?.abbr;
}

export default function AHLLeagueView() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('standings');
  const [selected, setSelected] = useState(null);

  // AHL_CURRENT_SEASON is a `let` binding updated in place by an async
  // fetch at module load (see ahlConfig.js) -- this component holds no
  // state of its own for it, so re-render on the live-update event rather
  // than freezing at whatever fallback seed was current on first render.
  // Same race PWHLPlayersView.jsx/AHLShotMapView.jsx/AHLPlayersView.jsx
  // all guard against.
  const [season, setSeasonState] = useState(AHL_CURRENT_SEASON);
  useEffect(() => {
    function handleSeasonUpdate(e) { setSeasonState(e.detail); }
    window.addEventListener('eyewall:ahl-season-updated', handleSeasonUpdate);
    return () => window.removeEventListener('eyewall:ahl-season-updated', handleSeasonUpdate);
  }, []);

  const { data: standings, loading: standLoading } = useFetch(() => fetchAHLStandings(season), [season]);
  const { data: leagueData, loading: leadersLoading } = useFetch(() => fetchAHLLeaguePlayers(season), [season]);

  return (
    <div className={LEAGUE_VIEW_CLASSES}>
      <div className={LEAGUE_TABS_CLASSES}>
        <button className={leagueTabClasses(tab === 'standings')} onClick={() => setTab('standings')}>{t('league.tabs.standings')}</button>
        <button className={leagueTabClasses(tab === 'leaders')} onClick={() => setTab('leaders')}>{t('league.tabs.leaders')}</button>
      </div>
      <div className={LEAGUE_CONTENT_CLASSES}>
        {tab === 'standings' && (
          <StandingsPanel standings={standings || []} loading={standLoading} myTeamId={AHL_TEAM_ID} />
        )}
        {tab === 'leaders' && (
          <LeadersPanel skaters={leagueData?.skaters || []} goalies={leagueData?.goalies || []} loading={leadersLoading} onSelect={setSelected} />
        )}
      </div>

      {selected && (
        <AHLPlayerPopup
          player={selected}
          seasonLabel={AHL_SEASONS.find(s => s.id === season)?.label || String(season)}
          season={season}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function StandingsPanel({ standings, loading, myTeamId }) {
  const { t } = useTranslation();

  const byDivision = useMemo(() => {
    const groups = {};
    for (const row of standings) {
      const division = getAHLTeamById(row.team_id)?.division || 'Other';
      (groups[division] ||= []).push(row);
    }
    for (const rows of Object.values(groups)) {
      rows.sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
    }
    return groups;
  }, [standings]);

  if (loading) return <LoadingRows />;
  if (!standings.length) return <div className={LV_EMPTY_CLASSES}>{t('ahlLeagueView.standingsEmpty')}</div>;

  return (
    <>
      {DIVISION_ORDER.filter(d => byDivision[d]?.length).map(division => (
        <div key={division} className={LV_DIV_CARD_BASE_CLASSES}>
          <div className={LV_DIV_CARD_HEADER_CLASSES}>{division}</div>
          <div style={{ overflowX: 'auto' }}>
            <table className={LV_TABLE_CLASSES} style={{ minWidth: 480 }}>
              <thead>
                <tr>
                  <th className={lvThClasses(false)}>#</th>
                  <th className={lvThClasses(true)}>{t('league.standings.colTeam')}</th>
                  <th className={lvThClasses(false)}>GP</th>
                  <th className={lvThClasses(false)}>W</th>
                  <th className={lvThClasses(false)}>L</th>
                  <th className={lvThClasses(false)}>OTL</th>
                  <th className={lvThClasses(false)}>SOL</th>
                  <th className={lvThClasses(false)}>PTS</th>
                  <th className={lvThClasses(false)}>GF</th>
                  <th className={lvThClasses(false)}>GA</th>
                  <th className={lvThClasses(false)}>STRK</th>
                </tr>
              </thead>
              <tbody>
                {byDivision[division].map((row, i) => {
                  const abbr = teamAbbr(row.team_id) || '—';
                  const isMe = row.team_id === myTeamId;
                  return (
                    <tr key={row.team_id} className="lv-row" style={isMe ? { background: 'rgba(255,255,255,0.03)' } : undefined}>
                      <td className={lvTdClasses('rank')}>{i + 1}</td>
                      <td className={lvTdClasses('team')}>
                        <span className={LV_TEAM_CELL_CLASSES}>
                          <TeamLogo abbr={abbr} sport="ahl" size={18} />
                          <span className={LV_TEAM_ABBREV_CLASSES}>{abbr}</span>
                        </span>
                      </td>
                      <td className={lvTdClasses()}>{row.gp ?? '—'}</td>
                      <td className={lvTdClasses()}>{row.wins ?? '—'}</td>
                      <td className={lvTdClasses()}>{row.losses ?? '—'}</td>
                      <td className={lvTdClasses()}>{row.ot_losses ?? '—'}</td>
                      <td className={lvTdClasses()}>{row.shootout_losses ?? '—'}</td>
                      <td className={lvTdClasses('pts')}>{row.points ?? '—'}</td>
                      <td className={lvTdClasses()}>{row.goals_for ?? '—'}</td>
                      <td className={lvTdClasses()}>{row.goals_against ?? '—'}</td>
                      <td className={lvTdClasses()} style={{ textAlign: 'center' }}>
                        {row.streakType && row.streakCount
                          ? <span style={{ color: row.streakType === 'W' ? 'var(--green)' : 'var(--red-bright)', fontWeight: 600 }}>{row.streakType}{row.streakCount}</span>
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}

function LeadersCard({ title, statLabel, rows, formatStat, onSelect }) {
  return (
    <div className={LV_LEADERS_CARD_CLASSES}>
      <div className={LV_LEADERS_CARD_HEADER_CLASSES}>
        <span>{title}</span>
        <span className={LV_LEADERS_CARD_STAT_LABEL_CLASSES}>{statLabel}</span>
      </div>
      {rows.map((p, i) => {
        const abbr = teamAbbr(p.team_id) || '—';
        return (
          <div key={p.player_id ?? i} className={LV_LEADERS_ROW_CLASSES} onClick={() => onSelect?.(p)}>
            <span className={LV_LEADERS_RANK_CLASSES}>{i + 1}</span>
            <span className={LV_LEADERS_NAME_CLASSES}>{p.player_name || '—'}</span>
            <span className={LV_LEADERS_TEAM_CLASSES}>{abbr}</span>
            <span className={LV_LEADERS_STAT_CLASSES}>{formatStat ? formatStat(p) : (p.points ?? '—')}</span>
          </div>
        );
      })}
    </div>
  );
}

function LeadersPanel({ skaters, goalies, loading, onSelect }) {
  const { t } = useTranslation();

  const top10pts = useMemo(() => [...skaters].filter(p => p.player_name).sort((a, b) => (b.points ?? 0) - (a.points ?? 0)).slice(0, 10), [skaters]);
  const top10g   = useMemo(() => [...skaters].filter(p => p.player_name).sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0)).slice(0, 10), [skaters]);
  const top10gaa = useMemo(() => [...goalies].filter(g => g.player_name && (g.gp ?? 0) >= 5).sort((a, b) => (a.gaa ?? 99) - (b.gaa ?? 99)).slice(0, 10), [goalies]);
  const top10svp = useMemo(() => [...goalies].filter(g => g.player_name && (g.gp ?? 0) >= 5).sort((a, b) => (b.sv_pct ?? 0) - (a.sv_pct ?? 0)).slice(0, 10), [goalies]);

  if (loading) return <LoadingRows />;
  if (!skaters.length && !goalies.length) return <div className={LV_EMPTY_CLASSES}>{t('ahlLeagueView.leadersEmpty')}</div>;

  return (
    <div className={LV_LEADERS_GRID_CLASSES}>
      <LeadersCard title={t('league.leaders.titlePoints')} statLabel="PTS" rows={top10pts} formatStat={p => p.points ?? '—'} onSelect={onSelect} />
      <LeadersCard title={t('league.leaders.titleGoals')} statLabel="G" rows={top10g} formatStat={p => p.goals ?? '—'} onSelect={onSelect} />
      <LeadersCard title={t('league.leaders.titleGAA')} statLabel="GAA" rows={top10gaa} formatStat={p => p.gaa != null ? Number(p.gaa).toFixed(2) : '—'} onSelect={onSelect} />
      <LeadersCard title={t('league.leaders.titleSavePct')} statLabel="SV%" rows={top10svp} formatStat={p => p.sv_pct != null ? Number(p.sv_pct).toFixed(3).replace('0.', '.') : '—'} onSelect={onSelect} />
    </div>
  );
}

function LoadingRows() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[80, 65, 72, 58, 70].map((w, i) => (
        <div key={i} className={SKELETON_CLASSES} style={{ height: 32, width: `${w}%`, borderRadius: 6 }} />
      ))}
    </div>
  );
}
