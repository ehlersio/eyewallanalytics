// src/utils/__tests__/teamConfig.test.js
// The ids the game view compares play-by-play against (eventOwnerTeamId)
// and the stats endpoints filter on (franchiseId).

import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ALL_TEAMS, getTeamByAbbr, teamIdInGame } from '../teamConfig.js'
import { GameTeamProvider, GameTeamIdProvider, useGameTeam } from '../GameTeamContext.jsx'

const UTA = getTeamByAbbr('UTA')

describe('ALL_TEAMS ids', () => {
  it('gives every team its own team and franchise id', () => {
    expect(new Set(ALL_TEAMS.map(t => t.teamId)).size).toBe(ALL_TEAMS.length)
    expect(new Set(ALL_TEAMS.map(t => t.franchiseId)).size).toBe(ALL_TEAMS.length)
  })

  it('has Utah on the Mammoth ids, not Utah HC (59) or Arizona (franchise 28)', () => {
    expect(getTeamByAbbr('UTA')).toMatchObject({ teamId: 68, franchiseId: 40 })
  })
})

// Shaped like the NHL's play-by-play: 2024-25 UTA @ ANA, when Utah was 59.
const utahHC = { id: 2024020085, homeTeam: { id: 24, abbrev: 'ANA' }, awayTeam: { id: 59, abbrev: 'UTA' } }

describe('teamIdInGame', () => {
  it('takes the id a 2024-25 Utah game uses, home or away', () => {
    expect(teamIdInGame(UTA, utahHC)).toBe(59)
    expect(teamIdInGame(UTA, { homeTeam: { id: 59, abbrev: 'UTA' }, awayTeam: { id: 3, abbrev: 'NYR' } })).toBe(59)
  })

  it('is the current id for a current game', () => {
    expect(teamIdInGame(UTA, { homeTeam: { id: 3, abbrev: 'NYR' }, awayTeam: { id: 68, abbrev: 'UTA' } })).toBe(68)
  })

  it('falls back to teamId when the game is missing or isn\'t the team\'s', () => {
    expect(teamIdInGame(UTA, null)).toBe(68)
    expect(teamIdInGame(UTA, { homeTeam: { id: 12, abbrev: 'CAR' }, awayTeam: { id: 6, abbrev: 'BOS' } })).toBe(68)
  })
})

describe('GameTeamIdProvider', () => {
  const Probe = () => {
    const { team, isGuest, guestGameId } = useGameTeam()
    return h('i', null, `${team.abbr}:${team.teamId}:${isGuest}:${guestGameId}`)
  }

  it('swaps only the team id, keeping the guest view around it', () => {
    const html = renderToStaticMarkup(
      h(GameTeamProvider, { team: UTA, gameId: utahHC.id },
        h(GameTeamIdProvider, { teamId: 59 }, h(Probe)))
    )
    expect(html).toBe(`<i>UTA:59:true:${utahHC.id}</i>`)
  })

  it('leaves the team alone when the ids already agree', () => {
    const html = renderToStaticMarkup(
      h(GameTeamProvider, { team: UTA, gameId: 1 }, h(GameTeamIdProvider, { teamId: 68 }, h(Probe)))
    )
    expect(html).toBe('<i>UTA:68:true:1</i>')
  })
})
