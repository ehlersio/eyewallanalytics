// The NHL player popup's Trade fit section: which of the other 31 teams the
// player fits, in tiers with reasons, from the Worker's /trade-fit
// (eyewall-pipeline trade_fit.py). Phase 2 of the trade fit scope. A fit,
// not a prediction: tiers and reasons, never a percentage for the fit.
// Renders nothing until the route returns the player and teams (no dead
// options): players outside the population and the offseason show no section.

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFetch } from '../hooks/useFetch'
import { getTradeFit } from '../utils/nhlApi'
import { ALL_TEAMS } from '../utils/teamConfig'
import TeamLogo from './TeamLogo'
import InfoTip from './InfoTip'
import { clauseKey, fmtMoney, hasTradeFit, reasonKey, tierCounts, visibleTeams } from '../utils/tradeFit'

const TIER_COLORS = { strong: 'var(--green)', possible: 'var(--amber)', long_shot: 'var(--text-dim)' }

const SECTION_CLASSES = 'trade-fit py-3 px-4 border-b-[0.5px] border-[var(--border)]'
const HEAD_CLASSES = 'sec-label flex items-center gap-1.5 mb-1'
const NOTE_CLASSES = 'text-[11px] text-[color:var(--text-muted)]'
const ROW_CLASSES = 'trade-fit-team border-t-[0.5px] border-[var(--border)]'
const ROW_BUTTON_CLASSES = 'trade-fit-team-toggle w-full flex items-center gap-2 py-2 bg-transparent border-0 px-0 text-left cursor-pointer'
const REASONS_CLASSES = 'trade-fit-reasons pl-[26px] pb-2'
const TEAM_NAME_CLASSES = 'text-[13px] font-semibold text-[color:var(--text)]'
const TIER_CLASSES = 'trade-fit-tier text-[11px] font-semibold ml-auto shrink-0'
const CARET_CLASSES = 'text-[10px] text-[color:var(--text-dim)] shrink-0 w-3 text-right'
const REASON_CLASSES = 'trade-fit-reason text-[11px] text-[color:var(--text-muted)] leading-snug'
const TOGGLE_CLASSES = 'trade-fit-toggle text-[11px] text-[color:var(--text-muted)] underline underline-offset-2 bg-transparent border-0 p-0 cursor-pointer mt-2'

const teamName = abbr => ALL_TEAMS.find(x => x.abbr === abbr)?.shortName || abbr

// Each team is one tappable line (logo, name, tier); its reasons open under
// it, one team at a time, so five teams don't push the popup's tabs a
// screen down. `initialOpen` is for tests (a static render can't tap).
export function TradeFitBody({ data, initialOpen = null }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [open, setOpen] = useState(initialOpen)
  if (!hasTradeFit(data)) return null
  const { player, teams } = data
  const slotLabel = s => (s ? t(`teamView.needs.slots.${s}`) : '')
  const counts = tierCounts(teams)
  const clause = clauseKey(player.clause)
  const rating = `${player.rating > 0 ? '+' : player.rating < 0 ? '−' : ''}${Math.abs(player.rating).toFixed(2)}`
  return (
    <div className={SECTION_CLASSES}>
      <div className={HEAD_CLASSES}>
        {t('playerPopup.tradeFit.title')}
        <InfoTip label={t('playerPopup.tradeFit.methodLabel')} text={t('playerPopup.tradeFit.methodTip')} />
      </div>
      <div className={`${NOTE_CLASSES} trade-fit-summary`}>
        {t('playerPopup.tradeFit.summary', { strong: counts.strong, possible: counts.possible, longShot: counts.long_shot })}
      </div>
      <div className={`${NOTE_CLASSES} trade-fit-basis`}>
        {t(player.position === 'G' ? 'playerPopup.tradeFit.ratingGoalie' : 'playerPopup.tradeFit.rating', { value: rating })}
        {player.ratingBasis === 'last_season' && <> {t('playerPopup.tradeFit.lastSeason')}</>}
        {' · '}
        {player.rental
          ? t('playerPopup.tradeFit.rental', { type: player.expiryType || '—' })
          : t('playerPopup.tradeFit.term', { season: player.expiresAfter || '—' })}
        {player.capHit != null && <> · {fmtMoney(player.capHit)}</>}
      </div>
      <div className={`${NOTE_CLASSES} trade-fit-clause`}>{t(clause.key, clause.params)}</div>
      <div className={`${NOTE_CLASSES} trade-fit-hint`} style={{ marginTop: 4 }}>{t('playerPopup.tradeFit.tapHint')}</div>
      <div className="mt-1">
        {visibleTeams(teams, expanded).map(team => (
          <div key={team.team} className={ROW_CLASSES} data-team={team.team} data-tier={team.tier}>
            <button
              type="button"
              className={ROW_BUTTON_CLASSES}
              aria-expanded={open === team.team}
              onClick={() => setOpen(o => (o === team.team ? null : team.team))}
            >
              <TeamLogo abbr={team.team} size={18} />
              <span className={TEAM_NAME_CLASSES}>{teamName(team.team)}</span>
              <span className={TIER_CLASSES} style={{ color: TIER_COLORS[team.tier] }}>{t(`playerPopup.tradeFit.tiers.${team.tier}`)}</span>
              <span className={CARET_CLASSES} aria-hidden="true">{open === team.team ? '▾' : '▸'}</span>
            </button>
            {open === team.team && (
              <div className={REASONS_CLASSES}>
                {team.reasons.map((r, i) => {
                  const k = reasonKey(r, slotLabel)
                  return k
                    ? <div key={i} className={REASON_CLASSES}>{t(k.key, k.params)}{k.note && <> · {t(k.note.key, k.note.params)}</>}</div>
                    : null
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      {teams.length > 5 && (
        <button type="button" className={TOGGLE_CLASSES} onClick={() => setExpanded(v => !v)}>
          {expanded ? t('playerPopup.tradeFit.showFewer') : t('playerPopup.tradeFit.showAll', { count: teams.length })}
        </button>
      )}
    </div>
  )
}

export default function TradeFitSection({ playerId }) {
  const { data } = useFetch(() => getTradeFit(playerId), [playerId])
  return <TradeFitBody data={data} />
}
