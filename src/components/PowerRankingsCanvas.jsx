// components/PowerRankingsCanvas.jsx
// The power rankings share card, 1080×1350, drawn in ShareCardFrame like
// every share card (same look as the pipeline's Monday Instagram/Facebook
// rankings slides). Moved out of LeagueView.jsx (the NHL's) so the AHL/ECHL
// League view can share it (contract C12): `variant` names what differs per
// league -- logos, team colors, how many teams, which stat bars and which
// stat column the table shows, and the card's footnote. The NHL's is the
// default.
//
// Rows (`ranked`, `myTeam`): { abbr, rank, wins, losses, otLosses, ptsPct,
// l10, l10PtsPct, gdPG, xgfPct?, spPct?, leagueRanks: { pts, l10, gd, xgf?,
// sp? } } -- the shape computePowerRankings() (utils/leagueUtils.js) gives
// the NHL; hockeyTechPowerRankings.js builds the same from the Worker's
// /{league}/power-rankings rows.
import React from 'react';
import { useTranslation } from 'react-i18next';
import ShareCardFrame, { ShareAiBlock, ShareSection } from './ShareCardFrame';
import { SHARE, FONT_DISPLAY, FONT_LABEL } from '../utils/shareCardTheme';
import { NATIVE_ORIGIN } from '../utils/nativeOrigin';
import { teamTextColor } from '../utils/teamConfig';

const pct = v => `${(v * 100).toFixed(1)}%`;
const signed = v => `${v > 0 ? '+' : ''}${v.toFixed(2)}`;

// Each stat a card can show: its label, the value on the bar's row, and
// the league rank that sizes the bar.
const STATS = {
  pts: { label: 'Pts%',  val: r => r.ptsPct,    fmt: (v) => pct(v) },
  l10: { label: 'L10',   val: r => r.l10PtsPct, fmt: (v, r) => r.l10 ?? pct(v) },
  xgf: { label: 'xGF%',  val: r => r.xgfPct,    fmt: (v) => pct(v) },
  gd:  { label: 'GD/GP', val: r => r.gdPG,      fmt: (v) => signed(v) },
  sp:  { label: 'SP%',   val: r => r.spPct,     fmt: (v) => pct(v) },
};

export const NHL_RANKINGS_CARD = {
  logoUrl:   abbr => `${NATIVE_ORIGIN}/nhl-assets/logos/nhl/svg/${abbr}_dark.svg`,
  textColor: teamTextColor,
  teamCount: 32,
  bars:      ['pts', 'l10', 'xgf', 'gd', 'sp'],
  tableStat: 'xgf',
  note:      t => t('shareCard.rankingsNote'),
};

