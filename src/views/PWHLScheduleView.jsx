// views/PWHLScheduleView.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PWHLCalendarView } from '../components/PWHLCalendarView';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { fetchPWHLSchedule, fetchPWHLTeamRecord, PWHL_TEAM_CONFIG, PWHL_TEAM_ID } from '../utils/pwhlApi';
import {
  PWHL_CURRENT_SEASON, PWHL_TEAM_MAP, getPWHLTeamById,
  PWHL_REGULAR_SEASONS as REGULAR_SEASONS,
  PWHL_PLAYOFF_SEASONS as PLAYOFF_SEASONS,
} from '../utils/pwhlConfig';
import TeamLogo from '../components/TeamLogo';
import PWHLGameStatsPopup from '../components/PWHLGameStatsPopup';
import PWHLGamePreviewPopup from '../components/PWHLGamePreviewPopup';
import { PAGE_CLASSES } from '../utils/pageClasses';
// ScheduleView.css import removed (Phase 6, ScheduleView.css sub-PR 5, the
// final sub-PR) -- the file is now fully deleted, all classes migrated to
// Tailwind across sub-PRs 1-5.
// ShotMapView.css import removed (Phase 5, sub-PR 1) -- this file's only
// dependency on it was .context-pill (+.playoffs/.regular), now fully
// migrated to CONTEXT_PILL_VARIANTS/contextPillClasses() below. Found and
// fixed a real bug along the way: 2 of 3 usages here applied the modifier
// as `playoff` (singular) while the CSS only ever defined `.playoffs`
// (plural) -- those "Playoff" tags rendered with zero green styling, just
// the bare pill shape, since .context-pill is used nowhere else in the
// app to have surfaced this any other way.

// CONTEXT_PILL_VARIANTS/contextPillClasses (Phase 5, ShotMapView.css
// sub-PR 1) -- the rest of this file is still plain CSS (ScheduleView.css,
// a later phase), this is a lone shared-class migration same shape as
// PWHLTeamView.jsx's METRICS_GRID_4_CLASSES.
const CONTEXT_PILL_VARIANTS = {
  playoffs: 'bg-[rgba(61,186,126,0.12)] text-[color:var(--green)] border-[0.5px] border-[rgba(61,186,126,0.3)]',
  regular: 'bg-[var(--red-dim)] text-[color:var(--red-bright)] border-[0.5px] border-[color:var(--red-border)]',
};
const contextPillClasses = (variant) =>
  `text-[11px] font-semibold py-[3px] px-[10px] rounded-[20px] ${CONTEXT_PILL_VARIANTS[variant]}`;

// .empty-state (Phase 6, ScheduleView.css sub-PR 1) -- same reasoning as
// ScheduleView.jsx's own copy of these constants: .empty-state's padding
// is owned by index.css (shared, unlayered), margin-bottom:8px kept as a
// plain Tailwind utility since it doesn't collide with .card.
const EMPTY_STATE_CLASSES = 'empty-state text-center mb-2';
const EMPTY_ICON_CLASSES = 'empty-icon text-[32px] mb-2.5';
const EMPTY_TITLE_CLASSES = 'empty-title text-[14px] font-medium mb-1';
const EMPTY_SUB_CLASSES = 'empty-sub text-[12px] text-[color:var(--text-muted)]';

// .sched-tabs (Phase 6, ScheduleView.css sub-PR 2) -- same reasoning as
// ScheduleView.jsx's own copy of these constants. This file sets
// .view-mode-toggle's margin-left inline rather than depending on
// ScheduleView.css's `.sched-tabs .view-mode-toggle` descendant rule, so
// .sched-tabs is kept as a literal marker here purely for consistency, not
// because anything still depends on it functionally.
const SCHED_TABS_CLASSES = 'sched-tabs flex items-center gap-1.5 mb-3.5 border-b-[0.5px] border-b-[color:var(--border)] pb-2.5';
const schedTabClasses = (active) => {
  const base = 'sched-tab py-1.5 px-4 rounded-[20px] text-[13px] font-medium flex items-center gap-1.5 [transition:all_0.15s] border-[0.5px]';
  return active
    ? `${base} active bg-[var(--red-dim)] text-[color:var(--red-bright)] border-[color:var(--red-border)]`
    : `${base} text-[color:var(--text-muted)] border-transparent`;
};

// .vm-btn:hover and .active are equal-specificity compound selectors in the
// original CSS with active winning on hover too (later in source) -- same
// shape as .sort-btn/.skater-toggle-btn, so hover is scoped to the
// non-active variant only.
const vmBtnClasses = (active) => {
  const base = 'vm-btn py-1 px-2.5 rounded-[14px] text-[14px] border-none cursor-pointer [transition:all_0.15s] leading-none';
  return active
    ? `${base} active bg-[var(--bg4)] text-[color:var(--text)] shadow-[0_1px_4px_rgba(0,0,0,0.3)]`
    : `${base} bg-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text)]`;
};

