import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import TeamLogo from './TeamLogo'
import { getAHLTeamConfig } from '../utils/ahlConfig'
import { getECHLTeamConfig } from '../utils/echlConfig'

// Presentational only — takes a `history` record shaped like teamHistory.js's
// TEAM_HISTORY[league][abbr] plus `league`/`teamAbbr` for the affiliate logos.
// Deliberately league-agnostic (no NHL/PWHL-specific imports) so later phases
// can reuse this from PWHLTeamView.jsx/AHLTeamView.jsx/ECHLTeamView.jsx
// without duplicating the section markup — only teamHistory.js grows per phase.

const SECTION_GRID_CLASSES = 'flex flex-col gap-[10px]'
const SEC_LABEL_CLASSES = 'sec-label'
const ROW_CLASSES = 'flex items-center justify-between py-[6px] border-b-[0.5px] border-[rgba(255,255,255,0.04)] last:border-b-0 text-[12px]'
const ROW_LABEL_CLASSES = 'text-[color:var(--text-muted)]'
const ROW_VAL_CLASSES = 'text-[color:var(--text)] font-medium text-right'
const TIMELINE_LIST_CLASSES = 'flex flex-col gap-[6px] mt-2'
const TIMELINE_ITEM_CLASSES = 'flex items-baseline gap-2 text-[12px]'
const TIMELINE_YEAR_CLASSES = 'font-[family-name:var(--font-mono)] font-semibold text-[color:var(--text-dim)] min-w-[38px]'
const TIMELINE_TEXT_CLASSES = 'text-[color:var(--text-muted)]'
const ARENA_PHOTO_CLASSES = 'w-full h-[160px] object-cover rounded-[var(--radius-sm)] mb-[10px]'
const ARENA_ATTR_CLASSES = 'text-[9px] text-[color:var(--text-dim)] opacity-60 mb-2'
const CUP_LIST_CLASSES = 'flex flex-wrap gap-[8px] mt-1'
const CUP_CHIP_CLASSES = 'flex items-center gap-[6px] text-[12px] font-semibold text-[color:var(--amber)] bg-[rgba(240,160,48,0.1)] border-[0.5px] border-[rgba(240,160,48,0.3)] rounded-[20px] py-[4px] px-[10px]'
const NUM_CHIP_LIST_CLASSES = 'flex flex-wrap gap-[8px] mt-1'
const NUM_CHIP_CLASSES = 'flex items-center gap-[6px] text-[12px] bg-[var(--bg3)] rounded-[var(--radius-sm)] py-[5px] px-[9px]'
const NUM_BADGE_CLASSES = 'font-[family-name:var(--font-display)] font-bold text-[color:var(--text)]'
const ALUMNI_LIST_CLASSES = 'flex flex-wrap gap-[6px] mt-1'
const ALUMNI_CHIP_CLASSES = 'text-[12px] text-[color:var(--text-muted)] bg-[var(--bg3)] rounded-[20px] py-[4px] px-[10px]'
const RECORD_LIST_CLASSES = 'flex flex-col gap-[8px] mt-1'
const RECORD_ITEM_CLASSES = 'flex items-baseline justify-between text-[12px]'
const RECORD_VAL_CLASSES = 'font-[family-name:var(--font-display)] font-bold text-[color:var(--text)] text-[14px]'
const AFFILIATE_ROW_CLASSES = 'flex items-center gap-[10px] py-[6px]'
const AFFILIATE_LEAGUE_TAG_CLASSES = 'text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-dim)] min-w-[36px]'
const AFFILIATE_NAME_CLASSES = 'text-[12px] text-[color:var(--text)] font-medium'
const FACTS_LIST_CLASSES = 'flex flex-col gap-[8px] mt-1'
const FACT_ITEM_CLASSES = 'flex gap-[8px] text-[12px] text-[color:var(--text-muted)] leading-[1.5]'
const FACT_BULLET_CLASSES = 'text-[color:var(--text-dim)] flex-shrink-0'
const CURRENT_INFO_CLASSES = 'text-[10px] text-[color:var(--text-dim)] mt-3 opacity-70'

