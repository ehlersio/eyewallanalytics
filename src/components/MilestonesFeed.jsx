// src/components/MilestonesFeed.jsx
// League-wide milestone feed (hat tricks, shutouts, SH goals, season/career
// thresholds), populated nightly by milestones.py. Rendered as a tab inside
// NewsView alongside the news feed. Reuses NewsView's card/chip classes so
// it inherits NewsView.css without needing new stylesheet work.
import { useState, useEffect, useCallback, useRef } from 'react';
import { ALL_TEAMS } from '../utils/teamConfig';
import { PWHL_TEAMS } from '../utils/pwhlConfig';
import { useSport } from '../utils/SportContext';
import TeamLogo from './TeamLogo';
import PlayerPopup from './PlayerPopup';
import PWHLPlayerPopup from './PWHLPlayerPopup';
import { capture } from '../utils/analytics';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';

const MILESTONE_META = {
  hat_trick:         { icon: '🎩', label: 'Hat Trick' },
  natural_hat_trick: { icon: '🎩', label: 'Natural Hat Trick' },
  sh_goal:           { icon: '⚡', label: 'Shorthanded Goal' },
  shutout:           { icon: '🥅', label: 'Shutout' },
};
function milestoneMeta(type) {
  if (MILESTONE_META[type]) return MILESTONE_META[type];
  if (type?.startsWith('season_'))  return { icon: '📈', label: 'Season Milestone' };
  if (type?.startsWith('career_'))  return { icon: '🏆', label: 'Career Milestone' };
  return { icon: '⭐', label: 'Milestone' };
}

function formatGameDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Build the secondary detail line from milestones.py's `detail` JSONB.
// Every milestone_type has a different shape here — see milestones.py's
// (NHL) / pwhl_milestones.py's (PWHL) detect_* functions for what's
// actually written.
function renderDetailItems(item) {
  const d = item.detail || {};
  const items = [];

  if (item.milestone_type === 'natural_hat_trick' && d.goal_periods?.length) {
    d.goal_periods.forEach((p, i) => {
      // PWHL stores raw countdown seconds remaining, not an elapsed mm:ss
      // clock (OT period length isn't confirmed, so no derived clock time
      // is shown — see pwhl_milestones.py). NHL stores elapsed "12:34"
      // strings under goal_times, which PWHL rows never have.
      const t = item.is_pwhl ? null : d.goal_times?.[i];
      items.push(`P${p}${t ? ` ${t}` : ''}`);
    });
  } else if (item.milestone_type === 'hat_trick' && d.goal_count) {
    items.push(`${d.goal_count} goals`);
  } else if (item.milestone_type === 'sh_goal') {
    if (d.period) items.push(`P${d.period}${d.time_in_period ? ` ${d.time_in_period}` : ''}`);
  } else if (item.milestone_type?.startsWith('season_goals_') && d.season_goals != null) {
    items.push(`${d.season_goals} goals this season`);
  } else if (item.milestone_type?.startsWith('season_points_') && d.season_points != null) {
    items.push(`${d.season_points} points this season`);
  } else if (item.milestone_type?.startsWith('career_points_') && d.career_points != null) {
    items.push(`${d.career_points.toLocaleString()} career points`);
  } else if (item.milestone_type?.startsWith('career_wins_') && d.career_wins != null) {
    items.push(`${d.career_wins} career wins`);
  }

  return items;
}

