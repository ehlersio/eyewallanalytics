// src/components/MilestonesFeed.jsx
// League-wide milestone feed (hat tricks, shutouts, SH goals, season/career
// thresholds), populated nightly by milestones.py. Rendered as a tab inside
// NewsView alongside the news feed. Reuses NewsView's card/chip classes so
// it inherits NewsView.css without needing new stylesheet work.
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ALL_TEAMS } from '../utils/teamConfig';
import { PWHL_TEAMS } from '../utils/pwhlConfig';
import { useSport } from '../utils/SportContext';
import TeamLogo from './TeamLogo';
import PlayerPopup from './PlayerPopup';
import PWHLPlayerPopup from './PWHLPlayerPopup';
import { capture } from '../utils/analytics';
import { formatDate, formatNumber } from '../utils/formatters';
import {
  NEWS_HEADER_CLASSES, NEWS_HEADER_ROW_CLASSES, NEWS_TITLE_CLASSES, NEWS_UPDATED_CLASSES,
  NEWS_REFRESH_BTN_CLASSES, NEWS_FEED_CLASSES, NEWS_CARD_CLASSES, NEWS_CARD_BODY_CLASSES,
  NEWS_CARD_META_CLASSES, NEWS_CARD_TIME_CLASSES,
  NEWS_CARD_EXCERPT_CLASSES, NEWS_CARD_ARROW_CLASSES, NEWS_LOADING_CLASSES, NEWS_SKELETON_CLASSES,
  SKEL_BADGE_CLASSES, SKEL_TITLE_CLASSES, SKEL_TEXT_CLASSES, NEWS_ERROR_CLASSES,
  NEWS_EMPTY_CLASSES, NEWS_ERROR_ICON_CLASSES, NEWS_ERROR_MSG_CLASSES,
  MILESTONES_FEED_CLASSES, MILESTONE_ICON_BADGE_CLASSES, MILESTONE_CARD_TITLE_CLASSES,
  MILESTONE_DETAIL_ROW_CLASSES, MILESTONE_DETAIL_ITEM_CLASSES,
  MS_TEAM_SELECT_WRAP_CLASSES, msTeamSelectBtnClasses, MS_TEAM_MENU_CLASSES, msTeamOptionClasses,
} from '../utils/newsViewClasses';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';

const MILESTONE_META = {
  hat_trick:         { icon: '🎩', key: 'hatTrick' },
  natural_hat_trick: { icon: '🎩', key: 'naturalHatTrick' },
  sh_goal:           { icon: '⚡', key: 'shGoal' },
  shutout:           { icon: '🥅', key: 'shutout' },
};
function milestoneMeta(type) {
  if (MILESTONE_META[type]) return MILESTONE_META[type];
  if (type?.startsWith('season_'))  return { icon: '📈', key: 'seasonMilestone' };
  if (type?.startsWith('career_'))  return { icon: '🏆', key: 'careerMilestone' };
  return { icon: '⭐', key: 'milestone' };
}

function formatGameDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  return formatDate(d, { month: 'short', day: 'numeric' });
}

