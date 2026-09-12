// src/components/InjuryBadge.jsx
// Shared injury status badge + detail rendering for /injuries rows.
// Extracted from ScoutingTab.jsx (where the badge originated) so
// PlayerPopup.jsx and TeamView.jsx's Overview injury report render the
// exact same badge. NHL-only, like the /injuries route itself.
import { useTranslation } from 'react-i18next';
import InfoTip from './InfoTip';
import { formatDate } from '../utils/formatters';
import { injuryDescription, isReturnPast, parseLocalDate } from '../utils/injuryDetails';

// Statuses that gray out a player rather than just tagging them --
// "day-to-day"/"suspension" still show a badge but stay full-opacity,
// since a DTD player is often still playing that night.
export const INJURY_OUT_STATUSES = new Set(['out', 'injured-reserve']);

const BADGE_CLASSES = {
  'day-to-day':      'text-[color:var(--amber)] bg-[rgba(240,160,48,0.15)]',
  'out':             'text-[color:var(--red-bright)] bg-[rgba(204,34,0,0.15)]',
  'injured-reserve': 'text-[color:var(--red-bright)] bg-[rgba(204,34,0,0.15)]',
  'suspension':      'text-[color:var(--text-dim)] bg-[rgba(255,255,255,0.08)]',
};
const FALLBACK_BADGE_CLASSES = 'text-[color:var(--text-dim)] bg-[rgba(255,255,255,0.08)]';
const STATUS_KEYS = { 'day-to-day': 'dtd', out: 'out', 'injured-reserve': 'ir', suspension: 'susp' };

export function InjuryBadge({ status, size = 'sm' }) {
  const { t } = useTranslation();
  if (!status) return null;
  const key = STATUS_KEYS[status];
  const label = key ? t(`injury.status.${key}`) : status.slice(0, 4).toUpperCase();
  const sizeCls = size === 'md' ? 'text-[9px] py-[1px] px-1.5' : 'text-[7px] py-px px-1';
  return (
    <span
      className={`sc-injury-badge font-bold uppercase tracking-[0.04em] rounded-[3px] ml-1 align-middle ${sizeCls} ${BADGE_CLASSES[status] || FALLBACK_BADGE_CLASSES}`}
      title={key ? t(`injury.statusLong.${key}`) : status}
    >
      {label}
    </span>
  );
}

// Plain-text pieces for one injury: description, estimated return, last
// ESPN update, and a staleness warning when ESPN's own return date has
// already passed. Shared by the tap-to-reveal tip and the inline line.
export function useInjuryDetailParts(injury) {
  const { t } = useTranslation();
  if (!injury) return null;
  const returnDate = parseLocalDate(injury.return_date);
  const updated = injury.espn_updated_at ? formatDate(injury.espn_updated_at) : '';
  return {
    description: injuryDescription(injury),
    estReturn: returnDate ? t('injury.estReturn', { date: formatDate(returnDate) }) : null,
    updated: updated ? t('injury.updated', { date: updated }) : null,
    stale: isReturnPast(injury) ? t('injury.mayBeOutdated') : null,
  };
}

// Tap-to-reveal details next to a badge, via the app's standard InfoTip.
// Renders nothing when there's nothing beyond the status to say.
export function InjuryDetailTip({ injury, name }) {
  const parts = useInjuryDetailParts(injury);
  if (!parts) return null;
  const text = [parts.description, parts.estReturn, parts.updated].filter(Boolean).join(' · ');
  if (!text) return null;
  const sections = [{ text }];
  if (parts.stale) sections.push({ text: parts.stale });
  return <InfoTip label={name} sections={sections} position="above" />;
}

// Inline one-line summary (player popup banner, team injury report).
export function InjuryDetailLine({ injury, className = '' }) {
  const parts = useInjuryDetailParts(injury);
  if (!parts) return null;
  const main = [parts.description, parts.estReturn].filter(Boolean).join(' · ');
  return (
    <span className={`text-[11px] text-[color:var(--text-muted)] leading-[1.4] ${className}`}>
      {main}
      {parts.updated && (
        <span className="text-[color:var(--text-dim)]">{main ? ' · ' : ''}{parts.updated}</span>
      )}
      {parts.stale && (
        <span className="block text-[10px] text-[color:var(--amber)]">{parts.stale}</span>
      )}
    </span>
  );
}
