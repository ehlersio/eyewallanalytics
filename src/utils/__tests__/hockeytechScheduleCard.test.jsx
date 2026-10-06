// src/utils/__tests__/hockeytechScheduleCard.test.jsx
// AHL/ECHL schedule cards labelled an upcoming away game "vs" -- "CLT vs
// HER" for Charlotte at Hershey, which reads as a home game (#34). Away
// games now say "Away", like home games say "Home". The games are real:
//   AHL  /ahl/schedule?teamId=319&season=94 (2026-10-05): HER home to
//        team 380 on 2026-10-10 (1029113), HER at ROC on 2026-10-28 (1029211)
//   ECHL HockeyTech modulekit schedule, season 78, team 74 (2026-10-05):
//        ADK home to TRE on 2026-10-17 (25494), ADK at TRE on 2026-10-24
//        (25535), in the Worker's game_log shape

import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('../seasonClient', () => ({
  fetchSeasonsConfig: vi.fn(() => Promise.reject(new Error('offline in tests'))),
}))

import i18n from '../../i18n/index.js'
import { GameCard as AHLGameCard } from '../../views/AHLScheduleView.jsx'
import { GameCard as ECHLGameCard } from '../../views/ECHLScheduleView.jsx'
import schedules from './fixtures/team-season-schedules.json'

const textOf = el => renderToStaticMarkup(el).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const herGame = id => schedules.ahl['319']['94'].find(g => g.game_id === id)

const ADK = 74, TRE = 113
const echlGame = (o) => ({ season_id: 78, home_score: 0, away_score: 0, ...o })
const ADK_HOME = echlGame({ game_id: 25494, game_date: '2026-10-17', home_team_id: ADK, away_team_id: TRE, game_state: '7:00 pm EDT', venue_name: 'Harding Mazzotti Arena' })
const ADK_AWAY = echlGame({ game_id: 25535, game_date: '2026-10-24', home_team_id: TRE, away_team_id: ADK, game_state: '6:00 pm EDT', venue_name: 'CURE Insurance Arena' })

describe.each(['en', 'fr'])('upcoming AHL/ECHL schedule cards (%s)', (lng) => {
  const t = i18n.getFixedT(lng)
  const home = t('scheduleView.resultCard.home')
  const away = t('scheduleView.resultCard.away')

  it('AHL: away reads Away, home reads Home, never "vs"', async () => {
    await i18n.changeLanguage(lng)
    const awayText = textOf(<AHLGameCard game={herGame(1029211)} teamId={319} abbr="HER" onClick={() => {}} />)
    const homeText = textOf(<AHLGameCard game={herGame(1029113)} teamId={319} abbr="HER" onClick={() => {}} />)
    expect(awayText).toContain(`HER ${away} ROC`)
    expect(homeText).toContain(`HER ${home}`)
    expect(awayText).not.toMatch(/\bvs\b/)
  })

  it('ECHL: away reads Away, home reads Home, never "vs"', async () => {
    await i18n.changeLanguage(lng)
    const awayText = textOf(<ECHLGameCard game={ADK_AWAY} teamId={ADK} abbr="ADK" onClick={() => {}} />)
    const homeText = textOf(<ECHLGameCard game={ADK_HOME} teamId={ADK} abbr="ADK" onClick={() => {}} />)
    expect(awayText).toContain(`ADK ${away} TRE`)
    expect(homeText).toContain(`ADK ${home} TRE`)
    expect(awayText).not.toMatch(/\bvs\b/)
  })
})
