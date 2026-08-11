import React, { useState, useEffect } from 'react';
import { useFetch } from '../hooks/useFetch';
import { savePrediction, getPredictionStats } from '../utils/predictionStore';
import { capture } from '../utils/analytics';
import ScoutingTab from '../components/ScoutingTab';
import InfoTip from '../components/InfoTip';
import { getTeamLines, getGamePrediction } from '../utils/supabaseClient';
import {
  getOpponent, TEAM_COLORS, TEAM_CONFIG,
  oddsToImplied, fmtOdds,
} from '../utils/nhlApi';
import { StatBar } from '../components/StatBar';
import PredictionExportSection from '../components/PredictionShareCanvas';

// Styling used to come from ScheduleView.css -- migrated to Tailwind here
// (Phase 6, ScheduleView.css sub-PR 5, the final sub-PR -- ScheduleView.css
// is now fully deleted). .md-tab:hover/.active are equal-specificity
// compound selectors in the original CSS with active winning on hover too
// (later in source) -- same shape as .sort-btn/.vm-btn/.skater-toggle-btn
// from earlier sub-PRs, so hover is scoped to the non-active variant only.
// .md-export-btn, .md-ai-btn, and .md-save-pred-btn were confirmed
// genuinely dead (zero JSX consumers anywhere) and dropped rather than
// migrated -- .md-export-btn's dead-CSS status was already confirmed
// during the original Phase 6 investigation (the real button now lives in
// ShareButtons.jsx) and its own stale Cypress test was fixed separately.
// .md-track-record's CSS rule was left behind when its own JSX was already
// migrated in sub-PR 1 -- dropped here as a loose end, no JSX change needed.
const MD_ODDS_ITEM_CLASSES = 'md-odds-item flex flex-col gap-0.5';
const MD_ODDS_TEAM_CLASSES = 'md-odds-team text-[10px] text-[color:var(--text-dim)]';
const MD_ODDS_IMPLIED_CLASSES = 'md-odds-implied text-[10px] text-[color:var(--text-dim)]';
const mdOddsValClasses = (fav) =>
  `md-odds-val font-[family-name:var(--font-mono)] text-[18px] font-bold ${fav ? 'fav text-[color:var(--green)]' : 'dog text-[color:var(--amber)]'}`;
const MD_ODDS_ROW_CLASSES = 'md-odds-row flex items-center justify-between bg-[var(--bg3)] rounded-[var(--radius-sm)] py-2.5 px-3 mb-3';

const mdTabClasses = (active) => {
  const base = 'md-tab flex-1 bg-none border-none py-[9px] px-3 text-[12px] font-semibold cursor-pointer border-b-2 -mb-px [transition:color_0.15s] min-h-0';
  return active
    ? `${base} active text-[color:var(--red-bright)] border-b-[color:var(--red-bright)]`
    : `${base} border-b-transparent text-[color:var(--text-dim)] hover:text-[color:var(--text-muted)]`;
};

const MD_AI_SECTION_CLASSES = 'md-ai-section mt-3 mb-3.5 py-3 px-3.5 rounded-[10px] border-[0.5px] border-[rgba(204,34,0,0.2)] bg-[linear-gradient(135deg,var(--bg2)_0%,rgba(204,34,0,0.05)_100%)]';
const MD_AI_LABEL_CLASSES = 'md-ai-label text-[10px] font-bold uppercase tracking-[0.07em] text-[color:var(--red-bright)]';

