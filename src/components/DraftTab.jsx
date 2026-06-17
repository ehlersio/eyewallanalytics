// DraftTab.jsx
// Place in src/views/ alongside LeagueView.jsx
// Rendered by LeagueView when activeTab === 'draft'

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { capture } from '../utils/analytics';
import { getDraftRankings, getDraftPicks, getDraftOrder } from '../utils/nhlApi';
import TeamLogo from '../components/TeamLogo';
import './DraftTab.css';

// ─── Constants ───────────────────────────────────────────────────────────────

const TOTAL_PICKS = 224; // 32 teams × 7 rounds

const CATEGORY_TABS = [
  { id: 1, label: 'NA Skaters' },
  { id: 2, label: 'Intl Skaters' },
  { id: 3, label: 'NA Goalies' },
  { id: 4, label: 'Intl Goalies' },
];

// NA Skater (1) and NA Goalie (3) categories should only show North American players.
// NHL Central Scouting occasionally places international players in NA categories
// so we filter client-side to match the category intent.
const NA_COUNTRIES = new Set(['CAN', 'USA', 'MEX']);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtHeight(inches) {
  if (!inches) return '—';
  return `${Math.floor(inches / 12)}′${inches % 12}″`;
}

function fmtWeight(lbs) {
  return lbs ? `${lbs}` : '—';
}

// Midterm → Final rank delta arrow (same logic as MovementArrow in LeagueView)
function RankDelta({ final: finalRank, midterm }) {
  if (!midterm || !finalRank) return <span className="dt-delta dt-delta--none">—</span>;
  const diff = midterm - finalRank; // positive = rose, negative = fell
  if (diff === 0) return <span className="dt-delta dt-delta--flat">—</span>;
  if (diff > 0)   return <span className="dt-delta dt-delta--up">▲{diff}</span>;
  return               <span className="dt-delta dt-delta--down">▼{Math.abs(diff)}</span>;
}

// ─── Draft Popup ──────────────────────────────────────────────────────────────
// mode: 'prospect' (from rankings, pre-draft) | 'pick' (from draft board)

