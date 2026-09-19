// PeriodSummaryShareCanvas.jsx -- the period / final game summary share
// card, shared by PeriodSummary.jsx (NHL) and PWHLPeriodSummary.jsx.
//
// The two leagues' cards were near line-for-line copies; each file now
// computes its own league-specific pieces (stat tiles, strength labels,
// insights, headshot URLs) and hands them here to be drawn in
// ShareCardFrame, 1080x1350, same look as the pipeline's social cards.

import { useTranslation } from 'react-i18next';
import ShareCardFrame, { ShareAiBlock, ShareSection } from './ShareCardFrame';
import { SHARE, FONT_DISPLAY, FONT_LABEL } from '../utils/shareCardTheme';

const GOOD = '#4ade80';
const BAD = '#f87171';
const STRENGTH_COLOR = { pp: '#f0a030', sh: '#60a5fa', en: '#60a5fa' };

function StatGrid({ stats }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      {stats.map((s, i) => (
        <div key={i} style={{ background: SHARE.bg2, borderRadius: 12, padding: '12px 12px', textAlign: 'center' }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 44, lineHeight: 1, color: s.color === 'good' ? GOOD : s.color === 'bad' ? BAD : SHARE.text }}>
            {s.val}
          </div>
          <div style={{ fontFamily: FONT_LABEL, fontSize: 20, color: SHARE.muted, textTransform: 'uppercase', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function GoalColumn({ abbr, color, goals, isGame, strengthOf, max }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 34, color, marginBottom: 6 }}>{abbr}</div>
      {goals.length === 0 && <div style={{ fontSize: 24, color: SHARE.muted }}>—</div>}
      {goals.slice(0, max).map((g, i) => {
        const sl = strengthOf(g);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '3px 0', borderBottom: `1px solid ${SHARE.bg3}` }}>
            <span style={{ flex: 1, fontSize: 25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {g.scorerName?.split(' ').pop() || abbr}
            </span>
            <span style={{ fontFamily: FONT_LABEL, fontSize: 22, color: SHARE.muted }}>
              {isGame ? `P${g.period} ` : ''}{g.time}
            </span>
            {sl !== 'ev' && (
              <span style={{ fontFamily: FONT_LABEL, fontSize: 20, color: STRENGTH_COLOR[sl] || SHARE.muted }}>{sl.toUpperCase()}</span>
            )}
          </div>
        );
      })}
      {goals.length > max && (
        <div style={{ fontFamily: FONT_LABEL, fontSize: 20, color: SHARE.muted, paddingTop: 4 }}>+{goals.length - max}</div>
      )}
    </div>
  );
}

export default function PeriodSummaryShareCanvas({
  canvasRef, summary, carAbbr, oppAbbr, carScore, oppScore, carColor, oppColor,
  stats, hatTricks = [], strengthOf, insights = [], headshotUrl = s => s.headshot, narrative, note,
}) {
  const { t } = useTranslation();
  const isGame = summary.isGameSummary;
  const oppCol = oppColor || SHARE.text;
  const stars = isGame ? (summary.threeStars || []).slice(0, 3) : [];
  const carGoals = summary.goals.filter(g => g.isCar);
  const oppGoals = summary.goals.filter(g => !g.isCar);
  // A busy final (lots of goals, plus the three stars) gets fewer goal rows
  // per side and a shorter AI blurb so everything stays inside the frame.
  const busy = isGame && Math.max(carGoals.length, oppGoals.length) > 4;
  const maxGoals = isGame ? 4 : 5;

  return (
    <ShareCardFrame
      canvasRef={canvasRef}
      accent={carColor}
      kicker={t('periodSummary.header', { period: summary.periodLabel })}
      title={t('shareCard.scoreTitle', { team: carAbbr, teamScore: carScore ?? '–', oppScore: oppScore ?? '–', opp: oppAbbr })}
      note={note}
    >
      <ShareAiBlock text={narrative || t('periodSummary.ai.generatingCanvas')} lines={busy ? 2 : isGame ? 3 : 4} />

      <StatGrid stats={stats} />

      {summary.goals.length > 0 && (
        <div>
          {/* Goals heading, with any hat tricks alongside it rather than on a row of their own */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'nowrap', overflow: 'hidden' }}>
            <span style={{ fontFamily: FONT_LABEL, fontSize: 28, color: SHARE.redBright, textTransform: 'uppercase', flexShrink: 0 }}>
              {isGame ? t('periodSummary.goals.thisGame') : t('periodSummary.goals.thisPeriod')}
            </span>
            {hatTricks.map((ht, i) => (
              <span key={i} style={{ background: 'var(--team-canvas)', color: '#fff', fontFamily: FONT_LABEL, fontSize: 22, padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                🎩 {ht.isNatural ? t('milestonesFeed.type.naturalHatTrick') : t('milestonesFeed.type.hatTrick')}{ht.scorerName ? ` — ${ht.scorerName.split(' ').pop()}` : ''}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 40 }}>
            <GoalColumn abbr={carAbbr} color={carColor} goals={carGoals} isGame={isGame} strengthOf={strengthOf} max={maxGoals} />
            <GoalColumn abbr={oppAbbr} color={oppCol} goals={oppGoals} isGame={isGame} strengthOf={strengthOf} max={maxGoals} />
          </div>
        </div>
      )}

      {!isGame && insights.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {insights.map((ins, i) => (
            <span key={i} style={{ background: SHARE.bg2, borderRadius: 24, padding: '10px 18px', fontSize: 24, color: ins.good == null ? SHARE.text : ins.good ? GOOD : BAD }}>
              {ins.text}
            </span>
          ))}
        </div>
      )}

      {stars.length > 0 && (
        <ShareSection label={t('periodSummary.threeStars')}>
          <div style={{ display: 'flex', gap: 16 }}>
            {stars.map((s, i) => {
              const name = s.name?.default || '—';
              const src = headshotUrl(s);
              return (
                <div key={i} style={{ flex: 1, background: SHARE.bg2, borderRadius: 12, padding: '14px 12px', display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                  {src ? (
                    <img src={src} alt={name} style={{ width: 72, height: 72, borderRadius: 36, objectFit: 'cover', background: SHARE.bg3, flexShrink: 0 }}
                      onError={e => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div style={{ width: 72, height: 72, borderRadius: 36, background: SHARE.bg3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_DISPLAY, fontSize: 30, flexShrink: 0 }}>
                      {name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 18 }}>{'⭐'.repeat(3 - i)}</div>
                    <div style={{ fontSize: 24, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name.split(' ').pop()}</div>
                    <div style={{ fontFamily: FONT_LABEL, fontSize: 20, color: SHARE.muted }}>{s.teamAbbrev?.default || ''}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </ShareSection>
      )}
    </ShareCardFrame>
  );
}
