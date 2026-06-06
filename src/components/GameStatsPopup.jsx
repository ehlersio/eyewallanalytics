import React, { useState, useEffect, useRef } from 'react';
import { useFetch } from '../hooks/useFetch';
import {
  getCompletedGameStats, getOpponent, isHomeGame, getCarScore, getOppScore,
  formatGameDate, TEAM_COLORS,
} from '../utils/nhlApi';
import { computeShotAttempts, computePDO, computePuckLuck, computeGSAx } from '../utils/advancedStats';
import TeamLogo from '../components/TeamLogo';
import InfoTip from '../components/InfoTip';

const CAR_ABBR = 'CAR';

// ── Game stats popup ─────────────────────────────────────────
import { PeriodTable, SkaterTable, GoalsList } from '../components/GameStatsComponents';

function GameStatsPopup({ game, onClose }) {
  const { data, loading } = useFetch(() => getCompletedGameStats(game.id), [game.id]);
  const [skaterTeam, setSkaterTeam] = useState('car');
  const [summary, setSummary]       = useState(null);
  const [showTop, setShowTop]       = useState(false);
  const modalRef = useRef(null);

  // Fetch AI-generated summary from Worker KV
  useEffect(() => {
    const workerUrl = import.meta.env.VITE_WORKER_URL;
    if (!workerUrl || !game?.id) return;
    fetch(`${workerUrl}/cache/${encodeURIComponent(`summary:${game.id}`)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.narrative) setSummary(d); })
      .catch(() => {});
  }, [game?.id]);

  const opp      = getOpponent(game);
  const oppAbbr  = opp?.abbrev || 'OPP';
  const oppColor = TEAM_COLORS[oppAbbr] || '#7a8899';
  const carScore = getCarScore(game);
  const oppScore = getOppScore(game);
  const won      = carScore != null && oppScore != null && carScore > oppScore;
  const home     = isHomeGame(game);

  // Pull team stats from right-rail
  const rr         = data?.rightRail;
  const pbpPlays   = data?.pbp?.plays || [];
  const isCarHome  = data?.homeTeamId === 12;
  const advStats   = pbpPlays.length ? computeShotAttempts(pbpPlays) : null;
  const pdoStats   = pbpPlays.length ? computePDO(pbpPlays) : null;
  const luckStats  = pbpPlays.length ? computePuckLuck(pbpPlays) : null;
  const teamStats  = rr?.teamGameStats || [];

  // Pull scoring summary from boxscore
  const bs         = data?.boxscore;
  const scoring    = bs?.summary?.scoring || bs?.linescore?.periods || [];
  const shootout   = bs?.summary?.shootout || [];
  const starsList  = bs?.summary?.threeStars || [];

  // Boxscore player stats — use isCarHome from actual API data, fallback to schedule
  const pbg        = bs?.playerByGameStats;
  const carIsHome  = data ? isCarHome : home; // use schedule until data arrives
  const carKey     = carIsHome ? 'homeTeam' : 'awayTeam';
  const oppKey     = carIsHome ? 'awayTeam' : 'homeTeam';
  const carPlayers = pbg ? [
    ...(pbg[carKey]?.forwards || []),
    ...(pbg[carKey]?.defense  || pbg[carKey]?.defensemen || []),
  ].map(p => ({ ...p, shots: p.sog ?? 0 })) : [];
  const carGoalies = pbg?.[carKey]?.goalies || [];

  // Opponent skaters + goalies
  const oppPlayers_raw = pbg ? [
    ...(pbg[oppKey]?.forwards || []),
    ...(pbg[oppKey]?.defense  || pbg[oppKey]?.defensemen || []),
  ].map(p => ({ ...p, shots: p.sog ?? 0 })) : [];
  const oppPlayers = [...oppPlayers_raw]
    .sort((a, b) => (b.points || 0) - (a.points || 0) || (b.goals || 0) - (a.goals || 0));
  const oppGoalies = pbg?.[oppKey]?.goalies || [];

  // All CAR skaters sorted by points desc, then toi
  const carPlayers_sorted = [...carPlayers]
    .sort((a, b) => (b.points || 0) - (a.points || 0) || (b.goals || 0) - (a.goals || 0));
  // reassign for use below (override earlier carPlayers with sorted version)
  carPlayers.length = 0;
  carPlayers_sorted.forEach(p => carPlayers.push(p));

  // Helper: find a team stat value by category
  function getStat(category, teamAbbr) {
    const row = teamStats.find(s =>
      s.category?.toLowerCase().includes(category.toLowerCase())
    );
    if (!row) return null;
    return teamAbbr === CAR_ABBR
      ? (home ? row.homeValue : row.awayValue)
      : (home ? row.awayValue : row.homeValue);
  }

  // Map every raw NHL API category key -> human label + optional value transformer
  // The right-rail returns camelCase keys like "sog", "faceoffWinningPctg", "blockedShots", etc.
  const STAT_CONFIG = {
    // key (lowercase)            label                          formatter
    sog:                        { label: 'Shots on Goal',           fmt: null },
    hits:                       { label: 'Hits',                    fmt: null },
    blockedshots:               { label: 'Blocked Shots',           fmt: null },
    blockedshot:                { label: 'Blocked Shots',           fmt: null },
    blocked:                    { label: 'Blocked Shots',           fmt: null },
    faceoffwinningpctg:         { label: 'Faceoff Win %',           fmt: v => `${(parseFloat(v)*100).toFixed(1)}%` },
    faceoffwinpct:              { label: 'Faceoff Win %',           fmt: v => `${parseFloat(v).toFixed(1)}%` },
    faceoffpct:                 { label: 'Faceoff Win %',           fmt: v => {
      const n = parseFloat(v);
      return n <= 1 ? `${(n*100).toFixed(1)}%` : `${n.toFixed(1)}%`;
    }},
    powerplaypctg:              { label: 'Power Play %',            fmt: v => `${(parseFloat(v)*100).toFixed(1)}%` },
    powerplay:                  { label: 'Power Play',              fmt: null },
    pim:                        { label: 'Penalty Minutes',         fmt: null },
    penaltyminutes:             { label: 'Penalty Minutes',         fmt: null },
    giveaways:                  { label: 'Giveaways',               fmt: null },
    takeaways:                  { label: 'Takeaways',               fmt: null },
    shots:                      { label: 'Shots on Goal',           fmt: null },
  };

  function getStatConfig(rawCategory) {
    if (!rawCategory) return null;
    const key = rawCategory.toLowerCase().replace(/[^a-z]/g, '');
    return STAT_CONFIG[key] || null;
  }

  function formatStatValue(rawCategory, value) {
    if (value == null) return '—';
    const cfg = getStatConfig(rawCategory);
    if (cfg?.fmt) return cfg.fmt(value);
    return String(value);
  }

  function getStatLabel(rawCategory) {
    const cfg = getStatConfig(rawCategory);
    // If we have a known label use it; otherwise convert camelCase to Title Case
    if (cfg?.label) return cfg.label;
    return rawCategory
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, s => s.toUpperCase())
      .trim();
  }

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div className="game-popup" ref={modalRef} onClick={e => e.stopPropagation()}
        onScroll={e => setShowTop(e.target.scrollTop > 200)}>
        {showTop && (
          <button className="gsp-top-btn" onClick={() => modalRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}>
            ↑ Top
          </button>
        )}

        {/* Header */}
        <div className={`gp-header ${won ? 'gp-win' : 'gp-loss'}`}>
          <div className="gp-header-inner">
            <div className="gp-team-col">
              <TeamLogo abbr="CAR" size={36} />
              <span className="gp-abbr" style={{ color: 'var(--red-bright)' }}>CAR</span>
              <span className="gp-score-big" style={{ color: 'var(--red-bright)' }}>{carScore ?? '—'}</span>
            </div>
            <div className="gp-center-col">
              <div className={`gp-result-badge ${won ? 'win' : 'loss'}`}>{won ? 'W' : 'L'}</div>
              <div className="gp-date">{formatGameDate(game.gameDate)}</div>
              <div className="gp-venue">{home ? '📍 Home' : '✈ Away'}</div>
            </div>
            <div className="gp-team-col right">
              <TeamLogo abbr={oppAbbr} size={36} color={oppColor} />
              <span className="gp-abbr" style={{ color: oppColor }}>{oppAbbr}</span>
              <span className="gp-score-big" style={{ color: oppColor }}>{oppScore ?? '—'}</span>
            </div>
          </div>
          <button className="gp-close" onClick={onClose} aria-label="Close game details">✕</button>
        </div>

        <div className="gp-body">
          {/* ── AI Game Summary Card ── */}
          {summary && (
            <div className="gp-summary-card">
              <div className="gp-summary-header">
                <span className="gp-summary-label">Game Summary</span>
                <span className="gp-summary-badge">⚡ EyeWall AI</span>
              </div>
              <p className="gp-summary-narrative">{summary.narrative}</p>
              <div className="gp-summary-chips">
                <span className="gp-summary-chip" style={{color: summary.cfPct >= 50 ? 'var(--green)' : 'var(--red-bright)'}}>
                  CF% {summary.cfPct}%
                </span>
                {summary.topScorer && summary.topScorer !== 'Unknown' && (
                  <span className="gp-summary-chip">🚨 {summary.topScorer}</span>
                )}
                {summary.carGoalie && summary.carGoalie.svPct != null && (
                  <span className="gp-summary-chip">
                    🥅 {summary.carGoalie.name.split(' ').pop()}{' '}
                    {typeof summary.carGoalie.svPct === 'number'
                      ? (summary.carGoalie.svPct <= 1
                          ? summary.carGoalie.svPct.toFixed(3)
                          : (summary.carGoalie.svPct / 100).toFixed(3))
                      : summary.carGoalie.svPct}
                  </span>
                )}
                <span className="gp-summary-chip" style={{color: summary.won ? 'var(--green)' : 'var(--red-bright)'}}>
                  {summary.won ? '✓ W' : '✗ L'} {summary.carScore}–{summary.oppScore}
                </span>
              </div>
              <button
                className="gp-summary-share"
                onClick={() => {
                  const text = `CAR ${summary.carScore}–${summary.oppScore} ${summary.oppAbbr} | ${summary.narrative} — EyeWall Analytics eyewallanalytics.com`;
                  if (navigator.share) {
                    navigator.share({ title: 'EyeWall Analytics Game Summary', text }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(text).then(() =>
                      alert('Summary copied to clipboard!')
                    ).catch(() => {});
                  }
                }}
              >
                ↗ Share summary
              </button>
            </div>
          )}

          {loading && (
            <div className="gp-loading">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 12, marginBottom: 10, width: `${60 + i * 8}%` }} />
              ))}
            </div>
          )}

          {!loading && data && (
            <>
              {/* Period table + three stars side by side */}
              {scoring.length > 0 && (
                <div className="gp-period-stars-row">
                  <div className="gp-section gp-period-col">
                    <div className="gp-section-label">Scoring by period</div>
                    <PeriodTable scoring={scoring} home={home} carAbbr={CAR_ABBR} oppAbbr={oppAbbr} />
                  </div>
                  {starsList.length > 0 && (
                    <div className="gp-section gp-stars-col">
                      <div className="gp-section-label">Three stars</div>
                      {starsList.map((s, i) => (
                        <div key={i} className="gp-star-row">
                          <span className="gp-star-num">
                            {i === 0 ? '⭐' : i === 1 ? '⭐⭐' : '⭐⭐⭐'}
                          </span>
                          <div className="gp-star-info">
                            <span className="gp-star-name">{s.name?.default || s.player}</span>
                            <span className="gp-star-team" style={{ color: TEAM_COLORS[s.teamAbbrev?.default || s.teamAbbrev] || 'var(--text-muted)' }}>
                              {s.teamAbbrev?.default || s.teamAbbrev}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Goals — CAR on left, opponent on right */}
              {scoring.length > 0 && (
                <div className="gp-section">
                  <div className="gp-section-label">Goals</div>
                  <GoalsList scoring={scoring} carAbbr={CAR_ABBR} oppAbbr={oppAbbr} oppColor={oppColor} />
                </div>
              )}

              {/* Team stats comparison */}
              {teamStats.length > 0 && (
                <div className="gp-section">
                  <div className="gp-section-label">Team stats</div>
                  <div className="gp-team-stat-header">
                    <span style={{ color: 'var(--red-bright)' }}>CAR</span>
                    <span />
                    <span style={{ color: oppColor }}>{oppAbbr}</span>
                  </div>
                  {teamStats.map((row, i) => {
                    const rawCarVal = home ? row.homeValue : row.awayValue;
                    const rawOppVal = home ? row.awayValue : row.homeValue;
                    const carDisplay = formatStatValue(row.category, rawCarVal);
                    const oppDisplay = formatStatValue(row.category, rawOppVal);
                    const label      = getStatLabel(row.category);
                    // For bar sizing always use raw numeric (strip % if present)
                    const carNum = parseFloat(String(rawCarVal).replace('%','')) || 0;
                    const oppNum = parseFloat(String(rawOppVal).replace('%','')) || 0;
                    const total  = carNum + oppNum || 1;
                    const carPct = Math.round((carNum / total) * 100);
                    return (
                      <div key={i} className="gp-stat-row">
                        <span className="gp-stat-val car">{carDisplay}</span>
                        <div className="gp-stat-center">
                          <div className="gp-stat-label">{label}</div>
                          <div className="dual-bar">
                            <div className="fill-red"  style={{ width: `${carPct}%` }} />
                            <div className="fill-blue" style={{ width: `${100 - carPct}%` }} />
                          </div>
                        </div>
                        <span className="gp-stat-val opp">{oppDisplay}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Skater table with team toggle */}
              {/* ── Corsi / Fenwick / PDO / Puck Luck ── */}
              {advStats && (
                <div className="gp-section">
                  <div className="gp-section-label">
                    Shot Attempts &amp; Puck Luck
                    <InfoTip position="above" text="Corsi = all shot attempts (goals+shots+misses+blocks). Fenwick excludes blocks. PDO = SH%+SV%×100, avg=100. Puck Luck = actual goals vs expected from shot share." />
                  </div>
                  <div className="gp-adv-grid">
                    <div className="gp-adv-row header">
                      <span></span><span className="red">CAR</span><span></span><span className="muted">OPP</span>
                    </div>
                    {[
                      ['Corsi (CF)',   advStats.carCorsi,   advStats.oppCorsi,   'All shot attempts incl. blocked'],
                      ['Fenwick (FF)', advStats.carFenwick, advStats.oppFenwick, 'Unblocked shot attempts (excl. blocks)'],
                      ['Shots on Goal',advStats.car.goals+advStats.car.sog, advStats.opp.goals+advStats.opp.sog, 'Shots that reached the goalie'],
                      ['Missed Shots', advStats.car.missed, advStats.opp.missed, 'Attempts that missed the net'],
                      ['Blocked Shots',advStats.car.blocked,advStats.opp.blocked,'Attempts blocked by a skater'],
                    ].map(([label, car, opp, help]) => {
                      const tot = car + opp || 1;
                      return (
                        <div key={label} className="gp-adv-row">
                          <span className="gp-adv-label">{label}</span>
                          <span className="red">{car}</span>
                          <div className="gp-adv-bar">
                            <div className="gp-adv-fill red"   style={{width:`${Math.round(car/tot*100)}%`}} />
                            <div className="gp-adv-fill muted" style={{width:`${Math.round(opp/tot*100)}%`}} />
                          </div>
                          <span className="muted">{opp}</span>
                        </div>
                      );
                    })}
                    <div className="gp-adv-chips">
                      <span className="gp-adv-chip"
                        style={{color: advStats.corsiForPct>=50?'var(--green)':'var(--red-bright)'}}>
                        CF% {advStats.corsiForPct}%
                      <InfoTip text="Corsi For% — CAR share of all shot attempts" position="above" /></span>
                      <span className="gp-adv-chip"
                        style={{color: advStats.fenwickForPct>=50?'var(--green)':'var(--red-bright)'}}>
                        FF% {advStats.fenwickForPct}%
                      <InfoTip text="Fenwick For% — CAR share of unblocked attempts" position="above" /></span>
                      {pdoStats && (
                        <span className="gp-adv-chip"
                          style={{color: pdoStats.pdo>102?'var(--amber)':pdoStats.pdo<98?'var(--blue-bright)':'var(--text-muted)'}}>
                          PDO {pdoStats.pdo}
                          <InfoTip text={`PDO = SH%+SV%×100. League avg=100. ${pdoStats.luck}`} position="above" />
                        </span>
                      )}
                      {luckStats && (
                        <span className="gp-adv-chip"
                          style={{color: luckStats.color}}>
                          Luck {luckStats.luckDelta>=0?'+':''}{luckStats.luckDelta}G
                        <InfoTip text={`Puck Luck: ${luckStats.label}. Expected ${luckStats.expectedGF}G from ${luckStats.fenwickForPct}% shot share.`} position="above" /></span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Skater table with team toggle */}
              {(carPlayers.length > 0 || oppPlayers.length > 0) && (
                <div className="gp-section">
                  <div className="gp-skater-toggle">
                    <button
                      className={"skater-toggle-btn" + (skaterTeam === "car" ? " active-car" : "")}
                      onClick={() => setSkaterTeam("car")}
                    >
                      <TeamLogo abbr="CAR" size={14} />
                      CAR Skaters
                    </button>
                    <button
                      className={"skater-toggle-btn" + (skaterTeam === "opp" ? " active-opp" : "")}
                      onClick={() => setSkaterTeam("opp")}
                    >
                      <TeamLogo abbr={oppAbbr} size={14} color={oppColor} />
                      {oppAbbr} Skaters
                    </button>
                  </div>
                  <SkaterTable
                    players={skaterTeam === "car" ? carPlayers : oppPlayers}
                    goalies={(skaterTeam === "car" ? carGoalies : oppGoalies).filter(
                      g => (g.toi && g.toi !== "00:00") || (g.shotsAgainst ?? 0) > 0
                    )}
                  />
                </div>
              )}

              {!teamStats.length && !carPlayers.length && !scoring.length && (
                <div className="gp-no-data">
                  Detailed stats not available for this game yet.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Period scoring table ─────────────────────────────────────

export { GameStatsPopup };
