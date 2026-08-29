import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetch } from '../hooks/useFetch';
import { fetchTeamSeasonsCompare, fetchTeamSeasonsCompareTeams, fetchTeamHeadToHead } from '../utils/nhlApi';
import { fetchPWHLTeamSeasonsCompare, fetchPWHLTeamSeasonsCompareTeams, fetchPWHLTeamHeadToHead } from '../utils/pwhlApi';
import { fetchAHLTeamSeasonsCompare, fetchAHLTeamSeasonsCompareTeams, fetchAHLTeamHeadToHead } from '../utils/ahlApi';
import { fetchComparisonSeasons } from '../utils/seasonClient';
import { normalizeComparisonSeasons } from '../utils/seasonComparison';
import { getTeamXgTrend } from '../utils/supabaseClient';
import { ALL_TEAMS } from '../utils/teamConfig';
import { PWHL_TEAMS } from '../utils/pwhlConfig';
import { AHL_TEAMS, getAHLTeamById } from '../utils/ahlConfig';
import SeasonComparisonPicker from './SeasonComparisonPicker';
import SeasonOverlayChart from './SeasonOverlayChart';
import TeamOpponentPicker from './TeamOpponentPicker';
import TeamLogo from './TeamLogo';
// This component's own .h2h-*/.compare-mode-*/.cvt-* styles migrated to
// Tailwind (Phase 8) -- SeasonComparisonPicker.css deleted, closing out the
// last real leftover from the Session 97/Phase 3 deferral documented below
// (that phase migrated this component's popup-shell classes but explicitly
// left these ones "out of scope... a separate file, untouched" -- never
// picked up again until this phase). Confirmed via full-app grep this file
// was this component's ONLY consumer for every one of its ~20 classes --
// no hidden cross-file usage, no light-mode-overrides.css entries (every
// color here already resolves through design tokens with their own
// [data-theme="light"] :root variants, not raw rgba(255,255,255,x)
// literals needing a component-level override), no Cypress selector
// dependency.

// Tailwind migration (Session 97, Phase 3, sub-PR 3) -- this component used
// to reuse PlayerPopup's popup-shell classes from PlayersView.css
// (.player-popup, .pp-header, .stat-section, .stat-row, etc); that file is
// deleted now that every consumer (PlayerPopup.jsx, PWHLPlayerPopup.jsx,
// PlayerComparisonPopup.jsx, this file) has migrated. .popup-backdrop
// stays a literal className -- it's a separate, permanently-shared global
// class in index.css, not part of PlayersView.css.
//
// Cypress marker classnames kept (audited via grep): player-popup, pp-name,
// pp-first, pp-close, pp-body (players.cy.js), stat-section (pwhl-team.cy.js,
// team.cy.js), stat-row (pwhl-team.cy.js).
const PLAYER_POPUP_CLASSES = 'player-popup bg-[var(--bg1)] border-[0.5px] border-[var(--border-2)] rounded-t-[var(--radius-lg)] w-full max-w-[420px] max-h-[90vh] overflow-y-auto overflow-x-hidden shadow-[0_-8px_40px_rgba(0,0,0,0.5)] animate-[slide-up_0.2s_cubic-bezier(0.34,1.2,0.64,1)] min-[560px]:rounded-[var(--radius-lg)] min-[560px]:animate-[pop-in_0.2s_cubic-bezier(0.34,1.2,0.64,1)]'
const PP_HEADER_CLASSES = 'pp-header flex items-start gap-[14px] p-4 border-b-[0.5px] border-[var(--border)] [background:linear-gradient(135deg,rgba(204,34,0,0.07)_0%,transparent_55%)] relative'
const PP_PHOTO_WRAP_CLASSES = 'shrink-0'
const PP_IDENTITY_CLASSES = 'flex-1 min-w-0 flex flex-col gap-1'
const PP_NAME_CLASSES = 'pp-name flex flex-col leading-[1.1]'
const PP_FIRST_CLASSES = 'pp-first text-[12px] text-[color:var(--text-muted)]'
const PP_BIRTH_CLASSES = 'text-[10px] text-[color:var(--text-dim)] mt-[2px]'
const PP_CLOSE_CLASSES = 'pp-close absolute top-3 right-3 w-[28px] h-[28px] rounded-full bg-[var(--bg3)] text-[color:var(--text-muted)] text-[12px] flex items-center justify-center [transition:all_0.12s] hover:bg-[var(--bg4)] hover:text-[color:var(--text)]'
const PP_BODY_CLASSES = 'pp-body pt-2 pb-4'
const PP_NO_STATS_CLASSES = 'text-center p-5 text-[12px] text-[color:var(--text-dim)] italic'

