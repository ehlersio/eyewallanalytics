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
          // Taken Jan 2025, post-rename (the arena became Lenovo Center in
          // Sept 2024) -- swapped in for the original PNC-Arena-era photo so
          // the image matches the current name shown in the Name row below.
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Lenovo_Center_Exterior_View_2025_Distant.jpg',
          attribution: 'CavsFan45, CC BY-SA 4.0, via Wikimedia Commons',
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
    // Verified Phase 1 team entries, accumulated as agents report back.
    // Integrate into src/utils/teamHistory.js TEAM_HISTORY.nhl after a final
    // spot-check pass. Each entry notes its source agent and any open flags.

    // ── NJD (from Metropolitan division sub-agent, completed) ──────────────────
    // FLAG: head coach (Sheldon Keefe) — agent could only confirm via aggregated
    // search snippet (Elliotte Friedman report), not a primary source. Re-verify
    // before shipping -- most likely field to have changed.
    // FLAG: owner formatting -- co-owned by Josh Harris & David Blitzer via HBSE;
    // agent unsure which (if either) is the correct single "Alternate Governor"
    // of record. Using both names, "&" not "&amp;" (agent output had HTML entity).
    NJD: {
      founded: {
        year: 1974,
        asFranchise: 'Kansas City Scouts',
        joinedNHL: 1974,
        relocations: [
          { year: 1976, from: 'Kansas City, MO', to: 'Denver, CO', renamedTo: 'Colorado Rockies', note: 'Franchise sold and moved after two seasons' },
          { year: 1982, from: 'Denver, CO', to: 'East Rutherford, NJ', renamedTo: 'New Jersey Devils', note: 'Named for the Jersey Devil legend' },
        ],
      },
      arena: {
        name: 'Prudential Center',
        city: 'Newark, NJ',
        capacity: 16514,
        opened: 2007,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Prudential_Center_-_Newark_Skyline_%2855183937688%29.jpg',
          attribution: 'Ajay Suresh, CC BY 4.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Stanley Cup', years: [1995, 2000, 2003] },
      ],
      retiredNumbers: [
        { number: 3, player: 'Ken Daneyko' },
        { number: 4, player: 'Scott Stevens' },
        { number: 26, player: 'Patrik Elias' },
        { number: 27, player: 'Scott Niedermayer' },
        { number: 30, player: 'Martin Brodeur' },
      ],
      notableAlumni: [
        'Martin Brodeur', 'Scott Stevens', 'Scott Niedermayer', 'Ken Daneyko',
        'Patrik Elias', 'Claude Lemieux', 'John MacLean',
      ],
      records: [
        { label: 'Most wins, single season', value: 52, season: '2022-23' },
        { label: 'Most points, single season', value: 112, season: '2022-23' },
      ],
      affiliates: { ahl: 'UTC', echl: 'ADK' },
      facts: [
        "The Devils franchise began in 1974 as the Kansas City Scouts, moved to Denver in 1976 as the Colorado Rockies, and only became a stable contender after relocating to New Jersey in 1982.",
        "Under coach Jacques Lemaire, the 1994-95 Devils won their first Stanley Cup running a suffocating neutral-zone trap defense, a tactical system that became closely associated with (and reviled by fans of) the franchise for years afterward.",
        "Martin Brodeur, whose #30 is retired, holds the NHL career records for most wins (691) and most shutouts (125) by a goaltender, almost all of it earned in a Devils uniform.",
      ],
      currentInfo: {
        owner: 'Josh Harris & David Blitzer',
        headCoach: 'Sheldon Keefe',
        lastVerified: '2026-09-01',
      },
    },

    // ── CBJ (from Metropolitan sub-agent, completed) ────────────────────────────
    // FIXED: agent's photo url had a literal space ('Nationwide Arena.jpg') --
    // Wikimedia filenames use underscores, corrected below.
    // FLAG: no relocations key at all (expansion team, no WHA/relocation history)
    // -- matches CBJ's actual history, fine as-is.
    // FLAG: Gaudreau's #13 deliberately NOT in retiredNumbers (banner raised as
    // tribute after his 2024 death, but no formal retirement ceremony held per
    // agent's sources) -- same unofficial/official split as CAR's Gordie Howe
    // #9 pattern. Mentioned in facts only. Worth a product call if we want a
    // distinct "honored, not retired" category later.
    // FLAG: head coach Rick Bowness hired Jan 2026 mid-season -- fast-moving
    // chair, re-verify close to ship.
    // FLAG: ECHL affiliate (Wheeling Nailers) only announced Aug 2026, replacing
    // a multi-year gap with no ECHL affiliate at all -- correct but very recent.
    // TODO integration: verify 'CLE' (AHL) and 'WHL' (ECHL) abbrs against
    // ahlConfig.js/echlConfig.js -- agent didn't confirm these against the repo's
    // actual config the way instructed, don't trust blindly.
    CBJ: {
      founded: {
        year: 1997,
        asFranchise: 'Columbus Blue Jackets (NHL expansion)',
        joinedNHL: 2000,
      },
      arena: {
        name: 'Nationwide Arena',
        city: 'Columbus, OH',
        capacity: 18500,
        opened: 2000,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Nationwide_Arena.jpg',
          attribution: 'Paul Sableman, CC BY 2.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [
        { number: 61, player: 'Rick Nash' },
      ],
      notableAlumni: [
        'Rick Nash', 'Sergei Bobrovsky', 'Nick Foligno', 'Cam Atkinson',
        'Seth Jones', 'Ryan Johansen', 'Johnny Gaudreau',
      ],
      records: [
        { label: 'Most wins, single season', value: 50, season: '2016-17' },
        { label: 'Most points, single season', value: 108, season: '2016-17' },
      ],
      affiliates: { ahl: 'CLE', echl: 'WHL' },
      facts: [
        'The Blue Jackets were awarded to Columbus on June 25, 1997, and began play in 2000 — the first NHL franchise in Ohio since the Cleveland Barons folded (and merged into the Minnesota North Stars) in 1978.',
        "A 1,500-pound Napoleon-style cannon above section 111 at Nationwide Arena fires after every Blue Jackets goal and win, playing off AC/DC's 'For Those About to Rock' — one of the NHL's most recognizable goal celebrations, introduced in 2007.",
        "After forward Johnny Gaudreau and his brother Matthew were killed by a suspected drunk driver in August 2024, the Blue Jackets raised a memorial banner bearing Gaudreau's No. 13 to the Nationwide Arena rafters at their 2024-25 home opener. The number has been left out of circulation as a tribute, though the club has not held a formal retirement ceremony for it (unlike Rick Nash's #61).",
      ],
      currentInfo: {
        owner: 'John P. McConnell',
        headCoach: 'Rick Bowness',
        lastVerified: '2026-09-01',
      },
    },

    // ── NYI (from Metropolitan sub-agent, completed) ────────────────────────────
    // GOOD: this one actually verified affiliates.ahl/echl against the repo's
    // own ahlConfig.js/echlConfig.js as instructed (HAM, TRE) -- trust these.
    // FLAG: UBS Arena capacity 17,255 vs 17,250 discrepancy across sources,
    // minor, not worth chasing further.
    // FLAG: owner is a multi-party group (Ledecky/Malkin/Collins/Haarmann/a
    // pending Shuman stake) -- used the two most commonly cited names.
    // FLAG: head coach Peter DeBoer hired April 2026 after Roy fired same day --
    // recent, re-verify close to ship.
    NYI: {
      founded: {
        year: 1972,
      },
      arena: {
        name: 'UBS Arena',
        city: 'Elmont, NY',
        capacity: 17255,
        opened: 2021,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Belmont_Park_td_%282021-12-19%29_018_-_UBS_Arena.jpg',
          attribution: 'Tdorante10, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Stanley Cup', years: [1980, 1981, 1982, 1983] },
      ],
      retiredNumbers: [
        { number: 5, player: 'Denis Potvin' },
        { number: 9, player: 'Clark Gillies' },
        { number: 19, player: 'Bryan Trottier' },
        { number: 22, player: 'Mike Bossy' },
        { number: 23, player: 'Bob Nystrom' },
        { number: 27, player: 'John Tonelli' },
        { number: 31, player: 'Billy Smith' },
        { number: 91, player: 'Butch Goring' },
      ],
      notableAlumni: [
        'Mike Bossy', 'Denis Potvin', 'Bryan Trottier', 'Billy Smith',
        'Clark Gillies', 'John Tavares', 'Al Arbour',
      ],
      records: [
        { label: 'Most wins, single season', value: 54, season: '1981-82' },
        { label: 'Most points, single season', value: 118, season: '1981-82' },
      ],
      affiliates: { ahl: 'HAM', echl: 'TRE' },
      facts: [
        "The Islanders' four consecutive Stanley Cup championships (1980-1983) included a run of 19 consecutive playoff series wins (1980-1984) — still an NHL and North American major pro sports record, two more than the Boston Celtics' 17-series NBA dynasty run.",
        "The 'Drive for Five' fell short in 1984: the Edmonton Oilers beat the four-time defending champion Islanders 4 games to 1 in the Stanley Cup Final, ending the dynasty.",
        'The Islanders played at Nassau Coliseum in Uniondale from their 1972 founding, split time with Barclays Center in Brooklyn starting in 2015, and moved into UBS Arena in Elmont for the 2021-22 season.',
      ],
      currentInfo: {
        owner: 'Jon Ledecky & Scott Malkin',
        headCoach: 'Peter DeBoer',
        lastVerified: '2026-09-01',
      },
    },

    // ── NYR (from Metropolitan sub-agent, completed) ────────────────────────────
    // FIXED: merged agent's non-standard `sharedWith` key into the player string
    // (component only renders `n.player` as text) for #9 and #11 shared numbers.
    // FIXED: dropped agent's extra `note` keys on founded/arena (component
    // doesn't render them) -- folded the genuinely interesting MSG-naming-rights
    // one into facts instead.
    // FLAG (important, do not guess): ECHL affiliate is genuinely unresolved --
    // agent found Bloomington Bison (Rangers' prior affiliate) now affiliated
    // with Winnipeg/Manitoba instead, and found no new Rangers ECHL affiliate
    // announced for 2026-27. Left affiliates.echl unset. Needs a manual check
    // closer to season start, not a research-agent guess.
    // FLAG: MSG Sports Corp announced a planned Rangers business spin-off "by
    // end of October 2026" per Aug 2026 earnings release -- owner field likely
    // needs a recheck this fall regardless of the lastVerified date.
    // FLAG: arena capacity 18,006 came from search snippets, not a fetched
    // primary page (hockey-reference/nhl.com both blocked the agent).
    NYR: {
      founded: {
        year: 1926,
        asFranchise: 'New York Rangers (NHL)',
        joinedNHL: 1926,
      },
      arena: {
        name: 'Madison Square Garden',
        city: 'New York, NY',
        capacity: 18006,
        opened: 1968,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Madison_Square_Garden_%28MSG%29_-_Full_%2848124330357%29.jpg',
          attribution: 'Ajay Suresh, CC BY 2.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Stanley Cup', years: [1928, 1933, 1940, 1994] },
      ],
      retiredNumbers: [
        { number: 1, player: 'Ed Giacomin' },
        { number: 2, player: 'Brian Leetch' },
        { number: 3, player: 'Harry Howell' },
        { number: 7, player: 'Rod Gilbert' },
        { number: 9, player: 'Andy Bathgate & Adam Graves' },
        { number: 11, player: 'Vic Hadfield & Mark Messier' },
        { number: 19, player: 'Jean Ratelle' },
        { number: 30, player: 'Henrik Lundqvist' },
        { number: 35, player: 'Mike Richter' },
      ],
      notableAlumni: [
        'Mark Messier', 'Brian Leetch', 'Mike Richter', 'Rod Gilbert',
        'Ed Giacomin', 'Adam Graves', 'Henrik Lundqvist',
      ],
      records: [
        { label: 'Most wins, single season', value: 55, season: '2023-24' },
        { label: 'Most points, single season', value: 114, season: '2023-24' },
      ],
      affiliates: { ahl: 'HFD' },
      facts: [
        "The Rangers went 54 years between Stanley Cup titles (1940 to 1994) — nicknamed the 'Curse of 1940,' fueled by a fan legend that the team burned the mortgage on Madison Square Garden inside the Cup after the 1940 win, angering hockey's gods.",
        "Captain Mark Messier guaranteed a Game 6 win over the New Jersey Devils in the 1994 Eastern Conference Final, then delivered a natural hat trick to back it up — the Rangers went on to beat Vancouver for the Cup, ending the 54-year drought.",
        "Madison Square Garden, opened in 1968, has never sold corporate naming rights — it's the last major NBA/NHL arena still carrying its original name.",
      ],
      currentInfo: {
        owner: 'James L. Dolan',
        headCoach: 'Mike Sullivan',
        lastVerified: '2026-09-01',
      },
    },

    // ── WSH (from Metropolitan sub-agent, completed) ────────────────────────────
    // FIXED: photo url had literal spaces ('Capital One Arena at night.jpg') --
    // agent itself flagged this and suggested the underscore fix, applied below.
    // FIXED: owner field simplified to 'Ted Leonsis' (dropped the &amp; entity
    // and the redundant corporate parenthetical), matching CAR's single-name style
    // per the agent's own suggestion.
    // TODO integration: verify 'HER' (AHL, Hershey Bears) and 'SC' (ECHL, South
    // Carolina Stingrays) abbrs against ahlConfig.js/echlConfig.js -- agent found
    // these via web search, didn't cross-check the repo's actual config.
    WSH: {
      founded: {
        year: 1974,
        asFranchise: 'Washington Capitals (NHL expansion)',
        joinedNHL: 1974,
      },
      arena: {
        name: 'Capital One Arena',
        city: 'Washington, DC',
        capacity: 18573,
        opened: 1997,
        formerNames: [
          { name: 'MCI Center', years: '1997–2006' },
          { name: 'Verizon Center', years: '2006–2017' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Capital_One_Arena_at_night.jpg',
          attribution: 'Pachiscool11, CC0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Stanley Cup', years: [2018] },
      ],
      retiredNumbers: [
        { number: 5, player: 'Rod Langway' },
        { number: 7, player: 'Yvon Labre' },
        { number: 11, player: 'Mike Gartner' },
        { number: 32, player: 'Dale Hunter' },
      ],
      notableAlumni: [
        'Alex Ovechkin', 'Nicklas Backstrom', 'Rod Langway', 'Mike Gartner',
        'Dale Hunter', 'Olaf Kolzig', 'Peter Bondra',
      ],
      records: [
        { label: 'Most wins, single season', value: 56, season: '2015-16' },
        { label: 'Most points, single season', value: 121, season: '2009-10' },
      ],
      affiliates: { ahl: 'HER', echl: 'SC' },
      facts: [
        "Alex Ovechkin broke Wayne Gretzky's all-time NHL career goals record on April 6, 2025, scoring his 895th career goal against the New York Islanders — the record entirely with the Capitals franchise.",
        "The Capitals didn't win their first Stanley Cup until 2018, in the franchise's 44th season, beating the Vegas Golden Knights in five games — it was the first championship for a Washington, D.C. major pro sports team in 26 years.",
        "The Capitals' AHL affiliate, the Hershey Bears, is the oldest continuously-operating franchise in its original city in AHL history (since 1938) and has won more Calder Cups (13) than any other AHL team.",
      ],
      currentInfo: {
        owner: 'Ted Leonsis',
        headCoach: 'Spencer Carbery',
        lastVerified: '2026-09-01',
      },
    },

    // ── PIT (from Metropolitan sub-agent, completed) ────────────────────────────
    // VERIFIED: WBS + FLA affiliate abbrs both confirmed against real
    // ahlConfig.js/echlConfig.js (Wilkes-Barre/Scranton Penguins, Florida
    // Everblades) -- FLA is NOT a collision with NHL's Florida Panthers abbr,
    // it's a separate ECHL-namespaced config.
    // FLAG: ownership extremely fresh (Hoffmann Family bought from Fenway Sports
    // Group ~June 2026) -- agent couldn't fully confirm whether Lemieux/Burkle
    // retain any legacy stake, treat owner field as good-but-not-airtight.
    // FLAG: ECHL affiliate flipped from Wheeling Nailers to Florida Everblades in
    // July 2026 (tied to the ownership change) -- correct for now but very recent.
    PIT: {
      founded: {
        year: 1967,
        asFranchise: 'Pittsburgh Penguins (NHL expansion)',
        joinedNHL: 1967,
      },
      arena: {
        name: 'PPG Paints Arena',
        city: 'Pittsburgh, PA',
        capacity: 18187,
        opened: 2010,
        formerNames: [
          { name: 'Consol Energy Center', years: '2010–2016' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/PPG_Paints_Arena_-_March_2017.jpg',
          attribution: 'Jleedev, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Stanley Cup', years: [1991, 1992, 2009, 2016, 2017] },
      ],
      retiredNumbers: [
        { number: 21, player: 'Michel Brière' },
        { number: 66, player: 'Mario Lemieux' },
        { number: 68, player: 'Jaromir Jagr' },
      ],
      notableAlumni: [
        'Mario Lemieux', 'Sidney Crosby', 'Evgeni Malkin', 'Jaromir Jagr',
        'Paul Coffey', 'Ron Francis', 'Kris Letang',
      ],
      records: [
        { label: 'Most wins, single season', value: 56, season: '1992-93' },
        { label: 'Most points, single season', value: 119, season: '1992-93' },
      ],
      affiliates: { ahl: 'WBS', echl: 'FLA' },
      facts: [
        "Mario Lemieux is believed to be the only owner in major North American pro sports history who also played for the team he owned: after his playing-era deferred salary made him the team's largest creditor in its 1998–99 bankruptcy, his ownership group bought the Penguins, and he came out of retirement in December 2000 to play for the franchise he now owned.",
        'The Penguins nearly relocated in the mid-2000s amid a prolonged arena-funding fight before a deal produced their current arena (opened 2010 as Consol Energy Center, renamed PPG Paints Arena in 2016) — the building that likely kept the franchise in Pittsburgh.',
        'Back-to-back Stanley Cups in 2016 and 2017, led by the Crosby-Malkin-Letang core, made the Penguins the first team to repeat as champions since the NHL introduced the salary cap in 2005.',
      ],
      currentInfo: {
        owner: 'Geoff Hoffmann (Hoffmann Family of Companies)',
        headCoach: 'Dan Muse',
        lastVerified: '2026-09-01',
      },
    },

    // ── PHI (from Metropolitan sub-agent, completed) ────────────────────────────
    // IMPORTANT CATCH: agent corrected my brief's stale assumption -- the arena
    // is no longer "Wells Fargo Center" as of Sept 2025 (naming rights not
    // renewed), now "Xfinity Mobile Arena" through 2030-31. Wells Fargo Center
    // moved into formerNames.
    // VERIFIED: LV + REA affiliate abbrs confirmed against real
    // ahlConfig.js/echlConfig.js (Lehigh Valley Phantoms, Reading Royals).
    // FLAG: photo file (WellsFargoCenter-atDay.jpg) is real and verified but
    // predates the 2025 rename -- no post-rename Commons photography found yet,
    // same tradeoff CAR's original photo had before its own swap. Worth
    // revisiting once a Xfinity Mobile Arena-branded photo exists on Commons.
    // FLAG: head coach Rick Tocchet -- agent's most-confident answer but no
    // source dated close to Sept 2026 reconfirming, treat as good-not-airtight.
    PHI: {
      founded: {
        year: 1967,
        joinedNHL: 1967,
      },
      arena: {
        name: 'Xfinity Mobile Arena',
        city: 'Philadelphia, PA',
        capacity: 19173,
        opened: 1996,
        formerNames: [
          { name: 'CoreStates Center', years: '1996–1998' },
          { name: 'First Union Center', years: '1998–2003' },
          { name: 'Wachovia Center', years: '2003–2010' },
          { name: 'Wells Fargo Center', years: '2010–2025' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/WellsFargoCenter-atDay.jpg',
          attribution: 'Sp. Union-Rail, CC BY-SA 3.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Stanley Cup', years: [1974, 1975] },
      ],
      retiredNumbers: [
        { number: 1, player: 'Bernie Parent' },
        { number: 2, player: 'Mark Howe' },
        { number: 4, player: 'Barry Ashbee' },
        { number: 7, player: 'Bill Barber' },
        { number: 16, player: 'Bobby Clarke' },
        { number: 88, player: 'Eric Lindros' },
      ],
      notableAlumni: [
        'Bobby Clarke', 'Bernie Parent', 'Bill Barber', 'Mark Howe',
        'Eric Lindros', 'Reggie Leach', 'Claude Giroux',
      ],
      records: [
        { label: 'Most points, single season', value: 118, season: '1975-76' },
        { label: 'Most wins, single season', value: 53, season: '1984-85 (tied 1985-86)' },
      ],
      affiliates: { ahl: 'LV', echl: 'REA' },
      facts: [
        "The Flyers were the first NHL expansion team to win the Stanley Cup, doing it back-to-back in 1974 and 1975 as the physically dominant 'Broad Street Bullies.'",
        'The 1979-80 Flyers went 35 straight games without a loss (25-0-10) — still the longest unbeaten streak by a team in any major North American pro sport.',
        "The Flyers began playing Kate Smith's recording of 'God Bless America' before games in 1969 and went a remarkable 101-31-5 whenever it played; the team pulled the tradition in 2019 after Smith's history of racially insensitive recordings surfaced, though it has occasionally resurfaced since.",
      ],
      currentInfo: {
        owner: 'Dan Hilferty (Comcast Spectacor)',
        headCoach: 'Rick Tocchet',
        lastVerified: '2026-09-01',
      },
    },

    // ═══ ATLANTIC DIVISION (from a single non-delegating agent, all 8 direct) ═══
    // VERIFIED: every AHL/ECHL abbr below checked against the real config files.
    // Note TOR's AHL affiliate abbr is also 'TOR' (Toronto Marlies) -- a genuine
    // coincidental collision with the NHL abbr, not a bug; TeamLogo disambiguates
    // via its separate `sport` prop.

    // ── BOS ──────────────────────────────────────────────────────────────────
    // FIXED: owner field shortened (was a run-on explaining the Jacobs-family
    // succession situation) -- kept the substance, dropped the verbosity.
    // FLAG: ownership genuinely unsettled (Jeremy Jacobs is NHL's owner of
    // record but his six children have run day-to-day since 2019) -- described
    // rather than forced into a clean single name.
    // FLAG: Bergeron's #37 retirement is ANNOUNCED for Dec 1, 2026 but hasn't
    // happened yet as of lastVerified -- correctly kept out of retiredNumbers,
    // mentioned only in facts.
    BOS: {
      founded: {
        year: 1924,
        joinedNHL: 1924,
      },
      arena: {
        name: 'TD Garden',
        city: 'Boston, MA',
        capacity: 17850,
        opened: 1995,
        formerNames: [
          { name: 'FleetCenter', years: '1995–2005' },
          { name: 'TD Banknorth Garden', years: '2005–2009' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/TD_Garden_Entrance,_Boston_%2850203127996%29.jpg',
          attribution: 'ZekeDane, Public Domain Mark, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Stanley Cup', years: [1929, 1939, 1941, 1970, 1972, 2011] },
      ],
      retiredNumbers: [
        { number: 2, player: 'Eddie Shore' },
        { number: 3, player: 'Lionel Hitchman' },
        { number: 4, player: 'Bobby Orr' },
        { number: 5, player: 'Dit Clapper' },
        { number: 7, player: 'Phil Esposito' },
        { number: 8, player: 'Cam Neely' },
        { number: 9, player: 'Johnny Bucyk' },
        { number: 15, player: 'Milt Schmidt' },
        { number: 16, player: 'Rick Middleton' },
        { number: 22, player: "Willie O'Ree" },
        { number: 24, player: "Terry O'Reilly" },
        { number: 33, player: 'Zdeno Chara' },
        { number: 77, player: 'Ray Bourque' },
      ],
      notableAlumni: [
        'Bobby Orr', 'Phil Esposito', 'Ray Bourque', 'Cam Neely',
        'Patrice Bergeron', 'Zdeno Chara', 'Milt Schmidt',
      ],
      records: [
        { label: 'Most wins, single season', value: 65, season: '2022-23' },
        { label: 'Most points, single season', value: 135, season: '2022-23' },
      ],
      affiliates: { ahl: 'PRO', echl: 'MNE' },
      facts: [
        'The Bruins were the first United States-based team in the NHL, joining as an expansion club in 1924.',
        "Willie O'Ree broke the NHL's color barrier playing for Boston in 1958; his No. 22 was retired by the team in 2022.",
        "Patrice Bergeron's No. 37 is set to be retired in a TD Garden ceremony on December 1, 2026 — announced, but not yet retired as of this writing.",
      ],
      currentInfo: {
        owner: 'Jeremy Jacobs (Jacobs family)',
        headCoach: 'Marco Sturm',
        lastVerified: '2026-09-01',
      },
    },

    // ── BUF ──────────────────────────────────────────────────────────────────
    // FIXED (post-hoc, caught during Central-division cross-check): the
    // Atlantic agent's echl: 'JAX' was correct for 2025-26 but WRONG for
    // 2026-27 -- Jacksonville Icemen switched to Minnesota Wild/Iowa Wild in
    // May 2026 (confirmed via NHL.com + news4jax.com). Buffalo's real 2026-27
    // ECHL affiliate is unannounced/TBA as of research date -- verified via a
    // dedicated search, not guessed. Left echl unset, same treatment as NYR/UTA.
    BUF: {
      founded: {
        year: 1970,
        joinedNHL: 1970,
      },
      arena: {
        name: 'KeyBank Center',
        city: 'Buffalo, NY',
        capacity: 19070,
        opened: 1996,
        formerNames: [
          { name: 'Marine Midland Arena', years: '1996–2000' },
          { name: 'HSBC Arena', years: '2000–2011' },
          { name: 'First Niagara Center', years: '2011–2016' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/KeyBank_Center_from_side.jpg',
          attribution: 'Buffaboy, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [
        { number: 2, player: 'Tim Horton' },
        { number: 7, player: 'Rick Martin' },
        { number: 11, player: 'Gilbert Perreault' },
        { number: 14, player: 'Rene Robert' },
        { number: 16, player: 'Pat LaFontaine' },
        { number: 18, player: 'Danny Gare' },
        { number: 30, player: 'Ryan Miller' },
        { number: 39, player: 'Dominik Hasek' },
      ],
      notableAlumni: [
        'Gilbert Perreault', 'Dominik Hasek', 'Pat LaFontaine', 'Rick Martin',
        'Tim Horton', 'Ryan Miller', 'Rene Robert',
      ],
      records: [
        { label: 'Most wins, single season', value: 53, season: '2006-07' },
        { label: 'Most points, single season', value: 113, season: '2006-07' },
      ],
      affiliates: { ahl: 'ROC' },
      facts: [
        'Buffalo won the coin flip — literally a spinning wheel — against Vancouver for the first pick in the 1970 Amateur Draft, taking Gilbert Perreault.',
        "Tim Horton (co-founder of the Tim Hortons chain) played his final NHL games with Buffalo and died in a car accident during the 1973-74 season; his No. 2 was later retired.",
        "The 2025-26 Sabres ended the longest active playoff drought in NHL history (14 seasons) under returning head coach Lindy Ruff.",
      ],
      currentInfo: {
        owner: 'Terry Pegula',
        headCoach: 'Lindy Ruff',
        lastVerified: '2026-09-01',
      },
    },

    // ── DET ──────────────────────────────────────────────────────────────────
    // FIXED: dropped an inappropriate meta-reference in the agent's Fedorov fact
    // ("the franchise this file's Phase 0 entry belongs to") -- an internal
    // implementation detail that can't ship to users. Reworded to stand alone.
    DET: {
      founded: {
        year: 1926,
        asFranchise: 'Detroit Cougars',
        joinedNHL: 1926,
        relocations: [
          { year: 1930, from: 'Detroit, MI', to: 'Detroit, MI', renamedTo: 'Detroit Falcons', note: 'Name change only, no relocation' },
          { year: 1932, from: 'Detroit, MI', to: 'Detroit, MI', renamedTo: 'Detroit Red Wings', note: 'Renamed after purchase by James E. Norris' },
        ],
      },
      arena: {
        name: 'Little Caesars Arena',
        city: 'Detroit, MI',
        capacity: 19515,
        opened: 2017,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Little_Caesars_Arena_from_above.jpg',
          attribution: 'JJonahJackalope, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Stanley Cup', years: [1936, 1937, 1943, 1950, 1952, 1954, 1955, 1997, 1998, 2002, 2008] },
      ],
      retiredNumbers: [
        { number: 1, player: 'Terry Sawchuk' },
        { number: 4, player: 'Red Kelly' },
        { number: 5, player: 'Nicklas Lidstrom' },
        { number: 7, player: 'Ted Lindsay' },
        { number: 9, player: 'Gordie Howe' },
        { number: 10, player: 'Alex Delvecchio' },
        { number: 12, player: 'Sid Abel' },
        { number: 19, player: 'Steve Yzerman' },
        { number: 91, player: 'Sergei Fedorov' },
      ],
      notableAlumni: [
        'Gordie Howe', 'Steve Yzerman', 'Nicklas Lidstrom', 'Sergei Fedorov',
        'Terry Sawchuk', 'Ted Lindsay', 'Pavel Datsyuk',
      ],
      records: [
        { label: 'Most wins, single season', value: 62, season: '1995-96' },
        { label: 'Most points, single season', value: 131, season: '1995-96' },
      ],
      affiliates: { ahl: 'GR', echl: 'TOL' },
      facts: [
        'The franchise began as the Detroit Cougars (1926), was renamed the Detroit Falcons in 1930, and became the Detroit Red Wings in 1932 after James E. Norris bought it out of receivership.',
        "Detroit's 11 Stanley Cups are the most of any U.S.-based NHL franchise.",
        "Sergei Fedorov's No. 91 was retired on January 12, 2026, in a game against the Carolina Hurricanes.",
      ],
      currentInfo: {
        owner: 'Christopher Ilitch (Ilitch Holdings)',
        headCoach: 'Todd McLellan',
        lastVerified: '2026-09-01',
      },
    },

    // ── FLA ──────────────────────────────────────────────────────────────────
    // FIXED: '&amp;' -> '&' in formerNames.
    FLA: {
      founded: {
        year: 1993,
        joinedNHL: 1993,
      },
      arena: {
        name: 'Amerant Bank Arena',
        city: 'Sunrise, FL',
        capacity: 19250,
        opened: 1998,
        formerNames: [
          { name: 'National Car Rental Center', years: '1998–2002' },
          { name: 'Office Depot Center', years: '2002–2005' },
          { name: 'BankAtlantic Center', years: '2005–2012' },
          { name: 'BB&T Center', years: '2012–2021' },
          { name: 'FLA Live Arena', years: '2021–2023' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/View_of_Amerant_Bank_Arena_from_Publix_Plaza_before_a_Florida_Panthers_game_during_the_2023-24_season..jpg',
          attribution: 'Gatorfan252525, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Stanley Cup', years: [2024, 2025] },
      ],
      retiredNumbers: [
        { number: 1, player: 'Roberto Luongo' },
        { number: 37, player: 'Wayne Huizenga (franchise founder)' },
        { number: 93, player: 'Bill Torrey (first team president)' },
      ],
      notableAlumni: [
        'Roberto Luongo', 'Pavel Bure', 'Aleksander Barkov', 'Matthew Tkachuk',
        'Sergei Bobrovsky', 'Sam Reinhart',
      ],
      records: [
        { label: 'Most wins, single season', value: 58, season: '2021-22' },
        { label: 'Most points, single season', value: 122, season: '2021-22' },
      ],
      affiliates: { ahl: 'CLT', echl: 'SAV' },
      facts: [
        'The Panthers won back-to-back Stanley Cups in 2024 and 2025, both against the Edmonton Oilers — the 2024 win was the first championship in franchise history, ending a 31-year wait.',
        "Roberto Luongo's No. 1 (retired 2020) is the only retired number in team history belonging to a player who actually played for Florida — the other two honor the team's founder and first president.",
        'The team is named for the endangered Florida panther, and the franchise has actively supported panther conservation efforts in the state.',
      ],
      currentInfo: {
        owner: 'Vincent Viola',
        headCoach: 'Paul Maurice',
        lastVerified: '2026-09-01',
      },
    },

    // ── MTL ──────────────────────────────────────────────────────────────────
    // FIXED: '&amp;' -> '&' throughout retiredNumbers (3 shared-number entries).
    // FLAG (resolved by agent): a bad 1925 Cup year from a summarized search was
    // caught and discarded before it reached this list -- Montreal LOST the 1925
    // Final to Victoria, the correct 24-year list is below, cross-checked.
    MTL: {
      founded: {
        year: 1909,
        joinedNHL: 1917,
      },
      arena: {
        name: 'Bell Centre',
        city: 'Montréal, QC',
        capacity: 21105,
        opened: 1996,
        formerNames: [
          { name: 'Molson Centre', years: '1996–2002' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Centre_Bell,_Montreal,_Quebec_%2829773568150%29.jpg',
          attribution: 'Ken Lund, CC BY-SA 2.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Stanley Cup', years: [1916, 1924, 1930, 1931, 1944, 1946, 1953, 1956, 1957, 1958, 1959, 1960, 1965, 1966, 1968, 1969, 1971, 1973, 1976, 1977, 1978, 1979, 1986, 1993] },
      ],
      retiredNumbers: [
        { number: 1, player: 'Jacques Plante' },
        { number: 2, player: 'Doug Harvey' },
        { number: 3, player: 'Emile Bouchard' },
        { number: 4, player: 'Jean Béliveau' },
        { number: 5, player: 'Bernard Geoffrion & Guy Lapointe' },
        { number: 7, player: 'Howie Morenz' },
        { number: 9, player: 'Maurice Richard' },
        { number: 10, player: 'Guy Lafleur' },
        { number: 12, player: 'Dickie Moore & Yvan Cournoyer' },
        { number: 16, player: 'Elmer Lach & Henri Richard' },
        { number: 18, player: 'Serge Savard' },
        { number: 19, player: 'Larry Robinson' },
        { number: 23, player: 'Bob Gainey' },
        { number: 29, player: 'Ken Dryden' },
        { number: 33, player: 'Patrick Roy' },
      ],
      notableAlumni: [
        'Maurice Richard', 'Jean Béliveau', 'Guy Lafleur', 'Patrick Roy',
        'Ken Dryden', 'Larry Robinson', 'Howie Morenz',
      ],
      records: [
        { label: 'Most wins, single season', value: 60, season: '1976-77' },
        { label: 'Most points, single season', value: 132, season: '1976-77' },
      ],
      affiliates: { ahl: 'LAV', echl: 'TR' },
      facts: [
        "Montreal's 24 Stanley Cups are the most of any team in any of the four major North American pro sports leagues.",
        'The Canadiens have retired 15 jersey numbers representing 18 players — three numbers (5, 12, 16) are shared by two players each — more than any other NHL team.',
        "The 1976-77 team's 60 wins and 132 points stood as the all-time NHL single-season records for nearly five decades before Boston broke both in 2022-23.",
      ],
      currentInfo: {
        owner: 'Geoff Molson (Molson family)',
        headCoach: 'Martin St-Louis',
        lastVerified: '2026-09-01',
      },
    },

    // ── OTT ──────────────────────────────────────────────────────────────────
    // FLAG: ECHL affiliate (Allen Americans) source only explicitly confirmed
    // "for 2025-26" -- likely still current but not freshly re-confirmed for
    // 2026-27.
    OTT: {
      founded: {
        year: 1992,
        joinedNHL: 1992,
      },
      arena: {
        name: 'Canadian Tire Centre',
        city: 'Ottawa, ON',
        capacity: 18500,
        opened: 1996,
        formerNames: [
          { name: 'The Palladium', years: '1996' },
          { name: 'Corel Centre', years: '1996–2006' },
          { name: 'Scotiabank Place', years: '2006–2013' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Canadian_Tire_Centre_1.JPG',
          attribution: 'Ontario Images, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [
        { number: 4, player: 'Chris Phillips' },
        { number: 8, player: 'Frank Finnigan' },
        { number: 11, player: 'Daniel Alfredsson' },
        { number: 25, player: 'Chris Neil' },
      ],
      notableAlumni: [
        'Daniel Alfredsson', 'Chris Phillips', 'Jason Spezza', 'Erik Karlsson',
        'Chris Neil', 'Marian Hossa',
      ],
      records: [
        { label: 'Most wins, single season', value: 52, season: '2002-03' },
        { label: 'Most points, single season', value: 113, season: '2002-03' },
      ],
      affiliates: { ahl: 'BEL', echl: 'ALN' },
      facts: [
        "The modern Ottawa Senators (est. 1992) are a distinct NHL expansion franchise, not a legal continuation of the original 1883–1934 Ottawa Senators — but the club honors that heritage, including retiring Frank Finnigan's No. 8 from the original team.",
        'Ottawa reached the Stanley Cup Final once, in 2007, losing to the Anaheim Ducks — the franchise has yet to win a modern-era championship.',
        'The 52-win, 113-point mark was set in both 2002-03 and matched again in 2005-06.',
      ],
      currentInfo: {
        owner: 'Michael Andlauer',
        headCoach: 'Travis Green',
        lastVerified: '2026-09-01',
      },
    },

    // ── TBL ──────────────────────────────────────────────────────────────────
    // FLAG: Andreychuk's #25 deliberately NOT in retiredNumbers per agent (widely
    // discussed as a future candidate, not yet officially retired) -- correct
    // call, don't add it without a fresh check.
    // FLAG: arena renamed Benchmark International Arena Aug 2025 (was Amalie);
    // the verified photo file is still catalogued under the old "Amalie Arena"
    // filename -- same lag PHI's photo has, acceptable for now.
    TBL: {
      founded: {
        year: 1992,
        joinedNHL: 1992,
      },
      arena: {
        name: 'Benchmark International Arena',
        city: 'Tampa, FL',
        capacity: 19092,
        opened: 1996,
        formerNames: [
          { name: 'Ice Palace', years: '1996–2002' },
          { name: 'St. Pete Times Forum', years: '2002–2012' },
          { name: 'Tampa Bay Times Forum', years: '2012–2014' },
          { name: 'Amalie Arena', years: '2014–2025' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Amalie_Arena,_Tampa.jpg',
          attribution: 'Miosotis Jade, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Stanley Cup', years: [2004, 2020, 2021] },
      ],
      retiredNumbers: [
        { number: 4, player: 'Vincent Lecavalier' },
        { number: 26, player: 'Martin St-Louis' },
      ],
      notableAlumni: [
        'Vincent Lecavalier', 'Martin St-Louis', 'Steven Stamkos', 'Dave Andreychuk',
        'Nikita Kucherov', 'Victor Hedman',
      ],
      records: [
        { label: 'Most wins, single season', value: 62, season: '2018-19' },
        { label: 'Most points, single season', value: 128, season: '2018-19' },
      ],
      affiliates: { ahl: 'SYR', echl: 'ORL' },
      facts: [
        "The Lightning's home arena was renamed Benchmark International Arena in August 2025 after a decade as Amalie Arena — it's been the Ice Palace, two Times Forums, Amalie, and now Benchmark since opening in 1996.",
        'Tampa Bay won back-to-back Stanley Cups in 2020 and 2021, the second inside the COVID-affected bubble/reduced-attendance format.',
        "The 2018-19 team's 62 wins tied the then-NHL record (shared with 1995-96 Detroit), and their 128 points remain a franchise record.",
      ],
      currentInfo: {
        owner: 'Jeff Vinik',
        headCoach: 'Jon Cooper',
        lastVerified: '2026-09-01',
      },
    },

    // ── TOR ──────────────────────────────────────────────────────────────────
    // FIXED: '&amp;' -> '&' throughout retiredNumbers (5 shared-number entries).
    // FIXED: owner field shortened (was a run-on about the pending Tanenbaum
    // buyout) -- kept the substance.
    // FLAG: ownership genuinely mid-transaction -- Rogers majority (75%) with a
    // deal for Tanenbaum's remaining 25% pending, expected to close Q4 2026
    // (after lastVerified). Re-check once that closes.
    // FLAG: head coach Jim Hiller hired June 2026 (Berube fired May 2026) --
    // very recent, re-verify close to ship.
    TOR: {
      founded: {
        year: 1917,
        asFranchise: 'Toronto Arenas',
        joinedNHL: 1917,
        relocations: [
          { year: 1919, from: 'Toronto, ON', to: 'Toronto, ON', renamedTo: 'Toronto St. Patricks', note: 'Sold to the St. Patrick Hockey Club, no relocation' },
          { year: 1927, from: 'Toronto, ON', to: 'Toronto, ON', renamedTo: 'Toronto Maple Leafs', note: 'Renamed by new owner Conn Smythe' },
        ],
      },
      arena: {
        name: 'Scotiabank Arena',
        city: 'Toronto, ON',
        capacity: 18800,
        opened: 1999,
        formerNames: [
          { name: 'Air Canada Centre', years: '1999–2018' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Scotiabank_Arena.jpg',
          attribution: 'Paperfire, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Stanley Cup', years: [1918, 1922, 1932, 1942, 1945, 1947, 1948, 1949, 1951, 1962, 1963, 1964, 1967] },
      ],
      retiredNumbers: [
        { number: 1, player: 'Turk Broda & Johnny Bower' },
        { number: 4, player: 'Hap Day & Red Kelly' },
        { number: 5, player: 'Bill Barilko' },
        { number: 6, player: 'Ace Bailey' },
        { number: 7, player: 'King Clancy & Tim Horton' },
        { number: 9, player: 'Charlie Conacher & Ted Kennedy' },
        { number: 10, player: 'Syl Apps & George Armstrong' },
        { number: 13, player: 'Mats Sundin' },
        { number: 14, player: 'Dave Keon' },
        { number: 17, player: 'Wendel Clark' },
        { number: 21, player: 'Borje Salming' },
        { number: 27, player: 'Frank Mahovlich & Darryl Sittler' },
        { number: 93, player: 'Doug Gilmour' },
      ],
      notableAlumni: [
        'Dave Keon', 'George Armstrong', 'Darryl Sittler', 'Borje Salming',
        'Mats Sundin', 'Doug Gilmour', 'Johnny Bower',
      ],
      records: [
        { label: 'Most wins, single season', value: 54, season: '2021-22' },
        { label: 'Most points, single season', value: 115, season: '2021-22' },
      ],
      affiliates: { ahl: 'TOR', echl: 'CIN' },
      facts: [
        'The franchise began as the Toronto Arenas (1917), became the Toronto St. Patricks in 1919, and was renamed the Maple Leafs in 1927 by new owner Conn Smythe.',
        "Toronto was the first team in any of the four major North American pro sports leagues to retire a number, taking Ace Bailey's No. 6 out of circulation in 1934 after a career-ending injury.",
        "The Leafs retired 17 players' numbers (13 jersey numbers) in a single ceremony during their 2016 centennial celebration, having previously \"honoured\" rather than formally retired most of them.",
      ],
      currentInfo: {
        owner: 'Rogers Communications (majority; full buyout of Tanenbaum stake pending)',
        headCoach: 'Jim Hiller',
        lastVerified: '2026-09-01',
      },
    },

    // ═══ PACIFIC DIVISION (from a single non-delegating agent, all 8 direct) ═══
    // VERIFIED: every AHL/ECHL abbr checked against real config files -- all correct.
    // Cross-validation: this agent independently found VGK lost the 2026 Cup
    // Final to Carolina, consistent with the CAR fix Matt gave earlier
    // (championships years [2006, 2026]) -- good sign the two research passes
    // agree on the same real-world event from different angles.

    // ── ANA ──────────────────────────────────────────────────────────────────
    // FIXED: '&amp;' -> '&' in owner.
    ANA: {
      founded: {
        year: 1993,
        asFranchise: 'Mighty Ducks of Anaheim',
        joinedNHL: 1993,
        relocations: [
          { year: 2006, from: 'Anaheim, CA (Mighty Ducks of Anaheim)', to: 'Anaheim, CA', renamedTo: 'Anaheim Ducks', note: 'Disney sold the team to Henry and Susan Samueli in 2005; "Mighty" dropped after a fan poll' },
        ],
      },
      arena: {
        name: 'Honda Center',
        city: 'Anaheim, CA',
        capacity: 17174,
        opened: 1993,
        formerNames: [
          { name: 'Arrowhead Pond of Anaheim', years: '1993–2006' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Honda_center_2021.jpg',
          attribution: 'Troutfarm27, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Stanley Cup', years: [2007] },
      ],
      retiredNumbers: [
        { number: 8, player: 'Teemu Selanne' },
        { number: 9, player: 'Paul Kariya' },
        { number: 27, player: 'Scott Niedermayer' },
      ],
      notableAlumni: [
        'Teemu Selanne', 'Paul Kariya', 'Scott Niedermayer', 'Ryan Getzlaf', 'Corey Perry', 'Chris Pronger',
      ],
      records: [
        { label: 'Most wins, single season', value: 54, season: '2013-14' },
        { label: 'Most points, single season', value: 116, season: '2013-14' },
      ],
      affiliates: { ahl: 'SD', echl: 'TUL' },
      facts: [
        "The franchise is the only major North American pro sports team ever named directly after a movie — Disney chairman Michael Eisner named the 1993 expansion team after Disney's own 1992 film \"The Mighty Ducks.\"",
        "The Ducks dropped \"Mighty\" from their name for the 2006-07 season, their first under new owners Henry and Susan Samueli — and promptly won the franchise's first Stanley Cup that same season.",
        "Teemu Selanne and Paul Kariya, the Ducks' first two retired numbers, were inducted into the Hockey Hall of Fame together in the same 2017 class.",
      ],
      currentInfo: {
        owner: 'Henry & Susan Samueli',
        headCoach: 'Joel Quenneville',
        lastVerified: '2026-09-01',
      },
    },

    // ── CGY ──────────────────────────────────────────────────────────────────
    // FIXED: '&amp;' -> '&' in owner.
    CGY: {
      founded: {
        year: 1972,
        asFranchise: 'Atlanta Flames',
        joinedNHL: 1972,
        relocations: [
          { year: 1980, from: 'Atlanta, GA', to: 'Calgary, AB', renamedTo: 'Calgary Flames' },
        ],
      },
      arena: {
        name: 'Scotiabank Saddledome',
        city: 'Calgary, AB',
        capacity: 19289,
        opened: 1983,
        formerNames: [
          { name: 'Olympic Saddledome', years: '1983–1995' },
          { name: 'Canadian Airlines Saddledome', years: '1995–2000' },
          { name: 'Pengrowth Saddledome', years: '2000–2010' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Scotiabank_Saddledome,_southeast_view_20240819_1.jpg',
          attribution: 'DXR, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Stanley Cup', years: [1989] },
      ],
      retiredNumbers: [
        { number: 9, player: 'Lanny McDonald' },
        { number: 12, player: 'Jarome Iginla' },
        { number: 30, player: 'Mike Vernon' },
        { number: 34, player: 'Miikka Kiprusoff' },
      ],
      notableAlumni: [
        'Lanny McDonald', 'Jarome Iginla', 'Al MacInnis', 'Joe Nieuwendyk', 'Doug Gilmour', 'Theoren Fleury',
      ],
      records: [
        { label: 'Most wins, single season', value: 54, season: '1988-89' },
        { label: 'Most points, single season', value: 117, season: '1988-89' },
      ],
      affiliates: { ahl: 'CGY', echl: 'RC' },
      facts: [
        'The franchise began life in 1972 as the Atlanta Flames — an unrelated lineage from the later Atlanta Thrashers, who became the Winnipeg Jets in 2011.',
        "The Flames' only Stanley Cup, in 1989, remains the last Cup Final ever contested between two Canadian teams, and the only time a team has won the Cup on Montreal Forum ice.",
        'That 1989 championship roster featured five future Hockey Hall of Famers — McDonald, MacInnis, Nieuwendyk, Gilmour, and Joe Mullen — with MacInnis winning the Conn Smythe Trophy.',
      ],
      currentInfo: {
        owner: 'N. Murray Edwards (Calgary Sports & Entertainment)',
        headCoach: 'Ryan Huska',
        lastVerified: '2026-09-01',
      },
    },

    // ── EDM ──────────────────────────────────────────────────────────────────
    // FLAG: 1973 WHA rename detail (Alberta Oilers -> Edmonton Oilers) sourced
    // from a secondary aggregator, not a primary source -- moderately confident.
    EDM: {
      founded: {
        year: 1972,
        asFranchise: 'Alberta Oilers (WHA)',
        joinedNHL: 1979,
        relocations: [
          { year: 1973, from: 'Alberta Oilers (WHA)', to: 'Edmonton, AB', renamedTo: 'Edmonton Oilers', note: "Renamed after one season once Edmonton was confirmed as the WHA's only Alberta franchise" },
          { year: 1979, from: 'Edmonton Oilers (WHA)', to: 'Edmonton, AB', renamedTo: 'Edmonton Oilers (NHL)', note: 'NHL–WHA merger; no physical relocation' },
        ],
      },
      arena: {
        name: 'Rogers Place',
        city: 'Edmonton, AB',
        capacity: 18347,
        opened: 2016,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Rogers_Place,_Edmonton,_June_6,_2024.jpg',
          attribution: 'D. Benjamin Miller, CC0 1.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Stanley Cup', years: [1984, 1985, 1987, 1988, 1990] },
      ],
      retiredNumbers: [
        { number: 3, player: 'Al Hamilton' },
        { number: 4, player: 'Kevin Lowe' },
        { number: 7, player: 'Paul Coffey' },
        { number: 9, player: 'Glenn Anderson' },
        { number: 11, player: 'Mark Messier' },
        { number: 17, player: 'Jari Kurri' },
        { number: 31, player: 'Grant Fuhr' },
        { number: 99, player: 'Wayne Gretzky' },
      ],
      notableAlumni: [
        'Wayne Gretzky', 'Mark Messier', 'Jari Kurri', 'Paul Coffey', 'Grant Fuhr', 'Glenn Anderson',
      ],
      records: [
        { label: 'Most wins, single season', value: 57, season: '1983-84' },
        { label: 'Most points, single season', value: 119, season: '1983-84' },
      ],
      affiliates: { ahl: 'BAK', echl: 'FW' },
      facts: [
        'The Oilers won five Stanley Cups in seven seasons (1984-1990), a run often called the greatest dynasty in NHL history.',
        "The August 1988 trade of Wayne Gretzky to the Los Angeles Kings is widely regarded as the most significant trade in North American sports history — the Oilers still won the Cup again in 1990, without him.",
        "The 1983-84 team set the NHL record for goals in a season (446) en route to the franchise's still-standing single-season records for wins (57) and points (119).",
      ],
      currentInfo: {
        owner: 'Daryl Katz',
        headCoach: 'Mike Babcock',
        lastVerified: '2026-09-01',
      },
    },

    // ── LAK ──────────────────────────────────────────────────────────────────
    LAK: {
      founded: {
        year: 1967,
        joinedNHL: 1967,
      },
      arena: {
        name: 'Crypto.com Arena',
        city: 'Los Angeles, CA',
        capacity: 18145,
        opened: 1999,
        formerNames: [
          { name: 'Staples Center', years: '1999–2021' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Crypto.com_Arena_exterior_2023.jpg',
          attribution: 'Troutfarm27, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Stanley Cup', years: [2012, 2014] },
      ],
      retiredNumbers: [
        { number: 4, player: 'Rob Blake' },
        { number: 16, player: 'Marcel Dionne' },
        { number: 18, player: 'Dave Taylor' },
        { number: 20, player: 'Luc Robitaille' },
        { number: 23, player: 'Dustin Brown' },
        { number: 30, player: 'Rogie Vachon' },
        { number: 99, player: 'Wayne Gretzky' },
      ],
      notableAlumni: [
        'Wayne Gretzky', 'Marcel Dionne', 'Luc Robitaille', 'Rob Blake', 'Anze Kopitar', 'Drew Doughty',
      ],
      records: [
        { label: 'Most points, single season', value: 105, season: '2024-25' },
        { label: 'Most wins, single season', value: 48, season: '2024-25' },
      ],
      affiliates: { ahl: 'ONT', echl: 'GVL' },
      facts: [
        'The Kings were one of six teams admitted in the NHL\'s 1967 "Original Expansion," doubling the league\'s size from six to twelve teams overnight.',
        'The 2012 Kings remain the lowest seed (8th in the West) ever to win the Stanley Cup, winning an NHL-record 10 consecutive road playoff games along the way.',
        'The 2024-25 team tied or set franchise records for both wins (48, matching 2015-16) and points (105, matching the 1974-75 team).',
      ],
      currentInfo: {
        owner: 'Philip Anschutz (AEG)',
        headCoach: 'Peter Laviolette',
        lastVerified: '2026-09-01',
      },
    },

    // ── SJS ──────────────────────────────────────────────────────────────────
    SJS: {
      founded: {
        year: 1991,
        joinedNHL: 1991,
      },
      arena: {
        name: 'SAP Center',
        city: 'San Jose, CA',
        capacity: 17435,
        opened: 1993,
        formerNames: [
          { name: 'San Jose Arena', years: '1993–2001' },
          { name: 'Compaq Center', years: '2001–2002' },
          { name: 'HP Pavilion', years: '2002–2013' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/SAP_Center_San_Jose.jpg',
          attribution: 'Dicklyon, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [
        { number: 12, player: 'Patrick Marleau' },
        { number: 19, player: 'Joe Thornton' },
      ],
      notableAlumni: [
        'Patrick Marleau', 'Joe Thornton', 'Owen Nolan', 'Joe Pavelski', 'Evgeni Nabokov',
      ],
      records: [
        { label: 'Most wins, single season', value: 53, season: '2008-09' },
        { label: 'Most points, single season', value: 117, season: '2008-09' },
      ],
      affiliates: { ahl: 'SJ', echl: 'WIC' },
      facts: [
        'San Jose had never hosted a major North American professional sports franchise before the Sharks arrived in 1991.',
        "The Sharks played their first two seasons (1991-93) at San Francisco's Cow Palace while their own arena was under construction.",
        'Jonathan Cheechoo is the only 50-goal scorer in franchise history, netting 56 in 2005-06 to win the Rocket Richard Trophy.',
      ],
      currentInfo: {
        owner: 'Hasso Plattner',
        headCoach: 'Ryan Warsofsky',
        lastVerified: '2026-09-01',
      },
    },

    // ── SEA ──────────────────────────────────────────────────────────────────
    // FIXED: '&amp;' -> '&' in owner.
    SEA: {
      founded: {
        year: 2021,
        joinedNHL: 2021,
      },
      arena: {
        name: 'Climate Pledge Arena',
        city: 'Seattle, WA',
        capacity: 17151,
        opened: 1962,
        formerNames: [
          { name: 'Washington State Coliseum', years: '1962–1964' },
          { name: 'Seattle Center Coliseum', years: '1964–1995' },
          { name: 'KeyArena', years: '1995–2018' },
        ],
        // Building dates to the 1962 World's Fair, but was gutted and rebuilt
        // entirely beneath its landmarked roof for roughly $1.15B, reopening
        // under the current name in Oct 2021 -- the Kraken have only ever
        // played here as Climate Pledge Arena.
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Climate_Pledge_Arena,_Seattle.jpg',
          attribution: 'JJonahJackalope, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: [
        'Jordan Eberle', 'Matty Beniers', 'Jared McCann', 'Vince Dunn', 'Brandon Tanev',
      ],
      records: [
        { label: 'Most wins, single season', value: 46, season: '2022-23' },
        { label: 'Most points, single season', value: 100, season: '2022-23' },
      ],
      affiliates: { ahl: 'CV', echl: 'KC' },
      facts: [
        'The team name blends Nordic sea-monster mythology with the giant Pacific octopus native to nearby Puget Sound.',
        "The Kraken have retired the number 32 — not for a player, but in honor of the roughly 32,000 fans who put down season-ticket deposits on the franchise's first day, and as a nod to Seattle being the NHL's 32nd franchise.",
        "The Kraken's first-ever game was a loss to Vegas; two nights later they beat Nashville for the first win in franchise history.",
      ],
      currentInfo: {
        owner: 'David Bonderman & Jerry Bruckheimer',
        headCoach: 'Lane Lambert',
        lastVerified: '2026-09-01',
      },
    },

    // ── VAN ──────────────────────────────────────────────────────────────────
    VAN: {
      founded: {
        year: 1970,
        joinedNHL: 1970,
      },
      arena: {
        name: 'Rogers Arena',
        city: 'Vancouver, BC',
        capacity: 18871,
        opened: 1995,
        formerNames: [
          { name: 'General Motors Place', years: '1995–2010' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Rogers_Arena_%28Vancouver%29.jpg',
          attribution: 'Quintin Soloviev, CC BY 4.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [
        { number: 10, player: 'Pavel Bure' },
        { number: 12, player: 'Stan Smyl' },
        { number: 16, player: 'Trevor Linden' },
        { number: 19, player: 'Markus Naslund' },
        { number: 22, player: 'Daniel Sedin' },
        { number: 33, player: 'Henrik Sedin' },
      ],
      notableAlumni: [
        'Henrik Sedin', 'Daniel Sedin', 'Pavel Bure', 'Trevor Linden', 'Markus Naslund', 'Roberto Luongo',
      ],
      records: [
        { label: 'Most wins, single season', value: 54, season: '2010-11' },
        { label: 'Most points, single season', value: 117, season: '2010-11' },
      ],
      affiliates: { ahl: 'ABB', echl: 'KAL' },
      facts: [
        'The Canucks have reached the Stanley Cup Final three times (1982, 1994, 2011) without ever winning it.',
        'The 2011 Final loss to Boston triggered a riot in downtown Vancouver that caused roughly $4 million CAD in damage — an ugly echo of a smaller riot after the 1994 Final loss.',
        "Twins Henrik and Daniel Sedin won back-to-back Art Ross Trophies as the NHL's leading scorer (Henrik in 2009-10, Daniel in 2010-11) and were inducted into the Hockey Hall of Fame together in 2022.",
      ],
      currentInfo: {
        owner: 'Francesco Aquilini',
        headCoach: 'Manny Malhotra',
        lastVerified: '2026-09-01',
      },
    },

    // ── VGK ──────────────────────────────────────────────────────────────────
    // FLAG: arena listed as "Las Vegas, NV" per common branding convention;
    // T-Mobile Arena is technically in unincorporated Paradise, NV.
    VGK: {
      founded: {
        year: 2017,
        joinedNHL: 2017,
      },
      arena: {
        name: 'T-Mobile Arena',
        city: 'Las Vegas, NV',
        capacity: 17500,
        opened: 2016,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/T-Mobile_Arena_%2853326151511%29.jpg',
          attribution: 'Tomás Del Coro, CC BY-SA 2.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Stanley Cup', years: [2023] },
      ],
      retiredNumbers: [],
      notableAlumni: [
        'Marc-Andre Fleury', 'William Karlsson', 'Jonathan Marchessault', 'Reilly Smith', 'Mark Stone',
      ],
      records: [
        { label: 'Most wins, single season', value: 51, season: '2017-18' },
        { label: 'Most points, single season', value: 110, season: '2024-25' },
      ],
      affiliates: { ahl: 'HSK', echl: 'TAH' },
      facts: [
        'Vegas won the Stanley Cup in its sixth season (2023), the fastest an expansion team has done so in the post-1967 expansion era.',
        "In their inaugural 2017-18 season, the Golden Knights set records for most wins and points ever by a first-year expansion team, and reached the Stanley Cup Final — something no first-year expansion team had done since the 1967-68 St. Louis Blues.",
        'No Golden Knight has worn #29 since Marc-Andre Fleury, the face of the expansion franchise, was traded away in 2021 — an informal honor ahead of any official jersey retirement.',
      ],
      currentInfo: {
        owner: 'Bill Foley',
        headCoach: 'Ryan Craig',
        lastVerified: '2026-09-01',
      },
    },

    // ═══ CENTRAL DIVISION (agent's 5 sub-agents never reported; agent itself
    // confirmed no status-check tool exists, gave up waiting per instruction,
    // and did all 8 teams directly -- if the 5 orphaned sub-agents ever DO
    // report later, their output is redundant, discard it) ═══
    // VERIFIED: every AHL/ECHL abbr checked against real config files.
    // CROSS-VALIDATED: WPG's echl:'BLM' (Bloomington Bison) independently
    // confirmed by the Metropolitan-division NYR agent, which found Bloomington
    // had just left the Rangers' orbit for Winnipeg/Manitoba -- two unrelated
    // research passes agreeing on the same real event.
    // CAUGHT A CROSS-DIVISION CONFLICT: this batch's MIN entry (echl: 'JAX')
    // conflicted with the earlier Atlantic batch's BUF entry (also 'JAX') --
    // verified via direct search that Jacksonville moved from Buffalo to
    // Minnesota in May 2026; fixed BUF's entry above (now unset/TBA) rather
    // than guessing which was right.

    // ── CHI ──────────────────────────────────────────────────────────────────
    // FIXED: agent's own output was garbled mid-generation for `records` (left
    // contradictory draft text in the code block, apologized afterward) --
    // reconstructed cleanly from its own follow-up correction (52 wins / 112
    // points, both 2009-10).
    // FIXED: '&amp;' -> '&' in retiredNumbers.
    CHI: {
      founded: {
        year: 1926,
        joinedNHL: 1926,
      },
      arena: {
        name: 'United Center',
        city: 'Chicago, IL',
        capacity: 19717,
        opened: 1994,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/United_Center_1.jpg',
          attribution: 'Alacoolwiki, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Stanley Cup', years: [1934, 1938, 1961, 2010, 2013, 2015] },
      ],
      retiredNumbers: [
        { number: 1, player: 'Glenn Hall' },
        { number: 3, player: 'Pierre Pilote & Keith Magnuson' },
        { number: 7, player: 'Chris Chelios' },
        { number: 9, player: 'Bobby Hull' },
        { number: 18, player: 'Denis Savard' },
        { number: 21, player: 'Stan Mikita' },
        { number: 35, player: 'Tony Esposito' },
        { number: 81, player: 'Marian Hossa' },
      ],
      notableAlumni: [
        'Bobby Hull', 'Stan Mikita', 'Tony Esposito', 'Denis Savard',
        'Chris Chelios', 'Jonathan Toews', 'Patrick Kane',
      ],
      records: [
        { label: 'Most wins, single season', value: 52, season: '2009-10' },
        { label: 'Most points, single season', value: 112, season: '2009-10' },
      ],
      affiliates: { ahl: 'CHI', echl: 'IND' },
      facts: [
        'The Blackhawks played at the original Chicago Stadium from 1929 until 1994, when they moved next door to the United Center.',
        "Chicago's own AHL affiliate, the Chicago Wolves, share the Blackhawks' home city and abbreviation despite being a separate franchise.",
        'Owner Danny Wirtz is the fourth generation of the Wirtz family — and the sixth principal owner in franchise history — to run the Blackhawks.',
      ],
      currentInfo: {
        owner: 'Danny Wirtz',
        headCoach: 'Jeff Blashill',
        lastVerified: '2026-09-01',
      },
    },

    // ── COL ──────────────────────────────────────────────────────────────────
    // FIXED: '&amp;' -> '&' in owner.
    COL: {
      founded: {
        year: 1972,
        asFranchise: 'Quebec Nordiques (WHA)',
        joinedNHL: 1979,
        relocations: [
          { year: 1995, from: 'Quebec City, QC', to: 'Denver, CO', renamedTo: 'Colorado Avalanche', note: 'NHL–WHA merger in 1979 preceded the Denver relocation by 16 years; Quebec never won a Stanley Cup' },
        ],
      },
      arena: {
        name: 'Ball Arena',
        city: 'Denver, CO',
        capacity: 18007,
        opened: 1999,
        formerNames: [
          { name: 'Pepsi Center', years: '1999–2020' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Ball_Arena_exterior_2022.jpg',
          attribution: 'Troutfarm27, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Stanley Cup', years: [1996, 2001, 2022] },
      ],
      retiredNumbers: [
        { number: 19, player: 'Joe Sakic' },
        { number: 21, player: 'Peter Forsberg' },
        { number: 23, player: 'Milan Hejduk' },
        { number: 33, player: 'Patrick Roy' },
        { number: 52, player: 'Adam Foote' },
        { number: 77, player: 'Ray Bourque' },
      ],
      notableAlumni: [
        'Joe Sakic', 'Patrick Roy', 'Peter Forsberg', 'Ray Bourque',
        'Milan Hejduk', 'Adam Foote',
      ],
      records: [
        { label: 'Most points, single season', value: 118, season: '2000-01' },
        { label: 'Most wins, single season', value: 52, season: '2000-01' },
      ],
      affiliates: { ahl: 'COL', echl: 'NM' },
      facts: [
        "The Avalanche franchise began as the Quebec Nordiques — Quebec never won a Stanley Cup, but the same franchise won three after moving to Denver in 1995 (1996, 2001, 2022).",
        "The Avalanche's ECHL affiliate changed for 2026-27 to the expansion New Mexico Goatheads, after longtime affiliate the Utah Grizzlies announced a relocation to New Jersey.",
        'Ball Arena carried the Pepsi Center name for its first 21 years before Ball Corporation bought the naming rights in 2020.',
      ],
      currentInfo: {
        owner: 'Stan Kroenke (Kroenke Sports & Entertainment)',
        headCoach: 'Jared Bednar',
        lastVerified: '2026-09-01',
      },
    },

    // ── DAL ──────────────────────────────────────────────────────────────────
    DAL: {
      founded: {
        year: 1967,
        asFranchise: 'Minnesota North Stars',
        joinedNHL: 1967,
        relocations: [
          { year: 1993, from: 'Bloomington, MN', to: 'Dallas, TX', renamedTo: 'Dallas Stars' },
        ],
      },
      arena: {
        name: 'American Airlines Center',
        city: 'Dallas, TX',
        capacity: 18532,
        opened: 2001,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Exterior_of_American_Airlines_Center_2026.jpg',
          attribution: 'BullDawg2021, CC BY 4.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Stanley Cup', years: [1999] },
      ],
      retiredNumbers: [
        { number: 7, player: 'Neal Broten' },
        { number: 8, player: 'Bill Goldsworthy' },
        { number: 9, player: 'Mike Modano' },
        { number: 19, player: 'Bill Masterton' },
        { number: 26, player: 'Jere Lehtinen' },
        { number: 56, player: 'Sergei Zubov' },
      ],
      notableAlumni: [
        'Mike Modano', 'Brett Hull', 'Ed Belfour', 'Joe Nieuwendyk',
        'Neal Broten', 'Jere Lehtinen',
      ],
      records: [
        { label: 'Most wins, single season', value: 51, season: '1998-99' },
        { label: 'Most points, single season', value: 114, season: '1998-99' },
      ],
      affiliates: { ahl: 'TEX', echl: 'IDH' },
      facts: [
        "The Stars franchise began as the Minnesota North Stars in 1967 and moved to Dallas in 1993 — a completely different, unrelated expansion franchise (the Wild) later filled Minnesota's NHL gap in 2000.",
        'The Stars won their only Stanley Cup in 1999, the same season they set their still-standing franchise records for wins (51) and points (114).',
        "Glen Gulutzan's 2025 hiring as head coach is his second stint with the Stars — he first coached Dallas from 2011 to 2013.",
      ],
      currentInfo: {
        owner: 'Tom Gaglardi',
        headCoach: 'Glen Gulutzan',
        lastVerified: '2026-09-01',
      },
    },

    // ── MIN ──────────────────────────────────────────────────────────────────
    MIN: {
      founded: {
        year: 1997,
        joinedNHL: 2000,
      },
      arena: {
        name: 'Grand Casino Arena',
        city: 'St. Paul, MN',
        capacity: 17954,
        opened: 2000,
        formerNames: [
          { name: 'Xcel Energy Center', years: '2000–2025' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Saint_Paul_April_2025_13_%28Xcel_Energy_Center%29.jpg',
          attribution: 'Michael Barera, CC BY-SA 4.0, via Wikimedia Commons — taken shortly before the Sept 2025 rename, same building',
        },
      },
      championships: [],
      // #1 was raised to the rafters before the franchise's first game as a
      // fan tribute, never issued to a player -- doesn't fit the
      // number+player-name chip UI (see the facts entry below instead), so
      // deliberately left out of retiredNumbers rather than forced in.
      retiredNumbers: [],
      notableAlumni: [
        'Marian Gaborik', 'Mikko Koivu', 'Niklas Backstrom', 'Zach Parise',
        'Ryan Suter', 'Kirill Kaprizov',
      ],
      records: [
        { label: 'Most wins, single season', value: 53, season: '2021-22' },
        { label: 'Most points, single season', value: 113, season: '2021-22' },
      ],
      affiliates: { ahl: 'IA', echl: 'JAX' },
      facts: [
        "The Wild's #1 is the only number the franchise has ever retired — raised to the rafters before its inaugural 2000 game, in honor of Minnesota's hockey fans rather than any individual player.",
        'Minnesota had been without an NHL team since the original North Stars left for Dallas in 1993; the Wild is a completely separate expansion franchise with no lineage connection to that team.',
        "The team's home arena was renamed Grand Casino Arena in September 2025 after 25 years as Xcel Energy Center.",
      ],
      currentInfo: {
        owner: 'Craig Leipold',
        headCoach: 'John Hynes',
        lastVerified: '2026-09-01',
      },
    },

    // ── NSH ──────────────────────────────────────────────────────────────────
    NSH: {
      founded: {
        year: 1997,
        joinedNHL: 1998,
      },
      arena: {
        name: 'Bridgestone Arena',
        city: 'Nashville, TN',
        capacity: 17159,
        opened: 1996,
        formerNames: [
          { name: 'Nashville Arena', years: '1996–1999' },
          { name: 'Gaylord Entertainment Center', years: '1999–2007' },
          { name: 'Sommet Center', years: '2007–2010' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Bridgestone_Arena_%28North_face%29_1.JPG',
          attribution: 'Michael Rivera, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [
        { number: 35, player: 'Pekka Rinne' },
      ],
      notableAlumni: [
        'Pekka Rinne', 'Shea Weber', 'David Legwand', 'Paul Kariya',
        'David Poile', 'Roman Josi',
      ],
      records: [
        { label: 'Most wins, single season', value: 53, season: '2017-18' },
        { label: 'Most points, single season', value: 117, season: '2017-18' },
      ],
      affiliates: { ahl: 'MIL', echl: 'ATL' },
      facts: [
        "Pekka Rinne's #35, retired in 2022, is the only number the Predators have retired in their 28-year history.",
        "The Predators' 2017-18 team — which set franchise records for wins (53) and points (117) and won the Presidents' Trophy — reached the Stanley Cup Final the year before, in 2017.",
        'Longtime GM David Poile, who built the franchise from its 1998 expansion season, is a Hockey Hall of Fame builder inductee.',
      ],
      currentInfo: {
        owner: 'Bill Haslam',
        headCoach: 'Andrew Brunette',
        lastVerified: '2026-09-01',
      },
    },

    // ── STL ──────────────────────────────────────────────────────────────────
    STL: {
      founded: {
        year: 1967,
        joinedNHL: 1967,
      },
      arena: {
        name: 'Enterprise Center',
        city: 'St. Louis, MO',
        capacity: 18096,
        opened: 1994,
        formerNames: [
          { name: 'Kiel Center', years: '1994–2000' },
          { name: 'Savvis Center', years: '2000–2006' },
          { name: 'Scottrade Center', years: '2006–2018' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/St._Louis_blues_home_enterprise_center.jpg',
          attribution: 'Johnhochi, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Stanley Cup', years: [2019] },
      ],
      retiredNumbers: [
        { number: 2, player: 'Al MacInnis' },
        { number: 3, player: 'Bob Gassoff' },
        { number: 5, player: 'Bob Plager' },
        { number: 8, player: 'Barclay Plager' },
        { number: 11, player: 'Brian Sutter' },
        { number: 16, player: 'Brett Hull' },
        { number: 24, player: 'Bernie Federko' },
        { number: 44, player: 'Chris Pronger' },
      ],
      notableAlumni: [
        'Bernie Federko', 'Brett Hull', 'Al MacInnis', 'Chris Pronger',
        'Glenn Hall', 'Brian Sutter',
      ],
      records: [
        { label: 'Most wins, single season', value: 52, season: '2013-14' },
        { label: 'Most points, single season', value: 114, season: '1999-2000' },
      ],
      affiliates: { ahl: 'SPR', echl: 'WOR' },
      facts: [
        "The Blues reached the Stanley Cup Final in each of their first three seasons (1968, 1969, 1970) but didn't win the Cup itself until 2019.",
        "Legendary goaltender Glenn Hall played the Blues' first three seasons and finished his Hall of Fame career in St. Louis, though his number has never been retired by the team.",
        'The Blues\' arena has carried four different names since opening in 1994: Kiel Center, Savvis Center, Scottrade Center, and now Enterprise Center.',
      ],
      currentInfo: {
        owner: 'Tom Stillman',
        headCoach: 'Jim Montgomery',
        lastVerified: '2026-09-01',
      },
    },

    // ── UTA (most tangled lineage in the whole dataset — read the facts) ──────
    // FLAG: second record (96 pts, 1984-85) is good-confidence but not sourced
    // from an official NHL.com records page.
    // FLAG: Delta Center capacity is mid-renovation and may already be stale by
    // October puck-drop.
    // No ECHL affiliate found for 2026-27 -- correctly omitted, not guessed.
    UTA: {
      founded: {
        year: 1972,
        asFranchise: 'Winnipeg Jets (WHA)',
        joinedNHL: 1979,
        relocations: [
          { year: 1996, from: 'Winnipeg, MB', to: 'Phoenix, AZ', renamedTo: 'Phoenix Coyotes', note: 'The original Winnipeg Jets left after 1995-96; a different, unrelated expansion franchise (the Atlanta Thrashers) later took the "Winnipeg Jets" name in 2011 after relocating to Winnipeg itself -- see the current WPG entry' },
          { year: 2014, from: 'Phoenix, AZ', to: 'Glendale, AZ', renamedTo: 'Arizona Coyotes', note: 'Rebrand only -- had already played in suburban Glendale since 2003' },
          { year: 2024, from: 'Glendale, AZ', to: 'Salt Lake City, UT', renamedTo: 'Utah Hockey Club', note: 'Placeholder identity while a permanent name was chosen' },
          { year: 2025, from: 'Salt Lake City, UT', to: 'Salt Lake City, UT', renamedTo: 'Utah Mammoth', note: 'Permanent identity adopted May 7, 2025; no physical relocation' },
        ],
      },
      arena: {
        name: 'Delta Center',
        city: 'Salt Lake City, UT',
        capacity: 12478,
        opened: 1991,
        formerNames: [
          { name: 'EnergySolutions Arena', years: '2006–2015' },
          { name: 'Vivint Smart Home Arena / Vivint Arena', years: '2015–2023' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Delta_Center_2023.jpg',
          attribution: 'Lomrjyo, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: [
        'Bobby Hull', 'Dale Hawerchuk', 'Teemu Selänne', 'Shane Doan',
        'Jeremy Roenick', 'Clayton Keller',
      ],
      records: [
        { label: 'Most goals by a rookie, single season (NHL record)', value: 76, season: '1992-93 (Winnipeg Jets)' },
        { label: 'Best regular-season points total, Winnipeg era', value: 96, season: '1984-85 (Winnipeg Jets)' },
      ],
      affiliates: { ahl: 'TUC' },
      facts: [
        "This is the SAME franchise as the original 1972 WHA Winnipeg Jets — it left Winnipeg for Phoenix in 1996 and, after stops as the Coyotes and Utah Hockey Club, became the Utah Mammoth in 2025. The CURRENT Winnipeg Jets (est. 2011, ex-Atlanta Thrashers) is a completely different, unrelated franchise that simply adopted the old team's name as a tribute.",
        "Teemu Selänne's 76 goals for the original Winnipeg Jets in 1992-93 is still an NHL rookie record more than three decades later.",
        'The Coyotes retired both Bobby Hull\'s #9 and Thomas Steen\'s #25 from the original Jets era, but neither honor carried over when the franchise became the Utah Hockey Club/Mammoth — as of 2025, Utah has no officially retired numbers.',
      ],
      currentInfo: {
        owner: 'Ryan Smith (Smith Entertainment Group)',
        headCoach: 'André Tourigny',
        lastVerified: '2026-09-01',
      },
    },

    // ── WPG (current, ex-Atlanta Thrashers — unrelated to UTA's lineage) ──────
    // FIXED: '&amp;' -> '&' in owner.
    // CROSS-VALIDATED: echl 'BLM' independently confirmed by the Metropolitan
    // division's NYR agent, which found the same Bloomington-to-Winnipeg move
    // from the opposite side (as the reason NYR's own ECHL slot went empty).
    WPG: {
      founded: {
        year: 1999,
        asFranchise: 'Atlanta Thrashers',
        joinedNHL: 1999,
        relocations: [
          { year: 2011, from: 'Atlanta, GA', to: 'Winnipeg, MB', renamedTo: 'Winnipeg Jets', note: 'Named in tribute to the original 1972-1996 Winnipeg Jets, a separate and unrelated franchise now known as the Utah Mammoth -- see the UTA entry' },
        ],
      },
      arena: {
        name: 'Canada Life Centre',
        city: 'Winnipeg, MB',
        capacity: 15225,
        opened: 2004,
        formerNames: [
          { name: 'MTS Centre', years: '2004–2017' },
          { name: 'Bell MTS Place', years: '2017–2021' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/MTS_CENTRE_b.jpg',
          attribution: 'Wpg guy, CC0 1.0, via Wikimedia Commons — predates the current arena name but depicts the same building',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: [
        'Ilya Kovalchuk', 'Dany Heatley', 'Mark Scheifele', 'Blake Wheeler',
        'Connor Hellebuyck', 'Dustin Byfuglien',
      ],
      records: [
        { label: 'Most wins, single season', value: 56, season: '2024-25' },
        { label: 'Most points, single season', value: 116, season: '2024-25' },
      ],
      affiliates: { ahl: 'MB', echl: 'BLM' },
      facts: [
        "This franchise began as the Atlanta Thrashers in 1999 and only became the 'Winnipeg Jets' after relocating to Manitoba in 2011 — the name is a tribute to a different, unrelated 1972-1996 Winnipeg Jets franchise (now the Utah Mammoth), not a continuation of it.",
        "The 2024-25 Jets set franchise records for wins (56) and points (116) en route to the franchise's first-ever Presidents' Trophy.",
        'Neither the Atlanta Thrashers nor the current Winnipeg Jets have ever retired a number, despite Hall-of-Fame-caliber alumni like Ilya Kovalchuk passing through Atlanta.',
      ],
      currentInfo: {
        owner: 'True North Sports & Entertainment (Mark Chipman, executive chairman & governor)',
        headCoach: 'Scott Arniel',
        lastVerified: '2026-09-01',
      },
    },

  },
  pwhl: {
    // Verified Phase 2 (PWHL) team entries, accumulated as agents report back.
    // Integrate into src/utils/teamHistory.js TEAM_HISTORY.pwhl after a final
    // spot-check pass.

    // ═══ EXPANSION 4 (DET, HAM, LV, SJS) — from dedicated expansion-team agent ═══
    // FIXED: dropped `founded.announced` / `arena.note` keys the agent invented
    // -- TeamHistorySections.jsx doesn't render them. Folded the useful bits
    // into facts instead (announcement date, HAM/AHL-Hamilton-Hammers mixup
    // risk) rather than extending the schema for a handful of one-off fields.
    // FIXED: shortened the very verbose owner field (same info repeated across
    // all 4 teams) to a single concise line; the single-entity-ownership
    // explanation is also stated once per team in facts, so nothing is lost.
    // ADDED: currentInfo.gm is a genuinely new, useful field for these teams
    // (PWHL GMs are notable in their own right, unlike NHL's team-owner slot)
    // -- component now renders it (src/components/TeamHistorySections.jsx),
    // with a new 'teamView.history.gm' i18n key (en: "GM", fr: "DG").
    // VERIFIED HONEST: no fabricated permanent names, captains, or records for
    // teams that haven't played a game yet -- agent explicitly flagged these as
    // unknown rather than guessing, which is exactly right for this content.

    DET: {
      founded: {
        year: 2026,
      },
      arena: {
        name: 'Little Caesars Arena',
        city: 'Detroit, MI',
        capacity: 19515,
        opened: 2017,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Detroit_August_2025_07_%28Little_Caesars_Arena%29.jpg',
          attribution: 'Michael Barera, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: [
        'Hilary Knight', 'Cayla Barnes', 'Jesse Compher', 'Daryl Watts',
      ],
      facts: [
        'Awarded May 6, 2026 as the PWHL\'s ninth franchise and the first of the 2026-27 expansion wave (Hamilton, Las Vegas, and San Jose followed within two weeks).',
        'As of September 1, 2026, the franchise plays under the placeholder name "PWHL Detroit" — no permanent nickname or logo has been revealed yet.',
        "Forward Hilary Knight first signed an Expansion Foundational Offer with Las Vegas, then was traded to Detroit once the PWHL's trade freeze lifted in June 2026 (Las Vegas received Detroit's 2026 first-round draft pick in return).",
        'A March 2026 PWHL "Takeover Tour" exhibition game at Little Caesars Arena — before Detroit had its own franchise — drew a reported 15,938 fans, called a record crowd for a professional women\'s hockey game at that building.',
      ],
      currentInfo: {
        owner: 'Mark & Kimbra Walter (single-entity PWHL ownership); Ilitch Companies and Kilmer Sports Ventures joined as minority investors in June 2026',
        gm: 'Manon Rhéaume',
        headCoach: 'Josh Sciba',
        lastVerified: '2026-09-01',
      },
    },

    HAM: {
      founded: {
        year: 2026,
      },
      arena: {
        name: 'TD Coliseum',
        city: 'Hamilton, ON',
        capacity: 16386,
        opened: 1985,
        formerNames: [
          { name: 'Copps Coliseum', years: '1985–2014' },
          { name: 'FirstOntario Centre', years: '2014–2024' },
          { name: 'Hamilton Arena', years: '2024–2025' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/TD_Coliseum_Exerior_1.jpg',
          attribution: 'Scarlett Kang, CC0 1.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: [
        'Brianne Jenner', 'Emily Clark', 'Alina Müller',
      ],
      facts: [
        'Awarded May 13, 2026 (the same day as Las Vegas) — the first PWHL franchise based in a market without an NHL team. TD Coliseum reopened in November 2025 after a $300M renovation.',
        'As of September 1, 2026, the franchise plays under the placeholder name "PWHL Hamilton" — no permanent nickname or logo has been revealed yet. Not to be confused with the AHL\'s Hamilton Hammers, a separate franchise also new to the same building in 2026.',
        "Team colors (gold, maroon, cream) nod to Hamilton's hockey and football history — gold for the old Hamilton Tigers NHL club and the CFL's Tiger-Cats, maroon for the city's steelworking ('Steeltown') identity.",
        'Brianne Jenner became the franchise\'s first player signing on June 5, 2026.',
      ],
      currentInfo: {
        owner: 'Mark & Kimbra Walter (single-entity PWHL ownership); Ilitch Companies and Kilmer Sports Ventures joined as minority investors in June 2026',
        gm: 'Meghan Duggan',
        headCoach: 'Kris Sparre',
        lastVerified: '2026-09-01',
      },
    },

    LV: {
      founded: {
        year: 2026,
      },
      arena: {
        name: 'T-Mobile Arena',
        city: 'Las Vegas, NV',
        capacity: 17500,
        opened: 2016,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/T-Mobile_Arena_in_Las_Vegas.jpg',
          attribution: 'CrispyCream27, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: [
        'Erin Ambrose', 'Hayley Scamurra', 'Tessa Janecke', 'Lacey Eden',
      ],
      facts: [
        "Awarded May 13, 2026 (the same day as Hamilton) — unlike the other three 2026-27 expansion markets, Las Vegas never hosted a PWHL \"Takeover Tour\" exhibition game before being awarded a team.",
        'As of September 1, 2026, the franchise plays under the placeholder name "PWHL Las Vegas" — no permanent nickname or logo has been revealed yet.',
        "Forward Hilary Knight signed with Las Vegas first as part of a planned sign-and-trade — she moved to Detroit once the PWHL's trade freeze lifted in June 2026, with Las Vegas receiving Detroit's 2026 first-round pick (used on Tessa Janecke) in return.",
        "League officials pointed to the Vegas Golden Knights' effect on local youth hockey — a steep rise in girls' and women's participation in Southern Nevada — as a factor in choosing the market.",
      ],
      currentInfo: {
        owner: 'Mark & Kimbra Walter (single-entity PWHL ownership); Ilitch Companies and Kilmer Sports Ventures joined as minority investors in June 2026',
        gm: 'Dominique DiDia',
        headCoach: 'Kim Weiss',
        lastVerified: '2026-09-01',
      },
    },

    SJS: {
      founded: {
        year: 2026,
      },
      arena: {
        name: 'SAP Center',
        city: 'San Jose, CA',
        capacity: 17562,
        opened: 1993,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/SAP_Center_at_San_Jose_1_2018-09-20.jpg',
          attribution: 'FASTILY, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: [
        "Kristin O'Neill", 'Corinne Schroeder', 'Laila Edwards',
      ],
      facts: [
        'Awarded May 19, 2026, last of the four 2026-27 expansion teams, bringing the PWHL to 12 franchises — the first PWHL team in California.',
        'As of September 1, 2026, the franchise plays under the placeholder name "PWHL San Jose" — no permanent nickname has been revealed. San Jose\'s mayor has publicly lobbied for "Hammerheads," but that is an unconfirmed rumor, not an announced name.',
        'Troy Ryan holds both the general manager and head coach roles simultaneously — the first person in PWHL history to do so for one team. He previously spent six years as head coach of Canada\'s national women\'s team (2022 Olympic gold, 2026 Olympic silver) and three seasons coaching the Toronto Sceptres.',
      ],
      currentInfo: {
        owner: 'Mark & Kimbra Walter (single-entity PWHL ownership); Ilitch Companies and Kilmer Sports Ventures joined as minority investors in June 2026',
        gm: 'Troy Ryan',
        headCoach: 'Troy Ryan (dual GM/head coach role)',
        lastVerified: '2026-09-01',
      },
    },

    // ═══ ORIGINAL 8 (BOS, MIN, MTL, NY, OTT, TOR, SEA, VAN) ════════════════════
    // KEY CORRECTION from this agent (verified, applied throughout): the PWHL
    // has completed THREE full seasons as of 2026-09-01, not two -- Walter Cup
    // winners: 2024 MIN over BOS, 2025 MIN over OTT, 2026 MTL over OTT (sweep,
    // first Canadian team to win it).
    // FIXED: dropped `founded.firstSeason` / `founded.note` keys (not rendered)
    // -- folded useful bits into facts instead.
    // FIXED: '&amp;' -> '&' in MTL's records season field.
    // FIXED: unified the owner string to match the expansion-4 batch exactly,
    // AND corrected "Kimber Sports Ventures" -> the real name, "Kilmer Sports
    // Ventures" (verified via direct search -- this agent had it wrong, the
    // expansion-4 agent had it right; good catch from cross-checking the two
    // batches against each other rather than trusting either blindly).
    // FLAG: several head-coach assignments are extremely fresh (BOS's 3rd coach
    // in 3 seasons hired June 2026; SEA and VAN both fired their inaugural
    // coaches after missing the 2025-26 playoffs, VAN's GM stepped down to
    // become head coach with the GM seat still vacant) -- re-verify close to
    // ship, this is the single fastest-moving category in the whole PWHL batch.
    // OPEN CALL for whoever reviews this (agent flagged, not resolved here):
    // MTL's arena is Place Bell (steady-state home) vs Bell Centre (occasional
    // marquee games, much bigger); OTT's arena is the imminent Canadian Tire
    // Centre (confirmed for 2026-27, zero games played there yet) vs TD Place
    // (where every real Charge game to date was actually played). Kept the
    // "current/upcoming" venue in both cases, consistent with how NHL entries
    // use the current arena name even right after a rename -- flag if a
    // different call is wanted.

    BOS: {
      founded: {
        year: 2023,
        relocations: [
          { year: 2024, from: 'PWHL Boston (unbranded)', to: 'Boston, MA', renamedTo: 'Boston Fleet', note: 'Played the entire 2023-24 inaugural season unbranded as "PWHL Boston"; permanent identity unveiled Sept 9, 2024 alongside the other five original teams' },
        ],
      },
      arena: {
        name: 'Agganis Arena',
        city: 'Boston, MA',
        capacity: 6300,
        opened: 2005,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Agganis_Arena_Exterior.jpg',
          attribution: 'tiZom (Tomtheman5), CC BY-SA 2.5, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: ['Hilary Knight', 'Megan Keller', 'Aerin Frankel', 'Alina Müller', 'Jamie Lee Rattray'],
      records: [
        { label: 'Highest single-game attendance', value: 17850, season: '2025-26', note: 'TD Garden, Apr 11, 2026 vs. Montréal — first sellout of an NHL arena by a pro women\'s sports team' },
      ],
      facts: [
        'Boston played its entire inaugural 2023-24 season simply as "PWHL Boston" before the league unveiled all six original teams\' permanent identities in one event on September 9, 2024.',
        'The Fleet reached the Walter Cup Final in the league\'s very first season (2023-24) but lost to Minnesota in five games, and have not been back to a Final since.',
        'The Fleet moved home arenas for 2026-27, from the Tsongas Center in Lowell to Agganis Arena in Boston proper.',
      ],
      currentInfo: {
        owner: 'Mark & Kimbra Walter (single-entity PWHL ownership); Ilitch Companies and Kilmer Sports Ventures joined as minority investors in June 2026',
        gm: 'Danielle Marmer',
        headCoach: 'François Méthot',
        lastVerified: '2026-09-01',
      },
    },

    MIN: {
      founded: {
        year: 2023,
        relocations: [
          { year: 2024, from: 'PWHL Minnesota (unbranded)', to: 'Saint Paul, MN', renamedTo: 'Minnesota Frost', note: 'Unveiled Sept 9, 2024 alongside the other five original teams' },
        ],
      },
      arena: {
        name: 'Grand Casino Arena',
        city: 'Saint Paul, MN',
        capacity: 17954,
        opened: 2000,
        formerNames: [
          { name: 'Xcel Energy Center', years: '2000–2025' },
        ],
        photo: {
          source: 'wikimedia',
          // Filed on Commons under the arena's old name -- same before/after-
          // rename lag as this file's NHL MIN entry.
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Xcel_Energy_Center_5.JPG',
          attribution: 'AlexiusHoratius, CC BY-SA 3.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Walter Cup', years: [2024, 2025] },
      ],
      retiredNumbers: [],
      notableAlumni: ['Kendall Coyne Schofield', 'Taylor Heise', 'Grace Zumwinkle', 'Kelly Pannek', 'Lee Stecklein'],
      records: [
        { label: 'Highest single-game attendance', value: 13316, season: '2023-24', note: 'Home opener, Jan 6, 2024 vs. Montréal — a PWHL record at the time' },
      ],
      facts: [
        "Minnesota is the only team to win the Walter Cup in each of the PWHL's first two seasons (2024 and 2025) — despite never once finishing first in the regular season.",
        'Taylor Heise, the No. 1 overall pick in the inaugural 2023 PWHL Draft, scored the first goal in franchise history and was named the 2024 playoff MVP.',
        "The Frost effectively inherited the fan base of the independent (pre-PWHL) Minnesota Whitecaps, giving the market an unusually deep existing following for women's hockey.",
      ],
      currentInfo: {
        owner: 'Mark & Kimbra Walter (single-entity PWHL ownership); Ilitch Companies and Kilmer Sports Ventures joined as minority investors in June 2026',
        gm: 'Melissa Caruso',
        headCoach: 'Ken Klee',
        lastVerified: '2026-09-01',
      },
    },

    MTL: {
      founded: {
        year: 2023,
        relocations: [
          { year: 2024, from: 'PWHL Montréal (unbranded)', to: 'Montréal, QC', renamedTo: 'Montréal Victoire', note: 'Unveiled Sept 9, 2024 alongside the other five original teams' },
        ],
      },
      arena: {
        name: 'Place Bell',
        city: 'Laval, QC',
        capacity: 10172,
        opened: 2017,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Place_Bell_-_Fall_2019.jpg',
          attribution: 'Bryantriplex, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Walter Cup', years: [2026] },
      ],
      retiredNumbers: [],
      notableAlumni: ['Marie-Philip Poulin', 'Laura Stacey', 'Ann-Renée Desbiens'],
      records: [
        { label: 'Highest single-game attendance', value: 21105, season: '2023-24', note: 'Bell Centre, Apr 20, 2024 — a world record for a pro women\'s hockey game at the time' },
        { label: 'Consecutive regular-season titles', value: 2, season: '2024-25 & 2025-26' },
      ],
      facts: [
        'Montréal is the first Canadian team to win the Walter Cup, sweeping Ottawa 4-0 in the 2026 Final.',
        "The Victoire's April 20, 2024 game at the Bell Centre drew 21,105 fans — at the time a world record crowd for a professional women's hockey game.",
        'Captain Marie-Philip Poulin was named the 2024-25 PWHL MVP and IIHF Female Player of the Year.',
      ],
      currentInfo: {
        owner: 'Mark & Kimbra Walter (single-entity PWHL ownership); Ilitch Companies and Kilmer Sports Ventures joined as minority investors in June 2026',
        gm: 'Danièle Sauvageau',
        headCoach: 'Kori Cheverie',
        lastVerified: '2026-09-01',
      },
    },

    NY: {
      founded: {
        year: 2023,
        relocations: [
          { year: 2024, from: 'PWHL New York (unbranded, based in Bridgeport, CT)', to: 'Newark, NJ', renamedTo: 'New York Sirens', note: 'Unveiled Sept 9, 2024; shifted its primary home arena from Bridgeport to Prudential Center, not a market change -- still the "New York" franchise' },
        ],
      },
      arena: {
        name: 'Prudential Center',
        city: 'Newark, NJ',
        capacity: 16514,
        opened: 2007,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Prudential_Center_-_Newark_Skyline_%2855183937688%29.jpg',
          attribution: 'Ajay Suresh, CC BY 4.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: ['Alex Carpenter', 'Sarah Fillier', 'Ella Shelton', 'Micah Zandee-Hart'],
      records: [
        { label: "Highest attendance at a U.S. women's hockey game", value: 18006, season: '2025-26', note: 'Madison Square Garden, Apr 4, 2026 vs. Seattle' },
      ],
      facts: [
        "New York played its debut 2023-24 season out of Total Mortgage Arena in Bridgeport, Connecticut before shifting to Newark's Prudential Center for 2024-25 — the same building used by the NHL's New Jersey Devils.",
        'Sarah Fillier, the No. 1 overall pick in the 2024 PWHL Draft, was named 2025 Rookie of the Year and a co-scoring champion.',
        "On April 4, 2026, the Sirens' game against Seattle at Madison Square Garden drew 18,006 fans, the largest crowd ever recorded for a U.S. professional women's hockey game.",
      ],
      currentInfo: {
        owner: 'Mark & Kimbra Walter (single-entity PWHL ownership); Ilitch Companies and Kilmer Sports Ventures joined as minority investors in June 2026',
        gm: 'Pascal Daoust',
        headCoach: 'Greg Fargo',
        lastVerified: '2026-09-01',
      },
    },

    OTT: {
      founded: {
        year: 2023,
        relocations: [
          { year: 2024, from: 'PWHL Ottawa (unbranded)', to: 'Ottawa, ON', renamedTo: 'Ottawa Charge', note: 'Unveiled Sept 9, 2024 alongside the other five original teams' },
        ],
      },
      arena: {
        name: 'Canadian Tire Centre',
        city: 'Kanata, ON',
        capacity: 18500,
        opened: 1996,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Canadian_Tire_Centre_1.JPG',
          attribution: 'Ontario Images, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: ['Brianne Jenner', 'Emily Clark', 'Emerance Maschmeyer', 'Gwyneth Philips'],
      facts: [
        'The Charge reached the Walter Cup Final in both 2025 and 2026 — losing to Minnesota and then Montréal — the only team to make consecutive Finals without winning one yet.',
        'Rookie goaltender Gwyneth Philips posted a .952 save percentage to win 2025 Walter Cup Playoff MVP despite Ottawa losing the Final.',
        "Ottawa is moving out of downtown TD Place Arena into the NHL Senators' Canadian Tire Centre for the 2026-27 season after repeatedly outdrawing its own building — a 2026 game there drew 17,114 fans versus a 7,382 average at TD Place. A smaller, hockey-dedicated downtown arena (5,850 seats) is planned as a future long-term home.",
      ],
      currentInfo: {
        owner: 'Mark & Kimbra Walter (single-entity PWHL ownership); Ilitch Companies and Kilmer Sports Ventures joined as minority investors in June 2026',
        gm: 'Mike Hirshfeld',
        headCoach: 'Carla MacLeod',
        lastVerified: '2026-09-01',
      },
    },

    TOR: {
      founded: {
        year: 2023,
        relocations: [
          { year: 2024, from: 'PWHL Toronto (unbranded)', to: 'Toronto, ON', renamedTo: 'Toronto Sceptres', note: "Unveiled Sept 9, 2024; succeeded the folded PHF's Toronto Six in the same market" },
        ],
      },
      arena: {
        name: 'Coca-Cola Coliseum',
        city: 'Toronto, ON',
        capacity: 8140,
        opened: 2003,
        formerNames: [
          { name: 'Ricoh Coliseum', years: '2003–2018' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Coca-Cola_Coliseum%2C_Exhibition_Place%2C_Toronto%2C_Ontario_%2829901775271%29.jpg',
          attribution: 'Ken Lund, CC BY-SA 2.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: ['Natalie Spooner', 'Blayre Turnbull', 'Sarah Nurse', 'Renata Fast', 'Kristen Campbell'],
      records: [
        { label: 'Best regular-season finish', value: '1st overall, 13-4-4-3', season: '2023-24', note: 'Inaugural PWHL regular-season champions' },
      ],
      facts: [
        "Toronto succeeded the PHF's Toronto Six in the same market and won the PWHL's very first regular-season title in 2023-24 — but has yet to win a Walter Cup.",
        'The Coca-Cola Coliseum began life in 1921 as the CNE Coliseum, built for the Canadian National Exhibition, and was rebuilt into a hockey rink (as Ricoh Coliseum) in 2003 before becoming the Sceptres\' home in 2024.',
        'Original alternate captain Sarah Nurse was later selected by the expansion Vancouver Goldeneyes and scored that franchise\'s first-ever goal in 2025.',
      ],
      currentInfo: {
        owner: 'Mark & Kimbra Walter (single-entity PWHL ownership); Ilitch Companies and Kilmer Sports Ventures joined as minority investors in June 2026',
        gm: 'Gina Kingsbury',
        headCoach: 'Pascal Rhéaume',
        lastVerified: '2026-09-01',
      },
    },

    SEA: {
      founded: {
        year: 2025,
      },
      arena: {
        name: 'Climate Pledge Arena',
        city: 'Seattle, WA',
        capacity: 17151,
        opened: 2021,
        formerNames: [
          { name: 'Seattle Center Coliseum', years: '1962–1995' },
          { name: 'KeyArena', years: '1995–2018' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Climate_Pledge_Arena_at_Night.jpg',
          attribution: 'XR228, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: ['Hilary Knight', 'Alex Carpenter', 'Abbey Murphy'],
      records: [
        { label: 'League-leading average attendance', value: 12875, season: '2025-26', note: 'Inaugural season' },
      ],
      facts: [
        "Seattle and Vancouver joined for 2025-26 as the PWHL's first expansion wave, growing the league from six to eight teams — Seattle was announced April 30, 2025, with the permanent \"Torrent\" identity revealed that November, never playing a season under placeholder branding the way the original six did.",
        "Hilary Knight — Boston's original captain — became Seattle's first-ever captain in 2025.",
        'Seattle\'s Nov. 28, 2025 home opener (a 3-0 loss to Minnesota) drew 16,014 fans, at the time the largest crowd for a women\'s hockey game in U.S. history — since topped by New York\'s 18,006 at Madison Square Garden.',
      ],
      currentInfo: {
        owner: 'Mark & Kimbra Walter (single-entity PWHL ownership); Ilitch Companies and Kilmer Sports Ventures joined as minority investors in June 2026',
        gm: 'Meghan Turner',
        headCoach: 'Christine Bumstead',
        lastVerified: '2026-09-01',
      },
    },

    VAN: {
      founded: {
        year: 2025,
      },
      arena: {
        name: 'Pacific Coliseum',
        city: 'Vancouver, BC',
        capacity: 16281,
        opened: 1968,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Pacific_Coliseum_aerial_view_2026.jpg',
          attribution: 'Canmenwalker, CC BY 4.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: ['Sarah Nurse', 'Claire Thompson', 'Ashton Bell', 'Caroline Harvey'],
      facts: [
        "Vancouver was the PWHL's first announced expansion franchise (April 23, 2025, a week ahead of Seattle) and never played under placeholder branding — but missed the 2025-26 playoffs and won the league's first-ever draft lottery for the No. 1 pick in the 2026 PWHL Draft as a result.",
        "Sarah Nurse, previously of the Toronto Sceptres, scored the Goldeneyes' first-ever franchise goal in their November 21, 2025 opener against Seattle.",
        'The Pacific Coliseum opened in 1968, hosted figure skating at the 2010 Winter Olympics, and was the Vancouver Canucks\' original NHL home (1970-1995) before becoming the Goldeneyes\' home in 2025.',
        "After a last-place inaugural season, Vancouver fired head coach Brian Idalski in June 2026; rather than hire externally, GM Cara Gardner Morey herself moved into the head-coach role in July 2026, leaving the GM seat vacant as of this writing.",
      ],
      currentInfo: {
        owner: 'Mark & Kimbra Walter (single-entity PWHL ownership); Ilitch Companies and Kilmer Sports Ventures joined as minority investors in June 2026',
        gm: 'Vacant as of Aug 2026 — Cara Gardner Morey moved from GM to head coach',
        headCoach: 'Cara Gardner Morey',
        lastVerified: '2026-09-01',
      },
    },


  },
  ahl: {},
  echl: {},
};

export function getTeamHistory(league, abbr) {
  return TEAM_HISTORY[league]?.[abbr] || null;
}
