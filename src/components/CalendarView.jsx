import React from 'react';
import {
  TEAM_COLORS, getOpponent, isHomeGame, getCarScore, getOppScore, formatGameTime,
} from '../utils/nhlApi';
import TeamLogo from '../components/TeamLogo';

// Styling used to come from ScheduleView.css -- migrated to Tailwind here
// (Phase 6, ScheduleView.css sub-PR 4).
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DOW    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const CAL_CELL_BASE = 'cal-cell rounded-[var(--radius-sm)] min-h-[72px] pt-[5px] px-[5px] pb-1 flex flex-col gap-[3px] relative text-[11px] overflow-hidden max-[480px]:min-h-[58px] max-[480px]:py-1 max-[480px]:px-[3px]';
const CAL_CELL_EMPTY_CLASSES = `${CAL_CELL_BASE} empty bg-transparent`;

function calNoGameCellClasses(isToday) {
  const base = `${CAL_CELL_BASE} no-game bg-[var(--bg2)] border-[0.5px] border-[color:var(--border)]`;
  return isToday ? `${base} today !border-[1.5px] !border-solid !border-[color:var(--red-border)]` : base;
}

// .cal-cell.win/.loss/.otl/.upcoming set background+border together;
// .cal-cell.has-game.upcoming (a 3-class compound, genuinely more specific
// than the 2-class .cal-cell.upcoming) always wins on border-color for the
// upcoming case specifically -- every result cell always carries has-game
// in practice, so that's the value used here rather than .upcoming's own.
// .playoff-cell only overrides border-style to dashed. .today's border is
// `!important` in the original CSS and overrides the whole border shorthand
// (width/style/color) regardless of result/playoff state, but not
// background -- Tailwind's `!` modifier reproduces that exactly.
const CAL_RESULT_STYLES = {
  win:      { bg: 'bg-[rgba(61,186,126,0.12)]', border: 'border-[rgba(61,186,126,0.25)]' },
  loss:     { bg: 'bg-[rgba(204,34,0,0.10)]',   border: 'border-[rgba(204,34,0,0.22)]' },
  otl:      { bg: 'bg-[rgba(240,160,48,0.10)]', border: 'border-[rgba(240,160,48,0.25)]' },
  upcoming: { bg: 'bg-[var(--bg2)]',            border: 'border-[color:var(--border-2)]' },
};
function calCellClasses({ result, isToday, isPlayoff }) {
  const { bg, border } = CAL_RESULT_STYLES[result];
  const classes = [CAL_CELL_BASE, 'has-game', result, bg, border, 'border-[0.5px]'];
  if (isPlayoff) classes.push('playoff-cell border-dashed');
  if (isToday) classes.push('today !border-[1.5px] !border-solid !border-[color:var(--red-border)]');
  return classes.join(' ');
}

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
    <div className="calendar-wrap pb-4">
      {/* Month navigation */}
      <div className="cal-nav flex items-center justify-between mb-3">
        <button className="cal-nav-btn w-8 h-8 rounded-full border-[0.5px] border-[color:var(--border-2)] bg-[var(--bg2)] text-[color:var(--text-muted)] text-[18px] cursor-pointer flex items-center justify-center [transition:all_0.12s] hover:bg-[var(--bg3)] hover:text-[color:var(--text)]" onClick={prevMonth}>‹</button>
        <span className="cal-month-label font-[family-name:var(--font-display)] text-[16px] font-bold text-[color:var(--text)] tracking-[0.04em]">{MONTHS[month]} {year}</span>
        <button className="cal-nav-btn w-8 h-8 rounded-full border-[0.5px] border-[color:var(--border-2)] bg-[var(--bg2)] text-[color:var(--text-muted)] text-[18px] cursor-pointer flex items-center justify-center [transition:all_0.12s] hover:bg-[var(--bg3)] hover:text-[color:var(--text)]" onClick={nextMonth}>›</button>
      </div>

      {/* Day-of-week headers */}
      <div className="cal-grid grid gap-[3px] [grid-template-columns:repeat(7,1fr)]">
        {DOW.map(d => (
          <div key={d} className="cal-dow text-center text-[10px] font-semibold text-[color:var(--text-dim)] uppercase tracking-[0.06em] pt-1 pb-1.5 max-[480px]:text-[9px]">{d}</div>
        ))}

        {/* Day cells */}
        {cells.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} className={CAL_CELL_EMPTY_CLASSES} />;

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
      <div className="cal-legend flex gap-3 flex-wrap mt-2.5 pt-2 border-t-[0.5px] border-t-[color:var(--border)]">
        <span className="cal-leg-item flex items-center gap-1 text-[10px] text-[color:var(--text-muted)]"><span className="cal-leg-dot win w-2.5 h-2.5 rounded-[2px] shrink-0 bg-[rgba(61,186,126,0.4)] border-[0.5px] border-[rgba(61,186,126,0.5)]" />Win</span>
        <span className="cal-leg-item flex items-center gap-1 text-[10px] text-[color:var(--text-muted)]"><span className="cal-leg-dot otl w-2.5 h-2.5 rounded-[2px] shrink-0 bg-[rgba(240,160,48,0.35)] border-[0.5px] border-[rgba(240,160,48,0.5)]" />OT Loss</span>
        <span className="cal-leg-item flex items-center gap-1 text-[10px] text-[color:var(--text-muted)]"><span className="cal-leg-dot loss w-2.5 h-2.5 rounded-[2px] shrink-0 bg-[rgba(204,34,0,0.35)] border-[0.5px] border-[rgba(204,34,0,0.5)]" />Loss</span>
        <span className="cal-leg-item flex items-center gap-1 text-[10px] text-[color:var(--text-muted)]"><span className="cal-leg-dot upcoming w-2.5 h-2.5 rounded-[2px] shrink-0 bg-[var(--bg3)] border-[0.5px] border-[color:var(--border-2)]" />Upcoming</span>
        <span className="cal-leg-item flex items-center gap-1 text-[10px] text-[color:var(--text-muted)]"><span className="cal-leg-home text-[10px] text-[color:var(--text-dim)]">●</span>Home</span>
        <span className="cal-leg-item flex items-center gap-1 text-[10px] text-[color:var(--text-muted)]"><span className="cal-leg-home text-[10px] text-[color:var(--text-dim)]">○</span>Away</span>
      </div>
    </div>
  );
}

