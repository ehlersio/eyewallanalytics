import { useState, useRef, useEffect, useMemo } from 'react'
import { useFetch } from '../hooks/useFetch'
import { getRoster, getPlayerStats, fetchPlayerRankings, getPlayoffGames, getStandings } from '../utils/nhlApi'
import { getPlayerAnalytics, getGoalieAnalytics, getPlayerShots, getTeamSkaterStatsFromDB } from '../utils/supabaseClient'
import { findContract, contractValue, pointsPer60, valueLabel, goalieContractValue, goalieValueLabel, CAP_CEILING, CURRENT_SEASON } from '../utils/carContracts'
import TeamLogo from '../components/TeamLogo'
import InfoTip from '../components/InfoTip'
import IceRink from '../components/IceRink'
import './PlayersView.css'

const SEASON       = 20252026
const SEASON_LABEL = '2025–26'

// ─── Stat definitions with tooltips ──────────────────────────

const SKATER_STATS = [
  // Scoring
  { key: 'goals',              label: 'Goals',       group: 'Scoring',
    tip: 'Total goals scored. A goal is awarded when the puck fully crosses the opposing goal line.',
    why: 'The most direct measure of a player\'s finishing ability and offensive contribution.' },
  { key: 'assists',            label: 'Assists',     group: 'Scoring',
    tip: 'Points credited for setting up a goal. Up to two assists are awarded per goal.',
    why: 'Reflects a player\'s playmaking and vision. Some elite players accumulate far more assists than goals.' },
  { key: 'points',             label: 'Points',      group: 'Scoring',
    tip: 'Goals + Assists. The primary measure of offensive production.',
    why: 'The standard yardstick for comparing forwards and offensive defencemen across the league.' },
  { key: 'plusMinus',          label: '+/−',         group: 'Scoring',
    tip: '+1 when on ice for a 5v5 or 4v4 goal for; −1 when on ice for one against. PP/SH goals excluded.',
    why: 'A rough proxy for two-way effectiveness, though heavily influenced by linemates and usage.' },
  { key: 'gamesPlayed',        label: 'GP',          group: 'Scoring',
    tip: 'Games played in this sample.',
    why: 'Context for all counting stats — a player with 20 points in 25 games is more productive than 20 in 40.' },

  // Special teams
  { key: 'powerPlayGoals',     label: 'PPG',         group: 'Special Teams',
    tip: 'Goals scored while your team has a man advantage (power play).',
    why: 'Power play specialists can have outsized PPG totals. Compare to even-strength goals for full picture.' },
  { key: 'powerPlayPoints',    label: 'PPP',         group: 'Special Teams',
    tip: 'Goals + Assists on the power play.',
    why: 'High PPP players are valuable on the man-advantage unit but may be less impactful at 5v5.' },
  { key: 'shorthandedGoals',   label: 'SHG',         group: 'Special Teams',
    tip: 'Goals scored while your team is shorthanded (penalty kill).',
    why: 'Rare and opportunistic — indicates speed and instinct.' },
  { key: 'gameWinningGoals',   label: 'GWG',         group: 'Special Teams',
    tip: 'The goal that proved to be the winning margin. If the final score is 4–2, the 3rd goal for the winner is the GWG.',
    why: 'A measure of clutch scoring, though partially luck-dependent.' },

  // Shot quality
  { key: 'shots',              label: 'Shots',       group: 'Shot Quality',
    tip: 'Shots on goal — shots that would have entered the net if not for the goalie.',
    why: 'High shot volume indicates an offensive presence even when not scoring.' },
  { key: 'shootingPctg',       label: 'S%',          group: 'Shot Quality',
    tip: 'Goals ÷ Shots on Goal × 100. League average for forwards is roughly 10–12%.',
    calc: 'S% = (Goals / Shots) × 100',
    why: 'Sustained high S% indicates elite finishing; very high or low rates often regress toward average over time.' },

  // Ice time
  { key: 'avgToi',             label: 'TOI/G',       group: 'Ice Time',
    tip: 'Average time on ice per game (minutes:seconds).',
    why: 'Coaches allocate more ice time to trusted players. Elite forwards average 18–22 min; top D pairs often exceed 24 min.' },
  { key: 'pim',                label: 'PIM',         group: 'Ice Time',
    tip: 'Penalty minutes. 2 min per minor, 4 per double minor, 5 per major.',
    why: 'High PIM means the player spends time in the box — hurting the team — though some physical players balance this with defensive value.' },
  { key: 'faceoffWinningPctg', label: 'FO%',         group: 'Ice Time',
    tip: 'Percentage of faceoffs won. Relevant mainly for centres.',
    calc: 'FO% = (Faceoffs Won / Total Faceoffs) × 100',
    why: 'Winning faceoffs gives your team puck possession. A rate above 50% is above average.' },
]

