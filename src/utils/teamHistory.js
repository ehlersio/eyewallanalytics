// ─── Team History data (Phase 0 pilot — Carolina Hurricanes only) ──────────
// Franchise reference facts for the Team page's History tab: founding,
// arena, championships, retired numbers, notable alumni, franchise records,
// minor-league affiliates, and misc trivia.
//
// Deliberately a static hand-maintained file, not a Supabase table fed by
// the pipeline/poller — this data changes on the order of "once a season"
// at most (most fields never change at all), so a live round trip would be
// pure overhead. Same reasoning as carContracts.js.
//
// Two kinds of fields, don't conflate them:
//   - Frozen history (founded, championships, retiredNumbers, records) —
//     verified once against public sources, doesn't need revisiting.
//   - currentInfo (owner, headCoach, affiliates) — drifts with real-world
//     org changes (coaching changes, ownership sales, affiliate re-ups).
//     `lastVerified` marks when it was last checked; treat anything more
//     than ~1 year stale as due for a recheck before trusting it blindly.
//
// Keyed by league, then by team abbr (matching each league's own config
// file — teamConfig.js for NHL, pwhlConfig.js/ahlConfig.js/echlConfig.js
// for the others). Only nhl.CAR is populated in this Phase 0 pilot; later
// phases fill in the rest of each league one at a time (see plan doc).
//
// Sources for CAR data (verified 2026-09-01): Wikipedia (Carolina
// Hurricanes, Hartford Whalers, Lenovo Center), NHL.com, hockey-reference.com,
// quanthockey.com single-season records, NHL press release on the Chicago
// Wolves AHL affiliate agreement, ECHL.com on the Greensboro Gargoyles.

export const TEAM_HISTORY = {
  nhl: {
    CAR: {
      founded: {
        year: 1972,
        asFranchise: 'New England Whalers (WHA)',
        joinedNHL: 1979,
        relocations: [
          { year: 1979, from: 'New England (WHA)', to: 'Hartford, CT', renamedTo: 'Hartford Whalers', note: 'NHL–WHA merger' },
          { year: 1997, from: 'Hartford, CT', to: 'Raleigh, NC', renamedTo: 'Carolina Hurricanes' },
        ],
      },
      arena: {
        name: 'Lenovo Center',
        city: 'Raleigh, NC',
        capacity: 18547,
        opened: 1999,
        formerNames: [
          { name: 'Raleigh Entertainment and Sports Arena', years: '1999–2002' },
          { name: 'RBC Center', years: '2002–2012' },
          { name: 'PNC Arena', years: '2012–2024' },
        ],
        photo: {
          source: 'wikimedia',
          // Special:FilePath is Wikimedia's stable direct-link redirect --
          // avoids hardcoding the hashed upload.wikimedia.org path, which
          // isn't guessable and can't be verified without looking it up.
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/PNCArena-RaleighNC.jpg',
          attribution: 'Edward T. Funkhouser, CC BY-SA 3.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Stanley Cup', years: [2006, 2026] },
      ],
      retiredNumbers: [
        { number: 2, player: 'Glen Wesley' },
        { number: 10, player: 'Ron Francis' },
        { number: 12, player: 'Eric Staal' },
        { number: 17, player: "Rod Brind'Amour" },
      ],
      notableAlumni: [
        "Rod Brind'Amour", 'Ron Francis', 'Eric Staal', 'Jordan Staal',
        'Cam Ward', 'Sebastian Aho', 'Gordie Howe',
      ],
      records: [
        { label: 'Most wins, single season', value: 54, season: '2021-22' },
        { label: 'Most points, single season', value: 116, season: '2021-22' },
      ],
      affiliates: { ahl: 'CHI', echl: 'GSO' },
      facts: [
        "Gordie Howe played his final NHL season (1979-80) with the Hartford Whalers, the franchise's first year in the NHL.",
        'Most of the numbers retired by the Hartford Whalers went back into circulation after the 1997 move to Carolina — the Hurricanes keep #9 (Gordie Howe) unofficially retired.',
        "Rod Brind'Amour has his number retired as a player (#17) and is also the team's current head coach.",
      ],
      currentInfo: {
        owner: 'Tom Dundon',
        headCoach: "Rod Brind'Amour",
        lastVerified: '2026-09-01',
      },
    },
  },
  pwhl: {},
  ahl: {},
  echl: {},
};

export function getTeamHistory(league, abbr) {
  return TEAM_HISTORY[league]?.[abbr] || null;
}
