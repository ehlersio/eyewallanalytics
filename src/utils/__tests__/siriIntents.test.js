// The iOS intents' team list (ios/App/App/Intents/Teams.json) must match the
// web config. Run with UPDATE_IOS_TEAMS=1 to rewrite it after a team change.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'web', isNativePlatform: () => false },
  registerPlugin: () => ({}),
}));

import { intentTeams, intentFollowedTeams } from '../siriIntents';

const TEAMS_JSON = fileURLToPath(new URL('../../../ios/App/App/Intents/Teams.json', import.meta.url));

describe('intentTeams', () => {
  it('lists every team of every league with a unique id', () => {
    const teams = intentTeams();
    const ids = teams.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const league of ['nhl', 'pwhl', 'ahl', 'echl']) {
      expect(teams.some(t => t.league === league)).toBe(true);
    }
    for (const t of teams) {
      expect(Number.isInteger(t.teamId)).toBe(true);
      expect(t.name).toBeTruthy();
      expect(t.shortName).toBeTruthy();
    }
  });

  it('matches ios/App/App/Intents/Teams.json', () => {
    const expected = `${JSON.stringify(intentTeams(), null, 2)}\n`;
    if (process.env.UPDATE_IOS_TEAMS) writeFileSync(TEAMS_JSON, expected);
    expect(readFileSync(TEAMS_JSON, 'utf8')).toBe(expected);
  });
});

describe('intentFollowedTeams', () => {
  it('lists followed teams as league:ABBR, in order', () => {
    expect(intentFollowedTeams([{ sport: 'ahl', abbr: 'CHI' }, { sport: 'nhl', abbr: 'CAR' }]))
      .toEqual(['ahl:CHI', 'nhl:CAR']);
  });
});
