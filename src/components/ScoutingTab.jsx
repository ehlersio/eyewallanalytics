import { useState, useRef } from 'react';
import { useFetch } from '../hooks/useFetch';
import {
  getTeamStats, getTeamStatsPlayoff, getTeamRecentGames, getTeamTopPlayers,
  TEAM_COLORS, TEAM_CONFIG,
} from '../utils/nhlApi';
import { computeGSAx } from '../utils/advancedStats';
import { getGoalieAnalytics, getTeamLines, getGameMatchup } from '../utils/supabaseClient';
import TeamLogo from './TeamLogo';
import InfoTip from './InfoTip';
import './ScoutingTab.css';
import { capture } from '../utils/analytics';

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
function PlayerTable({ players, loading, color, goalieAnalytics }) {
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
      {players.goalies?.length > 0 && (
        <>
          <div className="scouting-goalie-divider">Goalies</div>
          {players.goalies.map((g, i) => {
            // Use real GSAX from Supabase if available, fall back to estimate
            const seasonData  = goalieAnalytics?.[String(g.playerId)] || null;
            const realGsax    = seasonData?.gsax ?? null;
            const realGp      = seasonData?.gp ?? null;
            const estGsax     = computeGSAx(g.shotsAgainst, g.saves);
            const gsaxColor   = realGsax != null
              ? realGsax >= 5 ? 'var(--green)' : realGsax >= 0 ? 'var(--text-muted)' : 'var(--red-bright)'
              : estGsax?.color;
            const gsaxLabel   = realGsax != null
              ? `${realGsax > 0 ? '+' : ''}${realGsax}`
              : estGsax?.label ?? '—';
            const gsaxNote    = realGsax != null
              ? `Regular season goals saved above expected (MoneyPuck flurry-adjusted model). ${realGp ? `${realGp} GP this season.` : ''}`
              : (estGsax?.note || 'Goals saved above expected vs league avg .900 SV%');
            const svFmt = g.savePct != null && g.savePct > 0
              ? (g.savePct <= 1 ? g.savePct.toFixed(4) : (g.savePct / 100).toFixed(4))
              : '—';
            const gaaVal = g.gaa != null ? g.gaa.toFixed(2) : '—';
            const gaaColor = g.gaa != null
              ? g.gaa < 2.0 ? 'var(--green)'
              : g.gaa > 3.0 ? 'var(--red-bright)'
              : 'var(--text-muted)'
              : 'var(--text-muted)';
            return (
              <div key={`g${i}`} className="scouting-goalie-row">
                <span className="scouting-player-name scouting-goalie-name">{g.name}</span>
                <div className="scouting-goalie-stats">
                  <div className="scouting-goalie-stat">
                    <span className="scouting-goalie-label">W</span>
                    <span className="scouting-goalie-val">{g.wins}</span>
                  </div>
                  <div className="scouting-goalie-stat">
                    <span className="scouting-goalie-label">GAA</span>
                    <span className="scouting-goalie-val" style={{color: gaaColor}}>{gaaVal}</span>
                  </div>
                  <div className="scouting-goalie-stat">
                    <span className="scouting-goalie-label">SV%</span>
                    <span className="scouting-goalie-val">{svFmt}</span>
                  </div>
                  <div className="scouting-goalie-stat">
                    <span className="scouting-goalie-label">
                      GSAX <InfoTip text={gsaxNote} position="above" />
                    </span>
                    <span className="scouting-goalie-val" style={{color: gsaxColor}}>
                      {gsaxLabel}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};


// ── Goalie matchup card ──────────────────────────────────────
function GoalieMatchupCard({ carPlayers, oppPlayers, oppAbbr: _oppAbbr, oppColor }) {
  const carGoalie = carPlayers?.goalies?.[0];
  const oppGoalie = oppPlayers?.goalies?.[0];
  if (!carGoalie && !oppGoalie) return null;

  const renderGoalie = (g, isCAR, teamColor) => {
    if (!g) return <div className="gmc-goalie"><span className="scouting-empty">No data</span></div>;
    const sv = g.savePct != null && g.savePct > 0
      ? (g.savePct <= 1 ? g.savePct.toFixed(4) : (g.savePct / 100).toFixed(4)) : '—';
    const gaa = g.gaa != null ? g.gaa.toFixed(2) : '—';
    const gaaColor = g.gaa != null
      ? g.gaa < 2.0 ? 'var(--green)'
      : g.gaa > 3.0 ? 'var(--red-bright)'
      : 'var(--text-muted)' : 'var(--text-muted)';
    return (
      <div className={`gmc-goalie${isCAR ? ' gmc-car' : ''}`}>
        <div className="gmc-goalie-name" style={{color: teamColor}}>{g.name}</div>
        <div className="gmc-stats-row">
          <div className="gmc-stat"><div className="gmc-stat-val">{g.wins}</div><div className="gmc-stat-label">W</div></div>
          <div className="gmc-stat"><div className="gmc-stat-val" style={{color: gaaColor}}>{gaa}</div><div className="gmc-stat-label">GAA</div></div>
          <div className="gmc-stat"><div className="gmc-stat-val">{sv}</div><div className="gmc-stat-label">SV%</div></div>
        </div>
      </div>
    );
  };
  return (
    <div className="scouting-section">
      <div className="scouting-section-label">Goalie matchup</div>
      <div className="gmc-row">
        {renderGoalie(carGoalie, true, 'var(--team-primary)')}
        <div className="gmc-vs">vs</div>
        {renderGoalie(oppGoalie, false, oppColor)}
      </div>
    </div>
  );
}

// ── Team total projection ────────────────────────────────────
function TeamTotalCard({ carStats, oppStats, oppAbbr, isPlayoff }) {
  if (!carStats || !oppStats) return null;
  const carExp = (carStats.goalsForPerGame + oppStats.goalsAgainstPerGame) / 2;
  const oppExp = (oppStats.goalsForPerGame + carStats.goalsAgainstPerGame) / 2;
  const total  = +(carExp + oppExp).toFixed(1);
  return (
    <div className="scouting-section">
      <div className="scouting-section-label">
        Team total projection
        <InfoTip text="Average of each team's GF/GP and opponent's GA/GP. Informational only." position="above" />
      </div>
      <div className="ttc-wrap">
        <div className="ttc-score">
          <span style={{color:'var(--team-primary)'}}>{TEAM_CONFIG.abbr} {+carExp.toFixed(1)}</span>
          <span className="ttc-dash">–</span>
          <span>{+oppExp.toFixed(1)} {oppAbbr}</span>
        </div>
        <div className="ttc-total">Projected total goals: <strong>{total}</strong></div>
        <div className="ttc-meta">Based on {isPlayoff ? 'playoff' : 'regular season'} GF/GP + GA/GP</div>
      </div>
    </div>
  );
}

// ── Share canvas (off-screen 1080×1080) ──────────────────────
function ScoutingShareCanvas({ canvasRef, carStats, oppStats, carPlayers, oppPlayers,
  _carRecentGames, _oppRecentGames, oppAbbr, oppColor, isPlayoff, carLines, matchupText }) {
  if (!carStats || !oppStats) return null;

  const logoUrl    = abbr => `/nhl-assets/logos/nhl/svg/${abbr}_dark.svg`;
  const gpgFmt     = v => v?.toFixed(2) ?? '—';
  const pctFmt     = v => v != null ? `${(v * 100).toFixed(1)}%` : '—';

  // Team total projection
  // eslint-disable-next-line no-unused-vars
  const carExp = ((carStats.goalsForPerGame ?? 0) + (oppStats.goalsAgainstPerGame ?? 0)) / 2; // used in TeamTotalCard variant
  // eslint-disable-next-line no-unused-vars
  const oppExp = ((oppStats.goalsForPerGame ?? 0) + (carStats.goalsAgainstPerGame ?? 0)) / 2;
  return (
    <div className="sc-canvas" ref={canvasRef}>
      {/* Header */}
      <div className="sc-header">
        <img src="/eyewall-logo.svg" alt="EyeWall" className="sc-logo" onError={e=>{e.target.style.display='none';}} />
        <span className="sc-badge">{isPlayoff ? 'Playoff ' : ''}Scouting Report</span>
      </div>

      {/* Teams */}
      <div className="sc-teams">
        <div className="sc-team">
          <img src={logoUrl(TEAM_CONFIG.abbr)} alt={TEAM_CONFIG.abbr} className="sc-team-logo" onError={e=>{e.target.style.display='none';}} />
          <span className="sc-team-abbr car">CAR</span>
        </div>
        <span className="sc-vs">vs</span>
        <div className="sc-team">
          <img src={logoUrl(oppAbbr)} alt={oppAbbr} className="sc-team-logo" onError={e=>{e.target.style.display='none';}} />
          <span className="sc-team-abbr" style={{color: oppColor}}>{oppAbbr}</span>
        </div>
      </div>

      {/* Stats comparison */}
      <div className="sc-stats">
        {[
          { label: 'Goals For / GP',    car: gpgFmt(carStats.goalsForPerGame),    opp: gpgFmt(oppStats.goalsForPerGame),    carBetter: (carStats.goalsForPerGame??0) > (oppStats.goalsForPerGame??0) },
          { label: 'Goals Against / GP',car: gpgFmt(carStats.goalsAgainstPerGame),opp: gpgFmt(oppStats.goalsAgainstPerGame),carBetter: (carStats.goalsAgainstPerGame??99) < (oppStats.goalsAgainstPerGame??99) },
          { label: 'Power Play %',      car: pctFmt(carStats.powerPlayPct),       opp: pctFmt(oppStats.powerPlayPct),       carBetter: (carStats.powerPlayPct??0) > (oppStats.powerPlayPct??0) },
          { label: 'Penalty Kill %',    car: pctFmt(carStats.penaltyKillPct),     opp: pctFmt(oppStats.penaltyKillPct),     carBetter: (carStats.penaltyKillPct??0) > (oppStats.penaltyKillPct??0) },
          { label: 'Shots For / GP',    car: (carStats.shotsForPerGame??0).toFixed(1), opp: (oppStats.shotsForPerGame??0).toFixed(1), carBetter: (carStats.shotsForPerGame??0) > (oppStats.shotsForPerGame??0) },
        ].map((r, i) => (
          <div key={i} className="sc-stat-row">
            <span className={`sc-stat-val ${r.carBetter ? 'good' : 'muted'}`} style={{fontSize:17}}>{r.car}</span>
            <span className="sc-stat-label" style={{fontSize:11}}>{r.label}</span>
            <span className={`sc-stat-val ${!r.carBetter ? 'good-opp' : 'muted'}`} style={{fontSize:17}}>{r.opp}</span>
          </div>
        ))}
      </div>

      {/* AI Matchup Analysis — replaces team total + recent form */}
      {matchupText && (
        <div style={{margin:'0 52px 14px', padding:'12px 16px',
          background:'rgba(255,255,255,0.04)', borderRadius:10,
          borderLeft:`3px solid ${TEAM_CONFIG.displayColor}`}}>
          <div style={{fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em',
            color: TEAM_CONFIG.displayColor, marginBottom:8}}>⚡ AI Matchup Analysis</div>
          <div style={{fontSize:12, lineHeight:1.55, color:'rgba(255,255,255,0.65)',
            display:'-webkit-box', WebkitLineClamp:7, WebkitBoxOrient:'vertical', overflow:'hidden'}}>
            {matchupText}
          </div>
        </div>
      )}

      {/* Top players + goalies */}
      <div style={{display:'flex', gap:16, padding:'0 52px 14px'}}>
        {[
          { label: TEAM_CONFIG.abbr, color: TEAM_CONFIG.displayColor, players: carPlayers },
          { label: oppAbbr, color: oppColor, players: oppPlayers },
        ].map(({ label, color, players }) => (
          <div key={label} style={{flex:1, background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'12px 14px'}}>
            <div style={{fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em',
              color: color, marginBottom:8}}>{label} {isPlayoff ? 'Playoff ' : ''}Leaders</div>
            {players?.skaters?.slice(0,5).map((p, i) => (
              <div key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center',
                fontSize:13, padding:'4px 0', borderBottom:'0.5px solid rgba(255,255,255,0.05)'}}>
                <span style={{color:'rgba(255,255,255,0.8)', fontWeight:500}}>{p.name}</span>
                <span style={{color: color, fontWeight:700}}>{p.points}pts</span>
              </div>
            ))}
            {players?.goalies?.[0] && (
              <div style={{marginTop:6, padding:'4px 0', borderTop:'0.5px solid rgba(255,255,255,0.08)'}}>
                <div style={{fontSize:12, color:'rgba(255,255,255,0.55)', marginBottom:3}}>
                  {players.goalies[0].name}
                </div>
                <div style={{display:'flex', gap:10, fontSize:12}}>
                  <span>W {players.goalies[0].wins}</span>
                  <span style={{color: players.goalies[0].gaa < 2.5 ? '#4ade80' : players.goalies[0].gaa > 3.2 ? '#ef384c' : 'rgba(255,255,255,0.5)'}}>
                    GAA {players.goalies[0].gaa?.toFixed(2) ?? '—'}
                  </span>
                  <span>SV% {players.goalies[0].savePct?.toFixed(4) ?? '—'}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Line projections — CAR only, two-column: forward lines left, D pairs right */}
      {carLines?.lines?.length > 0 && (
        <div style={{padding:'0 52px 12px'}}>
          <div style={{fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em',
            color:'rgba(255,255,255,0.25)', marginBottom:8}}>
            CAR Lines · 5v5 {isPlayoff ? '(Playoffs)' : 'This Season'}
          </div>
          <div style={{display:'flex', gap:12}}>

            {/* Left column — forward lines */}
            <div style={{flex:3, display:'flex', flexDirection:'column', gap:5}}>
              {carLines.lines.slice(0, 4).map((line, i) => {
                const xgf  = line.xgfPct;
                const good = xgf != null && xgf >= 50;
                const POS_LABEL = { L: 'LW', LW: 'LW', C: 'C', R: 'RW', RW: 'RW', D: 'D' };
                return (
                  <div key={i} style={{display:'flex', alignItems:'center', gap:8,
                    padding:'6px 10px', background:'rgba(255,255,255,0.03)',
                    borderRadius:7, border:'0.5px solid rgba(255,255,255,0.06)'}}>
                    <span style={{fontSize:11, fontWeight:700, color: TEAM_CONFIG.displayColor, minWidth:42, flexShrink:0}}>
                      Line {i + 1}
                    </span>
                    <div style={{flex:1, display:'flex', gap:10, flexWrap:'wrap'}}>
                      {line.players.map((p, j) => (
                        <span key={j} style={{fontSize:12, color:'rgba(255,255,255,0.8)',
                          display:'flex', gap:3, alignItems:'baseline'}}>
                          <span style={{fontSize:10, color:'rgba(255,255,255,0.3)', fontWeight:700,
                            textTransform:'uppercase'}}>
                            {POS_LABEL[p.pos] || p.pos}
                          </span>
                          {p.name}
                        </span>
                      ))}
                    </div>
                    <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', flexShrink:0}}>
                      <span style={{fontSize:13, fontWeight:800,
                        color: xgf != null ? (good ? '#4ade80' : '#ef384c') : 'rgba(255,255,255,0.25)'}}>
                        {xgf != null ? `${xgf.toFixed(1)}%` : '—'}
                      </span>
                      <span style={{fontSize:9, color:'rgba(255,255,255,0.25)', letterSpacing:'0.05em'}}>xGF%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right column — D pairs */}
            {carLines.pairs?.length > 0 && (
              <div style={{flex:2, display:'flex', flexDirection:'column', gap:5}}>
                {carLines.pairs.slice(0, 3).map((pair, i) => {
                  const xgf  = pair.xgfPct;
                  const good = xgf != null && xgf >= 50;
                  return (
                    <div key={i} style={{display:'flex', alignItems:'center', gap:8,
                      padding:'6px 10px', background:'rgba(255,255,255,0.03)',
                      borderRadius:7, border:'0.5px solid rgba(255,255,255,0.06)'}}>
                      <span style={{fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.4)',
                        minWidth:38, flexShrink:0}}>
                        Pair {i + 1}
                      </span>
                      <div style={{flex:1, display:'flex', flexDirection:'column', gap:2}}>
                        {pair.players.map((p, j) => (
                          <span key={j} style={{fontSize:12, color:'rgba(255,255,255,0.75)'}}>
                            {p.name}
                          </span>
                        ))}
                      </div>
                      <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', flexShrink:0}}>
                        <span style={{fontSize:13, fontWeight:800,
                          color: xgf != null ? (good ? '#4ade80' : '#ef384c') : 'rgba(255,255,255,0.25)'}}>
                          {xgf != null ? `${xgf.toFixed(1)}%` : '—'}
                        </span>
                        <span style={{fontSize:9, color:'rgba(255,255,255,0.25)', letterSpacing:'0.05em'}}>xGF%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>
      )}

      {/* Footer */}
      <div className="sc-footer">
        <span>eyewallanalytics.com</span>
        <span>{TEAM_CONFIG.hashtags?.[0] || `#${TEAM_CONFIG.abbr}`}</span>
      </div>
    </div>
  );
}


// ── Line combinations section ──────────────────────────────────────────────

// Position display: NHL API codes → readable labels
const POS_LABEL = { L: 'LW', LW: 'LW', C: 'C', R: 'RW', RW: 'RW', D: 'D' };

const XGF_TIP =
  'Expected Goals For % (xGF%) — share of total expected goals generated while this unit ' +
  'was on the ice at 5-on-5. Above 50% means your team outchanced the opponent when these players ' +
  'were together. Based on shot location and type, not just shot count.';

const TOI_TIP =
  'Minutes this unit has played together at 5-on-5 this season. More minutes = more reliable ' +
  'xGF% number. Units with fewer minutes may reflect recent line shuffles.';

const LINES_TIP =
  'Forward lines and defence pairs inferred from 5-on-5 shift co-occurrence data. ' +
  'When inference data is complete, xGF% and TOI are live from this season. ' +
  'Static lineups (shown when inference is unavailable) reflect the most recent known lines.';

function XgfBadge({ pct }) {
  if (pct == null) return <span className="sc-line-xgf sc-line-xgf-null">—</span>;
  const good = pct >= 50;
  return (
    <span className={`sc-line-xgf ${good ? 'sc-line-xgf-good' : 'sc-line-xgf-bad'}`}>
      {pct.toFixed(1)}%
    </span>
  );
}

function LineUnit({ unit, label, color, _isDefence }) {
  const toiLabel = unit.toiMins != null ? `${unit.toiMins} min together` : null;
  return (
    <div className={`sc-line-unit${unit.isStatic ? ' sc-line-static' : ''}`}>
      <div className="sc-line-header">
        <span className="sc-line-label" style={{ color }}>{label}</span>
        <div className="sc-line-meta">
          {toiLabel && (
            <span className="sc-line-toi">
              {toiLabel}
              <InfoTip text={TOI_TIP} position="above" />
            </span>
          )}
          <span className="sc-line-xgf-wrap">
            <span className="sc-line-xgf-label">xGF%</span>
            <XgfBadge pct={unit.xgfPct} />
            <InfoTip text={XGF_TIP} position="above" />
          </span>
        </div>
      </div>
      <div className="sc-line-players">
        {unit.players.map((p, i) => (
          <span key={i} className="sc-line-player">
            <span className="sc-line-pos">{POS_LABEL[p.pos] || p.pos}</span>
            {p.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function LinesSection({ lines, color, isPlayoff, abbr }) {
  if (!lines) return null;
  const { lines: fLines, pairs: dPairs, _isInferred } = lines;
  const lineLabels = ['Line 1', 'Line 2', 'Line 3', 'Line 4'];
  const pairLabels = ['Pair 1', 'Pair 2', 'Pair 3'];
  const hasAnyStatic = [...(fLines || []), ...(dPairs || [])].some(u => u.isStatic);
  return (
    <div className="scouting-section">
      <div className="scouting-section-label">
        {abbr} lines
        {isPlayoff && <span className="sc-lines-playoff-badge">Playoffs</span>}
        <InfoTip text={LINES_TIP} position="above" />
      </div>
      {hasAnyStatic && (
        <div className="sc-lines-note">
          ⚡ Live xGF% where available · lineup from known line combinations
        </div>
      )}
      <div className="sc-lines-note sc-lines-opponent-note">
        Opponent lines available when 32-team data is enabled
      </div>
      {fLines.length > 0 && (
        <div className="sc-lines-group">
          {fLines.map((u, i) => (
            <LineUnit key={i} unit={u} label={lineLabels[i] || `Line ${u.rank}`} color={color} />
          ))}
        </div>
      )}
      {dPairs.length > 0 && (
        <div className="sc-lines-group sc-lines-group-d">
          <div className="sc-lines-subheader">Defence pairs</div>
          {dPairs.map((u, i) => (
            <LineUnit key={i} unit={u} label={pairLabels[i] || `Pair ${u.rank}`} color={color} isDefence />
          ))}
        </div>
      )}
    </div>
  );
}


export default function ScoutingTab({ oppAbbr, oppStanding, carStanding, isPlayoff, gameId }) {
  const gameType = isPlayoff ? 3 : 2;
  const carColor = 'var(--team-primary)';
  const oppColor = TEAM_COLORS[oppAbbr] || 'var(--text-muted)';

  const canvasRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [canvasMounted, setCanvasMounted] = useState(false);

  const { data: carRecentGames } = useFetch(
    () => getTeamRecentGames(TEAM_CONFIG.abbr, 10, isPlayoff), [TEAM_CONFIG.abbr, isPlayoff]
  );
  const { data: oppRecentGames } = useFetch(
    () => getTeamRecentGames(oppAbbr, 10, isPlayoff), [oppAbbr, isPlayoff]
  );
  const { data: carTopPlayers, loading: carPlayersLoading } = useFetch(
    () => getTeamTopPlayers(TEAM_CONFIG.abbr, gameType), [TEAM_CONFIG.abbr, gameType]
  );
  const { data: oppTopPlayers, loading: oppPlayersLoading } = useFetch(
    () => getTeamTopPlayers(oppAbbr, gameType), [oppAbbr, gameType]
  );
  const { data: carStats } = useFetch(() => getTeamStats(TEAM_CONFIG.abbr), [TEAM_CONFIG.abbr]);
  const { data: oppStats } = useFetch(() => getTeamStats(oppAbbr), [oppAbbr]);
  const { data: carPoStats } = useFetch(
    () => isPlayoff ? getTeamStatsPlayoff(TEAM_CONFIG.abbr) : Promise.resolve(null),
    [TEAM_CONFIG.abbr, 'po', isPlayoff]
  );
  const { data: oppPoStats } = useFetch(
    () => isPlayoff ? getTeamStatsPlayoff(oppAbbr) : Promise.resolve(null),
    [oppAbbr, 'po', isPlayoff]
  );
  const { data: goalieAnalytics } = useFetch(() => getGoalieAnalytics());
  const { data: carLines } = useFetch(() => getTeamLines(TEAM_CONFIG.abbr, 20252026, gameType), [TEAM_CONFIG.abbr, gameType]);
  const { data: matchupData } = useFetch(() => getGameMatchup(gameId), [gameId]);

  // Use playoff stats when available, fall back to regular season
  const compCarStats = isPlayoff ? (carPoStats || carStats) : carStats;
  const compOppStats = isPlayoff ? (oppPoStats || oppStats) : oppStats;

  const pctFmt = v => v != null ? `${(v * 100).toFixed(1)}%` : '—';
  const gpgFmt = v => v?.toFixed(2) ?? '—';

  const handleExport = async () => {
    setExporting(true);
    if (!canvasMounted) {
      setCanvasMounted(true);
      await new Promise(r => setTimeout(r, 100));
    }
    try {
      const { toPng } = await import('html-to-image');
      const node = canvasRef.current;
      if (!node) return;
      const dataUrl = await toPng(node, {
        width: 1080, height: 1080, skipFonts: true,
        imagePlaceholder: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        style: { position: 'static', left: '0', top: '0' },
      });
      const link = document.createElement('a');
      link.download = `EyeWall-Scouting-${TEAM_CONFIG.abbr}-vs-${oppAbbr}.png`;
      link.href = dataUrl;
      link.click();
      capture('scouting_card_exported', { opponent: oppAbbr, isPlayoff: !!isPlayoff });
    } catch (e) { console.error('Scouting export failed:', e); }
    finally { setExporting(false); }
  };

  return (
    <>
    <div className="scouting-wrap">
      {/* AI Matchup Analysis */}
      {matchupData?.text && (
        <div className="sc-matchup-section">
          <div className="sc-matchup-label">⚡ AI Matchup Analysis</div>
          <div className="sc-matchup-text">{matchupData.text}</div>
          <div className="sc-matchup-footer">Generated by EyeWall AI · Updates nightly</div>
        </div>
      )}

      {isPlayoff && (
        <div className="scouting-playoff-badge">🏒 Playoff stats · {SEASON_LABEL}</div>
      )}

      {/* Team headers */}
      <div className="scouting-teams-header">
        <div className="scouting-team-col">
          <TeamLogo abbr={TEAM_CONFIG.abbr} size={32} />
          <span className="scouting-team-abbr" style={{color: carColor}}>{TEAM_CONFIG.abbr}</span>
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

      {/* Season/Playoff comparison — uses playoff stats when isPlayoff */}
      {(compCarStats || compOppStats) && (
        <div className="scouting-section">
          <div className="scouting-section-label">
            {isPlayoff ? 'Playoff' : 'Season'} comparison
          </div>
          <div className="scouting-compare-header">
            <span style={{color: carColor}}>{TEAM_CONFIG.abbr}</span>
            <span />
            <span style={{color: oppColor}}>{oppAbbr}</span>
          </div>
          <CompareRow label="GF/GP" carVal={compCarStats?.goalsForPerGame} oppVal={compOppStats?.goalsForPerGame} fmt={gpgFmt}
            tip="Goals for per game — higher is better" />
          <CompareRow label="GA/GP" carVal={compCarStats?.goalsAgainstPerGame} oppVal={compOppStats?.goalsAgainstPerGame} fmt={gpgFmt}
            higherBetter={false} tip="Goals against per game — lower is better" />
          <CompareRow label="PP%" carVal={compCarStats?.powerPlayPct} oppVal={compOppStats?.powerPlayPct} fmt={pctFmt}
            tip="Power play percentage" />
          <CompareRow label="PK%" carVal={compCarStats?.penaltyKillPct} oppVal={compOppStats?.penaltyKillPct} fmt={pctFmt}
            tip="Penalty kill percentage" />
          <CompareRow label="SF/GP" carVal={compCarStats?.shotsForPerGame} oppVal={compOppStats?.shotsForPerGame}
            fmt={v => v?.toFixed(1) ?? '—'} tip="Shots for per game — possession proxy" />
          {isPlayoff && compCarStats?.faceoffWinPct != null && (
            <CompareRow label="FO Win%" carVal={compCarStats?.faceoffWinPct} oppVal={compOppStats?.faceoffWinPct}
              fmt={pctFmt} tip="Faceoff win percentage in playoffs" />
          )}
        </div>
      )}

      {/* Goalie matchup */}
      <GoalieMatchupCard
        carPlayers={carTopPlayers}
        oppPlayers={oppTopPlayers}
        oppAbbr={oppAbbr}
        oppColor={oppColor}
      />

      {/* Team total projection */}
      <TeamTotalCard
        carStats={compCarStats}
        oppStats={compOppStats}
        oppAbbr={oppAbbr}
        isPlayoff={isPlayoff}
      />

      {/* Recent form */}
      <div className="scouting-section">
        <div className="scouting-section-label">Recent form (last {isPlayoff ? 'playoff ' : ''}10)</div>
        <div className="scouting-form-row">
          <div className="scouting-form-col">
            <div className="scouting-form-team" style={{color: carColor}}>{TEAM_CONFIG.abbr}</div>
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

      {/* Top players */}
      <div className="scouting-section">
        <div className="scouting-section-label">
          {isPlayoff ? 'Playoff ' : ''}Top skaters &amp; goalies
        </div>
        <div className="scouting-players-row">
          <div className="scouting-players-col">
            <div className="scouting-players-team" style={{color: carColor}}>{TEAM_CONFIG.abbr}</div>
            <PlayerTable players={carTopPlayers} loading={carPlayersLoading} color={carColor} goalieAnalytics={goalieAnalytics} />
          </div>
          <div className="scouting-players-col">
            <div className="scouting-players-team" style={{color: oppColor}}>{oppAbbr}</div>
            <PlayerTable players={oppTopPlayers} loading={oppPlayersLoading} color={oppColor} goalieAnalytics={goalieAnalytics} />
          </div>
        </div>
      </div>

      {/* Line combinations */}
      {carLines && (
        <LinesSection lines={carLines} color={carColor} isPlayoff={isPlayoff} abbr={TEAM_CONFIG.abbr} />
      )}

      {/* Export button */}
      <div className="scouting-section scouting-export-row">
        <button className="scouting-export-btn" onClick={handleExport} disabled={exporting}>
          {exporting ? '⏳ Saving…' : '📸 Save Scouting Card'}
        </button>
      </div>
    </div>

    {/* Off-screen canvas for export — only mounted when user clicks Save */}
    {canvasMounted && (
    <ScoutingShareCanvas
        canvasRef={canvasRef}
        carStats={compCarStats}
        oppStats={compOppStats}
        carPlayers={carTopPlayers}
        oppPlayers={oppTopPlayers}
        carRecentGames={carRecentGames}
        oppRecentGames={oppRecentGames}
        oppAbbr={oppAbbr}
        oppColor={oppColor}
        isPlayoff={isPlayoff}
        carLines={carLines}
        matchupText={matchupData?.text || null}
      />
    )}
    </>
  );
}

const SEASON_LABEL = '2025–26';