// time_seconds (PWHL) is elapsed time within the period (0 -> 1200),
// matching NHL's own convention — confirmed against real recap data, see
// pwhl_milestones.py. Safe to convert to mm:ss directly; no dependency on
// period length (that only matters for cross-period-boundary math, not a
// plain within-period elapsed display like this one).
function formatElapsed(seconds) {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Build the secondary detail line from milestones.py's `detail` JSONB.
// Every milestone_type has a different shape here — see milestones.py's
// (NHL) / pwhl_milestones.py's (PWHL) detect_* functions for what's
// actually written.
function renderDetailItems(item, t) {
  const d = item.detail || {};
  const items = [];

  if (item.milestone_type === 'natural_hat_trick' && d.goal_periods?.length) {
    d.goal_periods.forEach((p, i) => {
      // NHL: detail.goal_times[i] (already an "mm:ss" string). PWHL:
      // detail.goal_time_seconds[i] (elapsed seconds, formatted here) --
      // same field-name/shape split as the sh_goal branch below. This used
      // to be period-only for PWHL as a deliberate ship decision from when
      // PWHL's time field was still (incorrectly) documented as a
      // countdown of uncertain OT length; now that it's confirmed elapsed
      // (pwhl_milestones.py, corrected 2026-07-04) the same formatElapsed()
      // conversion used for sh_goal applies here too.
      const time = item.is_pwhl ? formatElapsed(d.goal_time_seconds?.[i]) : d.goal_times?.[i];
      items.push(`P${p}${time ? ` ${time}` : ''}`);
    });
  } else if (item.milestone_type === 'hat_trick' && d.goal_count) {
    items.push(t('milestonesFeed.detail.goals', { count: d.goal_count }));
  } else if (item.milestone_type === 'sh_goal') {
    // NHL: detail.period / detail.time_in_period (already an "mm:ss"
    // string). PWHL: detail.period_id / detail.time_seconds (elapsed
    // seconds, formatted here) — different field names because PWHL used
    // to write milestone_type "shorthanded_goal" (a different string from
    // NHL's "sh_goal"), so this whole branch silently never matched PWHL
    // rows at all. Fixed together with the milestone_type rename in
    // pwhl_milestones.py.
    const period = item.is_pwhl ? d.period_id : d.period;
    const time   = item.is_pwhl ? formatElapsed(d.time_seconds) : d.time_in_period;
    if (period) items.push(`P${period}${time ? ` ${time}` : ''}`);
  } else if (item.milestone_type?.startsWith('season_goals_') && d.season_goals != null) {
    items.push(t('milestonesFeed.detail.goalsThisSeason', { count: d.season_goals }));
  } else if (item.milestone_type?.startsWith('season_points_') && d.season_points != null) {
    items.push(t('milestonesFeed.detail.pointsThisSeason', { count: d.season_points }));
  } else if (item.milestone_type?.startsWith('career_points_') && d.career_points != null) {
    items.push(t('milestonesFeed.detail.careerPoints', { count: formatNumber(d.career_points) }));
  } else if (item.milestone_type?.startsWith('career_wins_') && d.career_wins != null) {
    items.push(t('milestonesFeed.detail.careerWins', { count: d.career_wins }));
  }

  return items;
}

// Custom team dropdown — native <select><option> can't render images
// inside options in any browser, so this is a button + popover instead.
function TeamFilterDropdown({ team, onChange, teams, sport }) {
  const { t } = useTranslation();
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

  const selectedTeam = team !== 'all' ? teams.find(tm => tm.abbr === team) : null;

  function pick(abbr) {
    onChange(abbr);
    setOpen(false);
  }

  return (
    <div className={MS_TEAM_SELECT_WRAP_CLASSES} ref={wrapRef}>
      <button
        className={msTeamSelectBtnClasses(team !== 'all')}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selectedTeam ? <TeamLogo abbr={selectedTeam.abbr} sport={sport} size={16} /> : null}
        {selectedTeam ? selectedTeam.abbr : t('milestonesFeed.teamFilter.allTeams')}
      </button>
      {open && (
        <div className={MS_TEAM_MENU_CLASSES} role="listbox">
          <button
            className={msTeamOptionClasses(team === 'all')}
            onClick={() => pick('all')}
            role="option"
            aria-selected={team === 'all'}
          >
            {t('milestonesFeed.teamFilter.allTeams')}
          </button>
          {teams.map(tm => (
            <button
              key={tm.abbr}
              className={msTeamOptionClasses(team === tm.abbr)}
              onClick={() => pick(tm.abbr)}
              role="option"
              aria-selected={team === tm.abbr}
            >
              <TeamLogo abbr={tm.abbr} sport={sport} size={18} />
              {tm.abbr} — {tm.shortName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MilestoneCard({ item, onOpenPlayer }) {
  const { t } = useTranslation();
  const meta = milestoneMeta(item.milestone_type);
  const label = t(`milestonesFeed.type.${meta.key}`);
  const detailItems = renderDetailItems(item, t);
  const tappable = item.player_id != null;

  const handleClick = () => {
    if (!tappable) return;
    capture('milestone_card_clicked', { type: item.milestone_type, team: item.team });
    onOpenPlayer(item.player_id);
  };

  return (
    <article
      className={`${NEWS_CARD_CLASSES} card`}
      onClick={tappable ? handleClick : undefined}
      role={tappable ? 'link' : undefined}
      tabIndex={tappable ? 0 : undefined}
      onKeyDown={tappable ? (e => e.key === 'Enter' && handleClick()) : undefined}
      aria-label={item.description}
    >
      <div className={NEWS_CARD_BODY_CLASSES}>
        <div className={NEWS_CARD_META_CLASSES}>
          <span className={MILESTONE_ICON_BADGE_CLASSES}>{meta.icon} {label}</span>
          <span className={NEWS_CARD_TIME_CLASSES}>{formatGameDate(item.game_date)}</span>
        </div>
        <h3 className={MILESTONE_CARD_TITLE_CLASSES}>
          <TeamLogo abbr={item.team} sport={item.is_pwhl ? 'pwhl' : 'nhl'} size={20} />
          {item.description}
        </h3>
        {item.opponent && (
          <p className={NEWS_CARD_EXCERPT_CLASSES}>{t('milestonesFeed.vsOpponent', { opponent: item.opponent })}</p>
        )}
        {detailItems.length > 0 && (
          <div className={MILESTONE_DETAIL_ROW_CLASSES}>
            {detailItems.map((d, i) => (
              <span key={i} className={MILESTONE_DETAIL_ITEM_CLASSES}>{d}</span>
            ))}
          </div>
        )}
      </div>
      {tappable && <div className={NEWS_CARD_ARROW_CLASSES}>→</div>}
    </article>
  );
}

export default function MilestonesFeed() {
  const { t } = useTranslation();
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
    if (!WORKER_URL) { setError(t('triviaFeed.error.workerNotConfigured')); setLoading(false); return; }
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
      if (!res.ok) throw new Error(t('milestonesFeed.error.notAvailable'));
      const data = await res.json();
      setMilestones(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [t]);

  // Reset the team filter on sport switch — a team abbreviation selected
  // under one sport (e.g. "BOS") isn't guaranteed to mean the same team,
  // or exist at all, under the other.
  useEffect(() => { setTeam('all'); }, [isPWHL]);

  useEffect(() => { fetchMilestones(team, isPWHL); }, [team, isPWHL, fetchMilestones]);

  // Open the sport-appropriate popup.
  // PWHL: PWHLPlayerPopup self-fetches identity + stats by id (GET
  // /pwhl/player/landing) — nothing to pre-fetch here, just pass the id.
  // NHL: PlayerPopup does NOT self-fetch identity (only stats, via
  // getPlayerStats) — it needs a minimum {id, firstName, lastName,
  // teamAbbrev} shape from the caller, so this still fetches /player/landing
  // (proxying api-web.nhle.com — browser can't hit it directly, no CORS
  // headers on their end) and reshapes the response.
  //
  // Confirmed (via two independent NHL API references — nhlapi-tools
  // PyPI package's real usage, and a hosted API doc listing get_landing's
  // response fields) that the landing endpoint's field is
  // currentTeamAbbrev, not teamAbbrev — checked first below, with
  // teamAbbrev kept only as a defensive fallback.
  async function handleOpenPlayer(playerId) {
    if (isPWHL) {
      setPopupPlayer({ player_id: playerId });
      return;
    }
    setPopupLoading(true);
    setPopupError(null);
    try {
      const res = await fetch(`${WORKER_URL}/player/landing?id=${playerId}`);
      if (!res.ok) throw new Error(t('milestonesFeed.error.playerNotAvailable'));
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
    <div className={MILESTONES_FEED_CLASSES}>
      <div className={`${NEWS_HEADER_CLASSES} card`}>
        <div className={NEWS_HEADER_ROW_CLASSES}>
          <div>
            <div className={NEWS_TITLE_CLASSES}>{t('milestonesFeed.header.title')}</div>
            {!loading && (
              <div className={NEWS_UPDATED_CLASSES}>{t('milestonesFeed.header.recentCount', { count: milestones.length })}</div>
            )}
          </div>
          <TeamFilterDropdown team={team} onChange={handleTeamChange} teams={teamList} sport={sportKey} />
        </div>
      </div>

      {popupLoading && (
        <div className={NEWS_UPDATED_CLASSES} style={{ textAlign: 'center', padding: '8px 0' }}>
          {t('milestonesFeed.loadingPlayer')}
        </div>
      )}
      {popupError && (
        <div className={NEWS_ERROR_MSG_CLASSES} style={{ textAlign: 'center', padding: '8px 0' }}>
          {popupError}
        </div>
      )}

      {loading && (
        <div className={NEWS_LOADING_CLASSES}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`${NEWS_SKELETON_CLASSES} card`}>
              <div className={SKEL_BADGE_CLASSES} />
              <div className={SKEL_TITLE_CLASSES} />
              <div className={SKEL_TEXT_CLASSES} />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className={`${NEWS_ERROR_CLASSES} card`}>
          <div className={NEWS_ERROR_ICON_CLASSES}>🏒</div>
          <div className={NEWS_ERROR_MSG_CLASSES}>{error}</div>
          <button className={NEWS_REFRESH_BTN_CLASSES} onClick={() => fetchMilestones(team, isPWHL)}>{t('triviaFeed.error.tryAgain')}</button>
        </div>
      )}

      {!loading && !error && milestones.length === 0 && (
        <div className={`${NEWS_EMPTY_CLASSES} card`}>
          <div className={NEWS_ERROR_ICON_CLASSES}>🏒</div>
          <div>{team !== 'all' ? t('milestonesFeed.emptyStateForTeam', { team }) : t('milestonesFeed.emptyState')}</div>
        </div>
      )}

      {!loading && !error && milestones.length > 0 && (
        <div className={NEWS_FEED_CLASSES}>
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
