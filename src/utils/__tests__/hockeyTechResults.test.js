// AHL/ECHL results with OT/SO losses split out (audit 2026-10-05 #16).
// fixtures/ahl-tex-2026-27/schedule.json is the Worker's real
// /ahl/schedule?teamId=380&season=94 on 2026-10-05: Texas opened with a
// shootout win (1029078, 4-3) and a shootout loss (1029088, 3-4) at home.
import { describe, it, expect } from 'vitest';
import { gameResultFor, currentStreak, pointsPct, streakColor } from '../hockeyTechResults';
import texSchedule from './fixtures/ahl-tex-2026-27/schedule.json';

const TEX = 380;
const finals = texSchedule.filter(g => g.game_state === 'Final').sort((a, b) => a.game_id - b.game_id);

describe('gameResultFor', () => {
  it('reads TEX\'s opening weekend as a shootout win then a shootout loss', () => {
    expect(finals.map(g => g.game_id)).toEqual([1029078, 1029088]);
    expect(finals.map(g => gameResultFor(g, TEX))).toEqual([
      { won: true,  result: 'W',   endedIn: 'SO', my: 4, op: 3 },
      { won: false, result: 'OTL', endedIn: 'SO', my: 3, op: 4 },
    ]);
  });

  it('a regulation loss stays a loss', () => {
    expect(gameResultFor({ home_team_id: 1, away_team_id: 2, home_score: 2, away_score: 5, ended_in: null }, 1).result).toBe('L');
  });
});

describe('currentStreak', () => {
  it('TEX after its shootout loss is OT1, not L1', () => {
    expect(currentStreak(finals.map(g => gameResultFor(g, TEX).result))).toEqual({ type: 'OT', count: 1 });
  });

  it('counts only the run of the latest result', () => {
    expect(currentStreak(['L', 'W', 'OTL', 'OTL'])).toEqual({ type: 'OT', count: 2 });
    expect(currentStreak(['OTL', 'L', 'L'])).toEqual({ type: 'L', count: 2 });
    expect(currentStreak([])).toBeNull();
  });
});

describe('pointsPct', () => {
  it('TEX at home (1 W, 1 SO loss in 2 GP) is 3/4 = 75%, not the 50% win rate', () => {
    const results = finals.filter(g => g.home_team_id === TEX).map(g => gameResultFor(g, TEX).result);
    const w = results.filter(r => r === 'W').length;
    const otl = results.filter(r => r === 'OTL').length;
    expect(pointsPct({ w, otl, gp: results.length })).toBe(0.75);
  });

  it('is null with no games', () => {
    expect(pointsPct({ w: 0, otl: 0, gp: 0 })).toBeNull();
  });
});

describe('streakColor', () => {
  it('green for W, amber for OT, red for L', () => {
    expect(streakColor('W')).toBe('var(--green)');
    expect(streakColor('OT')).toBe('var(--amber)');
    expect(streakColor('L')).toBe('var(--red-bright)');
  });
});
