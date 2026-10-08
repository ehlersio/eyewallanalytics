// views/hockeytech/HockeyTechLeagueView.jsx
// AHL/ECHL League tab, shared by both leagues (AHLLeagueView/ECHLLeagueView
// are wrappers). Takes `league` (utils/hockeyTechLeagues.js) for standings/
// leaders/today fetches, team lookups, division order, seasons, player
// popup, logos and i18n keys.
//
// Scoreboard + Standings (grouped by division -- both leagues have real
// division structure, unlike PWHL's flat table: league.config.divisionOrder)
// + Leaders (goalie GP gate in utils/hockeyTechLeaders.js) + Power rankings
// (contract C12: the pipeline's nightly ranking with the followed team's
// EyeWall AI narrative, HockeyTechPowerRankingsPanel -- offered only once
// the route has rows, or with a note when the Worker couldn't read them).
// Leader rows open the league's player popup. Bracket (contract C11,
// HockeyTechBracketPanel): this year's Calder/Kelly Cup bracket, or the
// "if the playoffs started today" projection, or a note saying why there's
// none.
import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetch, usePoll } from '../../hooks/useFetch';
import { useLeagueSeasons } from '../../hooks/useLeagueSeasons';
import TeamLogo from '../../components/TeamLogo';
import HockeyTechPlayerPopup from '../../components/HockeyTechPlayerPopup';
import Scoreboard from '../../components/Scoreboard';
import LocalPredictionScorecard from '../../components/LocalPredictionScorecard';
import HockeyTechPowerRankingsPanel, { HockeyTechRankingsUnavailable } from '../../components/hockeytech/HockeyTechPowerRankingsPanel';
import { rankingsState } from '../../utils/hockeyTechPowerRankings';
import HockeyTechBracketPanel from '../../components/hockeytech/HockeyTechBracketPanel';
import { bracketTabState, currentPlayoffSeason } from '../../utils/hockeyTechBracket';
import { SKELETON_CLASSES } from '../../utils/skeletonClasses';
import { streakColor } from '../../utils/hockeyTechResults';
import { qualifiedGoalies } from '../../utils/hockeyTechLeaders';

const LEAGUE_VIEW_CLASSES = 'league-view flex flex-col pt-[14px] px-[14px]';
const LEAGUE_CONTENT_CLASSES = 'league-content pb-6';
const LEAGUE_TABS_CLASSES = 'league-tabs flex flex-wrap mb-[14px] pb-[10px] border-b-[0.5px] border-[var(--border)]';
const LEAGUE_TAB_BASE_CLASSES = 'league-tab py-[6px] px-4 rounded-[20px] text-[13px] font-medium border-[0.5px] flex items-center cursor-pointer [transition:all_0.15s]';
const LEAGUE_TAB_INACTIVE_CLASSES = 'text-[color:var(--text-muted)] bg-transparent border-transparent';
const LEAGUE_TAB_ACTIVE_CLASSES = 'text-[color:var(--red-bright)] bg-[var(--red-dim)] border-transparent';
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

function teamAbbr(league, teamId) {
  return league.config.getTeamById(teamId)?.abbr;
}

