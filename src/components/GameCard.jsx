import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  isHomeGame, getOpponent, getCarScore, getOppScore,
  formatGameDate, formatGameTime, TEAM_COLORS, TEAM_CONFIG,
} from '../utils/nhlApi';
import TeamLogo from '../components/TeamLogo';
import { fmtOdds } from '../utils/nhlApi';

// Styling used to come from ScheduleView.css -- migrated to Tailwind here
// (Phase 6, ScheduleView.css sub-PR 2). .series-card.series-active collides
// with .card on background+border-color, hoisted to index.css same as
// .matchup-detail; .series-card's own non-active border-color was a no-op
// (matched .card's own default) and was dropped rather than migrated.
// Fixed a real pre-existing bug along the way: the CAR-side .series-abbr
// used `style={{ color: 'var(team-primary)' }}` -- missing the `--` prefix,
// so it was invalid CSS the browser silently ignored, meaning the CAR
// abbreviation has never actually rendered in team color here.
const SERIES_PIP_BASE = 'pip w-[11px] h-[11px] rounded-full border-[1.5px] border-[color:var(--border-2)] shrink-0';
function seriesPipClasses(filled, side) {
  if (!filled) return `${SERIES_PIP_BASE} pip-empty bg-transparent`;
  return side === 'car'
    ? `${SERIES_PIP_BASE} pip-red bg-[var(--red)] border-[color:var(--red)]`
    : `${SERIES_PIP_BASE} pip-opp bg-[var(--opp-color,#7a8899)] border-[color:var(--opp-color,#7a8899)]`;
}

function SeriesCard({ series }) {
  const { t } = useTranslation();
  const oppAbbr  = series.opponent?.abbrev || '???';
  const oppColor = TEAM_COLORS[oppAbbr] || '#7a8899';
  const total    = series.carWins + series.oppWins;
  return (
    <div className={`series-card card mb-2.5${series.isActive ? ' series-active' : ''}`}>
      <div className="series-top flex items-start justify-between mb-3 gap-2">
        <div className="series-top-left flex flex-col gap-0.5">
          <span className="series-round-label font-[family-name:var(--font-display)] text-[13px] font-bold tracking-[0.04em] text-[color:var(--text)] uppercase">{series.roundLabel}</span>
          <span className="series-status text-[11px] text-[color:var(--text-muted)] font-medium">
            {series.isActive ? t('pwhlScheduleView.seriesCard.statusInProgress') : series.carAdvance ? t('pwhlScheduleView.seriesCard.statusAdvanced') : t('pwhlScheduleView.seriesCard.statusEliminated')}
          </span>
        </div>
        <span className="series-games-played text-[11px] text-[color:var(--text-dim)] whitespace-nowrap pt-0.5">{t('pwhlScheduleView.seriesCard.gamesPlayed', { count: total })}</span>
        {series.carWins === 4 && series.oppWins === 0 && (
          <span className="series-sweep text-[11px] font-bold text-[color:var(--green)] ml-1.5">{t('pwhlScheduleView.seriesCard.sweepBadgeOurs')}</span>
        )}
        {series.oppWins === 4 && series.carWins === 0 && (
          <span className="series-swept text-[11px] font-bold text-[color:var(--text-dim)] ml-1.5">{t('pwhlScheduleView.seriesCard.sweepBadgeTheirs')}</span>
        )}
      </div>
      <div className="series-body flex items-center gap-1 mb-1">

        {/* CAR column: logo+name+score in a row, pips underneath */}
        <div className="series-side flex-1 flex flex-col gap-2">
          <div className="series-row flex items-center gap-[7px] flex-nowrap">
            <TeamLogo abbr={TEAM_CONFIG.abbr} size={30} />
            <span className="series-abbr font-[family-name:var(--font-display)] text-[18px] font-bold leading-none whitespace-nowrap text-[color:var(--team-primary)]">{TEAM_CONFIG.abbr}</span>
            <span className="series-city text-[11px] text-[color:var(--text-dim)] whitespace-nowrap">{TEAM_CONFIG.fullNameFragment}</span>
            <span className="series-wins font-[family-name:var(--font-display)] text-[36px] font-bold text-[color:var(--text)] leading-none">{series.carWins}</span>
          </div>
          <div className="series-pips flex items-center gap-[5px]">
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} className={seriesPipClasses(i < series.carWins, 'car')} />
            ))}
          </div>
        </div>

        {/* Centre dash */}
        <div className="series-centre shrink-0 flex items-center mb-[22px] px-0.5">
          <span className="series-divider font-[family-name:var(--font-display)] text-[22px] font-light text-[color:var(--text-dim)]">–</span>
        </div>

        {/* OPP column: mirror layout, right-aligned */}
        <div className="series-side right flex-1 flex flex-col gap-2 items-end">
          <div className="series-row right flex items-center gap-[7px] flex-nowrap justify-end">
            <span className="series-wins font-[family-name:var(--font-display)] text-[36px] font-bold text-[color:var(--text)] leading-none">{series.oppWins}</span>
            <span className="series-city text-[11px] text-[color:var(--text-dim)] whitespace-nowrap">{series.opponent?.placeName?.default || oppAbbr}</span>
            <span className="series-abbr font-[family-name:var(--font-display)] text-[18px] font-bold leading-none whitespace-nowrap" style={{ color: oppColor }}>{oppAbbr}</span>
            <TeamLogo abbr={oppAbbr} size={30} color={oppColor} />
          </div>
          <div className="series-pips flex items-center gap-[5px] justify-end">
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} className={seriesPipClasses(i < series.oppWins, 'opp')} style={{ '--opp-color': oppColor }} />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Sort bar ─────────────────────────────────────────────────
// Styling used to come from ScheduleView.css -- migrated to Tailwind here
// (Phase 6, ScheduleView.css sub-PR 4). .sort-btn:hover and .active are
// equal-specificity compound selectors in the original CSS with active
// winning on hover too (later in source) -- same shape as
// .skater-toggle-btn in GameStatsPopup.jsx (sub-PR 3), so the hover color
// is scoped to the non-active variant only rather than stacked
// unconditionally on a shared base.
const sortBtnClasses = (active) => {
  const base = 'sort-btn py-1 px-2.5 rounded-[20px] text-[11px] font-medium border-[0.5px] cursor-pointer [transition:all_0.15s]';
  return active
    ? `${base} active bg-[var(--red-dim)] border-[color:var(--red-border)] text-[color:var(--red-bright)]`
    : `${base} bg-transparent border-[color:var(--border-2)] text-[color:var(--text-muted)] hover:text-[color:var(--text)]`;
};

