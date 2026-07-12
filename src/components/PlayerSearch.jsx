// components/PlayerSearch.jsx
// Global player search (NHL + PWHL) — lives in Topbar so it's reachable
// from any view. Fuzzy-matches via playerSearch.js's Fuse.js index, opens
// the sport-appropriate popup on selection using each popup's documented
// minimum shape (see PlayerPopup.jsx / PWHLPlayerPopup.jsx headers) — both
// self-fetch the rest, so this never needs a second network round trip
// before opening.
import { useState, useRef, useEffect } from 'react';
import { searchPlayers } from '../utils/playerSearch';
import PlayerPopup from './PlayerPopup';
import PWHLPlayerPopup from './PWHLPlayerPopup';
import TeamLogo from './TeamLogo';
import './PlayerSearch.css';

const DEBOUNCE_MS = 250;

function toPopupSelection(p) {
  if (p.sport === 'pwhl') {
    return { sport: 'pwhl', player: { player_id: p.id, position: p.position } };
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
    <div className="player-search" ref={wrapRef}>
      <button
        className="player-search-toggle"
        onClick={() => setOpen(o => !o)}
        aria-label="Search players"
        aria-expanded={open}
      >
        🔍
      </button>

      {open && (
        <div className="player-search-panel">
          <div className="player-search-input-row">
            <input
              ref={inputRef}
              className="player-search-input"
              type="text"
              placeholder="Search NHL + PWHL players…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && closeSearch()}
            />
            <button className="player-search-close" onClick={closeSearch} aria-label="Close search">✕</button>
          </div>

          {searching && <div className="player-search-status">Searching…</div>}

          {!searching && results.length > 0 && (
            <div className="player-search-results" role="listbox">
              {results.map(p => (
                <button
                  key={`${p.sport}-${p.id}`}
                  className="player-search-result"
                  onClick={() => handleSelect(p)}
                  role="option"
                >
                  <TeamLogo abbr={p.team} sport={p.sport} size={22} />
                  <span className="psr-name">{p.name}</span>
                  <span className="psr-meta">
                    <span className="psr-team">{p.team || '—'}</span>
                    {p.position && <span className="psr-pos">{p.position}</span>}
                    <span className={`psr-sport psr-sport--${p.sport}`}>{p.sport.toUpperCase()}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <div className="player-search-status">No players found.</div>
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
    </div>
  );
}
