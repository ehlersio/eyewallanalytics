import React, { useState, useEffect } from 'react';
import { useFetch } from '../hooks/useFetch';
import { savePrediction, getPredictionStats, recordOutcome } from '../utils/predictionStore';
import { capture } from '../utils/analytics';
import ScoutingTab from '../components/ScoutingTab';
import InfoTip from '../components/InfoTip';
import { computeShotAttempts, computePDO, computePuckLuck, computeGSAx } from '../utils/advancedStats';
import { getTeamLines } from '../utils/supabaseClient';
import {
  getOpponent, isHomeGame, TEAM_COLORS,
  getStandings, findGameOdds, oddsToImplied, fmtOdds,
} from '../utils/nhlApi';
import { StatBar } from '../components/StatBar';
import PredictionExportSection from '../components/PredictionShareCanvas';

const CAR_ABBR = 'CAR';

function computeWinPct(carStanding, oppStanding, game, playoffSeries) {
  if (!carStanding || !oppStanding) return null;
  const isPlayoff = game?.gameType === 3;
  const isHome    = game?.homeTeam?.abbrev === 'CAR';
  const cgp = carStanding.gamesPlayed || 1;
  const ogp = oppStanding.gamesPlayed || 1;
  const carGpg = (carStanding.goalFor     ?? 0) / cgp;
  const oppGpg = (oppStanding.goalFor     ?? 0) / ogp;
  const carGag = (carStanding.goalAgainst ?? 0) / cgp;
  const oppGag = (oppStanding.goalAgainst ?? 0) / ogp;
  const carSF  = carStanding.shotsForPerGame || 0;
  const oppSF  = oppStanding.shotsForPerGame || 0;
  const carPP  = typeof carStanding.powerPlayPct === 'number'
    ? (carStanding.powerPlayPct <= 1 ? carStanding.powerPlayPct * 100 : carStanding.powerPlayPct) : 22;
  const oppPK  = typeof oppStanding.penaltyKillPct === 'number'
    ? (oppStanding.penaltyKillPct <= 1 ? oppStanding.penaltyKillPct * 100 : oppStanding.penaltyKillPct) : 80;

  let cs = 0, os = 0;
  if (carGpg > oppGpg) cs += 0.7; else os += 0.7;
  if (carGag < oppGag) cs += 0.7; else os += 0.7;
  if (carSF  > oppSF)  cs += 0.5; else os += 0.5;
  if ((carPP - (100 - oppPK)) > 0) cs += 0.4; else os += 0.4;
  if (!isPlayoff) {
    const ptsDiff = (carStanding.points ?? 0) - (oppStanding.points ?? 0);
    if (ptsDiff > 0) cs += Math.min(ptsDiff / 20, 0.5);
    else             os += Math.min(-ptsDiff / 20, 0.5);
  }
  if (carStanding.streakCode === 'W') cs += 0.3;
  if (oppStanding.streakCode === 'W') os += 0.3;
  if (isHome) cs += 0.25; else os += 0.25;

  // Playoff series record
  if (isPlayoff && playoffSeries) {
    const oppAbbr = isHome ? game.awayTeam?.abbrev : game.homeTeam?.abbrev;
    const round   = (() => {
      const id = String(game.id);
      return (id.length === 10 && id.slice(4,6) === '03') ? parseInt(id[7], 10) : null;
    })();
    const s = playoffSeries.find(s => s.round === round && s.opponent?.abbrev === oppAbbr);
    if (s) {
      const lead = s.carWins - s.oppWins;
      if (lead > 0) cs += Math.min(lead * 0.5, 1.0);
      else if (lead < 0) os += Math.min(-lead * 0.5, 1.0);
    }
  }

  const t = cs + os || 1;
  const pct = Math.round(cs / t * 100);
  return { pct, favoured: pct >= 50 };
}

// ── Matchup detail (upcoming games) ─────────────────────────

