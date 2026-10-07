// src/utils/__tests__/leagueGameTeam.test.jsx
// The AHL/ECHL game view watches from the league's followed team, or from
// a guest team inside HockeyTechGuestGameView's provider -- never from the
// NHL favorite the provider's default holds (GameTeamContext.jsx).

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { GameTeamProvider, useLeagueGameTeam } from '../GameTeamContext'

const league = { key: 'ahl', team: { abbr: 'HER', teamId: 319 } }
const TEX = { abbr: 'TEX', teamId: 380 }

function Side() {
  const { team, isGuest, guestGameId } = useLeagueGameTeam(league)
  return `${team?.abbr}|${isGuest}|${guestGameId}`
}

describe('useLeagueGameTeam', () => {
  it('is the league’s followed team outside a provider', () => {
    expect(renderToStaticMarkup(<Side />)).toBe('HER|false|null')
  })

  it('is the guest team, pinned to its game, inside one', () => {
    const html = renderToStaticMarkup(
      <GameTeamProvider team={TEX} gameId={1029113}><Side /></GameTeamProvider>
    )
    expect(html).toBe('TEX|true|1029113')
  })
})
