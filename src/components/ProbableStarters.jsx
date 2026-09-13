import React from 'react'
import { useTranslation } from 'react-i18next'
import { useFetch } from '../hooks/useFetch'
import { getProbableStarters, TEAM_CONFIG } from '../utils/nhlApi'
import { teamTextColor } from '../utils/teamConfig'
import { formatDate } from '../utils/formatters'
import { parseLocalDate } from '../utils/injuryDetails'
import { SKELETON_CLASSES } from '../utils/skeletonClasses'
import InfoTip from './InfoTip'
import TeamLogo from './TeamLogo'

// Probable starting goalies for one upcoming NHL regular-season game, from
// the Worker's /probable-starters route (eyewall-pipeline's nightly
// starting_goalie.py: a model of each team's own pattern -- share of recent
// starts, who started last game, back-to-backs, rest -- since the NHL
// announces no starters ahead of time; picks the starter ~73-75% of the
// time in its backtest). Rows are posted once the game is within 2 days and
// updated each morning; before that the block says so. Preseason and
// playoff games aren't modeled, and finished games don't need it -- the
// block renders nothing for those. Plain probabilities, no betting framing.
const DONE_STATES = ['OFF', 'FINAL', 'F']
const pct = p => `${Math.round((p || 0) * 100)}%`
const CHIP_CLASSES = 'md-starter-chip text-[9px] font-semibold rounded-[3px] py-px px-1 text-[color:var(--text-muted)] bg-[var(--bg3)]'

function StarterColumn({ abbr, goalies }) {
  const { t } = useTranslation()
  const [top, ...others] = goalies
  const f = top?.factors || {}
  const chips = [
    f.started_last && t('probableStarters.startedLast'),
    f.back_to_back && t('probableStarters.backToBack'),
    f.injury_status === 'day-to-day' && t('probableStarters.dayToDay'),
  ].filter(Boolean)

  return (
    <div className="md-starters-team min-w-0" data-team={abbr}>
      {/* teamTextColor(): the WCAG AA displayColor on dark (brand color on
          light) -- not nhlApi.js's raw TEAM_COLORS, where FLA/WPG's navy is
          unreadable on the dark card. */}
      <div
        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.06em] mb-1"
        style={{ color: teamTextColor(abbr) ?? 'var(--text-muted)' }}
      >
        <TeamLogo abbr={abbr} size={14} color={teamTextColor(abbr) ?? undefined} />
        {abbr}
      </div>
      {!top ? (
        <div className="text-[11px] text-[color:var(--text-dim)]">{t('probableStarters.notYet')}</div>
      ) : (
        <>
          <div className="md-starter-top flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-semibold text-[color:var(--text)] truncate">{top.goalie_name}</span>
            <span className="font-[family-name:var(--font-mono)] text-[15px] font-bold text-[color:var(--text)]">{pct(top.start_prob)}</span>
          </div>
          {f.share_last10 != null && (
            <div className="text-[10px] text-[color:var(--text-dim)]">{t('probableStarters.share', { pct: pct(f.share_last10) })}</div>
          )}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {chips.map(c => <span key={c} className={CHIP_CLASSES}>{c}</span>)}
            </div>
          )}
          {others.map(g => (
            <div key={g.goalie_id} className="md-starter-other flex justify-between gap-2 text-[11px] text-[color:var(--text-muted)] mt-1">
              <span className="truncate">{g.goalie_name}</span>
              <span className="font-[family-name:var(--font-mono)]">{pct(g.start_prob)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

export default function ProbableStarters({ game }) {
  const { t } = useTranslation()
  const gameId = game?.id
  const modeled = !!gameId && game.gameType === 2 && !DONE_STATES.includes(game.gameState)
  const { data, loading } = useFetch(
    () => (modeled ? getProbableStarters(gameId) : Promise.resolve(null)),
    [gameId, modeled],
  )
  if (!modeled) return null

  // The selected team's column first, then the opponent's.
  const sides = [game.homeTeam?.abbrev, game.awayTeam?.abbrev]
    .filter(Boolean)
    .sort((a, b) => (b === TEAM_CONFIG.abbr) - (a === TEAM_CONFIG.abbr))
  const teams = data?.teams || {}
  const posted = sides.some(s => teams[s]?.length)
  const runDate = parseLocalDate(data?.runDate)

  return (
    <div className="md-starters mb-3.5">
      <div className="md-starters-label flex items-center gap-1 text-[11px] text-[color:var(--text-muted)] mb-1.5">
        <span>{t('probableStarters.title')}</span>
        <InfoTip label={t('probableStarters.title')} text={t('probableStarters.infoTip')} position="above" />
      </div>
      {loading ? (
        <div className={SKELETON_CLASSES} style={{ height: 36, width: '100%' }} />
      ) : !data || data.unavailable ? (
        <div className="text-[11px] text-[color:var(--text-dim)]">{t('probableStarters.unavailable')}</div>
      ) : !posted ? (
        <div className="md-starters-not-yet text-[11px] text-[color:var(--text-dim)]">{t('probableStarters.notYet')}</div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {sides.map(abbr => <StarterColumn key={abbr} abbr={abbr} goalies={teams[abbr] || []} />)}
        </div>
      )}
      {posted && runDate && (
        <div className="text-[9px] text-[color:var(--text-dim)] mt-1.5">{t('probableStarters.updated', { date: formatDate(runDate) })}</div>
      )}
    </div>
  )
}