export default function HockeyTechLeagueView({ league }) {
  const { t } = useTranslation();
  // Re-render when the season list is rebuilt from the Worker (C7).
  useLeagueSeasons(league);
  const [tab, setTab] = useState('scoreboard');
  const [selected, setSelected] = useState(null);

  // The league's current season is a `let` binding updated in place by an
  // async fetch at module load (see ahlConfig.js) -- this component holds no
  // state of its own for it, so re-render on the live-update event rather
  // than freezing at whatever fallback seed was current on first render.
  // Same race PWHLPlayersView.jsx/the shot map and Players views
  // all guard against.
  const [season, setSeasonState] = useState(league.config.currentSeason);
  useEffect(() => {
    function handleSeasonUpdate(e) { setSeasonState(e.detail); }
    window.addEventListener(league.config.seasonUpdatedEvent, handleSeasonUpdate);
    return () => window.removeEventListener(league.config.seasonUpdatedEvent, handleSeasonUpdate);
  }, []);

  const { data: standings, loading: standLoading } = useFetch(() => league.api.fetchStandings(season), [season]);
  const { data: leagueData, loading: leadersLoading } = useFetch(() => league.api.fetchLeaguePlayers(season), [season]);
  // Polled (30s) only while the Scoreboard tab is active -- see NHL
  // LeagueView.jsx's identical guard for why.
  // Read up front: whether there are rankings decides whether the tab is
  // offered (no dead tab before the first nightly run).
  const { data: rankings, loading: rankingsLoading } = useFetch(() => league.api.fetchPowerRankings(league.teamId), []);
  const rankingsTab = rankingsState(rankings, rankingsLoading);
  const showRankings = rankingsTab === 'rows' || rankingsTab === 'unavailable';
  // The bracket (contract C11): this year's playoffs once they have series,
  // else the standings projection, else a note for why there's none. Both
  // read up front, since what they hold decides whether the tab is offered.
  const playoffSeason = currentPlayoffSeason(league.config);
  const { data: realBracket, loading: realBracketLoading } = useFetch(
    () => playoffSeason ? league.api.fetchBracket(playoffSeason) : Promise.resolve(null), [playoffSeason]);
  const { data: projectedBracket, loading: projectedLoading } = useFetch(() => league.api.fetchProjectedBracket(), []);
  const bracket = bracketTabState(realBracket, projectedBracket, realBracketLoading || projectedLoading);
  const showBracket = bracket.mode === 'real' || bracket.mode === 'projected' || bracket.mode === 'note';
  const { data: todaysGames, loading: todaysGamesLoading, error: todaysGamesError }
    = usePoll(() => tab === 'scoreboard' ? league.api.fetchToday() : Promise.resolve(null), 30000, [tab]);

  return (
    <div className={LEAGUE_VIEW_CLASSES}>
      <div className={LEAGUE_TABS_CLASSES}>
        <button className={leagueTabClasses(tab === 'scoreboard')} onClick={() => setTab('scoreboard')}>{t('league.tabs.scoreboard')}</button>
        <button className={leagueTabClasses(tab === 'standings')} onClick={() => setTab('standings')}>{t('league.tabs.standings')}</button>
        {showBracket && (
          <button className={leagueTabClasses(tab === 'bracket')} onClick={() => setTab('bracket')}>{t('league.tabs.bracket')}</button>
        )}
        <button className={leagueTabClasses(tab === 'leaders')} onClick={() => setTab('leaders')}>{t('league.tabs.leaders')}</button>
        {showRankings && (
          <button className={leagueTabClasses(tab === 'rankings')} onClick={() => setTab('rankings')}>{t('league.tabs.rankings')}</button>
        )}
        <button className={leagueTabClasses(tab === 'scorecard')} onClick={() => setTab('scorecard')}>{t('scorecard.tabLabel')}</button>
      </div>
      <div className={LEAGUE_CONTENT_CLASSES}>
        {tab === 'scoreboard' && (
          <Scoreboard sport={league.key} games={todaysGames} loading={todaysGamesLoading} error={todaysGamesError} />
        )}
        {tab === 'standings' && (
          <StandingsPanel league={league} standings={standings || []} loading={standLoading} myTeamId={league.teamId} />
        )}
        {tab === 'bracket' && showBracket && <HockeyTechBracketPanel league={league} state={bracket} />}
        {tab === 'leaders' && (
          <LeadersPanel league={league} skaters={leagueData?.skaters || []} goalies={leagueData?.goalies || []} loading={leadersLoading} onSelect={setSelected} />
        )}
        {tab === 'rankings' && rankingsTab === 'rows' && <HockeyTechPowerRankingsPanel league={league} data={rankings} />}
        {tab === 'rankings' && rankingsTab === 'unavailable' && <HockeyTechRankingsUnavailable />}
        {tab === 'scorecard' && <LocalPredictionScorecard store={league.predictionStore} />}
      </div>

      {selected && (
        <HockeyTechPlayerPopup
          league={league}
          player={selected}
          seasonLabel={league.config.seasons.find(s => s.id === season)?.label || String(season)}
          season={season}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function StandingsPanel({ league, standings, loading, myTeamId }) {
  const { t } = useTranslation();

  const byDivision = useMemo(() => {
    const groups = {};
    for (const row of standings) {
      const division = league.config.getTeamById(row.team_id)?.division || 'Other';
      (groups[division] ||= []).push(row);
    }
    for (const rows of Object.values(groups)) {
      rows.sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
    }
    return groups;
  }, [league, standings]);

  if (loading) return <LoadingRows />;
  if (!standings.length) return <div className={LV_EMPTY_CLASSES}>{t('hockeyTechLeagueView.standingsEmpty')}</div>;

  return (
    <>
      {league.config.divisionOrder.filter(d => byDivision[d]?.length).map(division => (
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
                  const abbr = teamAbbr(league, row.team_id) || '—';
                  const isMe = row.team_id === myTeamId;
                  return (
                    <tr key={row.team_id} className="lv-row" style={isMe ? { background: 'rgba(255,255,255,0.03)' } : undefined}>
                      <td className={lvTdClasses('rank')}>{i + 1}</td>
                      <td className={lvTdClasses('team')}>
                        <span className={LV_TEAM_CELL_CLASSES}>
                          <TeamLogo abbr={abbr} sport={league.key} size={18} />
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
                          ? <span style={{ color: streakColor(row.streakType), fontWeight: 600 }}>{row.streakType}{row.streakCount}</span>
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

function LeadersCard({ league, title, statLabel, rows, formatStat, onSelect }) {
  return (
    <div className={LV_LEADERS_CARD_CLASSES}>
      <div className={LV_LEADERS_CARD_HEADER_CLASSES}>
        <span>{title}</span>
        <span className={LV_LEADERS_CARD_STAT_LABEL_CLASSES}>{statLabel}</span>
      </div>
      {rows.map((p, i) => {
        const abbr = teamAbbr(league, p.team_id) || '—';
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

function LeadersPanel({ league, skaters, goalies, loading, onSelect }) {
  const { t } = useTranslation();

  const top10pts = useMemo(() => [...skaters].filter(p => p.player_name).sort((a, b) => (b.points ?? 0) - (a.points ?? 0)).slice(0, 10), [skaters]);
  const top10g   = useMemo(() => [...skaters].filter(p => p.player_name).sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0)).slice(0, 10), [skaters]);
  // The GP gate scales with the season (utils/hockeyTechLeaders.js): a
  // flat 5 left both goalie cards empty for the first weeks of every year.
  const qualified = useMemo(() => qualifiedGoalies(goalies), [goalies]);
  const top10gaa = useMemo(() => [...qualified].sort((a, b) => (a.gaa ?? 99) - (b.gaa ?? 99)).slice(0, 10), [qualified]);
  const top10svp = useMemo(() => [...qualified].sort((a, b) => (b.sv_pct ?? 0) - (a.sv_pct ?? 0)).slice(0, 10), [qualified]);

  if (loading) return <LoadingRows />;
  if (!skaters.length && !goalies.length) return <div className={LV_EMPTY_CLASSES}>{t('hockeyTechLeagueView.leadersEmpty')}</div>;

  return (
    <div className={LV_LEADERS_GRID_CLASSES}>
      <LeadersCard league={league} title={t('league.leaders.titlePoints')} statLabel="PTS" rows={top10pts} formatStat={p => p.points ?? '—'} onSelect={onSelect} />
      <LeadersCard league={league} title={t('league.leaders.titleGoals')} statLabel="G" rows={top10g} formatStat={p => p.goals ?? '—'} onSelect={onSelect} />
      {top10gaa.length > 0 && (
        <LeadersCard league={league} title={t('league.leaders.titleGAA')} statLabel="GAA" rows={top10gaa} formatStat={p => p.gaa != null ? Number(p.gaa).toFixed(2) : '—'} onSelect={onSelect} />
      )}
      {top10svp.length > 0 && (
        <LeadersCard league={league} title={t('league.leaders.titleSavePct')} statLabel="SV%" rows={top10svp} formatStat={p => p.sv_pct != null ? Number(p.sv_pct).toFixed(3).replace('0.', '.') : '—'} onSelect={onSelect} />
      )}
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