function SortBar({ sortOrder, setSortOrder, completedCount, upcomingCount }) {
  const { t } = useTranslation();
  return (
    <div className="sort-bar flex items-center justify-between gap-2.5 py-2 pb-2.5 border-b-[0.5px] border-b-[color:var(--border)] mb-2.5 flex-wrap">
      <span className="sort-bar-count text-[11px] text-[color:var(--text-dim)]">
        {t('pwhlScheduleView.sortBar.countSummary', { completedCount })}{upcomingCount > 0 ? t('pwhlScheduleView.sortBar.countSummaryUpcoming', { count: upcomingCount }) : ''}
      </span>
      <div className="sort-bar-controls flex items-center gap-[5px]">
        <span className="sort-bar-label text-[11px] text-[color:var(--text-dim)] mr-0.5">{t('pwhlScheduleView.sortBar.label')}</span>
        <button
          className={sortBtnClasses(sortOrder === 'desc')}
          onClick={() => setSortOrder('desc')}
          title={t('pwhlScheduleView.sortBar.newestFirst')}
        >
          {t('pwhlScheduleView.sortBar.newestFirst')}
        </button>
        <button
          className={sortBtnClasses(sortOrder === 'asc')}
          onClick={() => setSortOrder('asc')}
          title={t('pwhlScheduleView.sortBar.oldestFirst')}
        >
          {t('pwhlScheduleView.sortBar.oldestFirst')}
        </button>
      </div>
    </div>
  );
}

// ── Shared game card ─────────────────────────────────────────
// Styling used to come from ScheduleView.css -- migrated to Tailwind here
// (Phase 6, ScheduleView.css sub-PR 1). Every classname below is kept as a
// literal marker alongside the Tailwind utilities. .gc-record (never
// rendered anywhere) and .sched-sub (ScheduleView.jsx's own dead sibling,
// see that file) were confirmed dead via full-tree grep and dropped rather
// than migrated.
//
// None of .game-card's own properties (margin-bottom, cursor, hover
// border-color, .selected/.playoff-game modifiers) collide with the
// shared .card class's own unlayered background/border/border-radius/
// padding, so this is a plain Tailwind conversion -- no index.css entry
// needed (unlike .matchup-detail in MatchupDetail.jsx, which does collide).
const GAME_CARD_BASE = 'game-card card mb-2 cursor-pointer [transition:border-color_0.15s] hover:border-[color:var(--border-2)]';
const gameCardClasses = ({ isSelected, isPlayoff, isCompleted }) => {
  const selected = isSelected ? ' selected bg-[rgba(204,34,0,0.04)] border-[color:var(--red-border)]' : '';
  const playoff  = isPlayoff ? ' playoff-game border-l-2 border-l-[color:var(--red-border)]' : '';
  const clickable = isCompleted ? ' clickable' : ' upcoming-clickable';
  return `${GAME_CARD_BASE}${selected}${playoff}${clickable}`;
};

