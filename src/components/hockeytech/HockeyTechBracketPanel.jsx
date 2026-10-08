// components/hockeytech/HockeyTechBracketPanel.jsx
// AHL/ECHL League › Bracket (contract C11): the Calder Cup / Kelly Cup
// bracket from HockeyTech's own bracket feed (/{league}/bracket), or, before
// this year's playoffs, "If the playoffs started today" from the standings
// (/{league}/bracket/projected: seeds and matchups only), or a short note
// when there's no projection to show (utils/hockeyTechBracket.js
// bracketTabState). HockeyTechLeagueView reads both routes (they decide
// whether the tab is offered) and passes the state in.
//
// The PWHL bracket tab's look (PWHLLeagueView BktSeriesCard and series
// modal): one column per round, a card per series with seeds and win dots,
// the followed team's series outlined, and a tap on a series with games
// opens them. The class constants are PWHLLeagueView's, duplicated per the
// per-file convention.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../utils/formatters';
import { leagueNameVars } from '../../utils/hockeyTechI18n';
import { gameSuffix, seriesStanding, winsNeeded } from '../../utils/hockeyTechBracket';

const BKT_CARD_BASE_CLASSES = 'bkt-card w-full rounded-[var(--radius-sm)] p-[6px_8px] box-border';
const BKT_CARD_DEFAULT_CLASSES = 'bg-[var(--bg1)] border-[0.5px] border-[var(--border)]';
const BKT_CARD_PRIMARY_CLASSES = 'bkt-card--primary bg-[var(--bg2)] border';
const BKT_CARD_CLICKABLE_CLASSES = 'bkt-card--clickable cursor-pointer [transition:background_0.12s_ease,border-color_0.12s_ease] hover:bg-[rgba(255,255,255,0.06)] focus-visible:outline focus-visible:outline-[1.5px] focus-visible:outline-[var(--red-bright)] focus-visible:outline-offset-[1px]';
const BKT_ROOT_CLASSES = 'bkt-root w-full overflow-x-auto pb-2';
const BKT_BRACKET_CLASSES = 'bkt-bracket flex items-stretch gap-3';
const BKT_ROUND_COL_CLASSES = 'bkt-round-col flex-1 flex flex-col min-w-[112px]';
const BKT_ROUND_LABEL_CLASSES = 'bkt-round-label text-[10px] font-bold text-[color:var(--text-dim)] uppercase tracking-[0.07em] text-center px-1 mb-2 whitespace-nowrap font-[family-name:var(--font-display)]';
const BKT_ROUND_SERIES_CLASSES = 'flex flex-col flex-1 justify-around gap-[6px]';
const BKT_TEAM_ROW_CLASSES = 'bkt-team-row flex items-center gap-[6px] py-[2px]';
const BKT_ABBR_BASE_CLASSES = 'bkt-abbr font-[family-name:var(--font-display)] text-[11px] font-bold text-[color:var(--text)] min-w-[28px] tracking-[0.02em]';
const BKT_DOTS_CLASSES = 'bkt-dots flex gap-[3px]';
const BKT_DOT_CLASSES = 'bkt-dot w-[7px] h-[7px] rounded-full border border-[var(--border-2)] bg-transparent shrink-0';
const BKT_SEED_CLASSES = 'bkt-seed text-[9px] font-semibold text-[color:var(--text-dim)]';
const BKT_SERIES_LABEL_CLASSES = 'bkt-series-label text-[9px] text-[color:var(--text-dim)] mt-[3px] whitespace-nowrap overflow-hidden text-ellipsis';
const BKT_PROJECTED_NOTE_CLASSES = 'bkt-projected-note text-[11px] leading-[1.45] text-[color:var(--text-dim)] mb-3';
const BKT_PROJECTED_TITLE_CLASSES = 'bkt-projected-title font-[family-name:var(--font-display)] text-[14px] font-bold text-[color:var(--text)] mb-0.5';
const BKT_NOTE_CLASSES = 'hockeytech-bracket-note py-8 px-4 text-center text-[13px] leading-[1.5] text-[color:var(--text-dim)]';
const BKT_FOOT_CLASSES = 'text-[10px] text-[color:var(--text-dim)] mt-2';

