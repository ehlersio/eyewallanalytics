// components/PWHLCalendarView.jsx
// Mirrors NHL CalendarView.jsx — monthly grid of PWHL games.
// Completed games are clickable (fires onGamePopup). Upcoming shows date only.
import { PWHL_TEAM_MAP } from '../utils/pwhlConfig';
import TeamLogo from '../components/TeamLogo';

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DOW    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const TEAM_CODES = {1:'BOS',2:'MIN',3:'MTL',4:'NY',5:'OTT',6:'TOR',8:'SEA',9:'VAN'};

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
    <div className="calendar-wrap">
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
        <span className="cal-month-label">{MONTHS[month]} {year}</span>
        <button className="cal-nav-btn" onClick={nextMonth}>›</button>
      </div>

      <div className="cal-grid">
        {DOW.map(d => <div key={d} className="cal-dow">{d}</div>)}

        {cells.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} className="cal-cell empty" />;
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

function PWHLCalCell({ day, game, isToday, teamId, onGamePopup }) {
  if (!game) {
    return (
      <div className={`cal-cell no-game${isToday ? ' today' : ''}`}>
        <span className="cal-day-num">{day}</span>
      </div>
    );
  }

  const isHome       = game.home_team_id === teamId;
  const oppId        = isHome ? game.away_team_id : game.home_team_id;
  const oppAbbr      = TEAM_CODES[oppId] || String(oppId);
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

  const cellClass = [
    'cal-cell', 'has-game',
    result || 'upcoming',
    isToday ? 'today' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cellClass}
      onClick={() => isCompleted && onGamePopup(game)}
      title={game.venue_name ? `${game.venue_name}${game.venue_city ? ", " + game.venue_city : ""}` : undefined}
      style={{ cursor: isCompleted ? 'pointer' : 'default' }}
    >
      <div className="cal-cell-top">
        <span className="cal-day-num">{day}</span>
        <span className="cal-home-dot" title={isHome ? 'Home' : 'Away'}>
          {isHome ? '●' : '○'}
        </span>
      </div>

      <div className="cal-cell-body">
        <TeamLogo abbr={oppAbbr} sport="pwhl" size={20} color={oppColor} />
        <span className="cal-opp-abbr">{oppAbbr}</span>
      </div>

      {isCompleted && myScore != null ? (
        <div className="cal-score">
          <span className={result === 'win' ? 'cal-score-w' : 'cal-score-l'}>
            {result === 'win' ? 'W' : result === 'otl' ? 'OT' : 'L'}
          </span>
          <span className="cal-score-nums">{myScore}–{opScore}</span>
        </div>
      ) : (
        <div className="cal-time">
          {game.venue_city || '—'}
        </div>
      )}
    </div>
  );
}
