import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetch } from '../hooks/useFetch';
import {
  getTeamStats, getTeamStatsPlayoff, getTeamRecentGames, getTeamTopPlayers,
  TEAM_COLORS, TEAM_CONFIG,
} from '../utils/nhlApi';
import { computeGSAx } from '../utils/advancedStats';
import { getGoalieAnalytics, getTeamLines, getGameMatchup } from '../utils/supabaseClient';
import TeamLogo from './TeamLogo';
import InfoTip from './InfoTip';
import { useShareCard } from '../hooks/useShareCard';
import ShareButtons from './ShareButtons';
// ScoutingTab.css import removed (Phase 6) -- migrated to Tailwind. NHL-only,
// no PWHL equivalent by design.
import { capture } from '../utils/analytics';

const SCOUTING_EMPTY_CLASSES = 'scouting-empty text-[11px] text-[color:var(--text-dim)] py-1';
const SCOUTING_SECTION_CLASSES = 'scouting-section py-[10px] border-b-[0.5px] border-b-[color:var(--border)] last:border-b-0';
const SCOUTING_SECTION_LABEL_CLASSES = 'scouting-section-label text-[9px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-dim)] mb-2';

// .scouting-goalie-row was declared twice in the original CSS (once for
// background near the player-row rules, again for padding/border-bottom
// near the goalie section) -- non-conflicting properties, so the real
// cascade-resolved element gets all three at once. Its background is a
// genuine light-mode gap (invisible rgba(255,255,255,0.02)), fixed via
// light-mode-overrides.css, same shape fixed throughout this migration.
const SCOUTING_GOALIE_ROW_CLASSES = 'scouting-goalie-row bg-[rgba(255,255,255,0.02)] py-[5px] border-b-[0.5px] border-b-[color:var(--border)] last:border-b-0';
const SCOUTING_PLAYER_NAME_CLASSES = 'scouting-player-name text-[color:var(--text)] font-medium text-[10px] whitespace-nowrap overflow-hidden text-ellipsis';
const SCOUTING_GOALIE_STAT_CLASSES = 'scouting-goalie-stat flex flex-col gap-px';
const SCOUTING_GOALIE_LABEL_CLASSES = 'scouting-goalie-label text-[8px] font-bold uppercase tracking-[0.05em] text-[color:var(--text-dim)] flex items-center gap-[2px]';
const SCOUTING_GOALIE_VAL_CLASSES = 'scouting-goalie-val font-[family-name:var(--font-mono)] text-[11px] font-semibold text-[color:var(--text-muted)]';

// Recent form dots
function FormDots({ games }) {
  const { t } = useTranslation();
  const dots = (games || []).slice(0, 10).reverse();
  if (!dots.length) return <span className={SCOUTING_EMPTY_CLASSES}>{t('scoutingTab.formDots.empty')}</span>;
  const dotVariant = {
    w:   'bg-[rgba(61,186,126,0.2)] text-[color:var(--green)]',
    l:   'bg-[rgba(204,34,0,0.2)] text-[color:var(--red-bright)]',
    otl: 'bg-[rgba(240,160,48,0.18)] text-[color:var(--amber)]',
  };
  return (
    <div className="scouting-form-dots flex gap-[3px] flex-wrap">
      {dots.map((g, i) => {
        const r = g.result.toLowerCase();
        return (
          <div key={i} className={`scouting-dot ${r} w-[22px] h-[22px] rounded-[5px] flex items-center justify-center text-[8px] font-bold cursor-default ${dotVariant[r] || ''}`}
            title={t('scoutingTab.formDots.tooltip', { date: g.date?.slice(5,10), opp: g.opp, result: g.result, teamScore: g.teamScore, oppScore: g.oppScore })}>
            {g.result === 'OTL' ? 'O' : g.result}
          </div>
        );
      })}
    </div>
  );
};



// Comparison row — green = CAR advantage
function CompareRow({ label, carVal, oppVal, higherBetter = true, fmt = v => v?.toFixed(2) ?? '—', tip }) {
  const c = Number(carVal) || 0, o = Number(oppVal) || 0;
  const carBetter = higherBetter ? c > o : c < o;
  const oppBetter = higherBetter ? o > c : o < c;
  const pct = (c + o) > 0 ? Math.round(c / (c + o) * 100) : 50;
  return (
    <div className="scouting-compare-row grid [grid-template-columns:48px_1fr_48px] items-center gap-1.5 py-1">
      <span className="scouting-compare-car font-[family-name:var(--font-mono)] text-[12px] font-bold text-left"
        style={{color: carBetter ? 'var(--green)' : oppBetter ? 'var(--red-bright)' : 'var(--text-muted)'}}>
        {fmt(carVal)}
      </span>
      <div className="scouting-compare-mid flex flex-col gap-[3px]">
        <div className="scouting-compare-label text-[10px] text-[color:var(--text-dim)] text-center flex items-center justify-center gap-[3px]">
          {label}{tip && <InfoTip text={tip} position="above" />}
        </div>
        <div className="scouting-compare-bar h-1 rounded-[2px] bg-[var(--bg3)] flex overflow-hidden">
          <div className="scouting-bar-car bg-[var(--red-bright)] rounded-l-[2px]" style={{width:`${pct}%`}} />
          <div className="scouting-bar-opp bg-[color:var(--text-dim)] rounded-r-[2px]" style={{width:`${100-pct}%`}} />
        </div>
      </div>
      <span className="scouting-compare-opp font-[family-name:var(--font-mono)] text-[12px] font-bold text-right"
        style={{color: oppBetter ? 'var(--amber)' : carBetter ? 'var(--text-muted)' : 'var(--text-muted)'}}>
        {fmt(oppVal)}
      </span>
    </div>
  );
};



