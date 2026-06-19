// views/PWHLTeamView.jsx
// Mirrors NHL TeamView — tabbed layout: Overview / Stats / Splits
import { useState, useMemo } from 'react';
import { useFetch } from '../hooks/useFetch';
import {
  fetchPWHLStandings, fetchPWHLPlayers, fetchPWHLSchedule,
  PWHL_TEAM_CONFIG, PWHL_TEAM_ID,
} from '../utils/pwhlApi';
import { PWHL_CURRENT_SEASON } from '../utils/pwhlConfig';
import TeamLogo from '../components/TeamLogo';
import { MetCard } from '../components/StatBar';
import InfoTip from '../components/InfoTip';
import './TeamView.css';
import './ShotMapView.css';

const TABS = ['Overview', 'Stats', 'Splits'];

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
  const { data: schedule,  loading: scLoad } = useFetch(
    () => teamId ? fetchPWHLSchedule(teamId, PWHL_CURRENT_SEASON) : Promise.resolve(null), [teamId]
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

      {tab === 'Overview' && (
        <OverviewTab teamRow={teamRow} skaters={skaters} goalies={goalies}
          schedule={schedule} teamId={teamId} abbr={abbr} color={color} loading={loading} />
      )}
      {tab === 'Stats' && (
        <StatsTab skaters={skaters} goalies={goalies} loading={pLoad} abbr={abbr} color={color} />
      )}
      {tab === 'Splits' && (
        <SplitsTab schedule={schedule} teamId={teamId} abbr={abbr} color={color} loading={scLoad} />
      )}
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────
function OverviewTab({ teamRow, skaters, goalies, schedule, teamId, abbr, color, loading }) {
  const TEAM_CODES = { 1:'BOS',2:'MIN',3:'MTL',4:'NY',5:'OTT',6:'TOR',8:'SEA',9:'VAN' };

  const gd = teamRow ? (teamRow.goals_for ?? 0) - (teamRow.goals_against ?? 0) : null;

  const topScorers = useMemo(
    () => [...skaters].sort((a,b) => (b.points??0)-(a.points??0)).slice(0,5),
    [skaters]
  );
  const starter = useMemo(
    () => [...goalies].sort((a,b) => (b.gp??0)-(a.gp??0))[0] || null,
    [goalies]
  );

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
              ['Goals/GP',  teamRow.gp ? ((teamRow.goals_for??0)/teamRow.gp).toFixed(2) : '—'],
              ['GA/GP',     teamRow.gp ? ((teamRow.goals_against??0)/teamRow.gp).toFixed(2) : '—'],
              ['Home W',    teamRow.home_wins ?? '—'],
              ['Away W',    teamRow.away_wins ?? '—'],
              ['GF',        teamRow.goals_for ?? '—'],
              ['GA',        teamRow.goals_against ?? '—'],
              ['Diff',      gd != null ? (gd >= 0 ? `+${gd}` : gd) : '—'],
            ].map(([label, val]) => (
              <div key={label} className="overview-stat-cell">
                <div className="overview-stat-label">{label}</div>
                <div className="overview-stat-val">{val}</div>
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
function StatsTab({ skaters, goalies, loading, abbr, color }) {
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
function SplitsTab({ schedule, teamId, abbr, color, loading }) {
  const TEAM_CODES = { 1:'BOS',2:'MIN',3:'MTL',4:'NY',5:'OTT',6:'TOR',8:'SEA',9:'VAN' };

  const splits = useMemo(() => {
    if (!schedule?.length || !teamId) return null;
    const final = schedule.filter(g => g.game_state === 'Final');
    const calc  = (games) => {
      let w=0, l=0, otl=0, gf=0, ga=0;
      for (const g of games) {
        const isHome = g.home_team_id === teamId;
        const my = isHome ? g.home_score : g.away_score;
        const op = isHome ? g.away_score : g.home_score;
        gf += my ?? 0; ga += op ?? 0;
        if (my > op) w++;
        else if (g.ot || g.shootout) otl++;
        else l++;
      }
      return { w, l, otl, gf, ga, gp: games.length };
    };
    const home = calc(final.filter(g => g.home_team_id === teamId));
    const away = calc(final.filter(g => g.away_team_id === teamId));
    const wins  = calc(final.filter(g => { const ih = g.home_team_id===teamId; return (ih?g.home_score:g.away_score) > (ih?g.away_score:g.home_score); }));
    const losses= calc(final.filter(g => { const ih = g.home_team_id===teamId; return (ih?g.home_score:g.away_score) < (ih?g.away_score:g.home_score); }));
    return { home, away };
  }, [schedule, teamId]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
      {[1,2].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 10 }} />)}
    </div>
  );

  if (!splits) return (
    <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-dim)', marginTop: 10 }}>
      No schedule data yet.
    </div>
  );

  const SplitCard = ({ label, s }) => (
    <div className="card" style={{ marginTop: 10 }}>
      <div className="sec-label" style={{ marginBottom: 8 }}>{label}</div>
      <div className="record-main-row">
        <span className="record-big">{s.w}–{s.l}–{s.otl}</span>
        <span className="pts-chip">{s.w*2+s.otl} pts</span>
      </div>
      <div className="record-meta">
        <span>GF: {s.gf}</span>
        <span className="record-meta-sep">·</span>
        <span>GA: {s.ga}</span>
        <span className="record-meta-sep">·</span>
        <span>Diff: {s.gf-s.ga >= 0 ? `+${s.gf-s.ga}` : s.gf-s.ga}</span>
      </div>
    </div>
  );

  return (
    <>
      <SplitCard label="🏠 Home" s={splits.home} />
      <SplitCard label="✈️ Away" s={splits.away} />
    </>
  );
}
