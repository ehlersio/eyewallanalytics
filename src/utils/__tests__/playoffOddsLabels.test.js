// src/utils/__tests__/playoffOddsLabels.test.js
// The Playoff odds card's "Next game day" rows show, for each game, the
// viewed team's playoff odds under each result (the Worker's ifAwayWins /
// ifHomeWins). They used to read "WPG win: 71%  PIT win: 70%", which looks
// like each side's chance of winning the game (summing to ~141%). The
// labels must say whose odds these are and that each one is "if X wins".

import { describe, it, expect, afterEach } from 'vitest'
import i18n from '../../i18n'

afterEach(async () => {
  await i18n.changeLanguage('en')
})

describe('playoffOdds next-game labels', () => {
  it('names the team whose odds they are, and each result, in English', async () => {
    await i18n.changeLanguage('en')
    expect(i18n.t('playoffOdds.nextHint', { team: 'CAR' })).toBe("CAR's playoff odds under each result")
    expect(i18n.t('playoffOdds.ifWin', { team: 'WPG', pct: '71%' })).toBe('If WPG wins: 71%')
  })

  it('does the same in French', async () => {
    await i18n.changeLanguage('fr')
    expect(i18n.t('playoffOdds.nextHint', { team: 'CAR' })).toBe('Chances de CAR de participer aux séries selon chaque résultat')
    expect(i18n.t('playoffOdds.ifWin', { team: 'WPG', pct: '71 %' })).toBe('Si WPG gagne : 71 %')
  })
})
