import React, { useState, useMemo } from 'react'
import { useFetch } from '../hooks/useFetch'
import {
  getTeamStats, getStandings,
  getPlayoffGames, buildCarPlayoffSummary,
  getTeamCorsi, getTeamRealtime, getTeamScoreState, getTeamPowerplay, getTeamPenaltyKill,
  getTeamHomeSplit, getTeamPlayoffStats, getTeamGameLog, getLiveGame,
} from '../utils/nhlApi'
import { CONTRACTS, DRAFT_PICKS, getCapSummary, CAP_CEILING, CURRENT_SEASON } from '../utils/carContracts'
import { StatBar, MetCard } from '../components/StatBar'
import { seasonPDO } from '../utils/advancedStats'
import InfoTip from '../components/InfoTip'
import TeamLogo from '../components/TeamLogo'
import { TEAM_COLORS } from '../utils/nhlApi'
import './TeamView.css'

const TABS = ['Overview', 'Advanced', 'Splits', 'Trends', 'Cap & Picks']

export default function TeamView() {
  const [tab, setTab] = useState('Overview')

  // Core data
  const { data: stats,        loading: statsLoading  } = useFetch(() => getTeamStats('CAR'))
  const { data: standings,    loading: standLoading  } = useFetch(getStandings)
  const { data: playoffGames, loading: poLoading     } = useFetch(getPlayoffGames)

  // Advanced stats
  const { data: corsiReg   } = useFetch(() => getTeamCorsi(2))
  const { data: realtimeReg } = useFetch(() => getTeamRealtime(2))
  const { data: ppReg      } = useFetch(() => getTeamPowerplay(2))
  const { data: pkReg      } = useFetch(() => getTeamPenaltyKill(2))
  const { data: scoreState } = useFetch(() => getTeamScoreState(2))
  const { data: homeSplit  } = useFetch(() => getTeamHomeSplit(2))
  const { data: poAdv      } = useFetch(getTeamPlayoffStats)
  const { data: gameLog    } = useFetch(() => getTeamGameLog(20))

  const carStanding    = standings?.find(t => t.teamAbbrev?.default === 'CAR')
  const playoffSummary = buildCarPlayoffSummary(playoffGames || [])
  const inPlayoffs     = (playoffGames?.length || 0) > 0

  // Fetch live game so we can exclude in-progress result from standings
  const { data: liveGame } = useFetch(getLiveGame)
  const gameIsLive = !!(liveGame)

  const gp   = stats?.gamesPlayed || 1
  // Standings update in real-time during games — exclude in-progress result
  const wins   = (stats?.wins    || 0) - (gameIsLive && (stats?.wins    || 0) > 0 ? 0 : 0)
  const losses = (stats?.losses  || 0)
  const otl    = (stats?.otLosses|| 0)
  const pts    = (stats?.points  || 0)
  // Note: the standings API reflects current score, so during a live game
  // the leading team shows +1 win. We show a live indicator instead of adjusting.

  // Cap data
  const capSummary      = getCapSummary()
  const capPct          = Math.round((capSummary.committed / CAP_CEILING) * 100)
  const sortedContracts = [...CONTRACTS].sort((a, b) => b.capHit - a.capHit)
  const picksByYear     = {}
  DRAFT_PICKS.forEach(p => {
    if (!picksByYear[p.year]) picksByYear[p.year] = []
    picksByYear[p.year].push(p)
  })

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <TeamLogo abbr="CAR" size={28} />
        <h2 className="view-title" style={{ margin: 0 }}>Carolina Hurricanes</h2>
      </div>
      <p className="view-sub">2025–26 season</p>

      {/* Tab bar */}
      <div className="team-tabs">
        {TABS.map(t => (
          <button key={t} className={`team-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Overview'  && <OverviewTab stats={stats} standLoading={standLoading} statsLoading={statsLoading} poLoading={poLoading} carStanding={carStanding} playoffSummary={playoffSummary} wins={wins} losses={losses} otl={otl} pts={pts} inPlayoffs={inPlayoffs} liveGame={liveGame} corsiReg={corsiReg} realtimeReg={realtimeReg} />}
      {tab === 'Advanced'  && <AdvancedTab corsiReg={corsiReg} realtimeReg={realtimeReg} ppReg={ppReg} pkReg={pkReg} scoreState={scoreState} poAdv={poAdv} inPlayoffs={inPlayoffs} />}
      {tab === 'Splits'    && <SplitsTab homeSplit={homeSplit} stats={stats} playoffSummary={playoffSummary} inPlayoffs={inPlayoffs} />}
      {tab === 'Trends'    && <TrendsTab gameLog={gameLog} />}
      {tab === 'Cap & Picks' && <CapTab capSummary={capSummary} capPct={capPct} sortedContracts={sortedContracts} picksByYear={picksByYear} />}
    </div>
  )
}

// ── Overview tab ──────────────────────────────────────────────
function OverviewTab({ stats, standLoading, statsLoading, poLoading, carStanding, playoffSummary, wins, losses, otl, pts, inPlayoffs, liveGame, corsiReg, realtimeReg }) {
  return (
    <>
      <div className="records-row">
        <div className="card record-block">
          <div className="record-block-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TeamLogo abbr="CAR" size={14} /> Regular Season
          </div>
          {standLoading ? <div className="skeleton" style={{ height: 28, width: '70%' }} /> : (
            <div className="record-main-row">
              <span className="record-big">{wins}–{losses}–{otl}</span>
              {liveGame && (
                <span className="record-live-badge">🔴 LIVE — record updates after final horn</span>
              )}
              <span className="pts-chip">{pts} pts</span>
            </div>
          )}
          {carStanding && (
            <div className="record-meta">
              <span>Div: {carStanding.divisionName}</span>
              <span className="record-meta-sep">·</span>
              <span>Conf: {carStanding.conferenceName}</span>
              {stats?.streakCode && (
                <span className={`streak-chip ${stats.streakCode === 'W' ? 'streak-w' : stats.streakCode === 'L' ? 'streak-l' : 'streak-ot'}`}>
                  {stats.streakCode}{stats.streakCount || ''} streak
                </span>
              )}
            </div>
          )}
        </div>

        {inPlayoffs && (
          <div className="card record-block">
            <div className="record-block-label">Playoffs</div>
            {poLoading ? <div className="skeleton" style={{ height: 28, width: '70%' }} /> : (
              <div className="record-main-row">
                <span className="record-big">
                  {playoffSummary.reduce((s,x) => s+x.carWins, 0)}–
                  {playoffSummary.reduce((s,x) => s+x.oppWins, 0)}
                </span>
              </div>
            )}
            <div className="po-series-list">
              {playoffSummary.sort((a,b) => b.round-a.round).map((s, i) => {
                const oppColor = TEAM_COLORS[s.opponent?.abbrev] || 'var(--text-muted)'
                return (
                  <div key={i} className="po-series-line">
                    <span className={s.carAdvance ? 'series-won' : s.isActive ? 'series-active' : 'series-lost'}>
                      {s.carAdvance ? '✓' : s.isActive ? '▶' : '✗'}
                    </span>
                    <TeamLogo abbr={s.opponent?.abbrev} size={14} color={oppColor} />
                    <span className="series-opp">{s.opponent?.abbrev}</span>
                    <span className="series-score-sm">{s.carWins}–{s.oppWins}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Season stat quick-hits */}
      {stats && (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="sec-label" style={{ marginBottom: 10 }}>Season stats</div>
          <div className="overview-stat-grid">
            {[
              ['Goals/GP',   (stats.goalsForPerGame??0).toFixed(2)],
              ['GA/GP',      (stats.goalsAgainstPerGame??0).toFixed(2)],
              ['PP%',        (stats.powerPlayPct != null ? (stats.powerPlayPct <= 1 ? (stats.powerPlayPct*100).toFixed(1) : stats.powerPlayPct.toFixed(1)) : '—') + '%'],
              ['PK%',        (stats.penaltyKillPct != null ? (stats.penaltyKillPct <= 1 ? (stats.penaltyKillPct*100).toFixed(1) : stats.penaltyKillPct.toFixed(1)) : '—') + '%'],
              ['SOG/GP',     stats.shotsForPerGame?.toFixed(1) ?? '—'],
              ['SA/GP',      stats.shotsAgainstPerGame?.toFixed(1) ?? '—'],
              ['Blks/GP',    stats?.blockedShotsPerGame?.toFixed(1) ?? '—'],
            ].map(([label, val]) => (
              <div key={label} className="overview-stat-cell">
                <div className="overview-stat-label">{label}</div>
                <div className="overview-stat-val">{val}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ── Advanced tab ─────────────────────────────────────────────
function AdvancedTab({ corsiReg, realtimeReg, ppReg, pkReg, scoreState, poAdv, inPlayoffs }) {
  const pdoData = seasonPDO(corsiReg);
  const [showPO, setShowPO] = useState(inPlayoffs);
  function pct(v) { if (v == null) return '—'; return `${(v*100).toFixed(1)}%`; }
  function fmt(v, dec=2) { return v == null ? '—' : Number(v).toFixed(dec); }

  const corsiPo = poAdv?.corsi

  const corsi = showPO ? poAdv?.corsi : corsiReg
  const pp    = showPO ? poAdv?.pp    : ppReg
  const pk    = showPO ? poAdv?.pk    : pkReg

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Reg / Playoff toggle */}
      {inPlayoffs && (
        <div className="adv-toggle">
          <button className={`adv-toggle-btn ${!showPO ? 'active' : ''}`} onClick={() => setShowPO(false)} aria-pressed={!showPO}>📅 Regular Season</button>
          <button className={`adv-toggle-btn ${showPO ? 'active' : ''}`} onClick={() => setShowPO(true)} aria-pressed={showPO}>🏒 Playoffs</button>
        </div>
      )}
      {!inPlayoffs && <div className="adv-context-note">Showing Regular Season stats</div>}

      {/* Shot differential */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom: 8 }}>Shot Volume &amp; Possession</div>
        <div className="adv-explain">
          True Corsi/Fenwick requires play-by-play aggregated across all games — the season-level API only provides shots on goal. Shot For% is a SOG-based proxy. Per-game shot volume gives a picture of territorial control.
        </div>
        <AdvStatRow label="Shot For% (proxy)" val={pct(corsi?.corsiForPct)} note="SOG for ÷ total SOG. ≥50% = outshooting opponents" />
        <AdvStatRow label="Shots For/GP"       val={corsi?.shotsForPerGame     ? fmt(corsi.shotsForPerGame)     : null} />
        <AdvStatRow label="Shots Against/GP"   val={corsi?.shotsAgainstPerGame ? fmt(corsi.shotsAgainstPerGame) : null} />
        <AdvStatRow label="Blocked For/GP"     val={realtimeReg?.blockedShotsPerGame ? fmt(realtimeReg.blockedShotsPerGame) : (corsi?.blockedShotsPerGame ?? stats?.blockedShotsPerGame) ? fmt(corsi?.blockedShotsPerGame ?? stats?.blockedShotsPerGame) : null} note="Shots blocked by CAR skaters per game" />
        <AdvStatRow label="Blocked Against/GP" val={realtimeReg?.blockedShotAttemptsPerGame ? fmt(realtimeReg.blockedShotAttemptsPerGame) : null} note="CAR shots blocked by opponents (from realtime stats)" />
        <AdvStatRow label="Goals For/GP"       val={corsi?.goalsForPerGame     ? fmt(corsi.goalsForPerGame)     : null} />
        <AdvStatRow label="Goals Against/GP"   val={corsi?.goalsAgainstPerGame ? fmt(corsi.goalsAgainstPerGame) : null} />
      </div>

      {/* PDO & Puck Luck */}
      {pdoData && (
        <div className="card">
          <div className="sec-label" style={{ marginBottom: 8 }}>PDO &amp; Puck Luck</div>
          <div className="adv-explain">
            PDO = team shooting% + save% × 100. League average = 100. Values above 102 suggest positive puck luck likely to regress; below 98 suggest negative luck. Useful for identifying unsustainable streaks.
          </div>
          <AdvStatRow label="PDO" val={pdoData.pdo} note={pdoData.luck} />
          <AdvStatRow label="Team SH%" val={`${pdoData.shPct}%`} note="Season shooting %" />
          <AdvStatRow label="Team SV%" val={pdoData.svPct != null ? String(pdoData.svPct) : null} note="Season save %" />
        </div>
      )}

      {/* Power Play */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom: 8 }}>Power Play</div>
        <div className="adv-explain">Net PP% excludes goals where the opposing team was also shorthanded simultaneously.</div>
        <AdvStatRow label="PP%" val={pp ? pct(pp.powerPlayPct) : null} note="League avg ~20%" />
        <AdvStatRow label="Net PP%" val={pp ? pct(pp.powerPlayNetPct) : null} />
        <AdvStatRow label="Faceoff Win%" val={pp ? pct(pp.faceoffWinPct) : null} note="League avg ~50%" />
      </div>

      {/* Penalty Kill */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom: 8 }}>Penalty Kill</div>
        <div className="adv-explain">Net PK% excludes goals while both teams were shorthanded simultaneously.</div>
        <AdvStatRow label="PK%" val={pk ? pct(pk.penaltyKillPct) : null} note="League avg ~80%" />
        <AdvStatRow label="Net PK%" val={pk ? pct(pk.penaltyKillNetPct) : null} />
        <AdvStatRow label="Team Shutouts" val={pk?.teamShutouts} />
      </div>



      {!corsiReg && !ppReg && (
        <div className="card empty-state">
          <div className="empty-icon">📊</div>
          <div className="empty-title">Loading advanced stats…</div>
          <div className="empty-sub">These come from the NHL stats API and may take a moment.</div>
        </div>
      )}
    </div>
  )
}

// ── Splits tab ───────────────────────────────────────────────
function SplitsTab({ homeSplit, stats, playoffSummary, inPlayoffs }) {
  const home = homeSplit?.home
  const away = homeSplit?.away

  function rec(d) {
    if (!d) return '—'
    return `${d.wins||0}–${d.losses||0}–${d.otLosses||0}`
  }
  function gpg(d) {
    if (!d) return '—'
    // team/summary uses goalsFor (total) or goalsForPerGame
    if (d.goalsForPerGame != null) return d.goalsForPerGame.toFixed(2)
    if (d.goalsFor != null && d.gamesPlayed) return (d.goalsFor/d.gamesPlayed).toFixed(2)
    if (d.goalFor  != null && d.gamesPlayed) return (d.goalFor /d.gamesPlayed).toFixed(2)
    return '—'
  }
  function gapg(d) {
    if (!d) return '—'
    if (d.goalsAgainstPerGame != null) return d.goalsAgainstPerGame.toFixed(2)
    if (d.goalsAgainst != null && d.gamesPlayed) return (d.goalsAgainst/d.gamesPlayed).toFixed(2)
    if (d.goalAgainst  != null && d.gamesPlayed) return (d.goalAgainst /d.gamesPlayed).toFixed(2)
    return '—'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Home vs Away */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom: 10 }}>Home vs Away — Regular Season</div>
        <div className="split-compare">
          <div className="split-col home-col">
            <div className="split-header">🏠 Home (Lenovo Center)</div>
            <div className="split-record">{rec(home)}</div>
            <div className="split-stats">
              <SplitStat label="GF/GP"  val={gpg(home)} />
              <SplitStat label="GA/GP"  val={gapg(home)} />
              <SplitStat label="Points" val={home?.points ?? '—'} />
            </div>
          </div>
          <div className="split-divider">vs</div>
          <div className="split-col away-col">
            <div className="split-header">✈ Away</div>
            <div className="split-record">{rec(away)}</div>
            <div className="split-stats">
              <SplitStat label="GF/GP"  val={gpg(away)} />
              <SplitStat label="GA/GP"  val={gapg(away)} />
              <SplitStat label="Points" val={away?.points ?? '—'} />
            </div>
          </div>
        </div>
      </div>

      {/* Reg vs Playoff */}
      {inPlayoffs && stats && (
        <div className="card">
          <div className="sec-label" style={{ marginBottom: 10 }}>Regular Season vs Playoffs</div>
          <div className="split-compare">
            <div className="split-col">
              <div className="split-header">📅 Regular Season</div>
              <div className="split-record">{stats.wins||0}–{stats.losses||0}–{stats.otLosses||0}</div>
              <div className="split-stats">
                <SplitStat label="GF/GP" val={(stats.goalsForPerGame??0).toFixed(2)} />
                <SplitStat label="GA/GP" val={(stats.goalsAgainstPerGame??0).toFixed(2)} />
                <SplitStat label="PP%"   val={stats.powerPlayPct != null ? `${(stats.powerPlayPct*100).toFixed(1)}%` : '—'} />
              </div>
            </div>
            <div className="split-divider">vs</div>
            <div className="split-col">
              <div className="split-header">🏒 Playoffs</div>
              <div className="split-record">
                {playoffSummary.reduce((s,x) => s+x.carWins, 0)}–
                {playoffSummary.reduce((s,x) => s+x.oppWins, 0)}
              </div>
              <div className="split-stats">
                <SplitStat label="Series" val={`${playoffSummary.filter(s=>s.carAdvance).length}–${playoffSummary.filter(s=>s.eliminated).length}`} />
                <SplitStat label="Games"  val={`${playoffSummary.reduce((s,x)=>s+x.games.length,0)}`} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Trends tab ───────────────────────────────────────────────

// ── TapDot: chart element with tap-to-open label ──────────────
// display:contents makes the outer wrapper invisible to flex/grid layout.
// The popup is rendered inside the child element (which has position:relative).
function TapDot({ text, children, popupClass = 'tap-label-popup' }) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef(null)

  React.useEffect(() => {
    if (!open) return
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close, { passive: true })
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [open])

  // Clone the single child and inject the popup + click handler into it
  const child = React.Children.only(children)
  return React.cloneElement(child, {
    ref,
    onClick: e => { e.stopPropagation(); setOpen(o => !o) },
    style: { ...child.props.style, position: 'relative', cursor: 'pointer' },
    children: [
      ...(Array.isArray(child.props.children)
        ? child.props.children
        : [child.props.children]),
      open && (
        <div key="tap-popup" className={popupClass} onClick={e => e.stopPropagation()}>
          <span className="tap-label-body">{text}</span>
          <button
            className="tap-label-close"
            onMouseDown={e => { e.stopPropagation(); setOpen(false) }}
            aria-label="Close"
          >✕</button>
        </div>
      ),
    ],
  })
}

function TrendsTab({ gameLog }) {
  if (!gameLog?.length) {
    return (
      <div className="card empty-state">
        <div className="empty-icon">📈</div>
        <div className="empty-title">Loading game log…</div>
      </div>
    )
  }

  // Rolling 10-game win % 
  const rolling = gameLog.map((g, i) => {
    const window = gameLog.slice(Math.max(0, i - 9), i + 1)
    const w10pct = Math.round((window.filter(x => x.won).length / window.length) * 100)
    return { ...g, w10pct }
  })

  // Current streak
  let streak = 0, streakType = ''
  for (let i = gameLog.length - 1; i >= 0; i--) {
    const g = gameLog[i]
    if (i === gameLog.length - 1) { streakType = g.won ? 'W' : 'L'; streak = 1 }
    else if ((g.won && streakType === 'W') || (!g.won && streakType === 'L')) streak++
    else break
  }

  const last10 = gameLog.slice(-10)
  const last10W = last10.filter(g => g.won).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Quick stats */}
      <div className="card">
        <div className="trends-quick">
          <div className="tq-item">
            <div className="tq-label">Current streak</div>
            <div className="tq-val" style={{ color: streakType === 'W' ? 'var(--green)' : 'var(--red-bright)' }}>
              {streakType}{streak}
            </div>
          </div>
          <div className="tq-item">
            <div className="tq-label">Last 10 games</div>
            <div className="tq-val">{last10W}–{10 - last10W}</div>
          </div>
          <div className="tq-item">
            <div className="tq-label">Win % L10</div>
            <div className="tq-val">{Math.round(last10W / 10 * 100)}%</div>
          </div>
        </div>
      </div>

      {/* Game-by-game result dots */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom: 10 }}>Last {gameLog.length} games</div>
        <div className="result-dots">
          {gameLog.map((g, i) => (
            <TapDot
              key={i}
              text={`${g.date?.slice(5,10)} vs ${g.opp}: ${g.result} ${g.carScore}–${g.oppScore}${g.home ? ' (Home)' : ' (Away)'}`}
            >
              <div className={`result-dot ${g.result.toLowerCase()}`}>
                {g.result === 'OTL' ? 'O' : g.result}
              </div>
            </TapDot>
          ))}
        </div>
      </div>

      {/* Rolling 10-game win % chart */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom: 10 }}>Rolling 10-game win %</div>
        <div className="rolling-chart">
          {rolling.map((g, i) => (
            <TapDot key={i} text={`Game ${i+1}: ${g.w10pct}% win rate`}>
            <div className="rolling-bar-wrap">
              <div
                className={`rolling-bar ${g.w10pct >= 60 ? 'hot' : g.w10pct >= 40 ? 'ok' : 'cold'}`}
                style={{ height: `${g.w10pct}%` }}
              />
              {i % 5 === 0 && <div className="rolling-label">{i + 1}</div>}
            </div>
            </TapDot>
          ))}
          <div className="rolling-avg-line" style={{ bottom: '50%' }} aria-label="50% win rate" />
        </div>
        <div className="rolling-legend">
          <span className="rl-hot">■ Hot (≥60%)</span>
          <span className="rl-ok">■ Average (40–60%)</span>
          <span className="rl-cold">■ Cold (&lt;40%)</span>
        </div>
      </div>

      {/* Score differential trend */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom: 6 }}>Goal differential by game</div>
        <div className="gd-chart-wrap">
          <div className="gd-baseline-line" />
          <div className="gd-bars">
            {gameLog.map((g, i) => {
              const diff = g.carScore - g.oppScore
              const absPx = Math.min(Math.abs(diff) * 12, 48)
              return (
                <TapDot key={i} text={`${g.date?.slice(5,10)} vs ${g.opp}: ${diff > 0 ? '+' : ''}${diff}`}>
                <div className="gd-bar-col">
                  <div className="gd-top">
                    {diff > 0 && <div className="gd-bar pos" style={{ height: absPx }} />}
                  </div>
                  <div className="gd-bot">
                    {diff < 0 && <div className="gd-bar neg" style={{ height: absPx }} />}
                  </div>
                </div>
                </TapDot>
              )
            })}
          </div>
        </div>
        <div className="gd-legend">
          <span className="gd-leg pos">■ Win (positive diff)</span>
          <span className="gd-leg neg">■ Loss (negative diff)</span>
        </div>
      </div>
    </div>
  )
}

// ── Cap & Picks tab ──────────────────────────────────────────
function CapTab({ capSummary, capPct, sortedContracts, picksByYear }) {
  return (
    <>
      <div className="card" style={{ marginTop: 4 }}>
        <div className="sec-label" style={{ marginBottom: 10 }}>Salary Cap · {CURRENT_SEASON}</div>
        <div className="cap-bar-wrap">
          <div className="cap-bar-fill" style={{ width: `${capPct}%` }} />
          <div className="cap-bar-track" />
        </div>
        <div className="cap-bar-labels">
          <span className="cap-committed">${(capSummary.committed/1_000_000).toFixed(1)}M committed</span>
          <span className="cap-space" style={{ color: capSummary.space < 5_000_000 ? 'var(--red-bright)' : 'var(--green)' }}>
            ${(capSummary.space/1_000_000).toFixed(1)}M cap space
          </span>
        </div>
        <div className="cap-ceiling-label">Cap ceiling: ${(CAP_CEILING/1_000_000).toFixed(1)}M</div>
        <div className="cap-table">
          <div className="cap-table-header">
            <span>Player</span><span>Pos</span><span>Cap Hit</span>
            <span>Type</span><span>Expires</span>
          </div>
          {sortedContracts.map((c, i) => {
            const barPct = Math.round((c.capHit / CAP_CEILING) * 100)
            const isExpiring = c.yearsLeft === 0
            return (
              <div key={i} className={`cap-row ${isExpiring ? 'expiring' : ''}`}>
                <span className="cap-name">{c.name}</span>
                <span className="cap-pos">{c.pos}</span>
                <div className="cap-hit-cell">
                  <div className="cap-hit-bar" style={{ width: `${Math.min(barPct * 3, 100)}%` }} />
                  <span className="cap-hit-val">${(c.capHit/1_000_000).toFixed(2)}M</span>
                </div>
                <span className={`cap-type ${c.type === 'UFA' ? 'ufa' : 'rfa'}`}>
                  {c.type}{c.note ? ` · ${c.note}` : ''}
                </span>
                <span className="cap-expires" style={{ color: isExpiring ? 'var(--amber)' : 'var(--text-dim)' }}>
                  {c.expiresAfter}
                </span>
              </div>
            )
          })}
        </div>
        {capSummary.expiring.length > 0 && (
          <div className="cap-expiring-note">
            ⚠ {capSummary.ufa.length} UFA{capSummary.ufa.length !== 1 ? 's' : ''} and {capSummary.rfa.length} RFA{capSummary.rfa.length !== 1 ? 's' : ''} expiring this summer
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 10 }}>
        <div className="sec-label" style={{ marginBottom: 10 }}>Future Draft Picks Owned</div>
        {Object.entries(picksByYear).map(([year, picks]) => (
          <div key={year} className="picks-year-row">
            <span className="picks-year">{year}</span>
            <div className="picks-chips">
              {picks.sort((a,b) => a.round - b.round).map((p, i) => (
                <div key={i} className={`pick-chip r${p.round}`}>
                  <span className="pick-round">
                    {p.round === 1 ? '1st' : p.round === 2 ? '2nd' : p.round === 3 ? '3rd' : `${p.round}th`}
                  </span>
                  {p.from !== 'CAR (own)' && <span className="pick-from">{p.from}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="picks-note">Source: PuckPedia (updated May 2026). Conditional picks not shown.</div>
      </div>
    </>
  )
}

// ── Shared sub-components ────────────────────────────────────
function AdvStatRow({ label, val, note }) {
  return (
    <div className="adv-stat-row">
      <span className="adv-stat-label">
        {label}
        {note && <span className="adv-stat-note"> · {note}</span>}
      </span>
      <span className="adv-stat-val">{val ?? '—'}</span>
    </div>
  )
}

function SplitStat({ label, val }) {
  return (
    <div className="split-stat">
      <span className="split-stat-label">{label}</span>
      <span className="split-stat-val">{val}</span>
    </div>
  )
}
