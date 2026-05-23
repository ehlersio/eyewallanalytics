import { useState, useRef, useEffect } from 'react'
import { useFetch } from '../hooks/useFetch'
import { getRoster, getPlayerStats, fetchPlayerRankings, getPlayoffGames, getStandings } from '../utils/nhlApi'
import { findContract, contractValue, pointsPer60, valueLabel, goalieContractValue, goalieValueLabel, CAP_CEILING, CURRENT_SEASON } from '../utils/carContracts'
import TeamLogo from '../components/TeamLogo'
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
  const { data: roster,   loading: rosterLoading } = useFetch(() => getRoster('CAR'))
  const { data: poGames }   = useFetch(getPlayoffGames)
  const { data: standings } = useFetch(getStandings)
  const [selected, setSelected]                     = useState(null)
  const inPlayoffs = (poGames?.length || 0) > 0

  return (
    <div className="page">
      <div className="players-header">
        <h2 className="view-title">
          <TeamLogo abbr="CAR" size={22} />
          Roster
        </h2>
        <p className="players-sub">Tap a player for detailed stats &amp; rankings</p>
      </div>

      {rosterLoading && <RosterSkeleton />}

      {!rosterLoading && roster && (
        <>
          <RosterSection title="Forwards"   players={roster.forwards}   onSelect={setSelected} />
          <RosterSection title="Defensemen" players={roster.defensemen} onSelect={setSelected} />
          <RosterSection title="Goalies"    players={roster.goalies}    onSelect={setSelected} />
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
  const [imgErr, setImgErr] = useState(false)
  const name     = `${p.firstName?.default || ''} ${p.lastName?.default || ''}`.trim()

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
              const score = !isGoalie && gp > 0 ? contractValue(pts, gp, contract.capHit, isELC) : null
              const vl    = valueLabel(score)
              const p60   = !isGoalie && regStats?.avgToi
                ? pointsPer60(pts, (regStats.avgToi?.includes?.(':')
                    ? regStats.avgToi.split(':').reduce((m,s,i) => i===0 ? +s*60 : m + +s, 0)
                    : Number(regStats.avgToi)) * gp)
                : null
              return (
                <div className="pp-value-row">
                  {score != null && vl && (
                    <div className="pp-value-badge" style={{ background: vl.color + '22', borderColor: vl.color + '55', color: vl.color }}>
                      <span>{vl.label}</span>
                      <span className="pp-value-score">{score} pts/$M</span>
                      <span className="pp-value-tip" title={
                        `Contract Value Score = Points per $1M of cap hit (projected to 82 games).

Scale:
≥8.0 = Exceptional value
≥5.0 = Great value
≥3.0 = Good value
≥1.8 = Fair value
≥1.0 = Below average
<1.0 = Overpaid

Example: A player with 30 pts in 82 games on a $5M cap hit = 6.0 pts/$M = Great value.
A $9.75M player needs ~24+ pts just to hit "Good value" threshold.

ELC contracts are excluded — their cap hit ($775K–$925K) doesn't reflect market value.`
                      }>ⓘ</span>
                    </div>
                  )}
                  {p60 != null && (
                    <div className="pp-adv-chip">P/60: <strong>{p60}</strong>
                      <span className="pp-value-tip" title="Points per 60 minutes of ice time. Removes the effect of ice time differences — a player with 10 pts in 12 min/game is producing at a different rate than one with 10 pts in 22 min/game. League avg for top-6 forwards: ~2.0–3.5.">ⓘ</span>
                    </div>
                  )}
                  {isELC && !isGoalie && (
                    <div className="pp-adv-chip" style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
                      ELC — value score N/A
                      <span className="pp-value-tip" title="Entry Level Contracts (ELC) have a league-mandated cap hit ($775K–$925K) that doesn't reflect a player's market value, so the pts/$M comparison isn't meaningful.">ⓘ</span>
                    </div>
                  )}
                  {isGoalie && (() => {
                    const gStats = stats?.seasonTotals?.find(s => s.season === 20252026 && s.gameTypeId === 2)
                    const svPctg = gStats?.savePctg
                    const gGp    = gStats?.gamesPlayed ?? 0
                    const isELC  = contract.note === 'ELC' || contract.capHit < 1_200_000
                    const gScore = goalieContractValue(svPctg, gGp, contract.capHit, isELC)
                    const gVl    = goalieValueLabel(gScore)
                    if (!gScore || !gVl) return isELC ? (
                      <div className="pp-adv-chip" style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
                        ELC — value score N/A
                        <span className="pp-value-tip" title="ELC cap hits are league-mandated and don't reflect market value.">ⓘ</span>
                      </div>
                    ) : null
                    return (
                      <div className="pp-value-badge" style={{ background: gVl.color + '22', borderColor: gVl.color + '55', color: gVl.color }}>
                        <span>{gVl.label}</span>
                        <span className="pp-value-score">SV% {gScore > 0 ? '+' : ''}{gScore} vs avg/$M</span>
                        <span className="pp-value-tip" title={`Goalie Value Score = (SV% points above league avg of .910) ÷ cap hit in $M.
Positive = better than avg per dollar spent. Negative = paying for below-avg goaltending.

Scale:
≥+2.0 = Exceptional value
≥+1.0 = Great value
≥0.0  = Fair value
≥-1.0 = Below average
<-1.0 = Overpaid

ELC goalies excluded.`}>ⓘ</span>
                      </div>
                    )
                  })()}
                </div>
              )
            })()}
          </div>
        )}

        {/* ── Stat sections ── */}
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
