// components/PlayerSearch.jsx
// Global player search (NHL + PWHL + AHL + ECHL) — lives in Topbar so it's
// reachable from any view. Fuzzy-matches via playerSearch.js's Fuse.js
// index, opens the sport-appropriate popup on selection using each popup's
// documented minimum shape (see PlayerPopup.jsx / PWHLPlayerPopup.jsx /
// AHLPlayerPopup.jsx / ECHLPlayerPopup.jsx headers) — all four self-fetch
// the rest, so this never needs a second network round trip before
// opening.
//
// AHL/ECHL added 2026-09 (a user asked whether search covered those
// leagues -- it didn't, silently returning zero results with no
// indication it was unsupported rather than "player not found"; fixed on
// the backend in the same pass, see eyewall-poller's players-search-index
// route). AHLPlayerPopup/ECHLPlayerPopup are lazy-loaded rather than
// statically imported like the NHL/PWHL ones above -- this file lives in
// the always-loaded Topbar, so a static import here would pull both
// popups into the main bundle for every user, including NHL/PWHL-only
// ones who will never see them.
import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { searchPlayers } from '../utils/playerSearch';
import { nhlSeasonLabel } from '../utils/seasonComparison';
import PlayerPopup from './PlayerPopup';
import PWHLPlayerPopup from './PWHLPlayerPopup';
import TeamLogo from './TeamLogo';
import { AHL_SEASONS, AHL_CURRENT_SEASON } from '../utils/ahlConfig';
import { ECHL_SEASONS, ECHL_CURRENT_SEASON } from '../utils/echlConfig';

const AHLPlayerPopup  = lazy(() => import('./AHLPlayerPopup'));
const ECHLPlayerPopup = lazy(() => import('./ECHLPlayerPopup'));

// AHLPlayerPopup/ECHLPlayerPopup have no built-in seasonLabel default the
// way PWHLPlayerPopup does (its own SEASON_LABEL) -- computed the same way
// AHLPlayersView.jsx/ECHLPlayersView.jsx already do, so a player opened
// from global search shows the same season label as one opened from the
// Players tab, not a blank one.
function ahlSeasonLabel() {
  return AHL_SEASONS.find(s => s.id === AHL_CURRENT_SEASON)?.label || String(AHL_CURRENT_SEASON);
}
function echlSeasonLabel() {
  return ECHL_SEASONS.find(s => s.id === ECHL_CURRENT_SEASON)?.label || String(ECHL_CURRENT_SEASON);
}

// Tailwind migration (Session 95, Phase 1) -- previously PlayerSearch.css.
// A few original class names are kept as literal marker strings alongside
// the Tailwind utilities (player-search-toggle/player-search-panel/
// player-search-input/player-search-result/psr-team/psr-team--stale) --
// player-search.cy.js and player-comparison.cy.js select and assert on
// these exact class names. They carry no CSS of their own anymore;
// Tailwind owns the visuals, these are pure test hooks now.
const WRAP_CLASSES = 'relative';
const TOGGLE_CLASSES = 'player-search-toggle flex items-center justify-center w-[32px] h-[32px] border-0 bg-transparent text-[color:var(--text)] text-[15px] cursor-pointer rounded-full hover:bg-[var(--bg3)]';
const PANEL_CLASSES = 'player-search-panel absolute top-[calc(100%+8px)] right-0 w-[min(340px,88vw)] bg-[var(--bg2)] border-[0.5px] border-[var(--border-2)] rounded-[var(--radius)] shadow-[0_8px_24px_rgba(0,0,0,0.35)] p-2 z-[200]';
const INPUT_ROW_CLASSES = 'flex items-center gap-1.5';
const INPUT_CLASSES = 'player-search-input flex-1 bg-[var(--bg1)] border-[0.5px] border-[var(--border-2)] rounded-[var(--radius-sm)] text-[color:var(--text)] font-[family-name:var(--font-body)] text-[14px] py-2 px-2.5 focus:outline-none focus:border-[var(--blue-bright)]';
const CLOSE_CLASSES = 'border-0 bg-transparent text-[color:var(--text-dim)] text-[14px] cursor-pointer py-1 px-1.5';
const STATUS_CLASSES = 'py-3 px-2 text-[color:var(--text-dim)] text-[13px] text-center';
const RESULTS_CLASSES = 'mt-1.5 max-h-[320px] overflow-y-auto flex flex-col gap-0.5';
const RESULT_CLASSES = 'player-search-result flex items-center gap-2.5 w-full border-0 bg-transparent text-[color:var(--text)] p-2 rounded-[var(--radius-sm)] cursor-pointer text-left hover:bg-[var(--bg3)]';
const PSR_NAME_CLASSES = 'flex-1 font-semibold text-[14px] whitespace-nowrap overflow-hidden text-ellipsis';
const PSR_META_CLASSES = 'flex items-center gap-1.5 text-[11px] text-[color:var(--text-dim)]';
const PSR_TEAM_CLASSES = 'psr-team font-[family-name:var(--font-mono)] min-w-[28px] text-right';
const PSR_TEAM_STALE_CLASSES = 'psr-team--stale opacity-65 italic';
const PSR_POS_CLASSES = 'bg-[var(--bg3)] rounded-[4px] py-[1px] px-[5px]';
const PSR_SPORT_CLASSES = 'rounded-[4px] py-[1px] px-[5px] font-bold tracking-[0.02em]';
const PSR_SPORT_COLOR = {
  nhl: 'bg-[var(--red-dim)] text-[color:var(--red-bright)]',
  pwhl: 'bg-[var(--blue-dim)] text-[color:var(--blue-bright)]',
  ahl: 'bg-[var(--bg3)] text-[color:var(--amber)]',
  echl: 'bg-[var(--bg3)] text-[color:var(--purple)]',
};

