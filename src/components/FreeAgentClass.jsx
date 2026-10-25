/**
 * FreeAgentClass.jsx
 * The followed team's free-agent class for the coming summer, inside
 * TeamView's Cap tab: every deal that ends after this season from the
 * Worker's GET /contracts payload, grouped UFA / RFA / status unknown,
 * roster players first and the team's off-roster signings after them as
 * "in the system". See utils/faClass.js for the shaping and what the
 * markers mean.
 *
 * Props:
 *   data        {object} — the /contracts payload CapTab already holds
 *   rosterIndex {Map}    — utils/capTable.js rosterIndex(roster): names,
 *                          positions and birth dates for ages
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import InfoTip from './InfoTip'
import { buildFaClass } from '../utils/faClass'
import { fmtCapHit } from '../utils/capTable'

const WRAP_CLASSES = 'cap-fa-class mb-4 pb-3 border-b-[0.5px] border-[var(--border)]'
const HEAD_CLASSES = 'flex items-center gap-1 mb-2'
const HEAD_LABEL_CLASSES = 'text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]'
const HEAD_COUNT_CLASSES = 'text-[11px] text-[color:var(--text-dim)]'
const GROUPS_CLASSES = 'grid grid-cols-2 gap-x-4 gap-y-3 max-[480px]:grid-cols-1'
const GROUP_TITLE_CLASSES = 'text-[10px] font-bold uppercase tracking-[0.08em] pb-1 mb-1 border-b-[0.5px] border-[var(--border)]'
const GROUP_UFA_CLASSES = 'text-[color:var(--amber)]'
const GROUP_RFA_CLASSES = 'text-[color:var(--green)]'
const GROUP_UNKNOWN_CLASSES = 'text-[color:var(--text-dim)]'
const ROW_CLASSES = 'cap-fa-row flex items-baseline gap-2 py-[3px] text-[12px]'
const ROW_OFF_CLASSES = 'opacity-75'
const NAME_CLASSES = 'flex-1 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis text-[color:var(--text)]'
const META_CLASSES = 'text-[10px] text-[color:var(--text-dim)] font-[family-name:var(--font-display)] font-bold'
const HIT_CLASSES = 'font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--text-muted)] whitespace-nowrap'
const NO_FIGURE_CLASSES = 'text-[10px] italic text-[color:var(--text-dim)] whitespace-nowrap'
const SYSTEM_CLASSES = 'cap-fa-system text-[9px] uppercase tracking-[0.08em] text-[color:var(--text-dim)] pt-2 pb-[2px]'
const MARK_CLASSES = 'ml-[2px] text-[10px] text-[color:var(--text-dim)]'
const FOOT_CLASSES = 'flex flex-wrap gap-3 text-[10px] text-[color:var(--text-dim)] mt-2'

export default function FreeAgentClass({ data, rosterIndex }) {
  const { t } = useTranslation()
  const fa = useMemo(() => buildFaClass(data, rosterIndex), [data, rosterIndex])
  if (fa.total === 0) return null

  const renderGroup = (key, rows, titleClasses) => {
    if (rows.length === 0) return null
    const roster = rows.filter(r => r.onRoster)
    const system = rows.filter(r => !r.onRoster)
    const renderRow = (r, off) => (
      <div key={r.playerId} className={`${ROW_CLASSES}${off ? ` ${ROW_OFF_CLASSES}` : ''}`} data-player-id={r.playerId}>
        <span className={NAME_CLASSES}>
          {r.name}
          {r.expiryTypeDerived && <span className={MARK_CLASSES} title={t('teamView.cap.derivedLegend')}>†</span>}
          {r.reported && <span className={MARK_CLASSES} title={t('teamView.cap.reportedLegend')}>≈</span>}
        </span>
        <span className={META_CLASSES}>{[r.position, r.age != null ? t('teamView.faClass.age', { age: r.age }) : null].filter(Boolean).join(' · ')}</span>
        {r.capHit != null
          ? <span className={HIT_CLASSES}>{fmtCapHit(r.capHit)}</span>
          : <span className={NO_FIGURE_CLASSES}>{t('teamView.cap.noPublicFigure')}</span>}
      </div>
    )
    return (
      <div className={`cap-fa-group cap-fa-group-${key}`}>
        <div className={`${GROUP_TITLE_CLASSES} ${titleClasses}`}>
          {t(`teamView.faClass.${key}`)} <span className="opacity-70">({rows.length})</span>
        </div>
        {roster.map(r => renderRow(r, false))}
        {system.length > 0 && (
          <>
            <div className={SYSTEM_CLASSES}>{t('teamView.faClass.inSystem')}</div>
            {system.map(r => renderRow(r, true))}
          </>
        )}
      </div>
    )
  }

  const next = fa.nextSummer
  const nextTotal = next.ufa + next.rfa + next.unknown

  return (
    <div className={WRAP_CLASSES}>
      <div className={HEAD_CLASSES}>
        <span className={HEAD_LABEL_CLASSES}>{t('teamView.faClass.title', { year: fa.summer ?? '' })}</span>
        <span className={HEAD_COUNT_CLASSES}>{t('teamView.faClass.count', { roster: fa.rosterTotal, system: fa.offRosterTotal })}</span>
        <InfoTip label={t('teamView.faClass.infoLabel')} text={t('teamView.faClass.infoTip')} />
      </div>
      <div className={GROUPS_CLASSES}>
        {renderGroup('ufa', fa.ufa, GROUP_UFA_CLASSES)}
        {renderGroup('rfa', fa.rfa, GROUP_RFA_CLASSES)}
        {renderGroup('unknown', fa.unknown, GROUP_UNKNOWN_CLASSES)}
      </div>
      {nextTotal > 0 && (
        <div className={FOOT_CLASSES}>
          <span className="cap-fa-next">
            {t('teamView.faClass.nextSummer', {
              year: fa.summer != null ? fa.summer + 1 : '',
              ufaPart: t('teamView.cap.ufaCount', { count: next.ufa }),
              rfaPart: t('teamView.cap.rfaCount', { count: next.rfa }),
            })}
          </span>
        </div>
      )}
    </div>
  )
}