// Player table for one team
function PlayerTable({ players, loading, color, goalieAnalytics }) {
  const { t } = useTranslation();
  if (loading) return <div className="scouting-loading text-[11px] text-[color:var(--text-dim)] py-2">{t('common.loading')}</div>;
  if (!players?.skaters?.length) return <div className={SCOUTING_EMPTY_CLASSES}>{t('scoutingTab.playerTable.noData')}</div>;
  return (
    <div className="scouting-player-table flex flex-col">
      <div className="scouting-player-header grid [grid-template-columns:1fr_18px_18px_24px] gap-[2px] py-[2px] text-[8px] text-[color:var(--text-dim)] uppercase border-b-[0.5px] border-b-[color:var(--border)] mb-px">
        <span>{t('gameStatsPopup.table.player')}</span><span>G</span><span>A</span><span>PTS</span>
      </div>
      {players.skaters.map((p, i) => (
        <div key={i} className="scouting-player-row grid [grid-template-columns:1fr_18px_18px_24px] gap-[2px] py-1 items-center border-b-[0.5px] border-b-[color:var(--border)] text-[11px] text-[color:var(--text-muted)] last:border-b-0">
          <span className="scouting-player-name text-[color:var(--text)] font-medium text-[10px] whitespace-nowrap overflow-hidden text-ellipsis">
            {p.name}<span className="scouting-player-pos text-[8px] text-[color:var(--text-dim)] ml-[3px]">{p.pos}</span>
          </span>
          <span>{p.goals}</span>
          <span>{p.assists}</span>
          <span className="scouting-pts font-bold" style={{color}}>{p.points}</span>
        </div>
      ))}
      {players.goalies?.length > 0 && (
        <>
          <div className="scouting-goalie-divider text-[8px] font-bold uppercase tracking-[0.07em] text-[color:var(--text-dim)] pt-[5px] pb-[3px] border-t-[0.5px] border-t-[color:var(--border)] mt-[3px]">{t('scoutingTab.playerTable.goalies')}</div>
          {players.goalies.map((g, i) => {
            // Use real GSAX from Supabase if available, fall back to estimate
            const seasonData  = goalieAnalytics?.[String(g.playerId)] || null;
            const realGsax    = seasonData?.gsax ?? null;
            const realGp      = seasonData?.gp ?? null;
            const estGsax     = computeGSAx(g.shotsAgainst, g.saves);
            const gsaxColor   = realGsax != null
              ? realGsax >= 5 ? 'var(--green)' : realGsax >= 0 ? 'var(--text-muted)' : 'var(--red-bright)'
              : estGsax?.color;
            const gsaxLabel   = realGsax != null
              ? `${realGsax > 0 ? '+' : ''}${realGsax}`
              : estGsax?.label ?? '—';
            const gsaxNote    = realGsax != null
              ? (realGp ? t('scoutingTab.playerTable.gsaxRealNoteWithGp', { gp: realGp }) : t('scoutingTab.playerTable.gsaxRealNote'))
              : estGsax?.note;
            const svFmt = g.savePct != null && g.savePct > 0
              ? (g.savePct <= 1 ? g.savePct.toFixed(4) : (g.savePct / 100).toFixed(4))
              : '—';
            const gaaVal = g.gaa != null ? g.gaa.toFixed(2) : '—';
            const gaaColor = g.gaa != null
              ? g.gaa < 2.0 ? 'var(--green)'
              : g.gaa > 3.0 ? 'var(--red-bright)'
              : 'var(--text-muted)'
              : 'var(--text-muted)';
            return (
              <div key={`g${i}`} className={SCOUTING_GOALIE_ROW_CLASSES}>
                <span className={`${SCOUTING_PLAYER_NAME_CLASSES} scouting-goalie-name block mb-1`}>{g.name}</span>
                <div className="scouting-goalie-stats flex gap-[10px]">
                  <div className={SCOUTING_GOALIE_STAT_CLASSES}>
                    <span className={SCOUTING_GOALIE_LABEL_CLASSES}>W</span>
                    <span className={SCOUTING_GOALIE_VAL_CLASSES}>{g.wins}</span>
                  </div>
                  <div className={SCOUTING_GOALIE_STAT_CLASSES}>
                    <span className={SCOUTING_GOALIE_LABEL_CLASSES}>GAA</span>
                    <span className={SCOUTING_GOALIE_VAL_CLASSES} style={{color: gaaColor}}>{gaaVal}</span>
                  </div>
                  <div className={SCOUTING_GOALIE_STAT_CLASSES}>
                    <span className={SCOUTING_GOALIE_LABEL_CLASSES}>SV%</span>
                    <span className={SCOUTING_GOALIE_VAL_CLASSES}>{svFmt}</span>
                  </div>
                  <div className={SCOUTING_GOALIE_STAT_CLASSES}>
                    <span className={SCOUTING_GOALIE_LABEL_CLASSES}>
                      GSAX <InfoTip text={gsaxNote} position="above" />
                    </span>
                    <span className={SCOUTING_GOALIE_VAL_CLASSES} style={{color: gsaxColor}}>
                      {gsaxLabel}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};


// ── Goalie matchup card ──────────────────────────────────────
function GoalieMatchupCard({ carPlayers, oppPlayers, oppAbbr: _oppAbbr, oppColor }) {
  const { t } = useTranslation();
  const carGoalie = carPlayers?.goalies?.[0];
  const oppGoalie = oppPlayers?.goalies?.[0];
  if (!carGoalie && !oppGoalie) return null;

  // .gmc-goalie.gmc-car is a genuine compound-selector override (higher
  // specificity than .gmc-goalie alone), not a source-order race -- only
  // border-color differs by team, computed directly per isCAR.
  const gmcGoalieClasses = (isCAR) => `gmc-goalie${isCAR ? ' gmc-car' : ''} flex-1 bg-[var(--bg2)] rounded-[10px] p-3 border-[0.5px] ${isCAR ? 'border-[color:rgba(var(--team-primary-rgb),0.25)]' : 'border-[color:var(--border)]'}`;

  const renderGoalie = (g, isCAR, teamColor) => {
    if (!g) return <div className={gmcGoalieClasses(isCAR)}><span className={SCOUTING_EMPTY_CLASSES}>{t('scoutingTab.playerTable.noData')}</span></div>;
    const sv = g.savePct != null && g.savePct > 0
      ? (g.savePct <= 1 ? g.savePct.toFixed(4) : (g.savePct / 100).toFixed(4)) : '—';
    const gaa = g.gaa != null ? g.gaa.toFixed(2) : '—';
    const gaaColor = g.gaa != null
      ? g.gaa < 2.0 ? 'var(--green)'
      : g.gaa > 3.0 ? 'var(--red-bright)'
      : 'var(--text-muted)' : 'var(--text-muted)';
    return (
      <div className={gmcGoalieClasses(isCAR)}>
        <div className="gmc-goalie-name text-[12px] font-bold mb-1.5" style={{color: teamColor}}>{g.name}</div>
        <div className="gmc-stats-row flex gap-[10px]">
          <div className="gmc-stat flex flex-col items-center gap-px"><div className="gmc-stat-val font-[family-name:var(--font-mono)] text-[13px] font-bold text-[color:var(--text-muted)]">{g.wins}</div><div className="gmc-stat-label text-[8px] text-[color:var(--text-dim)] uppercase tracking-[0.06em]">W</div></div>
          <div className="gmc-stat flex flex-col items-center gap-px"><div className="gmc-stat-val font-[family-name:var(--font-mono)] text-[13px] font-bold text-[color:var(--text-muted)]" style={{color: gaaColor}}>{gaa}</div><div className="gmc-stat-label text-[8px] text-[color:var(--text-dim)] uppercase tracking-[0.06em]">GAA</div></div>
          <div className="gmc-stat flex flex-col items-center gap-px"><div className="gmc-stat-val font-[family-name:var(--font-mono)] text-[13px] font-bold text-[color:var(--text-muted)]">{sv}</div><div className="gmc-stat-label text-[8px] text-[color:var(--text-dim)] uppercase tracking-[0.06em]">SV%</div></div>
        </div>
      </div>
    );
  };
  return (
    <div className={SCOUTING_SECTION_CLASSES}>
      <div className={SCOUTING_SECTION_LABEL_CLASSES}>{t('scoutingTab.goalieMatchup.sectionLabel')}</div>
      <div className="gmc-row flex items-center gap-2">
        {renderGoalie(carGoalie, true, 'var(--team-primary)')}
        <div className="gmc-vs text-[11px] text-[color:var(--text-dim)] shrink-0">{t('scoutingTab.vs')}</div>
        {renderGoalie(oppGoalie, false, oppColor)}
      </div>
    </div>
  );
}

// ── Team total projection ────────────────────────────────────
function TeamTotalCard({ carStats, oppStats, oppAbbr, isPlayoff }) {
  const { t } = useTranslation();
  if (!carStats || !oppStats) return null;
  const carExp = (carStats.goalsForPerGame + oppStats.goalsAgainstPerGame) / 2;
  const oppExp = (oppStats.goalsForPerGame + carStats.goalsAgainstPerGame) / 2;
  const total  = +(carExp + oppExp).toFixed(1);
  return (
    <div className={SCOUTING_SECTION_CLASSES}>
      <div className={SCOUTING_SECTION_LABEL_CLASSES}>
        {t('scoutingTab.teamTotal.sectionLabel')}
        <InfoTip text={t('scoutingTab.teamTotal.tip')} position="above" />
      </div>
      <div className="ttc-wrap bg-[var(--bg2)] border-[0.5px] border-[color:var(--border)] rounded-[8px] py-3 px-[14px]">
        <div className="ttc-score text-[18px] font-extrabold flex gap-2 items-baseline mb-[3px]">
          <span style={{color:'var(--team-primary)'}}>{TEAM_CONFIG.abbr} {+carExp.toFixed(1)}</span>
          <span className="ttc-dash text-[color:var(--text-dim)] font-normal">–</span>
          <span>{+oppExp.toFixed(1)} {oppAbbr}</span>
        </div>
        <div className="ttc-total text-[12px] text-[color:var(--text-muted)] mb-[2px]">{t('scoutingTab.teamTotal.projectedTotalGoals')}<strong>{total}</strong></div>
        <div className="ttc-meta text-[10px] text-[color:var(--text-dim)]">{isPlayoff ? t('scoutingTab.teamTotal.basedOnPlayoff') : t('scoutingTab.teamTotal.basedOnRegularSeason')}</div>
      </div>
    </div>
  );
}

// ── Share canvas (off-screen 1080×1080) ──────────────────────
function ScoutingShareCanvas({ canvasRef, carStats, oppStats, carPlayers, oppPlayers,
  _carRecentGames, _oppRecentGames, oppAbbr, oppColor, isPlayoff, carLines, matchupText }) {
  const { t } = useTranslation();
  if (!carStats || !oppStats) return null;

  const logoUrl    = abbr => `/nhl-assets/logos/nhl/svg/${abbr}_dark.svg`;
  const gpgFmt     = v => v?.toFixed(2) ?? '—';
  const pctFmt     = v => v != null ? `${(v * 100).toFixed(1)}%` : '—';

  // Team total projection
  // eslint-disable-next-line no-unused-vars
  const carExp = ((carStats.goalsForPerGame ?? 0) + (oppStats.goalsAgainstPerGame ?? 0)) / 2; // used in TeamTotalCard variant
  // eslint-disable-next-line no-unused-vars
  const oppExp = ((oppStats.goalsForPerGame ?? 0) + (carStats.goalsAgainstPerGame ?? 0)) / 2;
  return (
    <div className="sc-canvas fixed left-[-9999px] top-0 w-[1080px] h-[1080px] bg-[#1a1a2e] text-white flex flex-col [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] overflow-hidden" ref={canvasRef}>
      {/* Header */}
      <div className="sc-header flex items-center justify-between py-5 px-[52px] pb-2">
        <img src="/eyewall-logo.svg" alt="EyeWall" className="sc-logo w-20 h-20 object-contain" onError={e=>{e.target.style.display='none';}} />
        <span className="sc-badge text-[13px] font-extrabold tracking-[0.14em] uppercase text-[color:var(--team-canvas)] bg-[rgba(var(--team-canvas-rgb),0.12)] py-1.5 px-4 rounded-[20px]">{isPlayoff ? t('scoutingTab.shareCanvas.playoffBadge') : t('scoutingTab.shareCanvas.badge')}</span>
      </div>

      {/* Teams */}
      <div className="sc-teams flex items-center justify-center gap-5 pt-1 px-[52px] pb-2.5 border-b-[0.5px] border-b-[rgba(255,255,255,0.07)]">
        <div className="sc-team flex flex-row items-center gap-2.5">
          <img src={logoUrl(TEAM_CONFIG.abbr)} alt={TEAM_CONFIG.abbr} className="sc-team-logo w-9 h-9 object-contain" onError={e=>{e.target.style.display='none';}} />
          <span className="sc-team-abbr car text-[20px] font-extrabold text-[color:var(--team-canvas)]">CAR</span>
        </div>
        <span className="sc-vs text-[18px] text-[rgba(255,255,255,0.2)]">{t('scoutingTab.vs')}</span>
        <div className="sc-team flex flex-row items-center gap-2.5">
          <img src={logoUrl(oppAbbr)} alt={oppAbbr} className="sc-team-logo w-9 h-9 object-contain" onError={e=>{e.target.style.display='none';}} />
          <span className="sc-team-abbr text-[20px] font-extrabold text-[rgba(255,255,255,0.7)]" style={{color: oppColor}}>{oppAbbr}</span>
        </div>
      </div>

      {/* Stats comparison */}
      <div className="sc-stats py-3.5 px-[52px] pb-2.5 flex flex-col gap-2.5">
        {[
          { label: t('scoutingTab.shareCanvas.stats.goalsForGp'),    car: gpgFmt(carStats.goalsForPerGame),    opp: gpgFmt(oppStats.goalsForPerGame),    carBetter: (carStats.goalsForPerGame??0) > (oppStats.goalsForPerGame??0) },
          { label: t('scoutingTab.shareCanvas.stats.goalsAgainstGp'),car: gpgFmt(carStats.goalsAgainstPerGame),opp: gpgFmt(oppStats.goalsAgainstPerGame),carBetter: (carStats.goalsAgainstPerGame??99) < (oppStats.goalsAgainstPerGame??99) },
          { label: t('scoutingTab.shareCanvas.stats.powerPlayPct'),      car: pctFmt(carStats.powerPlayPct),       opp: pctFmt(oppStats.powerPlayPct),       carBetter: (carStats.powerPlayPct??0) > (oppStats.powerPlayPct??0) },
          { label: t('scoutingTab.shareCanvas.stats.penaltyKillPct'),    car: pctFmt(carStats.penaltyKillPct),     opp: pctFmt(oppStats.penaltyKillPct),     carBetter: (carStats.penaltyKillPct??0) > (oppStats.penaltyKillPct??0) },
          { label: t('scoutingTab.shareCanvas.stats.shotsForGp'),    car: (carStats.shotsForPerGame??0).toFixed(1), opp: (oppStats.shotsForPerGame??0).toFixed(1), carBetter: (carStats.shotsForPerGame??0) > (oppStats.shotsForPerGame??0) },
        ].map((r, i) => (
          <div key={i} className="sc-stat-row flex items-center gap-3">
            <span className={`sc-stat-val w-20 text-[23px] font-bold text-right ${r.carBetter ? 'good text-[#4ade80]' : 'muted text-[rgba(255,255,255,0.4)]'}`} style={{fontSize:17}}>{r.car}</span>
            <span className="sc-stat-label flex-1 text-center text-[14px] text-[rgba(255,255,255,0.35)] uppercase tracking-[0.08em]" style={{fontSize:11}}>{r.label}</span>
            <span className={`sc-stat-val w-20 text-[23px] font-bold text-left ${!r.carBetter ? 'good-opp text-[#fb923c]' : 'muted text-[rgba(255,255,255,0.4)]'}`} style={{fontSize:17}}>{r.opp}</span>
          </div>
        ))}
      </div>

      {/* AI Matchup Analysis — replaces team total + recent form */}
      {matchupText && (
        <div style={{margin:'0 52px 14px', padding:'12px 16px',
          background:'rgba(255,255,255,0.04)', borderRadius:10,
          borderLeft:`3px solid ${TEAM_CONFIG.displayColor}`}}>
          <div style={{fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em',
            color: TEAM_CONFIG.displayColor, marginBottom:8}}>{t('scoutingTab.aiMatchup.sectionLabel')}</div>
          <div style={{fontSize:12, lineHeight:1.55, color:'rgba(255,255,255,0.65)',
            display:'-webkit-box', WebkitLineClamp:7, WebkitBoxOrient:'vertical', overflow:'hidden'}}>
            {matchupText}
          </div>
        </div>
      )}

      {/* Top players + goalies */}
      <div style={{display:'flex', gap:16, padding:'0 52px 14px'}}>
        {[
          { label: TEAM_CONFIG.abbr, color: TEAM_CONFIG.displayColor, players: carPlayers },
          { label: oppAbbr, color: oppColor, players: oppPlayers },
        ].map(({ label, color, players }) => (
          <div key={label} style={{flex:1, background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'12px 14px'}}>
            <div style={{fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em',
              color: color, marginBottom:8}}>{isPlayoff ? t('scoutingTab.shareCanvas.playoffLeaders', { team: label }) : t('scoutingTab.shareCanvas.leaders', { team: label })}</div>
            {players?.skaters?.slice(0,5).map((p, i) => (
              <div key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center',
                fontSize:13, padding:'4px 0', borderBottom:'0.5px solid rgba(255,255,255,0.05)'}}>
                <span style={{color:'rgba(255,255,255,0.8)', fontWeight:500}}>{p.name}</span>
                <span style={{color: color, fontWeight:700}}>{p.points}pts</span>
              </div>
            ))}
            {players?.goalies?.[0] && (
              <div style={{marginTop:6, padding:'4px 0', borderTop:'0.5px solid rgba(255,255,255,0.08)'}}>
                <div style={{fontSize:12, color:'rgba(255,255,255,0.55)', marginBottom:3}}>
                  {players.goalies[0].name}
                </div>
                <div style={{display:'flex', gap:10, fontSize:12}}>
                  <span>W {players.goalies[0].wins}</span>
                  <span style={{color: players.goalies[0].gaa < 2.5 ? '#4ade80' : players.goalies[0].gaa > 3.2 ? '#ef384c' : 'rgba(255,255,255,0.5)'}}>
                    GAA {players.goalies[0].gaa?.toFixed(2) ?? '—'}
                  </span>
                  <span>SV% {players.goalies[0].savePct?.toFixed(4) ?? '—'}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Line projections — CAR only, two-column: forward lines left, D pairs right */}
      {carLines?.lines?.length > 0 && (
        <div style={{padding:'0 52px 12px'}}>
          <div style={{fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em',
            color:'rgba(255,255,255,0.25)', marginBottom:8}}>
            {t('scoutingTab.shareCanvas.carLinesHeader', { abbr: TEAM_CONFIG.abbr, scope: isPlayoff ? t('scoutingTab.shareCanvas.playoffsScope') : t('scoutingTab.shareCanvas.thisSeason') })}
          </div>
          <div style={{display:'flex', gap:12}}>

            {/* Left column — forward lines */}
            <div style={{flex:3, display:'flex', flexDirection:'column', gap:5}}>
              {carLines.lines.slice(0, 4).map((line, i) => {
                const xgf  = line.xgfPct;
                const good = xgf != null && xgf >= 50;
                const POS_LABEL = { L: 'LW', LW: 'LW', C: 'C', R: 'RW', RW: 'RW', D: 'D' };
                return (
                  <div key={i} style={{display:'flex', alignItems:'center', gap:8,
                    padding:'6px 10px', background:'rgba(255,255,255,0.03)',
                    borderRadius:7, border:'0.5px solid rgba(255,255,255,0.06)'}}>
                    <span style={{fontSize:11, fontWeight:700, color: TEAM_CONFIG.displayColor, minWidth:42, flexShrink:0}}>
                      {t('scoutingTab.lines.line', { n: i + 1 })}
                    </span>
                    <div style={{flex:1, display:'flex', gap:10, flexWrap:'wrap'}}>
                      {line.players.map((p, j) => (
                        <span key={j} style={{fontSize:12, color:'rgba(255,255,255,0.8)',
                          display:'flex', gap:3, alignItems:'baseline'}}>
                          <span style={{fontSize:10, color:'rgba(255,255,255,0.3)', fontWeight:700,
                            textTransform:'uppercase'}}>
                            {POS_LABEL[p.pos] || p.pos}
                          </span>
                          {p.name}
                        </span>
                      ))}
                    </div>
                    <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', flexShrink:0}}>
                      <span style={{fontSize:13, fontWeight:800,
                        color: xgf != null ? (good ? '#4ade80' : '#ef384c') : 'rgba(255,255,255,0.25)'}}>
                        {xgf != null ? `${xgf.toFixed(1)}%` : '—'}
                      </span>
                      <span style={{fontSize:9, color:'rgba(255,255,255,0.25)', letterSpacing:'0.05em'}}>xGF%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right column — D pairs */}
            {carLines.pairs?.length > 0 && (
              <div style={{flex:2, display:'flex', flexDirection:'column', gap:5}}>
                {carLines.pairs.slice(0, 3).map((pair, i) => {
                  const xgf  = pair.xgfPct;
                  const good = xgf != null && xgf >= 50;
                  return (
                    <div key={i} style={{display:'flex', alignItems:'center', gap:8,
                      padding:'6px 10px', background:'rgba(255,255,255,0.03)',
                      borderRadius:7, border:'0.5px solid rgba(255,255,255,0.06)'}}>
                      <span style={{fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.4)',
                        minWidth:38, flexShrink:0}}>
                        {t('scoutingTab.lines.pair', { n: i + 1 })}
                      </span>
                      <div style={{flex:1, display:'flex', flexDirection:'column', gap:2}}>
                        {pair.players.map((p, j) => (
                          <span key={j} style={{fontSize:12, color:'rgba(255,255,255,0.75)'}}>
                            {p.name}
                          </span>
                        ))}
                      </div>
                      <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', flexShrink:0}}>
                        <span style={{fontSize:13, fontWeight:800,
                          color: xgf != null ? (good ? '#4ade80' : '#ef384c') : 'rgba(255,255,255,0.25)'}}>
                          {xgf != null ? `${xgf.toFixed(1)}%` : '—'}
                        </span>
                        <span style={{fontSize:9, color:'rgba(255,255,255,0.25)', letterSpacing:'0.05em'}}>xGF%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>
      )}

      {/* Footer */}
      <div className="sc-footer flex justify-between py-2 px-[52px] pb-5 text-[13px] text-[rgba(255,255,255,0.2)] mt-auto">
        <span>eyewallanalytics.com</span>
        <span>{TEAM_CONFIG.hashtags?.[0] || `#${TEAM_CONFIG.abbr}`}</span>
      </div>
    </div>
  );
}


// ── Line combinations section ──────────────────────────────────────────────

// Position display: NHL API codes → readable labels
const POS_LABEL = { L: 'LW', LW: 'LW', C: 'C', R: 'RW', RW: 'RW', D: 'D' };

function XgfBadge({ pct }) {
  const base = 'sc-line-xgf text-[12px] font-bold';
  if (pct == null) return <span className={`${base} sc-line-xgf-null text-[color:var(--text-dim)] font-normal`}>—</span>;
  const good = pct >= 50;
  return (
    <span className={`${base} ${good ? 'sc-line-xgf-good text-[color:var(--green)]' : 'sc-line-xgf-bad text-[color:var(--red-bright)]'}`}>
      {pct.toFixed(1)}%
    </span>
  );
}

function LineUnit({ unit, label, color, _isDefence }) {
  const { t } = useTranslation();
  const toiLabel = unit.toiMins != null ? t('scoutingTab.lines.toiTogether', { mins: unit.toiMins }) : null;
  return (
    <div className={`sc-line-unit${unit.isStatic ? ' sc-line-static border-dashed' : ''} bg-[var(--bg2)] border-[0.5px] border-[color:var(--border)] rounded-[8px] py-[9px] px-[11px]`}>
      <div className="sc-line-header flex items-center justify-between mb-1.5">
        <span className="sc-line-label text-[11px] font-bold tracking-[0.03em] min-w-[44px]" style={{ color }}>{label}</span>
        <div className="sc-line-meta flex items-center gap-2.5">
          {toiLabel && (
            <span className="sc-line-toi text-[10px] text-[color:var(--text-dim)] flex items-center gap-[3px]">
              {toiLabel}
              <InfoTip text={t('scoutingTab.lines.toiTip')} position="above" />
            </span>
          )}
          <span className="sc-line-xgf-wrap flex items-center gap-[3px]">
            <span className="sc-line-xgf-label text-[10px] text-[color:var(--text-dim)] font-semibold">xGF%</span>
            <XgfBadge pct={unit.xgfPct} />
            <InfoTip text={t('scoutingTab.lines.xgfTip')} position="above" />
          </span>
        </div>
      </div>
      <div className="sc-line-players flex gap-y-1.5 gap-x-3.5 flex-wrap">
        {unit.players.map((p, i) => (
          <span key={i} className="sc-line-player text-[12px] text-[color:var(--text)] flex items-baseline gap-1">
            <span className="sc-line-pos text-[9px] font-bold text-[color:var(--text-dim)] uppercase tracking-[0.04em] min-w-[18px]">{POS_LABEL[p.pos] || p.pos}</span>
            {p.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function LinesSection({ lines, color, isPlayoff, abbr }) {
  const { t } = useTranslation();
  if (!lines) return null;
  const { lines: fLines, pairs: dPairs, _isInferred } = lines;
  const lineLabels = [0, 1, 2, 3].map(i => t('scoutingTab.lines.line', { n: i + 1 }));
  const pairLabels = [0, 1, 2].map(i => t('scoutingTab.lines.pair', { n: i + 1 }));
  const hasAnyStatic = [...(fLines || []), ...(dPairs || [])].some(u => u.isStatic);
  return (
    <div className={SCOUTING_SECTION_CLASSES}>
      <div className={SCOUTING_SECTION_LABEL_CLASSES}>
        {t('scoutingTab.lines.sectionLabel', { abbr })}
        {isPlayoff && <span className="sc-lines-playoff-badge inline-block text-[9px] font-bold text-[color:var(--amber)] bg-[rgba(240,160,48,0.12)] rounded-[4px] py-px px-1.5 ml-1.5 align-middle uppercase tracking-[0.06em]">{t('scoutingTab.lines.playoffsBadge')}</span>}
        <InfoTip text={t('scoutingTab.lines.sectionTip')} position="above" />
      </div>
      {hasAnyStatic && (
        <div className="sc-lines-note text-[11px] text-[color:var(--text-dim)] italic mb-1">
          {t('scoutingTab.lines.liveNote')}
        </div>
      )}
      {/* .sc-lines-note's own margin-bottom:4px loses to .sc-lines-opponent-note's
          8px here -- both single-class selectors, equal specificity, opponent-note
          declared later in the original file -- final resolved value is 8px, not
          a stack of both. */}
      <div className="sc-lines-note sc-lines-opponent-note text-[11px] text-[color:var(--text-dim)] italic mb-2">
        {t('scoutingTab.lines.opponentNote')}
      </div>
      {fLines.length > 0 && (
        <div className="sc-lines-group flex flex-col gap-[6px] mb-2.5">
          {fLines.map((u, i) => (
            <LineUnit key={i} unit={u} label={lineLabels[i] || t('scoutingTab.lines.line', { n: u.rank })} color={color} />
          ))}
        </div>
      )}
      {dPairs.length > 0 && (
        <div className="sc-lines-group sc-lines-group-d flex flex-col gap-[6px] mb-2.5 border-t border-[color:var(--border)] pt-2.5 mt-[2px]">
          <div className="sc-lines-subheader text-[9px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-dim)] mb-1">{t('scoutingTab.lines.defencePairs')}</div>
          {dPairs.map((u, i) => (
            <LineUnit key={i} unit={u} label={pairLabels[i] || t('scoutingTab.lines.pair', { n: u.rank })} color={color} isDefence />
          ))}
        </div>
      )}
    </div>
  );
}


export default function ScoutingTab({ oppAbbr, oppStanding, carStanding, isPlayoff, gameId }) {
  const { t } = useTranslation();
  const gameType = isPlayoff ? 3 : 2;
  const carColor = 'var(--team-primary)';
  const oppColor = TEAM_COLORS[oppAbbr] || 'var(--text-muted)';

  const canvasRef = useRef(null);
  const [canvasMounted, setCanvasMounted] = useState(false);

  const xCaption = [
    t('scoutingTab.xCaption', { abbr: TEAM_CONFIG.abbr, oppAbbr }),
    '#EyeWallAnalytics',
  ].join('\n');

  const { saving, sharing, handleSave, handleShareX, handleNativeShare, canNativeShare } =
    useShareCard({
      canvasRef,
      filename: `EyeWall-Scouting-${TEAM_CONFIG.abbr}-vs-${oppAbbr}.png`,
      xCaption,
      mountCanvas: async () => {
        if (!canvasMounted) {
          setCanvasMounted(true);
          await new Promise(r => setTimeout(r, 120));
        }
      },
    });

  const handleSaveWithCapture = async () => {
    await handleSave();
    capture('scouting_card_exported', { opponent: oppAbbr, isPlayoff: !!isPlayoff });
  };

  const { data: carRecentGames } = useFetch(
    () => getTeamRecentGames(TEAM_CONFIG.abbr, 10, isPlayoff), [TEAM_CONFIG.abbr, isPlayoff]
  );
  const { data: oppRecentGames } = useFetch(
    () => getTeamRecentGames(oppAbbr, 10, isPlayoff), [oppAbbr, isPlayoff]
  );
  const { data: carTopPlayers, loading: carPlayersLoading } = useFetch(
    () => getTeamTopPlayers(TEAM_CONFIG.abbr, gameType), [TEAM_CONFIG.abbr, gameType]
  );
  const { data: oppTopPlayers, loading: oppPlayersLoading } = useFetch(
    () => getTeamTopPlayers(oppAbbr, gameType), [oppAbbr, gameType]
  );
  const { data: carStats } = useFetch(() => getTeamStats(TEAM_CONFIG.abbr), [TEAM_CONFIG.abbr]);
  const { data: oppStats } = useFetch(() => getTeamStats(oppAbbr), [oppAbbr]);
  const { data: carPoStats } = useFetch(
    () => isPlayoff ? getTeamStatsPlayoff(TEAM_CONFIG.abbr) : Promise.resolve(null),
    [TEAM_CONFIG.abbr, 'po', isPlayoff]
  );
  const { data: oppPoStats } = useFetch(
    () => isPlayoff ? getTeamStatsPlayoff(oppAbbr) : Promise.resolve(null),
    [oppAbbr, 'po', isPlayoff]
  );
  const { data: goalieAnalytics } = useFetch(() => getGoalieAnalytics());
  const { data: carLines } = useFetch(() => getTeamLines(TEAM_CONFIG.abbr, TEAM_CONFIG.season, gameType), [TEAM_CONFIG.abbr, TEAM_CONFIG.season, gameType]);
  const { data: matchupData } = useFetch(() => getGameMatchup(gameId), [gameId]);

  // Use playoff stats when available, fall back to regular season
  const compCarStats = isPlayoff ? (carPoStats || carStats) : carStats;
  const compOppStats = isPlayoff ? (oppPoStats || oppStats) : oppStats;

  const pctFmt = v => v != null ? `${(v * 100).toFixed(1)}%` : '—';
  const gpgFmt = v => v?.toFixed(2) ?? '—';

  return (
    <>
    <div className="scouting-wrap flex flex-col gap-[2px]">
      {/* AI Matchup Analysis */}
      {matchupData?.text && (
        <div className="sc-matchup-section py-3 pb-3.5 border-b-[0.5px] border-b-[color:var(--border)] mb-1">
          <div className="sc-matchup-label text-[10px] font-bold uppercase tracking-[0.1em] text-[color:var(--team-primary,var(--red-bright))] mb-2">{t('scoutingTab.aiMatchup.sectionLabel')}</div>
          <div className="sc-matchup-text text-[13px] leading-[1.65] text-[color:var(--text)] whitespace-pre-wrap">{matchupData.text}</div>
          <div className="sc-matchup-footer text-[10px] text-[color:var(--text-dim)] mt-2">{t('scoutingTab.aiMatchup.footer')}</div>
        </div>
      )}

      {isPlayoff && (
        <div className="scouting-playoff-badge text-[10px] font-bold text-[color:var(--amber)] bg-[rgba(240,160,48,0.1)] rounded-[6px] py-1 px-[10px] text-center mb-1.5">{t('scoutingTab.playoffStatsBadge', { season: SEASON_LABEL })}</div>
      )}

      {/* Team headers */}
      <div className="scouting-teams-header grid [grid-template-columns:1fr_auto_1fr] items-center gap-2 py-2 pb-3 border-b-[0.5px] border-b-[color:var(--border)] mb-1">
        <div className="scouting-team-col flex flex-col items-center gap-1">
          <TeamLogo abbr={TEAM_CONFIG.abbr} size={32} />
          <span className="scouting-team-abbr font-[family-name:var(--font-display)] text-[18px] font-black" style={{color: carColor}}>{TEAM_CONFIG.abbr}</span>
          {carStanding && (
            <span className="scouting-team-record text-[11px] text-[color:var(--text-muted)]">
              {carStanding.wins}–{carStanding.losses}–{carStanding.otLosses || 0}
            </span>
          )}
        </div>
        <div className="scouting-vs text-[11px] text-[color:var(--text-dim)] font-semibold">{t('scoutingTab.vs')}</div>
        <div className="scouting-team-col flex flex-col items-center gap-1">
          <TeamLogo abbr={oppAbbr} size={32} color={oppColor} />
          <span className="scouting-team-abbr font-[family-name:var(--font-display)] text-[18px] font-black" style={{color: oppColor}}>{oppAbbr}</span>
          {oppStanding && (
            <span className="scouting-team-record text-[11px] text-[color:var(--text-muted)]">
              {oppStanding.wins}–{oppStanding.losses}–{oppStanding.otLosses || 0}
            </span>
          )}
        </div>
      </div>

      {/* Season/Playoff comparison — uses playoff stats when isPlayoff */}
      {(compCarStats || compOppStats) && (
        <div className={SCOUTING_SECTION_CLASSES}>
          <div className={SCOUTING_SECTION_LABEL_CLASSES}>
            {isPlayoff ? t('scoutingTab.playoffComparison') : t('scoutingTab.seasonComparison')}
          </div>
          <div className="scouting-compare-header grid [grid-template-columns:48px_1fr_48px] text-center text-[9px] font-bold uppercase tracking-[0.05em] mb-1.5 text-[color:var(--text-dim)]">
            <span style={{color: carColor}}>{TEAM_CONFIG.abbr}</span>
            <span />
            <span style={{color: oppColor}}>{oppAbbr}</span>
          </div>
          <CompareRow label={t('scoutingTab.compare.gfGp')} carVal={compCarStats?.goalsForPerGame} oppVal={compOppStats?.goalsForPerGame} fmt={gpgFmt}
            tip={t('scoutingTab.compare.tipGfGp')} />
          <CompareRow label={t('scoutingTab.compare.gaGp')} carVal={compCarStats?.goalsAgainstPerGame} oppVal={compOppStats?.goalsAgainstPerGame} fmt={gpgFmt}
            higherBetter={false} tip={t('scoutingTab.compare.tipGaGp')} />
          <CompareRow label={t('scoutingTab.compare.ppPct')} carVal={compCarStats?.powerPlayPct} oppVal={compOppStats?.powerPlayPct} fmt={pctFmt}
            tip={t('scoutingTab.compare.tipPpPct')} />
          <CompareRow label={t('scoutingTab.compare.pkPct')} carVal={compCarStats?.penaltyKillPct} oppVal={compOppStats?.penaltyKillPct} fmt={pctFmt}
            tip={t('scoutingTab.compare.tipPkPct')} />
          <CompareRow label={t('scoutingTab.compare.sfGp')} carVal={compCarStats?.shotsForPerGame} oppVal={compOppStats?.shotsForPerGame}
            fmt={v => v?.toFixed(1) ?? '—'} tip={t('scoutingTab.compare.tipSfGp')} />
          {isPlayoff && compCarStats?.faceoffWinPct != null && (
            <CompareRow label={t('scoutingTab.compare.foWinPct')} carVal={compCarStats?.faceoffWinPct} oppVal={compOppStats?.faceoffWinPct}
              fmt={pctFmt} tip={t('scoutingTab.compare.tipFoWinPct')} />
          )}
        </div>
      )}

      {/* Goalie matchup */}
      <GoalieMatchupCard
        carPlayers={carTopPlayers}
        oppPlayers={oppTopPlayers}
        oppAbbr={oppAbbr}
        oppColor={oppColor}
      />

      {/* Team total projection */}
      <TeamTotalCard
        carStats={compCarStats}
        oppStats={compOppStats}
        oppAbbr={oppAbbr}
        isPlayoff={isPlayoff}
      />

      {/* Recent form */}
      <div className={SCOUTING_SECTION_CLASSES}>
        <div className={SCOUTING_SECTION_LABEL_CLASSES}>{isPlayoff ? t('scoutingTab.recentForm.sectionLabelPlayoff', { count: 10 }) : t('scoutingTab.recentForm.sectionLabel', { count: 10 })}</div>
        <div className="scouting-form-row grid [grid-template-columns:1fr_1fr] gap-3">
          <div className="scouting-form-col flex flex-col gap-[5px]">
            <div className="scouting-form-team text-[10px] font-bold" style={{color: carColor}}>{TEAM_CONFIG.abbr}</div>
            <FormDots games={carRecentGames} />
            {carRecentGames && (
              <div className="scouting-form-summary text-[10px] text-[color:var(--text-dim)]">
                {carRecentGames.filter(g=>g.won).length}–
                {carRecentGames.filter(g=>!g.won&&g.result!=='OTL').length}–
                {carRecentGames.filter(g=>g.result==='OTL').length}
              </div>
            )}
          </div>
          <div className="scouting-form-col flex flex-col gap-[5px]">
            <div className="scouting-form-team text-[10px] font-bold" style={{color: oppColor}}>{oppAbbr}</div>
            <FormDots games={oppRecentGames} />
            {oppRecentGames && (
              <div className="scouting-form-summary text-[10px] text-[color:var(--text-dim)]">
                {oppRecentGames.filter(g=>g.won).length}–
                {oppRecentGames.filter(g=>!g.won&&g.result!=='OTL').length}–
                {oppRecentGames.filter(g=>g.result==='OTL').length}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top players */}
      <div className={SCOUTING_SECTION_CLASSES}>
        <div className={SCOUTING_SECTION_LABEL_CLASSES}>
          {isPlayoff ? t('scoutingTab.topSkatersGoalies.sectionLabelPlayoff') : t('scoutingTab.topSkatersGoalies.sectionLabel')}
        </div>
        <div className="scouting-players-row grid [grid-template-columns:1fr_1fr] gap-3">
          <div className="scouting-players-col flex flex-col gap-1">
            <div className="scouting-players-team text-[10px] font-bold mb-[2px]" style={{color: carColor}}>{TEAM_CONFIG.abbr}</div>
            <PlayerTable players={carTopPlayers} loading={carPlayersLoading} color={carColor} goalieAnalytics={goalieAnalytics} />
          </div>
          <div className="scouting-players-col flex flex-col gap-1">
            <div className="scouting-players-team text-[10px] font-bold mb-[2px]" style={{color: oppColor}}>{oppAbbr}</div>
            <PlayerTable players={oppTopPlayers} loading={oppPlayersLoading} color={oppColor} goalieAnalytics={goalieAnalytics} />
          </div>
        </div>
      </div>

      {/* Line combinations */}
      {carLines && (
        <LinesSection lines={carLines} color={carColor} isPlayoff={isPlayoff} abbr={TEAM_CONFIG.abbr} />
      )}

      {/* Export / share -- .scouting-export-row's `border-bottom: none !important`
          in the original CSS unconditionally kills .scouting-section's own
          border-bottom regardless of :last-child, so this instance simply
          omits the border-b utilities entirely rather than needing !important. */}
      <div className="scouting-section scouting-export-row py-[10px]">
        <ShareButtons
          onSave={handleSaveWithCapture}
          onShareX={handleShareX}
          onNativeShare={handleNativeShare}
          canNativeShare={canNativeShare}
          saving={saving}
          sharing={sharing}
        />
      </div>
    </div>

    {/* Off-screen canvas for export — only mounted when user clicks Save */}
    {canvasMounted && (
    <ScoutingShareCanvas
        canvasRef={canvasRef}
        carStats={compCarStats}
        oppStats={compOppStats}
        carPlayers={carTopPlayers}
        oppPlayers={oppTopPlayers}
        carRecentGames={carRecentGames}
        oppRecentGames={oppRecentGames}
        oppAbbr={oppAbbr}
        oppColor={oppColor}
        isPlayoff={isPlayoff}
        carLines={carLines}
        matchupText={matchupData?.text || null}
      />
    )}
    </>
  );
}

const SEASON_LABEL = `${TEAM_CONFIG.season.slice(0, 4)}–${TEAM_CONFIG.season.slice(6)}`;
