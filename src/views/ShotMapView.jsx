import { useMemo, useState, useCallback } from 'react';
import { usePoll, useFetch } from '../hooks/useFetch';
import {
  getLiveGame, getGameDetail, getGameBoxscore, getGameRightRail,
  getRecentGames, getPlayoffGames, extractShotEvents,
  getCarScore, getOppScore, getOpponent, isHomeGame,
  getTeamStats, formatGameDate, getRoster, buildPlayerMap,
  TEAM_COLORS, GAME_TYPE,
} from '../utils/nhlApi';
import IceRink from '../components/IceRink';
import { StatBar, MetCard, MetCardSkeleton } from '../components/StatBar';
import TeamLogo from '../components/TeamLogo';
import './ShotMapView.css';

const CAR_ABBR = 'CAR';

export default function ShotMapView() {
  // Live game polling
  const { data: liveGame }  = usePoll(getLiveGame, 30000);

  // Most recent completed game as fallback
  const { data: recentGames } = useFetch(getRecentGames);
  const lastGame  = recentGames?.[0] || null;
  const activeGame = liveGame || lastGame;
  const isLive     = !!liveGame;

  // Are we currently in playoffs? Check if any playoff games exist this season
  const { data: playoffGames } = useFetch(getPlayoffGames);
  const inPlayoffs = (playoffGames?.length || 0) > 0;

  // Determine context of the active game
  const activeIsPlayoff = activeGame?.gameType === GAME_TYPE.PLAYOFFS;

  // Play-by-play for shot map
  const gameId = activeGame?.id;
  const { data: pbp } = useFetch(
    () => gameId ? getGameDetail(gameId) : Promise.resolve(null),
    [gameId]
  );

  // Boxscore + right-rail for the game panel
  const { data: boxscore } = useFetch(
    () => gameId ? getGameBoxscore(gameId) : Promise.resolve(null),
    [gameId]
  );
  const { data: rightRail } = useFetch(
    () => gameId ? getGameRightRail(gameId) : Promise.resolve(null),
    [gameId]
  );

  // Team stats — we fetch once; we pick the right context (reg vs playoff) below
  const { data: teamStats, loading: statsLoading } = useFetch(() => getTeamStats(CAR_ABBR));

  // Roster for player name resolution in shot tooltips
  const { data: roster } = useFetch(() => getRoster(CAR_ABBR));

  const shotEvents = pbp ? extractShotEvents(pbp) : [];
  const opp        = activeGame ? getOpponent(activeGame) : null;
  const carScore   = activeGame ? getCarScore(activeGame) : null;
  const oppScore   = activeGame ? getOppScore(activeGame) : null;
  const oppAbbr    = opp?.abbrev;
  const oppColor   = TEAM_COLORS[oppAbbr] || 'var(--text-muted)';
  const gameHome   = activeGame ? isHomeGame(activeGame) : true;

  // ── Compute game-level metrics from right-rail ──────────────
  const teamGameStats = rightRail?.teamGameStats || [];
  function getGameStat(category) {
    const row = teamGameStats.find(r =>
      r.category?.toLowerCase().replace(/[^a-z]/g, '').includes(category.toLowerCase().replace(/[^a-z]/g, ''))
    );
    if (!row) return { car: null, opp: null };
    return {
      car: gameHome ? row.homeValue : row.awayValue,
      opp: gameHome ? row.awayValue : row.homeValue,
    };
  }

  // Stat drill-down state
  const [drillStat, setDrillStat] = useState(null); // { label, rows }

  // Build drill-down data from play-by-play
  const buildDrillDown = useCallback((statKey) => {
    if (!pbp?.plays) return;
    const plays = pbp.plays;
    const rosterMap = roster || {};
    const carId = 12; // CAR team ID
    const oppId = opp?.id || null;

    // Build a string-keyed map from rosterSpots so lookups always work
    // regardless of whether event IDs come back as numbers or strings
    const rawMap = buildPlayerMap(pbp); // keyed by playerId (number or string)
    const playerMap = {};
    Object.entries(rawMap).forEach(([k, v]) => { playerMap[String(k)] = v; });
    const pName = (id) => {
      if (!id) return '—';
      const name = playerMap[String(id)];
      return name && name.trim() ? name : `#${id}`;
    };

    const periodLabel = n => n === 4 ? 'OT' : n === 5 ? 'SO' : `P${n}`;

    if (statKey === 'sog') {
      // Shots on goal by CAR
      const shots = plays.filter(p =>
        (p.typeDescKey === 'shot-on-goal' || p.typeDescKey === 'goal') &&
        (p.details?.eventOwnerTeamId === carId)
      );
      const byPlayer = {};
      shots.forEach(p => {
        const id = p.details?.shootingPlayerId || p.details?.scoringPlayerId;
        const per = periodLabel(p.periodDescriptor?.number);
        const key = id || 'unknown';
        if (!byPlayer[key]) byPlayer[key] = { name: pName(id), periods: {}, total: 0 };
        byPlayer[key].periods[per] = (byPlayer[key].periods[per] || 0) + 1;
        byPlayer[key].total++;
      });
      const rows = Object.values(byPlayer).sort((a, b) => b.total - a.total);
      setDrillStat({ label: 'CAR Shots on Goal', rows, type: 'shots' });

    } else if (statKey === 'hits') {
      const hits = plays.filter(p =>
        p.typeDescKey === 'hit' && p.details?.hittingPlayerId != null &&
        p.details?.eventOwnerTeamId === carId
      );
      const byPlayer = {};
      hits.forEach(p => {
        const id  = p.details?.hittingPlayerId;
        const per = periodLabel(p.periodDescriptor?.number);
        const key = id || 'unknown';
        if (!byPlayer[key]) byPlayer[key] = { name: pName(id), periods: {}, total: 0 };
        byPlayer[key].periods[per] = (byPlayer[key].periods[per] || 0) + 1;
        byPlayer[key].total++;
      });
      const rows = Object.values(byPlayer).sort((a, b) => b.total - a.total);
      setDrillStat({ label: 'CAR Hits', rows, type: 'hits' });

    } else if (statKey === 'faceoff') {
      const fos = plays.filter(p => p.typeDescKey === 'faceoff');
      const byPlayer = {};
      fos.forEach(p => {
        const winnerId = p.details?.winningPlayerId;
        const loserId  = p.details?.losingPlayerId;
        const per = periodLabel(p.periodDescriptor?.number);
        const winTeam = p.details?.eventOwnerTeamId;
        // Only count CAR players
        const carPlayerId = winTeam === carId ? winnerId : loserId;
        const carWon      = winTeam === carId;
        if (!carPlayerId) return;
        const key = carPlayerId;
        if (!byPlayer[key]) byPlayer[key] = { name: pName(carPlayerId), won: {}, lost: {}, totalWon: 0, totalLost: 0 };
        if (carWon) {
          byPlayer[key].won[per]  = (byPlayer[key].won[per]  || 0) + 1;
          byPlayer[key].totalWon++;
        } else {
          byPlayer[key].lost[per] = (byPlayer[key].lost[per] || 0) + 1;
          byPlayer[key].totalLost++;
        }
      });
      const rows = Object.values(byPlayer)
        .map(r => ({ ...r, total: r.totalWon + r.totalLost }))
        .sort((a, b) => b.total - a.total);
      setDrillStat({ label: 'CAR Faceoffs', rows, type: 'faceoff' });

    } else if (statKey === 'pp') {
      // Power play goals and opportunities from plays
      const ppGoals = plays.filter(p =>
        p.typeDescKey === 'goal' &&
        p.details?.eventOwnerTeamId === carId &&
        p.details?.situationCode?.toString().startsWith('1')
      );
      const rows = ppGoals.map(p => ({
        name: pName(p.details?.scoringPlayerId),
        period: periodLabel(p.periodDescriptor?.number),
        assists: [p.details?.assist1PlayerId, p.details?.assist2PlayerId]
          .filter(Boolean).map(pName).filter(n => n !== 'Unknown'),
        total: 1,
        periods: {},
      }));
      setDrillStat({ label: 'CAR Power Play Goals', rows, type: 'ppgoals' });
    }
  }, [pbp, roster, opp]);

  const gameSog      = getGameStat('sog');
  const gameHits     = getGameStat('hits');
  const gameFaceoff  = getGameStat('faceoff');
  const gamePP       = getGameStat('powerPlay');

  // ── Shot danger breakdown from coordinate data ──────────────
  const dangerCounts = useMemo(() => {
    const carShots = shotEvents.filter(e => e.isCanes);
    const dist = e => Math.sqrt(Math.pow(Math.abs(e.x) - 89, 2) + e.y * e.y);
    const hiShots  = carShots.filter(e => dist(e) < 15);
    const medShots = carShots.filter(e => dist(e) >= 15 && dist(e) < 30);
    const loShots  = carShots.filter(e => dist(e) >= 30);
    return {
      hi: hiShots.length, hiShots,
      med: medShots.length, medShots,
      lo: loShots.length, loShots,
      total: carShots.length,
    };
  }, [shotEvents]);

  // ── Danger zone drill-down builder ─────────────────────────
  const buildDangerDrill = useCallback((zone) => {
    if (!dangerCounts.hiShots) return;
    const periodLabel = n => n === 4 ? 'OT' : n === 5 ? 'SO' : `P${n}`;
    const shotSets = {
      hi:  { shots: dangerCounts.hiShots,  label: '🔴 High Danger Shots (<15 ft)' },
      med: { shots: dangerCounts.medShots, label: '🟡 Medium Danger Shots (15–30 ft)' },
      lo:  { shots: dangerCounts.loShots,  label: '⚪ Low Danger Shots (>30 ft)' },
    };
    const { shots, label } = shotSets[zone];
    // Shot events already have shooterName resolved from rosterSpots
    const byPlayer = {};
    shots.forEach(e => {
      const name = e.shooterName || '—';
      const per  = periodLabel(e.period);
      if (!byPlayer[name]) byPlayer[name] = { name, periods: {}, total: 0 };
      byPlayer[name].periods[per] = (byPlayer[name].periods[per] || 0) + 1;
      byPlayer[name].total++;
    });
    const rows = Object.values(byPlayer).sort((a, b) => b.total - a.total);
    setDrillStat({ label, rows, type: 'shots' });
  }, [dangerCounts]);

  // ── Top CAR scorers from boxscore ────────────────────────────
  const pbgKey     = gameHome ? 'homeTeam' : 'awayTeam';
  const playerByGame = boxscore?.playerByGameStats?.[pbgKey];
  const allSkaters = [
    ...(playerByGame?.forwards   || []),
    ...(playerByGame?.defensemen || []),
  ].sort((a, b) => (b.points || 0) - (a.points || 0) || (b.goals || 0) - (a.goals || 0));
  const topScorers = allSkaters.filter(p => (p.points || 0) > 0).slice(0, 4);

  // ── Goalies ──────────────────────────────────────────────────
  // Pick the goalie who actually played — filter by toi > 0 or shotsAgainst > 0.
  // The boxscore lists all rostered goalies; backup who didn't dress has 0s.
  const oppKey     = gameHome ? 'awayTeam' : 'homeTeam';

  function activeGoalie(goalies = []) {
    // Prefer the one with shots against > 0, then toi, then fall back to first
    const played = goalies.filter(g =>
      (g.shotsAgainst != null && g.shotsAgainst > 0) ||
      (g.toi && g.toi !== '00:00' && g.toi !== '0:00')
    );
    return played[0] || null;
  }

  const carGoalie = activeGoalie(boxscore?.playerByGameStats?.[pbgKey]?.goalies || []);
  const oppGoalie = activeGoalie(boxscore?.playerByGameStats?.[oppKey]?.goalies  || []);

  // ── Context label for top metrics ───────────────────────────
  // Use playoff team stats if in playoffs, otherwise regular season
  const ctxLabel    = inPlayoffs ? 'Playoff avg' : 'Season avg';
  // teamStats comes from standings which is always current reg season
  // For now we show reg season avg with a label — future: fetch playoff-specific team stats

  // ── Period scoring ───────────────────────────────────────────
  const scoring    = boxscore?.summary?.scoring || [];
  const periods    = scoring.map((p, i) => {
    const num = p.period || i + 1;
    const label = num <= 3 ? `P${num}` : num === 4 ? 'OT' : `OT${num - 3}`;
    let carG = 0, oppG = 0;
    (p.goals || []).forEach(g => {
      if (g.teamAbbrev?.default === CAR_ABBR) carG++;
      else oppG++;
    });
    return { label, carG, oppG };
  });

  return (
    <>
    <div className="page">

      {/* ── Score bar ── */}
      <div className="score-card card">
        {activeGame ? (
          <div className="score-inner">
            <div className="score-team">
              <TeamLogo abbr="CAR" size={30} />
              <span className="score-abbr red">CAR</span>
              <span className="score-num red">{carScore ?? '—'}</span>
            </div>
            <div className="score-center">
              {isLive ? (
                <>
                  <div className="score-period">
                    {liveGame.periodDescriptor?.periodType === 'REG'
                      ? `P${liveGame.periodDescriptor?.number}`
                      : liveGame.periodDescriptor?.periodType}
                  </div>
                  <div className="score-clock">{liveGame.clock?.timeRemaining}</div>
                  <div className="score-state pill pill-red" style={{margin:'4px auto 0',width:'fit-content'}}>
                    🔴 LIVE
                  </div>
                </>
              ) : (
                <>
                  <div className="score-period">Final</div>
                  <div className="score-state" style={{fontSize:10,color:'var(--text-dim)'}}>
                    {activeIsPlayoff ? '🏒 Playoff · ' : ''}{formatGameDate(activeGame.gameDate)}
                  </div>
                </>
              )}
            </div>
            <div className="score-team">
              <span className="score-num muted">{oppScore ?? '—'}</span>
              <span className="score-abbr muted">{oppAbbr}</span>
              <TeamLogo abbr={oppAbbr} size={30} color={oppColor} />
            </div>
          </div>
        ) : (
          <div className="no-game-msg">
            <span>Loading game data…</span>
          </div>
        )}
      </div>

      {/* ── Game metrics row ── */}
      <div className="metrics-grid">
        <MetCard
          label="Shots on goal"
          value={gameSog.car ?? '—'}
          sub={gameSog.opp != null ? `Opp ${gameSog.opp}` : 'this game'}
          color={gameSog.car > gameSog.opp ? 'green' : null}
          onClick={pbp ? () => buildDrillDown('sog') : null}
        />
        <MetCard
          label="Hits"
          value={gameHits.car ?? '—'}
          sub={gameHits.opp != null ? `Opp ${gameHits.opp}` : 'this game'}
          color={gameHits.car > gameHits.opp ? 'green' : null}
          onClick={pbp ? () => buildDrillDown('hits') : null}
        />
        <MetCard
          label="Faceoff %"
          value={gameFaceoff.car != null
            ? `${(parsePct(gameFaceoff.car)).toFixed(1)}%`
            : '—'}
          sub="this game"
          color={parsePct(gameFaceoff.car) > 50 ? 'green' : null}
          onClick={pbp ? () => buildDrillDown('faceoff') : null}
        />
        <MetCard
          label={inPlayoffs ? 'PP % (season)' : 'PP %'}
          value={teamStats?.powerPlayPct ? `${(teamStats.powerPlayPct * 100).toFixed(1)}%` : '—'}
          sub={ctxLabel}
          color="green"
          onClick={pbp ? () => buildDrillDown('pp') : null}
        />
      </div>

      {/* ── Context label — reg season vs playoff ── */}
      <div className="context-banner">
        <span className={`context-pill ${inPlayoffs ? 'playoffs' : 'regular'}`}>
          {inPlayoffs ? '🏒 Playoffs' : '📅 Regular season'}
        </span>
        <span className="context-game-label">
          {activeIsPlayoff ? 'Playoff game' : 'Regular season game'}
          {activeGame ? ` · ${isHomeGame(activeGame) ? 'Home' : 'Away'} vs ${oppAbbr}` : ''}
        </span>
      </div>

      <div className="two-col">
        {/* ── Left: rink + event log ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="sec-label">Shot map</div>
            <IceRink events={shotEvents} roster={roster || {}} />
          </div>

          {/* Event log — live only */}
          {isLive && pbp?.plays?.length > 0 && (
            <div className="card">
              <div className="sec-label">Recent events</div>
              <EventLog plays={pbp.plays} />
            </div>
          )}
        </div>

        {/* ── Right: game summary panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Period by period */}
          {periods.length > 0 && (
            <div className="card">
              <div className="sec-label">Scoring by period</div>
              <div className="period-grid">
                <div className="period-grid-header">
                  <span />
                  {periods.map(p => <span key={p.label}>{p.label}</span>)}
                  <span>T</span>
                </div>
                <div className="period-grid-row car">
                  <span>CAR</span>
                  {periods.map(p => <span key={p.label}>{p.carG}</span>)}
                  <span className="period-total">{carScore ?? '—'}</span>
                </div>
                <div className="period-grid-row">
                  <span style={{color:'var(--text-muted)'}}>{oppAbbr}</span>
                  {periods.map(p => <span key={p.label}>{p.oppG}</span>)}
                  <span className="period-total">{oppScore ?? '—'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Shot danger breakdown — derived from shot map coords */}
          {dangerCounts.total > 0 && (
            <div className="card">
              <div className="sec-label">CAR shot quality</div>
              <div className="danger-grid">
                <div className="danger-cell high clickable" onClick={() => buildDangerDrill('hi')}>
                  <div className="danger-num">{dangerCounts.hi}</div>
                  <div className="danger-label">🔴 High danger</div>
                  <div className="danger-sub">&lt;15 ft</div>
                </div>
                <div className="danger-cell med clickable" onClick={() => buildDangerDrill('med')}>
                  <div className="danger-num">{dangerCounts.med}</div>
                  <div className="danger-label">🟡 Medium</div>
                  <div className="danger-sub">15–30 ft</div>
                </div>
                <div className="danger-cell lo clickable" onClick={() => buildDangerDrill('lo')}>
                  <div className="danger-num">{dangerCounts.lo}</div>
                  <div className="danger-label">⚪ Low</div>
                  <div className="danger-sub">&gt;30 ft</div>
                </div>
              </div>
            </div>
          )}

          {/* Top point-getters in this game */}
          {topScorers.length > 0 && (
            <div className="card">
              <div className="sec-label">CAR scoring — this game</div>
              {topScorers.map((p, i) => (
                <div key={i} className="scorer-row">
                  <span className="scorer-name">{p.name?.default || `#${p.sweaterNumber}`}</span>
                  <div className="scorer-stats">
                    {p.goals > 0 && <span className="scorer-chip goal">{p.goals}G</span>}
                    {p.assists > 0 && <span className="scorer-chip assist">{p.assists}A</span>}
                    <span className="scorer-chip pts">{p.points}PTS</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Goalie comparison */}
          {(carGoalie || oppGoalie) && (
            <div className="card">
              <div className="sec-label">Goalies</div>
              {carGoalie && (
                <GoalieRow
                  name={carGoalie.name?.default || `#${carGoalie.sweaterNumber}`}
                  abbr="CAR"
                  saves={carGoalie.saves}
                  shotsAgainst={carGoalie.shotsAgainst}
                  savePctg={carGoalie.savePctg}
                  color="var(--red-bright)"
                />
              )}
              {oppGoalie && (
                <GoalieRow
                  name={oppGoalie.name?.default || `#${oppGoalie.sweaterNumber}`}
                  abbr={oppAbbr}
                  saves={oppGoalie.saves}
                  shotsAgainst={oppGoalie.shotsAgainst}
                  savePctg={oppGoalie.savePctg}
                  color={oppColor}
                />
              )}
            </div>
          )}

          {/* Team stat bars — game level */}
          {teamGameStats.length > 0 && (
            <div className="card">
              <div className="sec-label">Team stats — this game</div>
              <div className="gm-stat-header">
                <span style={{color:'var(--red-bright)'}}>CAR</span>
                <span />
                <span style={{color:oppColor}}>{oppAbbr}</span>
              </div>
              {teamGameStats.slice(0, 6).map((row, i) => {
                const carVal = gameHome ? row.homeValue : row.awayValue;
                const oppVal = gameHome ? row.awayValue : row.homeValue;
                // Detect percentage stats (faceoff %, PP %) — format as % if raw is a decimal
                const catKey = (row.category || '').toLowerCase().replace(/[^a-z]/g, '');
                const isPct  = catKey.includes('pct') || catKey.includes('pctg') ||
                               catKey.includes('faceoff') || catKey.includes('powerplay');
                const fmtVal = v => {
                  if (v == null) return '—';
                  const n = parseFloat(v);
                  if (isNaN(n)) return v;
                  if (isPct) return n <= 1 ? `${(n * 100).toFixed(1)}%` : `${n.toFixed(1)}%`;
                  return v;
                };
                const carN   = isPct ? parsePct(carVal) : (parseFloat(String(carVal).replace('%','')) || 0);
                const oppN   = isPct ? parsePct(oppVal) : (parseFloat(String(oppVal).replace('%','')) || 0);
                const total  = carN + oppN || 1;
                return (
                  <div key={i} className="gm-stat-row">
                    <span className="gm-stat-val red">{fmtVal(carVal)}</span>
                    <div className="gm-stat-mid">
                      <div className="gm-stat-label">{humanLabel(row.category)}</div>
                      <div className="dual-bar">
                        <div className="fill-red"  style={{width:`${Math.round(carN/total*100)}%`}} />
                        <div className="fill-blue" style={{width:`${Math.round(oppN/total*100)}%`}} />
                      </div>
                    </div>
                    <span className="gm-stat-val muted">{fmtVal(oppVal)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
    {drillStat && <StatDrillPopup drillStat={drillStat} onClose={() => setDrillStat(null)} />}
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────

function GoalieRow({ name, abbr, saves, shotsAgainst, savePctg, color }) {
  const svPct = savePctg != null
    ? (savePctg <= 1 ? savePctg.toFixed(3) : (savePctg / 100).toFixed(3))
    : '—';
  return (
    <div className="goalie-row">
      <span className="goalie-abbr" style={{color}}>{abbr}</span>
      <span className="goalie-name">{name}</span>
      <div className="goalie-nums">
        <span>{saves ?? '—'}/{shotsAgainst ?? '—'}</span>
        <span className="goalie-svpct">{svPct}</span>
      </div>
    </div>
  );
}

function EventLog({ plays }) {
  const relevant = [...plays]
    .reverse()
    .filter(p => ['goal','shot-on-goal','penalty'].includes(p.typeDescKey))
    .slice(0, 8);
  const typeStyle = { 'goal':'log-goal', 'shot-on-goal':'log-shot', 'penalty':'log-pen' };
  return (
    <div className="event-log">
      {relevant.map((p, i) => (
        <div key={i} className="log-row">
          <span className="log-time">
            {p.periodDescriptor?.number <= 3 ? `P${p.periodDescriptor?.number}` : 'OT'} {p.timeInPeriod}
          </span>
          <span className={`log-badge ${typeStyle[p.typeDescKey] || ''}`}>
            {p.typeDescKey === 'shot-on-goal' ? 'shot' : p.typeDescKey}
          </span>
          <span className="log-desc">
            {p.details?.scoringPlayerId
              ? `#${p.details.scoringPlayerId}`
              : p.typeDescKey}
          </span>
        </div>
      ))}
    </div>
  );
}


// ── Stat Drill-Down Popup ───────────────────────────────────
function StatDrillPopup({ drillStat, onClose }) {
  if (!drillStat) return null;
  const periods = ['P1', 'P2', 'P3', 'OT'];

  return (
    <div className="drill-overlay" onClick={onClose}>
      <div className="drill-popup" onClick={e => e.stopPropagation()}>
        <div className="drill-header">
          <span className="drill-title">{drillStat.label}</span>
          <button className="drill-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="drill-body">
          {drillStat.rows.length === 0 && (
            <div className="drill-empty">No data available for this game.</div>
          )}

          {drillStat.type === 'faceoff' && (
            <div className="drill-table">
              <div className="drill-col-header fo">
                <span>Player</span><span>Won</span><span>Lost</span><span>Win%</span>
              </div>
              {drillStat.rows.map((r, i) => (
                <div key={i}>
                  <div className="drill-row-grid fo">
                    <span className="drill-name">{r.name}</span>
                    <span className="drill-val green">{r.totalWon}</span>
                    <span className="drill-val red">{r.totalLost}</span>
                    <span className="drill-val">{r.total > 0 ? `${((r.totalWon/r.total)*100).toFixed(0)}%` : '—'}</span>
                  </div>
                  {periods.some(p => r.won[p] || r.lost[p]) && (
                    <div className="drill-periods" style={{padding: '0 16px 8px'}}>
                      {periods.filter(p => r.won[p] || r.lost[p]).map(p => (
                        <span key={p} className="period-chip">
                          {p}: <span className="c-green">{r.won[p]||0}W</span>/<span className="c-red">{r.lost[p]||0}L</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {drillStat.type === 'ppgoals' && (
            <div className="drill-table">
              {drillStat.rows.map((r, i) => (
                <div key={i} className="drill-row">
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <span className="drill-name">{r.name}</span>
                    <span className="drill-period-badge">{r.period}</span>
                  </div>
                  {r.assists.length > 0 && (
                    <div className="drill-assists">Assists: {r.assists.join(', ')}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {(drillStat.type === 'shots' || drillStat.type === 'hits') && (
            <div className="drill-table">
              <div className="drill-col-header shots">
                <span>Player</span><span>P1</span><span>P2</span><span>P3</span><span>OT</span><span>Total</span>
              </div>
              {drillStat.rows.map((r, i) => (
                <div key={i} className="drill-row-grid shots">
                  <span className="drill-name">{r.name}</span>
                  {periods.map(p => (
                    <span key={p} className={`drill-val ${r.periods[p] ? '' : 'dim'}`}>
                      {r.periods[p] || '—'}
                    </span>
                  ))}
                  <span className="drill-val total">{r.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────

function formatFaceoff(val) {
  if (val == null) return '—';
  const n = parseFloat(String(val).replace('%',''));
  if (isNaN(n)) return '—';
  // Could be 0-1 decimal or 0-100 percentage
  return n <= 1 ? `${(n * 100).toFixed(1)}%` : `${n.toFixed(1)}%`;
}

function parsePct(val) {
  if (val == null) return 0;
  const n = parseFloat(String(val).replace('%',''));
  return n <= 1 ? n * 100 : n;
}

const LABEL_MAP = {
  sog: 'Shots on Goal', hits: 'Hits', blockedshots: 'Blocked Shots',
  blockedshot: 'Blocked Shots', blocked: 'Blocked Shots',
  faceoffwinningpctg: 'Faceoff Win %', faceoffwinpct: 'Faceoff Win %',
  faceoffpct: 'Faceoff Win %', powerplaypctg: 'Power Play %',
  powerplay: 'Power Play', pim: 'Penalty Min', penaltyminutes: 'Penalty Min',
  giveaways: 'Giveaways', takeaways: 'Takeaways', shots: 'Shots on Goal',
};
function humanLabel(raw) {
  if (!raw) return '';
  const key = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (LABEL_MAP[key]) return LABEL_MAP[key];
  return raw.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}
