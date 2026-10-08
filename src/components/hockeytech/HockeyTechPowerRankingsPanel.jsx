// components/hockeytech/HockeyTechPowerRankingsPanel.jsx
// AHL/ECHL League › Power rankings (contract C12): the pipeline's nightly
// ranking of every team (/{league}/power-rankings), not computed here.
// The table (rank, movement since the run before for every team, team,
// Pts%, L10, GD/GP), the followed team's EyeWall AI narrative and rank
// sparkline (RankNarrativeCard, shared with the NHL and PWHL), "How is this
// calculated?" with the pipeline's fixed weights, and the share card
// (PowerRankingsCanvas with this league's variant).
//
// HockeyTechLeagueView fetches the route (it decides whether the tab is
// offered at all) and passes the answer in.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import TeamLogo from '../TeamLogo';
import ShareButtons from '../ShareButtons';
import RankNarrativeCard, { formatDay } from '../RankNarrativeCard';
import PowerRankingsCanvas from '../PowerRankingsCanvas';
import { useShareCard } from '../../hooks/useShareCard';
import { leagueNameVars } from '../../utils/hockeyTechI18n';
import {
  hockeyTechRankedRows, rankHistory, rankMovement, rankingWeightLabels, HOCKEYTECH_RANKING_WEIGHTS,
} from '../../utils/hockeyTechPowerRankings';

const CARD_CLASSES = 'lv-div-card bg-[var(--bg1)] border-[0.5px] border-[var(--border)] rounded-[var(--radius)] overflow-hidden';
const NOTE_CLASSES = 'hockeytech-rankings-note py-8 text-center text-[13px] text-[color:var(--text-dim)]';
const AS_OF_CLASSES = 'text-[11px] text-[color:var(--text-dim)] px-1';
const GRID = '[grid-template-columns:32px_32px_1fr_56px_56px_56px]';
const HEADER_ROW_CLASSES = `pr-table-header-row grid ${GRID} items-center gap-1 py-[6px] px-2 text-[10px] font-semibold uppercase tracking-[0.05em] text-[color:var(--text-dim)] border-b border-[var(--border)] pb-2 mb-[2px]`;
const ROW_CLASSES = `pr-row grid ${GRID} items-center gap-1 py-[6px] px-2 rounded-[6px] border-l-[3px] border-transparent`;
const RANK_CLASSES = 'pr-rank-num text-[13px] font-bold text-center';
const TEAM_CLASSES = 'flex items-center gap-[6px] min-w-0';
const ABBR_CLASSES = 'pr-abbr text-[13px] font-bold';
const STAT_CLASSES = 'pr-col-stat text-right text-[12px] [font-variant-numeric:tabular-nums]';
const MVMT_CLASSES = 'pr-mvmt text-center text-[10px] font-bold [font-variant-numeric:tabular-nums]';
const HOW_TOGGLE_CLASSES = 'pr-how-toggle flex justify-between items-center w-full bg-transparent border-0 py-3 px-3 cursor-pointer text-[color:var(--text)] text-[13px] font-semibold';
const HOW_BODY_CLASSES = 'pr-how-body px-3 pb-3 flex flex-col gap-[10px]';
const HOW_TEXT_CLASSES = 'pr-how-text text-[12px] text-[color:var(--text-muted)] leading-[1.55] m-0';
const HOW_ITEM_CLASSES = 'pr-how-item p-[10px_12px] bg-[rgba(255,255,255,0.03)] rounded-[6px] border border-[var(--border)] flex flex-col gap-1';
const HOW_WEIGHT_CLASSES = 'pr-how-weight text-[11px] font-bold text-[color:var(--green)]';

function Movement({ rank, priorRank }) {
  const diff = rankMovement(rank, priorRank);
  if (diff == null) return <span className={MVMT_CLASSES} />;
  if (diff === 0) return <span className={`${MVMT_CLASSES} text-[color:var(--text-dim)]`}>—</span>;
  return diff > 0
    ? <span className={`${MVMT_CLASSES} text-[color:var(--green)]`}>▲{diff}</span>
    : <span className={`${MVMT_CLASSES} text-[color:var(--red-bright)]`}>▼{Math.abs(diff)}</span>;
}

const pct = v => (v != null ? `${(v * 100).toFixed(1)}%` : '—');

