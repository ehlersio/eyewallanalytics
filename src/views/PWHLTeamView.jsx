// views/PWHLTeamView.jsx
// Mirrors NHL TeamView — tabbed layout: Overview / Stats / Splits
import React, { useState, useMemo } from 'react';
import { useFetch } from '../hooks/useFetch';
import {
  fetchPWHLStandings, fetchPWHLPlayers, fetchPWHLSchedule, fetchPWHLSalaries,
  PWHL_TEAM_CONFIG, PWHL_TEAM_ID,
} from '../utils/pwhlApi';
import { PWHL_CURRENT_SEASON, PWHL_PLAYOFF_SEASON_MAP } from '../utils/pwhlConfig';
import TeamLogo from '../components/TeamLogo';
import { MetCard } from '../components/StatBar';
import './TeamView.css';
import './ShotMapView.css';

const TABS = ['Overview', 'Advanced', 'Splits', 'Trends', 'Salaries'];

export default function PWHLTeamView() {
  const team   = PWHL_TEAM_CONFIG;
  const teamId = PWHL_TEAM_ID;
  const abbr   = team?.abbr || '—';
  const color  = team?.displayColor || 'var(--text-dim)';
  const [tab,  setTab]  = useState('Overview');

  const { data: standings, loading: sLoad } = useFetch(() => fetchPWHLStandings(PWHL_CURRENT_SEASON), []);
  const { data: players,   loading: pLoad } = useFetch(
    () => teamId ? fetchPWHLPlayers(teamId, PWHL_CURRENT_SEASON) : Promise.resolve(null), [teamId]
  );
  const { data: schedule,  loading: scLoad  } = useFetch(
    () => teamId ? fetchPWHLSchedule(teamId, PWHL_CURRENT_SEASON) : Promise.resolve(null), [teamId]
  );
  const { data: poSchedule, loading: poScLoad } = useFetch(
    () => teamId ? fetchPWHLSchedule(teamId, PWHL_PLAYOFF_SEASON_MAP[PWHL_CURRENT_SEASON] || 9) : Promise.resolve(null), [teamId]
  );
  const inPlayoffs = (poSchedule?.length || 0) > 0;
  const { data: salaries, loading: salLoad } = useFetch(
    () => teamId ? fetchPWHLSalaries(teamId) : Promise.resolve(null), [teamId]
  );

  const teamRow = useMemo(() => standings?.find(r => r.team_id === teamId) || null, [standings, teamId]);
  const skaters = useMemo(() => players?.skaters || [], [players]);
  const goalies = useMemo(() => players?.goalies || [], [players]);

  if (!abbr || !teamId) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ color: 'var(--text-dim)' }}>No PWHL team selected.</p>
        </div>
      </div>
    );
  }

  const loading = sLoad || pLoad;

  return (
    <div className="page team-view">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <TeamLogo abbr={abbr} sport="pwhl" size={28} color={color} />
        <h2 className="view-title" style={{ margin: 0 }}>{team.displayName}</h2>
      </div>
      <p className="view-sub">2025-26 season</p>

      <div className="team-tabs">
        {TABS.map(t => (
          <button key={t} className={`team-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Overview'  && (
        <OverviewTab teamRow={teamRow} skaters={skaters} goalies={goalies}
          schedule={schedule} teamId={teamId} abbr={abbr} color={color} loading={loading}
          standings={standings} />
      )}
      {tab === 'Advanced'  && (
        <AdvancedTab teamRow={teamRow} skaters={skaters} goalies={goalies}
          abbr={abbr} color={color} loading={sLoad || pLoad || scLoad}
          schedule={schedule} poSchedule={poSchedule} teamId={teamId}
          standings={standings} inPlayoffs={inPlayoffs} />
      )}
      {tab === 'Stats'     && (
        <StatsTab skaters={skaters} goalies={goalies} loading={pLoad} abbr={abbr} color={color} />
      )}
      {tab === 'Splits'    && (
        <SplitsTab schedule={schedule} poSchedule={poSchedule} teamId={teamId}
          abbr={abbr} color={color} loading={scLoad || poScLoad} inPlayoffs={inPlayoffs} />
      )}
      {tab === 'Trends'    && (
        <TrendsTab schedule={schedule} teamId={teamId} loading={scLoad} />
      )}
      {tab === 'Salaries'  && (
        <SalariesTab salaries={salaries} loading={salLoad} abbr={abbr} color={color} />
      )}
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────
function OverviewTab({ teamRow, skaters, goalies, schedule, teamId, abbr, color, loading, standings }) {

  const gd = teamRow ? (teamRow.goals_for ?? 0) - (teamRow.goals_against ?? 0) : null;

  const topScorers = useMemo(
    () => [...skaters].sort((a,b) => (b.points??0)-(a.points??0)).slice(0,5),
    [skaters]
  );
  const starter = useMemo(
    () => [...goalies].sort((a,b) => (b.gp??0)-(a.gp??0))[0] || null,
    [goalies]
  );

  // Rankings computed from all-team standings
  const rankings = useMemo(() => {
    if (!standings?.length || !teamRow) return {};
    function rank(arr, key, higherBetter=true) {
      const sorted = [...arr].filter(r => r[key] != null)
        .sort((a,b) => higherBetter ? b[key]-a[key] : a[key]-b[key]);
      const idx = sorted.findIndex(r => r.team_id === teamId);
      return idx >= 0 ? idx + 1 : null;
    }
    const withPG = standings.map(r => ({
      ...r,
      gfpg: r.gp ? (r.goals_for??0)/r.gp : 0,
      gapg: r.gp ? (r.goals_against??0)/r.gp : 0,
    }));
    const withDiff = standings.map(r => ({
      ...r,
      gd: (r.goals_for??0) - (r.goals_against??0),
    }));
    return {
      gfpg:  rank(withPG,   'gfpg', true),
      gapg:  rank(withPG,   'gapg', false),
      diff:  rank(withDiff, 'gd',   true),
      ppPct: teamRow.pp_pct != null ? rank(standings, 'pp_pct', true)  : null,
      pkPct: teamRow.pk_pct != null ? rank(standings, 'pk_pct', true)  : null,
    };
  }, [standings, teamRow, teamId]);

  // SOG/GP and SA/GP computed from player data
  const sogPG = useMemo(() => {
    if (!skaters.length || !teamRow?.gp) return null;
    return (skaters.reduce((s,p) => s+(p.shots??0), 0) / teamRow.gp).toFixed(1);
  }, [skaters, teamRow]);

  const saPG = useMemo(() => {
    if (!goalies.length || !teamRow?.gp) return null;
    return (goalies.reduce((s,g) => s+(g.saves??0)+(g.goals_against??0), 0) / teamRow.gp).toFixed(1);
  }, [goalies, teamRow]);

  function RankBadge({ r }) {
    if (!r) return null;
    const clr    = r <= 2 ? 'var(--green)' : r <= 6 ? 'var(--text-muted)' : 'var(--red-bright)';
    const suffix = r === 1 ? 'st' : r === 2 ? 'nd' : r === 3 ? 'rd' : 'th';
    return <span className="overview-stat-rank" style={{ color: clr }}>{r}<sup>{suffix}</sup></span>;
  }

  // Last 5 results
  const last5 = useMemo(() => {
    if (!schedule?.length || !teamId) return [];
    return [...schedule]
      .filter(g => g.game_state === 'Final')
      .sort((a,b) => b.game_id - a.game_id)
      .slice(0, 5)
      .map(g => {
        const isHome = g.home_team_id === teamId;
        const my     = isHome ? g.home_score : g.away_score;
        const op     = isHome ? g.away_score : g.home_score;
        const won    = my > op;
        return { won, ot: g.ot, so: g.shootout };
      });
  }, [schedule, teamId]);

  return (
    <>
      {/* Record block — mirrors NHL record-block */}
      <div className="records-row">
        <div className="card record-block">
          <div className="record-block-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TeamLogo abbr={abbr} sport="pwhl" size={14} color={color} /> Regular Season
          </div>
          {loading ? <div className="skeleton" style={{ height: 28, width: '70%' }} /> : (
            <div className="record-main-row">
              <span className="record-big">{teamRow?.wins??0}–{teamRow?.losses??0}–{teamRow?.ot_losses??0}</span>
              <span className="pts-chip">{teamRow?.points??0} pts</span>
            </div>
          )}
          {teamRow && (
            <div className="record-meta">
              <span>GF: {teamRow.goals_for??'—'}</span>
              <span className="record-meta-sep">·</span>
              <span>GA: {teamRow.goals_against??'—'}</span>
              {gd != null && (
                <span className={`streak-chip${gd >= 0 ? ' streak-w' : ' streak-l'}`}>
                  {gd >= 0 ? `+${gd}` : gd} diff
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Last 5 */}
      {last5.length > 0 && (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="sec-label" style={{ marginBottom: 8 }}>Last 5 games</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {last5.map((g, i) => (
              <div key={i} style={{
                width: 36, height: 36, borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700,
                background: g.won ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.12)',
                color: g.won ? 'var(--green)' : 'var(--red-bright)',
                border: `0.5px solid ${g.won ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
              }}>
                {g.won ? 'W' : 'L'}{g.so ? '/SO' : g.ot ? '/OT' : ''}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Season stat grid — mirrors NHL overview-stat-grid */}
      {teamRow && (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="sec-label" style={{ marginBottom: 10 }}>Season stats</div>
          <div className="overview-stat-grid">
            {[
              ['GF/GP',  teamRow.gp ? ((teamRow.goals_for??0)/teamRow.gp).toFixed(2) : '—', rankings.gfpg],
              ['GA/GP',  teamRow.gp ? ((teamRow.goals_against??0)/teamRow.gp).toFixed(2) : '—', rankings.gapg],
              ['Diff',   gd != null ? (gd >= 0 ? `+${gd}` : gd) : '—', rankings.diff],
              ['PP%',    teamRow.pp_pct != null ? `${(teamRow.pp_pct*100).toFixed(1)}%` : '—', rankings.ppPct],
              ['PK%',    teamRow.pk_pct != null ? `${(teamRow.pk_pct*100).toFixed(1)}%` : '—', rankings.pkPct],
              ['SOG/GP', sogPG ?? '—', null],
              ['SA/GP',  saPG  ?? '—', null],
            ].map(([label, val, rank]) => (
              <div key={label} className="overview-stat-cell">
                <div className="overview-stat-label">{label}</div>
                <div className="overview-stat-val">{val}</div>
                <RankBadge r={rank} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Points leaders */}
      {topScorers.length > 0 && (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="sec-label" style={{ marginBottom: 8 }}>{abbr} Points Leaders</div>
          {topScorers.map((p, i) => (
            <div key={p.id ?? i} className="adv-stat-row">
              <span className="adv-stat-label">
                {p.player_name || `Player #${p.player_id}`}
                {p.position && <span className="adv-stat-note"> · {p.position}</span>}
              </span>
              <span className="adv-stat-right">
                <span className="adv-stat-val" style={{ color }}>
                  {p.points ?? '—'} pts
                </span>
                <span className="adv-stat-avg">
                  {p.goals ?? 0}G {p.assists ?? 0}A
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Starting goalie */}
      {starter && (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="sec-label" style={{ marginBottom: 8 }}>{abbr} Starting Goalie</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 8,
              background: 'var(--bg3)', border: '0.5px solid var(--border-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            }}>🥅</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                {starter.player_name || `Player #${starter.player_id}`}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                {starter.gp ?? 0} GP · {starter.wins ?? 0}W–{starter.losses ?? 0}L–{starter.ot_losses ?? 0}OTL
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>
                {starter.sv_pct != null ? starter.sv_pct.toFixed(3).replace('0.', '.') : '—'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>SV%</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                {starter.gaa != null ? starter.gaa.toFixed(2) : '—'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>GAA</div>
            </div>
          </div>
          {starter.shutouts > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', paddingLeft: 60 }}>
              {starter.shutouts} shutout{starter.shutouts !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Stats tab ─────────────────────────────────────────────────────────────────
function StatsTab({ skaters, goalies, loading, abbr: _abbr, color }) {
  const [view, setView] = useState('skaters');

  const teamTotals = useMemo(() => {
    if (!skaters.length) return null;
    return {
      goals:   skaters.reduce((s,p) => s+(p.goals??0), 0),
      assists: skaters.reduce((s,p) => s+(p.assists??0), 0),
      points:  skaters.reduce((s,p) => s+(p.points??0), 0),
      shots:   skaters.reduce((s,p) => s+(p.shots??0), 0),
      ppg:     skaters.reduce((s,p) => s+(p.pp_goals??0), 0),
    };
  }, [skaters]);

  return (
    <>
      {/* Team totals MetCards */}
      {teamTotals && (
        <div className="metrics-grid metrics-grid-4" style={{ marginTop: 10 }}>
          <MetCard label="Goals"   value={teamTotals.goals}   sub="Team total" />
          <MetCard label="Assists" value={teamTotals.assists} sub="Team total" />
          <MetCard label="Points"  value={teamTotals.points}  sub="Team total" color="green" />
          <MetCard label="PPG"     value={teamTotals.ppg}     sub="Power play" />
        </div>
      )}

      <div className="players-tabs" style={{ marginTop: 8 }}>
        <button className={`players-tab${view === 'skaters' ? ' active' : ''}`} onClick={() => setView('skaters')}>Skaters</button>
        <button className={`players-tab${view === 'goalies' ? ' active' : ''}`} onClick={() => setView('goalies')}>Goalies</button>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0' }}>
          {[80,65,70,55,75].map((w,i) => (
            <div key={i} className="skeleton" style={{ height: 32, width: `${w}%`, borderRadius: 6 }} />
          ))}
        </div>
      )}

      {!loading && view === 'skaters' && skaters.map((p, i) => (
        <div key={p.id ?? i} className="adv-stat-row">
          <span className="adv-stat-label">
            {p.player_name || `#${p.player_id}`}
            {p.position && <span className="adv-stat-note"> {p.position}</span>}
          </span>
          <span className="adv-stat-right">
            <span className="adv-stat-val" style={{ color }}>
              {p.points ?? 0} pts
            </span>
            <span className="adv-stat-avg">{p.goals??0}G {p.assists??0}A · {p.gp??0} GP</span>
          </span>
        </div>
      ))}

      {!loading && view === 'goalies' && goalies.map((g, i) => (
        <div key={g.id ?? i} className="adv-stat-row">
          <span className="adv-stat-label">
            {g.player_name || `#${g.player_id}`}
          </span>
          <span className="adv-stat-right">
            <span className="adv-stat-val" style={{ color }}>
              {g.sv_pct != null ? g.sv_pct.toFixed(3).replace('0.','.') : '—'}
            </span>
            <span className="adv-stat-avg">{g.gaa?.toFixed(2)??'—'} GAA · {g.wins??0}W</span>
          </span>
        </div>
      ))}
    </>
  );
}

// ── Splits tab ────────────────────────────────────────────────────────────────
function SplitsTab({ schedule, poSchedule, teamId, abbr: _abbr, color: _color, loading, inPlayoffs }) {
  const [showPO, setShowPO] = React.useState(false);

  function calcSplits(sched) {
    if (!sched?.length || !teamId) return null;
    const final = sched.filter(g => g.game_state === 'Final');
    function calc(games) {
      let w=0, otw=0, otl=0, l=0, gf=0, ga=0;
      for (const g of games) {
        const isHome  = g.home_team_id === teamId;
        const my      = isHome ? g.home_score : g.away_score;
        const op      = isHome ? g.away_score : g.home_score;
        const isExtra = g.ot || g.shootout;
        gf += my??0; ga += op??0;
        if (my > op) { isExtra ? otw++ : w++; }
        else         { isExtra ? otl++ : l++;  }
      }
      const n = games.length || 1;
      return { w, otw, otl, l, gf, ga, gp: games.length,
        gfpg: gf/n, gapg: ga/n,
        pts: w*3+otw*2+otl, ptsPct: (w*3+otw*2+otl)/(games.length*3||1) };
    }
    return {
      home: calc(final.filter(g => g.home_team_id === teamId)),
      away: calc(final.filter(g => g.away_team_id === teamId)),
    };
  }

  const regSplits = useMemo(() => calcSplits(schedule),   [schedule, teamId]);
  const poSplits  = useMemo(() => calcSplits(poSchedule), [poSchedule, teamId]);
  const splits    = showPO ? poSplits : regSplits;

  function fmt(v, dec=2)  { return v == null ? '—' : Number(v).toFixed(dec); }
  function fmtPct(v)      { return v == null ? '—' : `${(v*100).toFixed(1)}%`; }

  function SplitRow({ label, hVal, aVal, better='higher', fmtFn }) {
    const fn = fmtFn || (v => fmt(v));
    if (hVal == null && aVal == null) return null;
    const hBetter = hVal != null && aVal != null
      ? (better === 'higher' ? hVal >= aVal : hVal <= aVal) : false;
    const aBetter = hVal != null && aVal != null ? !hBetter : false;
    return (
      <div className="split-adv-row">
        <span className={`split-adv-val${hBetter ? ' good' : ''}`}>{fn(hVal)}</span>
        <span className="split-adv-label">{label}</span>
        <span className={`split-adv-val right${aBetter ? ' good' : ''}`}>{fn(aVal)}</span>
      </div>
    );
  }

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:10 }}>
      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height:80, borderRadius:10 }} />)}
    </div>
  );

  const label = showPO ? 'Playoffs' : 'Regular Season';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:10 }}>

      {/* Regular Season / Playoffs toggle */}
      {inPlayoffs && (
        <div className="adv-toggle">
          <button className={`adv-toggle-btn${!showPO ? ' active' : ''}`}
            onClick={() => setShowPO(false)}>📅 Regular Season</button>
          <button className={`adv-toggle-btn${showPO ? ' active' : ''}`}
            onClick={() => setShowPO(true)}>🏒 Playoffs</button>
        </div>
      )}
      {!inPlayoffs && <div className="adv-context-note">Showing Regular Season stats</div>}

      {!splits ? (
        <div className="card" style={{ textAlign:'center', padding:32, color:'var(--text-dim)' }}>
          No {label.toLowerCase()} data yet.
        </div>
      ) : (
        <>
          {/* Side-by-side comparison — mirrors NHL SplitsTab */}
          <div className="card">
            <div className="sec-label" style={{ marginBottom:10 }}>Home vs Away — {label}</div>
            <div className="split-adv-header">
              <span>🏠 Home</span>
              <span />
              <span>✈ Away</span>
            </div>
            <div className="split-adv-row" style={{ fontWeight:700, fontSize:14 }}>
              <span className="split-adv-val">
                {splits.home.gp ? `${splits.home.w}–${splits.home.otw}–${splits.home.otl}–${splits.home.l}` : '—'}
              </span>
              <span className="split-adv-label" style={{ color:'var(--text-dim)', fontSize:11 }}>W–OTW–OTL–L</span>
              <span className="split-adv-val right">
                {splits.away.gp ? `${splits.away.w}–${splits.away.otw}–${splits.away.otl}–${splits.away.l}` : '—'}
              </span>
            </div>
            <SplitRow label="GP"     hVal={splits.home.gp||null}    aVal={splits.away.gp||null}    fmtFn={v=>String(v)} />
            <SplitRow label="Pts%"   hVal={splits.home.ptsPct}       aVal={splits.away.ptsPct}       better="higher" fmtFn={v=>fmtPct(v)} />
            <SplitRow label="GF/GP"  hVal={splits.home.gp ? splits.home.gfpg : null} aVal={splits.away.gp ? splits.away.gfpg : null} better="higher" fmtFn={v=>fmt(v)} />
            <SplitRow label="GA/GP"  hVal={splits.home.gp ? splits.home.gapg : null} aVal={splits.away.gp ? splits.away.gapg : null} better="lower"  fmtFn={v=>fmt(v)} />
            <SplitRow label="Diff"
              hVal={splits.home.gp ? splits.home.gf - splits.home.ga : null}
              aVal={splits.away.gp ? splits.away.gf - splits.away.ga : null}
              better="higher" fmtFn={v => v >= 0 ? `+${v}` : String(v)} />
          </div>


        </>
      )}
    </div>
  );
}

// ── Advanced tab ──────────────────────────────────────────────────────────────
function AdvancedTab({ teamRow, skaters, goalies, abbr, color: _color, loading, standings, inPlayoffs, teamId, schedule: _schedule, poSchedule }) {
  const [showPO, setShowPO] = React.useState(false);
  function fmt(v, dec=2)  { return v == null ? '—' : Number(v).toFixed(dec); }
  function fmtPct(v)      { return v == null ? '—' : `${(v*100).toFixed(1)}%`; }

  // ── Shared AdvStatRow ────────────────────────────────────────
  function AdvStatRow({ label, val, avg, rating, note }) {
    if (val == null || val === '—') return null;
    return (
      <div className="adv-stat-row">
        <span className="adv-stat-label">
          {label}
          {note && <span className="adv-stat-note"> · {note}</span>}
        </span>
        <span className="adv-stat-right">
          <span className={`adv-stat-val${rating === 'good' ? ' good' : rating === 'bad' ? ' bad' : ''}`}>{val}</span>
          {avg && <span className="adv-stat-avg">avg {avg}</span>}
        </span>
      </div>
    );
  }

  // ── Derive stats from schedule for playoff toggle (must be before early return) ──
  const poSched = useMemo(() => {
    if (!poSchedule?.length || !teamId) return null;
    const done = poSchedule.filter(g => g.game_state === 'Final');
    if (!done.length) return null;
    const gf = done.reduce((s,g) => s + (g.home_team_id===teamId ? g.home_score : g.away_score)||0, 0);
    const ga = done.reduce((s,g) => s + (g.home_team_id===teamId ? g.away_score : g.home_score)||0, 0);
    return { gp: done.length, gf, ga, gfpg: gf/done.length, gapg: ga/done.length };
  }, [poSchedule, teamId]);
  const useReg = !showPO || !poSched;

  if (loading) return (
    <div className="card empty-state" style={{ marginTop: 10 }}>
      <div className="empty-icon">📊</div>
      <div className="empty-title">Loading advanced stats…</div>
    </div>
  );

  if (!teamRow) return (
    <div className="card empty-state" style={{ marginTop: 10 }}>
      <div className="empty-icon">📊</div>
      <div className="empty-title">No advanced stats yet</div>
      <div className="empty-sub">{abbr} hasn't played a game yet this season.</div>
    </div>
  );

  const gp   = (showPO && poSched) ? poSched.gp   : teamRow.gp || 1;
  const gfpg = (showPO && poSched) ? poSched.gfpg : (teamRow.goals_for  ? teamRow.goals_for  / (teamRow.gp||1) : null);
  const gapg = (showPO && poSched) ? poSched.gapg : (teamRow.goals_against ? teamRow.goals_against / (teamRow.gp||1) : null);

  // ── Shot volume — regular season from player data (no playoff player stats available) ──
  const totalGoals  = skaters.reduce((s,p) => s+(p.goals??0),  0);
  const totalShots  = skaters.reduce((s,p) => s+(p.shots??0),  0);
  const totalSaves  = goalies.reduce((s,g) => s+(g.saves??0),  0);
  const totalGA     = goalies.reduce((s,g) => s+(g.goals_against??0), 0);
  const totalSA     = totalSaves + totalGA;

  // For playoffs: derive GF/GA from schedule; SOG not available
  const sogPG      = !showPO && totalShots > 0 ? totalShots / gp : null;
  const saPG       = !showPO && totalSA    > 0 ? totalSA    / gp : null;
  const shPct  = !showPO && totalShots > 0 ? totalGoals / totalShots : null;
  const svPct  = !showPO && totalSA    > 0 ? totalSaves / totalSA    : null;
  const pdo    = shPct != null && svPct != null ? (shPct + svPct) * 100 : null;


  // ── League-wide rankings ─────────────────────────────────────
  function leagueRank(key, higherBetter = true) {
    if (!standings?.length) return null;
    const sorted = [...standings].filter(r => r[key] != null)
      .sort((a,b) => higherBetter ? b[key]-a[key] : a[key]-b[key]);
    const idx = sorted.findIndex(r => r.team_id === teamId);
    return idx >= 0 ? idx + 1 : null;
  }

  // ── League averages (2025-26 PWHL approximations) ────────────
  const AVG = {
    gfpg: 3.2, gapg: 3.2,
    sogpg: 28.0, sapg: 28.0, shotForPct: 0.5,
    shPct: 0.094, svPct: 0.906, pdo: 100,
    ppPct: 0.175, pkPct: 0.825,
  };

  function rate(v, avg, higherBetter=true) {
    if (v == null || avg == null) return null;
    const diff = (v - avg) / avg;
    if (Math.abs(diff) < 0.02) return null;
    return (diff > 0) === higherBetter ? 'good' : 'bad';
  }

  function RankBadge({ r }) {
    if (!r) return null;
    const clr    = r <= 2 ? 'var(--green)' : r <= 6 ? 'var(--text-muted)' : 'var(--red-bright)';
    const suffix = r === 1 ? 'st' : r === 2 ? 'nd' : r === 3 ? 'rd' : 'th';
    return <span className="overview-stat-rank" style={{ color: clr }}>{r}<sup>{suffix}</sup></span>;
  }


  const ppPct = teamRow.pp_pct;
  const pkPct = teamRow.pk_pct;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:10 }}>
      {inPlayoffs && (
        <div className="adv-toggle">
          <button className={`adv-toggle-btn${!showPO ? ' active' : ''}`}
            onClick={() => setShowPO(false)}>📅 Regular Season</button>
          <button className={`adv-toggle-btn${showPO ? ' active' : ''}`}
            onClick={() => setShowPO(true)}>🏒 Playoffs</button>
        </div>
      )}
      {!inPlayoffs && <div className="adv-context-note">Showing Regular Season stats</div>}

      {/* Shot Volume & Possession */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom:8 }}>Shot Volume &amp; Possession</div>
        <div className="adv-explain">
          {useReg
            ? <>Corsi For% (CF%) counts all shot attempts (shots + goals + blocked shots) for ÷ total.
               Fenwick For% (FF%) uses shots + goals only, excluding blocked shots.
               ≥50% means {abbr} is generating more attempts than opponents.
               <em> No missed shot data in PWHL — FF% is a proxy.</em></>
            : 'Shot data only available for regular season. Showing goals for/against from playoff schedule.'}
        </div>
        {useReg && teamRow.corsi_for_pct != null ? (
          <>
            <AdvStatRow label="Corsi For% (CF%)"
              val={`${Number(teamRow.corsi_for_pct).toFixed(1)}%`}
              avg="50.0%" rating={rate(Number(teamRow.corsi_for_pct)/100, 0.5)}
              note={`${teamRow.corsi_for} CF — ${teamRow.corsi_against} CA`} />
            <AdvStatRow label="Fenwick For% (FF%)"
              val={`${Number(teamRow.fenwick_for_pct).toFixed(1)}%`}
              avg="50.0%" rating={rate(Number(teamRow.fenwick_for_pct)/100, 0.5)}
              note={`${teamRow.fenwick_for} FF — ${teamRow.fenwick_against} FA · no missed shots`} />
            <AdvStatRow label="Corsi For/GP"
              val={teamRow.corsi_for_pg != null ? fmt(teamRow.corsi_for_pg, 1) : null}
              note="shot attempts for per game" />
            <AdvStatRow label="Corsi Against/GP"
              val={teamRow.corsi_against_pg != null ? fmt(teamRow.corsi_against_pg, 1) : null}
              note="shot attempts against per game" />
          </>
        ) : useReg ? (
          <div className="adv-explain">Run pwhl_stats.py to populate Corsi/Fenwick data.</div>
        ) : null}
        <AdvStatRow label="Shots For/GP"     val={sogPG != null ? fmt(sogPG,1) : null}
          avg={AVG.sogpg.toFixed(1)} rating={rate(sogPG, AVG.sogpg)} />
        <AdvStatRow label="Shots Against/GP" val={saPG  != null ? fmt(saPG, 1) : null}
          avg={AVG.sapg.toFixed(1)}  rating={rate(saPG,  AVG.sapg, false)} />
        <AdvStatRow label="Goals For/GP"     val={gfpg != null ? fmt(gfpg) : null}
          avg={AVG.gfpg.toFixed(2)} rating={rate(gfpg, AVG.gfpg)} />
        <AdvStatRow label="Goals Against/GP" val={gapg != null ? fmt(gapg) : null}
          avg={AVG.gapg.toFixed(2)} rating={rate(gapg, AVG.gapg, false)} />
      </div>

      {/* PDO & Puck Luck */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom:8 }}>PDO &amp; Puck Luck</div>
        {showPO ? (
          <div className="adv-explain">
            PDO requires shot-level data not available for playoffs yet.
            Showing regular season PDO for reference.
          </div>
        ) : (
          <div className="adv-explain">
            PDO = team shooting% + save% × 100. League average = 100.
            Values above 102 suggest positive puck luck likely to regress; below 98 suggests negative luck.
          </div>
        )}
        <AdvStatRow label={showPO ? 'PDO (reg season)' : 'PDO'}
          val={pdo != null ? fmt(pdo,1) : null}
          avg="100.0" rating={rate(pdo, AVG.pdo)}
          note={pdo != null ? (pdo > 102 ? 'Positive luck — may regress' : pdo < 98 ? 'Negative luck — may improve' : 'Near league average') : null} />
        <AdvStatRow label={showPO ? 'Team SH% (reg)' : 'Team SH%'}
          val={shPct != null ? fmtPct(shPct) : null}
          avg={fmtPct(AVG.shPct)} rating={rate(shPct, AVG.shPct)}
          note={`${totalGoals}G on ${totalShots} shots`} />
        <AdvStatRow label={showPO ? 'Team SV% (reg)' : 'Team SV%'}
          val={svPct != null ? svPct.toFixed(3).replace('0.','.') : null}
          avg={AVG.svPct.toFixed(3).replace('0.','.')} rating={rate(svPct, AVG.svPct)} />
      </div>

      {/* Special Teams */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom:8 }}>Special Teams</div>
        {(ppPct != null || pkPct != null) ? (
          <>
            <AdvStatRow label="PP%"
              val={ppPct != null ? fmtPct(ppPct) : null}
              avg={fmtPct(AVG.ppPct)} rating={rate(ppPct, AVG.ppPct)}
              note={teamRow.pp_goals != null && teamRow.pp_opportunities
                ? `${teamRow.pp_goals}G on ${teamRow.pp_opportunities} chances` : 'league avg ~17.5%'} />
            <AdvStatRow label="PK%"
              val={pkPct != null ? fmtPct(pkPct) : null}
              avg={fmtPct(AVG.pkPct)} rating={rate(pkPct, AVG.pkPct)}
              note={teamRow.pk_goals_against != null && teamRow.times_shorthanded
                ? `${teamRow.pk_goals_against}GA on ${teamRow.times_shorthanded} PKs` : 'league avg ~82.5%'} />
            {teamRow.sh_goals_for != null && (
              <AdvStatRow label="SHG For"  val={teamRow.sh_goals_for}  note="shorthanded goals scored" />
            )}
            {teamRow.sh_goals_against != null && (
              <AdvStatRow label="SHG Against" val={teamRow.sh_goals_against} note="shorthanded goals allowed" />
            )}
          </>
        ) : (
          <div className="adv-explain">Running pwhl_stats.py will populate PP/PK data.</div>
        )}
      </div>


      {/* League context */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom:8 }}>League Context</div>
        <div className="adv-explain">
          Where {abbr} ranks among 8 PWHL teams this season.
        </div>
        {[
          ['Points',      teamRow.points, 'points',       true,  null],
          ['Goals For',   teamRow.goals_for, 'goals_for', true,  null],
          ['Goals Against',teamRow.goals_against,'goals_against',false,null],
        ].map(([label, val, key, hb]) => {
          const r = leagueRank(key, hb);
          return (
            <div key={label} className="adv-stat-row">
              <span className="adv-stat-label">{label}: <strong>{val ?? '—'}</strong></span>
              <span className="adv-stat-right">
                <RankBadge r={r} />
                <span className="adv-stat-avg" style={{ marginLeft:4 }}>of 8</span>
              </span>
            </div>
          );
        })}
      </div>

    </div>
  );
}

