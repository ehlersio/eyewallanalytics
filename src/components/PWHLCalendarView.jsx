// components/PWHLCalendarView.jsx
// Mirrors NHL CalendarView.jsx — monthly grid of PWHL games.
// Completed games are clickable (fires onGamePopup). Upcoming shows date only.
import { PWHL_TEAM_MAP, getPWHLTeamById } from '../utils/pwhlConfig';
import TeamLogo from '../components/TeamLogo';

// Styling used to come from ScheduleView.css -- migrated to Tailwind here
// (Phase 6, ScheduleView.css sub-PR 4). No .playoff-cell/.cal-playoff-badge
// here -- PWHL's calendar genuinely never marks playoff cells specially,
// confirmed via CalendarView.jsx's own consumer (this file never renders
// either class), a real UI asymmetry not a bug.
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DOW    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const CAL_CELL_BASE = 'cal-cell rounded-[var(--radius-sm)] min-h-[72px] pt-[5px] px-[5px] pb-1 flex flex-col gap-[3px] relative text-[11px] overflow-hidden max-[480px]:min-h-[58px] max-[480px]:py-1 max-[480px]:px-[3px]';
const CAL_CELL_EMPTY_CLASSES = `${CAL_CELL_BASE} empty bg-transparent`;

function calNoGameCellClasses(isToday) {
  const base = `${CAL_CELL_BASE} no-game bg-[var(--bg2)] border-[0.5px] border-[color:var(--border)]`;
  return isToday ? `${base} today !border-[1.5px] !border-solid !border-[color:var(--red-border)]` : base;
}

const CAL_RESULT_STYLES = {
  win:      { bg: 'bg-[rgba(61,186,126,0.12)]', border: 'border-[rgba(61,186,126,0.25)]' },
  loss:     { bg: 'bg-[rgba(204,34,0,0.10)]',   border: 'border-[rgba(204,34,0,0.22)]' },
  otl:      { bg: 'bg-[rgba(240,160,48,0.10)]', border: 'border-[rgba(240,160,48,0.25)]' },
  upcoming: { bg: 'bg-[var(--bg2)]',            border: 'border-[color:var(--border-2)]' },
};
function calCellClasses({ result, isToday }) {
  const { bg, border } = CAL_RESULT_STYLES[result];
  const classes = [CAL_CELL_BASE, 'has-game', result, bg, border, 'border-[0.5px]'];
  if (isToday) classes.push('today !border-[1.5px] !border-solid !border-[color:var(--red-border)]');
  return classes.join(' ');
}

export function PWHLCalendarView({ games, calMonth, setCalMonth, onGamePopup, teamId }) {
  const { year, month } = calMonth;

  // Build "YYYY-MM-DD" → game map using game_date (now populated by pipeline)
  const gameByDate = {};
  (games || []).forEach(g => {
    const key = g.game_date;
    if (key) gameByDate[key] = g;
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMo = new Date(year, month + 1, 0).getDate();
  const today    = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  function prevMonth() {
    setCalMonth(({ year: y, month: m }) =>
      m === 0 ? { year: y-1, month: 11 } : { year: y, month: m-1 }
    );
  }
  function nextMonth() {
    setCalMonth(({ year: y, month: m }) =>
      m === 11 ? { year: y+1, month: 0 } : { year: y, month: m+1 }
    );
  }

  const cells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMo }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="calendar-wrap pb-4">
      <div className="cal-nav flex items-center justify-between mb-3">
        <button className="cal-nav-btn w-8 h-8 rounded-full border-[0.5px] border-[color:var(--border-2)] bg-[var(--bg2)] text-[color:var(--text-muted)] text-[18px] cursor-pointer flex items-center justify-center [transition:all_0.12s] hover:bg-[var(--bg3)] hover:text-[color:var(--text)]" onClick={prevMonth}>‹</button>
        <span className="cal-month-label font-[family-name:var(--font-display)] text-[16px] font-bold text-[color:var(--text)] tracking-[0.04em]">{MONTHS[month]} {year}</span>
        <button className="cal-nav-btn w-8 h-8 rounded-full border-[0.5px] border-[color:var(--border-2)] bg-[var(--bg2)] text-[color:var(--text-muted)] text-[18px] cursor-pointer flex items-center justify-center [transition:all_0.12s] hover:bg-[var(--bg3)] hover:text-[color:var(--text)]" onClick={nextMonth}>›</button>
      </div>

      <div className="cal-grid grid gap-[3px] [grid-template-columns:repeat(7,1fr)]">
        {DOW.map(d => <div key={d} className="cal-dow text-center text-[10px] font-semibold text-[color:var(--text-dim)] uppercase tracking-[0.06em] pt-1 pb-1.5 max-[480px]:text-[9px]">{d}</div>)}

        {cells.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} className={CAL_CELL_EMPTY_CLASSES} />;
          const mm      = String(month + 1).padStart(2, '0');
          const dd      = String(day).padStart(2, '0');
          const dateStr = `${year}-${mm}-${dd}`;
          const game    = gameByDate[dateStr];
          const isToday = dateStr === todayStr;
          return (
            <PWHLCalCell
              key={dateStr}
              day={day}
              game={game}
              isToday={isToday}
              teamId={teamId}
              onGamePopup={onGamePopup}
            />
          );
        })}
      </div>

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