const GOALIE_STATS = [
  { key: 'gamesPlayed',   label: 'GP',   group: 'Record',
    tip: 'Games played.', why: 'Context for all other goalie stats.' },
  { key: 'wins',          label: 'W',    group: 'Record',
    tip: 'Wins — the starter in a winning game receives the win.',
    why: 'The primary measure of a goalie\'s team contribution, though win totals depend on the team in front of them.' },
  { key: 'losses',        label: 'L',    group: 'Record',
    tip: 'Regulation losses.', why: 'Combined with OTL gives the full record picture.' },
  { key: 'otLosses',      label: 'OTL',  group: 'Record',
    tip: 'Overtime/shootout losses. The team earns 1 point; the goalie still receives a loss.',
    why: 'Goalies with many OTL often faced close games — neither good nor bad on its own.' },
  { key: 'savePctg',      label: 'SV%',  group: 'Performance',
    tip: 'Saves ÷ Shots Against. League average is roughly .910; elite is above .920.',
    calc: 'SV% = Saves / Shots Against',
    why: 'The most important single goalie stat. Even small differences are significant — .920 vs .900 = 2 extra goals allowed per 100 shots.' },
  { key: 'goalsAgainstAvg', label: 'GAA', group: 'Performance',
    tip: 'Goals allowed per 60 minutes of play.',
    calc: 'GAA = (Goals Against / Minutes Played) × 60',
    why: 'Context-dependent — a goalie on a weak team will face more shots. Best read alongside SV%.' },
  { key: 'shotsAgainst',   label: 'SA',  group: 'Performance',
    tip: 'Shots on goal faced. Indicates workload.', why: 'High SA means the team gives up many chances; context for SV%.' },
  { key: 'saves',          label: 'SV',  group: 'Performance',
    tip: 'Total saves made.', why: 'Combined with SA gives the SV%.' },
  { key: 'shutouts',       label: 'SO',  group: 'Performance',
    tip: 'Games where the goalie allowed zero goals (must play the full game).',
    why: 'A prestigious milestone. Elite goalies typically post 5–7 per full season.' },
  { key: 'gamesStarted',   label: 'GS',  group: 'Record',
    tip: 'Games where the goalie started in net.',
    why: 'Distinguishes full-time starters from backups; relevant for season-long workload.' },
]

// ─── Main component ───────────────────────────────────────────

