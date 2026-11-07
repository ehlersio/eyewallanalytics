// The Team view's Needs tab: the followed team's lineup slots from the
// Worker's /team-needs (eyewall-pipeline team_needs.py), each with its
// players' ratings and where the slot ranks in the league. Phase 1 of the
// trade fit scope. TeamView only renders this when hasTeamNeeds(data).

import React from 'react'
import { useTranslation } from 'react-i18next'
import InfoTip from './InfoTip'
import { formatDateOnly } from '../utils/formatters'
import { fmtRating, groupSlots, isGoalieSlot, needSlots, rankTone } from '../utils/teamNeeds'
import { seasonLabel } from '../utils/tradeFit'

const TONE_COLORS = { need: 'var(--red-bright)', top: 'var(--green)', mid: 'var(--text-muted)' }

const SLOT_CLASSES = 'needs-slot py-2 border-b border-[color:var(--border)] last:border-b-0'
const SLOT_HEAD_CLASSES = 'flex items-baseline justify-between gap-2 flex-wrap'
const SLOT_NAME_CLASSES = 'text-[13px] font-semibold text-[color:var(--text)]'
const SLOT_RANK_CLASSES = 'needs-rank text-[12px] font-semibold tabular-nums'
const SLOT_SUB_CLASSES = 'text-[11px] text-[color:var(--text-muted)] mt-0.5'
const PLAYER_ROW_CLASSES = 'needs-player flex items-baseline justify-between gap-2 text-[12px] py-0.5'
const PLAYER_NAME_CLASSES = 'text-[color:var(--text)] truncate'
const PLAYER_META_CLASSES = 'text-[11px] text-[color:var(--text-dim)] ml-1'
const RATING_CLASSES = 'tabular-nums text-[color:var(--text)] shrink-0'
const UNRATED_CLASSES = 'text-[11px] text-[color:var(--text-dim)] shrink-0'
const GROUP_LABEL_CLASSES = 'sec-label mt-3 mb-1'
const NOTE_CLASSES = 'text-[11px] text-[color:var(--text-muted)]'

function SlotBlock({ slot }) {
  const { t } = useTranslation()
  const goalie = isGoalieSlot(slot.slot)
  const tone = rankTone(slot)
  return (
    <div className={SLOT_CLASSES} data-slot={slot.slot}>
      <div className={SLOT_HEAD_CLASSES}>
        <span className={SLOT_NAME_CLASSES}>{t(`teamView.needs.slots.${slot.slot}`)}</span>
        {tone
          ? (
            <span className={SLOT_RANK_CLASSES} style={{ color: TONE_COLORS[tone] }}>
              {t('teamView.needs.rank', { rank: slot.leagueRank, teams: slot.leagueTeams })}
              {slot.need && <span className="needs-flag"> · {t('teamView.needs.needFlag')}</span>}
            </span>
          )
          : <span className={UNRATED_CLASSES}>{t('teamView.needs.notRanked')}</span>}
      </div>
      <div className={SLOT_SUB_CLASSES}>
        {slot.strength != null
          ? t(goalie ? 'teamView.needs.strengthGoalie' : 'teamView.needs.strength', { value: fmtRating(slot.strength) })
          : t('teamView.needs.tooFewRated', { rated: slot.nRated, count: slot.nPlayers })}
        {slot.rightShots != null && <> · {t('teamView.needs.rightShots', { count: slot.rightShots })}</>}
      </div>
      <div className="mt-1">
        {slot.players.map(p => (
          <div key={p.id} className={PLAYER_ROW_CLASSES} data-player-id={p.id}>
            <span className={PLAYER_NAME_CLASSES}>
              {p.name}
              <span className={PLAYER_META_CLASSES}>
                {[p.pos, !goalie && (p.shoots === 'L' || p.shoots === 'R') ? t(`teamView.needs.shoots${p.shoots}`) : null,
                  p.filled ? t('teamView.needs.filled') : null].filter(Boolean).join(' · ')}
              </span>
            </span>
            {p.rating != null
              ? (
                <span className={RATING_CLASSES}>
                  {fmtRating(p.rating)}
                  {p.ratingBasis === 'last_season' && <span className={PLAYER_META_CLASSES}>{t('teamView.needs.lastSeason')}</span>}
                </span>
              )
              : <span className={UNRATED_CLASSES}>{t('teamView.needs.unrated')}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TeamNeedsTab({ data }) {
  const { t } = useTranslation()
  const groups = groupSlots(data?.slots)
  const needs = needSlots(data?.slots)
  const asOf = data?.generatedAt
    ? formatDateOnly(data.generatedAt, { month: 'short', day: 'numeric', year: 'numeric' })
    : null
  return (
    <div className="card needs-tab" style={{ marginTop: 4 }}>
      <div className="sec-label" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        {t('teamView.needs.title')}
        <InfoTip label={t('teamView.needs.methodLabel')} text={t('teamView.needs.methodTip')} />
      </div>
      <div className={`${NOTE_CLASSES} needs-summary`}>
        {needs.length
          ? t('teamView.needs.summary', { slots: needs.map(s => t(`teamView.needs.slots.${s.slot}`)).join(', ') })
          : t('teamView.needs.summaryNone')}
      </div>
      <div className={`${NOTE_CLASSES} needs-basis`} style={{ marginTop: 2 }}>
        {data?.basis === 'next_season_roster'
          ? t('teamView.needs.basisNextSeason', { season: seasonLabel(data.season) || '—' })
          : t(data?.basis === 'preseason' ? 'teamView.needs.basisPreseason' : 'teamView.needs.basisLastGame')}
        {asOf && <> · {t('teamView.needs.asOf', { date: asOf })}</>}
      </div>
      {groups.map(g => (
        <div key={g.key} className={`needs-group needs-group-${g.key}`}>
          <div className={GROUP_LABEL_CLASSES}>{t(`teamView.needs.groups.${g.key}`)}</div>
          {g.slots.map(s => <SlotBlock key={s.slot} slot={s} />)}
        </div>
      ))}
    </div>
  )
}