// Custom team dropdown — native <select><option> can't render images
// inside options in any browser, so this is a button + popover instead.
function TeamFilterDropdown({ team, onChange, teams, sport }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const selectedTeam = team !== 'all' ? teams.find(t => t.abbr === team) : null;

  function pick(abbr) {
    onChange(abbr);
    setOpen(false);
  }

  return (
    <div className="ms-team-select-wrap" ref={wrapRef}>
      <button
        className={`ms-team-select-btn${team !== 'all' ? ' active' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selectedTeam ? <TeamLogo abbr={selectedTeam.abbr} sport={sport} size={16} /> : null}
        {selectedTeam ? selectedTeam.abbr : 'All Teams'}
      </button>
      {open && (
        <div className="ms-team-menu" role="listbox">
          <button
            className={`ms-team-option${team === 'all' ? ' active' : ''}`}
            onClick={() => pick('all')}
            role="option"
            aria-selected={team === 'all'}
          >
            All Teams
          </button>
          {teams.map(t => (
            <button
              key={t.abbr}
              className={`ms-team-option${team === t.abbr ? ' active' : ''}`}
              onClick={() => pick(t.abbr)}
              role="option"
              aria-selected={team === t.abbr}
            >
              <TeamLogo abbr={t.abbr} sport={sport} size={18} />
              {t.abbr} — {t.shortName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MilestoneCard({ item, onOpenPlayer }) {
  const meta = milestoneMeta(item.milestone_type);
  const detailItems = renderDetailItems(item);
  const tappable = item.player_id != null;

  const handleClick = () => {
    if (!tappable) return;
    capture('milestone_card_clicked', { type: item.milestone_type, team: item.team });
    onOpenPlayer(item.player_id);
  };

  return (
    <article
      className="news-card card"
      onClick={tappable ? handleClick : undefined}
      role={tappable ? 'link' : undefined}
      tabIndex={tappable ? 0 : undefined}
      onKeyDown={tappable ? (e => e.key === 'Enter' && handleClick()) : undefined}
      aria-label={item.description}
    >
      <div className="news-card-body">
        <div className="news-card-meta">
          <span className="milestone-icon-badge">{meta.icon} {meta.label}</span>
          <span className="news-card-time">{formatGameDate(item.game_date)}</span>
        </div>
        <h3 className="news-card-title milestone-card-title">
          <TeamLogo abbr={item.team} sport={item.is_pwhl ? 'pwhl' : 'nhl'} size={20} />
          {item.description}
        </h3>
        {item.opponent && (
          <p className="news-card-excerpt">vs {item.opponent}</p>
        )}
        {detailItems.length > 0 && (
          <div className="milestone-detail-row">
            {detailItems.map((d, i) => (
              <span key={i} className="milestone-detail-item">{d}</span>
            ))}
          </div>
        )}
      </div>
      {tappable && <div className="news-card-arrow">→</div>}
    </article>
  );
}

export default function MilestonesFeed() {
  const { isPWHL } = useSport();
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [team, setTeam]             = useState('all');

  const [popupPlayer, setPopupPlayer]   = useState(null);
  const [popupLoading, setPopupLoading] = useState(false);
  const [popupError, setPopupError]     = useState(null);

  const fetchingRef = useRef(false);
  const teamList = isPWHL ? PWHL_TEAMS : ALL_TEAMS;
  const sportKey  = isPWHL ? 'pwhl' : 'nhl';

  const fetchMilestones = useCallback(async (teamFilter, pwhl) => {
    if (!WORKER_URL) { setError('Worker URL not configured'); setLoading(false); return; }
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (pwhl) params.set('sport', 'pwhl');
      if (teamFilter && teamFilter !== 'all') params.set('team', teamFilter);
      const qs  = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`${WORKER_URL}/milestones${qs}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Milestones not available — check back soon');
      const data = await res.json();
      setMilestones(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  // Reset the team filter on sport switch — a team abbreviation selected
  // under one sport (e.g. "BOS") isn't guaranteed to mean the same team,
  // or exist at all, under the other.
  useEffect(() => { setTeam('all'); }, [isPWHL]);

  useEffect(() => { fetchMilestones(team, isPWHL); }, [team, isPWHL, fetchMilestones]);

  // Fetch the full player object and open the sport-appropriate popup.
  // NHL: /player/landing proxies api-web.nhle.com (browser can't hit it
  // directly — no CORS headers on their end), shape is the NHL landing
  // API's own response, reshaped below for PlayerPopup.
  // PWHL: /pwhl/player/landing queries Supabase directly and merges the
  // player's season stats onto the identity row, since PWHLPlayerPopup
  // (unlike NHL's PlayerPopup) reads stats straight off the player object
  // instead of fetching them itself — no reshaping needed, passed through
  // as-is.
  //
  // Confirmed (via two independent NHL API references — nhlapi-tools
  // PyPI package's real usage, and a hosted API doc listing get_landing's
  // response fields) that the landing endpoint's field is
  // currentTeamAbbrev, not teamAbbrev — checked first below, with
  // teamAbbrev kept only as a defensive fallback.
  async function handleOpenPlayer(playerId) {
    setPopupLoading(true);
    setPopupError(null);
    try {
      if (isPWHL) {
        const res = await fetch(`${WORKER_URL}/pwhl/player/landing?id=${playerId}`);
        if (!res.ok) throw new Error('Player info not available');
        const p = await res.json();
        setPopupPlayer(p);
      } else {
        const res = await fetch(`${WORKER_URL}/player/landing?id=${playerId}`);
        if (!res.ok) throw new Error('Player info not available');
        const p = await res.json();
        setPopupPlayer({
          id: p.playerId ?? playerId,
          firstName: p.firstName,
          lastName: p.lastName,
          positionCode: p.position,
          teamAbbrev: p.currentTeamAbbrev ?? p.teamAbbrev,
          headshot: p.headshot,
          sweaterNumber: p.sweaterNumber,
          shootsCatches: p.shootsCatches,
        });
      }
    } catch (err) {
      setPopupError(err.message);
    } finally {
      setPopupLoading(false);
    }
  }

  function handleTeamChange(abbr) {
    setTeam(abbr);
    if (abbr !== 'all') capture('milestones_filter_changed', { team: abbr, sport: sportKey });
  }

  return (
    <div className="milestones-feed">
      <div className="news-header card">
        <div className="news-header-row">
          <div>
            <div className="news-title">Milestones</div>
            {!loading && (
              <div className="news-updated">{milestones.length} recent</div>
            )}
          </div>
          <TeamFilterDropdown team={team} onChange={handleTeamChange} teams={teamList} sport={sportKey} />
        </div>
      </div>

      {popupLoading && (
        <div className="news-updated" style={{ textAlign: 'center', padding: '8px 0' }}>
          Loading player…
        </div>
      )}
      {popupError && (
        <div className="news-error-msg" style={{ textAlign: 'center', padding: '8px 0' }}>
          {popupError}
        </div>
      )}

      {loading && (
        <div className="news-loading">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="news-skeleton card">
              <div className="skel skel-badge" />
              <div className="skel skel-title" />
              <div className="skel skel-text" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="news-error card">
          <div className="news-error-icon">🏒</div>
          <div className="news-error-msg">{error}</div>
          <button className="news-refresh-btn" onClick={() => fetchMilestones(team, isPWHL)}>Try again</button>
        </div>
      )}

      {!loading && !error && milestones.length === 0 && (
        <div className="news-empty card">
          <div className="news-error-icon">🏒</div>
          <div>No milestones found{team !== 'all' ? ` for ${team}` : ''} yet.</div>
        </div>
      )}

      {!loading && !error && milestones.length > 0 && (
        <div className="news-feed">
          {milestones.map((item, i) => (
            <MilestoneCard
              key={`${item.game_id}-${item.player_id}-${item.milestone_type}-${i}`}
              item={item}
              onOpenPlayer={handleOpenPlayer}
            />
          ))}
        </div>
      )}

      {popupPlayer && (
        isPWHL ? (
          <PWHLPlayerPopup
            player={popupPlayer}
            onClose={() => setPopupPlayer(null)}
          />
        ) : (
          <PlayerPopup
            player={popupPlayer}
            isLeagueContext
            inPlayoffs={false}
            standings={[]}
            onClose={() => setPopupPlayer(null)}
          />
        )
      )}
    </div>
  );
}