export default function PlayersView() {
  const { data: roster,      loading: rosterLoading } = useFetch(() => getRoster('CAR'))
  const { data: poGames }   = useFetch(getPlayoffGames)
  const { data: standings } = useFetch(getStandings)
  const [selected, setSelected] = useState(null)
  const [view, setView]         = useState('roster')
  const [gameType, setGameType] = useState(2)
  const inPlayoffs = (poGames?.length || 0) > 0

  const { data: skaterStats, loading: statsLoading } = useFetch(
    () => getTeamSkaterStatsFromDB('CAR', 20252026, gameType),
    [gameType]
  )

  return (
    <div className="page">
      <div className="players-header">
        <h2 className="view-title">
          <TeamLogo abbr="CAR" size={22} />
          Roster
        </h2>
        <p className="players-sub">Tap a player for detailed stats &amp; rankings</p>
      </div>

      {/* View toggle */}
      <div className="players-tabs">
        <button className={`players-tab ${view === 'roster' ? 'active' : ''}`} onClick={() => setView('roster')}>🃏 Roster</button>
        <button className={`players-tab ${view === 'stats'  ? 'active' : ''}`} onClick={() => setView('stats')}>📊 Stats</button>
      </div>

      {view === 'stats' && (
        <>
          <div className="players-tabs" style={{ marginTop: 8, marginBottom: 4 }}>
            <button className={`players-tab ${gameType === 2 ? 'active' : ''}`} onClick={() => setGameType(2)}>Regular Season</button>
            <button className={`players-tab ${gameType === 3 ? 'active' : ''}`} onClick={() => setGameType(3)}>🏆 Playoffs</button>
          </div>
          <SkaterStatsTable skaters={skaterStats || []} loading={statsLoading} gameType={gameType} onSelect={(id) => {
            const p = roster?.all?.find(r => r.id === id);
            if (p) setSelected(p);
          }} />
        </>
      )}

      {view === 'roster' && (
        <>
          {rosterLoading && <RosterSkeleton />}
          {!rosterLoading && roster && (
            <>
              <RosterSection title="Forwards"   players={roster.forwards}   onSelect={setSelected} />
              <RosterSection title="Defensemen" players={roster.defensemen} onSelect={setSelected} />
              <RosterSection title="Goalies"    players={roster.goalies}    onSelect={setSelected} />
            </>
          )}
        </>
      )}

      {selected && (
        <PlayerPopup
          player={selected}
          inPlayoffs={inPlayoffs}
          standings={standings || []}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

// ─── Roster section ───────────────────────────────────────────

function RosterSection({ title, players = [], onSelect }) {
  if (!players.length) return null
  const sorted = [...players].sort((a, b) => (a.sweaterNumber || 0) - (b.sweaterNumber || 0))
  return (
    <div className="roster-section">
      <div className="sec-label">{title}</div>
      <div className="roster-grid">
        {sorted.map(p => <PlayerCard key={p.id} player={p} onClick={() => onSelect(p)} />)}
      </div>
    </div>
  )
}

// ─── Player card (roster tile) ────────────────────────────────

function PlayerCard({ player: p, onClick }) {
  const [imgErr, setImgErr] = useState(false)
  const name = `${p.firstName?.default || ''} ${p.lastName?.default || ''}`.trim()
  return (
    <div className="player-card card" onClick={onClick}>
      <div className="pc-photo-wrap">
        {!imgErr && p.headshot ? (
          <img src={p.headshot} alt={name} className="pc-photo" onError={() => setImgErr(true)} />
        ) : (
          <div className="pc-photo-fallback">
            {(p.firstName?.default?.[0] || '') + (p.lastName?.default?.[0] || '')}
          </div>
        )}
        <span className="pc-num">#{p.sweaterNumber}</span>
      </div>
      <div className="pc-info">
        <span className="pc-first">{p.firstName?.default}</span>
        <span className="pc-last">{p.lastName?.default}</span>
        <div className="pc-badges">
          <span className="pc-pos">{p.positionCode}</span>
          {p.shootsCatches && <span className="pc-shoots">{p.shootsCatches}</span>}
        </div>
      </div>
    </div>
  )
}

// ─── Player popup ─────────────────────────────────────────────

function PlayerPopup({ player: p, inPlayoffs, standings, onClose }) {
  const { data: stats, loading } = useFetch(() => getPlayerStats(p.id), [p.id])
  const [imgErr, setImgErr]     = useState(false)
  const [ppTab, setPpTab]       = useState('stats') // 'stats' | 'analytics' | 'heatmap'
  const name = `${p.firstName?.default || ''} ${p.lastName?.default || ''}`.trim()

  // Fetch season shot data from Supabase
  const { data: shotData } = useFetch(
    () => getPlayerShots(p.id),
    [p.id]
  )

  // Fetch MoneyPuck analytics from Supabase
  const { data: mpAll } = useFetch(
    () => getPlayerAnalytics(),
    []
  )
  const mpData = mpAll?.[String(p.id)] || null

  // Fetch goalie analytics from Supabase
  const { data: goalieAll } = useFetch(
    () => getGoalieAnalytics(),
    []
  )
  const goalieData = goalieAll?.[String(p.id)] || null

  // Extract stats for each context in display order
  const seasonPO  = stats?.seasonTotals?.find(s => s.season === SEASON && s.gameTypeId === 3)
  const seasonReg = stats?.seasonTotals?.find(s => s.season === SEASON && s.gameTypeId === 2)
  const careerPO  = stats?.careerTotals?.playoffs
  const careerReg = stats?.careerTotals?.regularSeason

  const isGoalie  = p.positionCode === 'G'
  // Fetch rankings — wait for both stats and standings to be ready
  const { data: rankings } = useFetch(
    () => (stats && standings?.length)
      ? fetchPlayerRankings(p.id, isGoalie, inPlayoffs, p.teamAbbrev || 'CAR', standings)
      : Promise.resolve(null),
    [p.id, !!stats, !!standings?.length, inPlayoffs]
  )

  // Sections in order — playoffs first when in playoffs
  const sections = inPlayoffs
    ? [
        { label: `${SEASON_LABEL} Playoffs`, stats: seasonPO,  highlight: true },
        { label: 'Career Playoffs',           stats: careerPO,  highlight: false },
        { label: `${SEASON_LABEL} Regular season`, stats: seasonReg, highlight: false },
        { label: 'Career Regular season',     stats: careerReg, highlight: false },
      ]
    : [
        { label: `${SEASON_LABEL} Regular season`, stats: seasonReg, highlight: true },
        { label: `${SEASON_LABEL} Playoffs`,       stats: seasonPO,  highlight: false },
        { label: 'Career Regular season',     stats: careerReg, highlight: false },
        { label: 'Career Playoffs',           stats: careerPO,  highlight: false },
      ]

  const statDefs = isGoalie ? GOALIE_STATS : SKATER_STATS

  function fmtHeight(inches) {
    if (!inches) return null
    return `${Math.floor(inches / 12)}′${inches % 12}″`
  }
  function fmtBirth(dateStr) {
    if (!dateStr) return null
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }
  function calcAge(dateStr) {
    if (!dateStr) return null
    const today = new Date(), dob = new Date(dateStr)
    let age = today.getFullYear() - dob.getFullYear()
    if (today.getMonth() < dob.getMonth() ||
        (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--
    return age
  }

  const bio      = stats || p
  const contract = findContract(p.id, p.lastName?.default)

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div className="player-popup" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="pp-header">
          <div className="pp-photo-wrap">
            {!imgErr && (stats?.headshot || p.headshot) ? (
              <img src={stats?.headshot || p.headshot} alt={name}
                className="pp-photo" onError={() => setImgErr(true)} />
            ) : (
              <div className="pp-photo-fallback">
                {(p.firstName?.default?.[0] || '') + (p.lastName?.default?.[0] || '')}
              </div>
            )}
          </div>
          <div className="pp-identity">
            <div className="pp-num">#{p.sweaterNumber}</div>
            <div className="pp-name">
              <span className="pp-first">{p.firstName?.default}</span>
              <span className="pp-last">{p.lastName?.default}</span>
            </div>
            <div className="pp-chips">
              <span className="pp-pos-chip">{posLabel(p.positionCode)}</span>
              {bio.heightInInches && <span className="pp-chip">{fmtHeight(bio.heightInInches)}</span>}
              {bio.weightInPounds && <span className="pp-chip">{bio.weightInPounds} lbs</span>}
              {p.shootsCatches && (
                <span className="pp-chip">{isGoalie ? 'Catches' : 'Shoots'} {p.shootsCatches === 'L' ? 'Left' : 'Right'}</span>
              )}
            </div>
            {bio.birthDate && (
              <div className="pp-birth">
                {fmtBirth(bio.birthDate)} · Age {calcAge(bio.birthDate)}
                {bio.birthCity?.default && ` · ${bio.birthCity.default}`}
                {bio.birthCountry && `, ${bio.birthCountry}`}
              </div>
            )}
          </div>
          <button className="pp-close" onClick={onClose} aria-label="Close player details">✕</button>
        </div>

        {/* ── Rankings banner ── */}
        {rankings && (rankings.division || rankings.conference || rankings.league) && (
          <div className="pp-rankings">
            <span className="pp-rank-label">Ranked by {rankings.statLabel}</span>
            <div className="pp-rank-items">
              {rankings.division   && <RankBadge label="Division"   rank={rankings.division} />}
              {rankings.conference && <RankBadge label="Conference" rank={rankings.conference} />}
              {rankings.league     && <RankBadge label="League"     rank={rankings.league} />}
            </div>
            {/* GAA ranking for goalies */}
            {rankings.gaa && (rankings.gaa.league || rankings.gaa.division) && (
              <>
                <span className="pp-rank-label" style={{ marginTop: 8 }}>Ranked by GAA</span>
                <div className="pp-rank-items">
                  {rankings.gaa.division   && <RankBadge label="Division"   rank={rankings.gaa.division} />}
                  {rankings.gaa.conference && <RankBadge label="Conference" rank={rankings.gaa.conference} />}
                  {rankings.gaa.league     && <RankBadge label="League"     rank={rankings.gaa.league} />}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Contract & value panel ── */}
        {contract && (
          <div className="pp-contract">
            <div className="pp-contract-row">
              <div className="pp-contract-item">
                <div className="pp-contract-label">Cap Hit</div>
                <div className="pp-contract-val">${(contract.capHit / 1_000_000).toFixed(2)}M</div>
              </div>
              <div className="pp-contract-item">
                <div className="pp-contract-label">AAV / Year</div>
                <div className="pp-contract-val">${(contract.capHit / 1_000_000).toFixed(2)}M</div>
              </div>
              <div className="pp-contract-item">
                <div className="pp-contract-label">Expires After</div>
                <div className="pp-contract-val">{contract.expiresAfter}</div>
              </div>
              <div className="pp-contract-item">
                <div className="pp-contract-label">Status</div>
                <div className="pp-contract-val">{contract.type}{contract.note ? ` · ${contract.note}` : ''}</div>
              </div>
              <div className="pp-contract-item">
                <div className="pp-contract-label">Yrs Left</div>
                <div className="pp-contract-val">{contract.yearsLeft}</div>
              </div>
              <div className="pp-contract-item">
                <div className="pp-contract-label">% of Cap</div>
                <div className="pp-contract-val">{((contract.capHit / CAP_CEILING) * 100).toFixed(1)}%</div>
              </div>
            </div>
            {(() => {
              const regStats = stats?.seasonTotals?.find(s => s.season === 20252026 && s.gameTypeId === 2)
              const pts   = regStats?.points ?? 0
              const gp    = regStats?.gamesPlayed ?? 0
              const isELC = contract.note === 'ELC' || contract.capHit < 1_200_000
              const war   = mpData?.war ?? null
              const result = !isGoalie && gp > 0 ? contractValue(pts, gp, contract.capHit, isELC, war) : null
              const score = result?.score ?? null
              const method = result?.method ?? 'points'
              const vl    = valueLabel(score)
              const p60   = !isGoalie && regStats?.avgToi
                ? pointsPer60(pts, (regStats.avgToi?.includes?.(':')
                    ? regStats.avgToi.split(':').reduce((m,s,i) => i===0 ? +s*60 : m + +s, 0)
                    : Number(regStats.avgToi)) * gp)
                : null
              const valueTooltip = method === 'blended'
                ? `Blended score: 60% points per $1M (projected to 82 GP) + 40% WAR per $1M (scaled). WAR captures two-way value points miss — defensive specialists and shutdown players score higher here than on a pure points basis. Scale: ≥8.0 Exceptional · ≥5.0 Great · ≥3.0 Good · ≥1.8 Fair · ≥1.0 Below avg · <1.0 Overpaid. ELC contracts excluded.`
                : `Points per $1M of cap hit (projected to 82 games). WAR data unavailable for this player — using points only. Scale: ≥8.0 Exceptional · ≥5.0 Great · ≥3.0 Good · ≥1.8 Fair · ≥1.0 Below avg · <1.0 Overpaid. ELC contracts excluded.`
              return (
                <div className="pp-value-row">
                  {score != null && vl && (
                    <div className="pp-value-badge" style={{ background: vl.color + '22', borderColor: vl.color + '55', color: vl.color }}>
                      <span>{vl.label}</span>
                      <span className="pp-value-score">
                        {score} {method === 'blended' ? 'blended/$M' : 'pts/$M'}
                      </span>
                      <InfoTip label="Contract Value Score" text={valueTooltip} />
                    </div>
                  )}
                  {p60 != null && (
                    <div className="pp-adv-chip">P/60: <strong>{p60}</strong>
                      <InfoTip label="P/60" text="Points per 60 minutes of ice time. Removes ice time differences — a player with 10 pts in 12 min/game produces at a very different rate than 10 pts in 22 min/game. League avg for top-6 forwards: ~2.0–3.5." />
                    </div>
                  )}
                  {isELC && !isGoalie && (
                    <div className="pp-adv-chip" style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
                      ELC — value score N/A
                      <InfoTip label="ELC Contract" text="Entry Level Contracts have a league-mandated cap hit ($775K–$925K) that doesn't reflect market value, so the blended value comparison isn't meaningful." />
                    </div>
                  )}
                  {isGoalie && (() => {
                    const gsax   = goalieData?.gsax ?? null
                    const gGp    = goalieData?.gp ?? 0
                    const isELC  = contract.note === 'ELC' || contract.capHit < 1_200_000
                    const gScore = goalieContractValue(gsax, gGp, contract.capHit, isELC)
                    const gVl    = goalieValueLabel(gScore)
                    if (!gScore || !gVl) return isELC ? (
                      <div className="pp-adv-chip" style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
                        ELC — value score N/A
                        <InfoTip label="ELC Contract" text="ELC cap hits are league-mandated and don't reflect market value." />
                      </div>
                    ) : null
                    return (
                      <div className="pp-value-badge" style={{ background: gVl.color + '22', borderColor: gVl.color + '55', color: gVl.color }}>
                        <span>{gVl.label}</span>
                        <span className="pp-value-score">GSAX {gScore > 0 ? '+' : ''}{gScore}/$M</span>
                        <InfoTip label="Goalie Value Score" text="Goals saved above expected (GSAX) per $1M of cap hit. GSAX accounts for shot quality and volume — a positive number means the goalie saved more goals than an average goalie would have on the same shots. Dividing by cap hit shows how much of that value you're getting per dollar. Scale: ≥4.0 Exceptional · ≥2.0 Great · ≥0.0 Fair · ≥-2.0 Below avg · <-2.0 Overpaid. ELC goalies excluded." />
                      </div>
                    )
                  })()}
                </div>
              )
            })()}
          </div>
        )}

        {/* ── Tab toggle ── */}
        <div className="pp-tabs">
          <button className={`pp-tab ${ppTab === 'stats' ? 'active' : ''}`} onClick={() => setPpTab('stats')}>📊 Stats</button>
          <button className={`pp-tab ${ppTab === 'analytics' ? 'active' : ''}`} onClick={() => setPpTab('analytics')}>🧮 Analytics</button>
          <button className={`pp-tab ${ppTab === 'heatmap' ? 'active' : ''}`} onClick={() => setPpTab('heatmap')}>🎯 Heat Map</button>
        </div>

        {/* ── Stats tab ── */}
        {ppTab === 'stats' && (
        <div className="pp-body">
          {loading && (
            <div className="pp-loading">
              {[80,60,70,50].map((w,i) => (
                <div key={i} className="skeleton" style={{ height: 11, width: `${w}%`, marginBottom: 10 }} />
              ))}
            </div>
          )}

          {!loading && sections.map(({ label, stats: s, highlight }) => {
            if (!s) return null
            const groups = groupStats(statDefs, s, isGoalie)
            if (!groups.length) return null
            return (
              <StatSection key={label} label={label} groups={groups} highlight={highlight} isGoalie={isGoalie} />
            )
          })}

          {!loading && !sections.some(s => s.stats) && (
            <div className="pp-no-stats">No stats available for this player yet.</div>
          )}
        </div>
        )}

        {/* ── Heat map tab ── */}
        {ppTab === 'heatmap' && (
          <PlayerHeatMap shotData={shotData} playerName={name} isGoalie={p.positionCode === 'G'} />
        )}

        {/* ── Analytics tab ── */}
        {ppTab === 'analytics' && (
          <PlayerAnalytics mpData={mpData} goalieData={goalieData} playerName={name} isGoalie={p.positionCode === 'G'} position={p.positionCode} />
        )}
      </div>
    </div>
  )
}

// ─── Rank badge ───────────────────────────────────────────────

function RankBadge({ label, rank }) {
  const suffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'
  const color  = rank <= 3 ? 'var(--green)' : rank <= 10 ? 'var(--amber)' : 'var(--text-muted)'
  return (
    <div className="rank-badge">
      <span className="rank-num" style={{ color }}>{rank}<sup>{suffix}</sup></span>
      <span className="rank-scope">{label}</span>
    </div>
  )
}

// ─── Stat section ─────────────────────────────────────────────

function StatSection({ label, groups, highlight, isGoalie }) {
  const [open, setOpen] = useState(highlight)
  return (
    <div className={`stat-section ${highlight ? 'highlight-section' : ''}`}>
      <button className="stat-section-header" onClick={() => setOpen(o => !o)}>
        <span className="stat-section-label">{label}</span>
        {highlight && <span className="stat-section-current">Current</span>}
        <span className="stat-section-arrow">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="stat-section-body">
          {groups.map(({ group, items }) => (
            <div key={group} className="stat-group">
              <div className="stat-group-label">{group}</div>
              {items.map(({ def, value, fmt }) => (
                <StatRow key={def.key} def={def} value={fmt} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Stat row with tooltip ────────────────────────────────────

function StatRow({ def, value }) {
  const [tipOpen, setTipOpen] = useState(false)
  const tipRef  = useRef(null)

  useEffect(() => {
    if (!tipOpen) return
    function close(e) { if (!tipRef.current?.contains(e.target)) setTipOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [tipOpen])

  return (
    <div className="stat-row">
      <div className="stat-row-left">
        <span className="stat-row-label">{def.label}</span>
        <div className="stat-tip-wrap" ref={tipRef}>
          <button className="stat-tip-btn" onClick={() => setTipOpen(o => !o)}
            aria-label={`Info about ${def.label}`}>ⓘ</button>
          {tipOpen && (
            <div className="stat-tip-popup">
              <div className="tip-title">{def.label}</div>
              <p className="tip-body">{def.tip}</p>
              {def.calc && (
                <div className="tip-calc">{def.calc}</div>
              )}
              {def.why && (
                <p className="tip-why"><strong>Why it matters:</strong> {def.why}</p>
              )}
            </div>
          )}
        </div>
      </div>
      <span className="stat-row-value">{value ?? '—'}</span>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────

function groupStats(defs, stats, isGoalie) {
  const groups = {}
  defs.forEach(def => {
    let raw = stats?.[def.key]
    if (raw == null) return // skip missing entirely
    let fmt
    if (def.key === 'shootingPctg' || def.key === 'faceoffWinningPctg') {
      const n = parseFloat(raw)
      fmt = isNaN(n) ? '—' : (n <= 1 ? `${(n * 100).toFixed(1)}%` : `${n.toFixed(1)}%`)
    } else if (def.key === 'savePctg') {
      const n = parseFloat(raw)
      fmt = isNaN(n) ? '—' : (n <= 1 ? n.toFixed(3) : (n / 100).toFixed(3))
    } else if (def.key === 'goalsAgainstAvg' || def.key === 'gaa') {
      fmt = parseFloat(raw).toFixed(2)
    } else if (def.key === 'plusMinus') {
      const n = parseInt(raw)
      fmt = isNaN(n) ? '—' : (n >= 0 ? `+${n}` : `${n}`)
    } else if (def.key === 'avgToi' || def.key === 'toi') {
      // Could be "MM:SS" string or seconds number
      if (typeof raw === 'string' && raw.includes(':')) fmt = raw
      else { const m = Math.floor(raw/60); const s = String(raw%60).padStart(2,'0'); fmt = `${m}:${s}` }
    } else {
      fmt = raw
    }
    if (!groups[def.group]) groups[def.group] = []
    groups[def.group].push({ def, value: raw, fmt })
  })
  return Object.entries(groups).map(([group, items]) => ({ group, items }))
}

function posLabel(code) {
  return { C:'Centre', LW:'Left Wing', RW:'Right Wing', D:'Defence', G:'Goalie' }[code] || code
}

function RosterSkeleton() {
  return (
    <div className="roster-grid" style={{ marginTop: 8 }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="player-card card">
          <div className="skeleton" style={{ width: '100%', aspectRatio: '1', borderRadius: 6, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 10, width: '60%', marginBottom: 6 }} />
          <div className="skeleton" style={{ height: 10, width: '40%' }} />
        </div>
      ))}
    </div>
  )
}

// ── Player Heat Map ───────────────────────────────────────────
function PlayerHeatMap({ shotData, playerName, isGoalie }) {
  const [filter, setFilter] = useState('all');

  if (isGoalie) {
    return (
      <div className="pp-heatmap-empty">
        <div className="pp-heatmap-icon">🥅</div>
        <div>Shot heat maps are for skaters only.</div>
      </div>
    );
  }

  if (!shotData) {
    return (
      <div className="pp-heatmap-empty">
        <div className="pp-heatmap-icon">🎯</div>
        <div>No season shot data yet.</div>
        <div className="pp-heatmap-sub">Data builds up as games complete.</div>
      </div>
    );
  }

  const shots = shotData.shots || [];

  // Convert compact format to IceRink event format
  const typeMap = { g: 'goal', s: 'shot-on-goal', m: 'missed-shot', b: 'blocked-shot' };
  const allEvents = shots.map((s, i) => ({
    id:         i,
    x:          s.x,
    y:          s.y,
    type:       typeMap[s.t] || 'shot-on-goal',
    period:     s.p,
    shotType:   s.st,
    isCanes:    true,
    shooterId:  'player', // single player — always show
  }));

  const filtered = filter === 'all'   ? allEvents
    : filter === 'goals'  ? allEvents.filter(e => e.type === 'goal')
    : filter === 'sog'    ? allEvents.filter(e => e.type === 'shot-on-goal')
    : filter === 'missed' ? allEvents.filter(e => e.type === 'missed-shot')
    : allEvents;

  const goals   = allEvents.filter(e => e.type === 'goal').length;
  const sog     = allEvents.filter(e => e.type === 'shot-on-goal').length;
  const missed  = allEvents.filter(e => e.type === 'missed-shot').length;
  const blocked = allEvents.filter(e => e.type === 'blocked-shot').length;
  const total   = allEvents.length;
  const sh      = (goals + sog) > 0 ? ((goals / (goals + sog)) * 100).toFixed(1) : '—';

  return (
    <div className="pp-heatmap">
      {/* Summary stats */}
      <div className="pp-heatmap-summary">
        <div className="pp-heatmap-stat"><span className="pp-heatmap-num goal-col">{goals}</span><span>Goals</span></div>
        <div className="pp-heatmap-stat"><span className="pp-heatmap-num sog-col">{sog}</span><span>SOG</span></div>
        <div className="pp-heatmap-stat"><span className="pp-heatmap-num">{missed}</span><span>Missed</span></div>
        <div className="pp-heatmap-stat"><span className="pp-heatmap-num">{total}</span><span>Total</span></div>
        <div className="pp-heatmap-stat"><span className="pp-heatmap-num">{sh}%</span><span>SH%</span></div>
        {shotData.games && <div className="pp-heatmap-stat"><span className="pp-heatmap-num">{shotData.games}</span><span>Games</span></div>}
      </div>

      {/* Filter chips */}
      <div className="pp-heatmap-filters">
        {[
          { key: 'all',    label: `All (${total})` },
          { key: 'goals',  label: `Goals (${goals})` },
          { key: 'sog',    label: `SOG (${sog})` },
          { key: 'missed', label: `Missed (${missed})` },
        ].map(f => (
          <button
            key={f.key}
            className={`pp-heatmap-chip ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >{f.label}</button>
        ))}
      </div>

      {/* Rink */}
      <div className="pp-heatmap-rink">
        <IceRink events={filtered} roster={{}} hidePlayerFilter />
      </div>
    </div>
  );
}

// ── Player Analytics (WAR + Percentiles) ─────────────────────
function PercentileBar({ label, pct, note, na }) {
  if (na || pct == null) {
    return (
      <div className="pa-row">
        <span className="pa-label">{label}</span>
        <span className="pa-na">N/A</span>
      </div>
    );
  }

  // Color: red < 33, amber 33-66, green > 66
  const color = pct >= 67 ? '#4ade80' : pct >= 34 ? '#fbbf24' : '#f87171';
  const tier  = pct >= 90 ? 'Elite' : pct >= 75 ? 'Great' : pct >= 50 ? 'Above avg'
              : pct >= 25 ? 'Below avg' : 'Poor';

  return (
    <div className="pa-row">
      <span className="pa-label" title={note}>{label}</span>
      <div className="pa-bar-wrap">
        <div className="pa-bar-track">
          <div className="pa-bar-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="pa-pct" style={{ color }}>{pct}th</span>
        <span className="pa-tier" style={{ color }}>{tier}</span>
      </div>
    </div>
  );
}

function PlayerAnalytics({ mpData, goalieData, playerName, isGoalie, position }) {
  if (isGoalie) {
    if (!goalieData) {
      return (
        <div className="pp-heatmap-empty">
          <div className="pp-heatmap-icon">🥅</div>
          <div>Analytics data not yet available.</div>
          <div className="pp-heatmap-sub">Updates daily from MoneyPuck.</div>
        </div>
      );
    }

    const { gsax, gsax60, gp, evSvPct, hdSvPct, mdSvPct, pkSvPct, percentiles: p } = goalieData;
    const gsaxColor = gsax >= 5 ? '#4ade80' : gsax >= 0 ? '#fbbf24' : '#f87171';
    const gsaxLabel = gsax >= 10 ? 'Elite' : gsax >= 5 ? 'Above average' : gsax >= 0 ? 'Average' : 'Below average';

    return (
      <div className="pa-wrap">
        <div className="pa-war-card">
          <div className="pa-war-main">
            <span className="pa-war-num" style={{ color: gsaxColor }}>{gsax > 0 ? '+' : ''}{gsax}</span>
            <span className="pa-war-label">GSAX</span>
          </div>
          <div className="pa-war-meta">
            <span style={{ color: gsaxColor }}>{gsaxLabel}</span>
            <span className="pa-war-sub">{gp} GP · {gsax60 != null ? `${gsax60 > 0 ? '+' : ''}${gsax60} per 60` : ''}</span>
            <span className="pa-war-sub" style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
              Goals saved above expected — flurry-adjusted xGoals model
            </span>
          </div>
        </div>

        <div className="pa-context">
          {evSvPct != null && <div className="pa-ctx-item"><span className="pa-ctx-val">{evSvPct}%</span><span>5on5 SV%</span></div>}
          {hdSvPct != null && <div className="pa-ctx-item"><span className="pa-ctx-val">{hdSvPct}%</span><span>HD SV%</span></div>}
          {mdSvPct != null && <div className="pa-ctx-item"><span className="pa-ctx-val">{mdSvPct}%</span><span>MD SV%</span></div>}
          {pkSvPct != null && <div className="pa-ctx-item"><span className="pa-ctx-val">{pkSvPct}%</span><span>PK SV%</span></div>}
        </div>

        <div className="pa-section-label">Percentile rankings vs all NHL goalies</div>
        <div className="pa-bars">
          <PercentileBar label="GSAX"            pct={p.gsax?.pct}   note={p.gsax?.note} />
          <PercentileBar label="GSAX/60"         pct={p.gsax60?.pct} note={p.gsax60?.note} />
          <PercentileBar label="5-on-5 SV%"      pct={p.evSv?.pct}   note={p.evSv?.note} />
          <PercentileBar label="High Danger SV%" pct={p.hdSv?.pct}   note={p.hdSv?.note} />
          <PercentileBar label="Med Danger SV%"  pct={p.mdSv?.pct}   note={p.mdSv?.note} />
          <PercentileBar label="PK SV%"          pct={p.pkSv?.pct}   note={p.pkSv?.note} />
        </div>

        <div className="pa-source">Data: MoneyPuck.com · Updates nightly</div>
      </div>
    );
  }

  if (!mpData) {
    return (
      <div className="pp-heatmap-empty">
        <div className="pp-heatmap-icon">🧮</div>
        <div>Analytics data not yet available.</div>
        <div className="pp-heatmap-sub">Updates daily from MoneyPuck.</div>
      </div>
    );
  }

  const { war, percentiles, gp, xGF_pct, goals60, a1_60, ppToi, pkToi, gameScore } = mpData;
  const pos     = ['C','L','R','F'].includes(position) ? 'F' : 'D';
  const posLabel = pos === 'F' ? 'forwards' : 'defensemen';
  const p       = percentiles || {};

  // WAR color
  const warColor = war >= 2 ? '#4ade80' : war >= 0.5 ? '#fbbf24' : '#f87171';
  const warLabel = war >= 4 ? 'MVP candidate' : war >= 2 ? 'Top player'
    : war >= 0.5 ? 'Solid contributor' : war >= -0.5 ? 'Replacement level' : 'Below replacement';

  return (
    <div className="pa-wrap">

      {/* WAR summary */}
      <div className="pa-war-card">
        <div className="pa-war-main">
          <span className="pa-war-num" style={{ color: warColor }}>{war > 0 ? '+' : ''}{war}</span>
          <span className="pa-war-label">WAR</span>
        </div>
        <div className="pa-war-meta">
          <span style={{ color: warColor }}>{warLabel}</span>
          <span className="pa-war-sub">{gp} GP · Game Score {gameScore}</span>
          <span className="pa-war-sub" style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
            Approximate — based on xGoals model, not full RAPM
          </span>
        </div>
      </div>

      {/* Context stats */}
      <div className="pa-context">
        {xGF_pct != null && <div className="pa-ctx-item"><span className="pa-ctx-val">{xGF_pct}%</span><span>EV xGF%</span></div>}
        {goals60 != null && <div className="pa-ctx-item"><span className="pa-ctx-val">{goals60}</span><span>G/60</span></div>}
        {a1_60   != null && <div className="pa-ctx-item"><span className="pa-ctx-val">{a1_60}</span><span>A1/60</span></div>}
        {ppToi   != null && ppToi > 0 && <div className="pa-ctx-item"><span className="pa-ctx-val">{ppToi}m</span><span>PP TOI</span></div>}
        {pkToi   != null && pkToi > 0 && <div className="pa-ctx-item"><span className="pa-ctx-val">{pkToi}m</span><span>PK TOI</span></div>}
      </div>

      {/* Percentile rankings */}
      <div className="pa-section-label">Percentile rankings vs all NHL {posLabel}</div>
      <div className="pa-bars">
        <PercentileBar label="EV Offence"    pct={p.evOff?.pct}     note={p.evOff?.note} />
        <PercentileBar label="EV Defence"    pct={p.evDef?.pct}     note={p.evDef?.note} />
        <PercentileBar label="Power Play"    pct={p.pp?.pct}        note={p.pp?.note}    na={!ppToi || ppToi < 5} />
        <PercentileBar label="Penalty Kill"  pct={p.pk?.pct}        note={p.pk?.note}    na={!pkToi || pkToi < 5} />
        <PercentileBar label="Finishing"     pct={p.finishing?.pct} note={p.finishing?.note} />
        <PercentileBar label="Goals"         pct={p.goals?.pct}     note={p.goals?.note} />
        <PercentileBar label="1st Assists"   pct={p.a1?.pct}        note={p.a1?.note} />
        <PercentileBar label="Penalties"     pct={p.penalties?.pct} note={p.penalties?.note} />
        <PercentileBar label="Competition"   pct={p.comp?.pct}      note={p.comp?.note} />
        <PercentileBar label="Teammates"     pct={p.teammates?.pct} note={p.teammates?.note} />
      </div>

      <div className="pa-source">Data: MoneyPuck.com · Updates nightly</div>
    </div>
  );
}

// ── Skater Stats Table ────────────────────────────────────────
const COLS = [
  { key: 'skaterFullName', label: 'Player',   fmt: v => v,                           sortable: true,  align: 'left',  sticky: true },
  { key: 'positionCode',   label: 'Pos',      fmt: v => v,                           sortable: false, align: 'center' },
  { key: 'gamesPlayed',    label: 'GP',       fmt: v => v,                           sortable: true,  align: 'right' },
  { key: 'goals',          label: 'G',        fmt: v => v,                           sortable: true,  align: 'right' },
  { key: 'assists',        label: 'A',        fmt: v => v,                           sortable: true,  align: 'right' },
  { key: 'primaryAssists', label: 'A1',       fmt: v => v ?? '—',                    sortable: true,  align: 'right' },
  { key: 'secondaryAssists',label:'A2',       fmt: v => v ?? '—',                    sortable: true,  align: 'right' },
  { key: 'points',         label: 'PTS',      fmt: v => v,                           sortable: true,  align: 'right', bold: true },
  { key: 'plusMinus',      label: '+/-',      fmt: v => v > 0 ? `+${v}` : v,        sortable: true,  align: 'right' },
  { key: 'penaltyMinutes', label: 'PIM',      fmt: v => v,                           sortable: true,  align: 'right' },
  { key: 'ppGoals',        label: 'PPG',      fmt: v => v,                           sortable: true,  align: 'right' },
  { key: 'shGoals',        label: 'SHG',      fmt: v => v,                           sortable: true,  align: 'right' },
  { key: 'gameWinningGoals',label:'GWG',      fmt: v => v,                           sortable: true,  align: 'right' },
  { key: 'shots',          label: 'SOG',      fmt: v => v,                           sortable: true,  align: 'right' },
  { key: 'shootingPct',    label: 'S%',       fmt: v => v != null ? `${(v*100).toFixed(1)}%` : '—', sortable: true, align: 'right' },
];

function SkaterStatsTable({ skaters, loading, gameType = 2, onSelect }) {
  const [sortKey, setSortKey] = useState('points');
  const [sortDir, setSortDir] = useState('desc');

  const sorted = useMemo(() => {
    if (!skaters?.length) return [];
    return [...skaters].sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [skaters, sortKey, sortDir]);

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  if (loading) return (
    <div style={{ padding: '16px 0' }}>
      {[80,65,72,58,70].map((w,i) => (
        <div key={i} className="skeleton" style={{ height: 32, width: `${w}%`, marginBottom: 6, borderRadius: 6 }} />
      ))}
    </div>
  );

  if (!skaters?.length) return (
    <div className="drill-empty">
      {gameType === 3
        ? 'No playoff stats yet — data populates once Carolina advances.'
        : 'No stats available.'}
    </div>
  );

  return (
    <div className="sst-wrap">
      <div className="sst-scroll">
        <table className="sst-table">
          <thead>
            <tr>
              {COLS.map(col => (
                <th
                  key={col.key}
                  className={`sst-th ${col.align} ${col.sticky ? 'sticky' : ''} ${sortKey === col.key ? 'sorted' : ''}`}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  style={{ cursor: col.sortable ? 'pointer' : 'default' }}
                >
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <span className="sst-sort-icon">{sortDir === 'desc' ? ' ↓' : ' ↑'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={p.playerId} className={`sst-row ${i % 2 === 0 ? 'even' : ''}`}
                onClick={() => onSelect(p.playerId)}>
                {COLS.map(col => {
                  const val = p[col.key];
                  const pmColor = col.key === 'plusMinus'
                    ? val > 0 ? '#4ade80' : val < 0 ? '#f87171' : 'inherit'
                    : 'inherit';
                  return (
                    <td key={col.key}
                      className={`sst-td ${col.align} ${col.sticky ? 'sticky' : ''} ${col.bold ? 'bold' : ''}`}
                      style={{ color: pmColor }}>
                      {col.fmt(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sst-hint">Tap a player row to open their profile · Sort by any column</div>
    </div>
  );
}