// ── Trends tab ────────────────────────────────────────────────────────────────
function TrendsTab({ schedule, teamId, loading }) {
  const gameLog = useMemo(() => {
    if (!schedule?.length || !teamId) return [];
    return [...schedule]
      .filter(g => g.game_state === 'Final')
      .sort((a,b) => a.game_id - b.game_id)
      .map(g => {
        const isHome = g.home_team_id === teamId;
        const my     = isHome ? g.home_score : g.away_score;
        const op     = isHome ? g.away_score : g.home_score;
        const won    = my > op;
        const isExtra = g.ot || g.shootout;
        const result = won ? (isExtra ? 'OTW' : 'W') : (!won && isExtra ? 'OTL' : 'L');
        return { won, my, op, result, ot: g.ot, so: g.shootout, game_id: g.game_id };
      });
  }, [schedule, teamId]);

  if (loading) return (
    <div className="card empty-state" style={{ marginTop: 10 }}>
      <div className="empty-icon">📈</div>
      <div className="empty-title">Loading trends…</div>
    </div>
  );

  if (!gameLog.length) return (
    <div className="card empty-state" style={{ marginTop: 10 }}>
      <div className="empty-icon">📈</div>
      <div className="empty-title">No game data yet</div>
    </div>
  );

  // Rolling 10-game win %
  const rolling = gameLog.map((g, i) => {
    const window = gameLog.slice(Math.max(0, i-9), i+1);
    return { ...g, w10pct: Math.round(window.filter(x => x.won).length / window.length * 100) };
  });

  // Rolling 5-game GF/GA avg
  const rollingGF = gameLog.map((g, i) => {
    const w = gameLog.slice(Math.max(0, i-4), i+1);
    return parseFloat((w.reduce((s,x) => s+x.my, 0) / w.length).toFixed(1));
  });
  const rollingGA = gameLog.map((g, i) => {
    const w = gameLog.slice(Math.max(0, i-4), i+1);
    return parseFloat((w.reduce((s,x) => s+x.op, 0) / w.length).toFixed(1));
  });

  // Streak
  let streak = 0, streakType = '';
  for (let i = gameLog.length-1; i >= 0; i--) {
    const g = gameLog[i];
    if (i === gameLog.length-1) { streakType = g.won ? 'W' : 'L'; streak = 1; }
    else if ((g.won && streakType === 'W') || (!g.won && streakType === 'L')) streak++;
    else break;
  }

  const last10   = gameLog.slice(-10);
  const last10W  = last10.filter(g => g.won).length;
  const display  = gameLog.slice(-20); // show last 20 games
  const rollDisp = rolling.slice(-20);
  const gfDisp   = rollingGF.slice(-20);
  const gaDisp   = rollingGA.slice(-20);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>

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
            <div className="tq-val">{last10W}–{10-last10W}</div>
          </div>
          <div className="tq-item">
            <div className="tq-label">Win% L10</div>
            <div className="tq-val">{Math.round(last10W/10*100)}%</div>
          </div>
        </div>
      </div>

      {/* Result dots */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom: 10 }}>Last {display.length} games</div>
        <div className="result-dots">
          {display.map((g, i) => (
            <div key={i}
              className={`result-dot ${g.won ? (g.ot||g.so ? 'otw' : 'w') : (g.ot||g.so ? 'otl' : 'l')}`}
              title={`${g.result} ${g.my}–${g.op}`}>
              {g.result === 'OTW' ? 'W' : g.result === 'OTL' ? 'O' : g.result}
            </div>
          ))}
        </div>
      </div>

      {/* Rolling 10-game win % */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom: 10 }}>Win% — rolling 10-game window</div>
        <div className="rolling-chart">
          {rollDisp.map((g, i) => (
            <div key={i} className="rolling-bar-wrap">
              <div className="rolling-bar-label">{g.w10pct}%</div>
              <div className={`rolling-bar ${g.w10pct >= 60 ? 'hot' : g.w10pct >= 40 ? 'ok' : 'cold'}`}
                style={{ height: `${g.w10pct}%` }}
                title={`${g.w10pct}% win rate`} />
              {i % 5 === 0 && <div className="rolling-label">{i+1}</div>}
            </div>
          ))}
          <div className="rolling-avg-line" style={{ bottom: '50%' }} />
        </div>
        <div className="rolling-legend">
          <span className="rl-hot">■ Hot (≥60%)</span>
          <span className="rl-ok">■ Average (40–60%)</span>
          <span className="rl-cold">■ Cold (&lt;40%)</span>
          <span style={{ color:'var(--text-dim)', marginLeft:'auto', fontSize:9 }}>— 50% ref</span>
        </div>
      </div>

      {/* GF/GA rolling 5-game avg */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom: 10 }}>Goals — rolling 5-game average</div>
        <div className="rolling-chart rolling-chart-dual">
          {gfDisp.map((gf, i) => {
            const ga = gaDisp[i];
            const maxVal = 6;
            return (
              <div key={i} className="rolling-bar-wrap">
                <div className="rolling-bar-label" style={{ color: 'var(--red-bright)' }}>{gf}</div>
                <div className="rolling-bar-dual">
                  <div className="rolling-bar gf-bar" style={{ height: `${Math.min(gf/maxVal*100,100)}%` }} title={`GF avg: ${gf}`} />
                  <div className="rolling-bar ga-bar" style={{ height: `${Math.min(ga/maxVal*100,100)}%` }} title={`GA avg: ${ga}`} />
                </div>
                <div className="rolling-bar-label-bot" style={{ color: 'var(--blue-bright)' }}>{ga}</div>
                {i % 5 === 0 && <div className="rolling-label">{i+1}</div>}
              </div>
            );
          })}
        </div>
        <div className="rolling-legend">
          <span style={{ color: 'var(--red-bright)' }}>■ Goals For</span>
          <span style={{ color: 'var(--blue-bright)', marginLeft: 12 }}>■ Goals Against</span>
        </div>
      </div>

      {/* Goal differential */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom: 6 }}>Goal differential by game</div>
        <div className="gd-chart-wrap">
          <div className="gd-baseline-line" />
          <div className="gd-bars">
            {display.map((g, i) => {
              const diff  = g.my - g.op;
              const absPx = Math.min(Math.abs(diff) * 12, 48);
              return (
                <div key={i} className="gd-bar-col" title={`${g.result} ${g.my}–${g.op}`}>
                  <div className="gd-top">
                    {diff > 0 && (
                      <>
                        <div className="gd-bar-inline-label pos">+{diff}</div>
                        <div className="gd-bar pos" style={{ height: absPx }} />
                      </>
                    )}
                  </div>
                  <div className="gd-bot">
                    {diff < 0 && (
                      <>
                        <div className="gd-bar neg" style={{ height: absPx }} />
                        <div className="gd-bar-inline-label neg">{diff}</div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}

// ── Salaries tab ─────────────────────────────────────────────────────────────
function SalariesTab({ salaries, loading, abbr, color }) {
  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:10 }}>
      {[80,65,72,58,70,63].map((w,i) => (
        <div key={i} className="skeleton" style={{ height:32, width:`${w}%`, borderRadius:6 }} />
      ))}
    </div>
  );

  if (!salaries?.length) return (
    <div className="card empty-state" style={{ marginTop:10 }}>
      <div className="empty-icon">💰</div>
      <div className="empty-title">No salary data</div>
      <div className="empty-sub">Run python pwhl_salaries.py to populate.</div>
    </div>
  );

  const maxSalary  = Math.max(...salaries.map(p => p.salary || 0));
  const totalPay   = salaries.reduce((s, p) => s + (p.salary || 0), 0);
  const avgSalary  = salaries.length > 0 ? totalPay / salaries.length : 0;
  // PWHL CBA 2025-26: target average salary $58,349.50/player (±10% variance allowed)
  // Team payroll ceiling ~$1.3M USD; increases 3% annually through 2031
  const AVG_TARGET = 58_349.50;
  const CAP        = 1_300_000;
  const capPct     = Math.round((totalPay / CAP) * 100);
  const avgVsTarget = avgSalary > 0 ? ((avgSalary - AVG_TARGET) / AVG_TARGET * 100).toFixed(1) : null;

  function fmtSalary(v) {
    if (v == null) return '—';
    return `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:10 }}>

      {/* Cap summary */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom:10 }}>2025-26 Salary Summary</div>
        <div className="overview-stat-grid">
          {[
            ['Total Payroll',  fmtSalary(totalPay)],
            ['Players',        salaries.length],
            ['Avg Salary',     fmtSalary(Math.round(avgSalary))],
            ['CBA Target',     fmtSalary(AVG_TARGET)],
            ['Avg vs Target',  avgVsTarget != null ? `${avgVsTarget > 0 ? '+' : ''}${avgVsTarget}%` : '—'],
            ['Cap Ceiling',    fmtSalary(CAP)],
          ].map(([label, val]) => (
            <div key={label} className="overview-stat-cell">
              <div className="overview-stat-label">{label}</div>
              <div className="overview-stat-val" style={{ fontSize:13 }}>{val}</div>
            </div>
          ))}
        </div>
        {/* Cap bar */}
        <div style={{ marginTop:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10,
            color:'var(--text-dim)', marginBottom:4 }}>
            <span>{abbr} payroll: {fmtSalary(totalPay)} ({capPct}% of ~$1.3M ceiling)</span>
            <span>CBA avg target: {fmtSalary(AVG_TARGET)}/player</span>
          </div>
          <div style={{ height:10, background:'var(--bg3)', borderRadius:5, overflow:'hidden',
            border:'0.5px solid var(--border-2)' }}>
            <div style={{
              height:'100%', borderRadius:5,
              width:`${Math.min(capPct, 100)}%`,
              background: capPct > 90 ? 'var(--red-bright)' : capPct > 75 ? 'var(--amber)' : color,
              transition:'width 0.4s ease',
            }} />
          </div>
        </div>
        <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:6 }}>
          Base salary only · Source: PWHLPA Salary Guide (Apr 2026) · CBA avg target +3%/yr through 2031
        </div>
      </div>

      {/* Player salary bars */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom:10 }}>{abbr} Player Salaries</div>
        {salaries.map((p, i) => {
          const barPct = maxSalary > 0 ? (p.salary / maxSalary) * 100 : 0;
          const name   = p.first_name && p.last_name
            ? `${p.first_name} ${p.last_name}` : '—';
          return (
            <div key={i} style={{ marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between',
                fontSize:12, marginBottom:3 }}>
                <span style={{ color:'var(--text)', fontWeight: i < 3 ? 700 : 400 }}>
                  {name}
                </span>
                <span style={{ color, fontWeight:700, fontFamily:'var(--font-mono)',
                  fontSize:11 }}>
                  {fmtSalary(p.salary)}
                </span>
              </div>
              <div style={{ height:5, background:'var(--bg3)', borderRadius:3, overflow:'hidden' }}>
                <div style={{
                  height:'100%', borderRadius:3,
                  width:`${barPct}%`,
                  background: barPct > 80 ? color : `${color}99`,
                  transition:'width 0.3s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
