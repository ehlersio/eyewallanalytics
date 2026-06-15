/**
 * staticLines.js — Static fallback line combinations by team.
 *
 * Used when inferred lines from Supabase are unavailable or incomplete
 * (e.g. early season before enough shift data accumulates, or after a
 * mid-series line shuffle that hasn't been re-inferred yet).
 *
 * getTeamLines() in supabaseClient.js prefers live inferred data and
 * falls back to these only when inference returns fewer than 4 lines.
 *
 * Position order is always LW → C → RW for forwards, and D → D for pairs.
 * Update a team's entry when they make significant line changes.
 *
 * Teams without a static entry return null — the UI handles this gracefully
 * by hiding the lines section rather than showing stale data.
 */

const STATIC_LINES = {
  CAR: {
    // Regular season lines (2025–26)
    regular: {
      lines: [
        {
          rank: 1,
          players: [
            { name: 'Andrei Svechnikov', pos: 'L' },
            { name: 'Sebastian Aho',     pos: 'C' },
            { name: 'Seth Jarvis',       pos: 'R' },
          ],
          toiMins: null, xgfPct: null, isStatic: true,
        },
        {
          rank: 2,
          players: [
            { name: 'Taylor Hall',     pos: 'L' },
            { name: 'Logan Stankoven', pos: 'C' },
            { name: 'Jackson Blake',   pos: 'R' },
          ],
          toiMins: null, xgfPct: null, isStatic: true,
        },
        {
          rank: 3,
          players: [
            { name: 'Nikolaj Ehlers',   pos: 'L' },
            { name: 'Jordan Staal',     pos: 'C' },
            { name: 'Jordan Martinook', pos: 'R' },
          ],
          toiMins: null, xgfPct: null, isStatic: true,
        },
        {
          rank: 4,
          players: [
            { name: 'William Carrier', pos: 'L' },
            { name: 'Mark Jankowski',  pos: 'C' },
            { name: 'Eric Robinson',   pos: 'R' },
          ],
          toiMins: null, xgfPct: null, isStatic: true,
        },
      ],
      pairs: [
        {
          rank: 1,
          players: [
            { name: 'Jaccob Slavin',   pos: 'D' },
            { name: 'Jalen Chatfield', pos: 'D' },
          ],
          toiMins: null, xgfPct: null, isStatic: true,
        },
        {
          rank: 2,
          players: [
            { name: "K'Andre Miller", pos: 'D' },
            { name: 'Sean Walker',    pos: 'D' },
          ],
          toiMins: null, xgfPct: null, isStatic: true,
        },
        {
          rank: 3,
          players: [
            { name: 'Shayne Gostisbehere', pos: 'D' },
            { name: 'Alexander Nikishin',  pos: 'D' },
          ],
          toiMins: null, xgfPct: null, isStatic: true,
        },
      ],
    },
    // null = use regular season lines as fallback
    playoff: null,
  },

  // Add other teams here as needed. Teams without an entry return null,
  // which causes the lines section to be hidden rather than show stale data.
  VGK: {
    // 2025–26 playoff lines (SCF vs CAR)
    regular: {
      lines: [
        {
          rank: 1,
          players: [
            { name: 'Ivan Barbashev', pos: 'L' },
            { name: 'Jack Eichel',    pos: 'C' },
            { name: 'Pavel Dorofeyev', pos: 'R' },
          ],
          toiMins: null, xgfPct: null, isStatic: true,
        },
        {
          rank: 2,
          players: [
            { name: 'William Carrier', pos: 'L' },
            { name: 'Tomas Hertl',     pos: 'C' },
            { name: 'Mark Stone',      pos: 'R' },
          ],
          toiMins: null, xgfPct: null, isStatic: true,
        },
        {
          rank: 3,
          players: [
            { name: 'Brandon Pirri',  pos: 'L' },
            { name: 'Nicolas Roy',    pos: 'C' },
            { name: 'Keegan Kolesar', pos: 'R' },
          ],
          toiMins: null, xgfPct: null, isStatic: true,
        },
        {
          rank: 4,
          players: [
            { name: 'Anthony Mantha', pos: 'L' },
            { name: 'Paul Cotter',    pos: 'C' },
            { name: 'Brett Howden',   pos: 'R' },
          ],
          toiMins: null, xgfPct: null, isStatic: true,
        },
      ],
      pairs: [
        {
          rank: 1,
          players: [
            { name: 'Alex Pietrangelo', pos: 'D' },
            { name: 'Noah Hanifin',     pos: 'D' },
          ],
          toiMins: null, xgfPct: null, isStatic: true,
        },
        {
          rank: 2,
          players: [
            { name: 'Shea Theodore', pos: 'D' },
            { name: 'Brayden McNabb', pos: 'D' },
          ],
          toiMins: null, xgfPct: null, isStatic: true,
        },
        {
          rank: 3,
          players: [
            { name: 'Nicolas Hague',    pos: 'D' },
            { name: 'Zach Whitecloud',  pos: 'D' },
          ],
          toiMins: null, xgfPct: null, isStatic: true,
        },
      ],
    },
    playoff: null, // use regular season lines as fallback
  },
};

/**
 * Returns static fallback lines for the given team and game type.
 * Returns null if no static data exists for that team — callers should
 * hide the lines section rather than show an empty state.
 *
 * @param {string} teamAbbr  - e.g. 'CAR', 'COL'
 * @param {number} gameType  - 2 = regular season, 3 = playoffs
 */
export function getStaticLines(teamAbbr = 'CAR', gameType = 2) {
  const entry = STATIC_LINES[teamAbbr];
  if (!entry) return null;
  const po = entry.playoff;
  if (gameType === 3 && po) return po;
  return entry.regular || null;
}

// Legacy named export — kept for any existing imports of CAR_STATIC_LINES
export const CAR_STATIC_LINES = STATIC_LINES.CAR;