const SECTION_CLASSES = 'stat-section border-b-[0.5px] border-[var(--border)]'
const SECTION_HEADER_CLASSES = 'stat-section-header w-full flex items-center py-[10px] px-4 gap-2 bg-transparent border-0 cursor-pointer text-left [transition:background_0.12s] hover:bg-[var(--bg2)]'
const SECTION_LABEL_CLASSES = 'flex-1 text-[13px] font-semibold text-[color:var(--text)]'
const SECTION_BODY_CLASSES = 'stat-section-body py-1 px-4 pb-3'
const SECTION_PEERS_CLASSES = 'stat-section-peers flex flex-wrap gap-[10px] px-4'

const ROW_CLASSES = 'stat-row flex items-center justify-between py-[6px] border-b-[0.5px] border-[rgba(255,255,255,0.04)]'
const ROW_LEFT_CLASSES = 'flex items-center gap-[6px] flex-1 min-w-0'
const ROW_LABEL_CLASSES = 'text-[13px] text-[color:var(--text-muted)]'
const ROW_VALUE_CLASSES = 'font-[family-name:var(--font-display)] text-[18px] font-bold text-[color:var(--text)] shrink-0 min-w-[48px] text-right'

// Head-to-head scoreboard/narrative + team-vs-team mode-switch classes
// (Phase 8, previously SeasonComparisonPicker.css -- see this file's own
// header comment). Colors all reference design tokens, no light-mode
// override needed. h2hDotPulse hoisted to index.css alongside the app's
// other shared keyframes -- deliberately kept distinct from pulse-dot/
// dt-pulse/ppPulse/lv-pulse (all superficially similar "pulse" animations
// but each with genuinely different curves), matching this migration's
// established precedent of not force-unifying near-identical keyframes.
const H2H_SCOREBOARD_CLASSES = 'h2h-scoreboard bg-[var(--bg2)] border-[0.5px] border-[color:var(--border-2)] rounded-[12px] p-4.5 mt-3 mx-4 text-center'
const H2H_SCOREBOARD_LABEL_CLASSES = 'h2h-scoreboard-label text-[11px] font-semibold uppercase tracking-[0.04em] text-[color:var(--text-dim)] mb-3'
const H2H_SCOREBOARD_TEAMS_CLASSES = 'h2h-scoreboard-teams flex items-center justify-center gap-[18px] mb-3.5'
const H2H_SCOREBOARD_TEAM_CLASSES = 'h2h-scoreboard-team flex flex-col items-center gap-1.5'
const H2H_SCOREBOARD_WINS_CLASSES = 'h2h-scoreboard-wins font-[family-name:var(--font-display)] text-[28px] font-bold text-[color:var(--text)]'
const H2H_SCOREBOARD_VS_CLASSES = 'h2h-scoreboard-vs text-[12px] text-[color:var(--text-dim)]'
const H2H_SCOREBOARD_PILLS_CLASSES = 'h2h-scoreboard-pills flex justify-center gap-2 flex-wrap'
const H2H_PILL_CLASSES = 'h2h-pill bg-[var(--red-dim)] text-[color:var(--red-bright)] text-[12px] font-semibold py-1 px-2.5 rounded-full'

const H2H_NARRATIVE_CLASSES = 'h2h-narrative bg-[var(--bg2)] border-[0.5px] border-[color:var(--border-2)] rounded-[12px] p-3.5 mt-2.5 mx-4'
const H2H_NARRATIVE_LABEL_CLASSES = 'h2h-narrative-label text-[9px] font-bold tracking-[0.1em] uppercase text-[color:var(--red-bright)] mb-2 flex items-center gap-1.5'
const H2H_NARRATIVE_TEXT_CLASSES = 'h2h-narrative-text text-[13px] text-[color:var(--text-muted)] leading-[1.6] text-left'
const H2H_NARRATIVE_LOADING_CLASSES = 'h2h-narrative-loading flex items-center gap-2 text-[12px] text-[color:var(--text-dim)]'
const H2H_NARRATIVE_DOT_CLASSES = 'h2h-narrative-dot w-1.5 h-1.5 bg-[var(--red-bright)] rounded-full animate-[h2hDotPulse_1.2s_ease-in-out_infinite]'

