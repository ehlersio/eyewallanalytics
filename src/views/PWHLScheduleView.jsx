// views/PWHLScheduleView.jsx
// Mirrors NHL ScheduleView — result cards for completed games (tap for popup),
// upcoming game cards. Uses same result-card / GameCard visual language.
import { useState, useMemo } from 'react';
import { useFetch } from '../hooks/useFetch';
import { fetchPWHLSchedule, PWHL_TEAM_CONFIG, PWHL_TEAM_ID } from '../utils/pwhlApi';
import { PWHL_CURRENT_SEASON, PWHL_TEAM_MAP } from '../utils/pwhlConfig';
import TeamLogo from '../components/TeamLogo';
import './ScheduleView.css';
import './ShotMapView.css';

const SEASONS = [
  { id: 8, label: '2025-26' },
  { id: 5, label: '2024-25' },
  { id: 1, label: '2023-24' },
];

const TEAM_CODES = { 1:'BOS',2:'MIN',3:'MTL',4:'NY',5:'OTT',6:'TOR',8:'SEA',9:'VAN' };
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d)) return str;
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export default function PWHLScheduleView() {
  const team   = PWHL_TEAM_CONFIG;
  const teamId = PWHL_TEAM_ID;
  const abbr   = team?.abbr || '—';
  const color  = team?.displayColor || 'var(--text-dim)';

  const [season,  setSeason]  = useState(PWHL_CURRENT_SEASON);
  const [popup,   setPopup]   = useState(null);   // game object for detail popup
  const [regSort, setRegSort] = useState('desc');  // 'asc' | 'desc'

  const { data: schedule = null, loading } = useFetch(
    () => teamId ? fetchPWHLSchedule(teamId, season) : Promise.resolve(null),
    [teamId, season]
  );

  const { completed, upcoming, record } = useMemo(() => {
    if (!schedule?.length) return { completed: [], upcoming: [], record: { w:0, l:0, otl:0, pts:0 } };
    const today = new Date(); today.setHours(0,0,0,0);
    const comp = schedule.filter(g => g.game_state === 'Final');
    const up   = schedule.filter(g => g.game_state !== 'Final');
    let w=0, l=0, otl=0;
    for (const g of comp) {
      const isHome  = g.home_team_id === teamId;
      const my = isHome ? g.home_score : g.away_score;
      const op = isHome ? g.away_score : g.home_score;
      if (my > op) w++;
      else if (g.ot || g.shootout) otl++;
      else l++;
    }
    return { completed: comp, upcoming: up, record: { w, l, otl, pts: w*2+otl } };
  }, [schedule, teamId]);

  const sortedCompleted = useMemo(() =>
    [...completed].sort((a,b) =>
      regSort === 'desc' ? b.game_id - a.game_id : a.game_id - b.game_id
    ), [completed, regSort]);

  const sortedUpcoming = useMemo(() =>
    [...upcoming].sort((a,b) => a.game_id - b.game_id),
    [upcoming]);

  const seasonLabel = SEASONS.find(s => s.id === season)?.label || String(season);

  if (!abbr || !teamId) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ color: 'var(--text-dim)' }}>No PWHL team selected.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="sched-header">
        <h2 className="sched-title">
          <TeamLogo abbr={abbr} sport="pwhl" size={22} color={color} style={{ marginRight: 6 }} />
          {seasonLabel} Schedule
        </h2>
        <div className="sched-record">
          Record: <strong>{record.w}–{record.l}–{record.otl}</strong>
          <span className="pts-badge">{record.pts} pts</span>
        </div>
      </div>

      {/* Season picker */}
      <div className="sched-tabs">
        {SEASONS.map(s => (
          <button key={s.id} className={`sched-tab${season === s.id ? ' active' : ''}`}
            onClick={() => setSeason(s.id)}>{s.label}</button>
        ))}
        {/* Sort toggle mirrors NHL SortBar */}
        <div className="view-mode-toggle">
          <button className={`vm-btn${regSort === 'desc' ? ' active' : ''}`}
            onClick={() => setRegSort('desc')} title="Newest first">↓</button>
          <button className={`vm-btn${regSort === 'asc' ? ' active' : ''}`}
            onClick={() => setRegSort('asc')} title="Oldest first">↑</button>
        </div>
      </div>

      {loading && <LoadingCards count={5} />}

      {!loading && !schedule?.length && (
        <div className="card empty-state">
          <div className="empty-icon">📅</div>
          <div className="empty-title">No games found</div>
          <div className="empty-sub">No schedule data for {seasonLabel}.</div>
        </div>
      )}

      {!loading && schedule?.length > 0 && (
        <>
          {/* Upcoming games */}
          {sortedUpcoming.map(g => (
            <UpcomingCard key={g.game_id} game={g} teamId={teamId} abbr={abbr} color={color} />
          ))}

          {/* Completed games */}
          {sortedCompleted.map(g => (
            <CompletedCard key={g.game_id} game={g} teamId={teamId} abbr={abbr} color={color}
              onClick={() => setPopup(g)} />
          ))}
        </>
      )}

      {/* Game detail popup */}
      {popup && (
        <PWHLGamePopup game={popup} teamId={teamId} abbr={abbr} color={color}
          onClose={() => setPopup(null)} />
      )}
    </div>
  );
}

