// components/PeriodSummary.jsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { TEAM_CONFIG } from '../utils/teamConfig';
import './PeriodSummary.css';

// Brightcove embed — autoplay=false prevents simultaneous playback
const BRIGHTCOVE_URL = (id) =>
  `https://players.brightcove.net/6415718365001/EXtG1xJ7H_default/index.html?videoId=${id}&autoplay=false`;

// Dev:  Vite proxy at /anthropic injects the API key server-side
// Prod: Cloudflare Pages Function at /api/ai injects the API key server-side
//       (requires ANTHROPIC_API_KEY env var in Cloudflare Pages dashboard)
const AI_ENDPOINT = import.meta.env.DEV
  ? '/anthropic/v1/messages'
  : '/api/ai';

function strengthLabel(strength) {
  if (!strength) return 'ev';
  const s = String(strength).toLowerCase();
  if (s === 'pp' || s === '1451' || s === '1541') return 'pp';
  if (s === 'sh' || s === '0451' || s === '0541') return 'sh';
  return 'ev';
}

function corsiColor(pct) {
  if (pct >= 55) return 'good';
  if (pct <= 45) return 'bad';
  return '';
}

// Fetch narrative from Worker — generates once, cached in KV for all users.
// Falls back to direct /api/ai if Worker URL not configured (dev environments).
async function generateNarrative(summary, carAbbr, oppAbbr, isPlayoff = false) {
  const workerUrl = typeof import.meta !== 'undefined'
    ? import.meta.env?.VITE_WORKER_URL
    : null;

  const periodKey = summary.isGameSummary ? 'game' : String(summary.period);

  // Build the stats payload the Worker needs to generate the prompt
  const statsPayload = {
    carAbbr,
    oppAbbr,
    isPlayoff,
    periodLabel:    summary.periodLabel,
    corsiForPct:    summary.corsiForPct,
    carSOG:         summary.carSOG,
    oppSOG:         summary.oppSOG,
    carGoals:       summary.carGoals,
    oppGoals:       summary.oppGoals,
    carHits:        summary.carHits,
    carFOPct:       summary.carFOPct,
    carHDCF:        summary.carHDCF,
    oppHDCF:        summary.oppHDCF,
    penaltyCount:   summary.penalties?.length ?? 0,
    carPenaltyCount: summary.penalties?.filter(p => p.isCar).length ?? 0,
    bestPeriod:     summary.bestPeriod,
    worstPeriod:    summary.worstPeriod,
    goals: (summary.goals || []).map(g => ({
      isCar:      g.isCar,
      scorerName: g.scorerName,
      time:       g.time,
      period:     g.period,
      strength:   g.strength,
    })),
  };

  // ── Path 1: Worker endpoint (production) ─────────────────────
  if (workerUrl && summary.gameId) {
    try {
      const res = await fetch(
        `${workerUrl}/summary/narrative?gameId=${summary.gameId}&period=${periodKey}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(statsPayload),
        }
      );
      if (!res.ok) throw new Error(`Worker ${res.status}`);
      const data = await res.json();
      if (data.narrative) return data.narrative;
    } catch (e) {
      console.warn('Worker narrative failed, falling back to direct AI:', e.message);
    }
  }

  // ── Path 2: Direct /api/ai fallback (dev / no Worker URL) ────
  const goalsSummary = (summary.goals || []).map(g =>
    `${g.isCar ? carAbbr : oppAbbr} goal by ${g.scorerName || 'unknown'} at ${g.period ? `P${g.period} ` : ''}${g.time} (${(g.strength || 'EV').toUpperCase()})`
  ).join('; ') || 'no goals';

  const playoffNote = isPlayoff
    ? '\n\nNote: This is a PLAYOFF game. Do not mention points, standings, or "escaping with a point". Overtime is full 20-minute periods, not 3v3. Focus on possession, goaltending, and series context.'
    : '';

  const prompt = summary.isGameSummary
    ? `You are EyeWall, an analytics assistant for Carolina Hurricanes fans.
Write a sharp 3-4 sentence final game summary for ${carAbbr} vs ${oppAbbr}.
Tone: analytical, knowledgeable fan. No fluff. No bullet points.

Game stats:
- Final: ${carAbbr} ${summary.carGoals} - ${summary.oppGoals} ${oppAbbr}
- Game Corsi For%: ${summary.corsiForPct}%
- CAR shots: ${summary.carSOG}, OPP shots: ${summary.oppSOG}
- CAR high danger chances: ${summary.carHDCF} vs OPP ${summary.oppHDCF}
- Best period for ${carAbbr}: P${summary.bestPeriod?.period} (${summary.bestPeriod?.corsiForPct}% CF)
- Worst period: P${summary.worstPeriod?.period} (${summary.worstPeriod?.corsiForPct}% CF)
- CAR hits: ${summary.carHits}, CAR faceoffs: ${summary.carFOPct}%
- Goals: ${goalsSummary}

Summarize how the game went, key turning points, and whether the result matched the underlying play. Under 80 words.${playoffNote}`
    : `You are EyeWall, an analytics assistant for Carolina Hurricanes fans.
Write a tight 2-3 sentence period summary for ${summary.periodLabel} of a ${carAbbr} vs ${oppAbbr} game.
Tone: sharp, analytical, knowledgeable fan. No fluff. No bullet points. Just sentences.

Stats:
- ${carAbbr} Corsi For%: ${summary.corsiForPct}%
- CAR shots on goal: ${summary.carSOG}, OPP shots on goal: ${summary.oppSOG}
- CAR goals: ${summary.carGoals}, OPP goals: ${summary.oppGoals}
- CAR hits: ${summary.carHits}
- Penalties: ${summary.penalties?.length ?? 0} total (${summary.penalties?.filter(p => p.isCar).length ?? 0} against CAR)
- Goals: ${goalsSummary}

Focus on what mattered most — possession dominance, momentum, key goals. Under 60 words.${playoffNote}`;

  try {
    const res = await fetch(AI_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.content?.[0]?.text?.trim() || null;
  } catch (e) {
    console.warn('AI narrative failed:', e.message);
    return null;
  }
}

// ── Goal Carousel ─────────────────────────────────────────────
function GoalCarousel({ goals, carAbbr }) {
  const [idx, setIdx] = useState(0);
  const touchStartX = useRef(null);

  const prev = useCallback(() => { setIdx(i => Math.max(0, i - 1)); }, []);
  const next = useCallback(() => { setIdx(i => Math.min(goals.length - 1, i + 1)); }, [goals.length]);

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx > 50) prev();
    else if (dx < -50) next();
    touchStartX.current = null;
  };

  if (!goals.length) return null;
  const g = goals[idx];
  const sl = strengthLabel(g.strength);

  return (
    <div className="ps-carousel" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Nav arrows */}
      <div className="ps-carousel-nav">
        <button className="ps-carousel-arrow" onClick={prev} disabled={idx === 0}>‹</button>
        <div className="ps-carousel-dots">
          {goals.map((_, i) => (
            <div
              key={i}
              className={`ps-carousel-dot ${i === idx ? 'active' : ''} ${goals[i].isCar ? 'car' : 'opp'}`}
              onClick={() => { setIdx(i); setShowVideo(false); }}
            />
          ))}
        </div>
        <button className="ps-carousel-arrow" onClick={next} disabled={idx === goals.length - 1}>›</button>
      </div>

      {/* Goal card */}
      <div className="ps-goal-card">
        <div className="ps-goal-info">
          {g.scorerHeadshot ? (
            <img className="ps-goal-headshot" src={g.scorerHeadshot} alt={g.scorerName || ''} onError={e => { e.target.style.display='none'; }} />
          ) : (
            <div className="ps-goal-headshot-placeholder">🏒</div>
          )}
          <div className="ps-goal-text">
            <div className={`ps-goal-scorer ${g.isCar ? 'car' : ''}`}>
              {g.scorerName || (g.isCar ? carAbbr : 'OPP')}
            </div>
            <div className="ps-goal-meta">
              {g.time}
              {g.assists?.length > 0 && <> · {g.assists.map(a => a.name?.default).filter(Boolean).join(', ')}</>}
              {g.shotType && <> · {g.shotType}</>}
            </div>
          </div>
          <div className={`ps-strength-badge ${sl}`}>{sl.toUpperCase()}</div>
        </div>

        {/* Video — rendered directly since carousel shows one at a time */}
        {g.discreteClip && (
          <iframe
            className="ps-goal-video"
            src={BRIGHTCOVE_URL(g.discreteClip)}
            allow="fullscreen"
            allowFullScreen
            title={`Goal by ${g.scorerName || 'player'} at ${g.time}`}
          />
        )}
      </div>

      {/* Goal counter */}
      <div className="ps-carousel-counter">{idx + 1} / {goals.length}</div>
    </div>
  );
}

// ── Share canvas (1080×1080, off-screen) ─────────────────────
// Shared stat definitions — used by both the popup grid and the share canvas
// so they're always in sync
function getPeriodStats(summary, carAbbr) {
  return [
    { val: `${summary.corsiForPct}%`,  label: `${carAbbr} Corsi For%`,    color: corsiColor(summary.corsiForPct) },
    { val: `${summary.carSOG}–${summary.oppSOG}`, label: 'Shots on Goal' },
    { val: `${summary.fenwickForPct}%`, label: `${carAbbr} Fenwick For%`, color: corsiColor(summary.fenwickForPct) },
    { val: summary.carHits,             label: `${carAbbr} Hits` },
    { val: summary.carFOPct != null ? `${summary.carFOPct}%` : '—', label: 'Faceoff Win%' },
    { val: `${summary.carHDCF ?? 0}–${summary.oppHDCF ?? 0}`, label: 'High Danger Chances',
      color: (summary.carHDCF ?? 0) > (summary.oppHDCF ?? 0) ? 'good' : (summary.carHDCF ?? 0) < (summary.oppHDCF ?? 0) ? 'bad' : '' },
  ];
}

function ShareCanvas({ summary, carAbbr, oppAbbr, homeAbbr, canvasRef }) {
  const carIsHome = homeAbbr === carAbbr;
  const carScore = carIsHome ? summary.homeScore : summary.awayScore;
  const oppScore = carIsHome ? summary.awayScore : summary.homeScore;
  const stats = getPeriodStats(summary, carAbbr);
  const logoUrl = (abbr) => `/nhl-assets/logos/nhl/svg/${abbr}_dark.svg`;
  const dominatedBy = summary.corsiForPct >= 55 ? carAbbr : summary.corsiForPct <= 45 ? oppAbbr : null;
  const carPenalties = summary.penalties.filter(p => p.isCar).length;
  const oppPenalties = summary.penalties.filter(p => !p.isCar).length;
  const carGoals = summary.goals.filter(g => g.isCar);
  const oppGoals = summary.goals.filter(g => !g.isCar);
  const isGame = summary.isGameSummary;

  return (
    <div className="ps-share-canvas" ref={canvasRef}>

      {/* Header */}
      <div className="ps-canvas-header">
        <img src="/eyewall-logo.svg" alt="EyeWall" className="ps-canvas-logo-large"
          onError={e => { e.target.style.display='none'; }} />
        <span className="ps-canvas-period">{summary.periodLabel} Summary</span>
      </div>

      {/* Score + AI narrative side by side — same layout for both period and game cards */}
      {summary.aiNarrative ? (
        <div className="ps-canvas-score-narrative-row">
          {/* Score — compact left column */}
          <div className="ps-canvas-score-compact">
            <div className="ps-canvas-team-compact">
              <img src={logoUrl(carAbbr)} alt={carAbbr} className="ps-canvas-team-logo-sm"
                onError={e=>{e.target.style.display='none';}} />
              <div className="ps-canvas-team-abbr car">{carAbbr}</div>
              <div className="ps-canvas-score-num-sm">{carScore ?? '–'}</div>
            </div>
            <div className="ps-canvas-divider-sm">–</div>
            <div className="ps-canvas-team-compact">
              <img src={logoUrl(oppAbbr)} alt={oppAbbr} className="ps-canvas-team-logo-sm"
                onError={e=>{e.target.style.display='none';}} />
              <div className="ps-canvas-team-abbr">{oppAbbr}</div>
              <div className="ps-canvas-score-num-sm">{oppScore ?? '–'}</div>
            </div>
          </div>
          {/* AI narrative — right column */}
          <div className="ps-canvas-narrative-inline">
            <div className="ps-canvas-narrative-label">⚡ EyeWall AI</div>
            <div className="ps-canvas-narrative-text">{summary.aiNarrative}</div>
          </div>
        </div>
      ) : (
        <div className="ps-canvas-score">
          <div className="ps-canvas-team">
            <img src={logoUrl(carAbbr)} alt={carAbbr} className="ps-canvas-team-logo"
              onError={e=>{e.target.style.display='none';}} />
            <div className="ps-canvas-team-abbr car">{carAbbr}</div>
            <div className="ps-canvas-score-num">{carScore ?? '–'}</div>
          </div>
          <div className="ps-canvas-divider">–</div>
          <div className="ps-canvas-team">
            <img src={logoUrl(oppAbbr)} alt={oppAbbr} className="ps-canvas-team-logo"
              onError={e=>{e.target.style.display='none';}} />
            <div className="ps-canvas-team-abbr">{oppAbbr}</div>
            <div className="ps-canvas-score-num">{oppScore ?? '–'}</div>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="ps-canvas-stats">
        {stats.map((s, i) => (
          <div key={i} className="ps-canvas-stat">
            <div className={`ps-canvas-stat-val ${s.color || ''}`}>{s.val}</div>
            <div className="ps-canvas-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Goals — two column for game, single column for period */}
      {summary.goals.length > 0 && (
        <div className="ps-canvas-goals">
          <div className="ps-canvas-section-label">
            {isGame ? 'Goals This Game' : 'Goals This Period'}
          </div>
          {isGame ? (
            <div className="ps-canvas-goals-two-col">
              {/* CAR column */}
              <div className="ps-canvas-goals-col">
                <div className="ps-canvas-goals-col-header car">{carAbbr}</div>
                {carGoals.map((g, i) => (
                  <div key={i} className="ps-canvas-goal-compact">
                    <span className="ps-canvas-goal-compact-name">
                      {g.scorerName?.split(' ').pop() || carAbbr}
                    </span>
                    <span className="ps-canvas-goal-compact-meta">
                      P{g.period} {g.time}
                      {strengthLabel(g.strength) !== 'ev' && (
                        <span className={`ps-canvas-strength ${strengthLabel(g.strength)}`}>
                          {' '}{strengthLabel(g.strength).toUpperCase()}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              {/* OPP column */}
              <div className="ps-canvas-goals-col">
                <div className="ps-canvas-goals-col-header">{oppAbbr}</div>
                {oppGoals.map((g, i) => (
                  <div key={i} className="ps-canvas-goal-compact">
                    <span className="ps-canvas-goal-compact-name">
                      {g.scorerName?.split(' ').pop() || oppAbbr}
                    </span>
                    <span className="ps-canvas-goal-compact-meta">
                      P{g.period} {g.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Period cards: two-column compact layout — matches game card style */
            <div className="ps-canvas-goals-two-col">
              <div className="ps-canvas-goals-col">
                <div className="ps-canvas-goals-col-header car">{carAbbr}</div>
                {summary.goals.filter(g => g.isCar).slice(0, 5).map((g, i) => (
                  <div key={i} className="ps-canvas-goal-compact">
                    <span className="ps-canvas-goal-compact-name">
                      {g.scorerName?.split(' ').pop() || carAbbr}
                    </span>
                    <span className="ps-canvas-goal-compact-meta">
                      {g.time}
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
                {summary.goals.filter(g => !g.isCar).slice(0, 5).map((g, i) => (
                  <div key={i} className="ps-canvas-goal-compact">
                    <span className="ps-canvas-goal-compact-name">
                      {g.scorerName?.split(' ').pop() || oppAbbr}
                    </span>
                    <span className="ps-canvas-goal-compact-meta">{g.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Insights — period only (game has AI narrative above instead) */}
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
          {(carPenalties > 0 || oppPenalties > 0) && (
            <div className="ps-canvas-insight-chip">
              🚨 Penalties: {carAbbr} {carPenalties} – {oppPenalties} {oppAbbr}
            </div>
          )}
          {summary.carTK != null && (
            <div className="ps-canvas-insight-chip">
              {summary.carTK > summary.carGV ? '✓' : '✗'} Takeaways {summary.carTK} · Giveaways {summary.carGV}
            </div>
          )}
        </div>
      )}

      {/* Three stars — game summary only */}
      {isGame && summary.threeStars?.length > 0 && (
        <div className="ps-canvas-three-stars">
          <div className="ps-canvas-section-label">Three Stars</div>
          <div className="ps-canvas-stars-row">
            {summary.threeStars.slice(0, 3).map((s, i) => {
              const name = s.name?.default || '—';
              // Proxy headshot through /nhl-assets/ to avoid CORS during html-to-image export
              const headshot = s.headshot
                ? s.headshot.replace('https://assets.nhle.com', '/nhl-assets')
                : null;
              return (
                <div key={i} className="ps-canvas-star">
                  <div className="ps-canvas-star-rank">{'⭐'.repeat(3 - i)}</div>
                  {headshot ? (
                    <img src={headshot} alt={name} className="ps-canvas-star-img"
                      onError={e => { e.target.style.display='none'; }} />
                  ) : (
                    <div className="ps-canvas-star-initials">
                      {name.split(' ').map(n=>n[0]).join('').slice(0,2)}
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
        <span className="ps-canvas-footer-tag">#LetsGoCanes</span>
      </div>
    </div>
  );
}

// ── Collapsible penalties section ───────────────────────────
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
            <span style={{marginLeft:'auto',fontSize:11,color:'var(--text-dim)',flexShrink:0}}>{p.time}</span>
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
export default function PeriodSummary({
  summary,
  onDismiss,
  onNarrativeReady,
  carAbbr = TEAM_CONFIG.abbr,
  oppAbbr = 'OPP',
  homeAbbr = TEAM_CONFIG.abbr,
  awayAbbr = 'OPP',
  readOnly = false,
  isPlayoff = false,
}) {
  const canvasRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [captionCopied, setCaptionCopied] = useState(false);
  const [canvasMounted, setCanvasMounted] = useState(false);

  // Generate AI narrative on mount — Worker generates once and caches in KV for all users.
  useEffect(() => {
    if (!summary || summary.aiNarrative || !summary.aiLoading) return;
    generateNarrative(summary, carAbbr, oppAbbr, isPlayoff).then(text => {
      if (text && onNarrativeReady) onNarrativeReady(summary.period, text);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary?.period]);

  if (!summary) return null;

  const carIsHome = homeAbbr === carAbbr;
  const carScore = carIsHome ? summary.homeScore : summary.awayScore;
  const oppScore = carIsHome ? summary.awayScore : summary.homeScore;

  const handleExport = async () => {
    setExporting(true);
    if (!canvasMounted) {
      setCanvasMounted(true);
      await new Promise(r => setTimeout(r, 100));
    }
    try {
      const { toPng } = await import('html-to-image');
      const node = canvasRef.current;
      if (!node) return;
      const dataUrl = await toPng(node, {
        width: 1080,
        height: 1080,
        skipFonts: true,
        imagePlaceholder: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        style: { position: 'static', left: '0', top: '0' },
      });
      const link = document.createElement('a');
      link.download = `EyeWall-${carAbbr}-${summary.periodShort}-Summary.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Export failed:', e);
    } finally {
      setExporting(false);
    }
  };

  const handleCopyCaption = () => {
    const caption = [
      `${summary.periodLabel} Summary | ${carAbbr} ${carScore ?? '–'}–${oppScore ?? '–'} ${oppAbbr}`,
      `CF% ${summary.corsiForPct} · SOG ${summary.carSOG}–${summary.oppSOG} · Goals ${summary.carGoals}–${summary.oppGoals}`,
      summary.aiNarrative || '',
      '#LetsGoCanes #EyeWallAnalytics',
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(caption).then(() => {
      setCaptionCopied(true);
      setTimeout(() => setCaptionCopied(false), 2000);
    });
  };

  return (
    <>
      <div className="ps-overlay" onClick={readOnly ? undefined : onDismiss}>
        <div className="ps-card" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="ps-header">
            <span className="ps-period-badge">{summary.periodShort} Summary</span>
            <button className="ps-btn-icon" onClick={onDismiss} title="Close" aria-label="Close">✕</button>
          </div>

          {/* Score */}
          <div className="ps-score-banner">
            <div className="ps-team-score">
              <img
                src={`https://assets.nhle.com/logos/nhl/svg/${carAbbr}_dark.svg`}
                alt={carAbbr}
                className="ps-team-logo"
                onError={e => { e.target.style.display='none'; }}
              />
              <div className="ps-team-abbr car">{carAbbr}</div>
              <div className="ps-score-num">{carScore ?? '–'}</div>
            </div>
            <div className="ps-score-divider">–</div>
            <div className="ps-team-score">
              <img
                src={`https://assets.nhle.com/logos/nhl/svg/${oppAbbr}_dark.svg`}
                alt={oppAbbr}
                className="ps-team-logo"
                onError={e => { e.target.style.display='none'; }}
              />
              <div className="ps-team-abbr">{oppAbbr}</div>
              <div className="ps-score-num">{oppScore ?? '–'}</div>
            </div>
          </div>

          {/* Stat grid — same source as canvas for consistency */}
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

          {/* Goals carousel */}
          {summary.goals.length > 0 && (
            <>
              <div className="ps-section-label">Goals ({summary.goals.length})</div>
              <GoalCarousel goals={summary.goals} carAbbr={carAbbr} />
            </>
          )}

          {/* Penalties — collapsed if more than 3 */}
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

          {/* Three stars (final period / game summary) */}
          {summary.threeStars?.length > 0 && (
            <>
              <div className="ps-section-label">Three Stars</div>
              <div className="ps-three-stars">
                {summary.threeStars.slice(0, 3).map((s, i) => (
                  <div key={i} className="ps-star-card">
                    <div className="ps-star-rank">{'⭐'.repeat(3 - i)}</div>
                    <img className="ps-star-headshot" src={s.headshot || ''} alt={s.name?.default || ''} onError={e => { e.target.style.display='none'; }} />
                    <div className="ps-star-name">{s.name?.default || '—'}</div>
                    <div className="ps-star-team">{s.teamAbbrev?.default || ''}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Share */}
          <div className="ps-share-section">
            <button className="ps-share-btn primary" onClick={handleExport} disabled={exporting}>
              {exporting ? '⏳ Saving…' : '📸 Save Image'}
            </button>
            <button className="ps-share-btn secondary" onClick={handleCopyCaption}>
              {captionCopied ? '✓ Copied' : '📋 Copy Caption'}
            </button>
          </div>

        </div>
      </div>

      {/* Off-screen canvas for image export — only mounted on first export click */}
      {canvasMounted && (
        <ShareCanvas
          summary={summary}
          carAbbr={carAbbr}
          oppAbbr={oppAbbr}
          homeAbbr={homeAbbr}
          canvasRef={canvasRef}
        />
      )}
    </>
  );
}