// .scroll-top-btn's bottom position uses BottomNav's real height incl.
// safe-area inset (Session 43).
const SCROLL_TOP_BTN_CLASSES = 'scroll-top-btn fixed [bottom:calc(var(--nav-height)+env(safe-area-inset-bottom,0px)+16px)] right-4 z-[150] bg-[var(--bg2)] border-[0.5px] border-[color:var(--border-2)] rounded-[20px] py-[7px] px-3.5 text-[12px] font-medium text-[color:var(--text-muted)] cursor-pointer shadow-[0_4px_16px_rgba(0,0,0,0.4)] [transition:all_0.15s] [animation:fade-in_0.2s_ease] hover:bg-[var(--bg3)] hover:text-[color:var(--text)] hover:border-[color:var(--red-border)]';

const roundSectionHeaderClasses = (current) => {
  const base = 'round-section-header flex items-center justify-between py-2.5 px-3 mb-2 rounded-[var(--radius-sm)] cursor-pointer w-full text-left [transition:background_0.15s] hover:[filter:brightness(1.08)]';
  return current
    ? `${base} current bg-[var(--red-dim)] border-[0.5px] border-[color:var(--red-border)]`
    : `${base} older bg-[var(--bg2)] border-[0.5px] border-[color:var(--border)]`;
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function _gameStr(g) {
  // Always return a string or null — never the game object itself
  if (typeof g === 'string') return g;
  return (g?.game_date || g?.date_with_day) ?? null;
}

function formatDate(g) {
  const str = _gameStr(g);
  if (!str) return '—';
  if (str.includes(',')) {
    // "Fri, Nov 21" → "Nov 21"
    return str.split(',').slice(1).join(',').trim();
  }
  const d = new Date(str + 'T12:00:00Z');
  if (isNaN(d)) return str;
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function dayOfWeek(g) {
  const str = _gameStr(g);
  if (!str) return '';
  if (str.includes(',')) return str.split(',')[0].trim(); // "Fri"
  const d = new Date(str + 'T12:00:00Z');
  if (isNaN(d)) return '';
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()];
}

export default function PWHLScheduleView() {
  const team     = PWHL_TEAM_CONFIG;
  const teamId   = PWHL_TEAM_ID;
  const abbr     = team?.abbr || '—';
  const color    = team?.displayColor || 'var(--text-dim)';
  const navigate = useNavigate();

  const [tab,      setTab]      = useState('Regular Season');
  const [season,   setSeason]   = useState(PWHL_CURRENT_SEASON);
  const [poSeason, setPoSeason] = useState(9); // current playoffs season

  // useState's initial value only runs once, at first mount -- if this
  // component mounts before pwhlConfig.js's async live-season fetch
  // resolves, `season` would otherwise lock onto the fallback value
  // forever, even though PWHL_CURRENT_SEASON itself goes on to update
  // correctly. Same fix as PWHLPlayersView.jsx: catch up via the event
  // pwhlConfig.js dispatches on resolution, but only if the user hasn't
  // manually picked a season themselves.
  const userPickedSeason = useRef(false);
  useEffect(() => {
    function handleSeasonUpdate(e) {
      if (!userPickedSeason.current) setSeason(e.detail);
    }
    window.addEventListener('eyewall:pwhl-season-updated', handleSeasonUpdate);
    return () => window.removeEventListener('eyewall:pwhl-season-updated', handleSeasonUpdate);
  }, []);
  const [popup,    setPopup]    = useState(null);
  const [regSort,  setRegSort]  = useState('desc');
  const [viewMode, setViewMode] = useState('list');   // 'list' | 'calendar'
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [showScrollTop, setShowScrollTop] = useState(false);
  const pageRef = useRef(null);

  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const onScroll = () => setShowScrollTop(el.scrollTop > 300);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => pageRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

  // Fetch regular + playoff schedule in parallel
  const { data: regSchedule, loading: regLoading } = useFetch(
    () => teamId ? fetchPWHLSchedule(teamId, season)   : Promise.resolve(null), [teamId, season]);
  const { data: poSchedule,  loading: poLoading  } = useFetch(
    () => teamId ? fetchPWHLSchedule(teamId, poSeason) : Promise.resolve(null), [teamId, poSeason]);
  // Fetch authoritative record from standings (has reg_wins/non_reg_wins/ot_losses breakdown)
  const { data: teamRecord } = useFetch(
    () => teamId ? fetchPWHLTeamRecord(teamId, season) : Promise.resolve(null), [teamId, season]);

  const { completed: regCompleted, upcoming: regUpcoming, record: regRecord } = useMemo(() => {
    return splitGames(regSchedule, teamId);
  }, [regSchedule, teamId]);

  const { completed: _poCompleted, upcoming: _poUpcoming, record: poRecord } = useMemo(() => {
    return splitGames(poSchedule, teamId);
  }, [poSchedule, teamId]);

  const sortedRegCompleted = useMemo(() =>
    [...regCompleted].sort((a,b) => regSort === 'desc' ? b.game_id - a.game_id : a.game_id - b.game_id),
    [regCompleted, regSort]);

  const seasonLabel = REGULAR_SEASONS.find(s => s.id === season)?.label || String(season);
  const poLabel     = PLAYOFF_SEASONS.find(s => s.id === poSeason)?.label || String(poSeason);

  if (!abbr || !teamId) {
    return (
      <div className={PAGE_CLASSES}>
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ color: 'var(--text-dim)' }}>No PWHL team selected.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE_CLASSES} ref={pageRef}>
      <div className="sched-header mb-3">
        <h2 className="sched-title font-[family-name:var(--font-display)] text-[18px] font-bold mb-0.5">
          <TeamLogo abbr={abbr} sport="pwhl" size={22} color={color} />
          {seasonLabel} Schedule
        </h2>
        <div className="sched-record text-[12px] text-[color:var(--text-muted)] flex items-center gap-2 mt-1">
          {teamRecord ? (
            <>
              <strong>
                {teamRecord.reg_wins ?? teamRecord.wins ?? regRecord.w}–{teamRecord.non_reg_wins ?? regRecord.otw}–{teamRecord.ot_losses ?? regRecord.otl}–{teamRecord.losses ?? regRecord.l}
              </strong>
              <span className="pts-badge bg-[rgba(240,160,48,0.15)] text-[color:var(--amber)] text-[11px] py-[1px] px-[7px] rounded-[10px] font-medium">{teamRecord.points ?? regRecord.pts} pts</span>
              <span style={{ fontSize:9, color:'var(--text-dim)', marginLeft:4 }}>W-OTW-OTL-L</span>
            </>
          ) : (
            <>
              <strong>{regRecord.w}–{regRecord.otw}–{regRecord.otl}–{regRecord.l}</strong>
              <span className="pts-badge bg-[rgba(240,160,48,0.15)] text-[color:var(--amber)] text-[11px] py-[1px] px-[7px] rounded-[10px] font-medium">{regRecord.pts} pts</span>
              <span style={{ fontSize:9, color:'var(--text-dim)', marginLeft:4 }}>W-OTW-OTL-L</span>
            </>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className={SCHED_TABS_CLASSES}>
        {['Regular Season', 'Playoffs'].map(t => (
          <button key={t} className={schedTabClasses(tab === t)} onClick={() => setTab(t)}>
            {t}
            {t === 'Playoffs' && (poRecord.w + poRecord.otw) > 0 && (
              <span className="tab-badge bg-[var(--green)] text-[#000] text-[10px] font-bold py-[1px] px-1.5 rounded-[10px]">{poRecord.w + poRecord.otw}–{poRecord.otl + poRecord.l}</span>
            )}
          </button>
        ))}

        {/* List / Calendar toggle — matches NHL icons */}
        <div className="view-mode-toggle flex gap-0.5 bg-[var(--bg2)] border-[0.5px] border-[color:var(--border)] rounded-[20px] p-[3px] shrink-0 ml-auto">
          <button className={vmBtnClasses(viewMode === 'list')}
            onClick={() => setViewMode('list')} title="Card view">≡</button>
          <button className={vmBtnClasses(viewMode === 'calendar')}
            onClick={() => setViewMode('calendar')} title="Calendar view">📅</button>
        </div>
      </div>

      {/* ── Regular Season tab ── */}
      {tab === 'Regular Season' && (
        <>
          {/* Season picker */}
          <div className={SCHED_TABS_CLASSES} style={{ marginBottom: 4, marginTop: 0 }}>
            {REGULAR_SEASONS.map(s => (
              <button key={s.id} className={schedTabClasses(season === s.id)}
                onClick={() => { userPickedSeason.current = true; setSeason(s.id); }}>{s.label}</button>
            ))}
          </div>

          {/* SortBar — counts + sort toggle, mirrors NHL */}
          {!regLoading && regSchedule?.length > 0 && viewMode === 'list' && (
            <PWHLSortBar
              sortOrder={regSort}
              setSortOrder={setRegSort}
              completedCount={regCompleted.length}
              upcomingCount={regUpcoming.length}
            />
          )}

          {regLoading && <LoadingCards count={5} />}

          {!regLoading && !regSchedule?.length && (
            <div className={`card ${EMPTY_STATE_CLASSES}`}>
              <div className={EMPTY_ICON_CLASSES}>📅</div>
              <div className={EMPTY_TITLE_CLASSES}>No games found</div>
              <div className={EMPTY_SUB_CLASSES}>No regular season data for {seasonLabel}.</div>
            </div>
          )}

          {!regLoading && regSchedule?.length > 0 && viewMode === 'list' && (
            <>
              {regUpcoming.map(g => (
                <UpcomingCard key={g.game_id} game={g} teamId={teamId} abbr={abbr} color={color}
                  onClick={() => setPopup(g)} />
              ))}
              {sortedRegCompleted.map(g => (
                <CompletedCard key={g.game_id} game={g} teamId={teamId} abbr={abbr} color={color}
                  onClick={() => setPopup(g)} />
              ))}
            </>
          )}

          {!regLoading && regSchedule?.length > 0 && viewMode === 'calendar' && (
            <PWHLCalendarView
              games={regSchedule}
              calMonth={calMonth}
              setCalMonth={setCalMonth}
              onGamePopup={setPopup}
              teamId={teamId}
            />
          )}
        </>
      )}

      {/* ── Playoffs tab ── */}
      {tab === 'Playoffs' && (
        <>
          {/* Playoff season picker */}
          <div className={SCHED_TABS_CLASSES} style={{ marginBottom: 4, marginTop: 0 }}>
            {PLAYOFF_SEASONS.map(s => (
              <button key={s.id} className={schedTabClasses(poSeason === s.id)}
                onClick={() => setPoSeason(s.id)}>{s.label}</button>
            ))}
          </div>

          {poLoading && <LoadingCards count={4} />}

          {!poLoading && !poSchedule?.length && (
            <div className={`card ${EMPTY_STATE_CLASSES}`}>
              <div className={EMPTY_ICON_CLASSES}>🏆</div>
              <div className={EMPTY_TITLE_CLASSES}>No playoff games</div>
              <div className={EMPTY_SUB_CLASSES}>{abbr} did not participate in the {poLabel}.</div>
            </div>
          )}

          {!poLoading && poSchedule?.length > 0 && (
            <PWHLPlayoffsTab
              games={poSchedule}
              teamId={teamId}
              abbr={abbr}
              color={color}
              onGamePopup={setPopup}
            />
          )}
        </>
      )}

      {/* Game detail popup — Final games get the box-score popup, upcoming
          games get the pre-game preview popup (Session 51) */}
      {popup && popup.game_state === 'Final' && (
        <PWHLGameStatsPopup
          game={popup} teamId={teamId} abbr={abbr} color={color}
          onClose={() => setPopup(null)}
          onViewShotMap={() => {
            setPopup(null);
            navigate('/pwhl/shots', { state: { selectedGameId: popup.game_id } });
          }}
        />
      )}
      {popup && popup.game_state !== 'Final' && (
        <PWHLGamePreviewPopup
          game={popup} teamId={teamId} abbr={abbr} color={color}
          onClose={() => setPopup(null)}
        />
      )}

      {showScrollTop && (
        <button className={SCROLL_TOP_BTN_CLASSES} onClick={scrollToTop} aria-label="Back to top">
          ↑ Top
        </button>
      )}
    </div>
  );
}

// ── Shared helper ─────────────────────────────────────────────
function splitGames(schedule, teamId) {
  if (!schedule?.length) return { completed: [], upcoming: [], record: { w:0, otw:0, otl:0, l:0, pts:0 } };
  const completed = schedule.filter(g => g.game_state === 'Final');
  const upcoming  = schedule.filter(g => g.game_state !== 'Final');
  // PWHL uses 3-2-1-0 points system:
  //   Regulation win  = 3 pts
  //   OT/SO win       = 2 pts
  //   OT/SO loss      = 1 pt
  //   Regulation loss = 0 pts
  let w=0, otw=0, otl=0, l=0;
  for (const g of completed) {
    const isHome  = g.home_team_id === teamId;
    const my      = isHome ? g.home_score : g.away_score;
    const op      = isHome ? g.away_score : g.home_score;
    const isExtra = g.ot || g.shootout;
    if (my > op)  { isExtra ? otw++ : w++;  }
    else          { isExtra ? otl++ : l++;   }
  }
  const pts = w*3 + otw*2 + otl*1;
  return { completed, upcoming, record: { w, otw, otl, l, pts } };
}

// ── PWHL Playoffs Tab ────────────────────────────────────────
// Mirrors NHL PlayoffsTab: collapsible rounds, series card, game list.
// PWHL-specific: 2 rounds (Semifinal + Final), best-of-5 (first to 3 wins).
function PWHLPlayoffsTab({ games, teamId, abbr, color, onGamePopup }) {
  const [collapsed, setCollapsed] = React.useState({});
  const toggle = round => setCollapsed(p => ({ ...p, [round]: !p[round] }));

  // Build series by identifying unique team pairs
  // Each game has home_team_id / away_team_id — pair them as a canonical key
  const seriesMap = {};
  games.forEach(g => {
    const ids = [g.home_team_id, g.away_team_id].sort((a,b) => a - b);
    const key = ids.join('-');
    if (!seriesMap[key]) {
      seriesMap[key] = {
        key,
        teamA: ids[0], teamB: ids[1],
        games: [],
        winsA: 0, winsB: 0,
      };
    }
    seriesMap[key].games.push(g);
    if (g.game_state === 'Final') {
      const homeWon = g.home_score > g.away_score;
      const aIsHome = g.home_team_id === ids[0];
      if (homeWon === aIsHome) seriesMap[key].winsA++;
      else seriesMap[key].winsB++;
    }
  });

  // Sort series by earliest game date — later series = deeper round
  const allSeries = Object.values(seriesMap).sort((a,b) =>
    Math.min(...a.games.map(g=>g.game_id)) - Math.min(...b.games.map(g=>g.game_id))
  );

  // Since schedule only contains selected team's games, we see at most 2 series:
  // - If team was eliminated in semis: 1 series (Semi only)
  // - If team reached the Final: 2 series (Semi + Final, in chronological order)
  // Distinguish by overlap: if 2 series and the second starts after the first ends = Final.
  // Simpler: the LATER-starting series (higher min game_id) is always the Final.
  let semifinalSeries, finalSeries;
  if (allSeries.length <= 1) {
    // Only one series — could be Semi or Final; use game count/timing to guess
    // If season has a known final and this series starts late, treat as Final
    const _firstGameId = allSeries[0] ? Math.min(...allSeries[0].games.map(g=>g.game_id)) : 0;
    // Heuristic: if we only have 1 series and the team won it decisively, may have been the Final
    // Default: treat single series as Semi unless we can confirm otherwise
    semifinalSeries = allSeries;
    finalSeries     = [];
  } else {
    // 2 series: first chronologically = Semi, second = Final
    semifinalSeries = [allSeries[0]];
    finalSeries     = [allSeries[1]];
  }

  const ROUNDS = [
    { label: 'Walter Cup Final', series: finalSeries,    round: 2 },
    { label: 'Semifinals',              series: semifinalSeries, round: 1 },
  ];

  const maxRound = finalSeries.length > 0 ? 2 : 1;

  return (
    <div>
      {ROUNDS.map(({ label, series, round }) => {
        if (!series.length) return null;
        const isCurrentRound = round === maxRound;
        const isCollapsed    = collapsed[round] ?? (round < maxRound);

        return (
          <div key={round} className="round-section mb-5">
            {/* Collapsible round header */}
            <button
              className={roundSectionHeaderClasses(isCurrentRound)}
              onClick={() => toggle(round)}
              aria-expanded={!isCollapsed}
            >
              <div className="round-section-left flex items-center gap-2">
                <span className="round-collapse-icon text-[10px] text-[color:var(--text-dim)] w-2.5 shrink-0">{isCollapsed ? '▶' : '▼'}</span>
                <div className="round-header-info flex items-center gap-2">
                  <span className="round-section-label font-[family-name:var(--font-display)] text-[14px] font-bold uppercase tracking-[0.06em] text-[color:var(--text)]">{label}</span>
                </div>
                {isCurrentRound && series.some(s => s.winsA < 3 && s.winsB < 3 && s.games.some(g => g.game_state === 'Final')) && (
                  <span className="round-live-pill text-[10px] font-semibold py-[2px] px-[7px] rounded-[10px] bg-[rgba(61,186,126,0.15)] text-[color:var(--green)] border-[0.5px] border-[rgba(61,186,126,0.3)]">In progress</span>
                )}
              </div>
              <div className="round-section-right flex items-center gap-1.5">
                {/* Show our team's record across series in this round */}
                {(() => {
                  const ourSeries = series.find(s => s.teamA === teamId || s.teamB === teamId);
                  if (!ourSeries) return null;
                  const ourWins = ourSeries.teamA === teamId ? ourSeries.winsA : ourSeries.winsB;
                  const oppWins = ourSeries.teamA === teamId ? ourSeries.winsB : ourSeries.winsA;
                  const adv = ourWins >= 3;
                  const elim = oppWins >= 3;
                  return (
                    <>
                      <span className="round-section-record text-[12px] text-[color:var(--text-muted)] font-[family-name:var(--font-mono)] whitespace-nowrap">{ourWins}–{oppWins}</span>
                      {adv  && <span className="round-result-badge adv text-[14px] text-[color:var(--green)]">✅</span>}
                      {elim && <span className="round-result-badge elim text-[14px] text-[color:var(--red-bright)]">❌</span>}
                    </>
                  );
                })()}
              </div>
            </button>

            {/* Expanded: series card + games */}
            {!isCollapsed && (
              <>
                {series.map(s => {
                  const _isOurSeries = s.teamA === teamId || s.teamB === teamId;
                  const ourWins  = s.teamA === teamId ? s.winsA : s.winsB;
                  const oppWins  = s.teamA === teamId ? s.winsB : s.winsA;
                  const oppId    = s.teamA === teamId ? s.teamB : s.teamA;
                  const oppAbbr  = getPWHLTeamById(oppId)?.abbr || String(oppId);
                  const oppTeam  = PWHL_TEAM_MAP[oppAbbr];
                  const oppColor = oppTeam?.displayColor || 'var(--text-dim)';

                  return (
                    <div key={s.key}>
                      {/* Series card — mirrors NHL SeriesCard with 3-win threshold */}
                      <PWHLSeriesCard
                        series={s}
                        teamId={teamId}
                        abbr={abbr}
                        color={color}
                        oppAbbr={oppAbbr}
                        oppColor={oppColor}
                        ourWins={ourWins}
                        oppWins={oppWins}
                        isFinal={round === 2}
                      />

                      {/* Game list */}
                      {[...s.games]
                        .sort((a,b) => a.game_id - b.game_id)
                        .map((g, gi) => {
                          const isHome   = g.home_team_id === teamId;
                          const my       = isHome ? g.home_score : g.away_score;
                          const op       = isHome ? g.away_score : g.home_score;
                          const gOppId   = isHome ? g.away_team_id : g.home_team_id;
                          const gOppAbbr = getPWHLTeamById(gOppId)?.abbr || String(gOppId);
                          const gOppTeam = PWHL_TEAM_MAP[gOppAbbr];
                          const gOppColor = gOppTeam?.displayColor || 'var(--text-dim)';
                          const won      = my > op;
                          const isExtra  = g.ot || g.shootout;
                          const suffix   = g.shootout ? '/SO' : g.ot ? '/OT' : '';
                          const done     = g.game_state === 'Final';

                          return (
                            <div key={g.game_id}
                              className={`result-card card mb-2${done ? ' clickable cursor-pointer [transition:border-color_0.15s] hover:border-[color:var(--border-2)]' : ''}`}
                              onClick={done ? () => onGamePopup(g) : undefined}
                            >
                              <div className="result-top flex items-center gap-2 mb-1.5">
                                <span className="result-date text-[11px] text-[color:var(--text-muted)]">
                                  Game {gi + 1} · {dayOfWeek(g)} {formatDate(g)}
                                </span>
                                {done && (
                                  <span className={`result-outcome font-[family-name:var(--font-display)] text-[12px] font-bold py-[2px] px-2 rounded ${won ? 'win bg-[rgba(61,186,126,0.15)] text-[color:var(--green)]' : 'loss bg-[rgba(255,68,34,0.1)] text-[color:var(--red-bright)]'}`}>
                                    {won ? 'W' : (isExtra ? 'OT' : 'L')}{suffix}
                                  </span>
                                )}
                                {!done && <span className={contextPillClasses('regular')} style={{fontSize:9}}>Upcoming</span>}
                                {done && <span className="result-tap-hint text-[10px] text-[color:var(--text-dim)] ml-auto">Tap for stats →</span>}
                              </div>
                              <div className="result-score flex items-center gap-2 font-[family-name:var(--font-display)]">
                                <TeamLogo abbr={abbr} sport="pwhl" size={20} color={color} />
                                <span className="result-abbr text-[16px] font-bold" style={{ color }}>{abbr}</span>
                                {done && <span className="result-num text-[22px] font-bold" style={{ color }}>{my}</span>}
                                <span className="result-sep text-[color:var(--text-dim)]">{done ? '–' : 'vs'}</span>
                                {done && <span className="result-num muted text-[22px] font-bold text-[color:var(--text-muted)]">{op}</span>}
                                <span className="result-abbr muted text-[16px] font-bold text-[color:var(--text-muted)]">{gOppAbbr}</span>
                                <TeamLogo abbr={gOppAbbr} sport="pwhl" size={20} color={gOppColor} />
                                <span className="result-venue text-[10px] text-[color:var(--text-dim)] ml-auto font-[family-name:var(--font-body)]">{isHome ? 'Home' : 'Away'}</span>
                              </div>
                            </div>
                          );
                        })
                      }
                    </div>
                  );
                })}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── PWHL Series Card — best-of-5 (3 wins to advance) ─────────
// .pip's own "pip-opp" variant color always comes from the --opp-color CSS
// var set inline per span -- reused generically here for PWHL's own team
// pips too (not literally "the opponent"), same convention as elsewhere in
// this app (see IceRink.jsx's isCanes role naming).
const SERIES_PIP_BASE = 'pip w-[11px] h-[11px] rounded-full border-[1.5px] border-[color:var(--border-2)] shrink-0';
const seriesPipClasses = (filled) =>
  filled ? `${SERIES_PIP_BASE} pip-opp bg-[var(--opp-color,#7a8899)] border-[color:var(--opp-color,#7a8899)]`
         : `${SERIES_PIP_BASE} pip-empty bg-transparent`;

function PWHLSeriesCard({ series, teamId: _teamId, abbr, color, oppAbbr, oppColor, ourWins, oppWins, isFinal }) {
  const adv      = ourWins >= 3;
  const elim     = oppWins >= 3;
  const isActive = !adv && !elim && series.games.some(g => g.game_state === 'Final');
  const total    = series.games.length;

  return (
    <div className={`series-card card mb-2.5${isActive ? ' series-active' : ''}`}>
      <div className="series-top flex items-start justify-between mb-3 gap-2">
        <div className="series-top-left flex flex-col gap-0.5">
          <span className="series-status text-[11px] text-[color:var(--text-muted)] font-medium">
            {isActive ? '🔴 In progress' : adv ? (isFinal ? '🏆 Walter Cup Champions' : '✅ Advanced') : elim ? '❌ Eliminated' : '🗓 Upcoming'}
          </span>
        </div>
        <span className="series-games-played text-[11px] text-[color:var(--text-dim)] whitespace-nowrap pt-0.5">{total} game{total !== 1 ? 's' : ''} played</span>
        {ourWins === 3 && oppWins === 0 && <span className="series-sweep text-[11px] font-bold text-[color:var(--green)] ml-1.5">🧹 Sweep!</span>}
        {oppWins === 3 && ourWins === 0 && <span className="series-swept text-[11px] font-bold text-[color:var(--text-dim)] ml-1.5">🧹 Swept</span>}
      </div>
      <div className="series-body flex items-center gap-1 mb-1">
        {/* Our team */}
        <div className="series-side flex-1 flex flex-col gap-2">
          <div className="series-row flex items-center gap-[7px] flex-nowrap">
            <TeamLogo abbr={abbr} sport="pwhl" size={30} color={color} />
            <span className="series-abbr font-[family-name:var(--font-display)] text-[18px] font-bold leading-none whitespace-nowrap" style={{ color }}>{abbr}</span>
            <span className="series-wins font-[family-name:var(--font-display)] text-[36px] font-bold text-[color:var(--text)] leading-none">{ourWins}</span>
          </div>
          <div className="series-pips flex items-center gap-[5px]">
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className={seriesPipClasses(i < ourWins)}
                style={{ '--opp-color': color }} />
            ))}
          </div>
        </div>
        <div className="series-centre shrink-0 flex items-center mb-[22px] px-0.5">
          <span className="series-divider font-[family-name:var(--font-display)] text-[22px] font-light text-[color:var(--text-dim)]">–</span>
        </div>
        {/* Opponent */}
        <div className="series-side right flex-1 flex flex-col gap-2 items-end">
          <div className="series-row right flex items-center gap-[7px] flex-nowrap justify-end">
            <span className="series-wins font-[family-name:var(--font-display)] text-[36px] font-bold text-[color:var(--text)] leading-none">{oppWins}</span>
            <span className="series-abbr font-[family-name:var(--font-display)] text-[18px] font-bold leading-none whitespace-nowrap" style={{ color: oppColor }}>{oppAbbr}</span>
            <TeamLogo abbr={oppAbbr} sport="pwhl" size={30} color={oppColor} />
          </div>
          <div className="series-pips flex items-center gap-[5px] justify-end">
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className={seriesPipClasses(i < oppWins)}
                style={{ '--opp-color': oppColor }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SortBar — exact match of NHL GameCard SortBar ────────────
// .sort-btn:hover and .active are equal-specificity compound selectors in
// the original CSS with active winning on hover too (later in source) --
// same shape as .skater-toggle-btn in GameStatsPopup.jsx (sub-PR 3), so the
// hover color is scoped to the non-active variant only.
const sortBtnClasses = (active) => {
  const base = 'sort-btn py-1 px-2.5 rounded-[20px] text-[11px] font-medium border-[0.5px] cursor-pointer [transition:all_0.15s]';
  return active
    ? `${base} active bg-[var(--red-dim)] border-[color:var(--red-border)] text-[color:var(--red-bright)]`
    : `${base} bg-transparent border-[color:var(--border-2)] text-[color:var(--text-muted)] hover:text-[color:var(--text)]`;
};

function PWHLSortBar({ sortOrder, setSortOrder, completedCount, upcomingCount }) {
  return (
    <div className="sort-bar flex items-center justify-between gap-2.5 py-2 pb-2.5 border-b-[0.5px] border-b-[color:var(--border)] mb-2.5 flex-wrap">
      <span className="sort-bar-count text-[11px] text-[color:var(--text-dim)]">
        {completedCount} played{upcomingCount > 0 ? ` · ${upcomingCount} upcoming` : ''}
      </span>
      <div className="sort-bar-controls flex items-center gap-[5px]">
        <span className="sort-bar-label text-[11px] text-[color:var(--text-dim)] mr-0.5">Sort:</span>
        <button
          className={sortBtnClasses(sortOrder === 'desc')}
          onClick={() => setSortOrder('desc')}
          title="Newest first"
        >
          Newest first
        </button>
        <button
          className={sortBtnClasses(sortOrder === 'asc')}
          onClick={() => setSortOrder('asc')}
          title="Oldest first"
        >
          Oldest first
        </button>
      </div>
    </div>
  );
}

// ── Completed game card ───────────────────────────────────────
function CompletedCard({ game: g, teamId, abbr, color, onClick, isPlayoff }) {
  const isHome   = g.home_team_id === teamId;
  const my       = isHome ? g.home_score : g.away_score;
  const op       = isHome ? g.away_score : g.home_score;
  const oppId    = isHome ? g.away_team_id : g.home_team_id;
  const oppAbbr  = getPWHLTeamById(oppId)?.abbr || String(oppId);
  const oppTeam  = PWHL_TEAM_MAP[oppAbbr];
  const oppColor = oppTeam?.displayColor || 'var(--text-dim)';
  const won      = my > op;
  const isExtra  = g.ot || g.shootout;
  const suffix   = g.shootout ? '/SO' : g.ot ? '/OT' : '';
  // PWHL outcome labels: W (reg win), W/OT, L/OT, L (reg loss)
  const outcomeLabel = won ? 'W' : (isExtra ? 'OT' : 'L');

  return (
    <div className="result-card card clickable mb-2 cursor-pointer [transition:border-color_0.15s] hover:border-[color:var(--border-2)]" onClick={onClick}>
      <div className="result-top flex items-center gap-2 mb-1.5">
        <span className="result-date text-[11px] text-[color:var(--text-muted)]">{dayOfWeek(g)} {formatDate(g)}</span>
        <span className={`result-outcome font-[family-name:var(--font-display)] text-[12px] font-bold py-[2px] px-2 rounded ${won ? 'win bg-[rgba(61,186,126,0.15)] text-[color:var(--green)]' : 'loss bg-[rgba(255,68,34,0.1)] text-[color:var(--red-bright)]'}`}>
          {outcomeLabel}{suffix}
        </span>
        {isPlayoff && <span className={contextPillClasses('playoffs')} style={{ fontSize: 9 }}>Playoff</span>}
        <span className="result-tap-hint text-[10px] text-[color:var(--text-dim)] ml-auto">Tap for stats →</span>
      </div>
      <div className="result-score flex items-center gap-2 font-[family-name:var(--font-display)]">
        <TeamLogo abbr={abbr} sport="pwhl" size={20} color={color} />
        <span className="result-abbr text-[16px] font-bold" style={{ color }}>{abbr}</span>
        <span className="result-num text-[22px] font-bold" style={{ color }}>{my ?? '—'}</span>
        <span className="result-sep text-[color:var(--text-dim)]">–</span>
        <span className="result-num muted text-[22px] font-bold text-[color:var(--text-muted)]">{op ?? '—'}</span>
        <span className="result-abbr muted text-[16px] font-bold text-[color:var(--text-muted)]">{oppAbbr}</span>
        <TeamLogo abbr={oppAbbr} sport="pwhl" size={20} color={oppColor} />
        <span className="result-venue text-[10px] text-[color:var(--text-dim)] ml-auto font-[family-name:var(--font-body)]">{isHome ? 'Home' : 'Away'}</span>
      </div>
    </div>
  );
}

// ── Upcoming game card ────────────────────────────────────────
function UpcomingCard({ game: g, teamId, abbr, color, isPlayoff, onClick }) {
  const isHome   = g.home_team_id === teamId;
  const oppId    = isHome ? g.away_team_id : g.home_team_id;
  const oppAbbr  = getPWHLTeamById(oppId)?.abbr || String(oppId);
  const oppTeam  = PWHL_TEAM_MAP[oppAbbr];
  const oppColor = oppTeam?.displayColor || 'var(--text-dim)';

  return (
    <div className="card" style={{ marginBottom: 8, padding: '12px 14px', cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}>
      <div className="result-top" style={{ marginBottom: 6 }}>
        <span className="result-date">{dayOfWeek(g)} {formatDate(g)}</span>
        <span className={contextPillClasses(isPlayoff ? 'playoffs' : 'regular')} style={{ fontSize: 10 }}>
          {isPlayoff ? '🏆 Playoff' : 'Upcoming'}
        </span>
        <span className="result-venue">{isHome ? 'Home' : 'Away'}</span>
      </div>
      <div className="result-score">
        <TeamLogo abbr={abbr} sport="pwhl" size={20} color={color} />
        <span className="result-abbr" style={{ color }}>{abbr}</span>
        <span className="result-sep" style={{ fontSize: 14, color: 'var(--text-dim)' }}>vs</span>
        <span className="result-abbr muted">{oppAbbr}</span>
        <TeamLogo abbr={oppAbbr} sport="pwhl" size={20} color={oppColor} />
      </div>
      {onClick && <span className="result-tap-hint" style={{ marginTop: 6, display: 'inline-block' }}>Tap for preview →</span>}
    </div>
  );
}

function LoadingCards({ count }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className="card" style={{ marginBottom: 8, padding: 14 }}>
      <div className="skeleton" style={{ height: 10, width: '40%', marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 20, width: '70%', marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 10, width: '30%' }} />
    </div>
  ));
}
