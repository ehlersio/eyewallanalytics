// views/ECHLShotMapView.jsx
// A deliberately leaner shot map than PWHLShotMapView (2300+ lines) --
// season-aggregate rink + PP/PK summary, not a per-game live-tracking or
// history-browsing view. Mirrors AHLShotMapView.jsx's own foundation-pass
// shape (before that file later grew live-game tracking in a follow-up
// parity pass) -- same real, confirmed reasons for the smaller scope:
//   - No blocked_shot event type exists in ECHL's data at all -- so no
//     Corsi/Fenwick/PDO panels anywhere in this file, only real shots-on-
//     goal + goals (matches echl_shot_events' actual event_type values).
//   - No ECHLPlayerPopup equivalent built -- shot markers don't open a
//     player profile on click.
//   - No live-game tracking this pass -- deferred to a later parity pass,
//     matching AHL's own two-pass history.
// PP/PK summary numbers come straight from echl_team_seasons (via
// /echl/team-season-summary), which the pipeline already populates from
// HockeyTech's own special-teams view -- not derived from PBP here.
import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetch } from '../hooks/useFetch';
import { fetchECHLShots, fetchECHLRoster, fetchECHLTeamSeasonSummary, ECHL_TEAM_CONFIG, ECHL_TEAM_ID } from '../utils/echlApi';
import { ECHL_CURRENT_SEASON, ECHL_SEASONS } from '../utils/echlConfig';
import { HockeyRink } from 'react-hockey-rink';
import { toHockeyRinkEvents } from '../utils/hockeyRinkEvents';
import TeamLogo from '../components/TeamLogo';
import { MetCard } from '../components/StatBar';
import { PAGE_CLASSES } from '../utils/pageClasses';
import { SKELETON_CLASSES } from '../utils/skeletonClasses';

const HEADER_WRAP_CLASSES = 'mb-[14px]';
const VIEW_TITLE_CLASSES = 'font-[family-name:var(--font-display)] text-[20px] font-bold flex items-center gap-2 mb-[2px]';
const SUB_CLASSES = 'text-[12px] text-[color:var(--text-muted)]';
const RINK_CARD_CLASSES = 'card mb-3 p-2';
const METRICS_GRID_CLASSES = 'grid grid-cols-3 gap-2 mb-3';
const TABS_WRAP_CLASSES = 'flex border-b-[0.5px] border-[var(--border)] mx-[-14px] mb-[14px] px-[14px]';
const TAB_BASE_CLASSES = 'flex-1 py-[10px] text-[13px] font-semibold bg-transparent border-0 border-b-2 cursor-pointer [transition:all_0.15s]';
const TAB_INACTIVE_CLASSES = 'text-[color:var(--text-muted)] border-b-transparent';
const TAB_ACTIVE_CLASSES = 'text-[color:var(--red-bright)] border-b-[var(--red-bright)]';
function tabClasses(isActive) {
  return `${TAB_BASE_CLASSES} ${isActive ? TAB_ACTIVE_CLASSES : TAB_INACTIVE_CLASSES}`;
}

function mapEventType(evType) {
  return evType === 'goal' ? 'goal' : 'shot-on-goal';
}

// Mirrors AHLShotMapView.jsx's adaptShot() fold exactly -- same
// coordinate convention (same transform_coords() in the pipeline, copied
// verbatim from AHL's/PWHL's), same reasoning for folding negative-x
// onto the positive side for a consistent single-attacking-zone rink
// display.
function adaptShot(row, playerMap) {
  const secs = row.time_seconds || 0;
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  let x = parseFloat(row.x_norm);
  let y = parseFloat(row.y_norm);
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  if (x < 0) { x = -x; y = -y; }
  x = Math.min(x, 99);
  y = Math.max(-42, Math.min(42, y));
  return {
    id: row.id, x, y,
    type: mapEventType(row.event_type),
    isCanes: true,
    period: row.period_id,
    timeInPeriod: `${mm}:${ss}`,
    shooterName: playerMap[row.shooter_id] || null,
    gameId: row.game_id,
    shotType: row.shot_type || null,
  };
}

