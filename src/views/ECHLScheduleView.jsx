// views/ECHLScheduleView.jsx
// Mirrors AHLScheduleView's foundation-pass shape (before that file later
// grew calendar view + game popups + prediction tracking in a follow-up
// parity pass) -- a plain chronological game-card list only. No calendar
// toggle, no box-score/preview popups, no prediction tracking this pass
// -- deferred to a later follow-up, matching AHL's own two-pass history.
import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate as formatDateIntl } from '../utils/formatters';
import { useFetch } from '../hooks/useFetch';
import { fetchECHLSchedule, ECHL_TEAM_CONFIG, ECHL_TEAM_ID } from '../utils/echlApi';
import { ECHL_CURRENT_SEASON, ECHL_TEAM_BY_ID, ECHL_SEASONS, getECHLTeamById } from '../utils/echlConfig';
import TeamLogo from '../components/TeamLogo';
import { PAGE_CLASSES } from '../utils/pageClasses';
import { SKELETON_CLASSES } from '../utils/skeletonClasses';

const HEADER_WRAP_CLASSES = 'mb-[14px]';
const VIEW_TITLE_CLASSES = 'font-[family-name:var(--font-display)] text-[20px] font-bold flex items-center gap-2 mb-[2px]';
const SUB_CLASSES = 'text-[12px] text-[color:var(--text-muted)]';
const EMPTY_STATE_CLASSES = 'text-center py-8 text-[13px] text-[color:var(--text-dim)]';
const TABS_WRAP_CLASSES = 'flex border-b-[0.5px] border-[var(--border)] mx-[-14px] mb-[14px] px-[14px]';
const TAB_BASE_CLASSES = 'flex-1 py-[10px] text-[13px] font-semibold bg-transparent border-0 border-b-2 cursor-pointer [transition:all_0.15s]';
const TAB_INACTIVE_CLASSES = 'text-[color:var(--text-muted)] border-b-transparent';
const TAB_ACTIVE_CLASSES = 'text-[color:var(--red-bright)] border-b-[var(--red-bright)]';
function tabClasses(isActive) {
  return `${TAB_BASE_CLASSES} ${isActive ? TAB_ACTIVE_CLASSES : TAB_INACTIVE_CLASSES}`;
}

function dayOfWeek(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return formatDateIntl(d, { weekday: 'short' });
}
function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  if (Number.isNaN(d.getTime())) return dateStr;
  return formatDateIntl(d, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export default function ECHLScheduleView() {
  const { t } = useTranslation();
  const team = ECHL_TEAM_CONFIG;
  const teamId = ECHL_TEAM_ID;
  const abbr = team?.abbr || '—';

  const [season, setSeason] = useState(ECHL_CURRENT_SEASON);

  const userPickedSeason = useRef(false);
  useEffect(() => {
    function handleSeasonUpdate(e) { if (!userPickedSeason.current) setSeason(e.detail); }
    window.addEventListener('eyewall:echl-season-updated', handleSeasonUpdate);
    return () => window.removeEventListener('eyewall:echl-season-updated', handleSeasonUpdate);
  }, []);

  const { data, loading } = useFetch(
    () => teamId ? fetchECHLSchedule(teamId, season) : Promise.resolve(null),
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
          {t('nav.schedule')}
        </h2>
        <p className={SUB_CLASSES}>{ECHL_TEAM_BY_ID[teamId]?.displayName}</p>
      </div>

      <div className={TABS_WRAP_CLASSES}>
        {ECHL_SEASONS.map(s => (
          <button key={s.id} className={tabClasses(season === s.id)}
            onClick={() => { userPickedSeason.current = true; setSeason(s.id); }}>{s.label}</button>
        ))}
      </div>

      {loading && <LoadingCards count={8} />}
      {!loading && games.length === 0 && (
        <div className={EMPTY_STATE_CLASSES}>{t('echlScheduleView.empty')}</div>
      )}
      {!loading && games.length > 0 && games.map((g) => (
        <GameCard key={g.game_id} game={g} teamId={teamId} abbr={abbr} />
      ))}
    </div>
  );
}

function GameCard({ game: g, teamId, abbr }) {
  const { t } = useTranslation();
  const isHome = g.home_team_id === teamId;
  const oppId = isHome ? g.away_team_id : g.home_team_id;
  const oppAbbr = getECHLTeamById(oppId)?.abbr || String(oppId);
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
        <TeamLogo abbr={abbr} sport="echl" size={20} />
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
        <TeamLogo abbr={oppAbbr} sport="echl" size={20} />
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
