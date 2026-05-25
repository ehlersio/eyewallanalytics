import { useFetch } from '../hooks/useFetch';
import {
  getTeamStats, getTeamRecentGames, getTeamTopPlayers,
  TEAM_COLORS,
} from '../utils/nhlApi';
import { computeGSAx } from '../utils/advancedStats';
import TeamLogo from './TeamLogo';
import InfoTip from './InfoTip';
import './ScoutingTab.css';

// Recent form dots
function FormDots({ games }) {
  const dots = (games || []).slice(0, 10).reverse();
  if (!dots.length) return <span className="scouting-empty">No recent games</span>;
  return (
    <div className="scouting-form-dots">
      {dots.map((g, i) => (
        <div key={i} className={`scouting-dot ${g.result.toLowerCase()}`}
          title={`${g.date?.slice(5,10)} vs ${g.opp}: ${g.result} ${g.teamScore}–${g.oppScore}`}>
          {g.result === 'OTL' ? 'O' : g.result}
        </div>
      ))}
    </div>
  );
};



// Comparison row — green = CAR advantage
function CompareRow({ label, carVal, oppVal, higherBetter = true, fmt = v => v?.toFixed(2) ?? '—', tip }) {
  const c = Number(carVal) || 0, o = Number(oppVal) || 0;
  const carBetter = higherBetter ? c > o : c < o;
  const oppBetter = higherBetter ? o > c : o < c;
  const pct = (c + o) > 0 ? Math.round(c / (c + o) * 100) : 50;
  return (
    <div className="scouting-compare-row">
      <span className="scouting-compare-car"
        style={{color: carBetter ? 'var(--green)' : oppBetter ? 'var(--red-bright)' : 'var(--text-muted)'}}>
        {fmt(carVal)}
      </span>
      <div className="scouting-compare-mid">
        <div className="scouting-compare-label">
          {label}{tip && <InfoTip text={tip} position="above" />}
        </div>
        <div className="scouting-compare-bar">
          <div className="scouting-bar-car" style={{width:`${pct}%`}} />
          <div className="scouting-bar-opp" style={{width:`${100-pct}%`}} />
        </div>
      </div>
      <span className="scouting-compare-opp"
        style={{color: oppBetter ? 'var(--amber)' : carBetter ? 'var(--text-muted)' : 'var(--text-muted)'}}>
        {fmt(oppVal)}
      </span>
    </div>
  );
};



// Player table for one team
function PlayerTable({ players, loading, color }) {
  if (loading) return <div className="scouting-loading">Loading…</div>;
  if (!players?.skaters?.length) return <div className="scouting-empty">No data</div>;
  return (
    <div className="scouting-player-table">
      <div className="scouting-player-header">
        <span>Player</span><span>G</span><span>A</span><span>PTS</span>
      </div>
      {players.skaters.map((p, i) => (
        <div key={i} className="scouting-player-row">
          <span className="scouting-player-name">
            {p.name}<span className="scouting-player-pos">{p.pos}</span>
          </span>
          <span>{p.goals}</span>
          <span>{p.assists}</span>
          <span className="scouting-pts" style={{color}}>{p.points}</span>
        </div>
      ))}
      {players.goalies?.map((g, i) => {
        const gsax = computeGSAx(g.shotsAgainst, g.saves);
        const svFmt = g.savePct != null
          ? (g.savePct <= 1 ? g.savePct.toFixed(3) : (g.savePct/100).toFixed(3))
          : '—';
        return (
          <div key={`g${i}`} className="scouting-player-row scouting-goalie-row">
            <span className="scouting-player-name">{g.name}</span>
            <span style={{fontSize:10,color:'var(--text-dim)'}}>W{g.wins}</span>
            <span style={{fontSize:10}}>{svFmt}</span>
            <span style={{color: gsax?.color, fontSize:10}}>
              {gsax ? gsax.label : '—'}
              {gsax && <InfoTip text={gsax.note} position="above" />}
            </span>
          </div>
        );
      })}
    </div>
  );
};


