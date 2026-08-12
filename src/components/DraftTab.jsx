// DraftTab.jsx
// Place in src/views/ alongside LeagueView.jsx
// Rendered by LeagueView when activeTab === 'draft'

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { capture } from '../utils/analytics';
import { getDraftRankings, getDraftPicks } from '../utils/nhlApi';
import TeamLogo from '../components/TeamLogo';
// DraftTab.css import removed (Phase 6) -- migrated to Tailwind. NHL-only,
// no PWHL equivalent (PWHLLeagueView.jsx's own draft table is a separate,
// self-contained implementation, confirmed via full-tree grep).

// .lv-skeleton-wrap/.lv-skeleton-row are LeagueView.css's (Phase 4,
// LeagueView.css sub-PR 1) -- this file's only real dependency on that CSS
// file (everything else here uses its own DraftTab.css). lv-skeleton-wrap
// is a required Cypress marker (league.cy.js); lv-skeleton-row is not.
const LV_SKELETON_WRAP_CLASSES = 'lv-skeleton-wrap flex flex-col gap-2 py-1'
const LV_SKELETON_ROW_CLASSES = 'h-[14px] bg-[var(--bg2)] rounded-[var(--radius-sm)] animate-[lv-pulse_1.4s_ease-in-out_infinite]'

// ── Draft banner (dt-banner / --live / --done) ──
// .dt-banner--live/.dt-banner--done are single-class modifiers in the
// original CSS (not compound .dt-banner.dt-banner--X selectors), same
// specificity as .dt-banner itself -- the modifier wins on background/
// border-color/color purely by being declared later in source. Computed as
// one full non-competing set per variant rather than stacked, the same
// reasoning as every other base+modifier race this migration.
const DT_BANNER_BASE = 'dt-banner flex items-center gap-2 py-2 px-3 mb-3 rounded-[8px] text-[13px] border-[0.5px]';
function dtBannerClasses(variant) {
  if (variant === 'live') return `${DT_BANNER_BASE} dt-banner--live bg-[color-mix(in_srgb,var(--green)_10%,transparent)] border-[color-mix(in_srgb,var(--green)_30%,transparent)] text-[color:var(--green)]`;
  if (variant === 'done') return `${DT_BANNER_BASE} dt-banner--done bg-[color-mix(in_srgb,var(--red-bright)_8%,transparent)] border-[color:var(--red-border)] text-[color:var(--text-muted)]`;
  return `${DT_BANNER_BASE} bg-[var(--bg2)] border-[color:var(--border)] text-[color:var(--text-muted)]`;
}

// ── Rankings/Board toggle (dt-toggle / --active) -- same base+modifier
// race shape as dt-banner above. ──
function dtToggleClasses(active) {
  const base = 'dt-toggle py-[5px] px-[14px] rounded-[20px] text-[12px] font-medium border-[0.5px] cursor-pointer [transition:all_0.15s]';
  return active
    ? `${base} dt-toggle--active bg-[var(--red-dim)] text-[color:var(--red-bright)] border-[color:var(--red-border)]`
    : `${base} text-[color:var(--text-muted)] border-transparent bg-transparent`;
}

// ── Category sub-tabs (dt-cat-tab / --active) -- same shape again. ──
function dtCatTabClasses(active) {
  const base = 'dt-cat-tab flex items-center gap-[5px] py-1 px-3 rounded-[16px] text-[12px] font-medium border-[0.5px] cursor-pointer [transition:all_0.15s]';
  return active
    ? `${base} dt-cat-tab--active text-[color:var(--text)] bg-[var(--bg3)] border-[color:var(--text-muted)]`
    : `${base} text-[color:var(--text-dim)] bg-[var(--bg2)] border-[color:var(--border)]`;
}

// ── Rank badge (dt-popup-rank-badge / --unranked) -- same shape. ──
function dtRankBadgeClasses(unranked) {
  const base = 'dt-popup-rank-badge text-[12px] font-bold py-[3px] px-[10px] rounded-[20px] border-[0.5px]';
  return unranked
    ? `${base} dt-popup-rank-badge--unranked bg-[var(--bg2)] text-[color:var(--text-dim)] border-[color:var(--border)]`
    : `${base} bg-[var(--red-dim)] text-[color:var(--red-bright)] border-[color:var(--red-border)]`;
}

