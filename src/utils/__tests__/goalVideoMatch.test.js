// src/utils/__tests__/goalVideoMatch.test.js
// Pairing a game's goals across the NHL's two feeds: the play-by-play (what
// the shot map and the period summary are built from) and `landing` (where
// the video clip, assists and headshot live).
//
// Both feeds give a goal the same eventId -- checked against real games back
// to 2021. They used to be paired by position instead (period + order), which
// holds only while landing lists a period's goals in exactly the play-by-play's
// order and neither feed omits one. When that slipped, a goal got another
// goal's video, scorer and assists.

import { describe, it, expect } from 'vitest'
import { attachGoalVideos } from '../nhlApi.js'
import { landingGoalPicker } from '../../hooks/usePeriodSummary.js'

const goal = (id, period, extra = {}) => ({ id, type: 'goal', period, ...extra })
const landingGoal = (eventId, clip) => ({ eventId, discreteClip: clip })
const landing = (periods) => ({
  summary: { scoring: periods.map(([number, goals]) => ({ periodDescriptor: { number }, goals })) },
})

const clipOf = (e) => (e.videoUrl ? e.videoUrl.match(/videoId=([^&]+)/)[1] : null)

describe('attachGoalVideos', () => {
  it('gives each goal its own clip', () => {
    const events = [goal(59, 1), goal(173, 2), goal(975, 3)]
    const data = landing([[1, [landingGoal(59, 'clip-a')]], [2, [landingGoal(173, 'clip-b')]], [3, [landingGoal(975, 'clip-c')]]])
    expect(attachGoalVideos(events, data).map(clipOf)).toEqual(['clip-a', 'clip-b', 'clip-c'])
  })

  it('is right even when landing lists a period’s goals in a different order', () => {
    const events = [goal(59, 1), goal(65, 1)]
    const data = landing([[1, [landingGoal(65, 'clip-second'), landingGoal(59, 'clip-first')]]])
    expect(attachGoalVideos(events, data).map(clipOf)).toEqual(['clip-first', 'clip-second'])
  })

  it('is right when landing is missing a goal the play-by-play has', () => {
    const events = [goal(59, 1), goal(65, 1), goal(173, 1)]
    const data = landing([[1, [landingGoal(59, 'clip-a'), landingGoal(173, 'clip-c')]]])
    expect(attachGoalVideos(events, data).map(clipOf)).toEqual(['clip-a', null, 'clip-c'])
  })

  it('leaves non-goals and goals without a clip untouched', () => {
    const shot = { id: 60, type: 'shot-on-goal', period: 1 }
    const events = [shot, goal(59, 1)]
    const data = landing([[1, [landingGoal(59, null), landingGoal(60, 'not-this-shots-clip')]]])
    const out = attachGoalVideos(events, data)
    expect(out[0]).toBe(shot)
    expect(out[1].videoUrl).toBeUndefined()
  })

  it('passes everything through when there is no landing data at all', () => {
    const events = [goal(59, 1)]
    expect(attachGoalVideos(events, null)).toBe(events)
    expect(attachGoalVideos(events, { summary: { scoring: [] } })).toBe(events)
    expect(attachGoalVideos(events, landing([[1, []]]))).toBe(events)
  })

  it('builds a playable embed URL', () => {
    const [out] = attachGoalVideos([goal(59, 1)], landing([[1, [landingGoal(59, '6405343988112')]]]))
    expect(out.videoUrl).toContain('6405343988112')
    expect(out.videoUrl).toMatch(/^https:\/\/players\.brightcove\.net\//)
  })
})

// The period / game summary card pairs the same two feeds for a goal's
// scorer, assists, strength, headshot and clip.
describe('landingGoalPicker', () => {
  const pbpGoals = [{ eventId: 59 }, { eventId: 65 }]

  it('matches on eventId, whatever order landing is in', () => {
    const pick = landingGoalPicker([{ eventId: 65, name: 'Second' }, { eventId: 59, name: 'First' }])
    expect(pbpGoals.map((g, i) => pick(g, i).name)).toEqual(['First', 'Second'])
  })

  it('gives nothing for a goal landing does not have, rather than the wrong one', () => {
    const pick = landingGoalPicker([{ eventId: 59, name: 'First' }])
    expect(pick(pbpGoals[1], 1)).toBeUndefined()
  })

  it('falls back to position only when landing carries no ids at all', () => {
    const pick = landingGoalPicker([{ name: 'First' }, { name: 'Second' }])
    expect(pbpGoals.map((g, i) => pick(g, i).name)).toEqual(['First', 'Second'])
  })

  it('survives empty or missing landing goals', () => {
    expect(landingGoalPicker([])(pbpGoals[0], 0)).toBeUndefined()
    expect(landingGoalPicker(null)(pbpGoals[0], 0)).toBeUndefined()
    expect(landingGoalPicker([{ eventId: 59 }])(undefined, 0)).toEqual({ eventId: 59 })
  })
})
