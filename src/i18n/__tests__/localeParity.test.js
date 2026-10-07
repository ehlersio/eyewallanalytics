// src/i18n/__tests__/localeParity.test.js
// en.json and fr.json carry exactly the same keys (a French key missing
// falls back to English mid-sentence; an extra one is dead), and the AHL
// and ECHL share one set of hockeyTech* namespaces: the per-league
// ahl*/echl* copies, identical but for the league's name, were merged
// with {{league}}/{{ofLeague}} interpolation (Phase 3 A4).

import { describe, it, expect } from 'vitest'
import en from '../locales/en.json'
import fr from '../locales/fr.json'
import i18n from '../index.js'
import { leagueNameVars } from '../../utils/hockeyTechI18n.js'

function flatKeys(o, prefix = '') {
  return Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`])
}

describe('locale key parity', () => {
  it('en and fr have the same keys', () => {
    expect(flatKeys(fr).sort()).toEqual(flatKeys(en).sort())
  })

  it('no per-league AHL/ECHL namespaces remain', () => {
    const perLeague = Object.keys(en).filter(k => /^(ahl|echl)[A-Z]/.test(k))
    expect(perLeague).toEqual([])
    expect(Object.keys(en).filter(k => k.startsWith('hockeyTech')).sort()).toEqual([
      'hockeyTechGameEvents', 'hockeyTechLeagueView', 'hockeyTechLeagues', 'hockeyTechPlayerPopup',
      'hockeyTechPlayersView', 'hockeyTechScheduleView', 'hockeyTechShotMapView', 'hockeyTechTeamView',
    ])
  })
})

describe('hockeyTech* strings name the right league', () => {
  const cases = [
    ['en', 'ahl',  'No AHL team selected.',  'Source: HockeyTech / AHL'],
    ['en', 'echl', 'No ECHL team selected.', 'Source: HockeyTech / ECHL'],
    ['fr', 'ahl',  'Aucune équipe de la LAH sélectionnée.', 'Source : HockeyTech / LAH'],
    ['fr', 'echl', "Aucune équipe de l'ECHL sélectionnée.", 'Source : HockeyTech / ECHL'],
  ]
  it.each(cases)('%s %s', (lng, key, noTeam, source) => {
    const t = i18n.getFixedT(lng)
    const vars = leagueNameVars(t, { key })
    expect(t('hockeyTechPlayersView.noTeamSelected', vars)).toBe(noTeam)
    expect(t('hockeyTechTeamView.noTeamSelected', vars)).toBe(noTeam)
    expect(t('hockeyTechPlayersView.footerHintSource', vars)).toBe(source)
    expect(t('hockeyTechPlayerPopup.recentForm.legendGoalie', vars)).not.toMatch(/\{\{|AHL.*ECHL|ECHL.*AHL/)
    expect(t('hockeyTechPlayerPopup.heatMap.goalieUnavailableSub', vars)).toContain(vars.league)
  })

  it('the English strings read as before the merge', () => {
    const t = i18n.getFixedT('en')
    expect(t('hockeyTechPlayerPopup.recentForm.legendGoalie', leagueNameVars(t, { key: 'ahl' })))
      .toBe("W = win · L = loss (AHL's data doesn't distinguish OT/shootout losses)")
    expect(t('hockeyTechPlayerPopup.heatMap.goalieUnavailableSub', leagueNameVars(t, { key: 'echl' })))
      .toBe("ECHL's play-by-play doesn't track which goalie was in net for each goal, so a heat map here would under-count goals allowed.")
  })
})
