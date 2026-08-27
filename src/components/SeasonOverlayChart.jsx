import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine,
} from 'recharts';
// Tailwind migration (Session 95, Phase 1) -- previously SeasonOverlayChart.css.
const CHART_CLASSES = 'w-full';
const EMPTY_CLASSES = 'text-[12px] text-[color:var(--text-dim)] py-4 text-center';
const LEGEND_CHIP_CLASSES = 'font-[family-name:var(--font-body)] text-[12px] font-semibold text-[color:var(--text-muted)] [transition:opacity_0.15s]';
const TOOLTIP_CLASSES = 'bg-[var(--bg2)] border-[0.5px] border-[var(--border-2)] rounded-[var(--radius-sm)] py-2 px-2.5 font-[family-name:var(--font-body)] shadow-[0_4px_16px_rgba(0,0,0,0.25)]';
const TOOLTIP_TITLE_CLASSES = 'text-[11px] font-semibold text-[color:var(--text-dim)] mb-1.5 whitespace-nowrap';
const TOOLTIP_ROW_CLASSES = 'flex items-center gap-1.5 text-[12px] text-[color:var(--text)] py-0.5 whitespace-nowrap';
const TOOLTIP_SWATCH_CLASSES = 'w-2 h-2 rounded-full shrink-0';
const TOOLTIP_LABEL_CLASSES = 'text-[color:var(--text-muted)] mr-auto pr-2.5';
const TOOLTIP_VALUE_CLASSES = 'font-semibold';

