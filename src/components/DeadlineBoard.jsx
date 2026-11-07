/**
 * DeadlineBoard.jsx
 * League › Cap's Deadline board: every NHL player with candidate signals,
 * ranked by eyewall-pipeline's trade_candidacy.py model and shown as tiers
 * ('Several signals' / 'Some signals') with the signals behind them, from
 * the Worker's /trade-candidacy/board. Phase 4 of the trade fit scope. Never
 * a percentage for a player. Filters by position group, and by "fits my
 * team" (the selected team's trade fit tier is strong or possible); each is
 * offered only when it would leave players (no dead options). The board
 * exists only from Jan 1 to the trade deadline: outside it the route has no
 * players and nothing renders. Tapping a row opens the player popup.
 *
 * Props:
 *   board         {object} — /trade-candidacy/board response
 *   onPlayerClick {fn}     — receives a PlayerPopup-shaped player
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import InfoTip from './InfoTip'
import TeamLogo from './TeamLogo'
import { fmtCapHit } from '../utils/capTable'
import { popupPlayer } from '../utils/valueBoard'
import { TIER_COLORS, fmtDay } from './TradeCandidacySection'
import {
  BOARD_SHOW, TIER_BACKTEST_RATES, boardGroups, canFilterFit, filterBoard, hasBoard, signalKey,
} from '../utils/tradeCandidacy'

const WRAP_CLASSES = 'deadline-board card mt-3'
const TITLE_ROW_CLASSES = 'flex items-center gap-1 mb-1'
const NOTE_CLASSES = 'deadline-board-note text-[11px] text-[color:var(--text-muted)] mb-2'
const CONTROLS_CLASSES = 'flex flex-wrap gap-1 mb-3'
const SEG_BASE_CLASSES = 'deadline-board-seg py-1 px-3 rounded-[14px] text-[12px] font-medium border-[0.5px] cursor-pointer'
const SEG_ON_CLASSES = 'deadline-board-seg--on text-[color:var(--red-bright)] bg-[var(--red-dim)] border-transparent'
const SEG_OFF_CLASSES = 'text-[color:var(--text-muted)] bg-transparent border-[var(--border)]'
const TABLE_CLASSES = 'deadline-board-table w-full border-collapse text-[12px]'
const TH_CLASSES = 'text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-dim)] py-[5px] px-1 border-b-[0.5px] border-[var(--border)] whitespace-nowrap text-left'
const TH_RIGHT_CLASSES = `${TH_CLASSES} text-right`
const ROW_CLASSES = 'deadline-board-row border-b-[0.5px] border-[rgba(255,255,255,0.04)] cursor-pointer hover:bg-[var(--bg2)] align-top'
const TD_RANK_CLASSES = 'py-[5px] pl-1 pr-[2px] text-[11px] text-[color:var(--text-dim)] text-center w-[22px]'
const TD_PLAYER_CLASSES = 'py-[5px] px-1 text-left whitespace-nowrap max-w-[170px] overflow-hidden text-ellipsis'
const PLAYER_CELL_CLASSES = 'flex items-center gap-[6px] text-[color:var(--text)] font-medium'
const PLAYER_META_CLASSES = 'text-[10px] text-[color:var(--text-dim)] font-normal'
const TD_CLASSES = 'py-[5px] px-1 text-left'
const TD_NUM_CLASSES = 'py-[5px] px-1 text-right font-[family-name:var(--font-mono)] text-[color:var(--text-muted)] whitespace-nowrap'
const TIER_CLASSES = 'deadline-board-tier text-[11px] font-semibold whitespace-nowrap'
const SIGNALS_CLASSES = 'deadline-board-signals text-[11px] text-[color:var(--text-muted)]'
const MORE_CLASSES = 'deadline-board-more mt-2 text-[11px] text-[color:var(--text-muted)] underline underline-offset-2 bg-transparent border-0 p-0 cursor-pointer'
const FOOT_CLASSES = 'text-[10px] text-[color:var(--text-dim)] mt-2'

const pct = x => `${Math.round(x * 100)}%`

export default function DeadlineBoard({ board, onPlayerClick }) {
  const { t } = useTranslation()
  const [group, setGroup] = useState('all')
  const [fitOnly, setFitOnly] = useState(false)
  const [all, setAll] = useState(false)
  if (!hasBoard(board)) return null
  const groups = boardGroups(board.players)
  const active = groups.includes(group) ? group : 'all'
  // The fit filter is offered only when it leaves players in this group.
  const fitOffered = canFilterFit(board) && filterBoard(board.players, { group: active, fitOnly: true }).length > 0
  const fitApplied = fitOffered && fitOnly
  const shownRows = filterBoard(board.players, { group: active, fitOnly: fitApplied })
  const shown = all ? shownRows : shownRows.slice(0, BOARD_SHOW)
  const title = t('deadlineBoard.title')
  const signalText = p => p.signals.map(s => signalKey(s, { short: true })).filter(Boolean).map(k => t(k.key, k.params)).join(' · ')

  return (
    <div className={WRAP_CLASSES}>
      <div className={TITLE_ROW_CLASSES}>
        <span className="sec-label">{title}</span>
        <InfoTip label={t('deadlineBoard.infoLabel')} text={t('deadlineBoard.infoTip', { several: pct(TIER_BACKTEST_RATES.several), some: pct(TIER_BACKTEST_RATES.some) })} />
      </div>
      <div className={NOTE_CLASSES}>
        {t('deadlineBoard.note', { count: board.players.length, date: fmtDay(board.asOf) || '—', deadline: fmtDay(board.deadline) || '—' })}
      </div>
      {(groups.length > 1 || fitOffered) && (
        <div className={CONTROLS_CLASSES}>
          {groups.length > 1 && groups.map(g => (
            <button key={g} type="button" aria-pressed={active === g} data-group={g}
              className={`${SEG_BASE_CLASSES} ${active === g ? SEG_ON_CLASSES : SEG_OFF_CLASSES}`}
              onClick={() => { setGroup(g); setAll(false) }}>
              {t(`deadlineBoard.groups.${g}`)}
            </button>
          ))}
          {fitOffered && (
            <button type="button" aria-pressed={fitApplied} data-group="fit"
              className={`${SEG_BASE_CLASSES} deadline-board-fit ${fitApplied ? SEG_ON_CLASSES : SEG_OFF_CLASSES}`}
              onClick={() => { setFitOnly(v => !v); setAll(false) }}>
              {t('deadlineBoard.fitsTeam', { team: board.fitTeam })}
            </button>
          )}
        </div>
      )}
      <table className={TABLE_CLASSES} aria-label={title}>
        <thead>
          <tr>
            <th className={TH_CLASSES} aria-label={t('deadlineBoard.colRank')}>#</th>
            <th className={TH_CLASSES}>{t('deadlineBoard.colPlayer')}</th>
            <th className={TH_CLASSES}>{t('deadlineBoard.colTier')}</th>
            <th className={`${TH_CLASSES} max-[480px]:hidden`}>{t('deadlineBoard.colSignals')}</th>
            <th className={TH_RIGHT_CLASSES}>{t('deadlineBoard.colCapHit')}</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((p, i) => (
            <tr key={p.id} className={ROW_CLASSES} data-player-id={p.id} data-tier={p.tier}
              onClick={() => onPlayerClick?.(popupPlayer({ playerId: p.id, name: p.name, team: p.team, position: p.position }))}>
              <td className={TD_RANK_CLASSES}>{i + 1}</td>
              <td className={TD_PLAYER_CLASSES}>
                <span className={PLAYER_CELL_CLASSES}>
                  {p.team && <TeamLogo abbr={p.team} size={16} />}
                  <span>
                    {p.name}
                    <span className={PLAYER_META_CLASSES}> {[p.team, p.position].filter(Boolean).join(' · ')}</span>
                  </span>
                </span>
                {/* phones: the Signals column is hidden, so the reasons go under the name */}
                <span className={`${SIGNALS_CLASSES} deadline-board-signals-inline block whitespace-normal pl-[22px] min-[481px]:hidden`}>{signalText(p)}</span>
              </td>
              <td className={TD_CLASSES}>
                <span className={TIER_CLASSES} style={{ color: TIER_COLORS[p.tier] }}>{t(`playerPopup.candidacy.tiers.${p.tier}`)}</span>
              </td>
              <td className={`${TD_CLASSES} max-[480px]:hidden`}>
                <span className={SIGNALS_CLASSES}>{signalText(p)}</span>
              </td>
              <td className={TD_NUM_CLASSES}>{fmtCapHit(p.capHit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {shownRows.length > BOARD_SHOW && (
        <button type="button" className={MORE_CLASSES} onClick={() => setAll(a => !a)}>
          {all ? t('deadlineBoard.showTop', { count: BOARD_SHOW }) : t('deadlineBoard.showAll', { count: shownRows.length })}
        </button>
      )}
      <div className={FOOT_CLASSES}>{t('deadlineBoard.foot')}</div>
    </div>
  )
}
