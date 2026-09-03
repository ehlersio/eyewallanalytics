// components/Scoreboard.jsx
// Shared across all 4 leagues' LeagueView Scoreboard tab (NHL/PWHL/AHL/ECHL)
// -- the /nhl/today, /pwhl/today, /ahl/today, /echl/today Worker routes all
// return the same normalized shape: [{ gameId, homeTeamCode, awayTeamCode,
// homeScore, awayScore, status: 'pre'|'live'|'final' }]. Mirrors TeamLogo's
// cross-sport design (one component, a `sport` prop resolves team lookup +
// logo per league) rather than 4 near-identical per-sport copies.
import { useTranslation } from 'react-i18next';
import TeamLogo from './TeamLogo';
import { getTeamByAbbr } from '../utils/teamConfig';
import { getPWHLTeamConfig } from '../utils/pwhlConfig';
import { getAHLTeamConfig } from '../utils/ahlConfig';
import { getECHLTeamConfig } from '../utils/echlConfig';
import { SKELETON_CLASSES } from '../utils/skeletonClasses';

const TEAM_LOOKUP = {
  nhl: getTeamByAbbr,
  pwhl: getPWHLTeamConfig,
  ahl: getAHLTeamConfig,
  echl: getECHLTeamConfig,
};

const GRID_CLASSES = 'grid grid-cols-2 gap-2 max-[600px]:grid-cols-1';
const CARD_CLASSES = 'flex flex-col gap-2 py-3 px-3 rounded-[var(--radius)] border-[0.5px] border-[var(--border)] bg-[var(--bg1)]';
const CARD_HEADER_CLASSES = 'flex justify-end';
const TEAM_ROW_CLASSES = 'flex items-center gap-2';
const TEAM_NAME_CLASSES = 'flex-1 text-[13px] font-medium text-[color:var(--text)] whitespace-nowrap overflow-hidden text-ellipsis';
const SCORE_CLASSES = 'text-[15px] font-bold font-[family-name:var(--font-mono)] text-[color:var(--text)] min-w-[20px] text-right';
const SCORE_MUTED_CLASSES = 'text-[15px] font-bold font-[family-name:var(--font-mono)] text-[color:var(--text-dim)] min-w-[20px] text-right';

const BADGE_BASE_CLASSES = 'inline-flex items-center gap-[5px] py-[2px] px-2 rounded-[20px] text-[10px] font-bold tracking-[0.03em]';
const BADGE_LIVE_CLASSES = `${BADGE_BASE_CLASSES} bg-[var(--red-dim)] text-[color:var(--red-bright)] border-[0.5px] border-[color:var(--red-border)]`;
const BADGE_FINAL_CLASSES = `${BADGE_BASE_CLASSES} bg-[var(--bg2)] text-[color:var(--text-dim)]`;
const BADGE_PRE_CLASSES = `${BADGE_BASE_CLASSES} bg-[var(--bg2)] text-[color:var(--text-muted)]`;
const LIVE_DOT_CLASSES = 'w-[6px] h-[6px] rounded-full bg-[color:var(--red-bright)] animate-pulse';

const EMPTY_CLASSES = 'py-8 text-center text-[13px] text-[color:var(--text-dim)]';
const ERROR_CLASSES = 'py-8 text-center text-[13px] text-[color:var(--red-bright)]';

function StatusBadge({ status }) {
  const { t } = useTranslation();
  if (status === 'live') {
    return (
      <span className={BADGE_LIVE_CLASSES}>
        <span className={LIVE_DOT_CLASSES} />
        {t('league.scoreboard.statusLive')}
      </span>
    );
  }
  if (status === 'final') {
    return <span className={BADGE_FINAL_CLASSES}>{t('league.scoreboard.statusFinal')}</span>;
  }
  return <span className={BADGE_PRE_CLASSES}>{t('league.scoreboard.statusPre')}</span>;
}

function TeamRow({ code, score, status, sport, isLoser }) {
  const team = TEAM_LOOKUP[sport]?.(code);
  const showScore = status !== 'pre';
  return (
    <div className={TEAM_ROW_CLASSES}>
      <TeamLogo abbr={code} sport={sport} size={22} />
      <span className={TEAM_NAME_CLASSES}>{team?.shortName || code || '—'}</span>
      {showScore && (
        <span className={isLoser ? SCORE_MUTED_CLASSES : SCORE_CLASSES}>{score ?? 0}</span>
      )}
    </div>
  );
}

function LoadingRows() {
  return (
    <div className={GRID_CLASSES}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} className={SKELETON_CLASSES} style={{ height: 76, borderRadius: 10 }} />
      ))}
    </div>
  );
}

/**
 * Scoreboard — every game scheduled today for one league.
 * Props:
 *   sport   — 'nhl' | 'pwhl' | 'ahl' | 'echl'
 *   games   — [{ gameId, homeTeamCode, awayTeamCode, homeScore, awayScore, status }]
 *   loading, error
 */
export default function Scoreboard({ sport, games, loading, error }) {
  const { t } = useTranslation();

  if (loading) return <LoadingRows />;
  if (error) return <div className={ERROR_CLASSES}>{t('league.scoreboard.error')}</div>;
  if (!games?.length) return <div className={EMPTY_CLASSES}>{t('league.scoreboard.empty')}</div>;

  return (
    <div className={GRID_CLASSES}>
      {games.map(g => {
        const homeLower = g.status === 'final' && (g.homeScore ?? 0) < (g.awayScore ?? 0);
        const awayLower = g.status === 'final' && (g.awayScore ?? 0) < (g.homeScore ?? 0);
        return (
          <div key={g.gameId} className={CARD_CLASSES}>
            <div className={CARD_HEADER_CLASSES}>
              <StatusBadge status={g.status} />
            </div>
            <TeamRow code={g.awayTeamCode} score={g.awayScore} status={g.status} sport={sport} isLoser={awayLower} />
            <TeamRow code={g.homeTeamCode} score={g.homeScore} status={g.status} sport={sport} isLoser={homeLower} />
          </div>
        );
      })}
    </div>
  );
}
