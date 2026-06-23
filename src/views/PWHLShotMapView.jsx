// views/PWHLShotMapView.jsx
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useFetch, usePoll } from '../hooks/useFetch';
import {
  fetchPWHLShots, fetchPWHLRoster, fetchPWHLSchedule, fetchPWHLPBP,
  fetchPWHLToday, fetchPWHLLive,
  pbpByType,
  PWHL_TEAM_CONFIG, PWHL_TEAM_ID,
} from '../utils/pwhlApi';
import { PWHL_CURRENT_SEASON, PWHL_TEAM_MAP } from '../utils/pwhlConfig';
import { usePWHLDevGame } from '../utils/PWHLDevGameContext';
import {
  usePWHLGameEvents,
  PWHLGoalPopup, PWHLPenaltyPopup, PWHLWinPopup, PWHLPuckDropPopup,
  PWHLLiveInsights,
} from '../components/PWHLGameEvents';
import { HatTrickPopup } from '../components/GameEvents';
import { usePWHLPeriodSummary, usePWHLGameSummary } from '../hooks/usePWHLPeriodSummary';
import PWHLPeriodSummary from '../components/PWHLPeriodSummary';
import { usePeriodSummaryContext } from '../utils/PeriodSummaryContext';
import IceRink from '../components/IceRink';
import TeamLogo from '../components/TeamLogo';
import { MetCard } from '../components/StatBar';
import InfoTip from '../components/InfoTip';
import './ShotMapView.css';

const SEASONS = [
  { id: 8, label: '2025-26' },
  { id: 5, label: '2024-25' },
  { id: 1, label: '2023-24' },
];

const TEAM_CODES = {1:'BOS',2:'MIN',3:'MTL',4:'NY',5:'OTT',6:'TOR',8:'SEA',9:'VAN'};

// ── Shot adapters ─────────────────────────────────────────────

function mapEventType(t) {
  if (t === 'goal')                                return 'goal';
  if (t === 'blocked_shot' || t === 'blocked-shot') return 'blocked-shot';
  return 'shot-on-goal';
}

/** Adapt a row from pwhl_shot_events (our team) → IceRink event */
function adaptOurShot(row, playerMap) {
  const secs = row.time_seconds || 0;
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  let x = parseFloat(row.x_norm);
  let y = parseFloat(row.y_norm);
  if (x < 0) { x = -x; y = -y; }
  x = Math.min(x, 99);
  y = Math.max(-42, Math.min(42, y));
  return {
    id: row.id, x, y,
    type:         mapEventType(row.event_type),
    isCanes:      true,       // our team = highlighted colour
    period:       row.period_id,
    timeInPeriod: `${mm}:${ss}`,
    shooterName:  playerMap[row.shooter_id] || null,
    gameId:       row.game_id,
    shotType:     row.shot_type || null,
  };
}

/**
 * Adapt a row from opp_shots (all shots for the game, from Worker).
 * x_norm is negative for shots attacking the left net, positive for right.
 * We fold to positive x = attacking zone, same as our shots, but mark isCanes=false.
 */
function adaptOppShot(row) {
  const secs = row.time_seconds || 0;
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  let x = parseFloat(row.x_norm);
  let y = parseFloat(row.y_norm);
  // Fold to attacking direction: negative x means attacking left net in pwhl coords
  if (x > 0) { x = -x; y = -y; }   // flip so attacking direction = positive x
  x = Math.abs(x);
  x = Math.min(x, 99);
  y = Math.max(-42, Math.min(42, y));
  return {
    id:           `opp-${row.shooter_id}-${row.time_seconds}`,
    x, y,
    type:         mapEventType(row.event_type),
    isCanes:      false,      // opponent = muted colour
    period:       row.period_id,
    timeInPeriod: `${mm}:${ss}`,
    shooterName:  row.shooter_name || null,
    gameId:       null,
    shotType:     null,
  };
}

/**
 * Adapt a live shot/goal event from /pwhl/live/:gameId → IceRink event.
 * Live events use raw x/y coords (not pre-normalised like stored shot events).
 */
function adaptLiveShot(ev, isOurTeam) {
  const CANVAS_W = 600.0, CANVAS_H = 300.0;
  const xRaw = ev.x, yRaw = ev.y;
  if (xRaw == null || yRaw == null) return null;
  const period = ev.period || 1;
  // Normalise to NHL rink coords (same transform as pwhl_shot_events.py)
  let xNorm = (xRaw / CANVAS_W - 0.5) * 200;
  let yNorm = (yRaw / CANVAS_H - 0.5) * 85;
  // Home attacks right in odd periods
  const homeAttacksRight = period % 2 === 1;
  const attackingRight   = isOurTeam ? homeAttacksRight : !homeAttacksRight;
  if (!attackingRight) { xNorm = -xNorm; yNorm = -yNorm; }
  // Fold to attacking direction (positive x)
  if (xNorm < 0) { xNorm = -xNorm; yNorm = -yNorm; }
  xNorm = Math.min(Math.abs(xNorm), 99);
  yNorm = Math.max(-42, Math.min(42, yNorm));

  const type = ev.isGoal || ev.eventType === 'goal'
    ? 'goal'
    : ev.eventType === 'blocked_shot' ? 'blocked-shot'
    : 'shot-on-goal';

  const shooter = ev.scorer || ev.scoredBy || ev.shooter;
  const name    = shooter ? `${shooter.firstName || ''} ${shooter.lastName || ''}`.trim() : null;

  return {
    id:           `live-${ev.eventType}-${ev.period}-${ev.timeSeconds}`,
    x:            xNorm,
    y:            yNorm,
    type,
    isCanes:      isOurTeam,
    period:       ev.period,
    timeInPeriod: ev.time || '0:00',
    shooterName:  name || null,
    gameId:       null,
    shotType:     ev.shotType || null,
  };
}

function pLabel(n) {
  if (!n) return '—';
  if (n <= 3) return `P${n}`;
  if (n === 4) return 'OT';
  return `OT${n - 3}`;
}

function distFromGoal(x, y) {
  return Math.sqrt(Math.pow(Math.abs(x) - 89, 2) + y * y);
}

// ── Game chips ────────────────────────────────────────────────

function GameChip({ game, teamId, selected, onClick }) {
  const isHome  = game.home_team_id === teamId;
  const my      = isHome ? game.home_score : game.away_score;
  const op      = isHome ? game.away_score : game.home_score;
  const oppId   = isHome ? game.away_team_id : game.home_team_id;
  const oppAbbr = TEAM_CODES[oppId] || String(oppId);
  const oppTeam = PWHL_TEAM_MAP[oppAbbr];
  const won     = my > op;
  return (
    <button className={`game-chip${selected ? ' game-chip-active' : ''}`} onClick={onClick}>
      <TeamLogo abbr={oppAbbr} sport="pwhl" size={18} color={oppTeam?.displayColor} />
      <span className="game-chip-opp">{oppAbbr}</span>
      <span className="game-chip-score" style={{ color: won ? 'var(--green)' : 'var(--red-bright)' }}>
        {won ? 'W' : 'L'} {my}–{op}
      </span>
      <span className="game-chip-venue">{isHome ? 'H' : 'A'}</span>
    </button>
  );
}

function GameChipsRow({ games, teamId, selectedGameId, onSelect, onAll }) {
  const attachWheel = el => {
    if (!el) return;
    el.addEventListener('wheel', e => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }, { passive: false });
  };
  return (
    <div className="game-chips-wrap" ref={attachWheel}>
      <button className={`game-chip game-chip-all${!selectedGameId ? ' game-chip-active' : ''}`} onClick={onAll}>
        All {games.length}
      </button>
      {games.map(g => (
        <GameChip key={g.game_id} game={g} teamId={teamId}
          selected={selectedGameId === g.game_id}
          onClick={() => onSelect(g.game_id)} />
      ))}
    </div>
  );
}

// ── Live game chip ────────────────────────────────────────────

function LiveGameChip({ liveGame, teamId, onSelect, selected }) {
  if (!liveGame) return null;
  const isHome  = liveGame.homeTeamId === teamId;
  const myScore = isHome ? liveGame.homeScore : liveGame.awayScore;
  const opScore = isHome ? liveGame.awayScore : liveGame.homeScore;
  const oppCode = isHome ? liveGame.awayTeamCode : liveGame.homeTeamCode;
  const oppTeam = PWHL_TEAM_MAP[oppCode];
  return (
    <button
      className={`game-chip game-chip-live${selected ? ' game-chip-active' : ''}`}
      onClick={onSelect}
      style={{ borderColor: 'var(--red-bright)', color: 'var(--red-bright)' }}
    >
      <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.05em' }}>🔴 LIVE</span>
      <TeamLogo abbr={oppCode} sport="pwhl" size={18} color={oppTeam?.displayColor} />
      <span className="game-chip-opp">{oppCode}</span>
      <span className="game-chip-score">{myScore}–{opScore}</span>
    </button>
  );
}

// ── Stat Drill Popup ──────────────────────────────────────────