// .compare-mode-toggle is only ever used in this one place, always combined
// with .compare-submode-toggle -- the original CSS's margin race (both
// classes set margin/margin-bottom, .compare-submode-toggle's fuller
// shorthand always won on source order) is resolved here by simply merging
// both rules' resolved output into one class list rather than two.
const COMPARE_SUBMODE_TOGGLE_CLASSES = 'compare-mode-toggle compare-submode-toggle flex gap-1.5 mt-1 mx-4 mb-3'
// .compare-mode-btn/.compare-mode-btn-active originally relied on source
// order + an explicit .compare-mode-btn-active:hover rule to keep an
// active button red on hover (both .compare-mode-btn:hover and
// .compare-mode-btn-active alone shared equal specificity, and without
// that explicit hover rule, hovering an active button would have
// incorrectly shown the inactive hover color). Rebuilt here as two
// non-overlapping branches (lesson #9 shape) instead -- the active branch
// never carries a hover utility at all, so there's nothing for it to lose
// a specificity fight against.
const COMPARE_MODE_BTN_BASE = 'rounded-[var(--radius-sm)] py-1.5 px-3 font-[family-name:var(--font-body)] text-[12px] font-semibold cursor-pointer min-h-0'
function compareModeBtnClasses(isActive) {
  return isActive
    ? `compare-mode-btn compare-mode-btn-active ${COMPARE_MODE_BTN_BASE} bg-[var(--red-dim)] border-[0.5px] border-[color:var(--red-border)] text-[color:var(--text)]`
    : `compare-mode-btn ${COMPARE_MODE_BTN_BASE} bg-[var(--bg2)] border-[0.5px] border-[color:var(--border-2)] text-[color:var(--text-muted)] hover:bg-[var(--bg3)] hover:text-[color:var(--text)]`
}

const CVT_TEAM_LOGOS_CLASSES = 'cvt-team-logos flex items-center gap-2'
const CVT_VS_CLASSES = 'cvt-vs text-[11px] font-semibold text-[color:var(--text-dim)]'
const CVT_MODE_SWITCH_CLASSES = 'cvt-mode-switch flex gap-0.5 bg-[var(--bg2)] border-[0.5px] border-[color:var(--border-2)] rounded-full p-0.5 mr-8'
// .cvt-mode-switch button had no base className of its own in the original
// markup -- it relied entirely on the ".cvt-mode-switch button" descendant
// selector for shape/sizing. Given explicit per-element Tailwind classes
// instead, matching this migration's established practice of not
// reproducing descendant selectors. .cvt-mode-switch-active originally
// needed !important to beat ".cvt-mode-switch button:hover"'s higher
// specificity ((0,2,1) vs (0,1,0)) -- not needed here for the same reason
// as compareModeBtnClasses above: the active branch carries no hover
// utility to lose a fight against. bg-transparent deliberately NOT in the
// shared base -- live-verified this exact mistake: with bg-transparent in
// CVT_MODE_BTN_BASE and bg-[var(--red-dim)] appended only in the active
// branch, the active button rendered fully transparent instead of red-dim
// (Tailwind's generated-stylesheet order, not className string order,
// decided the winner between the two same-property utility classes --
// lesson #9/#17/#18 shape). Each branch now supplies its own complete,
// non-competing background instead.
const CVT_MODE_BTN_BASE = 'w-[26px] h-6 flex items-center justify-center rounded-full text-[12px] leading-[1] cursor-pointer min-h-0'
function cvtModeBtnClasses(isActive) {
  return isActive
    ? `cvt-mode-switch-active ${CVT_MODE_BTN_BASE} bg-[var(--red-dim)]`
    : `${CVT_MODE_BTN_BASE} bg-transparent hover:bg-[var(--bg3)]`
}

// A season with zero comparable seasons shouldn't lock the picker down to
// maxSelected=0 (which would make every chip permanently disabled) --
// fall back to unlimited (null) until the real count is known.
const FALLBACK_MAX_SELECTED = null;

// Up to ~3 visually distinct dash patterns before they blur together --
// used as a secondary cue alongside the color ramp below, cycling if more
// seasons than patterns are selected (per Session 66's spec: dash pattern
// alone doesn't scale, so it's never the only distinguishing signal).
const DASH_PATTERNS = [undefined, '6 4', '2 3'];