function GameCard({ game, isCompleted, isSelected, isPlayoff, onClick, odds, cardFavoured }) {
  const { t } = useTranslation();
  const home     = isHomeGame(game);
  const opp      = getOpponent(game);
  const oppColor = TEAM_COLORS[opp?.abbrev] || '#7a8899';
  const carScore = getCarScore(game);
  const oppScore = getOppScore(game);
  const won      = isCompleted && carScore != null && carScore > oppScore;
  const lost     = isCompleted && carScore != null && carScore < oppScore;
  const oppCity  = opp?.placeName?.default || '';
  const oppName  = opp?.commonName?.default || opp?.abbrev || '';

  return (
    <div
      className={gameCardClasses({ isSelected, isPlayoff, isCompleted })}
      onClick={onClick}
    >
      <div className="gc-top flex items-center gap-2.5 mb-2.5 flex-wrap">
        <span className="gc-date text-[12px] text-[color:var(--text-muted)]">{formatGameDate(game.gameDate)}</span>
        {isCompleted && carScore != null ? (
          <span className={`gc-result font-semibold text-[12px] ${won ? 'won text-[color:var(--green)]' : 'lost text-[color:var(--red-bright)]'}`}>
            {won ? 'W' : lost ? 'L' : 'OT'} {carScore}–{oppScore}
          </span>
        ) : (
          <span className="gc-time text-[11px] text-[color:var(--amber)] font-[family-name:var(--font-mono)]">{formatGameTime(game.startTimeUTC)}</span>
        )}
        <span className="gc-venue text-[10px] text-[color:var(--text-dim)] ml-auto">{home ? '📍 Lenovo Center' : `✈ ${t('scheduleView.resultCard.away')}`}</span>
        {isCompleted && <span className="gc-tap-hint text-[10px] text-[color:var(--text-dim)]">{t('scheduleView.resultCard.tapForStats')}</span>}
        {!isCompleted && odds && (
          <div className="gc-odds flex items-center gap-1 font-[family-name:var(--font-mono)] text-[11px] ml-auto">
            <span className="gc-odds-car text-[color:var(--red-bright)] font-semibold" title={t('gameCard.card.oddsCarTitle', { abbr: TEAM_CONFIG.abbr })}>{fmtOdds(odds.carOdds)}</span>
            <span className="gc-odds-sep text-[color:var(--text-dim)]">/</span>
            <span className="gc-odds-opp text-[color:var(--text-muted)] font-semibold" title={t('gameCard.card.oddsOppTitle')}>{fmtOdds(odds.oppOdds)}</span>
            <span className="gc-odds-book text-[9px] text-[color:var(--text-dim)] ml-0.5">{odds.book}</span>
          </div>
        )}
      </div>
      <div className="gc-matchup flex items-center gap-3.5 mb-2">
        <div className="gc-team-block flex-1 flex flex-row items-center gap-2.5 min-w-0">
          <TeamLogo abbr={TEAM_CONFIG.abbr} size={32} />
          <div className="gc-team-text flex flex-col gap-0.5 min-w-0">
            <span className="gc-abbr font-[family-name:var(--font-display)] text-[20px] font-bold tracking-[0.04em]" style={{ color: 'var(--team-primary)' }}>{TEAM_CONFIG.abbr}</span>
            <span className="gc-full text-[11px] text-[color:var(--text-muted)]">{TEAM_CONFIG.displayName}</span>
          </div>
        </div>
        <div className="gc-vs font-[family-name:var(--font-display)] text-[12px] font-semibold text-[color:var(--text-dim)] shrink-0">{home ? t('gameCard.card.vsLabel') : '@'}</div>
        <div className="gc-team-block right flex-1 flex flex-row-reverse items-center gap-2.5 min-w-0">
          <div className="gc-team-text right flex flex-col gap-0.5 min-w-0 items-end text-right">
            <span className="gc-abbr font-[family-name:var(--font-display)] text-[20px] font-bold tracking-[0.04em]" style={{ color: oppColor }}>{opp?.abbrev}</span>
            <span className="gc-full text-[11px] text-[color:var(--text-muted)]">{oppCity} {oppName}</span>
          </div>
          <TeamLogo abbr={opp?.abbrev} size={32} color={oppColor} />
        </div>
      </div>
      {!isCompleted && (
        <div className="gc-bottom-row flex items-center justify-between mt-1.5">
          {cardFavoured && (
            <span className={`gc-favoured-chip text-[10px] font-bold py-[2px] px-2 rounded-[10px] ${cardFavoured.favoured ? 'fav bg-[rgba(61,186,126,0.15)] text-[color:var(--green)]' : 'dog bg-[rgba(204,34,0,0.12)] text-[color:var(--red-bright)]'}`}>
              {cardFavoured.favoured ? `✓ ${TEAM_CONFIG.abbr} ${cardFavoured.pct}%` : `⚠ ${opp?.abbrev} ${100 - cardFavoured.pct}%`}
            </span>
          )}
          <span className="gc-expand-hint text-[10px] text-[color:var(--text-dim)] text-right flex-1">{isSelected ? `▲ ${t('common.close')}` : `▼ ${t('gameCard.card.matchupBreakdownLabel')}`}</span>
        </div>
      )}
    </div>
  );
}

// ── Shared win probability model ─────────────────────────────
// Used by both GameCard chip and MatchupDetail probability bar.
// Returns { pct: number, favoured: bool }

export { SeriesCard, SortBar, GameCard };