// Hand-entered Wikimedia URLs in teamHistory.js can go stale (renamed/deleted
// file) -- degrade to nothing rather than a broken-image icon.
function ArenaPhoto({ photo, alt }) {
  const [errored, setErrored] = useState(false)
  if (!photo || errored) return null
  return (
    <>
      <img src={photo.url} alt={alt} className={ARENA_PHOTO_CLASSES} loading="lazy" onError={() => setErrored(true)} />
      <div className={ARENA_ATTR_CLASSES}>{photo.attribution}</div>
    </>
  )
}

export default function TeamHistorySections({ history, league: _league = 'nhl' }) {
  const { t } = useTranslation()

  if (!history) {
    return (
      <div className="card empty-state">
        <div className="empty-title" style={{ marginBottom: 4 }}>{t('teamView.history.emptyTitle')}</div>
        <div className="empty-sub">{t('teamView.history.emptySub')}</div>
      </div>
    )
  }

  const { founded, arena, championships, retiredNumbers, notableAlumni, records, affiliates, facts, currentInfo } = history

  return (
    <div className={SECTION_GRID_CLASSES}>
      {founded && (
        <div className="card">
          <div className={SEC_LABEL_CLASSES}>{t('teamView.history.founded')}</div>
          <div className={ROW_CLASSES}>
            <span className={ROW_LABEL_CLASSES}>{t('teamView.history.foundedAs')}</span>
            <span className={ROW_VAL_CLASSES}>{founded.asFranchise} · {founded.year}</span>
          </div>
          {founded.joinedNHL && (
            <div className={ROW_CLASSES}>
              <span className={ROW_LABEL_CLASSES}>{t('teamView.history.joinedNHL')}</span>
              <span className={ROW_VAL_CLASSES}>{founded.joinedNHL}</span>
            </div>
          )}
          {founded.relocations?.length > 0 && (
            <div className={TIMELINE_LIST_CLASSES}>
              {founded.relocations.map((r, i) => (
                <div key={i} className={TIMELINE_ITEM_CLASSES}>
                  <span className={TIMELINE_YEAR_CLASSES}>{r.year}</span>
                  <span className={TIMELINE_TEXT_CLASSES}>
                    {t('teamView.history.relocated', { from: r.from, to: r.to, name: r.renamedTo })}
                    {r.note ? ` (${r.note})` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {arena && (
        <div className="card">
          <div className={SEC_LABEL_CLASSES}>{t('teamView.history.arena')}</div>
          <ArenaPhoto photo={arena.photo} alt={arena.name} />
          <div className={ROW_CLASSES}>
            <span className={ROW_LABEL_CLASSES}>{t('teamView.history.name')}</span>
            <span className={ROW_VAL_CLASSES}>{arena.name}</span>
          </div>
          <div className={ROW_CLASSES}>
            <span className={ROW_LABEL_CLASSES}>{t('teamView.history.location')}</span>
            <span className={ROW_VAL_CLASSES}>{arena.city}</span>
          </div>
          <div className={ROW_CLASSES}>
            <span className={ROW_LABEL_CLASSES}>{t('teamView.history.capacity')}</span>
            <span className={ROW_VAL_CLASSES}>{arena.capacity?.toLocaleString()}</span>
          </div>
          <div className={ROW_CLASSES}>
            <span className={ROW_LABEL_CLASSES}>{t('teamView.history.opened')}</span>
            <span className={ROW_VAL_CLASSES}>{arena.opened}</span>
          </div>
          {arena.formerNames?.length > 0 && (
            <div className={TIMELINE_LIST_CLASSES}>
              {arena.formerNames.map((f, i) => (
                <div key={i} className={TIMELINE_ITEM_CLASSES}>
                  <span className={TIMELINE_YEAR_CLASSES}>{f.years}</span>
                  <span className={TIMELINE_TEXT_CLASSES}>{f.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {championships?.length > 0 && (
        <div className="card">
          <div className={SEC_LABEL_CLASSES}>{t('teamView.history.championships')}</div>
          <div className={CUP_LIST_CLASSES}>
            {championships.flatMap(c => c.years.map(y => (
              <span key={`${c.title}-${y}`} className={CUP_CHIP_CLASSES}>🏆 {c.title} {y}</span>
            )))}
          </div>
        </div>
      )}

      {retiredNumbers?.length > 0 && (
        <div className="card">
          <div className={SEC_LABEL_CLASSES}>{t('teamView.history.retiredNumbers')}</div>
          <div className={NUM_CHIP_LIST_CLASSES}>
            {retiredNumbers.map(n => (
              <span key={n.number} className={NUM_CHIP_CLASSES}>
                <span className={NUM_BADGE_CLASSES}>#{n.number}</span> {n.player}
              </span>
            ))}
          </div>
        </div>
      )}

      {notableAlumni?.length > 0 && (
        <div className="card">
          <div className={SEC_LABEL_CLASSES}>{t('teamView.history.notableAlumni')}</div>
          <div className={ALUMNI_LIST_CLASSES}>
            {notableAlumni.map(name => (
              <span key={name} className={ALUMNI_CHIP_CLASSES}>{name}</span>
            ))}
          </div>
        </div>
      )}

      {records?.length > 0 && (
        <div className="card">
          <div className={SEC_LABEL_CLASSES}>{t('teamView.history.records')}</div>
          <div className={RECORD_LIST_CLASSES}>
            {records.map((r, i) => (
              <div key={i} className={RECORD_ITEM_CLASSES}>
                <span className={ROW_LABEL_CLASSES}>{r.label}</span>
                <span className={RECORD_VAL_CLASSES}>{r.value} <span className={ARENA_ATTR_CLASSES} style={{ display: 'inline' }}>({r.season})</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {affiliates && (affiliates.ahl || affiliates.echl) && (
        <div className="card">
          <div className={SEC_LABEL_CLASSES}>{t('teamView.history.affiliates')}</div>
          {affiliates.ahl && (
            <div className={AFFILIATE_ROW_CLASSES}>
              <span className={AFFILIATE_LEAGUE_TAG_CLASSES}>AHL</span>
              <TeamLogo abbr={affiliates.ahl} sport="ahl" size={20} />
              <span className={AFFILIATE_NAME_CLASSES}>{getAHLTeamConfig(affiliates.ahl)?.displayName || affiliates.ahl}</span>
            </div>
          )}
          {affiliates.echl && (
            <div className={AFFILIATE_ROW_CLASSES}>
              <span className={AFFILIATE_LEAGUE_TAG_CLASSES}>ECHL</span>
              <TeamLogo abbr={affiliates.echl} sport="echl" size={20} />
              <span className={AFFILIATE_NAME_CLASSES}>{getECHLTeamConfig(affiliates.echl)?.displayName || affiliates.echl}</span>
            </div>
          )}
        </div>
      )}

      {facts?.length > 0 && (
        <div className="card">
          <div className={SEC_LABEL_CLASSES}>{t('teamView.history.facts')}</div>
          <div className={FACTS_LIST_CLASSES}>
            {facts.map((f, i) => (
              <div key={i} className={FACT_ITEM_CLASSES}>
                <span className={FACT_BULLET_CLASSES}>•</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentInfo && (
        <div className="card">
          <div className={SEC_LABEL_CLASSES}>{t('teamView.history.currentInfo')}</div>
          {currentInfo.owner && (
            <div className={ROW_CLASSES}>
              <span className={ROW_LABEL_CLASSES}>{t('teamView.history.owner')}</span>
              <span className={ROW_VAL_CLASSES}>{currentInfo.owner}</span>
            </div>
          )}
          {currentInfo.headCoach && (
            <div className={ROW_CLASSES}>
              <span className={ROW_LABEL_CLASSES}>{t('teamView.history.headCoach')}</span>
              <span className={ROW_VAL_CLASSES}>{currentInfo.headCoach}</span>
            </div>
          )}
          <div className={CURRENT_INFO_CLASSES}>{t('teamView.history.lastVerified', { date: currentInfo.lastVerified })}</div>
        </div>
      )}
    </div>
  )
}
