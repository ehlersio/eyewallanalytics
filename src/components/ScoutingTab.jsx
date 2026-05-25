import { useFetch } from '../hooks/useFetch';
import {
  getTeamStats, getTeamRecentGames, getTeamTopPlayers,
  TEAM_COLORS,
} from '../utils/nhlApi';
import { computeGSAx, seasonPDO } from '../utils/advancedStats';
import TeamLogo from './TeamLogo';
import InfoTip from './InfoTip';
import './ScoutingTab.css';

export default function ScoutingTab({ oppAbbr, oppStanding, carStanding }) {
  const color = TEAM_COLORS[oppAbbr] || 'var(--text-muted)';

  const { data: recentGames, loading: formLoading } =
    useFetch(() => getTeamRecentGames(oppAbbr, 10), [oppAbbr]);

  const { data: topPlayers, loading: playersLoading } =
    useFetch(() => getTeamTopPlayers(oppAbbr), [oppAbbr]);

  const { data: oppStats } =
    useFetch(() => getTeamStats(oppAbbr), [oppAbbr]);

  const pdo = oppStats ? seasonPDO(oppStats) : null;

  // Recent form string e.g. "W W L OTL W"
  const formDots = (recentGames || []).slice(0, 10).reverse();

  // Head-to-head record this season from carStanding/oppStanding context
  const record = oppStanding
    ? `${oppStanding.wins}–${oppStanding.losses}–${oppStanding.otLosses || 0}`
    : '—';

  return (
    <div className="scouting-wrap">
      {/* Header */}
      <div className="scouting-header">
        <TeamLogo abbr={oppAbbr} size={40} color={color} />
        <div>
          <div className="scouting-team-name" style={{ color }}>{oppAbbr}</div>
          {oppStanding && (
            <div className="scouting-record">{record} · {oppStanding.points ?? '—'} pts</div>
          )}
        </div>
      </div>

      {/* Key season stats */}
      {oppStats && (
        <div className="scouting-section">
          <div className="scouting-section-label">Season stats</div>
          <div className="scouting-stat-grid">
            <StatCell label="GF/GP"  val={oppStats.goalsForPerGame?.toFixed(2)} />
            <StatCell label="GA/GP"  val={oppStats.goalsAgainstPerGame?.toFixed(2)} />
            <StatCell label="PP%"    val={oppStats.powerPlayPct   != null ? `${(oppStats.powerPlayPct * 100).toFixed(1)}%` : '—'} />
            <StatCell label="PK%"    val={oppStats.penaltyKillPct != null ? `${(oppStats.penaltyKillPct * 100).toFixed(1)}%` : '—'} />
            <StatCell label="SF/GP"  val={oppStats.shotsForPerGame?.toFixed(1)} />
            <StatCell label="SA/GP"  val={oppStats.shotsAgainstPerGame?.toFixed(1)} />
            {pdo && (
              <StatCell
                label="PDO"
                val={pdo.pdo}
                color={pdo.pdo > 102 ? 'var(--amber)' : pdo.pdo < 98 ? 'var(--blue-bright)' : null}
                tip="PDO = SH% + SV% × 100. League avg = 100. Far from 100 suggests luck component."
              />
            )}
            {oppStanding?.streakCode && (
              <StatCell
                label="Streak"
                val={`${oppStanding.streakCode}${oppStanding.streakCount}`}
                color={oppStanding.streakCode === 'W' ? 'var(--green)' : 'var(--red-bright)'}
              />
            )}
          </div>
        </div>
      )}

      {/* Recent form */}
      <div className="scouting-section">
        <div className="scouting-section-label">Recent form (last 10)</div>
        {formLoading ? (
          <div className="scouting-loading">Loading…</div>
        ) : (
          <div className="scouting-form-dots">
            {formDots.map((g, i) => (
              <div
                key={i}
                className={`scouting-dot ${g.result.toLowerCase()}`}
                title={`${g.date?.slice(5,10)} vs ${g.opp}: ${g.result} ${g.teamScore}–${g.oppScore}`}
              >
                {g.result === 'OTL' ? 'O' : g.result}
              </div>
            ))}
            {formDots.length === 0 && <span className="scouting-empty">No recent games</span>}
          </div>
        )}
        {recentGames && recentGames.length > 0 && (
          <div className="scouting-form-summary">
            {recentGames.filter(g => g.won).length}–
            {recentGames.filter(g => !g.won && g.result !== 'OTL').length}–
            {recentGames.filter(g => g.result === 'OTL').length} last {recentGames.length}
          </div>
        )}
      </div>

      {/* Top skaters */}
      <div className="scouting-section">
        <div className="scouting-section-label">Top skaters</div>
        {playersLoading ? (
          <div className="scouting-loading">Loading…</div>
        ) : topPlayers?.skaters?.length > 0 ? (
          <div className="scouting-player-table">
            <div className="scouting-player-header">
              <span>Player</span><span>G</span><span>A</span><span>PTS</span>
            </div>
            {topPlayers.skaters.map((p, i) => (
              <div key={i} className="scouting-player-row">
                <span className="scouting-player-name">
                  {p.name}
                  <span className="scouting-player-pos">{p.pos}</span>
                </span>
                <span>{p.goals}</span>
                <span>{p.assists}</span>
                <span className="scouting-pts" style={{ color }}>{p.points}</span>
              </div>
            ))}
          </div>
        ) : <div className="scouting-empty">No player data</div>}
      </div>

      {/* Goalies */}
      <div className="scouting-section">
        <div className="scouting-section-label">Goalies</div>
        {topPlayers?.goalies?.length > 0 ? (
          <div className="scouting-player-table">
            <div className="scouting-player-header">
              <span>Goalie</span><span>W</span><span>SV%</span><span>GSAx</span>
            </div>
            {topPlayers.goalies.map((g, i) => {
              const gsax = computeGSAx(g.shotsAgainst, g.saves);
              return (
                <div key={i} className="scouting-player-row">
                  <span className="scouting-player-name">{g.name}</span>
                  <span>{g.wins}</span>
                  <span>{g.savePct <= 1 ? g.savePct.toFixed(3) : (g.savePct / 100).toFixed(3)}</span>
                  <span style={{ color: gsax?.color }}>
                    {gsax ? gsax.label : '—'}
                    {gsax && <InfoTip text={gsax.note} position="above" />}
                  </span>
                </div>
              );
            })}
          </div>
        ) : <div className="scouting-empty">No goalie data</div>}
      </div>

      {/* Matchup comparison vs CAR */}
      {carStanding && oppStats && (
        <div className="scouting-section">
          <div className="scouting-section-label">
            CAR vs {oppAbbr} comparison
            <InfoTip text="Green = CAR advantage. Red = opponent advantage." position="above" />
          </div>
          <div className="scouting-compare-grid">
            <CompareRow
              label="GF/GP"
              car={carStanding.goalsForPerGame}
              opp={oppStats.goalsForPerGame}
              fmt={v => v?.toFixed(2)}
              higherBetter
            />
            <CompareRow
              label="GA/GP"
              car={carStanding.goalsAgainstPerGame}
              opp={oppStats.goalsAgainstPerGame}
              fmt={v => v?.toFixed(2)}
              higherBetter={false}
            />
            <CompareRow
              label="PP%"
              car={carStanding.powerPlayPct}
              opp={oppStats.powerPlayPct}
              fmt={v => v != null ? `${(v * 100).toFixed(1)}%` : '—'}
              higherBetter
            />
            <CompareRow
              label="PK%"
              car={carStanding.penaltyKillPct}
              opp={oppStats.penaltyKillPct}
              fmt={v => v != null ? `${(v * 100).toFixed(1)}%` : '—'}
              higherBetter
            />
            <CompareRow
              label="SF/GP"
              car={carStanding.shotsForPerGame}
              opp={oppStats.shotsForPerGame}
              fmt={v => v?.toFixed(1)}
              higherBetter
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCell({ label, val, color, tip }) {
  return (
    <div className="scouting-stat-cell">
      <div className="scouting-stat-label">
        {label}{tip && <InfoTip text={tip} position="above" />}
      </div>
      <div className="scouting-stat-val" style={{ color }}>{val ?? '—'}</div>
    </div>
  );
}

function CompareRow({ label, car, opp, fmt, higherBetter }) {
  const carN = Number(car) || 0;
  const oppN = Number(opp) || 0;
  const carBetter = higherBetter ? carN > oppN : carN < oppN;
  const oppBetter = higherBetter ? oppN > carN : oppN < carN;
  return (
    <div className="scouting-compare-row">
      <span
        className="scouting-compare-car"
        style={{ color: carBetter ? 'var(--green)' : oppBetter ? 'var(--red-bright)' : 'var(--text-muted)' }}
      >{fmt(car)}</span>
      <span className="scouting-compare-label">{label}</span>
      <span
        className="scouting-compare-opp"
        style={{ color: oppBetter ? 'var(--amber)' : carBetter ? 'var(--text-muted)' : 'var(--text-muted)' }}
      >{fmt(opp)}</span>
    </div>
  );
}