export default function HockeyTechPowerRankingsPanel({ league, data }) {
  const { t } = useTranslation();
  const [showHow, setShowHow] = useState(false);
  const [canvasMounted, setCanvasMounted] = useState(false);
  const display = abbr => league.config.getTeamForDisplay(abbr);
  const ranked = hockeyTechRankedRows(data?.latest, id => league.config.getTeamById(id)?.abbr);
  const history = rankHistory(data?.history);
  const myAbbr = league.team?.abbr;
  const me = ranked.find(r => r.teamId === league.teamId) || null;
  const myColor = display(myAbbr)?.displayColor || 'var(--team-primary)';
  const asOf = history.at(-1)?.date || data?.narrative?.run_date || null;
  const weights = rankingWeightLabels();
  const vars = leagueNameVars(t, league);

  const { saving, sharing, handleNativeShare } = useShareCard({
    canvasRef: { current: null },
    filename: `EyeWall-${league.label}-PowerRankings-${myAbbr}.png`,
    xCaption: [
      me ? t('hockeyTechLeagueView.rankings.shareCaption', { team: myAbbr, rank: me.rank, ...vars }) : '',
      data?.narrative?.text || '',
      `#${league.label} #EyeWallAnalytics`,
    ].filter(Boolean).join('\n'),
    mountCanvas: async () => {
      if (!canvasMounted) {
        setCanvasMounted(true);
        await new Promise(r => setTimeout(r, 120));
      }
    },
    getNode: () => document.getElementById('pr-export-canvas'),
  });

  const variant = {
    logoUrl:   abbr => league.config.logoUrl(display(abbr)?.teamId),
    textColor: abbr => display(abbr)?.displayColor ?? null,
    teamCount: ranked.length,
    bars:      ['pts', 'l10', 'gd', 'sp'],
    tableStat: 'l10',
    note:      tt => tt('shareCard.rankingsNoteHockeyTech', { league: league.label }),
  };

  const components = [
    { key: 'pts_pct',       label: t('pwhlLeagueView.rankings.componentPointsLabel'), desc: t('hockeyTechLeagueView.rankings.componentPointsDesc') },
    { key: 'l10_pts_pct',   label: t('pwhlLeagueView.rankings.componentL10Label'),    desc: t('pwhlLeagueView.rankings.componentL10Desc') },
    { key: 'gd_pg',         label: 'GD/GP',                                          desc: t('pwhlLeagueView.rankings.componentGDDesc') },
    { key: 'special_teams', label: t('league.rankings.componentSPLabel'),             desc: t('pwhlLeagueView.rankings.componentSPDesc') },
  ];

  return (
    <div className="hockeytech-power-rankings" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <RankNarrativeCard
        teamAbbr={myAbbr}
        narrative={data?.narrative?.text ? { text: data.narrative.text, date: data.narrative.run_date } : null}
        history={history}
        primaryColor={myColor}
      />

      <div className={CARD_CLASSES}>
        <div className={HEADER_ROW_CLASSES}>
          <span className="text-center">#</span>
          <span />
          <span>{t('league.rankings.colTeam')}</span>
          <span className="text-right">Pts%</span>
          <span className="text-right">L10</span>
          <span className="text-right">GD/GP</span>
        </div>
        {ranked.map(r => {
          const isMe = r.teamId === league.teamId;
          return (
            <div key={r.teamId} className={`${ROW_CLASSES}${isMe ? ' pr-row--you font-semibold' : ''}`}
              style={isMe ? { borderLeft: `3px solid ${myColor}`, background: `color-mix(in srgb, ${myColor} 8%, var(--bg1))` } : undefined}>
              <span className={RANK_CLASSES}>{r.rank}</span>
              <Movement rank={r.rank} priorRank={r.priorRank} />
              <span className={TEAM_CLASSES}>
                <TeamLogo abbr={r.abbr} sport={league.key} size={16} />
                <span className={ABBR_CLASSES} style={{ color: display(r.abbr)?.displayColor ?? 'var(--text)' }}>{r.abbr}</span>
              </span>
              <span className={STAT_CLASSES}>{pct(r.ptsPct)}</span>
              <span className={STAT_CLASSES}>{r.l10 ?? '—'}</span>
              <span className={`${STAT_CLASSES} ${r.gdPG > 0 ? 'text-[color:var(--green)]' : r.gdPG < 0 ? 'text-[color:var(--red-bright)]' : ''}`}>
                {r.gdPG > 0 ? '+' : ''}{r.gdPG.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
      {asOf && <span className={AS_OF_CLASSES}>{t('hockeyTechLeagueView.rankings.asOf', { date: formatDay(asOf) })}</span>}

      <ShareButtons onNativeShare={handleNativeShare} saving={saving} sharing={sharing || !me} />

      <div className={CARD_CLASSES}>
        <button className={HOW_TOGGLE_CLASSES} onClick={() => setShowHow(v => !v)} aria-expanded={showHow}>
          <span>{t('league.rankings.howCalculatedToggle')}</span>
          <span className="text-[10px] text-[color:var(--text-dim)]">{showHow ? '▲' : '▼'}</span>
        </button>
        {showHow && (
          <div className={HOW_BODY_CLASSES}>
            <p className={HOW_TEXT_CLASSES}>{t('hockeyTechLeagueView.rankings.howCalculatedIntro', vars)}</p>
            {components.filter(c => HOCKEYTECH_RANKING_WEIGHTS.some(w => w.key === c.key)).map(c => (
              <div key={c.key} className={HOW_ITEM_CLASSES}>
                <div className="flex justify-between items-baseline">
                  <span className="text-[13px] font-semibold text-[color:var(--text)]">{c.label}</span>
                  <span className={HOW_WEIGHT_CLASSES}>{weights[c.key]}</span>
                </div>
                <p className={HOW_TEXT_CLASSES}>{c.desc}</p>
              </div>
            ))}
            <p className={HOW_TEXT_CLASSES}>{t('hockeyTechLeagueView.rankings.howCalculatedFootnote', vars)}</p>
          </div>
        )}
      </div>

      {canvasMounted && me && (
        <PowerRankingsCanvas
          ranked={ranked}
          myTeam={me}
          priorRank={me.priorRank}
          narrative={data?.narrative?.text ?? null}
          primaryColor={myColor}
          variant={variant}
        />
      )}
    </div>
  );
}

// The tab's body when the Worker couldn't read the rankings.
export function HockeyTechRankingsUnavailable() {
  const { t } = useTranslation();
  return <div className={NOTE_CLASSES}>{t('hockeyTechLeagueView.rankings.unavailable')}</div>;
}