// Generic multi-season overlay line chart (Session 66). Deliberately
// metric-agnostic and league-agnostic -- callers own team-color selection,
// data-fetching, and metric-specific formatting; this component only knows
// how to plot pre-shaped series against a shared "game number" x-axis
// (not date -- NHL/PWHL season lengths don't line up) with a synced
// tooltip and toggleable legend chips. Today's only caller is
// TeamComparisonPopup (NHL, xGF%), but nothing here assumes that.
//
// series: [{
//   seasonLabel: string,       // also used as the Recharts dataKey -- must be unique per series
//   color: string,             // any valid CSS color (caller builds the season-over-season ramp)
//   dashPattern?: string,      // e.g. '6 4' -- passed straight to strokeDasharray
//   dataPoints: [{ gameNumber: number, value: number }],
//   hidden?: boolean,          // seeds initial legend-toggle state
// }]
export default function SeasonOverlayChart({
  series = [],
  metricLabel,
  xAxisLabel,
  valueFormatter = (v) => `${v}`,
  referenceValue = null,
  yDomain = ['auto', 'auto'],
  height = 260,
  onToggleSeason = null,
}) {
  const { t } = useTranslation();
  const resolvedMetricLabel = metricLabel ?? t('seasonOverlayChart.defaultMetricLabel');
  const resolvedXAxisLabel  = xAxisLabel  ?? t('seasonOverlayChart.defaultXAxisLabel');
  // Recharts' own recommended pattern for a toggleable legend is a `hide`
  // prop on the graphical element (Line here), not opacity -- `hide`
  // removes that series from the synced Tooltip's payload too, so a hidden
  // season doesn't leave a dead "0%" row behind when you hover a still-
  // visible one. Opacity-only hiding would keep the series in the shared
  // tooltip, which reads as a bug ("why is this greyed-out season still
  // showing a value?").
  const [hiddenSeasons, setHiddenSeasons] = useState(
    () => new Set(series.filter(s => s.hidden).map(s => s.seasonLabel))
  );

  function toggle(seasonLabel) {
    setHiddenSeasons(prev => {
      const next = new Set(prev);
      if (next.has(seasonLabel)) next.delete(seasonLabel);
      else next.add(seasonLabel);
      return next;
    });
    onToggleSeason?.(seasonLabel);
  }

  // Merge every series onto one array keyed by gameNumber -- Recharts needs
  // a single shared data array across all <Line>s for the synced hover /
  // tooltip behavior to work. A season with no data for a given gameNumber
  // (or no data at all -- e.g. a season with zero xGF% rows) just leaves
  // that key `undefined` in each row rather than 0, so `connectNulls={false}`
  // renders a gap / absent line instead of a misleading flat-zero line.
  const gameNumbers = new Set();
  series.forEach(s => (s.dataPoints || []).forEach(dp => gameNumbers.add(dp.gameNumber)));
  const sortedGameNumbers = [...gameNumbers].sort((a, b) => a - b);

  const pointMaps = series.map(s => {
    const map = new Map();
    (s.dataPoints || []).forEach(dp => map.set(dp.gameNumber, dp.value));
    return map;
  });

  const chartData = sortedGameNumbers.map(gn => {
    const row = { gameNumber: gn };
    series.forEach((s, i) => { row[s.seasonLabel] = pointMaps[i].get(gn); });
    return row;
  });

  const hasAnyData = chartData.length > 0;

  if (!hasAnyData) {
    return <div className={EMPTY_CLASSES}>{t('seasonOverlayChart.emptyState')}</div>;
  }

  return (
    <div className={CHART_CLASSES}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="gameNumber"
            type="number"
            domain={['dataMin', 'dataMax']}
            allowDecimals={false}
            tick={{ fill: 'var(--text-dim)', fontSize: 11 }}
            stroke="var(--border-2)"
            label={{ value: resolvedXAxisLabel, position: 'insideBottom', offset: -2, fill: 'var(--text-dim)', fontSize: 11 }}
          />
          <YAxis
            domain={yDomain}
            tick={{ fill: 'var(--text-dim)', fontSize: 11 }}
            stroke="var(--border-2)"
            width={36}
            tickFormatter={valueFormatter}
          />
          {referenceValue != null && (
            <ReferenceLine y={referenceValue} stroke="var(--text-dim)" strokeDasharray="3 3" opacity={0.6} />
          )}
          <Tooltip
            content={
              <OverlayTooltip
                metricLabel={resolvedMetricLabel}
                valueFormatter={valueFormatter}
                hiddenSeasons={hiddenSeasons}
              />
            }
          />
          <Legend
            onClick={(entry) => toggle(entry.dataKey)}
            formatter={(value, entry) => (
              <span
                className={LEGEND_CHIP_CLASSES}
                style={{ opacity: hiddenSeasons.has(entry.dataKey) ? 0.35 : 1 }}
              >
                {value}
              </span>
            )}
            wrapperStyle={{ cursor: 'pointer', fontSize: 12, paddingTop: 6 }}
          />
          {series.map(s => (
            <Line
              key={s.seasonLabel}
              type="monotone"
              dataKey={s.seasonLabel}
              name={s.seasonLabel}
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dashPattern || undefined}
              dot={false}
              activeDot={{ r: 4 }}
              hide={hiddenSeasons.has(s.seasonLabel)}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function OverlayTooltip({ active, payload, label, metricLabel, valueFormatter, hiddenSeasons }) {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;
  const visible = payload.filter(p => p.value != null && !hiddenSeasons.has(p.dataKey));
  if (!visible.length) return null;
  return (
    <div className={TOOLTIP_CLASSES}>
      <div className={TOOLTIP_TITLE_CLASSES}>{t('seasonOverlayChart.tooltipTitle', { metric: metricLabel, game: label })}</div>
      {visible.map(p => (
        <div key={p.dataKey} className={TOOLTIP_ROW_CLASSES}>
          <span className={TOOLTIP_SWATCH_CLASSES} style={{ background: p.color }} />
          <span className={TOOLTIP_LABEL_CLASSES}>{p.dataKey}</span>
          <span className={TOOLTIP_VALUE_CLASSES}>{valueFormatter(p.value)}</span>
        </div>
      ))}
    </div>
  );
}
