import React from 'react';
import {
  isHomeGame, getOpponent, getCarScore, getOppScore,
  formatGameDate, formatGameTime, TEAM_COLORS, TEAM_CONFIG,
} from '../utils/nhlApi';
import TeamLogo from '../components/TeamLogo';
import { fmtOdds } from '../utils/nhlApi';

function SeriesCard({ series }) {
  const oppAbbr  = series.opponent?.abbrev || '???';
  const oppColor = TEAM_COLORS[oppAbbr] || '#7a8899';
  const total    = series.carWins + series.oppWins;
  return (
    <div className={`series-card card ${series.isActive ? 'series-active' : ''}`}>
      <div className="series-top">
        <div className="series-top-left">
          <span className="series-round-label">{series.roundLabel}</span>
          <span className="series-status">
            {series.isActive ? '🔴 In progress' : series.carAdvance ? '✅ Advanced' : '❌ Eliminated'}
          </span>
        </div>
        <span className="series-games-played">{total} game{total !== 1 ? 's' : ''} played</span>
        {series.carWins === 4 && series.oppWins === 0 && (
          <span className="series-sweep">🧹 Sweep!</span>
        )}
        {series.oppWins === 4 && series.carWins === 0 && (
          <span className="series-swept">🧹 Swept</span>
        )}
      </div>
      <div className="series-body">

        {/* CAR column: logo+name+score in a row, pips underneath */}
        <div className="series-side">
          <div className="series-row">
            <TeamLogo abbr={TEAM_CONFIG.abbr} size={30} />
            <span className="series-abbr" style={{ color: 'var(team-primary)' }}>{TEAM_CONFIG.abbr}</span>
            <span className="series-city">{TEAM_CONFIG.fullNameFragment}</span>
            <span className="series-wins">{series.carWins}</span>
          </div>
          <div className="series-pips">
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} className={`pip ${i < series.carWins ? 'pip-red' : 'pip-empty'}`} />
            ))}
          </div>
        </div>

        {/* Centre dash */}
        <div className="series-centre">
          <span className="series-divider">–</span>
        </div>

        {/* OPP column: mirror layout, right-aligned */}
        <div className="series-side right">
          <div className="series-row right">
            <span className="series-wins">{series.oppWins}</span>
            <span className="series-city">{series.opponent?.placeName?.default || oppAbbr}</span>
            <span className="series-abbr" style={{ color: oppColor }}>{oppAbbr}</span>
            <TeamLogo abbr={oppAbbr} size={30} color={oppColor} />
          </div>
          <div className="series-pips">
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} className={`pip ${i < series.oppWins ? 'pip-opp' : 'pip-empty'}`} style={{ '--opp-color': oppColor }} />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Sort bar ─────────────────────────────────────────────────

function SortBar({ sortOrder, setSortOrder, completedCount, upcomingCount, _label }) {
  return (
    <div className="sort-bar">
      <span className="sort-bar-count">
        {completedCount} played{upcomingCount > 0 ? ` · ${upcomingCount} upcoming` : ''}
      </span>
      <div className="sort-bar-controls">
        <span className="sort-bar-label">Sort:</span>
        <button
          className={`sort-btn ${sortOrder === 'desc' ? 'active' : ''}`}
          onClick={() => setSortOrder('desc')}
          title="Newest first"
        >
          Newest first
        </button>
        <button
          className={`sort-btn ${sortOrder === 'asc' ? 'active' : ''}`}
          onClick={() => setSortOrder('asc')}
          title="Oldest first"
        >
          Oldest first
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
        <span className="gc-venue text-[10px] text-[color:var(--text-dim)] ml-auto">{home ? '📍 Lenovo Center' : '✈ Away'}</span>
        {isCompleted && <span className="gc-tap-hint text-[10px] text-[color:var(--text-dim)]">Tap for stats →</span>}
        {!isCompleted && odds && (
          <div className="gc-odds flex items-center gap-1 font-[family-name:var(--font-mono)] text-[11px] ml-auto">
            <span className="gc-odds-car text-[color:var(--red-bright)] font-semibold" title="${TEAM_CONFIG.abbr} moneyline">{fmtOdds(odds.carOdds)}</span>
            <span className="gc-odds-sep text-[color:var(--text-dim)]">/</span>
            <span className="gc-odds-opp text-[color:var(--text-muted)] font-semibold" title="OPP moneyline">{fmtOdds(odds.oppOdds)}</span>
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
        <div className="gc-vs font-[family-name:var(--font-display)] text-[12px] font-semibold text-[color:var(--text-dim)] shrink-0">{home ? 'vs' : '@'}</div>
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
          <span className="gc-expand-hint text-[10px] text-[color:var(--text-dim)] text-right flex-1">{isSelected ? '▲ Close' : '▼ Matchup breakdown'}</span>
        </div>
      )}
    </div>
  );
}

// ── Shared win probability model ─────────────────────────────
// Used by both GameCard chip and MatchupDetail probability bar.
// Returns { pct: number, favoured: bool }

export { SeriesCard, SortBar, GameCard };