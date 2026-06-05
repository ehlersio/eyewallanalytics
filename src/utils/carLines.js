/**
 * carLines.js — Static CAR line combinations fallback.
 *
 * Used when inferred lines from Supabase are unavailable or incomplete
 * (e.g. early season before enough shift data accumulates, or after a
 * mid-series line shuffle that hasn't been re-inferred yet).
 *
 * getTeamLines() in supabaseClient.js prefers live inferred data and
 * falls back to these only when inference returns fewer than 4 lines.
 *
 * Position order is always LW → C → RW for forwards, and D → D for pairs.
 * Update this file when CAR makes significant line changes.
 */

export const CAR_STATIC_LINES = {
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
        toiMins: null,
        xgfPct:  null,
        isStatic: true,
      },
      {
        rank: 2,
        players: [
          { name: 'Taylor Hall',      pos: 'L' },
          { name: 'Logan Stankoven',  pos: 'C' },
          { name: 'Jackson Blake',    pos: 'R' },
        ],
        toiMins: null,
        xgfPct:  null,
        isStatic: true,
      },
      {
        rank: 3,
        players: [
          { name: 'Nikolaj Ehlers',   pos: 'L' },
          { name: 'Jordan Staal',     pos: 'C' },
          { name: 'Jordan Martinook', pos: 'R' },
        ],
        toiMins: null,
        xgfPct:  null,
        isStatic: true,
      },
      {
        rank: 4,
        players: [
          { name: 'William Carrier',  pos: 'L' },
          { name: 'Mark Jankowski',   pos: 'C' },
          { name: 'Eric Robinson',    pos: 'R' },
        ],
        toiMins: null,
        xgfPct:  null,
        isStatic: true,
      },
    ],
    pairs: [
      {
        rank: 1,
        players: [
          { name: 'Jaccob Slavin',    pos: 'D' },
          { name: 'Jalen Chatfield',  pos: 'D' },
        ],
        toiMins: null,
        xgfPct:  null,
        isStatic: true,
      },
      {
        rank: 2,
        players: [
          { name: "K'Andre Miller",   pos: 'D' },
          { name: 'Sean Walker',      pos: 'D' },
        ],
        toiMins: null,
        xgfPct:  null,
        isStatic: true,
      },
      {
        rank: 3,
        players: [
          { name: 'Shayne Gostisbehere', pos: 'D' },
          { name: 'Alexander Nikishin',  pos: 'D' },
        ],
        toiMins: null,
        xgfPct:  null,
        isStatic: true,
      },
    ],
  },

  // Playoff lines — same as regular season for 2025–26
  // Update if lines change significantly mid-series
  playoff: null, // null = use regular season lines as fallback
};

/**
 * Returns static lines for the given game type.
 * gameType: 2 = regular season, 3 = playoffs
 */
export function getStaticLines(gameType = 2) {
  const po = CAR_STATIC_LINES.playoff;
  if (gameType === 3 && po) return po;
  return CAR_STATIC_LINES.regular;
}