const SERIES_MODAL_CLASSES = 'series-modal bg-[var(--bg1)] border-[0.5px] border-[var(--border-2)] rounded-[var(--radius)] p-0 w-[min(420px,92vw)] max-h-[80vh] overflow-y-auto relative max-[600px]:w-[calc(100vw-32px)] max-[600px]:max-h-[85vh]';
const SERIES_MODAL_HEADER_CLASSES = 'series-modal__header flex flex-col items-center gap-[6px] pt-5 px-12 pb-3 border-b-[0.5px] border-[var(--border)] relative';
const SERIES_MODAL_ROUND_CLASSES = 'text-[10px] font-bold uppercase tracking-[0.07em] text-[color:var(--text-dim)]';
const SERIES_MODAL_ABBREV_CLASSES = 'series-modal__abbrev font-[family-name:var(--font-display)] text-[22px] font-extrabold tracking-[0.02em] min-w-[44px] text-center';
const SERIES_MODAL_RESULT_CLASSES = 'text-[13px] font-semibold text-[color:var(--text-muted)]';
const SERIES_MODAL_GAMES_CLASSES = 'series-modal__games p-[12px_16px_16px] flex flex-col gap-1';
const SERIES_MODAL_GAME_ROW_CLASSES = 'series-modal__game-row grid [grid-template-columns:24px_52px_1fr_16px_1fr_28px] items-center gap-1 p-[7px_8px] rounded-[6px] text-[13px] even:bg-[rgba(255,255,255,0.03)]';
const SERIES_MODAL_SCORE_BASE_CLASSES = 'series-modal__score font-[family-name:var(--font-mono)] text-[15px] min-w-[18px] text-center';
const CLOSE_CLASSES = 'pp-close absolute top-3 right-3 w-[28px] h-[28px] rounded-full bg-[var(--bg3)] text-[color:var(--text-muted)] text-[12px] flex items-center justify-center hover:bg-[var(--bg4)] hover:text-[color:var(--text)]';

function WinDots({ wins, color, count }) {
  return (
    <span className={BKT_DOTS_CLASSES}>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className={BKT_DOT_CLASSES} style={i < wins && color ? { background: color, borderColor: color } : undefined} />
      ))}
    </span>
  );
}

function SeriesCard({ league, series, need, projected, myTeamId, myColor, onOpen }) {
  const { t } = useTranslation();
  const team = id => league.config.getTeamById(id);
  const side = s => ({ abbr: team(s?.teamId)?.abbr || (s?.teamId ? String(s.teamId) : t('hockeyTechLeagueView.bracket.tbd')), color: team(s?.teamId)?.displayColor });
  const top = side(series.top), bottom = side(series.bottom);
  const standing = seriesStanding(series, need);
  const out = id => standing.kind === 'wins' && standing.teamId !== id;
  const hasGames = (series.games || []).length > 0;
  const isMine = series.top?.teamId === myTeamId || series.bottom?.teamId === myTeamId;
  const started = (series.top?.wins ?? 0) + (series.bottom?.wins ?? 0) > 0;
  const label = standing.kind === 'tied'
    ? t('league.bracket.tied', { score: standing.score })
    : t(`league.bracket.${standing.kind}`, { team: team(standing.teamId)?.abbr || '', score: standing.score });

  const row = (s, view) => (
    <div className={BKT_TEAM_ROW_CLASSES}>
      {s?.seed != null && <span className={BKT_SEED_CLASSES}>{s.seed}</span>}
      <span className={`${BKT_ABBR_BASE_CLASSES} ${out(s?.teamId) ? 'bkt-abbr--dim opacity-30' : ''}`}
        style={!out(s?.teamId) && view.color ? { color: view.color } : undefined}>{view.abbr}</span>
      {!projected && <WinDots wins={s?.wins ?? 0} color={view.color} count={need} />}
    </div>
  );

  return (
    <div
      className={`${BKT_CARD_BASE_CLASSES} ${isMine ? BKT_CARD_PRIMARY_CLASSES : BKT_CARD_DEFAULT_CLASSES}${hasGames ? ` ${BKT_CARD_CLICKABLE_CLASSES}` : ''}`}
      style={isMine ? { borderColor: myColor } : undefined}
      onClick={hasGames ? onOpen : undefined}
      role={hasGames ? 'button' : undefined}
      tabIndex={hasGames ? 0 : undefined}
      onKeyDown={hasGames ? (e => e.key === 'Enter' && onOpen()) : undefined}
    >
      {row(series.top, top)}
      {row(series.bottom, bottom)}
      {!projected && (started || standing.kind === 'wins') && <div className={BKT_SERIES_LABEL_CLASSES}>{label}</div>}
    </div>
  );
}