function CalCell({ day, _dateStr, game, isToday, onGamePopup }) {
  if (!game) {
    return (
      <div className={calNoGameCellClasses(isToday)}>
        <span className={`cal-day-num text-[11px] font-semibold leading-none ${isToday ? 'text-[color:var(--red-bright)]' : 'text-[color:var(--text-muted)]'}`}>{day}</span>
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

  return (
    <div
      className={calCellClasses({ result: result || 'upcoming', isToday, isPlayoff })}
      onClick={() => isCompleted ? onGamePopup(game) : null}
      style={{ cursor: isCompleted ? 'pointer' : 'default' }}
    >
      <div className="cal-cell-top flex justify-between items-start">
        <span className={`cal-day-num text-[11px] font-semibold leading-none ${isToday ? 'text-[color:var(--red-bright)]' : 'text-[color:var(--text-muted)]'}`}>{day}</span>
        <span className="cal-home-dot text-[8px] text-[color:var(--text-dim)] leading-none" title={home ? 'Home' : 'Away'}>
          {home ? '●' : '○'}
        </span>
      </div>

      <div className="cal-cell-body flex items-center gap-1 flex-nowrap min-w-0">
        <TeamLogo abbr={oppAbbr} size={20} color={oppColor} />
        <span className="cal-opp-abbr font-[family-name:var(--font-display)] text-[11px] font-bold text-[color:var(--text)] whitespace-nowrap overflow-hidden text-ellipsis max-[480px]:text-[10px]">{oppAbbr}</span>
      </div>

      {isCompleted && carScore != null ? (
        <div className="cal-score flex items-center gap-1 flex-nowrap">
          <span className={result === 'win' ? 'cal-score-w font-[family-name:var(--font-display)] text-[10px] font-bold text-[color:var(--green)]' : 'cal-score-l font-[family-name:var(--font-display)] text-[10px] font-bold text-[color:var(--red-bright)]'}>
            {result === 'win' ? 'W' : result === 'otl' ? 'OTL' : 'L'}
          </span>
          <span className="cal-score-nums text-[10px] text-[color:var(--text-muted)] font-[family-name:var(--font-mono)]">{carScore}–{oppScore}</span>
        </div>
      ) : (
        <div className="cal-time text-[9px] text-[color:var(--text-dim)] font-[family-name:var(--font-mono)] whitespace-nowrap overflow-hidden text-ellipsis">{formatGameTime(game.startTimeUTC)}</div>
      )}

      {isPlayoff && <span className="cal-playoff-badge absolute top-[3px] right-[3px] text-[7px] font-bold bg-[var(--amber)] text-[#000] py-[1px] px-[3px] rounded-[2px] leading-[1.3] tracking-[0.04em]">PO</span>}
    </div>
  );
}

// ── Playoffs tab ─────────────────────────────────────────────

export { CalendarView };