export default function ECHLShotMapView() {
  const { t } = useTranslation();
  const team = ECHL_TEAM_CONFIG;
  const teamId = ECHL_TEAM_ID;
  const abbr = team?.abbr || '—';

  const [season, setSeason] = useState(ECHL_CURRENT_SEASON);

  // useState's initial value only runs once, at first mount -- if this
  // component mounts before echlConfig.js's async live-season fetch
  // resolves, `season` would otherwise permanently lock onto whatever
  // fallback seed was current at that instant. Same fix
  // AHLShotMapView.jsx/PWHLPlayersView.jsx already apply for the
  // identical race, see those files' comments.
  const userPickedSeason = useRef(false);
  useEffect(() => {
    function handleSeasonUpdate(e) {
      if (!userPickedSeason.current) setSeason(e.detail);
    }
    window.addEventListener('eyewall:echl-season-updated', handleSeasonUpdate);
    return () => window.removeEventListener('eyewall:echl-season-updated', handleSeasonUpdate);
  }, []);

  function handleSeasonPick(id) {
    userPickedSeason.current = true;
    setSeason(id);
  }

  const { data: shots, loading: shotsLoading } = useFetch(
    () => teamId ? fetchECHLShots(teamId, season) : Promise.resolve(null),
    [teamId, season]
  );
  const { data: roster } = useFetch(
    () => teamId ? fetchECHLRoster(teamId) : Promise.resolve(null),
    [teamId]
  );
  const { data: summary, loading: summaryLoading } = useFetch(
    () => teamId ? fetchECHLTeamSeasonSummary(teamId, season) : Promise.resolve(null),
    [teamId, season]
  );

  const playerMap = useMemo(() => {
    const map = {};
    for (const p of roster || []) {
      map[p.player_id] = `${p.first_name || ''} ${p.last_name || ''}`.trim();
    }
    return map;
  }, [roster]);

  const rinkEvents = useMemo(() => {
    if (!shots) return [];
    return shots.map(r => adaptShot(r, playerMap)).filter(Boolean);
  }, [shots, playerMap]);

  const goals = useMemo(() => (shots || []).filter(s => s.event_type === 'goal').length, [shots]);
  const shotsOnGoal = useMemo(() => (shots || []).length, [shots]);

  if (!abbr || !teamId) {
    return (
      <div className={PAGE_CLASSES}>
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ color: 'var(--text-dim)' }}>{t('echlPlayersView.noTeamSelected')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE_CLASSES}>
      <div className={HEADER_WRAP_CLASSES}>
        <h2 className={VIEW_TITLE_CLASSES}>
          <TeamLogo abbr={abbr} sport="echl" size={22} />
          {t('nav.shotMap')}
        </h2>
        <p className={SUB_CLASSES}>{t('echlShotMapView.subtitle')}</p>
      </div>

      <div className={TABS_WRAP_CLASSES} style={{ marginTop: 0 }}>
        {ECHL_SEASONS.map(s => (
          <button key={s.id} className={tabClasses(season === s.id)} onClick={() => handleSeasonPick(s.id)}>{s.label}</button>
        ))}
      </div>

      <div className={METRICS_GRID_CLASSES}>
        <MetCard label={t('echlShotMapView.goals')} value={shotsLoading ? '—' : goals} />
        <MetCard label={t('echlShotMapView.shotsOnGoal')} value={shotsLoading ? '—' : shotsOnGoal} />
        <MetCard
          label={t('echlShotMapView.ppPct')}
          value={summaryLoading || summary?.ppPct == null ? '—' : `${(summary.ppPct * 100).toFixed(1)}%`}
        />
      </div>

      <div className={METRICS_GRID_CLASSES}>
        <MetCard
          label={t('echlShotMapView.pkPct')}
          value={summaryLoading || summary?.pkPct == null ? '—' : `${(summary.pkPct * 100).toFixed(1)}%`}
        />
        <MetCard
          label={t('echlShotMapView.sogFor')}
          value={summaryLoading ? '—' : summary?.sog?.car ?? '—'}
        />
        <MetCard
          label={t('echlShotMapView.sogAgainst')}
          value={summaryLoading ? '—' : summary?.sog?.opp ?? '—'}
        />
      </div>

      <div className={RINK_CARD_CLASSES}>
        {shotsLoading ? (
          <div className={SKELETON_CLASSES} style={{ height: 280, width: '100%', borderRadius: 8 }} />
        ) : rinkEvents.length > 0 ? (
          <HockeyRink events={toHockeyRinkEvents(rinkEvents)} teamAbbr={abbr} />
        ) : (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-dim)', fontSize: 13 }}>
            {t('echlShotMapView.noShots')}
          </div>
        )}
      </div>

      <p style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: '8px 0' }}>
        {t('echlPlayersView.footerHintSource')}
      </p>
    </div>
  );
}
