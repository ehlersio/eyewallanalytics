// components/PWHLPeriodSummary.jsx
//
// PWHL port of PeriodSummary.jsx.
// Key differences from NHL version:
//   - Team logos via pwhlLogoUrl() from pwhlConfig.js
//   - No Brightcove video clips (HockeyTech doesn't expose them)
//   - Three stars from mostValuablePlayers (normalized by /pwhl/summary endpoint)
//   - Headshots from assets.leaguestat.com (no CORS proxy needed)
//   - AI narrative via /pwhl/summary/narrative Worker endpoint
//   - Hashtag: #PWHL #EyeWallAnalytics
//   - Export filename: EyeWall-PWHL-{abbr}-{period}-Summary.png

import { useEffect, useRef, useState } from 'react';
import { pwhlLogoUrl } from '../utils/pwhlConfig';
import { useShareCard } from '../hooks/useShareCard';
import ShareButtons from './ShareButtons';
import './ShareButtons.css';
import './PeriodSummary.css';

const WORKER_URL = typeof import.meta !== 'undefined'
  ? import.meta.env?.VITE_WORKER_URL
  : null;

// Full team names for AI prompts — abbreviations alone confuse the model
const PWHL_TEAM_NAMES = {
  BOS: 'Boston Fleet',
  MIN: 'Minnesota Frost',
  MTL: 'Montréal Victoire',
  NY:  'New York Sirens',
  OTT: 'Ottawa Charge',
  TOR: 'Toronto Sceptres',
  SEA: 'Seattle Torrent',
  VAN: 'Vancouver Goldeneyes',
  DET: 'PWHL Detroit',
  HAM: 'PWHL Hamilton',
  LV:  'PWHL Las Vegas',
  SJS: 'PWHL San Jose',
};
const pwhlTeamName = (abbr) => PWHL_TEAM_NAMES[abbr] || abbr;

// ── AI narrative ──────────────────────────────────────────────