const DT_TH_CLASSES = 'dt-th text-left py-[6px] px-2 text-[11px] font-semibold text-[color:var(--text-dim)] border-b-[0.5px] border-b-[color:var(--border)] whitespace-nowrap uppercase tracking-[0.03em]';
const DT_TD_CLASSES = 'dt-td py-[7px] px-2 text-[color:var(--text)] border-b-[0.5px] border-b-[color:var(--border)] whitespace-nowrap';
// dt-row--clickable:hover's --surface-hover token now has a real
// definition in index.css (follow-up to the Tailwind migration) -- was
// previously an undefined custom property relying on this exact rgba
// fallback value, the same dead-fallback shape as --surface-dim. Now has
// a light-mode value too (hover-tint sweep) -- see index.css's
// [data-theme="light"] block.
const DT_ROW_CLICKABLE_CLASSES = 'dt-row dt-row--clickable cursor-pointer [transition:background_0.1s] focus-visible:outline-2 focus-visible:outline-[color:var(--red-bright)] focus-visible:outline-offset-[-1px] hover:bg-[var(--surface-hover)]';

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
  const base = 'dt-delta text-[11px] font-semibold';
  if (!midterm || !finalRank) return <span className={`${base} dt-delta--none text-[color:var(--text-dim)]`}>—</span>;
  const diff = midterm - finalRank; // positive = rose, negative = fell
  if (diff === 0) return <span className={`${base} dt-delta--flat text-[color:var(--text-dim)]`}>—</span>;
  if (diff > 0)   return <span className={`${base} dt-delta--up text-[color:var(--green)]`}>▲{diff}</span>;
  return               <span className={`${base} dt-delta--down text-[color:var(--red-bright)]`}>▼{Math.abs(diff)}</span>;
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
      className="dt-popup-overlay fixed inset-0 bg-[rgba(0,0,0,0.55)] flex items-center justify-center z-[1000] p-4"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={`${firstName} ${lastName} draft profile`}
    >
      <div className="dt-popup bg-[var(--bg2)] border-[0.5px] border-[color:var(--border)] rounded-[14px] p-5 w-full max-w-[440px] relative max-h-[90vh] overflow-y-auto max-[600px]:p-4 max-[600px]:rounded-[12px] max-[600px]:max-w-[calc(100vw-32px)] max-[600px]:max-h-[85vh]">
        <button className="dt-popup-close absolute top-[14px] right-[14px] bg-none border-none text-[color:var(--text-dim)] text-[14px] cursor-pointer py-1 px-[6px] rounded-[6px] leading-none [transition:color_0.15s] hover:text-[color:var(--text)]" onClick={onClose} aria-label="Close">✕</button>

        {/* Header */}
        <div className="dt-popup-header flex items-start gap-[10px] mb-1.5 pr-7">
          {isPick && teamAbbrev && (
            <div className="dt-popup-team flex flex-col items-center gap-[3px] shrink-0">
              <TeamLogo abbr={teamAbbrev} size={36} />
              <span className="dt-popup-team-abbr text-[10px] font-bold text-[color:var(--text-dim)] uppercase">{teamAbbrev}</span>
            </div>
          )}
          <div className="dt-popup-name-block flex flex-col gap-[2px]">
            <span className="dt-popup-name text-[18px] font-bold text-[color:var(--text)] leading-[1.2]">{firstName} {lastName}</span>
            <span className="dt-popup-meta text-[12px] text-[color:var(--text-muted)]">
              {position}{shoots ? ` · ${shoots}` : ''}
              {country ? ` · ${country}` : ''}
            </span>
          </div>
        </div>

        {/* Pick context */}
        {isPick && (
          <div className="dt-popup-pick-context text-[12px] text-[color:var(--text-dim)] mb-2.5">
            Pick #{pickOverall} · Round {round}, #{pickInRound} in round
          </div>
        )}

        {/* Rank badge */}
        {isRanked && (
          <div className="dt-popup-rank-row flex items-center gap-[10px] mb-3.5">
            <span className={dtRankBadgeClasses(false)}>
              #{finalRank} {categoryLabel}
            </span>
            {midtermRank && (
              <span className="dt-popup-rank-midterm text-[12px] text-[color:var(--text-muted)] flex items-center gap-1">
                Midterm: #{midtermRank}
                {' '}<RankDelta final={finalRank} midterm={midtermRank} />
              </span>
            )}
          </div>
        )}
        {!isRanked && (
          <div className="dt-popup-rank-row flex items-center gap-[10px] mb-3.5">
            <span className={dtRankBadgeClasses(true)}>Unranked</span>
          </div>
        )}

        {/* Bio grid */}
        <div className="dt-popup-bio grid [grid-template-columns:1fr_1fr] gap-x-4 gap-y-2 mb-4 p-3 bg-[var(--bg3)] rounded-[8px]">
          <div className="dt-popup-bio-item flex flex-col gap-px">
            <span className="dt-popup-bio-label text-[10px] font-semibold uppercase tracking-[0.05em] text-[color:var(--text-dim)]">Height</span>
            <span className="dt-popup-bio-value text-[13px] font-medium text-[color:var(--text)]">{fmtHeight(heightIn)}</span>
          </div>
          <div className="dt-popup-bio-item flex flex-col gap-px">
            <span className="dt-popup-bio-label text-[10px] font-semibold uppercase tracking-[0.05em] text-[color:var(--text-dim)]">Weight</span>
            <span className="dt-popup-bio-value text-[13px] font-medium text-[color:var(--text)]">{weightLbs ? `${weightLbs} lbs` : '—'}</span>
          </div>
          <div className="dt-popup-bio-item flex flex-col gap-px">
            <span className="dt-popup-bio-label text-[10px] font-semibold uppercase tracking-[0.05em] text-[color:var(--text-dim)]">Club</span>
            <span className="dt-popup-bio-value text-[13px] font-medium text-[color:var(--text)]">{club || '—'}</span>
          </div>
          <div className="dt-popup-bio-item flex flex-col gap-px">
            <span className="dt-popup-bio-label text-[10px] font-semibold uppercase tracking-[0.05em] text-[color:var(--text-dim)]">League</span>
            <span className="dt-popup-bio-value text-[13px] font-medium text-[color:var(--text)]">{league || '—'}</span>
          </div>
        </div>

        {/* AI Analysis (pick mode only) */}
        {isPick && (
          <div className="dt-popup-ai flex flex-col gap-1.5 pt-3.5 border-t-[0.5px] border-t-[color:var(--border)]">
            <span className="dt-popup-ai-label text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-dim)]">Sticks says</span>
            {aiPending ? (
              <div className="dt-popup-ai-pending flex items-center gap-2 text-[12px] text-[color:var(--text-dim)] py-2">
                <span className="dt-spinner w-[14px] h-[14px] border-2 border-[color:var(--border)] border-t-[color:var(--text-muted)] rounded-full animate-[spin_0.7s_linear_infinite] shrink-0" />
                <span>Analysis generating…</span>
              </div>
            ) : (
              <p className="dt-popup-ai-text text-[13px] leading-[1.55] text-[color:var(--text-muted)] m-0">{aiAnalysis}</p>
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
    return <div className="dt-empty py-8 text-center text-[color:var(--text-dim)] text-[13px]">No prospects found.</div>;
  }

  return (
    <div className="dt-table-container relative">
      <div className="dt-table-wrap overflow-x-auto [-webkit-overflow-scrolling:touch]" ref={wrapRef} onScroll={handleScroll}>
      <table className="dt-table w-full border-collapse text-[12.5px]" aria-label="Central Scouting rankings">
        <thead>
          <tr>
            <th className={`${DT_TH_CLASSES} dt-th--rank w-[42px]`}>Rank</th>
            <th className={`${DT_TH_CLASSES} dt-th--name`}>Name</th>
            <th className={`${DT_TH_CLASSES} dt-th--pos w-9`}>Pos</th>
            <th className={`${DT_TH_CLASSES} dt-th--shoots w-8 max-[600px]:hidden`}>S/C</th>
            <th className={`${DT_TH_CLASSES} dt-th--ht w-11 max-[600px]:hidden`}>Ht</th>
            <th className={`${DT_TH_CLASSES} dt-th--wt w-11 max-[600px]:hidden`}>Wt</th>
            <th className={`${DT_TH_CLASSES} dt-th--club`}>Club</th>
            <th className={`${DT_TH_CLASSES} dt-th--league`}>League</th>
            <th className={`${DT_TH_CLASSES} dt-th--country`}>Ctry</th>
            <th className={`${DT_TH_CLASSES} dt-th--mid w-[60px]`} title="Midterm rank → Final rank change">Mid→Fin</th>
          </tr>
        </thead>
        <tbody>
          {prospects.map((p) => (
            <tr
              key={`${p.category_id}-${p.final_rank}`}
              className={DT_ROW_CLICKABLE_CLASSES}
              onClick={() => { onSelect(p); capture('draft_prospect_clicked', { rank: p.final_rank, category: p.category_id }); }}
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(p)}
            >
              <td className={`${DT_TD_CLASSES} dt-td--rank font-bold text-[color:var(--text-muted)]`}>{p.final_rank}</td>
              <td className={`${DT_TD_CLASSES} dt-td--name font-medium`}>
                {p.first_name} {p.last_name}
              </td>
              <td className={`${DT_TD_CLASSES} dt-td--pos`}>{p.position_code ?? '—'}</td>
              <td className={`${DT_TD_CLASSES} dt-td--shoots max-[600px]:hidden`}>{p.shoots_catches ?? '—'}</td>
              <td className={`${DT_TD_CLASSES} dt-td--ht max-[600px]:hidden`}>{fmtHeight(p.height_inches)}</td>
              <td className={`${DT_TD_CLASSES} dt-td--wt max-[600px]:hidden`}>{fmtWeight(p.weight_pounds)}</td>
              <td className={`${DT_TD_CLASSES} dt-td--club text-[color:var(--text-muted)] text-[12px]`}>{p.last_amateur_club ?? '—'}</td>
              <td className={`${DT_TD_CLASSES} dt-td--league text-[color:var(--text-muted)] text-[12px]`}>{p.last_amateur_league ?? '—'}</td>
              <td className={`${DT_TD_CLASSES} dt-td--country`}>{p.birth_country ?? '—'}</td>
              <td className={`${DT_TD_CLASSES} dt-td--mid`}>
                <RankDelta final={p.final_rank} midterm={p.midterm_rank} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <div className={`dt-table-fade absolute top-0 right-0 w-9 h-full bg-[linear-gradient(to_right,transparent,var(--bg1))] pointer-events-none [transition:opacity_0.2s] ${atEnd ? 'dt-table-fade--hidden opacity-0' : ''}`} />
    </div>
  );
}

// ─── Draft Board ──────────────────────────────────────────────────────────────

function DraftBoard({ picks, onSelect }) {
  if (!picks?.length) {
    return <div className="dt-empty py-8 text-center text-[color:var(--text-dim)] text-[13px]">No picks yet. Check back once the draft begins.</div>;
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
    <div className="dt-board flex flex-col gap-5">
      {rounds.map((round) => (
        <div key={round} className="dt-board-round">
          <div className="dt-board-round-header text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-dim)] mb-1.5 pb-1 border-b-[0.5px] border-b-[color:var(--border)]">Round {round}</div>
          <div className="dt-table-wrap overflow-x-auto [-webkit-overflow-scrolling:touch]">
            <table className="dt-table w-full border-collapse text-[12.5px]" aria-label={`Round ${round} picks`}>
              <thead>
                <tr>
                  <th className={`${DT_TH_CLASSES} dt-th--pick w-[42px]`}>#</th>
                  <th className={`${DT_TH_CLASSES} dt-th--team w-[60px]`}>Team</th>
                  <th className={`${DT_TH_CLASSES} dt-th--name`}>Name</th>
                  <th className={`${DT_TH_CLASSES} dt-th--pos w-9`}>Pos</th>
                  <th className={`${DT_TH_CLASSES} dt-th--club`}>Club</th>
                  <th className={`${DT_TH_CLASSES} dt-th--league`}>League</th>
                  <th className={`${DT_TH_CLASSES} dt-th--rank`}>CS Rank</th>
                </tr>
              </thead>
              <tbody>
                {byRound[round].map((pick) => (
                  <tr
                    key={pick.pick_overall}
                    className={DT_ROW_CLICKABLE_CLASSES}
                    onClick={() => { onSelect(pick); capture('draft_pick_clicked', { pick: pick.pick_overall }); }}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onSelect(pick)}
                  >
                    <td className={`${DT_TD_CLASSES} dt-td--pick`}>{pick.pick_overall}</td>
                    <td className={`${DT_TD_CLASSES} dt-td--team`}>
                      <span className="dt-board-team flex items-center gap-[5px] font-semibold">
                        <TeamLogo abbr={pick.team_abbrev} size={20} />
                        <span>{pick.team_abbrev}</span>
                      </span>
                    </td>
                    <td className={`${DT_TD_CLASSES} dt-td--name font-medium`}>
                      {pick.prospect_first} {pick.prospect_last}
                    </td>
                    <td className={`${DT_TD_CLASSES} dt-td--pos`}>{pick.position_code ?? '—'}</td>
                    <td className={`${DT_TD_CLASSES} dt-td--club text-[color:var(--text-muted)] text-[12px]`}>{pick.last_amateur_club ?? '—'}</td>
                    <td className={`${DT_TD_CLASSES} dt-td--league text-[color:var(--text-muted)] text-[12px]`}>{pick.last_amateur_league ?? '—'}</td>
                    <td className={`${DT_TD_CLASSES} dt-td--rank`}>
                      {pick.final_rank ? `#${pick.final_rank}` : <span className="dt-unranked text-[10px] font-semibold text-[color:var(--text-dim)] bg-[var(--border)] rounded-[4px] py-px px-1">UR</span>}
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
    <div className="dt-root flex flex-col">
      {/* Banner — pre-draft only */}
      {!draftStarted && (
        <div className={dtBannerClasses(null)}>
          <span className="dt-banner-icon text-[15px]">🏒</span>
          <span>Draft begins <strong>June 26</strong> · Buffalo · 7 pm ET</span>
        </div>
      )}

      {/* Live indicator */}
      {draftInProgress && (
        <div className={dtBannerClasses('live')}>
          <span className="dt-live-dot w-[7px] h-[7px] rounded-full bg-[var(--green)] animate-[dt-pulse_1.4s_ease-in-out_infinite] shrink-0" />
          <span>Draft in progress · {picks.length} of {TOTAL_PICKS} picks</span>
        </div>
      )}

      {/* Draft complete */}
      {draftComplete && (
        <div className={dtBannerClasses('done')}>
          <span>2026 Draft complete · {picks.length} picks</span>
        </div>
      )}

      {/* View toggle — only once draft has started */}
      {draftStarted && (
        <div className="dt-toggle-row flex gap-[6px] mb-2.5">
          <button
            className={dtToggleClasses(boardView === 'rankings')}
            onClick={() => setBoardView('rankings')}
          >
            Rankings
          </button>
          <button
            className={dtToggleClasses(boardView === 'board')}
            onClick={() => setBoardView('board')}
          >
            Draft board
          </button>
        </div>
      )}

      {/* Category sub-tabs (Rankings view) */}
      {boardView === 'rankings' && (
        <div className="dt-cat-tabs flex gap-1 mb-2.5 flex-wrap max-[600px]:flex-nowrap max-[600px]:overflow-x-auto max-[600px]:[-webkit-overflow-scrolling:touch] max-[600px]:[scrollbar-width:none] max-[600px]:pb-1 max-[600px]:gap-1.5 max-[600px]:[&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Prospect categories">
          {CATEGORY_TABS.map((cat) => (
            <button
              key={cat.id}
              role="tab"
              aria-selected={categoryId === cat.id}
              className={`${dtCatTabClasses(categoryId === cat.id)} max-[600px]:shrink-0`}
              onClick={() => { setCategoryId(cat.id); capture('draft_category_viewed', { category: cat.id }); }}
            >
              {cat.label}
              {rankings?.[cat.id] ? (
                <span className="dt-cat-count text-[10px] font-semibold text-[color:var(--text-dim)] bg-[var(--border)] rounded-[8px] py-px px-[5px]">{rankings[cat.id].length}</span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="dt-content min-h-[200px]">
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
    <div className={LV_SKELETON_WRAP_CLASSES} aria-busy="true" aria-label="Loading">
      {[90, 85, 90, 80, 90, 85, 90, 80, 85, 90].map((w, i) => (
        <div key={i} className={LV_SKELETON_ROW_CLASSES} style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}
