/**
 * ContractValueBoard.jsx
 * League › Cap's contract-value leaderboard: every NHL skater and goalie
 * scored with the player popup's helpers (points and WAR per $1M of cap
 * hit; GSAX per $1M for goalies), from the Worker's /contracts/players
 * joined to the NHL skater summary and the pipeline's analytics. See
 * utils/valueBoard.js for who is rated and why. Tapping a row opens the
 * player popup in league context.
 *
 * Props:
 *   board         {object} — buildValueBoard() output
 *   onPlayerClick {fn}     — receives a PlayerPopup-shaped player
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import InfoTip from './InfoTip'
import TeamLogo from './TeamLogo'
import { fmtCapHit } from '../utils/capTable'
import { popupPlayer } from '../utils/valueBoard'
import { WAR_TIER_MIN_GP } from '../utils/warTier'

const SHOW = 25

const WRAP_CLASSES = 'league-value card mt-3'
const TITLE_ROW_CLASSES = 'flex items-center gap-1 mb-1'
const NOTE_CLASSES = 'text-[11px] text-[color:var(--text-muted)] mb-2'
const SEG_WRAP_CLASSES = 'flex gap-1 mb-3'
const SEG_BASE_CLASSES = 'league-value-seg py-1 px-3 rounded-[14px] text-[12px] font-medium border-[0.5px] cursor-pointer'
const SEG_ON_CLASSES = 'league-value-seg--on text-[color:var(--red-bright)] bg-[var(--red-dim)] border-transparent'
const SEG_OFF_CLASSES = 'text-[color:var(--text-muted)] bg-transparent border-[var(--border)]'
const TABLE_CLASSES = 'league-value-table w-full border-collapse text-[12px]'
const TH_CLASSES = 'text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-dim)] py-[5px] px-1 border-b-[0.5px] border-[var(--border)] whitespace-nowrap text-right'
const TH_LEFT_CLASSES = `${TH_CLASSES} text-left`
const ROW_CLASSES = 'league-value-row border-b-[0.5px] border-[rgba(255,255,255,0.04)] cursor-pointer hover:bg-[var(--bg2)]'
const TD_RANK_CLASSES = 'py-[5px] pl-1 pr-[2px] text-[11px] text-[color:var(--text-dim)] text-center w-[22px]'
const TD_PLAYER_CLASSES = 'py-[5px] px-1 text-left whitespace-nowrap max-w-[150px] overflow-hidden text-ellipsis'
const PLAYER_CELL_CLASSES = 'flex items-center gap-[6px] text-[color:var(--text)] font-medium'
const PLAYER_META_CLASSES = 'text-[10px] text-[color:var(--text-dim)] font-normal'
const TD_NUM_CLASSES = 'py-[5px] px-1 text-right font-[family-name:var(--font-mono)] text-[color:var(--text-muted)] whitespace-nowrap'
const TD_SCORE_CLASSES = 'py-[5px] px-1 text-right whitespace-nowrap'
const BADGE_CLASSES = 'inline-flex items-center gap-1 text-[11px] font-semibold py-[2px] px-2 rounded-xl border-[0.5px]'
const BADGE_SCORE_CLASSES = 'font-[family-name:var(--font-mono)] text-[11px]'
const MARK_CLASSES = 'ml-[2px] text-[10px] text-[color:var(--text-dim)]'
const MORE_CLASSES = 'league-value-more mt-2 text-[11px] text-[color:var(--text-muted)] underline underline-offset-2 bg-transparent border-0 p-0 cursor-pointer'
const FOOT_CLASSES = 'text-[10px] text-[color:var(--text-dim)] mt-2'

export default function ContractValueBoard({ board, onPlayerClick }) {
  const { t } = useTranslation()
  const [group, setGroup] = useState('skaters')
  const [all, setAll] = useState(false)
  if (!board?.available) return null
  // Never offer an empty group (no dead options).
  const groups = ['skaters', 'goalies'].filter(g => board[g].length > 0)
  const active = groups.includes(group) ? group : groups[0]
  const rows = board[active]
  const shown = all ? rows : rows.slice(0, SHOW)
  const isGoalies = active === 'goalies'

  return (
    <div className={WRAP_CLASSES}>
      <div className={TITLE_ROW_CLASSES}>
        <span className="sec-label">{t('leagueValue.title', { season: board.season || '' })}</span>
        <InfoTip label={t('leagueValue.infoLabel')} text={isGoalies ? t('leagueValue.infoTipGoalies') : t('leagueValue.infoTipSkaters', { warGp: WAR_TIER_MIN_GP })} />
      </div>
      <div className={NOTE_CLASSES}>
        {isGoalies
          ? t('leagueValue.noteGoalies', { rated: board.counts.goaliesRated, minGp: board.minGpGoalies })
          : t('leagueValue.noteSkaters', { rated: board.counts.skatersRated, minGp: board.minGp })}
      </div>
      {groups.length > 1 && (
        <div className={SEG_WRAP_CLASSES} role="tablist">
          {groups.map(g => (
            <button key={g} type="button" role="tab" aria-selected={active === g}
              className={`${SEG_BASE_CLASSES} ${active === g ? SEG_ON_CLASSES : SEG_OFF_CLASSES}`}
              onClick={() => { setGroup(g); setAll(false) }}>
              {t(`leagueValue.${g}`)}
            </button>
          ))}
        </div>
      )}
      <table className={TABLE_CLASSES} aria-label={t('leagueValue.title', { season: board.season || '' })}>
        <thead>
          <tr>
            <th className={TH_CLASSES} aria-label={t('leagueValue.colRank')}>#</th>
            <th className={TH_LEFT_CLASSES}>{t('leagueValue.colPlayer')}</th>
            <th className={TH_CLASSES}>{t('leagueValue.colGp')}</th>
            <th className={TH_CLASSES}>{isGoalies ? t('leagueValue.colGsax') : t('leagueValue.colPts')}</th>
            <th className={TH_CLASSES}>{t('leagueValue.colCapHit')}</th>
            <th className={TH_CLASSES}>{t('leagueValue.colScore')}</th>
          </tr>
        </thead>
        <tbody>
          {shown.map(r => (
            <tr key={r.playerId} className={ROW_CLASSES} data-player-id={r.playerId} onClick={() => onPlayerClick?.(popupPlayer(r))}>
              <td className={TD_RANK_CLASSES}>{r.rank}</td>
              <td className={TD_PLAYER_CLASSES}>
                <span className={PLAYER_CELL_CLASSES}>
                  {r.team && <TeamLogo abbr={r.team} size={16} />}
                  <span>
                    {r.name}
                    {r.reported && <span className={MARK_CLASSES} title={t('teamView.cap.reportedLegend')}>≈</span>}
                    <span className={PLAYER_META_CLASSES}> {[r.team, r.position].filter(Boolean).join(' · ')}</span>
                  </span>
                </span>
              </td>
              <td className={TD_NUM_CLASSES}>{r.gp}</td>
              <td className={TD_NUM_CLASSES}>{isGoalies ? `${r.gsax > 0 ? '+' : ''}${Number(r.gsax).toFixed(1)}` : r.points}</td>
              <td className={TD_NUM_CLASSES}>{fmtCapHit(r.capHit)}</td>
              <td className={TD_SCORE_CLASSES}>
                {r.label && (
                  <span className={BADGE_CLASSES} style={{ background: r.label.color + '22', borderColor: r.label.color + '55', color: r.label.color }}
                    title={isGoalies ? t('playerPopup.contract.goalieGsaxPerM', { score: `${r.score > 0 ? '+' : ''}${r.score}` }) : `${r.score} ${r.method === 'blended' ? t('playerPopup.contract.blendedPerM') : t('playerPopup.contract.ptsPerM')}`}>
                    <span className={BADGE_SCORE_CLASSES}>{isGoalies && r.score > 0 ? '+' : ''}{r.score}</span>
                    <span className="max-[480px]:hidden">{r.label.label}</span>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > SHOW && (
        <button type="button" className={MORE_CLASSES} onClick={() => setAll(a => !a)}>
          {all ? t('leagueValue.showTop', { count: SHOW }) : t('leagueValue.showAll', { count: rows.length })}
        </button>
      )}
      <div className={FOOT_CLASSES}>
        {t('leagueValue.notRated', { noFigure: board.counts.noFigure, elc: board.counts.elc, underMinGp: board.counts.underMinGp, minGp: board.minGp, minGpGoalies: board.minGpGoalies })}
      </div>
    </div>
  )
}