function PWHLCalCell({ day, game, isToday, teamId, onGamePopup }) {
  if (!game) {
    return (
      <div className={calNoGameCellClasses(isToday)}>
        <span className={`cal-day-num text-[11px] font-semibold leading-none ${isToday ? 'text-[color:var(--red-bright)]' : 'text-[color:var(--text-muted)]'}`}>{day}</span>
      </div>
    );
  }

  const isHome       = game.home_team_id === teamId;
  const oppId        = isHome ? game.away_team_id : game.home_team_id;
  const oppAbbr      = getPWHLTeamById(oppId)?.abbr || String(oppId);
  const oppTeam      = PWHL_TEAM_MAP[oppAbbr];
  const oppColor     = oppTeam?.displayColor || 'var(--text-muted)';
  const isCompleted  = game.game_state === 'Final';
  const myScore      = isHome ? game.home_score : game.away_score;
  const opScore      = isHome ? game.away_score : game.home_score;

  let result = null;
  if (isCompleted && myScore != null && opScore != null) {
    if      (myScore > opScore)              result = 'win';
    else if (game.ot || game.shootout)       result = 'otl';
    else                                     result = 'loss';
  }

  return (
    <div
      className={calCellClasses({ result: result || 'upcoming', isToday })}
      onClick={() => isCompleted && onGamePopup(game)}
      title={game.venue_name ? `${game.venue_name}${game.venue_city ? ", " + game.venue_city : ""}` : undefined}
      style={{ cursor: isCompleted ? 'pointer' : 'default' }}
    >
      <div className="cal-cell-top flex justify-between items-start">
        <span className={`cal-day-num text-[11px] font-semibold leading-none ${isToday ? 'text-[color:var(--red-bright)]' : 'text-[color:var(--text-muted)]'}`}>{day}</span>
        <span className="cal-home-dot text-[8px] text-[color:var(--text-dim)] leading-none" title={isHome ? 'Home' : 'Away'}>
          {isHome ? '●' : '○'}
        </span>
      </div>

      <div className="cal-cell-body flex items-center gap-1 flex-nowrap min-w-0">
        <TeamLogo abbr={oppAbbr} sport="pwhl" size={20} color={oppColor} />
        <span className="cal-opp-abbr font-[family-name:var(--font-display)] text-[11px] font-bold text-[color:var(--text)] whitespace-nowrap overflow-hidden text-ellipsis max-[480px]:text-[10px]">{oppAbbr}</span>
      </div>

      {isCompleted && myScore != null ? (
        <div className="cal-score flex items-center gap-1 flex-nowrap">
          <span className={result === 'win' ? 'cal-score-w font-[family-name:var(--font-display)] text-[10px] font-bold text-[color:var(--green)]' : 'cal-score-l font-[family-name:var(--font-display)] text-[10px] font-bold text-[color:var(--red-bright)]'}>
            {result === 'win' ? 'W' : result === 'otl' ? 'OT' : 'L'}
          </span>
          <span className="cal-score-nums text-[10px] text-[color:var(--text-muted)] font-[family-name:var(--font-mono)]">{myScore}–{opScore}</span>
        </div>
      ) : (
        <div className="cal-time text-[9px] text-[color:var(--text-dim)] font-[family-name:var(--font-mono)] whitespace-nowrap overflow-hidden text-ellipsis">
          {game.venue_city || '—'}
        </div>
      )}
    </div>
  );
}