export default function PowerRankingsCanvas({ ranked, myTeam, priorRank, narrative, primaryColor, variant = NHL_RANKINGS_CARD }) {
  const { t } = useTranslation();
  const { logoUrl, textColor, teamCount: n, bars, tableStat } = variant;
  const diff = priorRank != null ? priorRank - myTeam.rank : null;
  const mvmtLabel = diff == null ? null : diff === 0 ? '—' : diff > 0 ? `▲${diff}` : `▼${Math.abs(diff)}`;
  const mvmtColor = diff == null || diff === 0 ? SHARE.muted : diff > 0 ? '#4ade80' : '#f87171';
  // The top and bottom ~third of the league color their bars (10 and 23 of
  // the NHL's 32).
  const band = Math.round((n * 10) / 32);

  // Eight rows fit: the top 8, or the top 3 plus the team and its two
  // neighbours either side when it's outside the top 8.
  const inTop8 = myTeam.rank <= 8;
  const displayRows = ranked.filter(r => (inTop8 ? r.rank <= 8 : r.rank <= 3 || Math.abs(r.rank - myTeam.rank) <= 2));
  const record = `${myTeam.wins}–${myTeam.losses}–${myTeam.otLosses}`;
  const COLS = '64px 110px 1fr 120px 120px 120px';
  const cell = { fontFamily: FONT_LABEL, fontSize: 24, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
  const tableCol = STATS[tableStat];

  return (
    <ShareCardFrame
      id="pr-export-canvas"
      accent={primaryColor}
      kicker={t('leagueView.rankings.snapshotBadge')}
      title={t('shareCard.rankingsTitle')}
      subtitle={t('shareCard.rankingsSubtitle', { rank: myTeam.rank, count: n, record })}
      note={variant.note(t)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <img src={logoUrl(myTeam.abbr)} alt={myTeam.abbr} style={{ width: 110, height: 110, objectFit: 'contain' }}
          onError={e => { e.target.style.display = 'none'; }} />
        <div style={{ minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 120, lineHeight: 0.9, color: 'var(--team-canvas)' }}>#{myTeam.rank}</span>
            {mvmtLabel && <span style={{ fontFamily: FONT_DISPLAY, fontSize: 40, color: mvmtColor }}>{mvmtLabel}</span>}
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {bars.map(key => {
            const { label, val, fmt } = STATS[key];
            const v = val(myTeam);
            const rank = myTeam.leagueRanks?.[key];
            const barPct = rank != null ? ((n - rank) / (n - 1)) * 100 : 50;
            const barColor = rank != null && rank <= band ? '#4ade80' : rank != null && rank > n - band ? '#f87171' : '#5b8fd4';
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 72, fontFamily: FONT_LABEL, fontSize: 22, color: SHARE.muted }}>{label}</span>
                <div style={{ flex: 1, height: 10, background: SHARE.bg3, borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ width: `${barPct}%`, height: '100%', background: barColor }} />
                </div>
                <span style={{ ...cell, width: 96 }}>{v != null ? fmt(v, myTeam) : '—'}</span>
                <span style={{ ...cell, width: 52, color: SHARE.muted, fontSize: 20 }}>{rank != null ? `#${rank}` : ''}</span>
              </div>
            );
          })}
        </div>
      </div>

      <ShareAiBlock text={narrative} lines={3} />

      <ShareSection label={t('leagueView.rankings.snapshotHeading')}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '0 16px 6px' }}>
          {['#', t('league.rankings.colTeam'), t('league.rankings.colRecord'), 'Pts%', tableCol.label, 'GD/GP'].map((h, i) => (
            <span key={i} style={{ fontFamily: FONT_LABEL, fontSize: 20, color: SHARE.muted, textTransform: 'uppercase', textAlign: i <= 2 ? 'left' : 'right' }}>{h}</span>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {displayRows.map((r, i) => {
            const isMe = r.abbr === myTeam.abbr;
            const gap = i > 0 && r.rank - displayRows[i - 1].rank > 1;
            const colVal = tableCol.val(r);
            return (
              <React.Fragment key={r.abbr}>
                {gap && <div style={{ textAlign: 'center', color: SHARE.muted, fontSize: 20, lineHeight: '10px' }}>…</div>}
                <div style={{
                  display: 'grid', gridTemplateColumns: COLS, gap: 8, alignItems: 'center', padding: '2px 16px', borderRadius: 8,
                  background: isMe ? `${primaryColor}26` : SHARE.bg2, borderLeft: `6px solid ${isMe ? primaryColor : 'transparent'}`,
                }}>
                  <span style={{ ...cell, textAlign: 'left', color: isMe ? 'var(--team-canvas)' : SHARE.muted }}>{r.rank}</span>
                  <span style={{ ...cell, textAlign: 'left', color: textColor(r.abbr) ?? SHARE.text }}>{r.abbr}</span>
                  <span style={{ ...cell, textAlign: 'left', color: SHARE.muted }}>{r.wins}–{r.losses}–{r.otLosses}</span>
                  <span style={cell}>{(r.ptsPct * 100).toFixed(1)}%</span>
                  <span style={{ ...cell, color: colVal != null ? SHARE.text : SHARE.muted }}>{colVal != null ? tableCol.fmt(colVal, r) : '—'}</span>
                  <span style={{ ...cell, color: r.gdPG > 0 ? '#4ade80' : r.gdPG < 0 ? '#f87171' : SHARE.muted }}>{signed(r.gdPG)}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </ShareSection>
    </ShareCardFrame>
  );
}
