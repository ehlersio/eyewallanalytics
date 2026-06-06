import React from 'react';
import {
  TEAM_COLORS, getOpponent, isHomeGame, getCarScore, getOppScore, formatGameTime,
} from '../utils/nhlApi';
import TeamLogo from '../components/TeamLogo';

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DOW    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function CalendarView({ games, calMonth, setCalMonth, onGamePopup }) {
  const { year, month } = calMonth;

  // Build a map: "YYYY-MM-DD" -> game object
  const gameByDate = {};
  games.forEach(g => {
    if (g.gameDate) gameByDate[g.gameDate] = g;
  });

  // Calendar grid: first day of month, pad with nulls
  const firstDay  = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMo  = new Date(year, month + 1, 0).getDate();
  const today     = new Date();
  const todayStr  = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  function prevMonth() {
    setCalMonth(({ year: y, month: m }) =>
      m === 0 ? { year: y - 1, month: 11 } : { year: y, month: m - 1 }
    );
  }
  function nextMonth() {
    setCalMonth(({ year: y, month: m }) =>
      m === 11 ? { year: y + 1, month: 0 } : { year: y, month: m + 1 }
    );
  }

  // Build cells: nulls for padding, then 1..daysInMo
  const cells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMo }, (_, i) => i + 1),
  ];

  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="calendar-wrap">
      {/* Month navigation */}
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
        <span className="cal-month-label">{MONTHS[month]} {year}</span>
        <button className="cal-nav-btn" onClick={nextMonth}>›</button>
      </div>

      {/* Day-of-week headers */}
      <div className="cal-grid">
        {DOW.map(d => (
          <div key={d} className="cal-dow">{d}</div>
        ))}

        {/* Day cells */}
        {cells.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} className="cal-cell empty" />;

          const mm      = String(month + 1).padStart(2, '0');
          const dd      = String(day).padStart(2, '0');
          const dateStr = `${year}-${mm}-${dd}`;
          const game    = gameByDate[dateStr];
          const isToday = dateStr === todayStr;

          return (
            <CalCell
              key={dateStr}
              day={day}
              dateStr={dateStr}
              game={game}
              isToday={isToday}
              onGamePopup={onGamePopup}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="cal-legend">
        <span className="cal-leg-item"><span className="cal-leg-dot win" />Win</span>
        <span className="cal-leg-item"><span className="cal-leg-dot otl" />OT Loss</span>
        <span className="cal-leg-item"><span className="cal-leg-dot loss" />Loss</span>
        <span className="cal-leg-item"><span className="cal-leg-dot upcoming" />Upcoming</span>
        <span className="cal-leg-item"><span className="cal-leg-home">●</span>Home</span>
        <span className="cal-leg-item"><span className="cal-leg-home">○</span>Away</span>
      </div>
    </div>
  );
}

function CalCell({ day, dateStr, game, isToday, onGamePopup }) {
  if (!game) {
    return (
      <div className={`cal-cell no-game ${isToday ? 'today' : ''}`}>
        <span className="cal-day-num">{day}</span>
      </div>
    );
  }

  const isCompleted = ['OFF','FINAL','F'].includes(game.gameState);
  const opp         = getOpponent(game);
  const oppAbbr     = opp?.abbrev || '???';
  const oppColor    = TEAM_COLORS[oppAbbr] || 'var(--text-muted)';
  const home        = isHomeGame(game);
  const carScore    = getCarScore(game);
  const oppScore    = getOppScore(game);
  const isPlayoff   = game.gameType === 3;

  // Result classification
  let result = null;
  if (isCompleted && carScore != null && oppScore != null) {
    if (carScore > oppScore)       result = 'win';
    else if (game.gameState === 'OT' ||
             (carScore < oppScore && game.periodDescriptor?.number > 3))
                                   result = 'otl';
    else                           result = 'loss';
  }

  const cellClass = [
    'cal-cell',
    'has-game',
    result || 'upcoming',
    isToday ? 'today' : '',
    isPlayoff ? 'playoff-cell' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cellClass}
      onClick={() => isCompleted ? onGamePopup(game) : null}
      style={{ cursor: isCompleted ? 'pointer' : 'default' }}
    >
      <div className="cal-cell-top">
        <span className="cal-day-num">{day}</span>
        <span className="cal-home-dot" title={home ? 'Home' : 'Away'}>
          {home ? '●' : '○'}
        </span>
      </div>

      <div className="cal-cell-body">
        <TeamLogo abbr={oppAbbr} size={20} color={oppColor} />
        <span className="cal-opp-abbr">{oppAbbr}</span>
      </div>

      {isCompleted && carScore != null ? (
        <div className="cal-score">
          <span className={result === 'win' ? 'cal-score-w' : 'cal-score-l'}>
            {result === 'win' ? 'W' : result === 'otl' ? 'OTL' : 'L'}
          </span>
          <span className="cal-score-nums">{carScore}–{oppScore}</span>
        </div>
      ) : (
        <div className="cal-time">{formatGameTime(game.startTimeUTC)}</div>
      )}

      {isPlayoff && <span className="cal-playoff-badge">PO</span>}
    </div>
  );
}

// ── Playoffs tab ─────────────────────────────────────────────

export { CalendarView };