// Newest selected season gets full team-color saturation; older seasons
// fade toward a floor alpha so the chart still reads past ~3-4 overlaid
// seasons instead of becoming an indistinguishable knot of full-opacity
// lines. `index` is position within seasons sorted newest-first.
function hexToRgba(hex, alpha) {
  const clean = String(hex).replace('#', '');
  if (clean.length !== 6) return hex; // not a hex color (unexpected) -- pass through
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function seasonRampColor(baseHex, index, total) {
  if (total <= 1) return baseHex;
  const MIN_ALPHA = 0.35;
  const alpha = 1 - (index / (total - 1)) * (1 - MIN_ALPHA);
  return hexToRgba(baseHex, Number(alpha.toFixed(2)));
}

// Resolves {abbr, color} for TeamLogo from whatever value a team is
// keyed by -- an NHL abbr string directly, or a PWHL/AHL numeric team_id
// (which <select> always round-trips as a string, so compared loosely
// here rather than assuming a type). Used for both the popup's own team
// and, once picked, its vs-Team opponent (Session 86 header redesign).
function resolveTeamLogo(league, value) {
  if (league === 'pwhl') {
    const t = PWHL_TEAMS.find(t => String(t.teamId) === String(value));
    return { abbr: t?.abbr, color: t?.displayColor };
  }
  if (league === 'ahl') {
    const t = getAHLTeamById(Number(value));
    return { abbr: t?.abbr, color: t?.displayColor };
  }
  return { abbr: value, color: undefined };
}

// TeamLogo's sport prop -- 'ahl'/'pwhl'/'nhl', not just the binary
// pwhl-vs-nhl check this file used before AHL support existed.
function sportFor(league) {
  return league === 'ahl' ? 'ahl' : league === 'pwhl' ? 'pwhl' : 'nhl';
}

// Box-score fields only for v1 (Session 64 locked decision) -- Corsi/xG/WAR
// excluded because they're null across every season for both leagues right
// now, not just older ones (SESSION_63_FINDINGS.md). fmt defaults to the
// raw value; pct fields are stored as 0-1 fractions in Supabase.
const METRICS = [
  { key: 'gamesPlayed',  label: 'GP' },
  { key: 'wins',         label: 'W' },
  { key: 'losses',       label: 'L' },
  { key: 'otLosses',     label: 'OTL' },
  { key: 'points',       label: 'PTS' },
  { key: 'goalsFor',     label: 'GF' },
  { key: 'goalsAgainst', label: 'GA' },
  { key: 'ppPct',        label: 'PP%', fmt: v => `${(v * 100).toFixed(1)}%` },
  { key: 'pkPct',        label: 'PK%', fmt: v => `${(v * 100).toFixed(1)}%` },
];

function MetricRow({ label, value, fmt }) {
  // Row exists (team has data for this season) but this specific field is
  // null -- "not tracked yet" state, distinct from the whole-season "not
  // yet available" case in TeamCompareSeasonCard below.
  const display = value == null ? '—' : (fmt ? fmt(value) : value);
  return (
    <div className={ROW_CLASSES}>
      <div className={ROW_LEFT_CLASSES}><span className={ROW_LABEL_CLASSES}>{label}</span></div>
      <span className={ROW_VALUE_CLASSES}>{display}</span>
    </div>
  );
}

function TeamCompareSeasonCard({ label, row }) {
  const { t } = useTranslation();
  return (
    <div className={SECTION_CLASSES}>
      <div className={SECTION_HEADER_CLASSES}>
        <span className={SECTION_LABEL_CLASSES}>{label}</span>
      </div>
      <div className={SECTION_BODY_CLASSES}>
        {!row && (
          <div className={PP_NO_STATS_CLASSES}>{t('teamComparisonPopup.notYetAvailable')}</div>
        )}
        {row && METRICS.map(m => <MetricRow key={m.key} label={m.label} value={row[m.key]} fmt={m.fmt} />)}
      </div>
    </div>
  );
}

// Mode 1 of Team vs Team (Session 86): two teams, one season. Reuses
// TeamCompareSeasonCard's exact "row present vs Not yet available" shape,
// just keyed by team instead of season -- the underlying Worker routes
// (/team-seasons/compare-teams, /pwhl/team-seasons/compare-teams) already
// return a gap the same way /team-seasons/compare does.
//
// Opponent is lifted all the way to the parent (Session 88: shared with
// HeadToHeadPanel below, one picker for both sub-tabs) and rendered once
// by the parent, not here -- this panel only owns the season picker.
function FullStatComparisonPanel({ league, teamValue, teamLabel, opponent, opponentLabel, season, onSeasonChange }) {
  const { t } = useTranslation();
  const selectedSeason = season[0] ?? null;
  const fetchFn = league === 'ahl' ? fetchAHLTeamSeasonsCompareTeams
    : league === 'pwhl' ? fetchPWHLTeamSeasonsCompareTeams
    : fetchTeamSeasonsCompareTeams;
  const { data: rows, loading } = useFetch(
    () => (opponent && selectedSeason) ? fetchFn(teamValue, opponent, selectedSeason) : Promise.resolve([]),
    [teamValue, opponent, selectedSeason]
  );

  const rowByTeam = new Map((rows || []).map(r => [String(r.team), r]));

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <SeasonComparisonPicker
          league={league}
          selected={season}
          onChange={onSeasonChange}
          maxSelected={1}
        />
      </div>

      {!opponent && (
        <div className={PP_NO_STATS_CLASSES}>{t('teamComparisonPopup.chooseOpponentAndSeason')}</div>
      )}
      {opponent && !selectedSeason && (
        <div className={PP_NO_STATS_CLASSES}>{t('teamComparisonPopup.chooseSeason')}</div>
      )}

      {loading && opponent && selectedSeason && (
        <div className={PP_NO_STATS_CLASSES}>{t('common.loading')}</div>
      )}
      {!loading && opponent && selectedSeason && (
        <div className={SECTION_PEERS_CLASSES}>
          <TeamCompareSeasonCard label={teamLabel} row={rowByTeam.get(String(teamValue))} />
          <TeamCompareSeasonCard label={opponentLabel} row={rowByTeam.get(String(opponent))} />
        </div>
      )}
    </>
  );
}

