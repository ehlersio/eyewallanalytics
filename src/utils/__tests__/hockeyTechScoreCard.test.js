// The AHL/ECHL Shot Map score card's numbers (utils/hockeyTechScoreCard.js),
// against real saved /live payloads (AHL 1029081 CLT 5-2 at HER, ECHL 24296
// REA at TR 6-5 in overtime) and schedule/today rows shaped like the
// Worker's.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  scoreCardFromToday, scoreCardFromScheduleRow, scoreCardFromLive, endedInFromLiveEvents,
} from '../hockeyTechScoreCard';

const fixture = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${rel}`, import.meta.url)), 'utf8'));
const AHL_1029081 = fixture('ahl-game-1029081/live.json');
const ECHL_24296 = fixture('game-events-replay/echl-24296-live.json');

describe('scoreCardFromToday', () => {
  const row = { gameId: 777, homeTeamId: 319, awayTeamId: 384, homeTeamCode: 'HER', awayTeamCode: 'CLT', homeScore: 2, awayScore: 1, status: 'live' };

  it('reads a live game from the home side', () => {
    expect(scoreCardFromToday(row, 319)).toEqual({
      state: 'live', isHome: true, myScore: 2, oppScore: 1, oppId: 384, oppCode: 'CLT', endedIn: null, won: null,
    });
  });

  it('reads a live game from the away side', () => {
    expect(scoreCardFromToday(row, 384)).toMatchObject({ isHome: false, myScore: 1, oppScore: 2, oppId: 319, oppCode: 'HER' });
  });

  it('is null for a game that is not live, or a team not in it', () => {
    expect(scoreCardFromToday({ ...row, status: 'pre' }, 319)).toBeNull();
    expect(scoreCardFromToday(row, 999)).toBeNull();
    expect(scoreCardFromToday(null, 319)).toBeNull();
    expect(scoreCardFromToday(row, null)).toBeNull();
  });
});

describe('scoreCardFromScheduleRow', () => {
  const row = { game_id: 1, home_team_id: 74, away_team_id: 113, home_score: 3, away_score: 4, game_state: 'Final', ended_in: 'SO' };

  it('reads a final with its ended_in', () => {
    expect(scoreCardFromScheduleRow(row, 74)).toEqual({
      state: 'final', isHome: true, myScore: 3, oppScore: 4, oppId: 113, oppCode: null, endedIn: 'SO', won: false,
    });
    expect(scoreCardFromScheduleRow(row, 113)).toMatchObject({ isHome: false, myScore: 4, oppScore: 3, won: true });
  });

  it('reads a regulation final as no suffix', () => {
    expect(scoreCardFromScheduleRow({ ...row, ended_in: null }, 74).endedIn).toBeNull();
  });

  it('is null for an unplayed game, a team not in it, or missing scores', () => {
    expect(scoreCardFromScheduleRow({ ...row, game_state: '7:00 pm EDT' }, 74)).toBeNull();
    expect(scoreCardFromScheduleRow(row, 1)).toBeNull();
    expect(scoreCardFromScheduleRow({ ...row, home_score: null }, 74)).toBeNull();
  });
});

describe('scoreCardFromLive', () => {
  it('reads a regulation final from /live', () => {
    expect(scoreCardFromLive(AHL_1029081, 319)).toEqual({
      state: 'final', isHome: true, myScore: 2, oppScore: 5, oppId: 384, oppCode: null, endedIn: null, won: false,
    });
    expect(scoreCardFromLive(AHL_1029081, 384)).toMatchObject({ isHome: false, myScore: 5, oppScore: 2, won: true });
  });

  it('reads an overtime final from its events', () => {
    expect(scoreCardFromLive(ECHL_24296, 99)).toMatchObject({ myScore: 6, oppScore: 5, endedIn: 'OT', won: true });
  });

  it('is null until the game is final, or for a team not in it', () => {
    expect(scoreCardFromLive({ ...AHL_1029081, gameStatus: 'live' }, 319)).toBeNull();
    expect(scoreCardFromLive(AHL_1029081, 1)).toBeNull();
    expect(scoreCardFromLive(null, 319)).toBeNull();
  });
});

describe('endedInFromLiveEvents', () => {
  it('reads a shootout attempt as SO, before any overtime event', () => {
    expect(endedInFromLiveEvents([{ eventType: 'shot', period: 4 }, { eventType: 'shootout', period: 7 }])).toBe('SO');
  });

  it('reads an event past the 3rd period as OT', () => {
    expect(endedInFromLiveEvents([{ eventType: 'goal', period: 4 }])).toBe('OT');
  });

  it('reads regulation, or no events, as null', () => {
    expect(endedInFromLiveEvents([{ eventType: 'goal', period: 3 }])).toBeNull();
    expect(endedInFromLiveEvents([])).toBeNull();
    expect(endedInFromLiveEvents(undefined)).toBeNull();
  });
});
