/**
 * LeagueCapTable.jsx
 * League › Cap: every NHL team's contract commitments for the season from
 * the Worker's GET /contracts/summary (the open nhl-contracts dataset),
 * grouped by the team that signed each deal. See utils/leagueCap.js for
 * why this is "commitments by signing team", not cap space, and why the
 * bar is scaled to the largest total rather than the ceiling.
 *
 * Props:
 *   summary {object} — the /contracts/summary payload (LeagueView fetches it
 *                      so it can hide the tab when `unavailable`)
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import TeamLogo from './TeamLogo'
import InfoTip from './InfoTip'
import { buildLeagueCapTable, fmtCapTotal } from '../utils/leagueCap'
import { CAP_CEILING } from '../utils/contractValue'
import { formatDateOnly } from '../utils/formatters'

const WRAP_CLASSES = 'league-cap card'
const TITLE_ROW_CLASSES = 'flex items-center gap-1 mb-1'
const NOTE_CLASSES = 'text-[11px] text-[color:var(--text-muted)] mb-2'
const PROVENANCE_CLASSES = 'league-cap-provenance text-[10px] text-[color:var(--text-dim)] mb-3 opacity-80'
const SCROLL_CLASSES = 'overflow-x-auto'
const TABLE_CLASSES = 'league-cap-table w-full border-collapse text-[12px]'
const TH_BASE_CLASSES = 'text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-dim)] py-[5px] px-1 border-b-[0.5px] border-[var(--border)] whitespace-nowrap'
const TH_LEFT_CLASSES = `${TH_BASE_CLASSES} text-left`
const TH_RIGHT_CLASSES = `${TH_BASE_CLASSES} text-right`
const ROW_CLASSES = 'league-cap-row border-b-[0.5px] border-[rgba(255,255,255,0.04)]'
const TD_RANK_CLASSES = 'py-[5px] pl-1 pr-[2px] text-[11px] text-[color:var(--text-dim)] text-center w-[22px]'
const TD_TEAM_CLASSES = 'py-[5px] px-1 text-left whitespace-nowrap'
const TEAM_CELL_CLASSES = 'flex items-center gap-[6px] font-medium text-[color:var(--text)]'
const TD_NUM_CLASSES = 'py-[5px] px-1 text-right font-[family-name:var(--font-mono)] text-[color:var(--text-muted)] whitespace-nowrap'
const TD_HIT_CLASSES = 'py-[5px] px-1 text-right whitespace-nowrap min-w-[84px] max-[480px]:min-w-[72px]'
const HIT_CELL_CLASSES = 'relative flex items-center justify-end'
const HIT_BAR_CLASSES = 'league-cap-bar absolute right-0 top-1/2 -translate-y-1/2 h-5 bg-[rgba(204,34,0,0.18)] rounded-[3px]'
const HIT_VAL_CLASSES = 'relative font-[family-name:var(--font-mono)] text-[12px] font-semibold text-[color:var(--text)]'
// The "(n w/ figure)" aside is dropped under 480px so six columns fit a phone.
const SUB_CLASSES = 'text-[10px] text-[color:var(--text-dim)] max-[480px]:hidden'
const MARK_CLASSES = 'ml-[3px] text-[10px] text-[color:var(--text-dim)]'
const FOOT_CLASSES = 'flex flex-wrap gap-3 text-[10px] text-[color:var(--text-dim)] mt-2'

export default function LeagueCapTable({ summary }) {
  const { t } = useTranslation()
  const table = useMemo(() => buildLeagueCapTable(summary, CAP_CEILING), [summary])
  if (table.unavailable) return null
  const asOf = table.asOf ? formatDateOnly(table.asOf, { month: 'short', day: 'numeric', year: 'numeric' }) : null
  const hasArizona = table.rows.some(r => r.includesArizona)
  const roster = table.basis === 'roster'
  const k = roster ? 'leagueCap.roster' : 'leagueCap'

  return (
    <div className={`${WRAP_CLASSES} league-cap--${table.basis}`} data-basis={table.basis}>
      <div className={TITLE_ROW_CLASSES}>
        <span className="sec-label">{t(`${k}.title`, { season: table.season || '' })}</span>
        <InfoTip label={t('leagueCap.infoLabel')} text={t(`${k}.infoTip`)} />
      </div>
      <div className={NOTE_CLASSES}>{t(`${k}.basisNote`)}</div>
      <div className={PROVENANCE_CLASSES}>
        {asOf ? t('leagueCap.provenance', { date: asOf }) : ''}
        {table.ceiling != null && (asOf ? ' · ' : '') + t('leagueCap.ceiling', { amount: (table.ceiling / 1_000_000).toFixed(1) })}
        {' · '}{t(`${k}.coverage`, { withFigure: table.totals.withFigure, count: table.totals.contracts })}
      </div>
      <div className={SCROLL_CLASSES}>
      <table className={TABLE_CLASSES} aria-label={t('leagueCap.title', { season: table.season || '' })}>
        <thead>
          <tr>
            <th className={TH_BASE_CLASSES} aria-label={t('leagueCap.colRank')}>#</th>
            <th className={TH_LEFT_CLASSES}>{t('leagueCap.colTeam')}</th>
            <th className={TH_RIGHT_CLASSES}>{t(`${k}.colDeals`)}</th>
            <th className={TH_RIGHT_CLASSES}>{t(`${k}.colCapHit`)}</th>
            <th className={TH_RIGHT_CLASSES}>{t('leagueCap.colUfa')}</th>
            <th className={TH_RIGHT_CLASSES}>{t('leagueCap.colRfa')}</th>
            {table.hasEstimates && (
              <th className={`${TH_RIGHT_CLASSES} league-cap-est-head`}>
                <span className="inline-flex items-center gap-1">{t('leagueCap.roster.colEstimate')}<InfoTip label={t('leagueCap.roster.estimateLabel')} text={t('leagueCap.roster.estimateTip')} /></span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {table.rows.map(r => (
            <tr key={r.team} className={ROW_CLASSES} data-team={r.team}>
              <td className={TD_RANK_CLASSES}>{r.rank}</td>
              <td className={TD_TEAM_CLASSES}>
                <span className={TEAM_CELL_CLASSES}>
                  {r.known && <TeamLogo abbr={r.team} size={18} />}
                  <span title={r.name}>{r.team}</span>
                  {r.includesArizona && <span className={MARK_CLASSES} title={t('leagueCap.arizonaNote')}>*</span>}
                </span>
              </td>
              <td className={TD_NUM_CLASSES}>
                {r.contracts}
                {r.withFigure < r.contracts && <span className={SUB_CLASSES}> ({t('leagueCap.withFigure', { count: r.withFigure })})</span>}
              </td>
              <td className={TD_HIT_CLASSES}>
                <div className={HIT_CELL_CLASSES}>
                  <div className={HIT_BAR_CLASSES} style={{ width: `${r.barPct}%` }} />
                  <span className={HIT_VAL_CLASSES}>{fmtCapTotal(r.capHitTotal)}</span>
                </div>
              </td>
              <td className={TD_NUM_CLASSES}>{r.expiring.ufa}</td>
              <td className={TD_NUM_CLASSES}>{r.expiring.rfa}</td>
              {table.hasEstimates && (
                <td className={`${TD_NUM_CLASSES} league-cap-est`} style={r.estimate != null && r.estimate < 0 ? { color: 'var(--red-bright)' } : undefined}>
                  {r.estimate != null ? `${r.estimate < 0 ? '-' : ''}$${(Math.abs(r.estimate) / 1e6).toFixed(1)}M` : '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <div className={FOOT_CLASSES}>
        <span>{t('leagueCap.expiringNote', { ufa: table.totals.expiring.ufa, rfa: table.totals.expiring.rfa })}</span>
        {roster && table.totals.offRoster > 0 && <span>{t('leagueCap.roster.offRosterNote', { count: table.totals.offRoster })}</span>}
        {hasArizona && <span>* {t('leagueCap.arizonaNote')}</span>}
      </div>
    </div>
  )
}
