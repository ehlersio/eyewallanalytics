import { describe, expect, it } from 'vitest';

import { dayLabelKind, liveDetail, localDateString, periodLabel, startTimeLabel, teamRowHref } from '../scoreboard';

const NOW = new Date('2026-09-15T18:00:00');

describe('dayLabelKind', () => {
  it('only says today when the games really are today', () => {
    expect(dayLabelKind('2026-09-15', NOW)).toBe('today');
    expect(dayLabelKind('2026-09-16', NOW)).toBe('tomorrow');
    // The case that started this: the scoreboard said TODAY in September
    // while the next games were weeks away.
    expect(dayLabelKind('2026-09-19', NOW)).toBe('date');
  });

  it('handles a missing date and a month boundary', () => {
    expect(dayLabelKind(null, NOW)).toBeNull();
    expect(dayLabelKind('2026-10-01', new Date('2026-09-30T20:00:00'))).toBe('tomorrow');
  });
});

describe('localDateString', () => {
  it('zero-pads and uses the local day, not UTC', () => {
    expect(localDateString(new Date('2026-01-05T23:30:00'))).toBe('2026-01-05');
  });
});

describe('startTimeLabel', () => {
  it('formats the NHL start timestamp', () => {
    expect(startTimeLabel({ startTimeUTC: '2026-09-19T23:00:00Z' }, 'en-US')).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/i);
  });

  it("falls back to HockeyTech's own status text, which is already a start time", () => {
    expect(startTimeLabel({ statusDetail: '7:00 pm EST' })).toBe('7:00 pm EST');
    expect(startTimeLabel({ startTimeUTC: 'nonsense', statusDetail: '7:00 pm EST' })).toBe('7:00 pm EST');
    expect(startTimeLabel({})).toBeNull();
  });
});

describe('periodLabel', () => {
  it('reads regulation periods as ordinals and overtime by name', () => {
    expect(periodLabel({ period: 1, periodType: 'REG' })).toBe('1st');
    expect(periodLabel({ period: 3 })).toBe('3rd');
    expect(periodLabel({ period: 4, periodType: 'OT' })).toBe('OT');
    expect(periodLabel({ period: 5, periodType: 'SO' })).toBe('SO');
    expect(periodLabel({ period: 4 })).toBe('OT');  // PWHL has no periodType
    expect(periodLabel({})).toBeNull();
  });
});

describe('liveDetail', () => {
  it('shows the period and clock together', () => {
    expect(liveDetail({ period: 2, periodType: 'REG', clock: '12:34' })).toBe('2nd · 12:34');
  });

  it('marks an intermission instead of showing a stopped clock', () => {
    expect(liveDetail({ period: 1, clock: '18:00', inIntermission: true })).toBe('1st INT');
  });

  it('degrades to the period alone, then to the feed status text', () => {
    expect(liveDetail({ period: 3 })).toBe('3rd');  // HockeyTech: no clock
    expect(liveDetail({ statusDetail: 'In Progress' })).toBe('In Progress');
    expect(liveDetail({})).toBeNull();
  });
});

describe('teamRowHref', () => {
  const nhl = abbr => ['BOS', 'TOR', 'CAR'].includes(abbr);
  const live = { gameId: 2026010040, status: 'live' };

  it('opens a live game from the tapped team’s side', () => {
    expect(teamRowHref('nhl', live, 'BOS', 'CAR', nhl)).toBe('/game/2026010040?as=BOS');
    expect(teamRowHref('nhl', live, 'TOR', 'CAR', nhl)).toBe('/game/2026010040?as=TOR');
  });

  it('sends the favorite’s own row to the favorite’s view', () => {
    expect(teamRowHref('nhl', live, 'CAR', 'CAR', nhl)).toBe('/');
  });

  it('offers nothing where there is nothing to follow', () => {
    expect(teamRowHref('nhl', { ...live, status: 'pre' }, 'BOS', 'CAR', nhl)).toBeNull();
    expect(teamRowHref('nhl', { ...live, status: 'final' }, 'BOS', 'CAR', nhl)).toBeNull();
    expect(teamRowHref('pwhl', live, 'BOS', 'CAR', nhl)).toBeNull();
    expect(teamRowHref('nhl', live, 'ARI', 'CAR', nhl)).toBeNull();
    expect(teamRowHref('nhl', { status: 'live' }, 'BOS', 'CAR', nhl)).toBeNull();
  });
});