function SeriesModal({ league, round, series, need, onClose }) {
  const { t } = useTranslation();
  const team = id => league.config.getTeamById(id);
  const abbr = id => team(id)?.abbr || String(id ?? '?');
  const standing = seriesStanding(series, need);
  const games = (series.games || []).filter(g => g.homeScore != null && g.awayScore != null);
  return (
    <div className="popup-backdrop popup-backdrop--centered" onClick={onClose}>
      <div className={SERIES_MODAL_CLASSES} onClick={e => e.stopPropagation()}>
        <div className={SERIES_MODAL_HEADER_CLASSES}>
          <button className={CLOSE_CLASSES} onClick={onClose} aria-label={t('common.close')}>✕</button>
          <div className={SERIES_MODAL_ROUND_CLASSES}>{round.name}</div>
          <div className="flex items-center gap-3">
            <span className={SERIES_MODAL_ABBREV_CLASSES} style={{ color: team(series.top?.teamId)?.displayColor }}>{abbr(series.top?.teamId)}</span>
            <span className="text-[11px] text-[color:var(--text-dim)]">{series.top?.wins ?? 0}–{series.bottom?.wins ?? 0}</span>
            <span className={SERIES_MODAL_ABBREV_CLASSES} style={{ color: team(series.bottom?.teamId)?.displayColor }}>{abbr(series.bottom?.teamId)}</span>
          </div>
          {standing.kind === 'wins' && (
            <div className={SERIES_MODAL_RESULT_CLASSES}>{t('pwhlLeagueView.bracket.modalWinsSeries', { team: abbr(standing.teamId) })}</div>
          )}
        </div>
        <div className={SERIES_MODAL_GAMES_CLASSES}>
          {games.map((g, i) => {
            const homeWon = g.homeScore > g.awayScore;
            return (
              <div key={g.gameId ?? i} className={SERIES_MODAL_GAME_ROW_CLASSES}>
                <span className="text-[10px] font-bold text-[color:var(--text-dim)]">G{i + 1}</span>
                <span className="text-[11px] text-[color:var(--text-dim)]">{g.date ? formatDate(new Date(g.date), { month: 'short', day: 'numeric' }) : '—'}</span>
                <div className="flex items-center gap-[6px] justify-start">
                  <span className="font-[family-name:var(--font-display)] text-[12px]" style={{ color: team(g.home)?.displayColor }}>{abbr(g.home)}</span>
                  <span className={`${SERIES_MODAL_SCORE_BASE_CLASSES} ${homeWon ? 'font-extrabold text-[color:var(--text)]' : 'font-medium text-[color:var(--text-muted)]'}`}>{g.homeScore}</span>
                </div>
                <span className="text-[color:var(--text-dim)] text-center">–</span>
                <div className="flex items-center gap-[6px] justify-end">
                  <span className={`${SERIES_MODAL_SCORE_BASE_CLASSES} ${!homeWon ? 'font-extrabold text-[color:var(--text)]' : 'font-medium text-[color:var(--text-muted)]'}`}>{g.awayScore}</span>
                  <span className="font-[family-name:var(--font-display)] text-[12px]" style={{ color: team(g.away)?.displayColor }}>{abbr(g.away)}</span>
                </div>
                <span className="text-[10px] font-bold text-[color:var(--text-dim)] text-right">{gameSuffix(g.status)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// state: bracketTabState()'s { mode, bracket, reason }.
export default function HockeyTechBracketPanel({ league, state }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(null); // { round, series, need }
  const vars = leagueNameVars(t, league);
  const myTeamId = league.teamId;
  const myColor = league.config.getTeamById(myTeamId)?.displayColor || 'var(--team-primary)';

  if (state.mode === 'note') {
    return (
      <div className={BKT_NOTE_CLASSES}>
        {t(state.reason === 'no-games' ? 'hockeyTechLeagueView.bracket.noGames' : 'hockeyTechLeagueView.bracket.formatUnverified', vars)}
      </div>
    );
  }
  const { bracket } = state;
  const projected = state.mode === 'projected';
  const byes = projected ? bracket.byes || [] : [];

  return (
    <div className="hockeytech-bracket">
      {projected ? (
        <div className={BKT_PROJECTED_NOTE_CLASSES}>
          <div className={BKT_PROJECTED_TITLE_CLASSES}>{t('pwhlLeagueView.bracket.ifStartedToday')}</div>
          {t('hockeyTechLeagueView.bracket.projectedNote', { date: formatDate(new Date(), { month: 'short', day: 'numeric' }) })}
        </div>
      ) : bracket.format?.label && (
        <div className={BKT_PROJECTED_TITLE_CLASSES} style={{ marginBottom: 8 }}>{bracket.format.label}</div>
      )}

      <div className={BKT_ROOT_CLASSES}>
        <div className={BKT_BRACKET_CLASSES} style={{ minWidth: Math.max(1, bracket.rounds.length) * 124 }}>
          {bracket.rounds.map(round => (
            <div key={round.name} className={BKT_ROUND_COL_CLASSES}>
              <div className={BKT_ROUND_LABEL_CLASSES}>{round.name}</div>
              <div className={BKT_ROUND_SERIES_CLASSES}>
                {round.series.map(s => {
                  const need = winsNeeded(round.bestOf, s);
                  return (
                    <SeriesCard key={s.id} league={league} series={s} need={need} projected={projected}
                      myTeamId={myTeamId} myColor={myColor} onOpen={() => setOpen({ round, series: s, need })} />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {byes.length > 0 && (
        <div className={`hockeytech-bracket-byes ${BKT_FOOT_CLASSES}`}>
          {t('hockeyTechLeagueView.bracket.byes', {
            teams: byes.map(b => `${league.config.getTeamById(b.teamId)?.abbr || b.teamId} (${b.seed})`).join(', '),
          })}
        </div>
      )}
      {bracket.format?.bestOf?.length > 0 && (
        <div className={`hockeytech-bracket-format ${BKT_FOOT_CLASSES}`}>
          {t('hockeyTechLeagueView.bracket.bestOf', { rounds: bracket.format.bestOf.join(' · ') })}
        </div>
      )}

      {open && <SeriesModal league={league} round={open.round} series={open.series} need={open.need} onClose={() => setOpen(null)} />}
    </div>
  );
}
