// components/RankNarrativeCard.jsx
// The power rankings' EyeWall AI card: the followed team's rankings
// narrative and its rank trend sparkline. Moved out of LeagueView.jsx (the
// NHL's) so the AHL/ECHL Power rankings tab and the PWHL's panel show the
// same card (contract C12).
import { useTranslation } from 'react-i18next';
import Sparkline from './Sparkline';
import { formatDate } from '../utils/formatters';

const CARD_CLASSES = 'lv-div-card bg-[var(--bg1)] border-[0.5px] border-[var(--border)] rounded-[var(--radius)] overflow-hidden [grid-column:1/-1]';

const PR_NARRATIVE_CARD_CLASSES = 'pr-narrative-card p-[14px_16px]'
const PR_NARRATIVE_LABEL_CLASSES = 'pr-narrative-label text-[11px] font-extrabold tracking-[0.1em] uppercase text-[color:var(--team-primary,var(--green))] mb-2'
const PR_NARRATIVE_TEXT_CLASSES = 'text-[13px] leading-[1.6] text-[color:var(--text-muted)] m-[0_0_8px]'
const PR_NARRATIVE_DATE_CLASSES = 'text-[11px] text-[color:var(--text-dim)]'
const PR_NARRATIVE_CARD_TOP_CLASSES = 'flex gap-4 items-start max-[420px]:flex-col'
const PR_NARRATIVE_CARD_TOP_FIRST_CHILD_CLASSES = 'flex-1 min-w-0'

const PR_SPARKLINE_CLASSES = 'pr-sparkline shrink-0 w-[90px] flex flex-col gap-[3px] max-[420px]:w-full'
const PR_SPARKLINE_HEADER_CLASSES = 'flex justify-between items-baseline'
const PR_SPARKLINE_LABEL_CLASSES = 'text-[8px] font-semibold uppercase tracking-[0.06em] text-[color:var(--text-dim)]'
const PR_SPARKLINE_TREND_CLASSES = 'text-[10px] font-bold [font-variant-numeric:tabular-nums]'
const PR_SPARKLINE_PERIOD_CLASSES = 'text-[8px] font-normal text-[color:var(--text-dim)]'
const PR_SPARKLINE_SVG_CLASSES = 'w-full h-auto [aspect-ratio:200/56] overflow-visible'
const PR_SPARKLINE_DATES_CLASSES = 'flex justify-between text-[8px] text-[color:var(--text-dim)]'
const PR_SPARKLINE_EMPTY_CLASSES = 'pr-sparkline-empty text-[10px] text-[color:var(--text-dim)] italic py-1'

// A team's rank over its recent power-rankings runs, oldest first:
// history [{ date, rank }] (a date string or Date).
export function RankSparkline({ history, primaryColor }) {
  const { t } = useTranslation();
  if (!history?.length) {
    return (
      <div className={PR_SPARKLINE_EMPTY_CLASSES}>
        <span>{t('leagueView.rankings.sparklineEmpty')}</span>
      </div>
    );
  }

  // Single point: no trend to show, no line/area -- Sparkline centers a dot.
  const single = history.length === 1;
  const latest   = history[history.length - 1];
  const earliest = history[0];
  const diff     = single ? 0 : earliest.rank - latest.rank;

  const trendColor = diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red-bright)' : 'var(--text-dim)';
  const trendLabel = single ? null
    : diff === 0 ? '—'
    : diff > 0 ? `▲${diff}` : `▼${Math.abs(diff)}`;

  const fmtDate = (d) => formatDate(parseDay(d), { month: 'short', day: 'numeric' });

  return (
    <div className={PR_SPARKLINE_CLASSES} style={{ minWidth: 140 }}>
      <div className={PR_SPARKLINE_HEADER_CLASSES}>
        <span className={PR_SPARKLINE_LABEL_CLASSES}>{t('leagueView.rankings.sparklineLabel')}</span>
        {trendLabel && (
          <span className={PR_SPARKLINE_TREND_CLASSES} style={{ color: trendColor }}>
            {trendLabel}
            <span className={PR_SPARKLINE_PERIOD_CLASSES}>{t('leagueView.rankings.sparklineDaysSuffix', { days: history.length })}</span>
          </span>
        )}
      </div>
      <Sparkline
        className={PR_SPARKLINE_SVG_CLASSES}
        points={history.map(r => ({ value: r.rank }))}
        color={primaryColor}
        width={240} height={80} padding={16}
        invertY // lower rank number (better) plots higher on the chart
        showEndpoints
        formatEndpointLabel={v => `#${v}`}
      />
      <div className={PR_SPARKLINE_DATES_CLASSES}>
        <span>{fmtDate(earliest.date)}</span>
        {!single && <span>{fmtDate(latest.date)}</span>}
      </div>
    </div>
  );
}

// A 'YYYY-MM-DD' run date is that day, wherever the reader is (new Date()
// would read it as UTC midnight, the day before in the Americas).
export function parseDay(d) {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day);
  }
  return new Date(d);
}

// 'Oct 8' in the app's language.
export const formatDay = d => formatDate(parseDay(d), { month: 'short', day: 'numeric' });

// Shown when there's a narrative or any rank history. narrative: { text,
// date } | null; history: [{ date, rank }].
export default function RankNarrativeCard({ teamAbbr, narrative, history, primaryColor }) {
  const { t } = useTranslation();
  if (!narrative?.text && !history?.length) return null;
  return (
    <div className={`${CARD_CLASSES} ${PR_NARRATIVE_CARD_CLASSES}`} style={{ marginTop: 4 }}>
      <div className={PR_NARRATIVE_CARD_TOP_CLASSES}>
        {narrative?.text && (
          <div className={PR_NARRATIVE_CARD_TOP_FIRST_CHILD_CLASSES}>
            <div className={PR_NARRATIVE_LABEL_CLASSES}>{t('leagueView.rankings.narrativeLabel', { team: teamAbbr })}</div>
            <p className={`pr-narrative-text ${PR_NARRATIVE_TEXT_CLASSES}`}>{narrative.text}</p>
            {narrative.date && (
              <span className={PR_NARRATIVE_DATE_CLASSES}>
                {t('leagueView.rankings.narrativeUpdated', { date: formatDate(parseDay(narrative.date), { month: 'short', day: 'numeric' }) })}
              </span>
            )}
          </div>
        )}
        <RankSparkline history={history} primaryColor={primaryColor} />
      </div>
    </div>
  );
}