function computeWinPct(carStanding, oppStanding, game, playoffSeries) {
  if (!carStanding || !oppStanding) return null;
  const isPlayoff = game?.gameType === 3;
  const isHome    = game?.homeTeam?.abbrev === TEAM_CONFIG.abbr;
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
    <div className="md-topline-card bg-[var(--bg2)] border-[0.5px] border-[color:var(--border)] rounded-[10px] py-3 px-3.5 my-2.5 mt-2 mb-1">
      <div className="md-topline-header flex items-center justify-between mb-[7px]">
        <span className="md-topline-label text-[10px] font-bold uppercase tracking-[0.07em] text-[color:var(--text-dim)]">{TEAM_CONFIG.abbr} Line 1 · 5v5 this season</span>
        {xgf != null && (
          <span className={`md-topline-xgf text-[13px] font-extrabold font-[family-name:var(--font-mono)] ${good ? 'good text-[color:var(--green)]' : 'bad text-[color:var(--red-bright)]'}`}>
            {xgf.toFixed(1)}% xGF
          </span>
        )}
      </div>
      <div className="md-topline-players flex flex-wrap gap-x-3 gap-y-1 mb-1.5">
        {line.players.map((p, i) => (
          <span key={i} className="md-topline-player text-[13px] font-semibold text-[color:var(--text)] flex items-baseline gap-[3px]">
            <span className="md-topline-pos text-[10px] text-[color:var(--text-dim)] font-medium">{POS_LABEL[p.pos] || p.pos}</span>
            {p.name}
          </span>
        ))}
      </div>
      {line.toiMins != null && (
        <div className="md-topline-toi text-[10px] text-[color:var(--text-dim)] italic">{line.toiMins}m together · inferred from shift data</div>
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
  const { data: carLines } = useFetch(() => getTeamLines(TEAM_CONFIG.abbr, TEAM_CONFIG.season, gameType), [TEAM_CONFIG.abbr, TEAM_CONFIG.season, gameType]);

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
    const isHome_ = game.homeTeam?.abbrev === TEAM_CONFIG.abbr;
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

  // Guard: no current-season standings to build a prediction from. Not just
  // a loading flash — ScheduleView.jsx withholds carStanding/oppStanding
  // entirely once the season flips and the NHL's own live standings feed
  // hasn't caught up to it yet, which is the steady state for most of the
  // preseason, not a rare edge case.
  if (!carStanding || !oppStanding) {
    return (
      <div className="matchup-detail card mb-2 -mt-1">
        <div className="md-note text-[11px] text-[color:var(--text-dim)] bg-[var(--bg3)] rounded-[var(--radius-sm)] py-2 px-2.5 mt-2">
          📊 Prediction needs this season's standings — not available until games begin.
        </div>
        {odds && (
          <div className={MD_ODDS_ROW_CLASSES} style={{ marginTop: 12 }}>
            <div className={MD_ODDS_ITEM_CLASSES}>
              <span className={MD_ODDS_TEAM_CLASSES} style={{ color: 'var(--team-primary)' }}>{TEAM_CONFIG.abbr}</span>
              <span className={mdOddsValClasses(odds.carOdds < 0)}>{fmtOdds(odds.carOdds)}</span>
              <span className={MD_ODDS_IMPLIED_CLASSES}>{oddsToImplied(odds.carOdds)}% implied</span>
            </div>
            <div className="md-odds-book text-[10px] text-[color:var(--text-dim)] text-center">{odds.book}</div>
            <div className={`${MD_ODDS_ITEM_CLASSES} right items-end`}>
              <span className={MD_ODDS_TEAM_CLASSES} style={{ color: oppColor }}>{oppAbbr}</span>
              <span className={mdOddsValClasses(odds.oppOdds < 0)}>{fmtOdds(odds.oppOdds)}</span>
              <span className={MD_ODDS_IMPLIED_CLASSES}>{oddsToImplied(odds.oppOdds)}% implied</span>
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

  // Series record this playoff round (if applicable)
  const id = String(game.id);
  const round = (id.length === 10 && id.slice(4,6) === '03') ? parseInt(id[7], 10) : null;
  const seriesEntry = playoffSeries?.find(
    s => s.round === round && s.opponent?.abbrev === oppAbbr
  );

  // ── Win probability — uses shared model (matches game card chip) ──
  const isPlayoff_  = game?.gameType === 3;
  const isHome_     = game?.homeTeam?.abbrev === TEAM_CONFIG.abbr;

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
  const isHomeGame_  = game?.homeTeam?.abbrev === TEAM_CONFIG.abbr;
  const homeAdj      = isHomeGame_ ? 0.12 : -0.12;
  const rawCarExp    = Math.sqrt(Math.max(carGpg, 0.5) * Math.max(oppGag, 0.5));
  const rawOppExp    = Math.sqrt(Math.max(oppGpg, 0.5) * Math.max(carGag, 0.5));
  // Clamp to realistic NHL range (1.5 – 5.0 per team)
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const predCarScore = +(clamp(rawCarExp + homeAdj, 1.5, 5.0)).toFixed(1);
  const predOppScore = +(clamp(rawOppExp - homeAdj, 1.5, 5.0)).toFixed(1);

  // ── Save prediction + track record ───────────────────────
  const predStats   = getPredictionStats();
  return (
    <div className="matchup-detail card mb-2 -mt-1">
      {/* Tab bar: Prediction vs Scouting */}
      <div className="md-tabs flex gap-0 border-b-[0.5px] border-b-[color:var(--border)] mb-3">
        <button className={mdTabClasses(mdTab === 'prediction')}
          onClick={() => setMdTab('prediction')}>Prediction</button>
        <button className={mdTabClasses(mdTab === 'scouting')}
          onClick={() => { setMdTab('scouting'); capture('scouting_tab_viewed', { gameId: game?.id, opponent: oppAbbr, isPlayoff: game?.gameType === 3 }); }}>Scouting</button>
      </div>

      {mdTab === 'scouting' ? (
        <ScoutingTab oppAbbr={oppAbbr} oppStanding={oppStanding} carStanding={carStanding} isPlayoff={game?.gameType === 3} gameId={game?.id} />
      ) : (<>
      <div className="md-header mb-3">
        <div>
          <span className="md-title text-[13px] font-medium">{TEAM_CONFIG.abbr} vs {oppAbbr} — Matchup breakdown</span>
          {predStats.total > 0 && (
            <div className="md-track-record text-[10px] text-[color:var(--text-muted)] mt-0.5" >
              📊 {predStats.correct}/{predStats.total} correct ({predStats.pct}%)
            </div>
          )}
        </div>
      </div>

      {/* Series score if in playoffs */}
      {seriesEntry && (
        <div className="md-series-score font-[family-name:var(--font-display)] text-[16px] font-bold mb-3 flex items-center gap-1">
          <span style={{ color: 'var(--team-primary)' }}>{TEAM_CONFIG.abbr} {seriesEntry.carWins}</span>
          <span style={{ color: 'var(--text-dim)' }}> – </span>
          <span style={{ color: oppColor }}>{seriesEntry.oppWins} {oppAbbr}</span>
          <span className="md-series-label text-[11px] text-[color:var(--text-dim)] font-normal font-[family-name:var(--font-body)] ml-1.5">in this series</span>
        </div>
      )}

      {/* Win prediction bar */}
      <div className="md-prediction mb-3.5">
        <div className="md-pred-label flex justify-between text-[11px] text-[color:var(--text-muted)] mb-1.5">
          <span>Predicted win probability</span>
          <InfoTip text={modelTooltip} position="above" />
          {odds && <span className="md-pred-source text-[10px] text-[color:var(--text-dim)]">Stats + {odds.book} odds</span>}
          {!odds && <span className="md-pred-source text-[10px] text-[color:var(--text-dim)]">Based on season stats</span>}
        </div>
        <div className="md-pred-bar h-7 rounded-[var(--radius-sm)] flex overflow-hidden mb-1">
          <div className="md-pred-fill car h-full flex items-center justify-center font-[family-name:var(--font-display)] text-[13px] font-bold text-[#fff] [transition:width_0.4s_ease] bg-[var(--red)]" style={{ width: `${carModelPct}%` }}>
            {carModelPct >= 20 && <span>{carModelPct}%</span>}
          </div>
          <div className="md-pred-fill opp h-full flex items-center justify-center font-[family-name:var(--font-display)] text-[13px] font-bold text-[#fff] [transition:width_0.4s_ease] bg-[var(--blue)]" style={{ width: `${100 - carModelPct}%` }}>
            {(100 - carModelPct) >= 20 && <span>{100 - carModelPct}%</span>}
          </div>
        </div>
        <div className="md-pred-teams flex justify-between text-[11px] font-semibold mt-0.5">
          <span style={{ color: 'var(--team-primary)' }}>{TEAM_CONFIG.abbr}</span>
          <span style={{ color: oppColor }}>{oppAbbr}</span>
        </div>
      </div>

      {/* Predicted score — auto-saved when card opens (useEffect at top of component) */}
      <div className="md-score-pred text-center mt-2.5 mb-1">
        <div className="md-score-pred-label text-[10px] text-[color:var(--text-dim)] mb-1">Predicted score</div>
        <div className="md-score-pred-val font-[family-name:var(--font-display)] text-[20px] font-bold">
          <span style={{color:'var(--team-primary)'}}>{TEAM_CONFIG.abbr} {predCarScore}</span>
          <span style={{color:'var(--text-dim)'}}> – </span>
          <span style={{color:oppColor}}>{oppAbbr} {predOppScore}</span>
        </div>
        <div className="md-score-pred-subtext text-[9px] text-[color:var(--text-dim)] text-center mt-0.5 uppercase tracking-[0.06em]">Expected goals projection</div>
        <div className="md-pred-note text-[10px] text-[color:var(--text-dim)] text-center mt-1.5">Prediction auto-saved · {predStats.total > 0 ? `${predStats.correct}/${predStats.total} correct (${predStats.pct}%)` : 'No results yet'}</div>
      </div>

      {/* EyeWall AI Analysis */}
      <PredictionAnalysis gameId={game?.id} oppAbbr={oppAbbr} oppColor={oppColor} />

      {/* Odds row */}
      {odds && (
        <div className={MD_ODDS_ROW_CLASSES}>
          <div className={MD_ODDS_ITEM_CLASSES}>
            <span className={MD_ODDS_TEAM_CLASSES} style={{ color: 'var(--team-primary)' }}>{TEAM_CONFIG.abbr}</span>
            <span className={mdOddsValClasses(odds.carOdds < 0)}>{fmtOdds(odds.carOdds)}</span>
            <span className={MD_ODDS_IMPLIED_CLASSES}>{carImplied}% implied</span>
          </div>
          <div className="md-odds-book text-[10px] text-[color:var(--text-dim)] text-center">{odds.book}</div>
          <div className={`${MD_ODDS_ITEM_CLASSES} right items-end`}>
            <span className={MD_ODDS_TEAM_CLASSES} style={{ color: oppColor }}>{oppAbbr}</span>
            <span className={mdOddsValClasses(odds.oppOdds < 0)}>{fmtOdds(odds.oppOdds)}</span>
            <span className={MD_ODDS_IMPLIED_CLASSES}>{oppImplied}% implied</span>
          </div>
        </div>
      )}
      {/* Odds unavailable — show nothing, no prompt needed */}

      {/* Stat comparison */}
      <div className="md-stats mb-2.5" style={{ marginTop: 12 }}>
        {!isPlayoff_ && (
          <StatBar label="Points in standings"
            leftPct={Math.round((carPts/(carPts+oppPts||1))*100)}
            leftVal={`${TEAM_CONFIG.abbr} ${carPts}`} rightVal={`${oppAbbr} ${oppPts}`} />
        )}
        <StatBar label="Goals for / game"
          leftPct={Math.round((carGpg/(carGpg+oppGpg||1))*100)}
          leftVal={`${TEAM_CONFIG.abbr} ${carGpg.toFixed(2)}`} rightVal={`${oppAbbr} ${oppGpg.toFixed(2)}`} />
        <StatBar label="Goals against / game"
          leftPct={Math.round((oppGag/(carGag+oppGag||1))*100)}
          leftVal={`${TEAM_CONFIG.abbr} ${carGag.toFixed(2)}`} rightVal={`${oppAbbr} ${oppGag.toFixed(2)}`}
          leftColor="green" />
        <StatBar label="Win rate"
          leftPct={Math.round((carWin/(carWin+oppWin||1))*100)}
          leftVal={`${TEAM_CONFIG.abbr} ${(carWin*100).toFixed(0)}%`} rightVal={`${oppAbbr} ${(oppWin*100).toFixed(0)}%`}
          leftColor="green" />
        <StatBar label="PP% vs opp PK%"
          leftPct={Math.round((carPP/(carPP+(100-oppPK)||1))*100)}
          leftVal={`${TEAM_CONFIG.abbr} PP ${carPP.toFixed(1)}%`} rightVal={`${oppAbbr} PK ${oppPK.toFixed(1)}%`}
          leftColor={carPP > (100-oppPK) ? 'green' : 'red'} />
      </div>

      {/* Edge checklist */}
      <div className="md-factors flex flex-col gap-1 mt-2.5 pt-2.5 border-t-[0.5px] border-t-[color:var(--border)]">
        {factors.map((f, i) => (
          <div key={i} className={`md-factor grid gap-2 text-[11px] py-[3px] items-center [grid-template-columns:16px_1fr_auto] ${f.carEdge ? 'car-edge text-[color:var(--green)]' : 'opp-edge text-[color:var(--text-muted)] [&>span:first-child]:text-[color:var(--red-bright)]'}`}>
            <span>{f.carEdge ? '✓' : '✗'}</span>
            <span>{f.label}</span>
            <span>{f.carEdge ? TEAM_CONFIG.abbr : oppAbbr}</span>
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
function PredictionAnalysis({ gameId, _oppAbbr, _oppColor }) {
  const [analysis,  setAnalysis]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const workerUrl = import.meta.env.VITE_WORKER_URL;

  // DB-first: fetch pre-generated prediction from pipeline.
  // Falls back to Worker on-demand generation if DB has nothing.
  useEffect(() => {
    if (!gameId) return;
    setLoading(true);
    getGamePrediction(gameId)
      .then(data => {
        if (data?.text) {
          setAnalysis(data.text);
          setLoading(false);
          return;
        }
        // Nothing in DB — try Worker cache then on-demand
        if (!workerUrl) { setLoading(false); return; }
        fetch(`${workerUrl}/cache/${encodeURIComponent(`prediction:${gameId}`)}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            if (d?.narrative) { setAnalysis(d.narrative); return; }
            // Not cached — generate on demand
            return fetch(`${workerUrl}/prediction/analyze?gameId=${gameId}`)
              .then(r => r.json())
              .then(d => { if (d?.narrative) setAnalysis(d.narrative); else setError(d?.error || null); });
          })
          .catch(() => {})
          .finally(() => setLoading(false));
      })
      .catch(() => setLoading(false));
  }, [gameId]);

  if (loading) {
    return (
      <div className={MD_AI_SECTION_CLASSES}>
        <div className="md-ai-header flex items-center gap-1.5 mb-2">
          <span className={MD_AI_LABEL_CLASSES}>⚡ EyeWall AI</span>
        </div>
        <div className="md-ai-loading text-[12px] text-[color:var(--text-dim)] italic">Loading analysis…</div>
      </div>
    );
  }

  if (!analysis && !workerUrl) return null;

  return (
    <div className={MD_AI_SECTION_CLASSES}>
      <div className="md-ai-header flex items-center gap-1.5 mb-2">
        <span className={MD_AI_LABEL_CLASSES}>⚡ EyeWall AI</span>
        <InfoTip
          text="AI analysis synthesizes possession metrics, recent form, head-to-head record, and key matchup factors into a plain-English preview. Generated nightly by the EyeWall pipeline."
          position="above"
        />
      </div>
      {analysis ? (
        <div className="md-ai-narrative text-[13px] leading-[1.6] text-[color:var(--text)]">{analysis}</div>
      ) : error ? (
        <div className="md-ai-error text-[11px] text-[color:var(--text-dim)]">{error}</div>
      ) : null}
    </div>
  );
}


export { MatchupDetail, computeWinPct };