const DEBOUNCE_MS = 250;

function toPopupSelection(p) {
  if (p.sport === 'pwhl' || p.sport === 'ahl' || p.sport === 'echl') {
    return { sport: p.sport, player: { player_id: p.id, position: p.position } };
  }
  const [firstName, ...rest] = p.name.split(' ');
  return {
    sport: 'nhl',
    player: {
      id: p.id,
      firstName: { default: firstName },
      lastName: { default: rest.join(' ') },
      teamAbbrev: p.team,
      positionCode: p.position,
    },
  };
}

export default function PlayerSearch() {
  const { t } = useTranslation();
  const [open, setOpen]         = useState(false);
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);

  const wrapRef     = useRef(null);
  const inputRef     = useRef(null);
  const debounceRef  = useRef(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const requestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      const r = await searchPlayers(q);
      if (requestId === requestIdRef.current) {
        setResults(r);
        setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  function handleSelect(p) {
    setSelected(toPopupSelection(p));
    setOpen(false);
    setQuery('');
    setResults([]);
  }

  function closeSearch() {
    setOpen(false);
    setQuery('');
    setResults([]);
  }

  return (
    <div className={WRAP_CLASSES} ref={wrapRef}>
      <button
        className={TOGGLE_CLASSES}
        onClick={() => setOpen(o => !o)}
        aria-label={t('search.toggleAriaLabel')}
        aria-expanded={open}
      >
        🔍
      </button>

      {open && (
        <div className={PANEL_CLASSES}>
          <div className={INPUT_ROW_CLASSES}>
            <input
              ref={inputRef}
              className={INPUT_CLASSES}
              type="text"
              placeholder={t('search.placeholder')}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && closeSearch()}
            />
            <button className={CLOSE_CLASSES} onClick={closeSearch} aria-label={t('search.closeAriaLabel')}>✕</button>
          </div>

          {searching && <div className={STATUS_CLASSES}>{t('search.searching')}</div>}

          {!searching && results.length > 0 && (
            <div className={RESULTS_CLASSES} role="listbox">
              {results.map(p => (
                <button
                  key={`${p.sport}-${p.id}`}
                  className={RESULT_CLASSES}
                  onClick={() => handleSelect(p)}
                  role="option"
                >
                  <TeamLogo abbr={p.team} sport={p.sport} size={22} />
                  <span className={PSR_NAME_CLASSES}>{p.name}</span>
                  <span className={PSR_META_CLASSES}>
                    <span
                      className={`${PSR_TEAM_CLASSES} ${p.teamStale ? PSR_TEAM_STALE_CLASSES : ''}`}
                      title={
                        p.teamStale ? t('search.asOfSeason', { season: nhlSeasonLabel(p.teamSeason) })
                          : !p.team ? t('search.noTeamAssigned')
                          : undefined
                      }
                    >
                      {p.team || '—'}
                    </span>
                    {p.position && <span className={PSR_POS_CLASSES}>{p.position}</span>}
                    <span className={`${PSR_SPORT_CLASSES} ${PSR_SPORT_COLOR[p.sport] || ''}`}>{p.sport.toUpperCase()}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <div className={STATUS_CLASSES}>{t('search.noResults')}</div>
          )}
        </div>
      )}

      {selected?.sport === 'nhl' && (
        <PlayerPopup
          player={selected.player}
          inPlayoffs={false}
          standings={[]}
          isLeagueContext={true}
          onClose={() => setSelected(null)}
        />
      )}
      {selected?.sport === 'pwhl' && (
        <PWHLPlayerPopup
          player={selected.player}
          onClose={() => setSelected(null)}
        />
      )}
      {selected?.sport === 'ahl' && (
        <Suspense fallback={null}>
          <AHLPlayerPopup
            player={selected.player}
            seasonLabel={ahlSeasonLabel()}
            onClose={() => setSelected(null)}
          />
        </Suspense>
      )}
      {selected?.sport === 'echl' && (
        <Suspense fallback={null}>
          <ECHLPlayerPopup
            player={selected.player}
            seasonLabel={echlSeasonLabel()}
            onClose={() => setSelected(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