export default function ScoutingTab({ oppAbbr, oppStanding, carStanding, isPlayoff }) {
  const gameType = isPlayoff ? 3 : 2;
  const carColor = 'var(--red-bright)';
  const oppColor = TEAM_COLORS[oppAbbr] || 'var(--text-muted)';

  // Fetch both teams' data
  const { data: carRecentGames } = useFetch(
    () => getTeamRecentGames('CAR', 10, isPlayoff), ['CAR', isPlayoff]
  );
  const { data: oppRecentGames } = useFetch(
    () => getTeamRecentGames(oppAbbr, 10, isPlayoff), [oppAbbr, isPlayoff]
  );
  const { data: carTopPlayers, loading: carPlayersLoading } = useFetch(
    () => getTeamTopPlayers('CAR', gameType), ['CAR', gameType]
  );
  const { data: oppTopPlayers, loading: oppPlayersLoading } = useFetch(
    () => getTeamTopPlayers(oppAbbr, gameType), [oppAbbr, gameType]
  );
  const { data: carStats } = useFetch(() => getTeamStats('CAR'), ['CAR']);
  const { data: oppStats } = useFetch(() => getTeamStats(oppAbbr), [oppAbbr]);


  const pctFmt  = v => v != null ? `${(v * 100).toFixed(1)}%` : '—';
  const gpgFmt  = v => v?.toFixed(2) ?? '—';
  const carGp   = carStanding?.gamesPlayed || 1;
  const oppGp   = oppStanding?.gamesPlayed || 1;

  return (
    <div className="scouting-wrap">
      {isPlayoff && (
        <div className="scouting-playoff-badge">🏒 Playoff stats · {SEASON_LABEL}</div>
      )}

      {/* Team headers */}
      <div className="scouting-teams-header">
        <div className="scouting-team-col">
          <TeamLogo abbr="CAR" size={32} />
          <span className="scouting-team-abbr" style={{color: carColor}}>CAR</span>
          {carStanding && (
            <span className="scouting-team-record">
              {carStanding.wins}–{carStanding.losses}–{carStanding.otLosses || 0}
            </span>
          )}
        </div>
        <div className="scouting-vs">vs</div>
        <div className="scouting-team-col">
          <TeamLogo abbr={oppAbbr} size={32} color={oppColor} />
          <span className="scouting-team-abbr" style={{color: oppColor}}>{oppAbbr}</span>
          {oppStanding && (
            <span className="scouting-team-record">
              {oppStanding.wins}–{oppStanding.losses}–{oppStanding.otLosses || 0}
            </span>
          )}
        </div>
      </div>

      {/* Key stat comparisons */}
      {(carStats || oppStats) && (
        <div className="scouting-section">
          <div className="scouting-section-label">Season comparison</div>
          <div className="scouting-compare-header">
            <span style={{color: carColor}}>CAR</span>
            <span />
            <span style={{color: oppColor}}>{oppAbbr}</span>
          </div>
          <CompareRow label="GF/GP" carVal={carStats?.goalsForPerGame} oppVal={oppStats?.goalsForPerGame} fmt={gpgFmt}
            tip="Goals for per game — higher is better" />
          <CompareRow label="GA/GP" carVal={carStats?.goalsAgainstPerGame} oppVal={oppStats?.goalsAgainstPerGame} fmt={gpgFmt}
            higherBetter={false} tip="Goals against per game — lower is better" />
          <CompareRow label="PP%" carVal={carStats?.powerPlayPct} oppVal={oppStats?.powerPlayPct} fmt={pctFmt}
            tip="Power play percentage" />
          <CompareRow label="PK%" carVal={carStats?.penaltyKillPct} oppVal={oppStats?.penaltyKillPct} fmt={pctFmt}
            tip="Penalty kill percentage" />
          <CompareRow label="SF/GP" carVal={carStats?.shotsForPerGame} oppVal={oppStats?.shotsForPerGame}
            fmt={v => v?.toFixed(1) ?? '—'} tip="Shots for per game — possession proxy" />
        </div>
      )}

      {/* Recent form — side by side */}
      <div className="scouting-section">
        <div className="scouting-section-label">Recent form (last {isPlayoff ? 'playoff ' : ''}10)</div>
        <div className="scouting-form-row">
          <div className="scouting-form-col">
            <div className="scouting-form-team" style={{color: carColor}}>CAR</div>
            <FormDots games={carRecentGames} />
            {carRecentGames && (
              <div className="scouting-form-summary">
                {carRecentGames.filter(g=>g.won).length}–
                {carRecentGames.filter(g=>!g.won&&g.result!=='OTL').length}–
                {carRecentGames.filter(g=>g.result==='OTL').length}
              </div>
            )}
          </div>
          <div className="scouting-form-col">
            <div className="scouting-form-team" style={{color: oppColor}}>{oppAbbr}</div>
            <FormDots games={oppRecentGames} />
            {oppRecentGames && (
              <div className="scouting-form-summary">
                {oppRecentGames.filter(g=>g.won).length}–
                {oppRecentGames.filter(g=>!g.won&&g.result!=='OTL').length}–
                {oppRecentGames.filter(g=>g.result==='OTL').length}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top players — side by side */}
      <div className="scouting-section">
        <div className="scouting-section-label">
          {isPlayoff ? 'Playoff ' : ''}Top skaters &amp; goalies
        </div>
        <div className="scouting-players-row">
          <div className="scouting-players-col">
            <div className="scouting-players-team" style={{color: carColor}}>CAR</div>
            <PlayerTable players={carTopPlayers} loading={carPlayersLoading} color={carColor} />
          </div>
          <div className="scouting-players-col">
            <div className="scouting-players-team" style={{color: oppColor}}>{oppAbbr}</div>
            <PlayerTable players={oppTopPlayers} loading={oppPlayersLoading} color={oppColor} />
          </div>
        </div>
      </div>
    </div>
  );
}

const SEASON_LABEL = '2025–26';