// ── Top line callout for Prediction tab ──────────────────────
function TopLineCard({ carLines }) {
  const line = carLines?.lines?.[0];
  if (!line) return null;
  const xgf  = line.xgfPct;
  const good = xgf != null && xgf >= 50;
  const POS_LABEL = { L: 'LW', LW: 'LW', C: 'C', R: 'RW', RW: 'RW', D: 'D' };
  return (
    <div className="md-topline-card">
      <div className="md-topline-header">
        <span className="md-topline-label">CAR Line 1 · 5v5 this season</span>
        {xgf != null && (
          <span className={`md-topline-xgf ${good ? 'good' : 'bad'}`}>
            {xgf.toFixed(1)}% xGF
          </span>
        )}
      </div>
      <div className="md-topline-players">
        {line.players.map((p, i) => (
          <span key={i} className="md-topline-player">
            <span className="md-topline-pos">{POS_LABEL[p.pos] || p.pos}</span>
            {p.name}
          </span>
        ))}
      </div>
      {line.toiMins != null && (
        <div className="md-topline-toi">{line.toiMins}m together · inferred from shift data</div>
      )}
    </div>
  );
}

function MatchupDetail({ game, oppStanding, carStanding, odds, playoffSeries }) {
  const [mdTab, setMdTab] = React.useState('prediction');
  const opp     = getOpponent(game);
  const oppAbbr = opp?.abbrev || 'OPP';
  const oppColor = TEAM_COLORS[oppAbbr] || '#7a8899';
  const gameType = playoffSeries ? 3 : 2;
  const { data: carLines } = useFetch(() => getTeamLines('CAR', 20252026, gameType), ['CAR', gameType]);

  // Auto-save prediction — must be before any early returns (Rules of Hooks)
  React.useEffect(() => {
    if (!game?.id || !carStanding || !oppStanding) return;
    const cgp   = carStanding.gamesPlayed || 1;
    const ogp   = oppStanding.gamesPlayed || 1;
    const cGpg  = (carStanding.goalFor     ?? 0) / cgp;
    const oGpg  = (oppStanding.goalFor     ?? 0) / ogp;
    const cGag  = (carStanding.goalAgainst ?? 0) / cgp;
    const oGag  = (oppStanding.goalAgainst ?? 0) / ogp;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const isHome_ = game.homeTeam?.abbrev === 'CAR';
    const adj     = isHome_ ? 0.12 : -0.12;
    const pCar    = +(clamp(Math.sqrt(Math.max(cGpg,0.5)*Math.max(oGag,0.5))+adj,1.5,5.0)).toFixed(1);
    const pOpp    = +(clamp(Math.sqrt(Math.max(oGpg,0.5)*Math.max(cGag,0.5))-adj,1.5,5.0)).toFixed(1);
    const cPts    = carStanding.points ?? 0;
    const oPts    = oppStanding.points ?? 0;
    savePrediction({
      gameId:            game.id,
      gameDate:          game.gameDate,
      opponent:          oppAbbr,
      predictedCarWin:   cPts >= oPts,
      predictedCarPct:   Math.round(cPts / (cPts + oPts + 1) * 100),
      predictedCarScore: pCar,
      predictedOppScore: pOpp,
    });
    capture('prediction_viewed', {
      gameId:      game.id,
      opponent:    oppAbbr,
      isPlayoff:   game.gameType === 3,
      predictedWin: cPts >= oPts,
      carPct:      Math.round(cPts / (cPts + oPts + 1) * 100),
    });
  }, [game?.id]);

  // Guard: if standings data unavailable show a graceful message with debug info
  if (!carStanding || !oppStanding) {
    return (
      <div className="matchup-detail card">
        <div className="md-note">
          📊 Loading standings data…
          {!carStanding && ' CAR standings not found.'}
          {!oppStanding && ` ${oppAbbr} standings not found.`}
        </div>
        {odds && (
          <div className="md-odds-row" style={{ marginTop: 12 }}>
            <div className="md-odds-item">
              <span className="md-odds-team" style={{ color: 'var(--red-bright)' }}>CAR</span>
              <span className={`md-odds-val ${odds.carOdds < 0 ? 'fav' : 'dog'}`}>{fmtOdds(odds.carOdds)}</span>
              <span className="md-odds-implied">{oddsToImplied(odds.carOdds)}% implied</span>
            </div>
            <div className="md-odds-book">{odds.book}</div>
            <div className="md-odds-item right">
              <span className="md-odds-team" style={{ color: oppColor }}>{oppAbbr}</span>
              <span className={`md-odds-val ${odds.oppOdds < 0 ? 'fav' : 'dog'}`}>{fmtOdds(odds.oppOdds)}</span>
              <span className="md-odds-implied">{oddsToImplied(odds.oppOdds)}% implied</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  const carGp  = carStanding.gamesPlayed || 1;
  const oppGp  = oppStanding.gamesPlayed || 1;
  const carGpg = (carStanding.goalFor  ?? 0) / carGp;
  const oppGpg = (oppStanding.goalFor  ?? 0) / oppGp;
  const carGag = (carStanding.goalAgainst ?? 0) / carGp;
  const oppGag = (oppStanding.goalAgainst ?? 0) / oppGp;
  const carWin = (carStanding.wins ?? 0) / carGp;
  const oppWin = (oppStanding.wins ?? 0) / oppGp;
  const carPts = carStanding.points ?? 0;
  const oppPts = oppStanding.points ?? 0;
  const carPP  = carStanding.powerPlayPct ?? 22;
  const oppPK  = oppStanding.penaltyKillPct ?? 80;
  const carPK  = carStanding.penaltyKillPct ?? 80;
  const oppPP  = oppStanding.powerPlayPct ?? 22;

  // Series record this playoff round (if applicable)
  const id = String(game.id);
  const round = (id.length === 10 && id.slice(4,6) === '03') ? parseInt(id[7], 10) : null;
  const seriesEntry = playoffSeries?.find(
    s => s.round === round && s.opponent?.abbrev === oppAbbr
  );

  // ── Win probability — uses shared model (matches game card chip) ──
  const isPlayoff_  = game?.gameType === 3;
  const isHome_     = game?.homeTeam?.abbrev === 'CAR';

  const topLine    = carLines?.lines?.[0] ?? null;
  const topLineXgf = topLine?.xgfPct ?? null;

  // Re-derive factors for display (mirrors computeWinPct logic)
  const carSF    = carStanding.shotsForPerGame || 0;
  const oppSF    = oppStanding.shotsForPerGame || 0;
  const ppEdge   = carPP - (100 - oppPK);
  const carStreak = carStanding.streakCode;
  const oppStreak = oppStanding.streakCode;
  const factors  = [
    { label: 'Offence (GF/GP)',    carEdge: carGpg >= oppGpg },
    { label: 'Defence (GA/GP)',    carEdge: carGag <= oppGag },
    { label: 'Possession (SOG/GP)', carEdge: carSF >= oppSF },
    { label: 'PP vs PK',           carEdge: ppEdge >= 0 },
    ...(!isPlayoff_ ? [{ label: 'Standings', carEdge: carPts >= oppPts }] : []),
    ...((carStreak || oppStreak) ? [{ label: 'Recent form', carEdge: carStreak === 'W' && oppStreak !== 'W' }] : []),
    { label: 'Home ice',           carEdge: isHome_ },
    ...(isPlayoff_ && seriesEntry ? [{ label: 'Series lead', carEdge: (seriesEntry.carWins - seriesEntry.oppWins) >= 0 }] : []),
    ...(topLineXgf != null ? [{ label: 'Top line (5v5 xGF%)', carEdge: topLineXgf >= 50 }] : []),
  ];

  // Get model win % from shared function
  const winResult  = computeWinPct(carStanding, oppStanding, game, playoffSeries);
  const carImplied = odds ? oddsToImplied(odds.carOdds) : null;
  const oppImplied = odds ? oddsToImplied(odds.oppOdds) : null;

  // Blend with market odds if available (60/40)
  let carModelPct = winResult?.pct ?? 50;
  if (carImplied) carModelPct = Math.round(carModelPct * 0.6 + carImplied * 0.4);
  const carFavoured = carModelPct >= 50;

  const modelTooltip = [
    'How we predict:',
    '• GF/GP & GA/GP — offensive and defensive efficiency',
    '• SOG/GP — possession proxy (shot attempt share)',
    '• PP vs PK matchup — special teams edge',
    isPlayoff_ ? '• Series record — current series lead/deficit' : '• Standings points — season performance',
    '• Recent form — current streak',
    '• Home ice — ~0.25 goal advantage',
    topLineXgf != null ? `• Top line 5v5 xGF% — ${topLineXgf.toFixed(1)}% this season` : null,
    carImplied ? '• Market odds — 40% weight when available' : null,
    isPlayoff_ ? 'Playoff mode: standings points excluded.' : null,
  ].filter(Boolean).join('\n');


  // ── Score prediction (Pythagorean expectation) ───────────
  // Expected goals = geometric mean of team's attack rate vs opponent's defense rate.
  // Home teams average ~0.15 more goals, away ~0.15 less.
  const isHomeGame_  = game?.homeTeam?.abbrev === CAR_ABBR ||
                       game?.homeTeam?.abbrev === 'CAR';
  const homeAdj      = isHomeGame_ ? 0.12 : -0.12;
  const rawCarExp    = Math.sqrt(Math.max(carGpg, 0.5) * Math.max(oppGag, 0.5));
  const rawOppExp    = Math.sqrt(Math.max(oppGpg, 0.5) * Math.max(carGag, 0.5));
  // Clamp to realistic NHL range (1.5 – 5.0 per team)
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const predCarScore = +(clamp(rawCarExp + homeAdj, 1.5, 5.0)).toFixed(1);
  const predOppScore = +(clamp(rawOppExp - homeAdj, 1.5, 5.0)).toFixed(1);

  // ── Save prediction + track record ───────────────────────
  const predStats   = getPredictionStats();
  const { useEffect } = window.React || {};

  return (
    <div className="matchup-detail card">
      {/* Tab bar: Prediction vs Scouting */}
      <div className="md-tabs">
        <button className={`md-tab${mdTab === 'prediction' ? ' active' : ''}`}
          onClick={() => setMdTab('prediction')}>Prediction</button>
        <button className={`md-tab${mdTab === 'scouting' ? ' active' : ''}`}
          onClick={() => { setMdTab('scouting'); capture('scouting_tab_viewed', { gameId: game?.id, opponent: oppAbbr, isPlayoff: game?.gameType === 3 }); }}>Scouting</button>
      </div>

      {mdTab === 'scouting' ? (
        <ScoutingTab oppAbbr={oppAbbr} oppStanding={oppStanding} carStanding={carStanding} isPlayoff={game?.gameType === 3} />
      ) : (<>
      <div className="md-header">
        <div>
          <span className="md-title">CAR vs {oppAbbr} — Matchup breakdown</span>
          {predStats.total > 0 && (
            <div className="md-track-record" >
              📊 {predStats.correct}/{predStats.total} correct ({predStats.pct}%)
            </div>
          )}
        </div>
      </div>

      {/* Series score if in playoffs */}
      {seriesEntry && (
        <div className="md-series-score">
          <span style={{ color: 'var(--red-bright)' }}>CAR {seriesEntry.carWins}</span>
          <span style={{ color: 'var(--text-dim)' }}> – </span>
          <span style={{ color: oppColor }}>{seriesEntry.oppWins} {oppAbbr}</span>
          <span className="md-series-label">in this series</span>
        </div>
      )}

      {/* Win prediction bar */}
      <div className="md-prediction">
        <div className="md-pred-label">
          <span>Predicted win probability</span>
          <InfoTip text={modelTooltip} position="above" />
          {odds && <span className="md-pred-source">Stats + {odds.book} odds</span>}
          {!odds && <span className="md-pred-source">Based on season stats</span>}
        </div>
        <div className="md-pred-bar">
          <div className="md-pred-fill car" style={{ width: `${carModelPct}%` }}>
            {carModelPct >= 20 && <span>{carModelPct}%</span>}
          </div>
          <div className="md-pred-fill opp" style={{ width: `${100 - carModelPct}%` }}>
            {(100 - carModelPct) >= 20 && <span>{100 - carModelPct}%</span>}
          </div>
        </div>
        <div className="md-pred-teams">
          <span style={{ color: 'var(--red-bright)' }}>CAR</span>
          <span style={{ color: oppColor }}>{oppAbbr}</span>
        </div>
      </div>

      {/* Predicted score — auto-saved when card opens (useEffect at top of component) */}
      <div className="md-score-pred">
        <div className="md-score-pred-label">Predicted score</div>
        <div className="md-score-pred-val">
          <span style={{color:'var(--red-bright)'}}>CAR {predCarScore}</span>
          <span style={{color:'var(--text-dim)'}}> – </span>
          <span style={{color:oppColor}}>{oppAbbr} {predOppScore}</span>
        </div>
        <div className="md-score-pred-subtext">Expected goals projection</div>
        <div className="md-pred-note">Prediction auto-saved · {predStats.total > 0 ? `${predStats.correct}/${predStats.total} correct (${predStats.pct}%)` : 'No results yet'}</div>
      </div>

      {/* EyeWall AI Analysis */}
      <PredictionAnalysis gameId={game?.id} oppAbbr={oppAbbr} oppColor={oppColor} />

      {/* Odds row */}
      {odds && (
        <div className="md-odds-row">
          <div className="md-odds-item">
            <span className="md-odds-team" style={{ color: 'var(--red-bright)' }}>CAR</span>
            <span className={`md-odds-val ${odds.carOdds < 0 ? 'fav' : 'dog'}`}>{fmtOdds(odds.carOdds)}</span>
            <span className="md-odds-implied">{carImplied}% implied</span>
          </div>
          <div className="md-odds-book">{odds.book}</div>
          <div className="md-odds-item right">
            <span className="md-odds-team" style={{ color: oppColor }}>{oppAbbr}</span>
            <span className={`md-odds-val ${odds.oppOdds < 0 ? 'fav' : 'dog'}`}>{fmtOdds(odds.oppOdds)}</span>
            <span className="md-odds-implied">{oppImplied}% implied</span>
          </div>
        </div>
      )}
      {/* Odds unavailable — show nothing, no prompt needed */}

      {/* Stat comparison */}
      <div className="md-stats" style={{ marginTop: 12 }}>
        {!isPlayoff_ && (
          <StatBar label="Points in standings"
            leftPct={Math.round((carPts/(carPts+oppPts||1))*100)}
            leftVal={`CAR ${carPts}`} rightVal={`${oppAbbr} ${oppPts}`} />
        )}
        <StatBar label="Goals for / game"
          leftPct={Math.round((carGpg/(carGpg+oppGpg||1))*100)}
          leftVal={`CAR ${carGpg.toFixed(2)}`} rightVal={`${oppAbbr} ${oppGpg.toFixed(2)}`} />
        <StatBar label="Goals against / game"
          leftPct={Math.round((oppGag/(carGag+oppGag||1))*100)}
          leftVal={`CAR ${carGag.toFixed(2)}`} rightVal={`${oppAbbr} ${oppGag.toFixed(2)}`}
          leftColor="green" />
        <StatBar label="Win rate"
          leftPct={Math.round((carWin/(carWin+oppWin||1))*100)}
          leftVal={`CAR ${(carWin*100).toFixed(0)}%`} rightVal={`${oppAbbr} ${(oppWin*100).toFixed(0)}%`}
          leftColor="green" />
        <StatBar label="PP% vs opp PK%"
          leftPct={Math.round((carPP/(carPP+(100-oppPK)||1))*100)}
          leftVal={`CAR PP ${carPP.toFixed(1)}%`} rightVal={`${oppAbbr} PK ${oppPK.toFixed(1)}%`}
          leftColor={carPP > (100-oppPK) ? 'green' : 'red'} />
      </div>

      {/* Edge checklist */}
      <div className="md-factors">
        {factors.map((f, i) => (
          <div key={i} className={`md-factor ${f.carEdge ? 'car-edge' : 'opp-edge'}`}>
            <span>{f.carEdge ? '✓' : '✗'}</span>
            <span>{f.label}</span>
            <span>{f.carEdge ? 'CAR' : oppAbbr}</span>
          </div>
        ))}
      </div>

      {/* Top line card */}
      <TopLineCard carLines={carLines} />

      {/* Prediction export card */}
      <PredictionExportSection
        carModelPct={carModelPct}
        predCarScore={predCarScore}
        predOppScore={predOppScore}
        carGpg={carGpg}
        oppGpg={oppGpg}
        carGag={carGag}
        oppGag={oppGag}
        carWin={carWin}
        oppWin={oppWin}
        carPP={carPP}
        oppPK={oppPK}
        factors={factors}
        odds={odds}
        oppAbbr={oppAbbr}
        oppColor={oppColor}
        isPlayoff={isPlayoff_}
        seriesEntry={seriesEntry}
        gameId={game?.id}
        carLines={carLines}
      />
      </>)}
    </div>
  );
}
function PredictionAnalysis({ gameId, oppAbbr, oppColor }) {
  const [analysis,  setAnalysis]  = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [requested, setRequested] = useState(false);

  const workerUrl = import.meta.env.VITE_WORKER_URL;

  // Auto-load if already cached — no button press needed
  useEffect(() => {
    if (!gameId || !workerUrl) return;
    fetch(`${workerUrl}/cache/${encodeURIComponent(`prediction:${gameId}`)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.narrative) setAnalysis(d); })
      .catch(() => {});
  }, [gameId]);

  const fetchAnalysis = async () => {
    if (!workerUrl || !gameId) return;
    setLoading(true);
    setError(null);
    setRequested(true);
    capture('ai_analysis_requested', { gameId });
    try {
      const res  = await fetch(`${workerUrl}/prediction/analyze?gameId=${gameId}`);
      const data = await res.json();
      if (data.narrative) setAnalysis(data);
      else setError(data.error || 'Analysis unavailable');
    } catch {
      setError('Could not reach EyeWall AI');
    } finally {
      setLoading(false);
    }
  };

  if (!workerUrl) return null;

  return (
    <div className="md-ai-section">
      <div className="md-ai-header">
        <span className="md-ai-label">⚡ EyeWall AI</span>
        <InfoTip
          text="AI analysis synthesizes possession metrics, recent form, head-to-head record, and key matchup factors into a plain-English preview. Generated once and cached for all users."
          position="above"
        />
      </div>

      {analysis ? (
        <div className="md-ai-narrative">{analysis.narrative}</div>
      ) : loading ? (
        <div className="md-ai-loading">Analyzing matchup…</div>
      ) : error ? (
        <div className="md-ai-error">{error}</div>
      ) : (
        <button className="md-ai-btn" onClick={fetchAnalysis}>
          Get AI analysis
        </button>
      )}
    </div>
  );
}


export { MatchupDetail, computeWinPct };