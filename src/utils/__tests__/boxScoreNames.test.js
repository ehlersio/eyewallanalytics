// Box-score names for the PWHL/AHL/ECHL game-stats popups (audit
// 2026-10-05 #2). Fixtures in fixtures/hockeytech-box-names/ are real
// Worker responses, 2026-10-05:
//   pwhl-329-game-box-before.json  /pwhl/game-box?gameId=329 from the Worker
//                                  before rows were named (no player_name)
//   pwhl-329-game-box.json         the same game from the Worker that names
//                                  rows from the game's own lineup
//   pwhl-roster-1.json / -4.json   /pwhl/roster for BOS and NY today
//   ahl-1029013-game-box.json      /ahl/game-box?gameId=1029013 (WBS @ HER,
//                                  2026 Calder Cup) -- rows carry player_name
//   ahl-roster-319.json / -316.json /ahl/roster for HER and WBS today
import { describe, it, expect } from 'vitest';
import { boxScoreNames, boxNeedsRosters } from '../boxScoreNames';
import pwhlBefore from './fixtures/hockeytech-box-names/pwhl-329-game-box-before.json';
import pwhlNamed from './fixtures/hockeytech-box-names/pwhl-329-game-box.json';
import pwhlRosterBOS from './fixtures/hockeytech-box-names/pwhl-roster-1.json';
import pwhlRosterNY from './fixtures/hockeytech-box-names/pwhl-roster-4.json';
import ahlBox from './fixtures/hockeytech-box-names/ahl-1029013-game-box.json';
import ahlRosterHER from './fixtures/hockeytech-box-names/ahl-roster-319.json';
import ahlRosterWBS from './fixtures/hockeytech-box-names/ahl-roster-316.json';

const rows = (box) => [...box.skaters, ...box.goalies];

describe('boxScoreNames', () => {
  it('names every PWHL 329 row from the Worker, including players since moved (Eldridge #18, Hartmetz #6)', () => {
    const names = boxScoreNames(pwhlNamed, null);
    expect(rows(pwhlNamed).every(r => names[r.player_id])).toBe(true);
    expect(names[36]).toBe('Jessie Eldridge');
    expect(names[182]).toBe('Hadley Hartmetz');
  });

  it('with the old unnamed PWHL response, falls back to the rosters -- which miss 14 of 42 players', () => {
    const names = boxScoreNames(pwhlBefore, [pwhlRosterBOS, pwhlRosterNY]);
    const missing = rows(pwhlBefore).filter(r => !names[r.player_id]).map(r => r.player_id);
    expect(missing).toHaveLength(14);
    expect(missing).toContain(36);
    // Nothing invented for them: the table shows its own placeholder.
    expect(names[36]).toBeUndefined();
  });

  it('prefers the row\'s own name over the current roster (AHL 1029013: Gabe Klassen is off WBS\'s roster)', () => {
    const rosterIds = new Set([...ahlRosterHER, ...ahlRosterWBS].map(p => p.player_id));
    expect(rosterIds.has(9223)).toBe(false);
    const names = boxScoreNames(ahlBox, [ahlRosterHER, ahlRosterWBS]);
    expect(names[9223]).toBe('Gabe Klassen');
    expect(rows(ahlBox).every(r => names[r.player_id])).toBe(true);
  });

  it('tolerates a missing box or roster', () => {
    expect(boxScoreNames(null, null)).toEqual({});
    expect(boxScoreNames(pwhlNamed, [null, undefined])[36]).toBe('Jessie Eldridge');
  });
});

describe('boxNeedsRosters', () => {
  it('is false while the box score loads and when every row is named', () => {
    expect(boxNeedsRosters(null)).toBe(false);
    expect(boxNeedsRosters(pwhlNamed)).toBe(false);
    expect(boxNeedsRosters(ahlBox)).toBe(false);
  });

  it('is true for the old unnamed response', () => {
    expect(boxNeedsRosters(pwhlBefore)).toBe(true);
  });
});
