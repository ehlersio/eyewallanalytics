import React from 'react';
import {
  isHomeGame, getOpponent, getCarScore, getOppScore,
  formatGameDate, formatGameTime, TEAM_COLORS, TEAM_CONFIG,
} from '../utils/nhlApi';
import TeamLogo from '../components/TeamLogo';
import { extractMoneyline, fmtOdds } from '../utils/nhlApi';

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

function SortBar({ sortOrder, setSortOrder, completedCount, upcomingCount, label }) {
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
      className={`game-card card ${isSelected ? 'selected' : ''} ${isPlayoff ? 'playoff-game' : ''} ${isCompleted ? 'clickable' : 'upcoming-clickable'}`}
      onClick={onClick}
    >
      <div className="gc-top">
        <span className="gc-date">{formatGameDate(game.gameDate)}</span>
        {isCompleted && carScore != null ? (
          <span className={`gc-result ${won ? 'won' : 'lost'}`}>
            {won ? 'W' : lost ? 'L' : 'OT'} {carScore}–{oppScore}
          </span>
        ) : (
          <span className="gc-time">{formatGameTime(game.startTimeUTC)}</span>
        )}
        <span className="gc-venue">{home ? '📍 Lenovo Center' : '✈ Away'}</span>
        {isCompleted && <span className="gc-tap-hint">Tap for stats →</span>}
        {!isCompleted && odds && (
          <div className="gc-odds">
            <span className="gc-odds-car" title="${TEAM_CONFIG.abbr} moneyline">{fmtOdds(odds.carOdds)}</span>
            <span className="gc-odds-sep">/</span>
            <span className="gc-odds-opp" title="OPP moneyline">{fmtOdds(odds.oppOdds)}</span>
            <span className="gc-odds-book">{odds.book}</span>
          </div>
        )}
      </div>
      <div className="gc-matchup">
        <div className="gc-team-block">
          <TeamLogo abbr={TEAM_CONFIG.abbr} size={32} />
          <div className="gc-team-text">
            <span className="gc-abbr" style={{ color: 'var(--team-primary)' }}>{TEAM_CONFIG.abbr}</span>
            <span className="gc-full">{TEAM_CONFIG.displayName}</span>
          </div>
        </div>
        <div className="gc-vs">{home ? 'vs' : '@'}</div>
        <div className="gc-team-block right">
          <div className="gc-team-text right">
            <span className="gc-abbr" style={{ color: oppColor }}>{opp?.abbrev}</span>
            <span className="gc-full">{oppCity} {oppName}</span>
          </div>
          <TeamLogo abbr={opp?.abbrev} size={32} color={oppColor} />
        </div>
      </div>
      {!isCompleted && (
        <div className="gc-bottom-row">
          {cardFavoured && (
            <span className={`gc-favoured-chip ${cardFavoured.favoured ? 'fav' : 'dog'}`}>
              {cardFavoured.favoured ? `✓ ${TEAM_CONFIG.abbr} ${cardFavoured.pct}%` : `⚠ ${opp?.abbrev} ${100 - cardFavoured.pct}%`}
            </span>
          )}
          <span className="gc-expand-hint">{isSelected ? '▲ Close' : '▼ Matchup breakdown'}</span>
        </div>
      )}
    </div>
  );
}

// ── Shared win probability model ─────────────────────────────
// Used by both GameCard chip and MatchupDetail probability bar.
// Returns { pct: number, favoured: bool }

export { SeriesCard, SortBar, GameCard };