export function DraftPopup({ item, mode, onClose }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose();
  }

  if (!item) return null;

  const isPick = mode === 'pick';

  const firstName    = isPick ? item.prospect_first : item.first_name;
  const lastName     = isPick ? item.prospect_last  : item.last_name;
  const position     = item.position_code;
  const shoots       = item.shoots_catches;
  const heightIn     = item.height_inches;
  const weightLbs    = item.weight_pounds;
  const club         = item.last_amateur_club;
  const league       = item.last_amateur_league;
  const country      = item.birth_country;
  const finalRank    = item.final_rank;
  const midtermRank  = item.midterm_rank;
  const categoryId   = item.category_id;

  const categoryLabel = CATEGORY_TABS.find(c => c.id === categoryId)?.label ?? null;
  const isRanked      = !!finalRank;

  // Pick-mode extras
  const teamAbbrev   = item.team_abbrev;
  const pickOverall  = item.pick_overall;
  const round        = item.round;
  const pickInRound  = item.pick_in_round;
  const aiAnalysis   = item.ai_analysis;
  const aiPending    = isPick && !aiAnalysis;

  return (
    <div
      className="dt-popup-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={`${firstName} ${lastName} draft profile`}
    >
      <div className="dt-popup">
        <button className="dt-popup-close" onClick={onClose} aria-label="Close">✕</button>

        {/* Header */}
        <div className="dt-popup-header">
          {isPick && teamAbbrev && (
            <div className="dt-popup-team">
              <TeamLogo abbr={teamAbbrev} size={36} />
              <span className="dt-popup-team-abbr">{teamAbbrev}</span>
            </div>
          )}
          <div className="dt-popup-name-block">
            <span className="dt-popup-name">{firstName} {lastName}</span>
            <span className="dt-popup-meta">
              {position}{shoots ? ` · ${shoots}` : ''}
              {country ? ` · ${country}` : ''}
            </span>
          </div>
        </div>

        {/* Pick context */}
        {isPick && (
          <div className="dt-popup-pick-context">
            Pick #{pickOverall} · Round {round}, #{pickInRound} in round
          </div>
        )}

        {/* Rank badge */}
        {isRanked && (
          <div className="dt-popup-rank-row">
            <span className="dt-popup-rank-badge">
              #{finalRank} {categoryLabel}
            </span>
            {midtermRank && (
              <span className="dt-popup-rank-midterm">
                Midterm: #{midtermRank}
                {' '}<RankDelta final={finalRank} midterm={midtermRank} />
              </span>
            )}
          </div>
        )}
        {!isRanked && (
          <div className="dt-popup-rank-row">
            <span className="dt-popup-rank-badge dt-popup-rank-badge--unranked">Unranked</span>
          </div>
        )}

        {/* Bio grid */}
        <div className="dt-popup-bio">
          <div className="dt-popup-bio-item">
            <span className="dt-popup-bio-label">Height</span>
            <span className="dt-popup-bio-value">{fmtHeight(heightIn)}</span>
          </div>
          <div className="dt-popup-bio-item">
            <span className="dt-popup-bio-label">Weight</span>
            <span className="dt-popup-bio-value">{weightLbs ? `${weightLbs} lbs` : '—'}</span>
          </div>
          <div className="dt-popup-bio-item">
            <span className="dt-popup-bio-label">Club</span>
            <span className="dt-popup-bio-value">{club || '—'}</span>
          </div>
          <div className="dt-popup-bio-item">
            <span className="dt-popup-bio-label">League</span>
            <span className="dt-popup-bio-value">{league || '—'}</span>
          </div>
        </div>

        {/* AI Analysis (pick mode only) */}
        {isPick && (
          <div className="dt-popup-ai">
            <span className="dt-popup-ai-label">Sticks says</span>
            {aiPending ? (
              <div className="dt-popup-ai-pending">
                <span className="dt-spinner" />
                <span>Analysis generating…</span>
              </div>
            ) : (
              <p className="dt-popup-ai-text">{aiAnalysis}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Rankings Table ───────────────────────────────────────────────────────────

function RankingsTable({ prospects, onSelect }) {
  const wrapRef = useRef(null);
  const [atEnd, setAtEnd] = useState(false);

  function handleScroll(e) {
    const el = e.currentTarget;
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }

  if (!prospects?.length) {
    return <div className="dt-empty">No prospects found.</div>;
  }

  return (
    <div className="dt-table-container">
      <div className="dt-table-wrap" ref={wrapRef} onScroll={handleScroll}>
      <table className="dt-table" aria-label="Central Scouting rankings">
        <thead>
          <tr>
            <th className="dt-th dt-th--rank">Rank</th>
            <th className="dt-th dt-th--name">Name</th>
            <th className="dt-th dt-th--pos">Pos</th>
            <th className="dt-th dt-th--shoots">S/C</th>
            <th className="dt-th dt-th--ht">Ht</th>
            <th className="dt-th dt-th--wt">Wt</th>
            <th className="dt-th dt-th--club">Club</th>
            <th className="dt-th dt-th--league">League</th>
            <th className="dt-th dt-th--country">Ctry</th>
            <th className="dt-th dt-th--mid" title="Midterm rank → Final rank change">Mid→Fin</th>
          </tr>
        </thead>
        <tbody>
          {prospects.map((p) => (
            <tr
              key={`${p.category_id}-${p.final_rank}`}
              className="dt-row dt-row--clickable"
              onClick={() => { onSelect(p); capture('draft_prospect_clicked', { rank: p.final_rank, category: p.category_id }); }}
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(p)}
            >
              <td className="dt-td dt-td--rank">{p.final_rank}</td>
              <td className="dt-td dt-td--name">
                {p.first_name} {p.last_name}
              </td>
              <td className="dt-td dt-td--pos">{p.position_code ?? '—'}</td>
              <td className="dt-td dt-td--shoots">{p.shoots_catches ?? '—'}</td>
              <td className="dt-td dt-td--ht">{fmtHeight(p.height_inches)}</td>
              <td className="dt-td dt-td--wt">{fmtWeight(p.weight_pounds)}</td>
              <td className="dt-td dt-td--club">{p.last_amateur_club ?? '—'}</td>
              <td className="dt-td dt-td--league">{p.last_amateur_league ?? '—'}</td>
              <td className="dt-td dt-td--country">{p.birth_country ?? '—'}</td>
              <td className="dt-td dt-td--mid">
                <RankDelta final={p.final_rank} midterm={p.midterm_rank} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <div className={`dt-table-fade${atEnd ? ' dt-table-fade--hidden' : ''}`} />
    </div>
  );
}

// ─── Draft Board ──────────────────────────────────────────────────────────────

function DraftBoard({ picks, onSelect }) {
  if (!picks?.length) {
    return <div className="dt-empty">No picks yet. Check back once the draft begins.</div>;
  }

  // Group picks by round
  const byRound = picks.reduce((acc, p) => {
    const r = p.round ?? 1;
    if (!acc[r]) acc[r] = [];
    acc[r].push(p);
    return acc;
  }, {});
  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);

  return (
    <div className="dt-board">
      {rounds.map((round) => (
        <div key={round} className="dt-board-round">
          <div className="dt-board-round-header">Round {round}</div>
          <div className="dt-table-wrap">
            <table className="dt-table" aria-label={`Round ${round} picks`}>
              <thead>
                <tr>
                  <th className="dt-th dt-th--pick">#</th>
                  <th className="dt-th dt-th--team">Team</th>
                  <th className="dt-th dt-th--name">Name</th>
                  <th className="dt-th dt-th--pos">Pos</th>
                  <th className="dt-th dt-th--club">Club</th>
                  <th className="dt-th dt-th--league">League</th>
                  <th className="dt-th dt-th--rank">CS Rank</th>
                </tr>
              </thead>
              <tbody>
                {byRound[round].map((pick) => (
                  <tr
                    key={pick.pick_overall}
                    className="dt-row dt-row--clickable"
                    onClick={() => { onSelect(pick); capture('draft_pick_clicked', { pick: pick.pick_overall }); }}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onSelect(pick)}
                  >
                    <td className="dt-td dt-td--pick">{pick.pick_overall}</td>
                    <td className="dt-td dt-td--team">
                      <span className="dt-board-team">
                        <TeamLogo abbr={pick.team_abbrev} size={20} />
                        <span>{pick.team_abbrev}</span>
                      </span>
                    </td>
                    <td className="dt-td dt-td--name">
                      {pick.prospect_first} {pick.prospect_last}
                    </td>
                    <td className="dt-td dt-td--pos">{pick.position_code ?? '—'}</td>
                    <td className="dt-td dt-td--club">{pick.last_amateur_club ?? '—'}</td>
                    <td className="dt-td dt-td--league">{pick.last_amateur_league ?? '—'}</td>
                    <td className="dt-td dt-td--rank">
                      {pick.final_rank ? `#${pick.final_rank}` : <span className="dt-unranked">UR</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── DraftTab ─────────────────────────────────────────────────────────────────

export default function DraftTab({ overrideRankings = null, overridePicks = null }) {
  const [categoryId, setCategoryId]   = useState(1);
  const [boardView, setBoardView]     = useState('rankings'); // 'rankings' | 'board'
  const [rankings, setRankings]       = useState(null);      // { 1: [], 2: [], 3: [], 4: [] }
  const [picks, setPicks]             = useState(null);
  const [rankingsLoading, setRankingsLoading] = useState(true);
  const [picksLoading, setPicksLoading]       = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedMode, setSelectedMode] = useState(null); // 'prospect' | 'pick'
  const pollRef = useRef(null);

  // Fetch rankings once (or use override for dev/testing)
  useEffect(() => {
    if (overrideRankings !== null) {
      setRankings(overrideRankings);
      setRankingsLoading(false);
      return;
    }
    getDraftRankings().then((data) => {
      setRankings(data);
      setRankingsLoading(false);
    }).catch(() => setRankingsLoading(false));
  }, [overrideRankings]);

  // Fetch picks + set up polling if draft in progress (or use override for dev/testing)
  const fetchPicks = useCallback(async () => {
    if (overridePicks !== null) {
      setPicks(overridePicks);
      setPicksLoading(false);
      if (overridePicks.length > 0) setBoardView('board');
      return;
    }
    const data = await getDraftPicks();
    const arr = Array.isArray(data) ? data : [];
    setPicks(arr);
    setPicksLoading(false);

    // Auto-switch to board view once picks start coming in
    if (arr.length > 0) setBoardView('board');

    // Poll every 60s while draft is in progress
    if (arr.length > 0 && arr.length < TOTAL_PICKS) {
      pollRef.current = setTimeout(fetchPicks, 60_000);
    } else {
      clearTimeout(pollRef.current);
    }
  }, [overridePicks]);

  useEffect(() => {
    fetchPicks();
    return () => clearTimeout(pollRef.current);
  }, [fetchPicks]);

  const rawProspects = rankings?.[categoryId] ?? [];
  const currentProspects = (categoryId === 1 || categoryId === 3)
    ? rawProspects.filter(p => NA_COUNTRIES.has(p.birth_country))
    : rawProspects;
  const draftInProgress  = picks !== null && picks.length > 0 && picks.length < TOTAL_PICKS;
  const draftComplete    = picks !== null && picks.length >= TOTAL_PICKS;
  const draftStarted     = picks !== null && picks.length > 0;

  function openProspect(item) {
    setSelectedItem(item);
    setSelectedMode('prospect');
  }

  function openPick(item) {
    setSelectedItem(item);
    setSelectedMode('pick');
  }

  function closePopup() {
    setSelectedItem(null);
    setSelectedMode(null);
  }

  return (
    <div className="dt-root">
      {/* Banner — pre-draft only */}
      {!draftStarted && (
        <div className="dt-banner">
          <span className="dt-banner-icon">🏒</span>
          <span>Draft begins <strong>June 26</strong> · Buffalo · 7 pm ET</span>
        </div>
      )}

      {/* Live indicator */}
      {draftInProgress && (
        <div className="dt-banner dt-banner--live">
          <span className="dt-live-dot" />
          <span>Draft in progress · {picks.length} of {TOTAL_PICKS} picks</span>
        </div>
      )}

      {/* Draft complete */}
      {draftComplete && (
        <div className="dt-banner dt-banner--done">
          <span>2026 Draft complete · {picks.length} picks</span>
        </div>
      )}

      {/* View toggle — only once draft has started */}
      {draftStarted && (
        <div className="dt-toggle-row">
          <button
            className={`dt-toggle${boardView === 'rankings' ? ' dt-toggle--active' : ''}`}
            onClick={() => setBoardView('rankings')}
          >
            Rankings
          </button>
          <button
            className={`dt-toggle${boardView === 'board' ? ' dt-toggle--active' : ''}`}
            onClick={() => setBoardView('board')}
          >
            Draft board
          </button>
        </div>
      )}

      {/* Category sub-tabs (Rankings view) */}
      {boardView === 'rankings' && (
        <div className="dt-cat-tabs" role="tablist" aria-label="Prospect categories">
          {CATEGORY_TABS.map((cat) => (
            <button
              key={cat.id}
              role="tab"
              aria-selected={categoryId === cat.id}
              className={`dt-cat-tab${categoryId === cat.id ? ' dt-cat-tab--active' : ''}`}
              onClick={() => { setCategoryId(cat.id); capture('draft_category_viewed', { category: cat.id }); }}
            >
              {cat.label}
              {rankings?.[cat.id] ? (
                <span className="dt-cat-count">{rankings[cat.id].length}</span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="dt-content">
        {boardView === 'rankings' && (
          <>
            {rankingsLoading && <LoadingSkeleton />}
            {!rankingsLoading && (
              <RankingsTable
                prospects={currentProspects}
                onSelect={openProspect}
              />
            )}
          </>
        )}

        {boardView === 'board' && (
          <>
            {picksLoading && <LoadingSkeleton />}
            {!picksLoading && (
              <DraftBoard picks={picks} onSelect={openPick} />
            )}
          </>
        )}
      </div>

      {/* Popup */}
      {selectedItem && (
        <DraftPopup
          item={selectedItem}
          mode={selectedMode}
          onClose={closePopup}
        />
      )}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="lv-skeleton-wrap" aria-busy="true" aria-label="Loading">
      {[90, 85, 90, 80, 90, 85, 90, 80, 85, 90].map((w, i) => (
        <div key={i} className="lv-skeleton-row" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}