// ── Completed game card — mirrors NHL result-card ─────────────────────────────
function CompletedCard({ game: g, teamId, abbr, color, onClick }) {
  const isHome  = g.home_team_id === teamId;
  const my      = isHome ? g.home_score : g.away_score;
  const op      = isHome ? g.away_score : g.home_score;
  const oppId   = isHome ? g.away_team_id : g.home_team_id;
  const oppAbbr = TEAM_CODES[oppId] || String(oppId);
  const oppTeam = PWHL_TEAM_MAP[oppAbbr];
  const oppColor = oppTeam?.displayColor || 'var(--text-dim)';
  const won     = my > op;
  const lost    = my < op;
  const suffix  = g.shootout ? '/SO' : g.ot ? '/OT' : '';

  return (
    <div className="result-card card clickable" onClick={onClick}>
      <div className="result-top">
        <span className="result-date">{formatDate(g.game_date)}</span>
        <span className={`result-outcome ${won ? 'win' : 'loss'}`}>
          {won ? 'W' : lost ? 'L' : 'OTL'}{suffix}
        </span>
        <span className="result-tap-hint">Tap for stats →</span>
      </div>
      <div className="result-score">
        <TeamLogo abbr={abbr} sport="pwhl" size={20} color={color} />
        <span className="result-abbr" style={{ color }}>{abbr}</span>
        <span className="result-num" style={{ color }}>{my ?? '—'}</span>
        <span className="result-sep">–</span>
        <span className="result-num muted">{op ?? '—'}</span>
        <span className="result-abbr muted">{oppAbbr}</span>
        <TeamLogo abbr={oppAbbr} sport="pwhl" size={20} color={oppColor} />
        <span className="result-venue">{isHome ? 'Home' : 'Away'}</span>
      </div>
    </div>
  );
}

// ── Upcoming game card ────────────────────────────────────────────────────────
function UpcomingCard({ game: g, teamId, abbr, color }) {
  const isHome  = g.home_team_id === teamId;
  const oppId   = isHome ? g.away_team_id : g.home_team_id;
  const oppAbbr = TEAM_CODES[oppId] || String(oppId);
  const oppTeam = PWHL_TEAM_MAP[oppAbbr];
  const oppColor = oppTeam?.displayColor || 'var(--text-dim)';

  return (
    <div className="card" style={{ marginBottom: 8, padding: '12px 14px' }}>
      <div className="result-top" style={{ marginBottom: 6 }}>
        <span className="result-date">{formatDate(g.game_date)}</span>
        <span className="context-pill regular" style={{ fontSize: 10 }}>Upcoming</span>
        <span className="result-venue">{isHome ? 'Home' : 'Away'}</span>
      </div>
      <div className="result-score">
        <TeamLogo abbr={abbr} sport="pwhl" size={20} color={color} />
        <span className="result-abbr" style={{ color }}>{abbr}</span>
        <span className="result-sep" style={{ fontSize: 14, color: 'var(--text-dim)' }}>vs</span>
        <span className="result-abbr muted">{oppAbbr}</span>
        <TeamLogo abbr={oppAbbr} sport="pwhl" size={20} color={oppColor} />
      </div>
    </div>
  );
}

// ── Game detail popup — tapping a completed game ──────────────────────────────
function PWHLGamePopup({ game: g, teamId, abbr, color, onClose }) {
  const isHome  = g.home_team_id === teamId;
  const my      = isHome ? g.home_score : g.away_score;
  const op      = isHome ? g.away_score : g.home_score;
  const oppId   = isHome ? g.away_team_id : g.home_team_id;
  const oppAbbr = TEAM_CODES[oppId] || String(oppId);
  const oppTeam = PWHL_TEAM_MAP[oppAbbr];
  const oppColor = oppTeam?.displayColor || 'var(--text-dim)';
  const won     = my > op;
  const suffix  = g.shootout ? ' (SO)' : g.ot ? ' (OT)' : '';

  return (
    <div className="shot-popup-backdrop" onClick={onClose}>
      <div className="shot-popup" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`popup-header ${won ? 'popup-goal popup-car' : 'popup-opp'}`}>
          <div className="popup-type-row">
            <span className="popup-type-icon">{won ? '✅' : '❌'}</span>
            <span className="popup-type-label">{won ? 'Win' : 'Loss'}{suffix}</span>
            <span className="popup-team-badge">{formatDate(g.game_date)}</span>
          </div>
          <button className="popup-close" onClick={onClose}>✕</button>
        </div>

        <div className="popup-body">
          {/* Score */}
          <div className="popup-section">
            <div className="popup-section-label">Final Score</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '12px 0' }}>
              <div style={{ textAlign: 'center' }}>
                <TeamLogo abbr={abbr} sport="pwhl" size={32} color={color} />
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color, marginTop: 4 }}>{my}</div>
                <div style={{ fontSize: 11, color }}>{abbr}</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Final{suffix}</div>
              <div style={{ textAlign: 'center' }}>
                <TeamLogo abbr={oppAbbr} sport="pwhl" size={32} color={oppColor} />
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: oppColor, marginTop: 4 }}>{op}</div>
                <div style={{ fontSize: 11, color: oppColor }}>{oppAbbr}</div>
              </div>
            </div>
          </div>

          {/* Game info */}
          <div className="popup-section">
            <div className="popup-section-label">Game Info</div>
            <div className="popup-row">
              <span className="popup-field">Date</span>
              <span className="popup-value">{formatDate(g.game_date)}</span>
            </div>
            <div className="popup-row">
              <span className="popup-field">Venue</span>
              <span className="popup-value">{isHome ? 'Home' : 'Away'}</span>
            </div>
            <div className="popup-row">
              <span className="popup-field">Outcome</span>
              <span className="popup-value" style={{ color: won ? 'var(--green)' : 'var(--red-bright)', fontWeight: 700 }}>
                {won ? 'Win' : 'Loss'}{suffix}
              </span>
            </div>
          </div>

          <div style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
            Full PBP drill-downs coming in a future session
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingCards({ count }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className="card" style={{ marginBottom: 8, padding: 14 }}>
      <div className="skeleton" style={{ height: 10, width: '40%', marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 20, width: '70%', marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 10, width: '30%' }} />
    </div>
  ));
}