function StatDrillPopup({ drillStat, onClose, abbr, oppAbbr, color }) {
  const [tab, setTab] = useState('car');
  if (!drillStat) return null;

  const carRows = drillStat.carRows ?? drillStat.rows ?? [];
  const oppRows = drillStat.oppRows ?? [];
  const hasOpp  = drillStat.oppRows !== undefined;
  const rows    = tab === 'car' ? carRows : oppRows;
  const teamLabel = tab === 'car' ? abbr : (oppAbbr || 'OPP');

  const allPeriods = [...new Set(
    [...carRows, ...oppRows].flatMap(r => Object.keys(r.periods || {}))
  )].sort((a, b) => {
    const sk = l => {
      if (l === 'OT') return 4; if (l === 'SO') return 5;
      const m = l.match(/^(\d+)OT$/); if (m) return 3 + parseInt(m[1]);
      return parseInt(l.replace(/\D/g, '')) || 99;
    };
    return sk(a) - sk(b);
  });
  const periods    = allPeriods.length > 0 ? allPeriods : ['P1', 'P2', 'P3'];
  const periodTots = periods.reduce((acc, p) => {
    acc[p] = rows.reduce((s, r) => s + (r.periods?.[p] || 0), 0);
    return acc;
  }, {});
  const grandTotal = rows.reduce((s, r) => s + (r.total || 0), 0);

  return (
    <div className="drill-overlay" onClick={onClose}>
      <div className="drill-popup" onClick={e => e.stopPropagation()}>
        <div className="drill-header">
          <span className="drill-title">{drillStat.label}</span>
          <button className="drill-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {hasOpp && (
          <div className="drill-tabs">
            <button className={`drill-tab${tab === 'car' ? ' active' : ''}`} onClick={() => setTab('car')}>
              <TeamLogo abbr={abbr} sport="pwhl" size={18} /> {abbr}
            </button>
            <button className={`drill-tab${tab === 'opp' ? ' active' : ''}`} onClick={() => setTab('opp')}>
              <TeamLogo abbr={oppAbbr} sport="pwhl" size={18} /> {oppAbbr || 'OPP'}
            </button>
          </div>
        )}

        <div className="drill-body">
          {drillStat.type === 'shots' && (
            rows.length === 0
              ? <div className="drill-empty">No {teamLabel} data for this game.</div>
              : (
                <div className="drill-table">
                  <div className="drill-col-header shots"
                    style={{ gridTemplateColumns: `1fr ${periods.map(() => '34px').join(' ')} 42px` }}>
                    <span>Player</span>
                    {periods.map(p => <span key={p}>{p}</span>)}
                    <span>Total</span>
                  </div>
                  {rows.map((r, i) => (
                    <div key={i} className="drill-row-grid shots"
                      style={{ gridTemplateColumns: `1fr ${periods.map(() => '34px').join(' ')} 42px` }}>
                      <span className="drill-name">{r.name}</span>
                      {periods.map(p => (
                        <span key={p} className={`drill-val${r.periods?.[p] ? '' : ' dim'}`}>
                          {r.periods?.[p] || '—'}
                        </span>
                      ))}
                      <span className="drill-val total">{r.total}</span>
                    </div>
                  ))}
                  {grandTotal > 0 && (
                    <div className="drill-row-grid shots drill-totals-row"
                      style={{ gridTemplateColumns: `1fr ${periods.map(() => '34px').join(' ')} 42px` }}>
                      <span className="drill-name drill-totals-label">Total</span>
                      {periods.map(p => (
                        <span key={p} className={`drill-val total${periodTots[p] ? '' : ' dim'}`}>
                          {periodTots[p] || '—'}
                        </span>
                      ))}
                      <span className="drill-val total">{grandTotal}</span>
                    </div>
                  )}
                </div>
              )
          )}

          {drillStat.type === 'faceoff' && (
            <div className="drill-table">
              {rows.length === 0
                ? <div className="drill-empty">No faceoff data for this game.</div>
                : (
                  <>
                    <div className="drill-col-header fo">
                      <span>Player</span><span>Won</span><span>Lost</span><span>Win%</span>
                    </div>
                    {rows.map((r, i) => (
                      <div key={i} className="drill-row-grid fo">
                        <span className="drill-name">{r.name}</span>
                        <span className="drill-val green">{r.totalWon}</span>
                        <span className="drill-val red">{r.totalLost}</span>
                        <span className="drill-val">
                          {r.total > 0 ? `${Math.round(r.totalWon / r.total * 100)}%` : '—'}
                        </span>
                      </div>
                    ))}
                  </>
                )
              }
            </div>
          )}

          {drillStat.type === 'ppanalysis' && (
            <PPAnalysisPanel drillStat={drillStat} abbr={abbr} color={color} />
          )}

          {drillStat.type === 'pkanalysis' && (
            <PKAnalysisPanel drillStat={drillStat} abbr={abbr} color={color} />
          )}

          {drillStat.type === 'penalties' && (
            <div className="drill-table">
              {rows.length === 0
                ? <div className="drill-empty">No {teamLabel} penalties.</div>
                : rows.map((r, i) => (
                  <div key={i} className="drill-row pen-row">
                    <div className="pen-row-top">
                      <span className="drill-name">{r.name}</span>
                      <span className="pen-badge"
                        style={{
                          background: r.minutes <= 2 ? 'rgba(251,191,36,0.15)' : 'rgba(248,113,113,0.2)',
                          color:      r.minutes <= 2 ? '#fbbf24'               : '#f87171',
                        }}>
                        {r.minutes} min
                      </span>
                      <span className="pen-period">{r.period}</span>
                    </div>
                    <div className="pen-row-bottom">
                      <span className="pen-desc">{r.description}</span>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shot Attempts panel ───────────────────────────────────────

function ShotAttemptsPanel({ ourShots, oppShotRows, abbr, oppAbbr, color, goalieStats, teamId }) {
  const carSOG     = ourShots.filter(e => e.type === 'shot-on-goal' || e.type === 'goal').length;
  const carBlocked = ourShots.filter(e => e.type === 'blocked-shot').length;
  const carCorsi   = carSOG + carBlocked;
  const carFenwick = carSOG;

  const oppSOG     = oppShotRows.filter(r => r.event_type === 'shot' || r.event_type === 'goal').length;
  const oppBlocked = oppShotRows.filter(r => r.event_type === 'blocked_shot').length;
  const oppCorsi   = oppSOG + oppBlocked;
  const oppFenwick = oppSOG;

  const cfPct = carCorsi + oppCorsi > 0 ? Math.round(carCorsi  / (carCorsi  + oppCorsi)  * 100) : null;
  const ffPct = carFenwick + oppFenwick > 0 ? Math.round(carFenwick / (carFenwick + oppFenwick) * 100) : null;

  // xG from coordinates
  let xg = 0;
  ourShots.forEach(e => { xg += Math.max(Math.exp(-distFromGoal(e.x, e.y) / 15) * 0.55, 0.02); });
  xg = parseFloat(xg.toFixed(2));

  const goals      = ourShots.filter(e => e.type === 'goal').length;
  const luckDelta  = parseFloat((goals - xg).toFixed(2));
  const luckColor  = luckDelta > 0.5 ? 'var(--amber)' : luckDelta < -0.5 ? 'var(--blue-bright)' : 'var(--text-muted)';
  const luckLabel  = luckDelta >= 0 ? `+${luckDelta}G` : `${luckDelta}G`;

  // Real PDO = SH% + SV% (×100 each, summed)
  const shPct = carSOG > 0 ? parseFloat((goals / carSOG * 100).toFixed(1)) : 0;
  const ourGoalie = (goalieStats || []).find(g => g.team_id === teamId);
  const svPct = ourGoalie && (ourGoalie.saves + (ourGoalie.goals_against || 0)) > 0
    ? ourGoalie.saves / (ourGoalie.saves + (ourGoalie.goals_against || 0)) * 100
    : null;
  const pdo = svPct != null ? parseFloat((shPct + svPct).toFixed(1)) : null;
  const pdoColor = pdo != null
    ? pdo > 103 ? 'var(--amber)' : pdo < 97 ? 'var(--blue-bright)' : 'var(--text-muted)'
    : 'var(--text-muted)';

  const Row = ({ label, car, opp, help }) => {
    const cn = Number(car) || 0, on = Number(opp) || 0, tot = cn + on || 1;
    return (
      <div className="sv-row">
        <div className="sv-label-wrap">
          <span className="sv-label">{label}</span>
          <InfoTip text={help} position="above" />
        </div>
        <span className="sv-num" style={{ color: color || 'var(--team-primary)' }}>{car ?? '—'}</span>
        <div className="sv-bar-wrap">
          <div className="sv-fill" style={{ width: `${Math.round(cn / tot * 100)}%`, background: color || 'var(--team-primary)' }} />
          <div className="sv-fill muted" style={{ width: `${Math.round(on / tot * 100)}%` }} />
        </div>
        <span className="sv-num muted">{opp ?? '—'}</span>
      </div>
    );
  };

  const StatChip = ({ label, value, color, help }) => (
    <div className="adv-chip" onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <span className="adv-chip-label">{label}</span>
        <InfoTip text={help} position="above" />
      </div>
      <span className="adv-chip-val" style={{ color }}>{value}</span>
    </div>
  );

  return (
    <div className="card shot-volume-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="sec-label" style={{ marginBottom: 0 }}>Shot Attempts</div>
        <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Corsi = all attempts · Fenwick excludes blocks</span>
      </div>

      <div className="sv-header">
        <span className="sv-team" style={{ color: color || 'var(--team-primary)' }}>{abbr}</span>
        <span className="sv-diff" style={{ color: cfPct != null && cfPct >= 50 ? 'var(--green)' : 'var(--red-bright)' }}>
          {cfPct != null ? `${cfPct >= 50 ? '+' : ''}${carCorsi - oppCorsi} CF` : ''}
        </span>
        <span className="sv-team muted">{oppAbbr || 'OPP'}</span>
      </div>

      <div className="sv-wrap">
        <Row label="Corsi (CF)"    car={carCorsi}   opp={oppCorsi}
          help="All shot attempts: goals + SOG + missed + blocked. Best possession proxy." />
        <Row label="Fenwick (FF)"  car={carFenwick} opp={oppFenwick}
          help="Shot attempts excluding blocked shots. More predictive than Corsi." />
        <Row label="Shots on Goal" car={carSOG}     opp={oppSOG}
          help="Shots that reached the goalie (goals + saves)." />
        <Row label="Blocked Shots" car={carBlocked} opp={oppBlocked}
          help="Attempts blocked by a skater before reaching the goalie." />
      </div>

      <div className="adv-chips-row">
        <StatChip label="CF%"
          value={cfPct != null ? `${cfPct}%` : 'N/A'}
          color={cfPct != null && cfPct >= 50 ? 'var(--green)' : (color || 'var(--team-primary)')}
          help={`Corsi For %: ${abbr}'s share of all shot attempts. ≥50% = controlling play.`} />
        <StatChip label="FF%"
          value={ffPct != null ? `${ffPct}%` : 'N/A'}
          color={ffPct != null && ffPct >= 50 ? 'var(--green)' : (color || 'var(--team-primary)')}
          help={`Fenwick For %: ${abbr}'s share of unblocked attempts. Better predictor than Corsi.`} />
        <StatChip label="PDO"
          value={pdo != null ? pdo.toFixed(1) : `SH ${shPct}%`}
          color={pdoColor}
          help={pdo != null
            ? `PDO = SH% (${shPct}%) + SV% (${svPct?.toFixed(1)}%) = ${pdo}. Values >103 suggest luck; <97 suggest bad luck.`
            : "PDO = SH% + SV%. Goalie data not yet available for this game."} />
        <StatChip label="Luck"
          value={luckLabel}
          color={luckColor}
          help={`Goals (${goals}) vs expected goals from shot locations (xG ${xg}). Positive = scoring above expectation.`} />
      </div>
    </div>
  );
}

// ── Team Stats card ───────────────────────────────────────────

function TeamStatsCard({ pbpStats, shotStats, abbr, oppAbbr, color, oppColor, faceoffStats, teamId }) {
  const rows = [
    shotStats && {
      label: 'Shots on Goal', carN: shotStats.sog,    oppN: shotStats.oppSOG,
      help: 'Shots that reached the goalie (goals + saves).',
    },
    shotStats && {
      label: 'Blocked Shots', carN: shotStats.blocks, oppN: shotStats.oppBlocked,
      help: 'Attempts blocked by a skater before reaching the goalie.',
    },
    pbpStats && {
      label: 'Hits', carN: pbpStats.hits.car, oppN: pbpStats.hits.opp,
      help: 'Body checks delivered.',
    },
    pbpStats && {
      label: 'Penalties', carN: pbpStats.penalties.car, oppN: pbpStats.penalties.opp,
      help: 'Penalties taken — fewer is better.',
    },
    (() => {
      // faceoffStats has both teams' players — filter to ours via team_id
      // then fall back to PBP-derived (which now has away_team_id fixed in pipeline)
      let carPct = null, won = 0, lost = 0;
      const allFO = Object.values(faceoffStats || {});
      const ourFO = allFO.filter(p => p.team_id === teamId);
      if (ourFO.length > 0) {
        won  = ourFO.reduce((s, p) => s + p.wins,   0);
        lost = ourFO.reduce((s, p) => s + p.losses, 0);
        const total = won + lost;
        carPct = total > 0 ? (won / total * 100) : null;
      } else if (pbpStats?.faceoff.total > 0) {
        // Fallback: PBP-derived (accurate now that away_team_id is fixed in pipeline)
        carPct = pbpStats.faceoff.pct;
        won    = pbpStats.faceoff.won;
        lost   = pbpStats.faceoff.lost;
      }
      if (carPct == null) return null;
      return {
        label: 'Faceoff %',
        carN:  carPct,
        oppN:  100 - carPct,
        carDisplay: `${carPct.toFixed(1)}%`,
        oppDisplay: `${(100 - carPct).toFixed(1)}%`,
        help: `Faceoff win %. ${won}W – ${lost}L.`,
      };
    })(),
  ].filter(Boolean);

  if (!rows.length) return null;

  return (
    <div className="card">
      <div className="sec-label" style={{ marginBottom: 8 }}>Team stats — this game</div>
      <div className="gm-stat-header">
        <span style={{ color: color || 'var(--team-primary)' }}>{abbr}</span>
        <span />
        <span style={{ color: oppColor || 'var(--text-muted)' }}>{oppAbbr || 'OPP'}</span>
      </div>
      {rows.map(({ label, carN, oppN, carDisplay, oppDisplay, help }) => {
        const cn  = Number(carN) || 0;
        const on  = Number(oppN) || 0;
        const tot = cn + on || 1;
        return (
          <div key={label} className="gm-stat-row">
            <span className="gm-stat-val team-primary-text">{carDisplay ?? cn}</span>
            <div className="gm-stat-mid">
              <div className="gm-stat-label">
                {label}
                <InfoTip text={help} position="above" />
              </div>
              <div className="dual-bar">
                <div className="fill-team-primary" style={{ width: `${Math.round(cn / tot * 100)}%` }} />
                <div className="fill-blue"         style={{ width: `${Math.round(on / tot * 100)}%` }} />
              </div>
            </div>
            <span className="gm-stat-val muted">{oppDisplay ?? on}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── PP Analysis Panel ────────────────────────────────────────
function PPAnalysisPanel({ drillStat, abbr, color }) {
  const [openIdx, setOpenIdx] = useState(null);
  const { ppOpps, summary, ppUnit1, ppUnit2 } = drillStat; // eslint-disable-line no-unused-vars
  if (!ppOpps?.length) return <div className="drill-empty">No {abbr} power plays this game.</div>;
  const toggle    = idx => setOpenIdx(o => o === idx ? null : idx);
  const pctColor  = (g, o) => g/o >= 0.25 ? 'var(--green)' : g > 0 ? 'var(--text-muted)' : 'var(--red-bright)';
  const oIcon     = opp => opp.scored ? '⚡' : opp.sog >= 3 ? '🎯' : opp.shots === 0 ? '❌' : '🔲';
  const oLabel    = opp => opp.scored ? 'GOAL' : opp.sog >= 3 ? 'Shots' : opp.shots === 0 ? 'No shots' : 'No score';
  const oClass    = opp => opp.scored ? 'pp-outcome goal' : opp.sog >= 3 ? 'pp-outcome shots' : 'pp-outcome none';
  return (
    <div className="pp-analysis">
      <div className="pp-summary-row">
        <div className="pp-summary-stat">
          <span className="pp-summary-val" style={{ color: pctColor(summary.goals, summary.opps) }}>
            {summary.goals}/{summary.opps}
          </span>
          <span className="pp-summary-label">PP Goals</span>
        </div>
        <div className="pp-summary-divider" />
        <div className="pp-summary-stat">
          <span className="pp-summary-val">{summary.opps > 0 ? `${Math.round(summary.goals/summary.opps*100)}%` : '—'}</span>
          <span className="pp-summary-label">PP%</span>
        </div>
        <div className="pp-summary-divider" />
        <div className="pp-summary-stat">
          <span className="pp-summary-val">{summary.sog}</span>
          <span className="pp-summary-label">SOG</span>
        </div>
        <div className="pp-summary-divider" />
        <div className="pp-summary-stat">
          <span className="pp-summary-val">{summary.xg}</span>
          <span className="pp-summary-label">
            xG <InfoTip text="Expected goals on PP shots — estimated from shot distance and angle." position="above" />
          </span>
        </div>
      </div>
      <div className="pp-opps-list">
        {ppOpps.map((opp, i) => (
          <div key={i} className="pp-opp-item">
            <div className="pp-opp-header" onClick={() => toggle(i)}>
              <div className="pp-opp-left">
                <span className="pp-opp-num">PP {i+1}</span>
                <span className="pp-opp-time">{opp.period} · {opp.startTime}</span>
                {opp.quickEntry && <span className="pp-entry-badge">⚡ Quick entry</span>}
              </div>
              <div className="pp-opp-right">
                <span className={oClass(opp)}>{oIcon(opp)} {oLabel(opp)}</span>
                <span className="pp-opp-sog">{opp.sog} SOG</span>
                <span className="pp-opp-chevron">{openIdx === i ? '▲' : '▼'}</span>
              </div>
            </div>
            {openIdx === i && (
              <div className="pp-opp-detail">
                {opp.goals.map((g, gi) => (
                  <div key={gi} className="pp-goal-row">
                    <span className="pp-goal-icon">🚨</span>
                    <div>
                      <span className="pp-goal-scorer">{g.scorer}</span>
                      {g.shotType && <span className="pp-goal-shottype">{g.shotType}</span>}
                    </div>
                    <span className="pp-goal-time">{g.time}</span>
                  </div>
                ))}
                <div className="pp-detail-stats">
                  <div className="pp-detail-stat"><span className="pp-detail-val">{opp.sog}</span><span className="pp-detail-label">SOG</span></div>
                  <div className="pp-detail-stat"><span className="pp-detail-val">{opp.shots}</span><span className="pp-detail-label">SA</span></div>
                  <div className="pp-detail-stat"><span className="pp-detail-val">{opp.xg}</span><span className="pp-detail-label">xG</span></div>
                  <div className="pp-detail-stat"><span className="pp-detail-val">{opp.duration}s</span><span className="pp-detail-label">Duration</span></div>
                </div>
                {opp.shotEvents.length > 0 && (
                  <div className="pp-mini-rink">
                    <div className="pp-mini-rink-label">Shot locations</div>
                    <IceRink events={opp.shotEvents} roster={{}} readOnly teamAbbr={abbr} teamColor={color} />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PK Analysis Panel ─────────────────────────────────────────
function PKAnalysisPanel({ drillStat, abbr, color }) {
  const [openIdx, setOpenIdx] = useState(null);
  const { pkOpps, summary, pkUnit1, pkUnit2 } = drillStat; // eslint-disable-line no-unused-vars
  if (!pkOpps?.length) return <div className="drill-empty">No {abbr} penalty kills this game.</div>;
  const toggle   = idx => setOpenIdx(o => o === idx ? null : idx);
  const pctColor = (ga, o) => ga === 0 ? 'var(--green)' : ga/o <= 0.25 ? 'var(--text-muted)' : 'var(--red-bright)';
  const oIcon    = opp => opp.allowed ? '🚨' : opp.sog >= 4 ? '🛡️' : '✅';
  const oLabel   = opp => opp.allowed ? 'Goal' : opp.sog >= 4 ? 'Held' : 'Killed';
  const oClass   = opp => opp.allowed ? 'pp-outcome none' : opp.sog >= 4 ? 'pp-outcome shots' : 'pp-outcome goal';
  const survived = summary.opps - summary.goalsAgainst;
  return (
    <div className="pp-analysis">
      <div className="pp-summary-row">
        <div className="pp-summary-stat">
          <span className="pp-summary-val" style={{ color: pctColor(summary.goalsAgainst, summary.opps) }}>
            {survived}/{summary.opps}
          </span>
          <span className="pp-summary-label">PK Kills</span>
        </div>
        <div className="pp-summary-divider" />
        <div className="pp-summary-stat">
          <span className="pp-summary-val">{summary.opps > 0 ? `${Math.round(survived/summary.opps*100)}%` : '—'}</span>
          <span className="pp-summary-label">PK%</span>
        </div>
        <div className="pp-summary-divider" />
        <div className="pp-summary-stat">
          <span className="pp-summary-val">{summary.sogAgainst}</span>
          <span className="pp-summary-label">SOG vs</span>
        </div>
        <div className="pp-summary-divider" />
        <div className="pp-summary-stat">
          <span className="pp-summary-val">{summary.xgAgainst}</span>
          <span className="pp-summary-label">
            xGA <InfoTip text="Expected goals against on PK — from shot locations. Lower is better." position="above" />
          </span>
        </div>
      </div>
      <div className="pp-opps-list">
        {pkOpps.map((opp, i) => (
          <div key={i} className="pp-opp-item">
            <div className="pp-opp-header" onClick={() => toggle(i)}>
              <div className="pp-opp-left">
                <span className="pp-opp-num">PK {i+1}</span>
                <span className="pp-opp-time">{opp.period} · {opp.startTime}</span>
              </div>
              <div className="pp-opp-right">
                <span className={oClass(opp)}>{oIcon(opp)} {oLabel(opp)}</span>
                <span className="pp-opp-sog">{opp.sog} SOG vs</span>
                <span className="pp-opp-chevron">{openIdx === i ? '▲' : '▼'}</span>
              </div>
            </div>
            {openIdx === i && (
              <div className="pp-opp-detail">
                {opp.goalDetails.map((g, gi) => (
                  <div key={gi} className="pp-goal-row">
                    <span className="pp-goal-icon">🚨</span>
                    <div><span className="pp-goal-scorer">{g.scorer}</span></div>
                    <span className="pp-goal-time">{g.time}</span>
                  </div>
                ))}
                <div className="pp-detail-stats">
                  <div className="pp-detail-stat"><span className="pp-detail-val">{opp.sog}</span><span className="pp-detail-label">SOG vs</span></div>
                  <div className="pp-detail-stat"><span className="pp-detail-val">{opp.shots}</span><span className="pp-detail-label">SA</span></div>
                  <div className="pp-detail-stat"><span className="pp-detail-val">{opp.xgAgainst}</span><span className="pp-detail-label">xGA</span></div>
                </div>
                {opp.shotEvents.length > 0 && (
                  <div className="pp-mini-rink">
                    <div className="pp-mini-rink-label">OPP shot locations</div>
                    <IceRink events={opp.shotEvents} roster={{}} readOnly flipPerspective teamAbbr={abbr} teamColor={color} />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Goalie Card ───────────────────────────────────────────────
function GoalieCard({ goalies, teamId, abbr, oppAbbr, color, oppColor }) {
  const our = goalies.filter(g => g.team_id === teamId);
  const opp = goalies.filter(g => g.team_id !== teamId);

  const GoalieRow2 = ({ g, teamAbbr, col }) => {
    const sv   = g.saves;
    const sa   = g.shots_against || (sv + (g.goals_against || 0));
    const svPct = sa > 0 ? (sv / sa).toFixed(3).replace('0.', '.') : '—';
    const gaa  = g.toi ? parseFloat(((g.goals_against || 0) / (parseFloat(g.toi) || 1) * 60).toFixed(2)) : null;
    return (
      <div className="goalie-card">
        <div className="goalie-header">
          <span className="goalie-abbr" style={{ color: col }}>{teamAbbr}</span>
          <span className="goalie-name">{g.name}</span>
        </div>
        <div className="goalie-stats-grid">
          <div className="goalie-stat-col">
            <span className="goalie-stat-label">SV/SA</span>
            <span className="goalie-stat-val">{sv ?? '—'}/{sa ?? '—'}</span>
          </div>
          <div className="goalie-stat-col">
            <span className="goalie-stat-label">SV%</span>
            <span className="goalie-stat-val goalie-svpct">{svPct}</span>
          </div>
          {gaa != null && (
            <div className="goalie-stat-col">
              <span className="goalie-stat-label">GAA</span>
              <span className="goalie-stat-val">{gaa}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="card">
      <div className="sec-label">Goalies</div>
      {our.map((g, i) => <GoalieRow2 key={i} g={g} teamAbbr={abbr} col={color} />)}
      {opp.map((g, i) => <GoalieRow2 key={i} g={g} teamAbbr={oppAbbr || 'OPP'} col={oppColor} />)}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────

export default function PWHLShotMapView() {
  const team   = PWHL_TEAM_CONFIG;
  const teamId = PWHL_TEAM_ID ? parseInt(PWHL_TEAM_ID, 10) : null;
  const abbr   = team?.abbr || null;
  const color  = team?.displayColor || 'var(--text-dim)';

  const location = useLocation();
  const [season,         setSeason]   = useState(PWHL_CURRENT_SEASON);
  const [selectedGameId, setSelected] = useState(location.state?.selectedGameId ?? null);
  const [drillStat,      setDrill]    = useState(null);
  const [viewingSummaryPeriod, setViewingSummaryPeriod] = useState(null);

  // ── Dev replay injection ──────────────────────────────────────
  const devGame = usePWHLDevGame();

  // ── Live game detection ───────────────────────────────────────
  // Detect dev route — suppress /pwhl/today polling entirely on /pwhl/dev
  const isDevRoute = location.pathname === '/pwhl/dev';

  // Poll /pwhl/today every 60s to detect live games for the current team.
  // Skip entirely in dev route or when dev game is injected.
  const isLiveRef = useRef(false);
  const liveInterval = useMemo(() => isLiveRef.current ? 30_000 : 60_000, []);

  const { data: todayGames } = usePoll(
    () => (isDevRoute || devGame) ? Promise.resolve(null) : fetchPWHLToday(season),
    liveInterval,
    [season, !!devGame, isDevRoute]
  );

  // Find a live or pre-game game involving our team today
  const liveGame = useMemo(() => {
    if (devGame) return devGame.liveGame;
    if (!todayGames?.length || !teamId) return null;
    return todayGames.find(g =>
      (g.homeTeamId === teamId || g.awayTeamId === teamId) &&
      (g.status === 'live' || g.status === 'pre')
    ) || null;
  }, [todayGames, teamId, devGame]);

  const isLive = devGame ? devGame.liveGame?.status === 'live' : liveGame?.status === 'live';

  // Keep ref in sync for interval calculation
  useEffect(() => { isLiveRef.current = isLive; }, [isLive]);

  // Auto-select live game when it starts — don't override a manual selection
  // Skip in dev mode (dev replay controls the selection)
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (devGame) return;
    if (isLive && liveGame && !autoSelectedRef.current) {
      setSelected(liveGame.gameId);
      autoSelectedRef.current = true;
    }
    if (!isLive) autoSelectedRef.current = false;
  }, [isLive, liveGame, devGame]);

  // Poll live PBP every 30s when a live game is selected.
  // In dev mode, liveData comes from the injected context instead.
  const { data: liveDataReal } = usePoll(
    () => isLive && !devGame && selectedGameId === liveGame?.gameId
      ? fetchPWHLLive(selectedGameId)
      : Promise.resolve(null),
    30_000,
    [isLive, selectedGameId, liveGame?.gameId, !!devGame]
  );

  const liveData = devGame ? devGame.liveData : liveDataReal;

  // ── Derive situation from live events ─────────────────────────
  // Track goalie pull and PP from the most recent penalty/goalie_change events
  const liveSituation = useMemo(() => {
    if (!liveData?.events?.length) return null;
    const events  = liveData.events;
    // Goalie pull: find latest goalie_change with goalieIn = null for either team
    const goaliePulled = events.filter(e => e.eventType === 'goalie_change' && e.goalieIn === null);
    const latestPull   = goaliePulled[goaliePulled.length - 1] || null;
    // Goalie returned: last goalie_change with goalieOut = null
    const goalieReturn = events.filter(e => e.eventType === 'goalie_change' && e.goalieOut === null);
    const latestReturn = goalieReturn[goalieReturn.length - 1] || null;
    const pulledTeamId = latestPull && (!latestReturn || latestPull.timeSeconds > latestReturn.timeSeconds)
      ? latestPull.teamId : null;

    // Active penalties: penalties in last 2 minutes of game time
    const lastEvent    = events[events.length - 1];
    const nowSecs      = (lastEvent?.period - 1) * 1200 + lastEvent?.timeSeconds || 0;
    const pens         = events.filter(e => e.eventType === 'penalty' && e.isPowerPlay);
    const activePens   = pens.filter(p => {
      const penSecs = (p.period - 1) * 1200 + p.timeSeconds;
      return nowSecs - penSecs < 120;
    });
    const ourPP  = activePens.some(p => p.teamId !== teamId && p.teamId != null);
    const oppPP  = activePens.some(p => p.teamId === teamId);
    const ourEN  = pulledTeamId === teamId;
    const oppEN  = pulledTeamId !== null && pulledTeamId !== teamId;

    return { ourPP, oppPP, ourEN, oppEN };
  }, [liveData, teamId]);

  // Current period + clock from last live event (or dev override)
  const liveClock = useMemo(() => {
    if (devGame?.liveGame?._period) {
      return { period: devGame.liveGame._period, time: devGame.liveGame._time };
    }
    if (!liveData?.events?.length) return null;
    const last = liveData.events[liveData.events.length - 1];
    return { period: last.period, time: last.time };
  }, [liveData, devGame]);

  // ── Game event popups ─────────────────────────────────────────
  // Pass raw liveData (not normalized) so the hook can read camelCase event fields
  const {
    goalPopup,     clearGoalPopup,
    hatTrickPopup, clearHatTrickPopup,
    penaltyPopup,  clearPenaltyPopup,
    winPopup,      clearWinPopup,
    puckDropPopup, clearPuckDropPopup,
  } = usePWHLGameEvents(
    isLive ? liveData : null,
    isLive,
    teamId,
    team?.abbr || ''
  );

  // Clear popups on game change
  const clearGoalRef    = useRef(null);
  const clearPenaltyRef = useRef(null);
  const clearWinRef     = useRef(null);
  const clearPuckRef    = useRef(null);
  useEffect(() => { clearGoalRef.current    = clearGoalPopup;    }, [clearGoalPopup]);
  useEffect(() => { clearPenaltyRef.current = clearPenaltyPopup; }, [clearPenaltyPopup]);
  useEffect(() => { clearWinRef.current     = clearWinPopup;     }, [clearWinPopup]);
  useEffect(() => { clearPuckRef.current    = clearPuckDropPopup; }, [clearPuckDropPopup]);

  useEffect(() => {
    clearGoalRef.current?.();
    clearPenaltyRef.current?.();
    clearWinRef.current?.();
    clearPuckRef.current?.();
  }, [selectedGameId]);

  // ── Debug panel (5 taps on score card, dev only) ──────────────
  const [debugOpen,         setDebugOpen]         = useState(false);
  const [debugTaps,         setDebugTaps]         = useState(0);
  const debugTapRef         = useRef(null);
  const [debugGoalPopup,    setDebugGoalPopup]    = useState(null);
  const [debugHatTrickPopup, setDebugHatTrickPopup] = useState(null);
  const [debugPenaltyPopup, setDebugPenaltyPopup] = useState(null);
  const [debugWinPopup,     setDebugWinPopup]     = useState(null);
  const [debugPuckPopup,    setDebugPuckPopup]    = useState(null);
  const [debugSituation,    setDebugSituation]    = useState(null);

  const handleDebugTap = () => {
    if (!import.meta.env.DEV) return;
    const next = debugTaps + 1;
    setDebugTaps(next);
    clearTimeout(debugTapRef.current);
    if (next >= 5) { setDebugOpen(o => !o); setDebugTaps(0); return; }
    debugTapRef.current = setTimeout(() => setDebugTaps(0), 2000);
  };

  const { data: rawShots  = null } = useFetch(
    () => teamId ? fetchPWHLShots(teamId, season)   : Promise.resolve(null), [teamId, season]);
  const { data: roster    = null } = useFetch(
    () => teamId ? fetchPWHLRoster(teamId)           : Promise.resolve(null), [teamId]);
  const { data: schedule  = null } = useFetch(
    () => teamId ? fetchPWHLSchedule(teamId, season) : Promise.resolve(null), [teamId, season]);
  const { data: pbpData   = null } = useFetch(
    () => selectedGameId && !isLive ? fetchPWHLPBP(selectedGameId) : Promise.resolve(null),
    [selectedGameId, isLive]);

  // Live data takes precedence over stored PBP when a live game is selected
  const activePbpData = isLive && liveData ? liveData : pbpData;

  // ── Period / game summaries ───────────────────────────────────
  const { summaries: periodSummaries, newSummary, dismissNewSummary, updateSummaryNarrative } =
    usePWHLPeriodSummary({
      liveData: isLive ? liveData : null,
      pbpData:  !isLive ? pbpData : null,
      isLive,
      gameId:   selectedGameId,
      teamId,
    });

  const { gameSummary, updateGameNarrative } = usePWHLGameSummary({
    liveData: isLive ? liveData : null,
    pbpData:  !isLive ? pbpData : null,
    isLive,
    gameId:   selectedGameId,
    teamId,
  });

  // Derive live summary so narrative updates reflect immediately
  const viewingSummary = viewingSummaryPeriod === null ? null
    : viewingSummaryPeriod === 'game' ? gameSummary
    : periodSummaries.find(s => s.period === viewingSummaryPeriod) || null;

  // Sync summaries to PeriodSummaryContext (shared with NHL bell)
  const { setSummaries: setCtxSummaries, registerOpenHandler } = usePeriodSummaryContext();
  useEffect(() => {
    const all = gameSummary ? [gameSummary, ...periodSummaries] : periodSummaries;
    setCtxSummaries(all);
  }, [periodSummaries, gameSummary, setCtxSummaries]);
  useEffect(() => {
    registerOpenHandler((s) => setViewingSummaryPeriod(s.isGameSummary ? 'game' : s.period));
    return () => registerOpenHandler(null);
  }, [registerOpenHandler]);

  // Auto-open game summary when live game goes final
  const wasLiveRef = useRef(false);
  useEffect(() => { if (isLive) wasLiveRef.current = true; }, [isLive]);
  useEffect(() => {
    if (!wasLiveRef.current) return;
    if (!isLive && liveData?.gameStatus === 'final' && gameSummary && viewingSummaryPeriod === null) {
      setViewingSummaryPeriod('game');
    }
  }, [isLive, liveData?.gameStatus, gameSummary, viewingSummaryPeriod]);

  // Auto-show new period summary when it fires during a live game
  useEffect(() => {
    if (newSummary) setViewingSummaryPeriod(newSummary.isGameSummary ? 'game' : newSummary.period);
  }, [newSummary]);

  // Normalize live events to snake_case shape used by pbpByType and pbpStats
  // Live: { eventType, teamId, isPowerPlay, ... }
  // Stored: { event_type, team_id, is_power_play, ... }
  const normalizeLiveEvents = useCallback((events, homeTeamId, awayTeamId) => {
    if (!events?.length) return [];
    return events.map(e => {
      const type = e.eventType;

      // ── player_name: varies by event type ───────────────────
      let playerId   = null;
      let playerName = null;
      let secPlayerId   = null;
      let secPlayerName = null;

      if (type === 'hit') {
        // hit: { player (hitter), onPlayer (hittee) }
        playerId   = e.player?.id ?? null;
        playerName = e.player ? `${e.player.firstName} ${e.player.lastName}`.trim() : null;
        secPlayerId   = e.onPlayer?.id ?? null;
        secPlayerName = e.onPlayer ? `${e.onPlayer.firstName} ${e.onPlayer.lastName}`.trim() : null;
      } else if (type === 'penalty') {
        // penalty: { takenBy, servedBy }
        playerId   = e.takenBy?.id ?? null;
        playerName = e.takenBy ? `${e.takenBy.firstName} ${e.takenBy.lastName}`.trim() : null;
      } else if (type === 'faceoff') {
        // faceoff: { homePlayer, visitingPlayer, homeWin }
        // team_id = winner's team ID
        const winnerIsHome = e.homeWin;
        const winner  = winnerIsHome ? e.homePlayer    : e.visitingPlayer;
        const loser   = winnerIsHome ? e.visitingPlayer : e.homePlayer;
        playerId      = winner?.id ?? null;
        playerName    = winner ? `${winner.firstName} ${winner.lastName}`.trim() : null;
        secPlayerId   = loser?.id ?? null;
        secPlayerName = loser  ? `${loser.firstName} ${loser.lastName}`.trim()  : null;
      } else if (type === 'goal') {
        playerId   = e.scoredBy?.id ?? null;
        playerName = e.scoredBy ? `${e.scoredBy.firstName} ${e.scoredBy.lastName}`.trim() : null;
      } else if (type === 'shot' || type === 'blocked_shot') {
        playerId   = e.shooter?.id ?? null;
        playerName = e.shooter ? `${e.shooter.firstName} ${e.shooter.lastName}`.trim() : null;
      }

      // ── team_id: faceoffs derive from homeWin + team IDs ──
      let resolvedTeamId = e.teamId ?? null;
      if (type === 'faceoff' && homeTeamId != null) {
        resolvedTeamId = e.homeWin ? homeTeamId : (awayTeamId ?? null);
      }

      return {
        ...e,
        event_type:           type,
        team_id:              resolvedTeamId,
        is_power_play:        e.isPowerPlay   ?? false,
        player_id:            playerId,
        player_name:          playerName,
        secondary_player_id:  secPlayerId,
        secondary_player_name: secPlayerName,
        period_id:            e.period,
        time_seconds:         e.timeSeconds,
        description: e.description ? e.description.replace(/^(?:Ob|Maj|Min|Mis|Gm)-/i, '').replace(/-/g, ' ').trim() : null,
        penalty_minutes:      e.minutes       ?? null,
      };
    });
  }, []);

  // Destructure PBP payload — live and stored shapes are compatible after normalization
  const pbpEvents    = isLive
    ? normalizeLiveEvents(liveData?.events, liveData?.homeTeamId, liveData?.awayTeamId)
    : (activePbpData?.events ?? null);
  const oppShotRows  = activePbpData?.oppShots    ?? [];
  const pbpHomeId    = activePbpData?.homeTeamId  ?? liveData?.homeTeamId ?? null;
  const pbpAwayId    = activePbpData?.awayTeamId  ?? liveData?.awayTeamId ?? null;
  const faceoffStats = activePbpData?.faceoffStats ?? {};
  const goalieStats  = isLive
    ? (liveData?.goalieStats ?? [])
    : (activePbpData?.goalieStats ?? []);

  // In dev mode, auto-select the injected game ID
  useEffect(() => {
    if (devGame?.liveGame?.gameId && selectedGameId !== devGame.liveGame.gameId) {
      setSelected(devGame.liveGame.gameId);
    }
  }, [devGame?.liveGame?.gameId]);
  const liveShotEvents = useMemo(() => {
    if (!isLive || !liveData?.events?.length || !teamId) return [];
    const homeId = liveData.homeTeamId;
    return liveData.events
      .filter(e => e.eventType === 'shot' || e.eventType === 'blocked_shot' || e.eventType === 'goal')
      .map(ev => {
        const isOurTeam = ev.teamId === teamId;
        // For home team perspective: home attacks right in odd periods
        // adaptLiveShot receives isOurTeam relative to home perspective
        const isHome = teamId === homeId;
        return adaptLiveShot(ev, isHome ? isOurTeam : !isOurTeam);
      })
      .filter(Boolean);
  }, [isLive, liveData, teamId]);

  // Our shots from live feed
  const liveOurShots = useMemo(
    () => liveShotEvents.filter(e => e.isCanes),
    [liveShotEvents]
  );

  // Opp shots from live feed
  const liveOppShots = useMemo(
    () => liveShotEvents.filter(e => !e.isCanes),
    [liveShotEvents]
  );
  const handleSeasonChange = id => { setSeason(id); setSelected(null); setDrill(null); };
  const handleSelect       = id => { setSelected(p => p === id ? null : id); setDrill(null); };
  const handleAll          = ()  => { setSelected(null); setDrill(null); };

  // Roster name map (our team only — used for our shots)
  const playerMap = useMemo(() => {
    if (!roster?.length) return {};
    return Object.fromEntries(roster.map(p => [p.player_id, `${p.first_name} ${p.last_name}`.trim()]));
  }, [roster]);

  // Our team's shot events (adapted for IceRink)
  const allOurShots = useMemo(() => {
    if (!rawShots?.length) return [];
    return rawShots.filter(r => r.x_norm != null && r.y_norm != null)
                   .map(r => adaptOurShot(r, playerMap));
  }, [rawShots, playerMap]);

  const ourShotEvents = useMemo(() => {
    if (isLive && selectedGameId === liveGame?.gameId) return liveOurShots;
    return selectedGameId ? allOurShots.filter(e => e.gameId === selectedGameId) : allOurShots;
  }, [allOurShots, selectedGameId, isLive, liveGame, liveOurShots]);

  // Opponent shot events for the selected game (adapted for IceRink, isCanes=false)
  const oppShotEvents = useMemo(() => {
    if (isLive && selectedGameId === liveGame?.gameId) return liveOppShots;
    if (!selectedGameId || !oppShotRows.length) return [];
    // Identify our team's shooter_ids so we can exclude them
    const ourIds = new Set((rawShots || []).filter(r => r.game_id === selectedGameId).map(r => r.shooter_id).filter(Boolean));
    return oppShotRows
      .filter(r => r.x_norm != null && r.y_norm != null && !ourIds.has(r.shooter_id))
      .map(adaptOppShot);
  }, [selectedGameId, oppShotRows, rawShots, isLive, liveGame, liveOppShots]);

  // Combined for IceRink (our shots + opp shots in game view)
  const rinkEvents = useMemo(
    () => selectedGameId ? [...ourShotEvents, ...oppShotEvents] : ourShotEvents,
    [ourShotEvents, oppShotEvents, selectedGameId]
  );

  // Schedule — completed games only for chips
  const games = useMemo(() => {
    if (!schedule?.length) return [];
    return [...schedule].filter(g => g.game_state === 'Final').sort((a,b) => b.game_id - a.game_id);
  }, [schedule]);

  const selectedGame = useMemo(() => games.find(g => g.game_id === selectedGameId) || null, [games, selectedGameId]);
  const displayGame  = selectedGame || games[0] || null;

  const scoreBarData = useMemo(() => {
    // Live game score from live feed
    if (isLive && liveGame && selectedGameId === liveGame.gameId) {
      const isHome  = liveGame.homeTeamId === teamId;
      const myScore = isHome ? liveGame.homeScore : liveGame.awayScore;
      const opScore = isHome ? liveGame.awayScore : liveGame.homeScore;
      const oppCode = isHome ? liveGame.awayTeamCode : liveGame.homeTeamCode;
      return {
        isHome, myScore, oppScore: opScore, oppAbbr: oppCode, won: myScore > opScore,
        ot: false, shootout: false,
        homeTeamId: liveGame.homeTeamId, awayTeamId: liveGame.awayTeamId,
      };
    }
    // Completed game from schedule
    if (!displayGame || !teamId) return null;
    const isHome   = displayGame.home_team_id === teamId;
    const myScore  = isHome ? displayGame.home_score : displayGame.away_score;
    const oppScore = isHome ? displayGame.away_score : displayGame.home_score;
    const oppId    = isHome ? displayGame.away_team_id : displayGame.home_team_id;
    const oppAbbr  = TEAM_CODES[oppId] || String(oppId);
    return {
      isHome, myScore, oppScore, oppAbbr, won: myScore > oppScore,
      ot: displayGame.ot, shootout: displayGame.shootout,
      homeTeamId: displayGame.home_team_id, awayTeamId: displayGame.away_team_id,
    };
  }, [displayGame, teamId, isLive, liveGame, selectedGameId]);

  // ── Shot stats ────────────────────────────────────────────────

  const shotStats = useMemo(() => {
    if (!ourShotEvents.length) return null;
    const sog     = ourShotEvents.filter(e => e.type === 'shot-on-goal').length;
    const blocks  = ourShotEvents.filter(e => e.type === 'blocked-shot').length;
    const goals   = ourShotEvents.filter(e => e.type === 'goal').length;
    const oppSOG     = oppShotEvents.filter(e => e.type === 'shot-on-goal').length;
    const oppBlocked = oppShotEvents.filter(e => e.type === 'blocked-shot').length;
    return { sog, blocks, goals, total: sog + blocks + goals, oppSOG, oppBlocked };
  }, [ourShotEvents, oppShotEvents]);

  // Danger counts (our shots only)
  const dangerCounts = useMemo(() => {
    const shots = ourShotEvents.filter(e => e.isCanes);
    const hi  = shots.filter(e => distFromGoal(e.x, e.y) < 15);
    const mid = shots.filter(e => { const d = distFromGoal(e.x, e.y); return d >= 15 && d < 30; });
    const lo  = shots.filter(e => distFromGoal(e.x, e.y) >= 30);
    return { hi, mid, lo, hiN: hi.length, midN: mid.length, loN: lo.length, total: shots.length };
  }, [ourShotEvents]);

  // ── PBP stats ─────────────────────────────────────────────────

  const pbpStats = useMemo(() => {
    if (!pbpEvents?.length || !selectedGameId || !teamId || !scoreBarData) return null;
    const hits      = pbpByType(pbpEvents, 'hit');
    const penalties = pbpByType(pbpEvents, 'penalty');
    const faceoffs  = pbpByType(pbpEvents, 'faceoff');

    const carHits = hits.filter(e => e.team_id === teamId).length;
    const oppHits = hits.filter(e => e.team_id !== teamId && e.team_id != null).length;

    const carPens = penalties.filter(e => e.team_id === teamId);
    const oppPens = penalties.filter(e => e.team_id !== teamId && e.team_id != null);

    // Faceoffs: team_id = winner's team (resolved by Worker via roster)
    const oppTeamId = (scoreBarData.isHome ? pbpAwayId : pbpHomeId)
                   || (scoreBarData.isHome ? scoreBarData.awayTeamId : scoreBarData.homeTeamId);
    const carFOW  = faceoffs.filter(e => e.team_id === teamId).length;
    const carFOL  = faceoffs.filter(e => e.team_id === oppTeamId).length;
    const totalFO = carFOW + carFOL;
    const foPct   = totalFO > 0 ? (carFOW / totalFO * 100) : null;

    const ppOpps = oppPens.filter(e => e.is_power_play).length;
    const pkOpps = carPens.filter(e => e.is_power_play).length;

    return {
      hits:      { car: carHits, opp: oppHits },
      penalties: { car: carPens.length, opp: oppPens.length, carRows: carPens, oppRows: oppPens },
      faceoff:   { pct: foPct, won: carFOW, lost: carFOL, total: totalFO },
      pp:        { opps: ppOpps, pkOpps },
    };
  }, [pbpEvents, selectedGameId, teamId, scoreBarData, pbpHomeId, pbpAwayId]);

  // ── Top scorers (our shots only) ─────────────────────────────

  const topScorers = useMemo(() => {
    if (!selectedGameId || !ourShotEvents.length) return [];
    const by = {};
    ourShotEvents.filter(e => e.type === 'goal' && e.shooterName).forEach(e => {
      if (!by[e.shooterName]) by[e.shooterName] = { goals: 0, assists: 0 };
      by[e.shooterName].goals++;
    });
    return Object.entries(by)
      .sort((a,b) => b[1].goals - a[1].goals)
      .map(([name, s]) => ({ name, ...s, points: s.goals + s.assists }));
  }, [ourShotEvents, selectedGameId]);

  // ── Drill-down builder ────────────────────────────────────────

  const buildDrillDown = useCallback((statKey) => {
    const buildRows = (events, getName, getPeriod) => {
      const by = {};
      events.forEach(e => {
        const name = getName(e) || '—';
        const per  = getPeriod ? getPeriod(e) : pLabel(e.period_id);
        if (!by[name]) by[name] = { name, periods: {}, total: 0 };
        by[name].periods[per] = (by[name].periods[per] || 0) + 1;
        by[name].total++;
      });
      return Object.values(by).sort((a,b) => b.total - a.total);
    };

    // Identify our shooter IDs for this game (to split opp_shots)
    const ourShooterIds = new Set(
      (rawShots || []).filter(r => r.game_id === selectedGameId).map(r => r.shooter_id).filter(Boolean)
    );
    // In live mode oppShotRows is empty — use adapted liveOppShots instead
    const oppOnlyShots = (isLive && !oppShotRows.length)
      ? liveOppShots.map(s => ({
          shooter_id:   null,
          shooter_name: s.shooterName || null,
          event_type:   s.type === 'goal' ? 'goal' : s.type === 'blocked-shot' ? 'blocked_shot' : 'shot',
          period_id:    s.period,
          time_seconds: s.timeInPeriod
            ? parseInt(s.timeInPeriod.split(':')[0]) * 60 + parseInt(s.timeInPeriod.split(':')[1])
            : 0,
          x_norm: s.x, y_norm: s.y,
        }))
      : oppShotRows.filter(r => !ourShooterIds.has(r.shooter_id));

    if (statKey === 'sog') {
      const carSOGEvts = ourShotEvents.filter(e => e.type === 'shot-on-goal' || e.type === 'goal');
      const oppSOGRows = oppOnlyShots.filter(r => r.event_type === 'shot' || r.event_type === 'goal');
      setDrill({
        label:   'Shots on Goal', type: 'shots',
        carRows: buildRows(carSOGEvts, e => e.shooterName, e => pLabel(e.period)),
        oppRows: buildRows(oppSOGRows, r => r.shooter_name || `#${r.shooter_id}`, r => pLabel(r.period_id)),
      });

    } else if (statKey === 'blocked') {
      const carBlkEvts = ourShotEvents.filter(e => e.type === 'blocked-shot');
      const oppBlkRows = oppOnlyShots.filter(r => r.event_type === 'blocked_shot');
      setDrill({
        label:   'Blocked Shots', type: 'shots',
        carRows: buildRows(carBlkEvts, e => e.shooterName, e => pLabel(e.period)),
        oppRows: buildRows(oppBlkRows, r => r.shooter_name || `#${r.shooter_id}`, r => pLabel(r.period_id)),
      });

    } else if (!pbpEvents?.length) {
      return;

    } else if (statKey === 'hits') {
      const carH = pbpByType(pbpEvents, 'hit').filter(e => e.team_id === teamId);
      const oppH = pbpByType(pbpEvents, 'hit').filter(e => e.team_id !== teamId && e.team_id != null);
      setDrill({
        label:   'Hits', type: 'shots',
        carRows: buildRows(carH, e => e.player_name || `#${e.player_id}`),
        oppRows: buildRows(oppH, e => e.player_name || `#${e.player_id}`),
      });

    } else if (statKey === 'penalties') {
      const carP = pbpStats?.penalties.carRows || [];
      const oppP = pbpStats?.penalties.oppRows || [];
      const toRows = evs => evs.map(e => ({
        name:        e.player_name || `#${e.player_id}`,
        description: e.description ? e.description.replace(/^(?:Ob|Maj|Min|Mis|Gm)-/i, '').replace(/-/g, ' ').trim() : 'Penalty',
        minutes:     e.penalty_minutes || 2,
        period:      pLabel(e.period_id),
        periods: {}, total: 1,
      }));
      setDrill({ label: 'Penalties', type: 'penalties', carRows: toRows(carP), oppRows: toRows(oppP) });

    } else if (statKey === 'faceoff') {
      // Prefer gameSummary faceoff data (per-player wins/attempts) over PBP reconstruction
      if (Object.keys(faceoffStats).length > 0) {
        const rows = Object.values(faceoffStats)
          .filter(p => p.attempts > 0)
          .sort((a,b) => b.attempts - a.attempts)
          .map(p => ({ name: p.name, totalWon: p.wins, totalLost: p.losses, total: p.attempts }));
        setDrill({ label: `Faceoffs`, rows, type: 'faceoff' });
      } else {
        // Fallback: reconstruct from PBP events
        const foEvs  = pbpByType(pbpEvents, 'faceoff');
        const oppTeamId = (scoreBarData?.isHome ? pbpAwayId : pbpHomeId)
                       || (scoreBarData?.isHome ? scoreBarData?.awayTeamId : scoreBarData?.homeTeamId);
        const by = {};
        foEvs.forEach(e => {
          const winIsCAR = e.team_id === teamId;
          const winIsOPP = e.team_id === oppTeamId;
          if (!winIsCAR && !winIsOPP) return;
          const wName = e.player_name           || (e.player_id           ? `#${e.player_id}`           : null);
          const lName = e.secondary_player_name || (e.secondary_player_id ? `#${e.secondary_player_id}` : null);
          if (wName) {
            if (!by[wName]) by[wName] = { name: wName, totalWon: 0, totalLost: 0, total: 0 };
            if (winIsCAR) by[wName].totalWon++; else by[wName].totalLost++;
            by[wName].total++;
          }
          if (lName) {
            if (!by[lName]) by[lName] = { name: lName, totalWon: 0, totalLost: 0, total: 0 };
            if (!winIsCAR) by[lName].totalLost++; else by[lName].totalWon++;
            by[lName].total++;
          }
        });
        const rows = Object.values(by).filter(r => r.total > 0).sort((a,b) => b.total - a.total);
        setDrill({ label: `${abbr} Faceoffs`, rows, type: 'faceoff' });
      }
    } else if (statKey === 'pp') {
      // Power play analysis: each of our PP opportunities (from opp penalties)
      const penalties = pbpByType(pbpEvents, 'penalty');
      const ourPPPens = penalties.filter(e => e.team_id !== teamId && e.team_id != null && e.is_power_play);
      // Our PP shots: shot events during PP penalty windows
      const ppOpps = ourPPPens.map((pen, idx) => {
        const _penStart = pen.period_id * 10000 + pen.time_seconds;
        // Shots within 2 min (120s) of this penalty in same period
        const ppShots = ourShotEvents.filter(s => {
          if (s.period !== pen.period_id) return false;
          const dt = s.timeInPeriod
            ? (parseInt(s.timeInPeriod.split(':')[0])*60 + parseInt(s.timeInPeriod.split(':')[1])) - pen.time_seconds
            : -1;
          return dt >= 0 && dt <= 125;
        });
        const goals = ppShots.filter(s => s.type === 'goal');
        const sog   = ppShots.filter(s => s.type === 'shot-on-goal' || s.type === 'goal');
        let xg = 0;
        ppShots.forEach(s => { xg += Math.max(Math.exp(-distFromGoal(s.x, s.y) / 15) * 0.55, 0.02); });
        const mm = String(Math.floor(pen.time_seconds/60)).padStart(2,'0');
        const ss2 = String(pen.time_seconds%60).padStart(2,'0');
        return {
          idx, period: pLabel(pen.period_id), startTime: `${mm}:${ss2}`,
          scored: goals.length > 0, goals: goals.map(g => ({ scorer: g.shooterName || '—', time: g.timeInPeriod, shotType: g.shotType, assists: [] })),
          sog: sog.length, shots: ppShots.length, xg: parseFloat(xg.toFixed(2)),
          shotTypeCounts: {}, quickEntry: ppShots.length > 0 && ppShots[0],
          shotEvents: ppShots.map(s => ({ ...s, isCanes: true })),
          duration: 120,
        };
      });
      const totalGoals = ppOpps.filter(o => o.scored).length;
      const totalSOG   = ppOpps.reduce((s,o) => s + o.sog, 0);
      const totalXG    = parseFloat(ppOpps.reduce((s,o) => s + o.xg, 0).toFixed(2));
      setDrill({
        label: `${abbr} Power Play Analysis`, type: 'ppanalysis',
        ppOpps, ppUnit1: [], ppUnit2: [],
        summary: { goals: totalGoals, opps: ppOpps.length, sog: totalSOG, xg: totalXG },
      });
    } else if (statKey === 'pk') {
      // Penalty kill analysis: each of our PK opportunities (from our penalties)
      const penalties = pbpByType(pbpEvents, 'penalty');
      const ourPKPens = penalties.filter(e => e.team_id === teamId && e.is_power_play);
      // In live mode oppShotRows is empty — use liveOppShots adapted to snake_case instead
      const pkOppShotSource = (isLive && !oppShotRows.length)
        ? liveOppShots.map(s => ({
            shooter_id:  null,
            shooter_name: s.shooterName || null,
            event_type:   s.type === 'goal' ? 'goal' : s.type === 'blocked-shot' ? 'blocked_shot' : 'shot',
            period_id:    s.period,
            time_seconds: s.timeInPeriod
              ? parseInt(s.timeInPeriod.split(':')[0]) * 60 + parseInt(s.timeInPeriod.split(':')[1])
              : 0,
            x_norm: s.x,
            y_norm: s.y,
          }))
        : oppShotRows;
      const pkOpps = ourPKPens.map((pen, idx) => {
        // Opp shots during this PK window
        const pkOppShots = pkOppShotSource
          .filter(r => {
            const ourIds = new Set((rawShots||[]).filter(s=>s.game_id===selectedGameId).map(s=>s.shooter_id).filter(Boolean));
            if (ourIds.has(r.shooter_id)) return false;
            if (r.period_id !== pen.period_id) return false;
            const dt = r.time_seconds - pen.time_seconds;
            return dt >= 0 && dt <= 125;
          });
        const goals = pkOppShots.filter(r => r.event_type === 'goal');
        const sog   = pkOppShots.filter(r => r.event_type === 'shot' || r.event_type === 'goal');
        const _blocks = pkOppShots.filter(r => r.event_type === 'blocked_shot');
        let xgAgainst = 0;
        pkOppShots.forEach(r => {
          if (r.x_norm != null) {
            const adapted = adaptOppShot(r);
            xgAgainst += Math.max(Math.exp(-distFromGoal(adapted.x, adapted.y) / 15) * 0.55, 0.02);
          }
        });
        const mm = String(Math.floor(pen.time_seconds/60)).padStart(2,'0');
        const ss2 = String(pen.time_seconds%60).padStart(2,'0');
        return {
          idx, period: pLabel(pen.period_id), startTime: `${mm}:${ss2}`,
          allowed: goals.length > 0,
          goalDetails: goals.map(g => ({ scorer: g.shooter_name || '—', time: `${String(Math.floor(g.time_seconds/60)).padStart(2,'0')}:${String(g.time_seconds%60).padStart(2,'0')}`, shotType: null, assists: [] })),
          sog: sog.length, shots: pkOppShots.length,
          xgAgainst: parseFloat(xgAgainst.toFixed(2)),
          blockerList: [], shotTypeCounts: {},
          shotEvents: pkOppShots.filter(r=>r.x_norm!=null).map(adaptOppShot).map(s=>({...s,isCanes:false})),
          duration: 120,
        };
      });
      const totalGA      = pkOpps.filter(o => o.allowed).length;
      const totalSOGvs   = pkOpps.reduce((s,o) => s + o.sog, 0);
      const totalXGvs    = parseFloat(pkOpps.reduce((s,o) => s + o.xgAgainst, 0).toFixed(2));
      const totalBlocks2 = pkOpps.reduce((s,o) => s + o.blockerList.reduce((b,bl)=>b+bl.count,0), 0);
      setDrill({
        label: `${abbr} Penalty Kill Analysis`, type: 'pkanalysis',
        pkOpps, pkUnit1: [], pkUnit2: [],
        summary: { goalsAgainst: totalGA, opps: pkOpps.length, sogAgainst: totalSOGvs, xgAgainst: totalXGvs, blocks: totalBlocks2 },
      });
    }
  }, [pbpEvents, pbpStats, ourShotEvents, oppShotRows, rawShots, selectedGameId, teamId, abbr, scoreBarData, pbpHomeId, pbpAwayId]);

  const buildDangerDrill = useCallback((zone) => {
    const sets = {
      hi:  { shots: dangerCounts.hi,  label: '🔴 High Danger (<15 ft)' },
      mid: { shots: dangerCounts.mid, label: '🟡 Medium Danger (15–30 ft)' },
      lo:  { shots: dangerCounts.lo,  label: '⚪ Low Danger (>30 ft)' },
    };
    const { shots, label } = sets[zone];
    const by = {};
    shots.forEach(e => {
      const name = e.shooterName || '—';
      const per  = pLabel(e.period);
      if (!by[name]) by[name] = { name, periods: {}, total: 0 };
      by[name].periods[per] = (by[name].periods[per] || 0) + 1;
      by[name].total++;
    });
    setDrill({ label, rows: Object.values(by).sort((a,b) => b.total - a.total), type: 'shots' });
  }, [dangerCounts]);

  // ── Derived display ───────────────────────────────────────────

  const oppTeam     = scoreBarData ? PWHL_TEAM_MAP[scoreBarData.oppAbbr] : null;
  const oppColor    = oppTeam?.displayColor || 'var(--text-dim)';
  const seasonLabel = SEASONS.find(s => s.id === season)?.label || String(season);
  const _viewLabel   = selectedGameId && scoreBarData
    ? `vs ${scoreBarData.oppAbbr} · ${scoreBarData.won ? 'W' : 'L'} ${scoreBarData.myScore}–${scoreBarData.oppScore}`
    : seasonLabel;
  const hasPBP  = selectedGameId && (
    (isLive && liveData?.events?.length > 0) ||
    (Array.isArray(pbpEvents) && pbpEvents.length > 0)
  );
  const oppAbbr = scoreBarData?.oppAbbr;

  if (!abbr) return (
    <div className="page">
      <div className="card" style={{ textAlign:'center', padding:32 }}>
        <p style={{ color:'var(--text-dim)' }}>No PWHL team selected.</p>
      </div>
    </div>
  );

  return (
    <div className="page">

      {/* ── Score bar ── */}
      <div className="score-card card" onClick={handleDebugTap} style={{ userSelect: 'none' }}>
        <div className="score-inner">
          <div className="score-team-wrap">
            <div className="score-team">
              <TeamLogo abbr={abbr} sport="pwhl" size={30} color={color} />
              <span className="score-abbr" style={{ color }}>{abbr}</span>
              <span className="score-abbr" style={{ color:'var(--text-dim)', fontWeight:400, fontSize:'0.75rem' }}>
                {team.shortName}
              </span>
              {scoreBarData && <span className="score-num" style={{ color }}>{scoreBarData.myScore}</span>}
            </div>
            {(isLive && liveSituation?.ourPP) || debugSituation?.ourPP ? (
              <div className="pp-indicator car-pp">⚡ Power Play</div>
            ) : null}
            {(isLive && liveSituation?.ourEN) || debugSituation?.ourEN ? (
              <div className="pp-indicator en-indicator car-en">🥅 {abbr} Empty Net</div>
            ) : null}
          </div>
          <div className="score-center">
            {isLive && selectedGameId === liveGame?.gameId ? (
              <>
                <div className="score-period">
                  {liveClock ? pLabel(liveClock.period) : '—'}
                </div>
                <div className="score-clock" style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                  {liveClock?.time || '—'}
                </div>
                <div className="score-state pill pill-red" style={{ marginTop: 4 }}>
                  {devGame ? '🟡 DEV' : '🔴 LIVE'}
                </div>
              </>
            ) : scoreBarData ? (
              <>
                <div className="score-period">Final{scoreBarData.ot?' OT':scoreBarData.shootout?' SO':''}</div>
                <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:2 }}>
                  {scoreBarData.won ? '✓ Win' : '✗ Loss'} · {scoreBarData.isHome ? 'Home' : 'Away'}
                </div>
              </>
            ) : (
              <>
                <div className="score-period">Shot Map</div>
                <div style={{ fontSize:10, color:'var(--text-dim)' }}>Historical</div>
              </>
            )}
          </div>
          {scoreBarData ? (
            <div className="score-team-wrap">
              <div className="score-team">
                <span className="score-num muted">{scoreBarData.oppScore}</span>
                <span className="score-abbr muted">{scoreBarData.oppAbbr}</span>
                {oppTeam && (
                  <span className="score-abbr" style={{ color:'var(--text-dim)', fontWeight:400, fontSize:'0.75rem' }}>
                    {oppTeam.shortName}
                  </span>
                )}
                <TeamLogo abbr={scoreBarData.oppAbbr} sport="pwhl" size={30} color={oppColor} />
              </div>
              {(isLive && liveSituation?.oppPP) || debugSituation?.oppPP ? (
                <div className="pp-indicator opp-pp">⚡ {scoreBarData.oppAbbr} Power Play</div>
              ) : null}
              {(isLive && liveSituation?.oppEN) || debugSituation?.oppEN ? (
                <div className="pp-indicator en-indicator opp-en">🥅 {scoreBarData.oppAbbr} Empty Net</div>
              ) : null}
            </div>
          ) : <div style={{ width:40 }} />}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
            {SEASONS.map(s => (
              <button key={s.id}
                className={`rink-btn${season === s.id ? ' on' : ''}`}
                style={{ padding:'2px 8px', fontSize:10, minHeight:'unset', minWidth:'unset' }}
                onClick={() => handleSeasonChange(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Game selector ── */}
      {(liveGame || games.length > 0) && (
        <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
          {liveGame && (
            <LiveGameChip
              liveGame={liveGame}
              teamId={teamId}
              selected={selectedGameId === liveGame.gameId}
              onSelect={() => { setSelected(liveGame.gameId); setDrill(null); }}
            />
          )}
          {games.length > 0 && (
            <GameChipsRow games={games} teamId={teamId}
              selectedGameId={selectedGameId} onSelect={handleSelect} onAll={handleAll} />
          )}
        </div>
      )}

      {/* ── Live / Game Insights ── */}
      {hasPBP && (
        <PWHLLiveInsights
          pbpEvents={pbpEvents}
          ourShotEvents={ourShotEvents}
          oppShotEvents={oppShotEvents}
          teamId={teamId}
          abbr={abbr}
          oppAbbr={oppAbbr}
          myScore={scoreBarData?.myScore}
          oppScore={scoreBarData?.oppScore}
          isLive={isLive}
          liveData={liveData}
        />
      )}

      {/* ── Period / game summary buttons ── */}
      {hasPBP && periodSummaries.length > 0 && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', padding:'0 0 4px' }}>
          {periodSummaries.map(s => (
            <button key={s.period} className="rink-btn"
              style={{ fontSize:11, padding:'3px 10px' }}
              onClick={() => setViewingSummaryPeriod(s.period)}>
              {s.periodShort} Summary
            </button>
          ))}
          {gameSummary && (
            <button className="rink-btn"
              style={{ fontSize:11, padding:'3px 10px', fontWeight:600 }}
              onClick={() => setViewingSummaryPeriod('game')}>
              📊 Game Summary
            </button>
          )}
        </div>
      )}

      {/* ── Row 1: SOG, Blocks, Hits, Penalties ── */}
      {shotStats && (
        <div className="metrics-grid metrics-grid-4">
          <MetCard label="Shots on Goal" value={shotStats.sog}
            sub={`${shotStats.goals}G · Opp ${shotStats.oppSOG ?? '—'}`}
            onClick={() => buildDrillDown('sog')} />
          <MetCard label="Blocks" value={shotStats.blocks}
            sub={`Opp ${shotStats.oppBlocked ?? '—'}`}
            onClick={() => buildDrillDown('blocked')} />
          <MetCard label="Hits"
            value={hasPBP ? (pbpStats?.hits.car ?? '—') : '—'}
            sub={hasPBP && pbpStats ? `Opp ${pbpStats.hits.opp}` : selectedGameId ? 'Loading…' : 'Select a game'}
            color={hasPBP && pbpStats && pbpStats.hits.car > pbpStats.hits.opp ? 'green' : null}
            onClick={hasPBP ? () => buildDrillDown('hits') : null} />
          <MetCard label="Penalties"
            value={hasPBP ? (pbpStats?.penalties.car ?? '—') : '—'}
            sub={hasPBP && pbpStats ? `Opp ${pbpStats.penalties.opp}` : selectedGameId ? 'Loading…' : 'Select a game'}
            color={hasPBP && pbpStats && pbpStats.penalties.car < pbpStats.penalties.opp ? 'green' : null}
            onClick={hasPBP ? () => buildDrillDown('penalties') : null} />
        </div>
      )}

      {/* ── Row 2: Faceoff%, PP%, PK% (game only) ── */}
      {hasPBP && pbpStats && (
        <div className="metrics-grid metrics-grid-3">
          {(() => {
            // Filter faceoffStats to our team only — both teams are included
            const ourFO = Object.values(faceoffStats).filter(p => p.team_id === teamId);
            if (ourFO.length > 0) {
              const totalWon = ourFO.reduce((s, p) => s + p.wins, 0);
              const totalAtt = ourFO.reduce((s, p) => s + p.attempts, 0);
              const pct      = totalAtt > 0 ? (totalWon / totalAtt * 100) : null;
              return (
                <MetCard label="Faceoff %"
                  value={pct != null ? `${pct.toFixed(1)}%` : '—'}
                  sub={`${totalWon}W – ${totalAtt - totalWon}L`}
                  color={pct != null && pct > 50 ? 'green' : null}
                  onClick={() => buildDrillDown('faceoff')} />
              );
            }
            // Fallback: PBP-derived (accurate now that away_team_id fixed in pipeline)
            return (
              <MetCard label="Faceoff %"
                value={pbpStats.faceoff.pct != null ? `${pbpStats.faceoff.pct.toFixed(1)}%` : '—'}
                sub={`${pbpStats.faceoff.won}W – ${pbpStats.faceoff.lost}L`}
                color={pbpStats.faceoff.pct != null && pbpStats.faceoff.pct > 50 ? 'green' : null}
                onClick={() => buildDrillDown('faceoff')} />
            );
          })()}
          {(() => {
            const opps = pbpStats.pp.opps;
            if (opps === 0) return (
              <MetCard label="PP %" value="—" sub="No PP opps" />
            );
            // Count PP goals: goals scored by us during opponent penalty windows
            const penalties = pbpByType(pbpEvents || [], 'penalty');
            const oppPens   = penalties.filter(e => e.team_id !== teamId && e.team_id != null && e.is_power_play);
            let ppGoals = 0;
            for (const pen of oppPens) {
              ppGoals += ourShotEvents.filter(s => {
                if (s.type !== 'goal') return false;
                if (s.period !== pen.period_id) return false;
                const goalSecs = s.timeInPeriod
                  ? parseInt(s.timeInPeriod.split(':')[0]) * 60 + parseInt(s.timeInPeriod.split(':')[1])
                  : -1;
                return goalSecs >= pen.time_seconds && goalSecs <= pen.time_seconds + 125;
              }).length;
            }
            const ppPct = Math.round(ppGoals / opps * 100);
            return (
              <MetCard label="PP %"
                value={`${ppPct}%`}
                sub={`${ppGoals}/${opps} · ${opps} opp${opps !== 1 ? 's' : ''}`}
                color={ppPct >= 20 ? 'green' : null}
                onClick={() => buildDrillDown('pp')} />
            );
          })()}
          {(() => {
            const opps = pbpStats.pp.pkOpps;
            if (opps === 0) return (
              <MetCard label="PK %" value="—" sub="No PK opps" />
            );
            // Count goals allowed during our penalty windows
            const penalties  = pbpByType(pbpEvents || [], 'penalty');
            const ourPens    = penalties.filter(e => e.team_id === teamId && e.is_power_play);
            const ourIds     = new Set((rawShots||[]).filter(r=>r.game_id===selectedGameId).map(r=>r.shooter_id).filter(Boolean));
            const oppOnlyRows = oppShotRows.filter(r => !ourIds.has(r.shooter_id));
            let pkGoalsAgainst = 0;
            for (const pen of ourPens) {
              pkGoalsAgainst += oppOnlyRows.filter(r => {
                if (r.event_type !== 'goal') return false;
                if (r.period_id !== pen.period_id) return false;
                return r.time_seconds >= pen.time_seconds && r.time_seconds <= pen.time_seconds + 125;
              }).length;
            }
            const survived = opps - pkGoalsAgainst;
            const pkPct    = Math.round(survived / opps * 100);
            return (
              <MetCard label="PK %"
                value={`${pkPct}%`}
                sub={`${survived}/${opps} killed`}
                color={pkPct >= 80 ? 'green' : pkPct < 50 ? null : null}
                onClick={() => buildDrillDown('pk')} />
            );
          })()}
        </div>
      )}

      {/* ── Shot Attempts panel ── */}
      {selectedGameId && ourShotEvents.length > 0 && (() => {
        const ourIds = new Set((rawShots||[]).filter(s=>s.game_id===selectedGameId).map(s=>s.shooter_id).filter(Boolean));
        // In live mode oppShotRows is empty — adapt liveOppShots to snake_case shape
        const filteredOppShots = (isLive && !oppShotRows.length)
          ? liveOppShots.map(s => ({
              shooter_id:  null,
              shooter_name: s.shooterName || null,
              event_type:  s.type === 'goal' ? 'goal' : s.type === 'blocked-shot' ? 'blocked_shot' : 'shot',
              period_id:   s.period,
              time_seconds: s.timeInPeriod
                ? parseInt(s.timeInPeriod.split(':')[0]) * 60 + parseInt(s.timeInPeriod.split(':')[1])
                : 0,
              x_norm: s.x, y_norm: s.y,
            }))
          : oppShotRows.filter(r => !ourIds.has(r.shooter_id));
        return (
          <ShotAttemptsPanel
            ourShots={ourShotEvents}
            oppShotRows={filteredOppShots}
            abbr={abbr} oppAbbr={oppAbbr}
            color={color}
            goalieStats={goalieStats}
            teamId={teamId}
          />
        );
      })()}

      {/* ── Shot danger (clickable) ── */}
      {dangerCounts.total > 0 && (
        <div className="card danger-quality-card">
          <div className="sec-label">{abbr} Shot Quality</div>
          <div className="danger-grid">
            <div className="danger-cell high clickable" onClick={() => buildDangerDrill('hi')}>
              <div className="danger-num">{dangerCounts.hiN}</div>
              <div className="danger-label">🔴 High danger</div>
              <div className="danger-sub">&lt;15 ft</div>
            </div>
            <div className="danger-cell med clickable" onClick={() => buildDangerDrill('mid')}>
              <div className="danger-num">{dangerCounts.midN}</div>
              <div className="danger-label">🟡 Medium</div>
              <div className="danger-sub">15–30 ft</div>
            </div>
            <div className="danger-cell lo clickable" onClick={() => buildDangerDrill('lo')}>
              <div className="danger-num">{dangerCounts.loN}</div>
              <div className="danger-label">⚪ Low</div>
              <div className="danger-sub">&gt;30 ft</div>
            </div>
          </div>
        </div>
      )}

      {/* ── two-col: left = rink, right = scorers + team stats ── */}
      <div className="two-col">
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div className="card">
            <div className="sec-label">{abbr} Shot Locations</div>
            {rawShots === null && (
              <div style={{ textAlign:'center', padding:32, color:'var(--text-dim)' }}>Loading shots…</div>
            )}
            {rawShots !== null && rinkEvents.length === 0 && (
              <div style={{ textAlign:'center', padding:32, color:'var(--text-dim)' }}>
                No shot data for this {selectedGameId ? 'game' : 'season'}.
              </div>
            )}
            {rinkEvents.length > 0 && <IceRink events={rinkEvents} roster={{}} teamAbbr={abbr} teamColor={color} />}
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {selectedGameId && topScorers.length > 0 && (
            <div className="card">
              <div className="sec-label">{abbr} scoring — this game</div>
              {topScorers.map((p,i) => (
                <div key={i} className="scorer-row">
                  <span className="scorer-name">{p.name}</span>
                  <div className="scorer-stats">
                    {p.goals   > 0 && <span className="scorer-chip goal">{p.goals}G</span>}
                    {p.assists > 0 && <span className="scorer-chip assist">{p.assists}A</span>}
                    <span className="scorer-chip pts">{p.points}PTS</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedGameId && (shotStats || pbpStats) && (
            <TeamStatsCard
              pbpStats={pbpStats} shotStats={shotStats}
              abbr={abbr} oppAbbr={oppAbbr}
              color={color} oppColor={oppColor}
              faceoffStats={faceoffStats}
              teamId={teamId}
            />
          )}

          {/* Goalie card from gameSummary */}
          {selectedGameId && goalieStats.length > 0 && (
            <GoalieCard
              goalies={goalieStats}
              teamId={teamId}
              abbr={abbr}
              oppAbbr={oppAbbr}
              color={color}
              oppColor={oppColor}
            />
          )}
        </div>
      </div>

      <div style={{ fontSize:10, color:'var(--text-dim)', textAlign:'center', padding:'8px 16px' }}>
        {selectedGameId ? 'Tap any card or danger zone to drill down · ' : ''}
        Coordinates normalised to attacking direction · Source: HockeyTech / PWHL
      </div>

      {drillStat && (
        <StatDrillPopup drillStat={drillStat} onClose={() => setDrill(null)} abbr={abbr} oppAbbr={oppAbbr} color={color} />
      )}

      {/* ── Game event popups ── */}
      {puckDropPopup && <PWHLPuckDropPopup data={puckDropPopup}  onClose={clearPuckDropPopup} />}
      {goalPopup     && <PWHLGoalPopup     data={goalPopup}      onClose={clearGoalPopup}    />}
      {hatTrickPopup && <HatTrickPopup      data={hatTrickPopup}  onClose={clearHatTrickPopup} />}
      {penaltyPopup  && <PWHLPenaltyPopup  data={penaltyPopup}   onClose={clearPenaltyPopup} />}
      {winPopup      && <PWHLWinPopup      data={winPopup}       onClose={clearWinPopup}     />}

      {/* ── Debug popups ── */}
      {debugGoalPopup    && <PWHLGoalPopup     data={debugGoalPopup}    onClose={() => setDebugGoalPopup(null)}    />}
      {debugHatTrickPopup && <HatTrickPopup      data={debugHatTrickPopup} onClose={() => setDebugHatTrickPopup(null)} />}
      {debugPenaltyPopup && <PWHLPenaltyPopup  data={debugPenaltyPopup} onClose={() => setDebugPenaltyPopup(null)} />}
      {debugWinPopup     && <PWHLWinPopup      data={debugWinPopup}     onClose={() => setDebugWinPopup(null)}     />}
      {debugPuckPopup    && <PWHLPuckDropPopup  data={debugPuckPopup}    onClose={() => setDebugPuckPopup(null)}    />}

      {/* ── Period / Game Summary popup ── */}
      {viewingSummary && (
        <PWHLPeriodSummary
          summary={viewingSummary}
          onDismiss={() => { setViewingSummaryPeriod(null); dismissNewSummary(); }}
          onNarrativeReady={(period, narrative) => {
            if (viewingSummary.isGameSummary) updateGameNarrative(narrative);
            else updateSummaryNarrative(period, narrative);
          }}
          carAbbr={abbr}
          oppAbbr={oppAbbr || 'OPP'}
          homeAbbr={scoreBarData?.isHome ? abbr : (oppAbbr || 'OPP')}
        />
      )}

      {/* ── Debug panel (5 taps on score card, dev only) ── */}
      {import.meta.env.DEV && debugOpen && (
        <div className="debug-panel">
          <div className="debug-panel-header">
            <div>
              <div className="debug-panel-title">🛠 PWHL Event Debug</div>
              <div className="debug-panel-sub">Tap to fire game events</div>
            </div>
            <button className="debug-close-btn" onClick={() => setDebugOpen(false)}>✕</button>
          </div>
          <div className="debug-panel-cols">
            <div>
              <div className="debug-section-label">Popups</div>
              <div className="debug-panel-btns">
                <button className="debug-btn goal" onClick={() => setDebugGoalPopup({
                  scorer: 'Marie-Philip Poulin', assists: ['Laura Stacey', 'Kayla Kosowski'],
                  shotType: 'Wrist', isPowerPlay: false, isShortHanded: false,
                  isEmptyNet: false, isPenaltyShot: false, periodLabel: 'P2', time: '14:32',
                })}>🚨 Goal</button>
                <button className="debug-btn goal" onClick={() => setDebugGoalPopup({
                  scorer: 'Laura Stacey', assists: [],
                  shotType: 'Snap', isPowerPlay: true, isShortHanded: false,
                  isEmptyNet: false, isPenaltyShot: false, periodLabel: 'P1', time: '08:11',
                })}>⚡ PP Goal</button>
                <button className="debug-btn" style={{ background: 'rgba(204,34,0,0.15)', color: 'var(--red-bright)' }}
                  onClick={() => setDebugPuckPopup({ gameId: 'debug' })}>🏒 Puck Drop</button>
                <button className="debug-btn penalty" onClick={() => setDebugPenaltyPopup({
                  id: 'debug-1', player: 'Blayre Turnbull',
                  desc: 'Tripping', severity: null, duration: 2, periodLabel: 'P2', time: '08:17',
                })}>⚡ PP Alert</button>
                <button className="debug-btn penalty" onClick={() => setDebugPenaltyPopup({
                  id: 'debug-2', player: 'Sarah Nurse',
                  desc: 'Fighting', severity: 'Major', duration: 5, periodLabel: 'P3', time: '12:04',
                })}>🟠 Major</button>
                <button className="debug-btn win" onClick={() => setDebugWinPopup({
                  teamAbbr: abbr || 'MTL',
                  score: `${abbr || 'MTL'} 3 – BOS 2`,
                })}>🏆 Win</button>
                <button className="debug-btn" style={{ background: 'rgba(200,169,81,0.15)', color: '#c8a951' }}
                  onClick={() => setDebugHatTrickPopup({
                    scorer: 'Marie-Philip Poulin', assists: ['Laura Stacey'],
                    shotType: 'Wrist', isPowerPlay: false, isShortHanded: false,
                    isEmptyNet: false, isPenaltyShot: false, periodLabel: 'P3', time: '11:22',
                    teamColor: color,
                  })}>🧢 Hat Trick</button>
              </div>
              <div className="debug-section-label">Situation</div>
              <div className="debug-panel-btns">
                <button className="debug-btn pp-car"
                  onClick={() => { setDebugSituation({ ourPP: true }); setTimeout(() => setDebugSituation(null), 15000); }}>
                  🟢 Our PP
                </button>
                <button className="debug-btn pp-opp"
                  onClick={() => { setDebugSituation({ oppPP: true }); setTimeout(() => setDebugSituation(null), 15000); }}>
                  🟡 Opp PP
                </button>
                <button className="debug-btn" style={{ background: 'rgba(250,190,30,0.1)', color: '#fbbf24' }}
                  onClick={() => { setDebugSituation({ ourEN: true }); setTimeout(() => setDebugSituation(null), 15000); }}>
                  🥅 Our EN
                </button>
                <button className="debug-btn" style={{ background: 'rgba(250,190,30,0.1)', color: '#fbbf24' }}
                  onClick={() => { setDebugSituation({ oppEN: true }); setTimeout(() => setDebugSituation(null), 15000); }}>
                  🥅 Opp EN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
