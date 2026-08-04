// components/PlayerComparisonEntry.jsx (Session 91)
// "vs Player" entry point mounted in PlayerPopup.jsx / PWHLPlayerPopup.jsx
// headers. Deliberately NOT called "Compare" -- both popups already have a
// "🆚 Compare" tab meaning "compare this player's own past seasons"
// (Session 64/70); a second same-word affordance with a different meaning
// in the same popup would be genuinely confusing, not just redundant
// wording.
//
// Second player is picked via the same Fuse.js search index PlayerSearch.jsx
// (the topbar's global search) already uses -- filtered here to the same
// sport as `player` (same-league-only scope decision) and with `player`
// itself excluded from results.
import { useState, useRef, useEffect } from 'react';
import { searchPlayers } from '../utils/playerSearch';
import PlayerComparisonPopup from './PlayerComparisonPopup';
import './PlayerComparisonPopup.css';

const DEBOUNCE_MS = 250;

export default function PlayerComparisonEntry({ sport, player }) {
  const [open, setOpen]         = useState(false);
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [opponent, setOpponent] = useState(null);

  const wrapRef    = useRef(null);
  const inputRef   = useRef(null);
  const debounceRef = useRef(null);

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
    debounceRef.current = setTimeout(async () => {
      const r = await searchPlayers(q);
      setResults(r.filter(p => p.sport === sport && String(p.id) !== String(player?.id)));
      setSearching(false);
    }, DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [query, sport, player?.id]);

  function pick(p) {
    setOpponent(p);
    setOpen(false);
    setQuery('');
    setResults([]);
  }

  if (!player?.id) return null;

  return (
    <div className="pce-wrap" ref={wrapRef}>
      <button
        type="button"
        className="pce-toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label="Compare against another player"
        title="Compare against another player"
      >
        vs Player
      </button>

      {open && (
        <div className="pce-panel">
          <input
            ref={inputRef}
            className="pce-input"
            type="text"
            placeholder={`Search ${sport === 'pwhl' ? 'PWHL' : 'NHL'} players…`}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && setOpen(false)}
          />
          {searching && <div className="pce-status">Searching…</div>}
          {!searching && results.length > 0 && (
            <div className="pce-results" role="listbox">
              {results.map(p => (
                <button key={p.id} type="button" className="pce-result" onClick={() => pick(p)} role="option">
                  <span className="pce-result-name">{p.name}</span>
                  <span className="pce-result-meta">{p.team || '—'}{p.position ? ` · ${p.position}` : ''}</span>
                </button>
              ))}
            </div>
          )}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <div className="pce-status">No players found.</div>
          )}
        </div>
      )}

      {opponent && (
        <PlayerComparisonPopup
          sport={sport}
          playerA={player}
          playerB={opponent}
          onClose={() => setOpponent(null)}
        />
      )}
    </div>
  );
}