async function generatePWHLNarrative(summary, carAbbr, oppAbbr) {
  if (!WORKER_URL || !summary.gameId) return null;

  const periodKey = summary.isGameSummary ? 'game' : String(summary.period);

  const statsPayload = {
    carAbbr,
    oppAbbr,
    carName:         pwhlTeamName(carAbbr),
    oppName:         pwhlTeamName(oppAbbr),
    league:          'pwhl',
    periodLabel:     summary.periodLabel,
    corsiForPct:     summary.corsiForPct,
    carSOG:          summary.carSOG,
    oppSOG:          summary.oppSOG,
    carGoals:        summary.carGoals,
    oppGoals:        summary.oppGoals,
    carHits:         summary.carHits,
    carFOPct:        summary.carFOPct,
    carHDCF:         summary.carHDCF,
    oppHDCF:         summary.oppHDCF,
    penaltyCount:    summary.penalties?.length ?? 0,
    carPenaltyCount: summary.penalties?.filter(p => p.isCar).length ?? 0,
    bestPeriod:      summary.bestPeriod,
    worstPeriod:     summary.worstPeriod,
    primaryGoalieName: summary.primaryGoalieName || null,
    goals: (summary.goals || []).map(g => ({
      isCar:      g.isCar,
      scorerName: g.scorerName,
      time:       g.time,
      period:     g.period,
      strength:   g.strength,
    })),
  };

  try {
    const res = await fetch(
      `${WORKER_URL}/pwhl/summary/narrative?gameId=${summary.gameId}&period=${periodKey}&carAbbr=${encodeURIComponent(carAbbr)}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(statsPayload),
      }
    );
    if (!res.ok) throw new Error(`Worker ${res.status}`);
    const data = await res.json();
    if (data.narrative) return { narrative: data.narrative, cardNarrative: data.cardNarrative || null };
  } catch (e) {
    console.warn('[PWHL] narrative Worker failed:', e.message);
  }
  return null;
}

// ── Helpers ───────────────────────────────────────────────────

function strengthLabel(s) {
  if (!s) return 'ev';
  const v = String(s).toLowerCase();
  if (v === 'pp') return 'pp';
  if (v === 'sh') return 'sh';
  if (v === 'en') return 'en';
  return 'ev';
}

function corsiColor(pct) {
  if (pct >= 55) return 'good';
  if (pct <= 45) return 'bad';
  return '';
}

function getPeriodStats(summary, carAbbr) {
  return [
    { val: `${summary.corsiForPct}%`,                          label: `${carAbbr} Corsi For%`,    color: corsiColor(summary.corsiForPct) },
    { val: `${summary.carSOG}–${summary.oppSOG}`,              label: 'Shots on Goal' },
    { val: `${summary.fenwickForPct}%`,                        label: `${carAbbr} Fenwick For%`,  color: corsiColor(summary.fenwickForPct) },
    { val: summary.carHits,                                    label: `${carAbbr} Hits` },
    { val: summary.carFOPct != null ? `${summary.carFOPct}%` : '—', label: 'Faceoff Win%' },
    { val: `${summary.carHDCF ?? 0}–${summary.oppHDCF ?? 0}`, label: 'High Danger Chances',
      color: (summary.carHDCF ?? 0) > (summary.oppHDCF ?? 0) ? 'good'
           : (summary.carHDCF ?? 0) < (summary.oppHDCF ?? 0) ? 'bad' : '' },
  ];
}

// ── Goal Carousel ─────────────────────────────────────────────

// ── Hat trick detection ──────────────────────────────────────
// Natural hat trick: 3 consecutive goals in the FULL game goals list
// by the same player with no other goals in between (from either team).
function detectHatTricks(goals) {
  if (!goals?.length) return [];
  const counts  = {};
  const info    = {};
  goals.forEach((g, idx) => {
    const id = g.scorerId != null ? String(g.scorerId) : g.scorerName;
    if (!id) return;
    counts[id] = (counts[id] || 0) + 1;
    if (!info[id]) info[id] = { scorerName: g.scorerName, isCar: g.isCar, indices: [] };
    info[id].indices.push(idx);  // track actual array index, not indexOf()
  });
  return Object.entries(counts)
    .filter(([, n]) => n >= 3)
    .map(([id]) => {
      const { scorerName, isCar, indices } = info[id];
      // Natural: find any 3 consecutive hat trick goals where every goal
      // between the first and third (inclusive) belongs to this scorer.
      let isNatural = false;
      for (let i = 0; i <= indices.length - 3; i++) {
        const start = indices[i];
        const end   = indices[i + 2];
        const slice = goals.slice(start, end + 1);
        const sliceId = (g) => g.scorerId != null ? String(g.scorerId) : g.scorerName;
        if (slice.every(g => sliceId(g) === id)) {
          isNatural = true;
          break;
        }
      }
      return { scorerName, isCar, isNatural };
    });
}

function GoalCarousel({ goals, carAbbr }) {
  const [idx, setIdx]   = useState(0);
  const touchStartX     = useRef(null);

  const prev = () => setIdx(i => Math.max(0, i - 1));
  const next = () => setIdx(i => Math.min(goals.length - 1, i + 1));

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd   = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx > 50) prev();
    else if (dx < -50) next();
    touchStartX.current = null;
  };

  if (!goals.length) return null;
  const g  = goals[idx];
  const sl = strengthLabel(g.strength);

  return (
    <div className="ps-carousel" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="ps-carousel-nav">
        <button className="ps-carousel-arrow" onClick={prev} disabled={idx === 0}>‹</button>
        <div className="ps-carousel-dots">
          {goals.map((_, i) => (
            <div key={i}
              className={`ps-carousel-dot ${i === idx ? 'active' : ''} ${goals[i].isCar ? 'car' : 'opp'}`}
              onClick={() => setIdx(i)} />
          ))}
        </div>
        <button className="ps-carousel-arrow" onClick={next} disabled={idx === goals.length - 1}>›</button>
      </div>

      <div className="ps-goal-card">
        <div className="ps-goal-info">
          {g.scorerHeadshot ? (
            <img className="ps-goal-headshot" src={g.scorerHeadshot} alt={g.scorerName || ''}
              onError={e => { e.target.style.display = 'none'; }} />
          ) : (
            <div className="ps-goal-headshot-placeholder">🏒</div>
          )}
          <div className="ps-goal-text">
            <div className={`ps-goal-scorer ${g.isCar ? 'car' : ''}`}>
              {g.scorerName || (g.isCar ? carAbbr : 'OPP')}
            </div>
            <div className="ps-goal-meta">
              {g.time}
              {g.assists?.length > 0 && (
                <> · {g.assists.map(a => a.name?.default).filter(Boolean).join(', ')}</>
              )}
            </div>
          </div>
          {sl !== 'ev' && <div className={`ps-strength-badge ${sl}`}>{sl.toUpperCase()}</div>}
        </div>
        {/* No video clips available for PWHL */}
      </div>

      <div className="ps-carousel-counter">{idx + 1} / {goals.length}</div>
    </div>
  );
}

// ── Share canvas (1080×1080, off-screen) ─────────────────────

function ShareCanvas({ summary, carAbbr, oppAbbr, isCarHome, canvasRef, cardNarrative }) {
  const carScore  = isCarHome ? summary.homeScore : summary.awayScore;
  const oppScore  = isCarHome ? summary.awayScore : summary.homeScore;
  const stats     = getPeriodStats(summary, carAbbr);
  const isGame    = summary.isGameSummary;
  const carGoals  = summary.goals.filter(g => g.isCar);
  const oppGoals  = summary.goals.filter(g => !g.isCar);
  const dominatedBy = summary.corsiForPct >= 55 ? carAbbr
    : summary.corsiForPct <= 45 ? oppAbbr : null;
  const carPens = summary.penalties.filter(p => p.isCar).length;
  const oppPens = summary.penalties.filter(p => !p.isCar).length;

  return (
    <div className="ps-share-canvas" ref={canvasRef}>

      {/* Header */}
      <div className="ps-canvas-header">
        <img src="/eyewall-logo.svg" alt="EyeWall" className="ps-canvas-logo-large"
          onError={e => { e.target.style.display = 'none'; }} />
        <span className="ps-canvas-period">{summary.periodLabel} Summary</span>
      </div>

      {/* Score + AI narrative */}
      <div className="ps-canvas-score-ai-row">
        <div className="ps-canvas-score-compact-v2">
          <div className="ps-canvas-score-compact-team car">{carAbbr}</div>
          <div className="ps-canvas-score-compact-num">{carScore ?? '–'}</div>
          <div className="ps-canvas-score-compact-div">–</div>
          <div className="ps-canvas-score-compact-num">{oppScore ?? '–'}</div>
          <div className="ps-canvas-score-compact-team">{oppAbbr}</div>
        </div>
        <div className="ps-canvas-score-ai-divider" />
        <div className="ps-canvas-narrative-full">
          <div className="ps-canvas-narrative-full-label">⚡ EyeWall AI</div>
          <div className="ps-canvas-narrative-full-text">
            {cardNarrative || summary.cardNarrative || summary.aiNarrative || 'Analysis generating…'}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="ps-canvas-stats">
        {stats.map((s, i) => (
          <div key={i} className="ps-canvas-stat">
            <div className={`ps-canvas-stat-val ${s.color || ''}`}>{s.val}</div>
            <div className="ps-canvas-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Goals */}
      {detectHatTricks(summary.goals).length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '4px 0', justifyContent: 'center' }}>
          {detectHatTricks(summary.goals).map((ht, i) => (
            <div key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--team-canvas)', color: '#fff',
              fontSize: 13, fontWeight: 600, padding: '6px 12px',
              borderRadius: 20, whiteSpace: 'nowrap',
            }}>
              🎩 {ht.isNatural ? 'Natural Hat Trick' : 'Hat Trick'}{ht.scorerName ? ` — ${ht.scorerName}` : ''}
            </div>
          ))}
        </div>
      )}

      {summary.goals.length > 0 && (
        <div className="ps-canvas-goals">
          <div className="ps-canvas-section-label">
            {isGame ? 'Goals This Game' : 'Goals This Period'}
          </div>
          <div className="ps-canvas-goals-two-col">
            <div className="ps-canvas-goals-col">
              <div className="ps-canvas-goals-col-header car">{carAbbr}</div>
              {(isGame ? carGoals : summary.goals.filter(g => g.isCar)).slice(0, 5).map((g, i) => (
                <div key={i} className="ps-canvas-goal-compact">
                  <span className="ps-canvas-goal-compact-name">
                    {g.scorerName?.split(' ').pop() || carAbbr}
                  </span>
                  <span className="ps-canvas-goal-compact-meta">
                    {isGame ? `P${g.period} ` : ''}{g.time}
                    {strengthLabel(g.strength) !== 'ev' && (
                      <span className={`ps-canvas-strength ${strengthLabel(g.strength)}`}>
                        {' '}{strengthLabel(g.strength).toUpperCase()}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <div className="ps-canvas-goals-col">
              <div className="ps-canvas-goals-col-header">{oppAbbr}</div>
              {(isGame ? oppGoals : summary.goals.filter(g => !g.isCar)).slice(0, 5).map((g, i) => (
                <div key={i} className="ps-canvas-goal-compact">
                  <span className="ps-canvas-goal-compact-name">
                    {g.scorerName?.split(' ').pop() || oppAbbr}
                  </span>
                  <span className="ps-canvas-goal-compact-meta">
                    {isGame ? `P${g.period} ` : ''}{g.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Insights — period only */}
      {!isGame && (
        <div className="ps-canvas-insights">
          {dominatedBy && (
            <div className="ps-canvas-insight-chip">
              <span className={dominatedBy === carAbbr ? 'good' : 'bad'}>
                {dominatedBy === carAbbr ? '↑' : '↓'}
              </span>
              {' '}{dominatedBy} dominated possession
            </div>
          )}
          {(carPens > 0 || oppPens > 0) && (
            <div className="ps-canvas-insight-chip">
              🚨 Penalties: {carAbbr} {carPens} – {oppPens} {oppAbbr}
            </div>
          )}
        </div>
      )}

      {/* Three stars — game only */}
      {isGame && summary.threeStars?.length > 0 && (
        <div className="ps-canvas-three-stars">
          <div className="ps-canvas-section-label">Three Stars</div>
          <div className="ps-canvas-stars-row">
            {summary.threeStars.slice(0, 3).map((s, i) => {
              const name = s.name?.default || '—';
              return (
                <div key={i} className="ps-canvas-star">
                  <div className="ps-canvas-star-rank">{'⭐'.repeat(3 - i)}</div>
                  {s.headshot ? (
                    <img src={s.headshot} alt={name} className="ps-canvas-star-img"
                      onError={e => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div className="ps-canvas-star-initials">
                      {name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                  )}
                  <div className="ps-canvas-star-name">{name}</div>
                  <div className="ps-canvas-star-team">{s.teamAbbrev?.default || ''}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="ps-canvas-footer">
        <span className="ps-canvas-footer-brand">eyewallanalytics.com</span>
        <span className="ps-canvas-footer-tag">#PWHL</span>
      </div>
    </div>
  );
}

// ── Penalties section ─────────────────────────────────────────

const PENALTY_COLLAPSE_AT = 3;

function PenaltiesSection({ penalties, carAbbr, oppAbbr }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? penalties : penalties.slice(0, PENALTY_COLLAPSE_AT);
  const hasMore = penalties.length > PENALTY_COLLAPSE_AT;

  return (
    <>
      <div className="ps-section-label">Penalties ({penalties.length})</div>
      <div className="ps-penalties">
        {visible.map((p, i) => (
          <div key={i} className="ps-penalty-row">
            <span className={`ps-penalty-team ${p.isCar ? 'car' : 'opp'}`}>
              {p.isCar ? carAbbr : oppAbbr}
            </span>
            <div className="ps-penalty-info">
              <span className="ps-penalty-player">{p.playerName || 'Unknown'}</span>
              <span className="ps-penalty-type">
                {p.type || 'Penalty'}{p.duration ? ` · ${p.duration} min` : ''}
                {p.period ? ` · P${p.period}` : ''}
              </span>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>
              {p.time}
            </span>
          </div>
        ))}
        {hasMore && (
          <button className="ps-penalties-toggle" onClick={() => setExpanded(e => !e)}>
            {expanded ? '▲ Show less' : `▼ Show ${penalties.length - PENALTY_COLLAPSE_AT} more`}
          </button>
        )}
      </div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────

export default function PWHLPeriodSummary({
  summary,
  onDismiss,
  onNarrativeReady,
  carAbbr  = 'PWHL',
  oppAbbr  = 'OPP',
  homeAbbr = null,
  readOnly = false,
}) {
  const canvasRef    = useRef(null);
  const [canvasMounted, setCanvasMounted] = useState(false);
  const [cardNarrative, setCardNarrative] = useState(summary?.cardNarrative || null);

  const isCarHome = homeAbbr === carAbbr;
  const carScore  = isCarHome ? summary?.homeScore : summary?.awayScore;
  const oppScore  = isCarHome ? summary?.awayScore : summary?.homeScore;

  const carLogo = pwhlLogoUrl(carAbbr);
  const oppLogo = pwhlLogoUrl(oppAbbr);

  const xCaption = [
    `${summary?.periodLabel} Summary | ${carAbbr} ${carScore ?? '–'}–${oppScore ?? '–'} ${oppAbbr}`,
    `CF% ${summary?.corsiForPct} · SOG ${summary?.carSOG}–${summary?.oppSOG} · Goals ${summary?.carGoals}–${summary?.oppGoals}`,
    summary?.aiNarrative || '',
    '#PWHL #EyeWallAnalytics',
  ].filter(Boolean).join('\n');

  const { saving, sharing, handleSave, handleShareX, handleNativeShare, canNativeShare } =
    useShareCard({
      canvasRef,
      filename: `EyeWall-PWHL-${carAbbr}-${summary?.periodShort}-Summary.png`,
      xCaption,
      mountCanvas: async () => {
        if (!canvasMounted) {
          setCanvasMounted(true);
          await new Promise(r => setTimeout(r, 120));
        }
      },
    });

  // Generate AI narrative on mount
  useEffect(() => {
    if (!summary || summary.aiNarrative) return;
    generatePWHLNarrative(summary, carAbbr, oppAbbr).then(result => {
      if (!result) return;
      const text = typeof result === 'string' ? result : result.narrative;
      const card = typeof result === 'string' ? null : result.cardNarrative;
      if (text && onNarrativeReady) onNarrativeReady(summary.period, text);
      if (card) setCardNarrative(card);
    });
  }, [summary?.period]);

  if (!summary) return null;

  return (
    <>
      <div className="ps-overlay pwhl-summary-overlay" onClick={readOnly ? undefined : onDismiss}>
        <div className="ps-card" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="ps-header">
            <span className="ps-period-badge">{summary.periodShort} Summary</span>
            <button className="ps-btn-icon" onClick={onDismiss} title="Close" aria-label="Close">✕</button>
          </div>

          {/* Score */}
          <div className="ps-score-banner">
            <div className="ps-team-score">
              {carLogo && (
                <img src={carLogo} alt={carAbbr} className="ps-team-logo"
                  onError={e => { e.target.style.display = 'none'; }} />
              )}
              <div className="ps-team-abbr car">{carAbbr}</div>
              <div className="ps-score-num">{carScore ?? '–'}</div>
            </div>
            <div className="ps-score-divider">–</div>
            <div className="ps-team-score">
              {oppLogo && (
                <img src={oppLogo} alt={oppAbbr} className="ps-team-logo"
                  onError={e => { e.target.style.display = 'none'; }} />
              )}
              <div className="ps-team-abbr">{oppAbbr}</div>
              <div className="ps-score-num">{oppScore ?? '–'}</div>
            </div>
          </div>

          {/* Stat grid */}
          <div className="ps-stat-grid">
            {getPeriodStats(summary, carAbbr).map((s, i) => (
              <div key={i} className="ps-stat-cell">
                <div className={`ps-stat-val ${s.color || ''}`}>{s.val}</div>
                <div className="ps-stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* AI Narrative */}
          <div className="ps-section-label">EyeWall AI</div>
          <div className="ps-narrative">
            <div className="ps-narrative-label"><span>⚡</span> Period Analysis</div>
            {summary.aiLoading && !summary.aiNarrative ? (
              <div className="ps-narrative-loading">
                <div className="ps-narrative-dot" />
                Generating analysis…
              </div>
            ) : (
              <div className="ps-narrative-text">{summary.aiNarrative || 'Analysis unavailable.'}</div>
            )}
          </div>

          {/* Hat trick highlights */}
          {detectHatTricks(summary.goals).length > 0 && (
            <div className="ps-hat-tricks">
              {detectHatTricks(summary.goals).map((ht, i) => (
                <div key={i} className="ps-hat-trick-chip">
                  🎩 {ht.isNatural ? 'Natural Hat Trick' : 'Hat Trick'}
                  {ht.scorerName ? ` — ${ht.scorerName}` : ''}
                </div>
              ))}
            </div>
          )}

          {/* Goals carousel */}
          {summary.goals.length > 0 && (
            <>
              <div className="ps-section-label">Goals ({summary.goals.length})</div>
              <GoalCarousel goals={summary.goals} carAbbr={carAbbr} />
            </>
          )}

          {/* Penalties */}
          {summary.penalties.length > 0 && (
            <PenaltiesSection penalties={summary.penalties} carAbbr={carAbbr} oppAbbr={oppAbbr} />
          )}

          {/* Period breakdown — game summary only */}
          {summary.isGameSummary && summary.periodStats?.length > 0 && (
            <>
              <div className="ps-section-label">Period Breakdown</div>
              <div className="ps-period-breakdown">
                {summary.periodStats.map(ps => (
                  <div key={ps.period} className="ps-period-row">
                    <span className="ps-period-row-label">P{ps.period}</span>
                    <div className="ps-period-row-bar-wrap">
                      <div
                        className={`ps-period-row-bar ${ps.corsiForPct >= 55 ? 'good' : ps.corsiForPct <= 45 ? 'bad' : 'neutral'}`}
                        style={{ width: `${ps.corsiForPct}%` }}
                      />
                    </div>
                    <span className={`ps-period-row-pct ${ps.corsiForPct >= 55 ? 'good' : ps.corsiForPct <= 45 ? 'bad' : ''}`}>
                      {ps.corsiForPct}%
                    </span>
                    <span className="ps-period-row-sog">{ps.carSOG}–{ps.oppSOG} SOG</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Three stars — game summary only */}
          {summary.isGameSummary && summary.threeStars?.length > 0 && (
            <>
              <div className="ps-section-label">Three Stars</div>
              <div className="ps-three-stars">
                {summary.threeStars.slice(0, 3).map((s, i) => (
                  <div key={i} className="ps-star-card">
                    <div className="ps-star-rank">{'⭐'.repeat(3 - i)}</div>
                    {s.headshot ? (
                      <img className="ps-star-headshot" src={s.headshot} alt={s.name?.default || ''}
                        onError={e => { e.target.style.display = 'none'; }} />
                    ) : (
                      <div className="ps-star-headshot"
                        style={{ background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                        🏒
                      </div>
                    )}
                    <div className="ps-star-name">{s.name?.default || '—'}</div>
                    <div className="ps-star-team">{s.teamAbbrev?.default || ''}</div>
                    {s.stats && (
                      <div className="ps-star-team" style={{ fontSize: 10 }}>
                        {s.isGoalie
                          ? `${s.stats.saves ?? '—'} SV`
                          : `${s.stats.goals ?? 0}G ${s.stats.assists ?? 0}A`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Share */}
          <div className="ps-share-section">
            <ShareButtons
              onSave={handleSave}
              onShareX={handleShareX}
              onNativeShare={handleNativeShare}
              canNativeShare={canNativeShare}
              saving={saving}
              sharing={sharing}
            />
          </div>

        </div>
      </div>

      {/* Off-screen canvas — only mounted on first export click */}
      {canvasMounted && (
        <ShareCanvas
          summary={summary}
          carAbbr={carAbbr}
          oppAbbr={oppAbbr}
          isCarHome={isCarHome}
          canvasRef={canvasRef}
          cardNarrative={cardNarrative}
        />
      )}
    </>
  );
}
