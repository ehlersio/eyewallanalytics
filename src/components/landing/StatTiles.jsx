// src/components/landing/StatTiles.jsx
// The advanced-stats section's three numbers. The shot areas are the rink
// library's own list (the same areas the goalie save % map uses); 16+ is
// the 10 skater and 6 goalie percentile categories (utils/nhlPlayerStats.js).

import { useTranslation } from 'react-i18next';
import { SHOT_AREAS } from 'react-hockey-rink';

export const SHOT_AREA_COUNT = SHOT_AREAS.length;

export default function StatTiles() {
  const { t } = useTranslation();
  const tiles = [
    { value: '16+', label: t('landing.advanced.tilePercentiles') },
    { value: String(SHOT_AREA_COUNT), label: t('landing.advanced.tileAreas') },
    { value: '4', label: t('landing.advanced.tileLeagues') },
  ];
  return (
    <dl className="landing-stat-tiles m-0 mt-7 grid max-w-[460px] grid-cols-3 gap-2.5">
      {tiles.map(tile => (
        <div key={tile.label} className="flex flex-col rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg2)] px-3 py-3">
          <dt className="order-2 mt-1.5 text-[11.5px] leading-[1.3] text-[color:var(--text-muted)]">{tile.label}</dt>
          <dd className="order-1 m-0 font-[family-name:var(--font-mono)] text-[26px] font-medium leading-none text-[color:var(--text)]">{tile.value}</dd>
        </div>
      ))}
    </dl>
  );
}
