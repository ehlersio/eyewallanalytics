import { useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetch } from '../hooks/useFetch';
import {
  getTeamStats, getTeamStatsPlayoff, getTeamRecentGames, getTeamTopPlayers,
  getTeamInjuries, buildInjuryIndex, getProjectedLines,
  TEAM_CONFIG,
} from '../utils/nhlApi';
import { hasProjection, projectionCopyKeys } from '../utils/projectedLines';
import { teamTextColor } from '../utils/teamConfig';
import { computeGSAx } from '../utils/advancedStats';
import { getGoalieAnalytics, getTeamLines, getGameMatchup } from '../utils/supabaseClient';
import TeamLogo from './TeamLogo';
import InfoTip from './InfoTip';
import { useShareCard } from '../hooks/useShareCard';
import ShareButtons from './ShareButtons';
import ShareCardFrame, { ShareAiBlock, ShareCompareRow, ShareSection, ShareRow } from './ShareCardFrame';
import { SHARE, FONT_DISPLAY, FONT_LABEL } from '../utils/shareCardTheme';
import { InjuryBadge, InjuryDetailTip, INJURY_OUT_STATUSES } from './InjuryBadge';
import { NATIVE_ORIGIN } from '../utils/nativeOrigin';
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

// InjuryBadge/INJURY_OUT_STATUSES moved to components/InjuryBadge.jsx so
// PlayerPopup and TeamView's injury report render the same badge.

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
function PlayerTable({ players, loading, color, goalieAnalytics, injuries }) {
  const { t } = useTranslation();
  if (loading) return <div className="scouting-loading text-[11px] text-[color:var(--text-dim)] py-2">{t('common.loading')}</div>;
  if (!players?.skaters?.length) return <div className={SCOUTING_EMPTY_CLASSES}>{t('scoutingTab.playerTable.noData')}</div>;
  return (
    <div className="scouting-player-table flex flex-col">
      <div className="scouting-player-header grid [grid-template-columns:1fr_18px_18px_24px] gap-[2px] py-[2px] text-[8px] text-[color:var(--text-dim)] uppercase border-b-[0.5px] border-b-[color:var(--border)] mb-px">
        <span>{t('gameStatsPopup.table.player')}</span><span>G</span><span>A</span><span>PTS</span>
      </div>
      {players.skaters.map((p, i) => {
        const injury = injuries?.forPlayer(p.playerId, p.name);
        const isOut = injury && INJURY_OUT_STATUSES.has(injury.status);
        return (
          <div key={i} className="scouting-player-row grid [grid-template-columns:1fr_18px_18px_24px] gap-[2px] py-1 items-center border-b-[0.5px] border-b-[color:var(--border)] text-[11px] text-[color:var(--text-muted)] last:border-b-0">
            <span className="scouting-player-name text-[color:var(--text)] font-medium text-[10px] whitespace-nowrap overflow-hidden text-ellipsis">
              {/* Fade only the name + position -- not the badge and tooltip after them */}
              <span className={isOut ? 'opacity-50' : undefined}>{p.name}<span className="scouting-player-pos text-[8px] text-[color:var(--text-dim)] ml-[3px]">{p.pos}</span></span>
              <InjuryBadge status={injury?.status} />
              <InjuryDetailTip injury={injury} name={p.name} />
            </span>
            <span>{p.goals}</span>
            <span>{p.assists}</span>
            <span className="scouting-pts font-bold" style={{color}}>{p.points}</span>
          </div>
        );
      })}
      {players.goalies?.length > 0 && (
        <>
          <div className="scouting-goalie-divider text-[8px] font-bold uppercase tracking-[0.07em] text-[color:var(--text-dim)] pt-[5px] pb-[3px] border-t-[0.5px] border-t-[color:var(--border)] mt-[3px]">{t('scoutingTab.playerTable.goalies')}</div>
          {players.goalies.map((g, i) => {
            const goalieInjury = injuries?.forPlayer(g.playerId, g.name);
            const goalieIsOut  = goalieInjury && INJURY_OUT_STATUSES.has(goalieInjury.status);
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
                <span className={`${SCOUTING_PLAYER_NAME_CLASSES} scouting-goalie-name block mb-1`}>
                  <span className={goalieIsOut ? 'opacity-50' : undefined}>{g.name}</span><InjuryBadge status={goalieInjury?.status} />
                  <InjuryDetailTip injury={goalieInjury} name={g.name} />
                </span>
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
// 1080×1350 scouting card, drawn in ShareCardFrame like every share card.
// Keeps the top forward line and three leaders a side -- the D pairs and
// the rest of the lines no longer fit at a readable size.
export function ScoutingShareCanvas({ canvasRef, carStats, oppStats, carPlayers, oppPlayers,
  oppAbbr, oppColor, isPlayoff, carLines, matchupText }) {
  const { t } = useTranslation();
  if (!carStats || !oppStats) return null;

  const car = TEAM_CONFIG.abbr;
  const carColor = TEAM_CONFIG.displayColor;
  const oppCol = oppColor || SHARE.text;
  const gpgFmt = v => v?.toFixed(2) ?? '—';
  const pctFmt = v => v != null ? `${(v * 100).toFixed(1)}%` : '—';
  const side = carBetter => (carBetter ? 'left' : 'right');
  const logo = abbr => (
    <img src={`${NATIVE_ORIGIN}/nhl-assets/logos/nhl/svg/${abbr}_dark.svg`} alt={abbr}
      style={{ width: 40, height: 40, objectFit: 'contain' }} onError={e => { e.target.style.display = 'none'; }} />
  );
  const POS_LABEL = { L: 'LW', LW: 'LW', C: 'C', R: 'RW', RW: 'RW', D: 'D' };

  return (
    <ShareCardFrame
      canvasRef={canvasRef}
      accent={carColor}
      kicker={isPlayoff ? t('scoutingTab.shareCanvas.playoffBadge') : t('scoutingTab.shareCanvas.badge')}
      title={t('shareCard.matchupTitle', { team: car, opp: oppAbbr })}
      subtitle={isPlayoff ? t('shareCard.scoutingPlayoffSubtitle') : t('shareCard.scoutingSubtitle')}
      note={t('shareCard.statsNote')}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: FONT_DISPLAY, fontSize: 36, color: carColor }}>{logo(car)}{car}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: FONT_DISPLAY, fontSize: 36, color: oppCol }}>{oppAbbr}{logo(oppAbbr)}</span>
        </div>
        {[
          { label: t('scoutingTab.shareCanvas.stats.goalsForGp'),     l: gpgFmt(carStats.goalsForPerGame),     r: gpgFmt(oppStats.goalsForPerGame),     better: side((carStats.goalsForPerGame ?? 0) > (oppStats.goalsForPerGame ?? 0)) },
          { label: t('scoutingTab.shareCanvas.stats.goalsAgainstGp'), l: gpgFmt(carStats.goalsAgainstPerGame), r: gpgFmt(oppStats.goalsAgainstPerGame), better: side((carStats.goalsAgainstPerGame ?? 99) < (oppStats.goalsAgainstPerGame ?? 99)) },
          { label: t('scoutingTab.shareCanvas.stats.powerPlayPct'),   l: pctFmt(carStats.powerPlayPct),        r: pctFmt(oppStats.powerPlayPct),        better: side((carStats.powerPlayPct ?? 0) > (oppStats.powerPlayPct ?? 0)) },
          { label: t('scoutingTab.shareCanvas.stats.penaltyKillPct'), l: pctFmt(carStats.penaltyKillPct),      r: pctFmt(oppStats.penaltyKillPct),      better: side((carStats.penaltyKillPct ?? 0) > (oppStats.penaltyKillPct ?? 0)) },
          { label: t('scoutingTab.shareCanvas.stats.shotsForGp'),     l: (carStats.shotsForPerGame ?? 0).toFixed(1), r: (oppStats.shotsForPerGame ?? 0).toFixed(1), better: side((carStats.shotsForPerGame ?? 0) > (oppStats.shotsForPerGame ?? 0)) },
        ].map(row => (
          <ShareCompareRow key={row.label} label={row.label} left={row.l} right={row.r}
            better={row.better} leftColor={carColor} rightColor={oppCol} compact />
        ))}
      </div>

      <ShareAiBlock text={matchupText} lines={3} />

      <div style={{ display: 'flex', gap: 16 }}>
        {[
          { label: car, color: carColor, players: carPlayers },
          { label: oppAbbr, color: oppCol, players: oppPlayers },
        ].map(({ label, color, players }) => (
          <div key={label} style={{ flex: 1, minWidth: 0, background: SHARE.bg2, borderRadius: 12, padding: '14px 20px' }}>
            <div style={{ fontFamily: FONT_LABEL, fontSize: 24, color, textTransform: 'uppercase', marginBottom: 6 }}>
              {isPlayoff ? t('scoutingTab.shareCanvas.playoffLeaders', { team: label }) : t('scoutingTab.shareCanvas.leaders', { team: label })}
            </div>
            {players?.skaters?.slice(0, 3).map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 24, padding: '3px 0' }}>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                <span style={{ fontFamily: FONT_LABEL, color }}>{p.points} PTS</span>
              </div>
            ))}
            {players?.goalies?.[0] && (
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${SHARE.bg3}`, fontSize: 21, color: SHARE.muted }}>
                <div style={{ color: SHARE.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{players.goalies[0].name}</div>
                W {players.goalies[0].wins} · GAA {players.goalies[0].gaa?.toFixed(2) ?? '—'} · SV% {players.goalies[0].savePct?.toFixed(3) ?? '—'}
              </div>
            )}
          </div>
        ))}
      </div>

      {carLines?.lines?.length > 0 && (
        <ShareSection label={t('scoutingTab.shareCanvas.carLinesHeader', { abbr: car, scope: isPlayoff ? t('scoutingTab.shareCanvas.playoffsScope') : t('scoutingTab.shareCanvas.thisSeason') })}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {carLines.lines.slice(0, 1).map((line, i) => {
              const xgf = line.xgfPct;
              return (
                <ShareRow key={i} accent={carColor} style={{ padding: '10px 20px 10px 28px' }}>
                  <span style={{ fontFamily: FONT_LABEL, fontSize: 22, color: carColor, flexShrink: 0 }}>{t('scoutingTab.lines.line', { n: i + 1 })}</span>
                  <span style={{ flex: 1, fontSize: 22, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {line.players.map(p => `${POS_LABEL[p.pos] || p.pos} ${p.name.split(' ').pop()}`).join(' · ')}
                  </span>
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: 30, color: xgf == null ? SHARE.muted : xgf >= 50 ? '#4ade80' : '#f87171' }}>
                    {xgf != null ? `${xgf.toFixed(1)}%` : '—'}
                  </span>
                  <span style={{ fontFamily: FONT_LABEL, fontSize: 18, color: SHARE.muted }}>xGF</span>
                </ShareRow>
              );
            })}
          </div>
        </ShareSection>
      )}
    </ShareCardFrame>
  );
}


// ── Line combinations section ──────────────────────────────────────────────

// Position display: NHL API codes → readable labels
const POS_LABEL = { L: 'LW', LW: 'LW', C: 'C', R: 'RW', RW: 'RW', D: 'D' };
// An out/IR player's position + name are faded and struck through -- only
// those two. It used to be the whole row, and opacity and line-through
// both reach every descendant, so the status badge and the injury-details
// tooltip opened from it came out faded and struck through too.
const OUT_CLASSES = ' opacity-50 line-through';

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

function LineUnit({ unit, label, color, _isDefence, injuries }) {
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
        {unit.players.map((p, i) => {
          // Line-combination rows only carry a name, no playerId -- fall
          // back to normalized-name matching (buildInjuryIndex's byName map).
          const injury = injuries?.forPlayer(null, p.name);
          const isOut = injury && INJURY_OUT_STATUSES.has(injury.status);
          return (
            <span key={i} className="sc-line-player text-[12px] text-[color:var(--text)] flex items-baseline gap-1">
              <span className={`sc-line-pos text-[9px] font-bold text-[color:var(--text-dim)] uppercase tracking-[0.04em] min-w-[18px]${isOut ? OUT_CLASSES : ''}`}>{POS_LABEL[p.pos] || p.pos}</span>
              <span className={isOut ? OUT_CLASSES : undefined}>{p.name}</span>
              <InjuryBadge status={injury?.status} />
              <InjuryDetailTip injury={injury} name={p.name} />
            </span>
          );
        })}
      </div>
    </div>
  );
}

function LinesSection({ lines, color, isPlayoff, abbr, injuries }) {
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
            <LineUnit key={i} unit={u} label={lineLabels[i] || t('scoutingTab.lines.line', { n: u.rank })} color={color} injuries={injuries} />
          ))}
        </div>
      )}
      {dPairs.length > 0 && (
        <div className="sc-lines-group sc-lines-group-d flex flex-col gap-[6px] mb-2.5 border-t border-[color:var(--border)] pt-2.5 mt-[2px]">
          <div className="sc-lines-subheader text-[9px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-dim)] mb-1">{t('scoutingTab.lines.defencePairs')}</div>
          {dPairs.map((u, i) => (
            <LineUnit key={i} unit={u} label={pairLabels[i] || t('scoutingTab.lines.pair', { n: u.rank })} color={color} isDefence injuries={injuries} />
          ))}
        </div>
      )}
    </div>
  );
}


// ── Projected lines section ────────────────────────────────────────────────
// Next-game projection from the Worker's /projected-lines (eyewall-pipeline's
// projected_lines.py). Sits above LinesSection, which stays as the season's
// most-used units with xGF%. Hidden entirely when there's no projection.

function ProjectedUnit({ unit, label, color, injuries }) {
  const { t } = useTranslation();
  return (
    <div className="sc-line-unit sc-projected-unit bg-[var(--bg2)] border-[0.5px] border-[color:var(--border)] rounded-[8px] py-[9px] px-[11px]">
      <div className="sc-line-header flex items-center justify-between mb-1.5">
        <span className="sc-line-label text-[11px] font-bold tracking-[0.03em] min-w-[44px]" style={{ color }}>{label}</span>
      </div>
      <div className="sc-line-players flex gap-y-1.5 gap-x-3.5 flex-wrap">
        {unit.players.map(p => {
          const injury = injuries?.forPlayer(p.id, p.name);
          const isOut = injury && INJURY_OUT_STATUSES.has(injury.status);
          return (
            <span key={p.id} className="sc-line-player text-[12px] text-[color:var(--text)] flex items-baseline gap-1">
              <span className={`sc-line-pos text-[9px] font-bold text-[color:var(--text-dim)] uppercase tracking-[0.04em] min-w-[18px]${isOut ? OUT_CLASSES : ''}`}>{POS_LABEL[p.pos] || p.pos}</span>
              <span className={isOut ? OUT_CLASSES : undefined}>{p.name}</span>
              {p.filled && (
                <span className="sc-projected-filled inline-flex items-center gap-[2px] text-[9px] font-semibold uppercase tracking-[0.04em] text-[color:var(--amber)]">
                  {t('scoutingTab.projectedLines.filled')}
                  <InfoTip text={t('scoutingTab.projectedLines.filledTip')} position="above" />
                </span>
              )}
              <InjuryBadge status={injury?.status} />
              <InjuryDetailTip injury={injury} name={p.name} />
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ProjectedLinesSection({ data, color, abbr, injuries }) {
  const { t } = useTranslation();
  if (!hasProjection(data)) return null;
  const { basisKey, accuracyKey } = projectionCopyKeys(data.basis);
  return (
    <div className={`${SCOUTING_SECTION_CLASSES} sc-projected-lines`}>
      <div className={SCOUTING_SECTION_LABEL_CLASSES}>
        {t('scoutingTab.projectedLines.sectionLabel', { abbr })}
        <InfoTip text={t('scoutingTab.projectedLines.sectionTip')} position="above" />
      </div>
      <div className="sc-lines-note sc-projected-basis text-[11px] text-[color:var(--text-dim)] italic mb-1">
        {t(`scoutingTab.projectedLines.${basisKey}`, { count: data.basisGames ?? 0 })}
      </div>
      <div className="sc-lines-note sc-projected-accuracy text-[11px] text-[color:var(--text-dim)] mb-2">
        {t(`scoutingTab.projectedLines.${accuracyKey}`)}
      </div>
      {data.lines.length > 0 && (
        <div className="sc-lines-group flex flex-col gap-[6px] mb-2.5">
          {data.lines.map(u => (
            <ProjectedUnit key={`F${u.rank}`} unit={u} label={t('scoutingTab.lines.line', { n: u.rank })} color={color} injuries={injuries} />
          ))}
        </div>
      )}
      {data.pairs.length > 0 && (
        <div className="sc-lines-group sc-lines-group-d flex flex-col gap-[6px] mb-2.5 border-t border-[color:var(--border)] pt-2.5 mt-[2px]">
          <div className="sc-lines-subheader text-[9px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-dim)] mb-1">{t('scoutingTab.lines.defencePairs')}</div>
          {data.pairs.map(u => (
            <ProjectedUnit key={`D${u.rank}`} unit={u} label={t('scoutingTab.lines.pair', { n: u.rank })} color={color} injuries={injuries} />
          ))}
        </div>
      )}
    </div>
  );
}


export default function ScoutingTab({ oppAbbr, oppStanding, carStanding, isPlayoff, gameId }) {
  const { t, i18n } = useTranslation();
  const gameType = isPlayoff ? 3 : 2;
  const carColor = 'var(--team-primary)';
  const oppColor = teamTextColor(oppAbbr) || 'var(--text-muted)';

  const canvasRef = useRef(null);
  const [canvasMounted, setCanvasMounted] = useState(false);

  const xCaption = [
    t('scoutingTab.xCaption', { abbr: TEAM_CONFIG.abbr, oppAbbr }),
    '#EyeWallAnalytics',
  ].join('\n');

  const { saving, sharing, handleNativeShare } =
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

  const handleShareWithCapture = async () => {
    await handleNativeShare();
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
  const { data: carProjected } = useFetch(() => getProjectedLines(TEAM_CONFIG.abbr), [TEAM_CONFIG.abbr]);
  const { data: matchupData } = useFetch(() => getGameMatchup(gameId, i18n.language), [gameId, i18n.language]);
  const { data: carInjuriesRaw } = useFetch(() => getTeamInjuries(TEAM_CONFIG.abbr), [TEAM_CONFIG.abbr]);
  const { data: oppInjuriesRaw } = useFetch(() => getTeamInjuries(oppAbbr), [oppAbbr]);
  const carInjuries = useMemo(() => buildInjuryIndex(carInjuriesRaw), [carInjuriesRaw]);
  const oppInjuries = useMemo(() => buildInjuryIndex(oppInjuriesRaw), [oppInjuriesRaw]);

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
          {/* getTeamStats() falls back to real prior-season numbers (tagged
              isPriorSeason) rather than null once TEAM_CONFIG.season is
              resolved ahead of live standings data -- e.g. the first few
              weeks of a new season, once eyewall-poller's schedule
              look-ahead flips it before real games/stats exist yet. Same
              "carry forward real data, label it" pattern as the lines
              section's own liveNote/isStatic handling just below. */}
          {(compCarStats?.isPriorSeason || compOppStats?.isPriorSeason) && (
            <div className="text-[11px] text-[color:var(--text-dim)] italic mb-1.5">
              {t('scoutingTab.compare.priorSeasonNote', {
                season: seasonIdToLabel(compCarStats?.statsSeasonId ?? compOppStats?.statsSeasonId),
              })}
            </div>
          )}
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
            <PlayerTable players={carTopPlayers} loading={carPlayersLoading} color={carColor} goalieAnalytics={goalieAnalytics} injuries={carInjuries} />
          </div>
          <div className="scouting-players-col flex flex-col gap-1">
            <div className="scouting-players-team text-[10px] font-bold mb-[2px]" style={{color: oppColor}}>{oppAbbr}</div>
            <PlayerTable players={oppTopPlayers} loading={oppPlayersLoading} color={oppColor} goalieAnalytics={goalieAnalytics} injuries={oppInjuries} />
          </div>
        </div>
      </div>

      {/* Projected lines for the next game (hidden when there's no projection) */}
      <ProjectedLinesSection data={carProjected} color={carColor} abbr={TEAM_CONFIG.abbr} injuries={carInjuries} />

      {/* Line combinations -- the season's most-used units */}
      {carLines && (
        <LinesSection lines={carLines} color={carColor} isPlayoff={isPlayoff} abbr={TEAM_CONFIG.abbr} injuries={carInjuries} />
      )}

      {/* Export / share -- .scouting-export-row's `border-bottom: none !important`
          in the original CSS unconditionally kills .scouting-section's own
          border-bottom regardless of :last-child, so this instance simply
          omits the border-b utilities entirely rather than needing !important. */}
      <div className="scouting-section scouting-export-row py-[10px]">
        <ShareButtons
          onNativeShare={handleShareWithCapture}
          saving={saving}
          sharing={sharing}
        />
      </div>
    </div>

    {/* Off-screen canvas for export — only mounted when user clicks Share */}
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

// Same YYYY–YYYY formatting as SEASON_LABEL, parameterized for an
// arbitrary season id (e.g. getTeamStats()'s statsSeasonId, which can be
// a real PRIOR season once TEAM_CONFIG.season is resolved ahead of live
// standings data -- see the priorSeasonNote usage above).
function seasonIdToLabel(seasonId) {
  const s = String(seasonId ?? '');
  return s.length === 8 ? `${s.slice(0, 4)}–${s.slice(6)}` : s;
}
