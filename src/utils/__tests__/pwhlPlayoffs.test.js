import { describe, expect, it } from 'vitest';

import {
  arrangePWHLConferenceBracket,
  buildPWHLSeries,
  projectPWHLBracket,
  pwhlPlayoffFormat,
  pwhlUsesConferences,
  rankPWHLConference,
} from '../pwhlPlayoffs';

// 2026-27 conferences, by HockeyTech team id.
const CONF = { 1: 'East', 3: 'East', 4: 'East', 5: 'East', 6: 'East', 11: 'East', 2: 'West', 8: 'West', 9: 'West', 10: 'West', 12: 'West', 13: 'West' };
const conferenceOf = id => CONF[id];
const row = (team_id, gp, points, reg_wins = 0, non_reg_wins = 0) => ({ team_id, gp, points, reg_wins, non_reg_wins });

describe('pwhlPlayoffFormat', () => {
  it('uses conferences, best-of-3 quarterfinals, from 2026-27 (season 11) on', () => {
    expect(pwhlUsesConferences(11)).toBe(true);
    expect(pwhlUsesConferences('12')).toBe(true);
    expect(pwhlPlayoffFormat(11).rounds.map(r => [r.key, r.winsNeeded]))
      .toEqual([['quarterfinals', 2], ['conferenceFinals', 3], ['final', 3]]);
  });

  it('keeps the top-4, best-of-5 format for 2025-26 and before', () => {
    expect(pwhlUsesConferences(8)).toBe(false);
    expect(pwhlUsesConferences(9)).toBe(false);
    expect(pwhlPlayoffFormat(8)).toMatchObject({ byConference: false, qualifiers: 4 });
    expect(pwhlPlayoffFormat(8).rounds.map(r => r.winsNeeded)).toEqual([3, 3]);
  });
});

describe('rankPWHLConference', () => {
  it('orders by points percentage, then regulation wins, then regulation + OT wins', () => {
    const standings = [
      row(1, 10, 18, 5, 1), // .600
      row(3, 8, 18, 6, 0),  // .750
      row(4, 10, 18, 6, 0), // .600, more regulation wins than BOS
      row(5, 10, 18, 5, 2), // .600, same RW as BOS, more RW+OTW
      row(2, 10, 30, 10, 0), // West
    ];
    expect(rankPWHLConference(standings, 'East', conferenceOf).map(r => r.team_id)).toEqual([3, 4, 5, 1]);
  });
});

describe('projectPWHLBracket', () => {
  const standings = [
    row(1, 5, 12), row(3, 5, 10), row(4, 5, 9), row(5, 5, 7), row(6, 5, 5), row(11, 5, 2),
    row(2, 5, 13), row(8, 5, 11), row(9, 5, 8), row(10, 5, 6), row(12, 5, 4), row(13, 5, 1),
  ];

  it('pairs 1 v 4 and 2 v 3 in each conference and leaves the rest open', () => {
    const b = projectPWHLBracket(standings, conferenceOf);
    expect(b.projected).toBe(true);
    expect(b.sides.East[0].map(s => [s.teamA, s.seedA, s.teamB, s.seedB])).toEqual([[1, 1, 5, 4], [3, 2, 4, 3]]);
    expect(b.sides.West[0].map(s => [s.teamA, s.teamB])).toEqual([[2, 10], [8, 9]]);
    expect(b.sides.East[1]).toEqual([null]);
    expect(b.final).toBeNull();
  });

  it('is null before a game is played, or without four teams in a conference', () => {
    expect(projectPWHLBracket(standings.map(r => ({ ...r, gp: 0 })), conferenceOf)).toBeNull();
    expect(projectPWHLBracket(standings.filter(r => CONF[r.team_id] === 'East'), conferenceOf)).toBeNull();
    expect(projectPWHLBracket([], conferenceOf)).toBeNull();
  });
});

describe('buildPWHLSeries / arrangePWHLConferenceBracket', () => {
  let id = 0;
  const game = (home, away, hs, as) => ({ game_id: ++id, game_state: 'Final', home_team_id: home, away_team_id: away, home_score: hs, away_score: as });
  const games = [
    game(1, 5, 3, 1), game(3, 4, 1, 2), game(2, 10, 4, 0), game(8, 9, 2, 1), // quarterfinal game 1s
    game(5, 1, 0, 2), game(4, 3, 3, 2), game(10, 2, 1, 3), game(9, 8, 0, 1), // game 2s: all sweeps
    game(1, 4, 2, 1), game(2, 8, 3, 2), // conference final game 1s
    { ...game(1, 4, 5, 0), game_state: '7:00 PM' }, // not played yet: ignored
  ];

  it('makes one series per pair, counting wins, in the order they started', () => {
    const series = buildPWHLSeries(games);
    expect(series.map(s => s.key)).toEqual(['1-5', '3-4', '2-10', '8-9', '1-4', '2-8']);
    expect(series[1]).toMatchObject({ teamA: 3, teamB: 4, winsA: 0, winsB: 2 });
  });

  it('places quarterfinals and conference finals by conference; no final yet', () => {
    const b = arrangePWHLConferenceBracket(buildPWHLSeries(games), conferenceOf);
    expect(b.sides.East[0].map(s => s.key)).toEqual(['1-5', '3-4']);
    expect(b.sides.East[1][0].key).toBe('1-4');
    expect(b.sides.West[1][0].key).toBe('2-8');
    expect(b.final).toBeNull();
  });

  it('takes the one series between conferences as the Walter Cup Final', () => {
    const b = arrangePWHLConferenceBracket(buildPWHLSeries([...games, game(1, 2, 3, 2)]), conferenceOf);
    expect(b.final).toMatchObject({ teamA: 1, teamB: 2 });
  });
});