// AI narrative layer on top of the templated head-to-head stats above
// (Session 90 fast-follow). Posts the derived-insight fields the Worker
// already computed (record/window/streak/isThinSample) back to it --
// deliberately not the full h2h.games array, which the narrative route
// never reads and which can run long for teams with several seasons of
// history; no point shipping that on every popup open. Auto-generates on
// mount and the Worker caches in KV so only the first viewer of a given
// pair pays the generation cost, same UX pattern as PeriodSummary.jsx's
// game/period narratives.
function HeadToHeadNarrativeCard({ league, h2h, teamADisplay, teamBDisplay }) {
  const { t } = useTranslation();
  const [narrative, setNarrative] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const { teamA, teamB, totalMeetings, allTimeRecord, recentWindow, currentStreak, isThinSample } = h2h;

  useEffect(() => {
    let cancelled = false;
    setNarrative(null);
    setFailed(false);
    setLoading(true);

    const workerUrl = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_WORKER_URL : null;
    if (!workerUrl) { setLoading(false); setFailed(true); return undefined; }

    const path = league === 'ahl' ? '/ahl/team-seasons/head-to-head/narrative'
      : league === 'pwhl' ? '/pwhl/team-seasons/head-to-head/narrative'
      : '/team-seasons/head-to-head/narrative';

    fetch(`${workerUrl}${path}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        teamA, teamB, teamADisplay, teamBDisplay,
        totalMeetings, allTimeRecord, recentWindow, currentStreak, isThinSample,
      }),
    })
      .then(res => res.ok ? res.json() : Promise.reject(new Error(`Worker ${res.status}`)))
      .then(data => {
        if (cancelled) return;
        if (data.narrative) setNarrative(data.narrative);
        else setFailed(true);
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [league, teamA, teamB, totalMeetings, teamADisplay, teamBDisplay]);

  if (failed) return null;

  return (
    <div className={H2H_NARRATIVE_CLASSES}>
      <div className={H2H_NARRATIVE_LABEL_CLASSES}>{t('gameStatsPopup.summary.badge')}</div>
      {loading ? (
        <div className={H2H_NARRATIVE_LOADING_CLASSES}>
          <div className={H2H_NARRATIVE_DOT_CLASSES} />
          {t('periodSummary.ai.generating')}
        </div>
      ) : (
        <div className={H2H_NARRATIVE_TEXT_CLASSES}>{narrative}</div>
      )}
    </div>
  );
}

// Mode 2 of Team vs Team (Session 88): all-time head-to-head record,
// recent-window record, and current streak between two teams, across
// every season on record. Derived-insight math (record/streak/window)
// is computed server-side (buildHeadToHeadPayload in eyewall-poller's
// shared.js) -- this component only renders what the route already
// returns, no client-side recomputation.
// Scoreboard layout (Session 88 follow-up, Option B of 3 mockups) -- leads
// with both team logos and a big win-count split rather than a label/value
// stat-row list, with recent-window and streak as secondary pills below.
// "Since 2023-24" (NHL/PWHL) / "Since 2025-26" (AHL) (not "All-time")
// because that's genuinely as far back as each league's own game_log
// goes in this app -- see HEAD_TO_HEAD_BRIEF.md's historical-depth note
// (NHL/PWHL) and ahl_game_boxscore.py's docstring (AHL's earliest season
// with real ingested data is season_id 90, 2025-26). Don't relabel this
// "all-time" even though the underlying route has no season filter.
function HeadToHeadPanel({ league, teamValue, opponent, teamLabel, opponentLabel }) {
  const { t } = useTranslation();
  const fetchFn = league === 'ahl' ? fetchAHLTeamHeadToHead
    : league === 'pwhl' ? fetchPWHLTeamHeadToHead
    : fetchTeamHeadToHead;
  const { data: h2h, loading } = useFetch(
    () => opponent ? fetchFn(teamValue, opponent) : Promise.resolve(null),
    [teamValue, opponent]
  );

  if (!opponent) {
    return <div className={PP_NO_STATS_CLASSES}>{t('teamComparisonPopup.chooseOpponentForH2h')}</div>;
  }
  if (loading) {
    return <div className={PP_NO_STATS_CLASSES}>{t('common.loading')}</div>;
  }
  if (!h2h || h2h.totalMeetings === 0) {
    return <div className={PP_NO_STATS_CLASSES}>{t('teamComparisonPopup.noMeetings')}</div>;
  }

  const { totalMeetings, allTimeRecord, recentWindow, currentStreak, isThinSample } = h2h;
  const sport = sportFor(league);
  const { abbr: teamAbbr } = resolveTeamLogo(league, teamValue);
  const { abbr: opponentAbbr } = resolveTeamLogo(league, opponent);
  const streakAbbr = currentStreak?.holder === 'A' ? teamAbbr : opponentAbbr;

  return (
    <>
      <div className={H2H_SCOREBOARD_CLASSES}>
        <div className={H2H_SCOREBOARD_LABEL_CLASSES}>{t(league === 'ahl' ? 'teamComparisonPopup.since2025' : 'teamComparisonPopup.since2023')}</div>
        <div className={H2H_SCOREBOARD_TEAMS_CLASSES}>
          <div className={H2H_SCOREBOARD_TEAM_CLASSES}>
            <TeamLogo abbr={teamAbbr} sport={sport} size={36} />
            <div className={H2H_SCOREBOARD_WINS_CLASSES}>{allTimeRecord.teamAWins}</div>
          </div>
          <div className={H2H_SCOREBOARD_VS_CLASSES}>{t('teamComparisonPopup.wins')}</div>
          <div className={H2H_SCOREBOARD_TEAM_CLASSES}>
            <TeamLogo abbr={opponentAbbr} sport={sport} size={36} />
            <div className={H2H_SCOREBOARD_WINS_CLASSES}>{allTimeRecord.teamBWins}</div>
          </div>
        </div>
        <div className={H2H_SCOREBOARD_PILLS_CLASSES}>
          {recentWindow.size < totalMeetings && (
            <span className={H2H_PILL_CLASSES}>{t('teamComparisonPopup.lastN', { count: recentWindow.size, winsA: recentWindow.teamAWins, winsB: recentWindow.teamBWins })}</span>
          )}
          {currentStreak && (
            <span className={H2H_PILL_CLASSES}>{t('teamComparisonPopup.streakPill', { abbr: streakAbbr, count: currentStreak.count })}</span>
          )}
        </div>
        {isThinSample && (
          <div className={PP_NO_STATS_CLASSES} style={{ marginTop: 10 }}>
            {t('teamComparisonPopup.thinSample', { count: totalMeetings })}
          </div>
        )}
      </div>
      <HeadToHeadNarrativeCard league={league} h2h={h2h} teamADisplay={teamLabel} teamBDisplay={opponentLabel} />
    </>
  );
}

// Generic team-level season-over-season comparison popup — one component
// for both leagues (per Session 64's "no PWHL-specific" mandate), same
// pattern as SeasonComparisonPicker itself. `teamValue` is a team abbr for
// NHL, a numeric team_id for PWHL — whatever fetchTeamSeasonsCompare /
// fetchPWHLTeamSeasonsCompare expect.
export default function TeamComparisonPopup({ league, teamValue, teamLabel, onClose }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState('season'); // 'season' | 'team'
  const [teamSubMode, setTeamSubMode] = useState('full'); // 'full' | 'h2h', only relevant when mode === 'team'
  const [compareSeasons, setCompareSeasons] = useState([]);

  // vs-Team opponent/season selection (Session 86 header redesign) --
  // lifted here, not owned by FullStatComparisonPanel, so the header can
  // read "Team A vs Team B" once both are picked.
  const [vsTeamOpponent, setVsTeamOpponent] = useState(null);
  const [vsTeamSeason, setVsTeamSeason] = useState([]); // SeasonComparisonPicker-shaped: 0 or 1 value
  const opponentOptions = league === 'ahl'
    ? AHL_TEAMS.map(team => ({ value: team.teamId, label: team.displayName }))
    : league === 'pwhl'
    ? PWHL_TEAMS.map(team => ({ value: team.teamId, label: team.displayName }))
    : ALL_TEAMS.map(team => ({ value: team.abbr, label: team.displayName }));

  // Header logo -- current team, always; opponent, once picked (Option C:
  // the header itself becomes the toggle). Opponent selection is shared
  // across both vs-Team sub-tabs (Session 88), so this no longer checks
  // teamSubMode -- Full Stat Comparison and Head-to-Head show the same
  // "Team A vs Team B" header once an opponent is picked, regardless of
  // which sub-tab is active.
  const { abbr: logoAbbr, color: logoColor } = resolveTeamLogo(league, teamValue);
  const showOpponentInHeader = mode === 'team' && !!vsTeamOpponent;
  const { abbr: opponentLogoAbbr, color: opponentLogoColor } = showOpponentInHeader
    ? resolveTeamLogo(league, vsTeamOpponent)
    : {};
  const opponentLabel = vsTeamOpponent
    ? (opponentOptions.find(opt => String(opt.value) === String(vsTeamOpponent))?.label || t('teamComparisonPopup.opponentFallback'))
    : null;

  const fetchFn = league === 'ahl' ? fetchAHLTeamSeasonsCompare
    : league === 'pwhl' ? fetchPWHLTeamSeasonsCompare
    : fetchTeamSeasonsCompare;
  const { data: rows, loading } = useFetch(
    () => compareSeasons.length ? fetchFn(teamValue, compareSeasons) : Promise.resolve([]),
    [teamValue, compareSeasons.join(',')]
  );

  // Reuses the same memoized fetch SeasonComparisonPicker itself calls --
  // purely for season labels ("2025-26 Playoffs" etc), no second request.
  const { data: comparisonConfig } = useFetch(fetchComparisonSeasons, []);
  const seasonOptions = normalizeComparisonSeasons(league, comparisonConfig?.[league]?.seasons);
  const labelFor = (val) => seasonOptions.find(s => s.value === val)?.label || t('teamComparisonPopup.seasonFallback', { val });

  // Session 66: no artificial 4-season ceiling. This is the same
  // /config/seasons/comparison-backed list SeasonComparisonPicker itself
  // renders chips from -- the least-bad existing source of "how many
  // seasons exist to compare" (there's no per-team team_seasons count
  // endpoint; see Session 63/65 notes on the missing NHL season-list
  // source of truth). It's a league-wide list, not literally scoped to
  // this team, but it's what's already being fetched here and it's what
  // bounds the picker's own chip set, so it can't ever under-count what's
  // actually selectable.
  const maxSelected = seasonOptions.length > 0 ? seasonOptions.length : FALLBACK_MAX_SELECTED;

  const rowBySeason = new Map((rows || []).map(r => [r.season, r]));

  // ── xGF% overlay chart (Session 66, NHL-only v1) ───────────────────────
  // getTeamXgTrend is the one metric with real per-game trend data already
  // plumbed end-to-end (see XgfSparkline in TeamView.jsx for the
  // single-season version this generalizes). GF/GA/PP%/PK% per-game trends
  // need new poller work and are explicitly out of scope for this pass.
  const isNhl = league === 'nhl';
  const { data: xgTrendsBySeason, loading: xgLoading } = useFetch(
    () => (isNhl && compareSeasons.length)
      ? Promise.all(compareSeasons.map(season => getTeamXgTrend(teamValue, season)))
      : Promise.resolve([]),
    [isNhl, teamValue, compareSeasons.join(',')]
  );

  const teamColor = isNhl
    ? (getComputedStyle(document.documentElement).getPropertyValue('--team-primary').trim() || '#e63946')
    : null;

  const sortedDesc = useMemo(() => [...compareSeasons].sort((a, b) => b - a), [compareSeasons]);

  const chartSeries = useMemo(() => {
    if (!isNhl || !xgTrendsBySeason) return [];
    const trendBySeason = new Map(compareSeasons.map((s, i) => [s, xgTrendsBySeason[i] || null]));
    return sortedDesc.map((season, idx) => {
      const games = trendBySeason.get(season)?.season || [];
      return {
        seasonLabel: labelFor(season),
        color: seasonRampColor(teamColor, idx, sortedDesc.length),
        dashPattern: DASH_PATTERNS[idx % DASH_PATTERNS.length],
        dataPoints: games.map((g, i) => ({ gameNumber: i + 1, value: g.xgfPct })),
      };
    });
  }, [isNhl, xgTrendsBySeason, compareSeasons, sortedDesc, teamColor]);

  // Header content (Option C, Session 86): the identity row itself carries
  // the vs-Team state once an opponent is picked, rather than a generic
  // title that never changes. Falls back to the plain team label/name for
  // every other state (vs-Season mode, or vs-Team mode with nothing picked
  // yet) so there's no empty/broken-looking header while the user is still
  // choosing.
  const headerTitle = showOpponentInHeader
    ? t('teamComparisonPopup.headerVs', { team: teamLabel, opponent: opponentLabel })
    : (mode === 'team' ? t('teamComparisonPopup.headerCompareTeams') : t('teamComparisonPopup.headerCompareSeasons'));
  // Season label only applies to Full Stat Comparison -- Head-to-Head
  // spans all seasons, so it has no single season to show here.
  const headerSubtitle = showOpponentInHeader && teamSubMode === 'full' && vsTeamSeason[0]
    ? labelFor(vsTeamSeason[0])
    : (showOpponentInHeader && teamSubMode === 'h2h' ? t(league === 'ahl' ? 'teamComparisonPopup.since2025' : 'teamComparisonPopup.since2023') : teamLabel);

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div className={PLAYER_POPUP_CLASSES} onClick={e => e.stopPropagation()}>
        <div className={PP_HEADER_CLASSES}>
          <div className={CVT_TEAM_LOGOS_CLASSES}>
            <div className={PP_PHOTO_WRAP_CLASSES}>
              <TeamLogo abbr={logoAbbr} sport={sportFor(league)} size={44} color={logoColor} />
            </div>
            {showOpponentInHeader && (
              <>
                <span className={CVT_VS_CLASSES}>{t('playerComparisonPopup.vs')}</span>
                <div className={PP_PHOTO_WRAP_CLASSES}>
                  <TeamLogo abbr={opponentLogoAbbr} sport={sportFor(league)} size={44} color={opponentLogoColor} />
                </div>
              </>
            )}
          </div>
          <div className={PP_IDENTITY_CLASSES}>
            <div className={PP_NAME_CLASSES}><span className={PP_FIRST_CLASSES}>{headerTitle}</span></div>
            <div className={PP_BIRTH_CLASSES}>{headerSubtitle}</div>
          </div>
          <div className={CVT_MODE_SWITCH_CLASSES} role="group" aria-label={t('teamComparisonPopup.comparisonModeAriaLabel')}>
            <button
              type="button"
              className={cvtModeBtnClasses(mode === 'season')}
              aria-pressed={mode === 'season'}
              onClick={() => setMode('season')}
              title={t('teamComparisonPopup.vsSeasonTitle')}
              aria-label={t('teamComparisonPopup.compareVsSeasonAriaLabel')}
            >
              📅
            </button>
            <button
              type="button"
              className={cvtModeBtnClasses(mode === 'team')}
              aria-pressed={mode === 'team'}
              onClick={() => setMode('team')}
              title={t('teamComparisonPopup.vsTeamTitle')}
              aria-label={t('teamComparisonPopup.compareVsTeamAriaLabel')}
            >
              🆚
            </button>
          </div>
          <button className={PP_CLOSE_CLASSES} onClick={onClose} aria-label={t('common.close')}>✕</button>
        </div>

        <div className={PP_BODY_CLASSES}>
          {mode === 'season' && (
            <>
              <SeasonComparisonPicker
                league={league}
                selected={compareSeasons}
                onChange={setCompareSeasons}
                maxSelected={maxSelected}
              />
              {compareSeasons.length === 0 && (
                <div className={PP_NO_STATS_CLASSES}>{t('playerPopup.compareTab.selectSeasons')}</div>
              )}

              {isNhl && compareSeasons.length > 0 && (
                // xg-overlay-section keeps the .stat-section visual styling (card
                // shell, header, body) but is deliberately excluded by that class
                // alone -- team.cy.js counts ".stat-section" to mean "one card
                // per selected season," and this section isn't one of those.
                <div className={`${SECTION_CLASSES} xg-overlay-section`}>
                  <div className={SECTION_HEADER_CLASSES}>
                    <span className={SECTION_LABEL_CLASSES}>{t('teamView.advanced.xgfSparklineTitle')}</span>
                  </div>
                  <div className={SECTION_BODY_CLASSES}>
                    {xgLoading
                      ? <div className={PP_NO_STATS_CLASSES}>{t('playerPopup.compareTab.loadingChart')}</div>
                      : (
                        <SeasonOverlayChart
                          series={chartSeries}
                          metricLabel={t('teamComparisonPopup.xgfMetricLabel')}
                          valueFormatter={(v) => `${v}%`}
                          yDomain={[0, 100]}
                          referenceValue={50}
                        />
                      )}
                  </div>
                </div>
              )}

              {loading && compareSeasons.length > 0 && (
                <div className={PP_NO_STATS_CLASSES}>{t('common.loading')}</div>
              )}
              {!loading && sortedDesc.length > 0 && (
                <div className={SECTION_PEERS_CLASSES}>
                  {sortedDesc.map(season => (
                    <TeamCompareSeasonCard
                      key={season}
                      label={labelFor(season)}
                      row={rowBySeason.get(season)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {mode === 'team' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <TeamOpponentPicker teams={opponentOptions} value={vsTeamOpponent} onChange={setVsTeamOpponent} excludeValue={teamValue} />
              </div>

              <div className={COMPARE_SUBMODE_TOGGLE_CLASSES} role="group" aria-label={t('teamComparisonPopup.teamComparisonTypeAriaLabel')}>
                <button
                  type="button"
                  className={compareModeBtnClasses(teamSubMode === 'full')}
                  aria-pressed={teamSubMode === 'full'}
                  onClick={() => setTeamSubMode('full')}
                >
                  {t('teamComparisonPopup.fullStatComparison')}
                </button>
                <button
                  type="button"
                  className={compareModeBtnClasses(teamSubMode === 'h2h')}
                  aria-pressed={teamSubMode === 'h2h'}
                  onClick={() => setTeamSubMode('h2h')}
                >
                  {t('teamComparisonPopup.headToHead')}
                </button>
              </div>

              {teamSubMode === 'full'
                ? (
                  <FullStatComparisonPanel
                    league={league}
                    teamValue={teamValue}
                    teamLabel={teamLabel}
                    opponent={vsTeamOpponent}
                    opponentLabel={opponentLabel}
                    season={vsTeamSeason}
                    onSeasonChange={setVsTeamSeason}
                  />
                )
                : (
                  <HeadToHeadPanel
                    league={league}
                    teamValue={teamValue}
                    opponent={vsTeamOpponent}
                    teamLabel={teamLabel}
                    opponentLabel={opponentLabel}
                  />
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
