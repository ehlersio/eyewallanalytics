// views/AHLScheduleView.jsx
// A deliberately simpler schedule view than PWHLScheduleView/ScheduleView --
// a plain chronological game list, no calendar grid, no game popups, no
// prediction tracking, no odds. Those all depend on infrastructure not
// built for AHL in this pass (game-stats/preview popups, a prediction
// store, live tracking) -- see AHL_BUILD_BRIEF.md's scope notes. Can grow
// into the fuller pattern later if AHL gets that infrastructure.
import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../utils/formatters';
import { useFetch } from '../hooks/useFetch';
import { fetchAHLSchedule, AHL_TEAM_CONFIG, AHL_TEAM_ID } from '../utils/ahlApi';
import { AHL_CURRENT_SEASON, AHL_TEAM_BY_ID, getAHLTeamById } from '../utils/ahlConfig';
import TeamLogo from '../components/TeamLogo';
import { PAGE_CLASSES } from '../utils/pageClasses';
import { SKELETON_CLASSES } from '../utils/skeletonClasses';

const HEADER_WRAP_CLASSES = 'mb-[14px]';
const VIEW_TITLE_CLASSES = 'font-[family-name:var(--font-display)] text-[20px] font-bold flex items-center gap-2 mb-[2px]';
const SUB_CLASSES = 'text-[12px] text-[color:var(--text-muted)]';
const EMPTY_STATE_CLASSES = 'text-center py-8 text-[13px] text-[color:var(--text-dim)]';

function dayOfWeek(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(d);
}

export default function AHLScheduleView() {
  const { t } = useTranslation();
  const team = AHL_TEAM_CONFIG;
  const teamId = AHL_TEAM_ID;
  const abbr = team?.abbr || '—';

  // Same live-season-update race/fix as the other AHL views -- see
  // AHLShotMapView.jsx's comment.
  const [season, setSeason] = useState(AHL_CURRENT_SEASON);
  useEffect(() => {
    function handleSeasonUpdate(e) { setSeason(e.detail); }
    window.addEventListener('eyewall:ahl-season-updated', handleSeasonUpdate);
    return () => window.removeEventListener('eyewall:ahl-season-updated', handleSeasonUpdate);
  }, []);

  const { data, loading } = useFetch(
    () => teamId ? fetchAHLSchedule(teamId, season) : Promise.resolve(null),
    [teamId, season]
  );

  const games = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => new Date(a.game_date) - new Date(b.game_date));
  }, [data]);

  if (!abbr || !teamId) {
    return (
      <div className={PAGE_CLASSES}>
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ color: 'var(--text-dim)' }}>{t('ahlPlayersView.noTeamSelected')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE_CLASSES}>
      <div className={HEADER_WRAP_CLASSES}>
        <h2 className={VIEW_TITLE_CLASSES}>
          <TeamLogo abbr={abbr} sport="ahl" size={22} />
          {t('nav.schedule')}
        </h2>
        <p className={SUB_CLASSES}>{AHL_TEAM_BY_ID[teamId]?.displayName}</p>
      </div>

      {loading && <LoadingCards count={8} />}
      {!loading && games.length === 0 && (
        <div className={EMPTY_STATE_CLASSES}>{t('ahlScheduleView.empty')}</div>
      )}
      {!loading && games.map((g) => (
        <GameCard key={g.game_id} game={g} teamId={teamId} abbr={abbr} />
      ))}
    </div>
  );
}

function GameCard({ game: g, teamId, abbr }) {
  const { t } = useTranslation();
  const isHome = g.home_team_id === teamId;
  const oppId = isHome ? g.away_team_id : g.home_team_id;
  const oppAbbr = getAHLTeamById(oppId)?.abbr || String(oppId);
  const isFinal = g.game_state === 'Final';
  const my = isHome ? g.home_score : g.away_score;
  const op = isHome ? g.away_score : g.home_score;
  const won = isFinal && my > op;

  return (
    <div className="card mb-2" style={{ padding: '12px 14px' }}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[11px] text-[color:var(--text-muted)]">{dayOfWeek(g.game_date)} {formatDate(g.game_date)}</span>
        {isFinal && (
          <span className={`font-[family-name:var(--font-display)] text-[12px] font-bold py-[2px] px-2 rounded ${won ? 'bg-[rgba(61,186,126,0.15)] text-[color:var(--green)]' : 'bg-[rgba(255,68,34,0.1)] text-[color:var(--red-bright)]'}`}>
            {won ? 'W' : 'L'}
          </span>
        )}
        <span className="text-[10px] text-[color:var(--text-dim)] ml-auto">{g.venue_name}</span>
      </div>
      <div className="flex items-center gap-2 font-[family-name:var(--font-display)]">
        <TeamLogo abbr={abbr} sport="ahl" size={20} />
        <span className="text-[16px] font-bold">{abbr}</span>
        {isFinal ? (
          <>
            <span className="text-[22px] font-bold">{my ?? '—'}</span>
            <span className="text-[color:var(--text-dim)]">–</span>
            <span className="text-[22px] font-bold text-[color:var(--text-muted)]">{op ?? '—'}</span>
          </>
        ) : (
          <span className="text-[14px] text-[color:var(--text-dim)]">{isHome ? t('scheduleView.resultCard.home') : 'vs'}</span>
        )}
        <span className="text-[16px] font-bold text-[color:var(--text-muted)]">{oppAbbr}</span>
        <TeamLogo abbr={oppAbbr} sport="ahl" size={20} />
      </div>
    </div>
  );
}

function LoadingCards({ count }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className="card mb-2" style={{ padding: 14 }}>
      <div className={SKELETON_CLASSES} style={{ height: 10, width: '40%', marginBottom: 12 }} />
      <div className={SKELETON_CLASSES} style={{ height: 20, width: '70%' }} />
    </div>
  ));
}
