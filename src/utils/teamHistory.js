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
      affiliates: { ahl: 'RFD', echl: 'IND' },
      facts: [
        'The Blackhawks played at the original Chicago Stadium from 1929 until 1994, when they moved next door to the United Center.',
        "The Blackhawks' real AHL affiliate is the Rockford IceHogs, about 90 miles from Chicago — not the Chicago Wolves, a separate, independently-owned AHL franchise that happens to share the Blackhawks' home city and is actually affiliated with the Carolina Hurricanes.",
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
  ahl: {
    // Verified Phase 3 (AHL) team entries, accumulated as agents report back.
    // Integrate into src/utils/teamHistory.js TEAM_HISTORY.ahl after a final
    // spot-check pass.

    // ═══ ATLANTIC (7 teams) ══════════════════════════════════════════════════
    // CROSS-VALIDATED: every nhl/echl affiliate abbr in this batch independently
    // matches what the NHL-phase agents already put in TEAM_HISTORY.nhl (WSH<->
    // HER<->SC, STL<->SPR<->WOR, FLA<->CLT<->SAV, PIT<->WBS<->FLA-echl) -- strong
    // signal the whole affiliate graph is internally consistent, not just
    // individually plausible.
    // FIXED: '&amp;' -> '&' throughout (HER retiredNumbers x3 + owner, CLT owner).
    // FIXED: dropped HER's founded.note (redundant with an existing fact) and
    // its formerNames entry for Hersheypark Arena -- that's a genuinely
    // different, since-replaced building, not a rename of GIANT Center, so it
    // doesn't belong in formerNames; the real story is already in facts.
    // FIXED: dropped SPR's two retiredNumbers entries (Eddie Shore #2, Rob
    // Murray #23) -- agent's own research found these are honorary banners for
    // two DIFFERENT, unrelated earlier Springfield AHL franchises (Indians,
    // Falcons), not real Thunderbirds retirements. Component has no way to
    // render the distinguishing note, and showing them unqualified in the
    // Retired Numbers list would misrepresent them as this team's own history.
    // The honest version of this story is already captured in facts.
    // FLAG: HFD has no confirmed ECHL affiliate for 2026-27 (Bloomington Bison
    // left for Winnipeg/Manitoba in July 2026) -- left unset, don't guess.

    HFD: {
      founded: {
        year: 1926,
        asFranchise: 'Providence Reds',
        relocations: [
          { year: 1976, from: 'Providence, RI', to: 'Providence, RI', renamedTo: 'Rhode Island Reds', note: 'Name change only, no relocation' },
          { year: 1977, from: 'Providence, RI', to: 'Binghamton, NY', renamedTo: 'Binghamton Dusters' },
          { year: 1980, from: 'Binghamton, NY', to: 'Binghamton, NY', renamedTo: 'Binghamton Whalers', note: "Became Hartford Whalers' AHL affiliate" },
          { year: 1990, from: 'Binghamton, NY', to: 'Binghamton, NY', renamedTo: 'Binghamton Rangers', note: "Became New York Rangers' AHL affiliate" },
          { year: 1997, from: 'Binghamton, NY', to: 'Hartford, CT', renamedTo: 'Hartford Wolf Pack', note: 'Franchise sold to Madison Square Garden, moved into the just-vacated Hartford Civic Center' },
          { year: 2010, from: 'Hartford, CT', to: 'Hartford, CT', renamedTo: 'Connecticut Whale', note: 'Renamed in honor of the former NHL Hartford Whalers' },
          { year: 2013, from: 'Hartford, CT', to: 'Hartford, CT', renamedTo: 'Hartford Wolf Pack', note: 'Reverted to Wolf Pack name after the 2012-13 season' },
        ],
      },
      arena: {
        name: 'PeoplesBank Arena',
        city: 'Hartford, CT',
        capacity: 14750,
        opened: 1975,
        formerNames: [
          { name: 'Hartford Civic Center', years: '1975–2007' },
          { name: 'XL Center', years: '2007–2025' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/XL_Center_2022.jpg',
          attribution: 'Enterprise8875, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Calder Cup', years: [2000] },
      ],
      retiredNumbers: [
        { number: 12, player: 'Ken Gernander' },
      ],
      notableAlumni: [
        'Derek Armstrong', 'Wade Redden', 'Dan Girardi', 'Cam Talbot',
        'J.T. Miller', 'Al Montoya',
      ],
      records: [
        { label: 'Most wins, single season', value: 49, season: '1999-00' },
        { label: 'Most points, single season', value: 107, season: '1999-00' },
      ],
      affiliates: { nhl: 'NYR' },
      facts: [
        "The Wolf Pack's lineage traces to the 1926 Providence Reds, one of the AHL's five charter franchises — it moved through Providence/Rhode Island, then three different Binghamton, NY identities (Dusters, Whalers, Rangers) before landing in Hartford in 1997. The franchise does not officially claim the Providence Reds' four Calder Cups (1938, 1940, 1949, 1956).",
        'The team was rebranded the Connecticut Whale for three seasons (2010-13) as a tribute to the old NHL Hartford Whalers before reverting to the Wolf Pack name.',
        'In July 2026 the Bloomington Bison — the Rangers/Wolf Pack\'s ECHL affiliate for two seasons — left to affiliate with the Winnipeg Jets/Manitoba Moose instead, leaving the Wolf Pack without a confirmed ECHL affiliate for 2026-27.',
      ],
      currentInfo: {
        owner: 'Madison Square Garden Sports Corp. (owned directly by the New York Rangers organization)',
        headCoach: 'Jay Leach',
        lastVerified: '2026-09-01',
      },
    },

    PRO: {
      founded: {
        year: 1992,
        asFranchise: 'Maine Mariners (AHL, 1987-92)',
        relocations: [
          { year: 1992, from: 'Portland, ME', to: 'Providence, RI', renamedTo: 'Providence Bruins', note: 'Providence mayor Buddy Cianci brokered the move; the earlier Maine Mariners (1987-92, an expansion team stocked by Boston) had itself replaced a different, unrelated Mariners franchise that left for Utica in 1987' },
        ],
      },
      arena: {
        name: 'Amica Mutual Pavilion',
        city: 'Providence, RI',
        capacity: 11273,
        opened: 1972,
        formerNames: [
          { name: 'Providence Civic Center', years: '1972–2001' },
          { name: "Dunkin' Donuts Center", years: '2001–2022' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Amica_Mutual_Pavilion_in_Providence_RI.jpg',
          attribution: 'Kenneth C. Zirkel, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Calder Cup', years: [1999] },
      ],
      retiredNumbers: [
        { number: 25, player: 'Colby Cave' },
      ],
      notableAlumni: [
        'Brad Marchand', 'Tuukka Rask', 'Tim Thomas', 'Trent Frederic',
        'Andrew Raycroft', 'Randy Robitaille',
      ],
      records: [
        { label: 'Most wins, single season', value: 56, season: '1998-99' },
        { label: 'Most points, single season', value: 120, season: '1998-99' },
      ],
      affiliates: { nhl: 'BOS', echl: 'MNE' },
      facts: [
        'The Bruins won their only Calder Cup in 1998-99 under rookie head coach Peter Laviolette, going 56-16-8 in the regular season after winning just 19 games the year before.',
        "Colby Cave's #25 was retired in 2022, two years after his death from a brain hemorrhage in 2020 while playing for the Edmonton Oilers — the only number the franchise has retired.",
        'New head coach Trent Whitfield spent the prior 10 seasons (2016-26) as a Providence assistant before his 2026 promotion; as a player he suited up for Boston, St. Louis, Washington, and the New York Rangers.',
      ],
      currentInfo: {
        owner: 'H. Larue Renfroe (independently owned, not the Boston Bruins)',
        headCoach: 'Trent Whitfield',
        lastVerified: '2026-09-01',
      },
    },

    LV: {
      founded: {
        year: 1996,
        asFranchise: 'Philadelphia Phantoms (NHL/AHL expansion)',
        relocations: [
          { year: 2009, from: 'Philadelphia, PA', to: 'Glens Falls, NY', renamedTo: 'Adirondack Phantoms', note: "Moved ahead of the Spectrum's planned closure/demolition" },
          { year: 2014, from: 'Glens Falls, NY', to: 'Allentown, PA', renamedTo: 'Lehigh Valley Phantoms', note: 'Delayed a year by litigation over construction of the new PPL Center' },
        ],
      },
      arena: {
        name: 'PPL Center',
        city: 'Allentown, PA',
        capacity: 8500,
        opened: 2014,
      },
      championships: [
        { title: 'Calder Cup', years: [1998, 2005] },
      ],
      retiredNumbers: [],
      notableAlumni: [
        'Nolan Baumgartner', 'Dennis Bonvie', 'John Slaney', 'Mike Maneluk',
        'Andrew Raycroft',
      ],
      records: [
        { label: 'Most wins, single season (Lehigh Valley era)', value: 47, season: '2017-18' },
        { label: 'Most points, single season (Lehigh Valley era)', value: 104, season: '2017-18' },
      ],
      affiliates: { nhl: 'PHI', echl: 'REA' },
      facts: [
        'As the Philadelphia Phantoms, the franchise won two Calder Cups (1998, 2005); the 2005 clincher at the Wachovia Center drew 20,103 fans, still the largest crowd for a single AHL playoff game.',
        'The franchise spent five seasons (2009-14) as the Adirondack Phantoms in Glens Falls, NY before a construction lawsuit delayed its planned move to Allentown by a full year.',
        'Unlike most long-tenured AHL clubs, the Phantoms have never formally retired a jersey number in any of their three city eras.',
      ],
      currentInfo: {
        owner: 'The Brooks Group (Robert and Jim Brooks) — independently owned, not the Philadelphia Flyers',
        headCoach: 'John Snowden',
        lastVerified: '2026-09-01',
      },
    },

    WBS: {
      founded: {
        year: 1981,
        asFranchise: 'Fredericton Express',
        relocations: [
          { year: 1988, from: 'Fredericton, NB', to: 'Halifax, NS', renamedTo: 'Halifax Citadels' },
          { year: 1993, from: 'Halifax, NS', to: 'Cornwall, ON', renamedTo: 'Cornwall Aces' },
          { year: 1999, from: 'Cornwall, ON', to: 'Wilkes-Barre, PA', renamedTo: 'Wilkes-Barre/Scranton Penguins', note: 'Pittsburgh purchased the dormant Cornwall franchise (inactive 1996-99) from the Colorado Avalanche' },
        ],
      },
      arena: {
        name: 'Mohegan Sun Arena at Casey Plaza',
        city: 'Wilkes-Barre Township, PA',
        capacity: 8500,
        opened: 1999,
        formerNames: [
          { name: 'Northeastern Pennsylvania Civic Arena', years: '1999' },
          { name: 'First Union Arena at Casey Plaza', years: '1999–2002' },
          { name: 'Wachovia Arena at Casey Plaza', years: '2002–2010' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Mohegan_Sun_Arena_at_Casey_Plaza_1_2012-05-05.JPG',
          attribution: 'Pens Through My Lens, CC BY-SA 3.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: [
        'Marc-Andre Fleury', 'Matt Murray', 'Tristan Jarry', 'Brooks Orpik',
        'Kris Letang', 'Jake Guentzel',
      ],
      records: [
        { label: 'Most wins, single season', value: 58, season: '2010-11' },
        { label: 'Most points, single season', value: 117, season: '2010-11' },
      ],
      affiliates: { nhl: 'PIT', echl: 'FLA' },
      facts: [
        'The franchise has reached the Calder Cup Final three times (2001, 2004, 2008) without ever winning it — the only team in this division still searching for its first title.',
        "The 2010-11 team went 58-21-1 to win the Macgregor Kilpatrick Trophy for the AHL's best regular-season record, a franchise-best campaign.",
        'The Hoffmann Family of Companies bought the Pittsburgh Penguins (and with them, WBS) in a $1.7 billion sale approved by the NHL in June 2026; the Hoffmanns also own ECHL\'s Florida Everblades, which became the Penguins/WBS ECHL affiliate for 2026-27, replacing the Wheeling Nailers.',
      ],
      currentInfo: {
        owner: 'Hoffmann Family of Companies (owned as part of the Pittsburgh Penguins organization)',
        headCoach: 'Kirk MacDonald',
        lastVerified: '2026-09-01',
      },
    },

    HER: {
      founded: {
        year: 1938,
        asFranchise: 'Hershey Bears',
      },
      arena: {
        name: 'GIANT Center',
        city: 'Hershey, PA',
        capacity: 10500,
        opened: 2002,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Outside_Giant_Center.jpg',
          attribution: 'Phillyfan0419, CC BY-SA 3.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Calder Cup', years: [1947, 1958, 1959, 1969, 1974, 1980, 1988, 1997, 2006, 2009, 2010, 2023, 2024] },
      ],
      retiredNumbers: [
        { number: 3, player: 'Frank Mathers & Ralph Keller' },
        { number: 8, player: 'Mike Nykoluk' },
        { number: 9, player: 'Arnie Kullman & Tim Tookey' },
        { number: 16, player: 'Willie Marshall & Mitch Lamoureux' },
        { number: 17, player: 'Chris Bourque' },
      ],
      notableAlumni: [
        'Chris Bourque', 'Bruce Boudreau', 'Craig Patrick', 'Jim Rutherford',
        'Emile Francis', 'Willie Marshall',
      ],
      records: [
        { label: 'Most wins, single season', value: 53, season: '2023-24' },
        { label: 'Most points, single season', value: 111, season: '2023-24' },
      ],
      affiliates: { nhl: 'WSH', echl: 'SC' },
      facts: [
        "Hershey's 13 Calder Cups are more than any other AHL franchise, including a repeat in 2023-24 that came the same season the team set its single-season franchise record for wins.",
        'The Bears have played continuously in Hershey since 1938, first at Hersheypark Arena (1936-2002, shared with the amateur predecessor club) and now at GIANT Center — no other AHL team has stayed in one city as long without interruption.',
        'New head coach Derek King enters his second season in 2026-27 after four seasons as a Chicago Blackhawks assistant (including a stint as interim head coach in 2021-22).',
      ],
      currentInfo: {
        owner: 'Hershey Entertainment & Resorts Company',
        headCoach: 'Derek King',
        lastVerified: '2026-09-01',
      },
    },

    CLT: {
      founded: {
        year: 1990,
        asFranchise: 'Capital District Islanders',
        relocations: [
          { year: 1993, from: 'Albany, NY (Capital District)', to: 'Albany, NY', renamedTo: 'Albany River Rats', note: 'Name change only, same market' },
          { year: 2010, from: 'Albany, NY', to: 'Charlotte, NC', renamedTo: 'Charlotte Checkers', note: 'Sold to a Charlotte ownership group; inherited the Hurricanes affiliation' },
        ],
      },
      arena: {
        name: 'Bojangles Coliseum',
        city: 'Charlotte, NC',
        capacity: 8600,
        opened: 1955,
        formerNames: [
          { name: 'Charlotte Coliseum', years: '1955–1988' },
          { name: 'Independence Arena', years: '1993–2001' },
          { name: 'Cricket Arena', years: '2001–2008' },
        ],
        photo: {
          source: 'wikimedia',
          url: "https://commons.wikimedia.org/wiki/Special:FilePath/Bojangles%27_Coliseum.jpg",
          attribution: 'James Willamor, CC BY-SA 3.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Calder Cup', years: [2019] },
      ],
      retiredNumbers: [],
      notableAlumni: [
        'Jake Bean', 'Morgan Geekie', 'Alex Nedeljkovic', 'Brock McGinn',
        'Nicolas Roy', 'Zach Boychuk',
      ],
      records: [
        { label: 'Most wins, single season', value: 51, season: '2018-19' },
        { label: 'Most points, single season', value: 110, season: '2018-19' },
      ],
      affiliates: { nhl: 'FLA', echl: 'SAV' },
      facts: [
        'This franchise dates to 1990 in Albany, NY (as the Capital District Islanders, then Albany River Rats from 1993) before relocating to Charlotte in 2010 — a separate, unrelated franchise from the original minor-league Charlotte Checkers that played in the same building from 1956-77.',
        "The Checkers' only Calder Cup (2019) came in a dominant 2018-19 season that also produced the franchise's best-ever regular season: 51-17-7 for 110 points, first overall in the AHL.",
        "Zawyer Sports & Entertainment bought a controlling interest in the Checkers in 2024 and separately owns the Savannah Ghost Pirates, the Checkers' current ECHL affiliate.",
      ],
      currentInfo: {
        owner: 'Zawyer Sports & Entertainment (majority; Michael Kahn remains a minority owner)',
        headCoach: 'Geordie Kinnear',
        lastVerified: '2026-09-01',
      },
    },

    SPR: {
      founded: {
        year: 1982,
        asFranchise: 'Erie Blades',
        relocations: [
          { year: 1982, from: 'Erie, PA', to: 'Baltimore, MD', renamedTo: 'Baltimore Skipjacks', note: 'Erie Blades (1975-82) folded; the Skipjacks are generally treated as its successor expansion team' },
          { year: 1993, from: 'Baltimore, MD', to: 'Portland, ME', renamedTo: 'Portland Pirates' },
          { year: 2016, from: 'Portland, ME', to: 'Springfield, MA', renamedTo: 'Springfield Thunderbirds', note: 'Sold to a Springfield-based ownership group after the Springfield Falcons had just left for Tucson' },
        ],
      },
      arena: {
        name: 'MassMutual Center',
        city: 'Springfield, MA',
        capacity: 6679,
        opened: 1972,
        formerNames: [
          { name: 'Springfield Civic Center', years: '1972–2005' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/MassMutualCenter2022.jpg',
          attribution: 'Lucas Armstrong/TheAHL, CC BY 2.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: [
        'Josh Brown', 'Dryden Hunt', 'Juho Lammikko', 'Steven Santini',
        'Mackenzie MacEachern', 'Adam Gaudette',
      ],
      records: [
        { label: 'Most wins, single season (Thunderbirds era)', value: 43, season: '2021-22' },
        { label: 'Most points, single season (Thunderbirds era)', value: 95, season: '2021-22' },
      ],
      affiliates: { nhl: 'STL', echl: 'WOR' },
      facts: [
        "The Thunderbirds' own lineage runs through the Erie Blades, Baltimore Skipjacks, and Portland Pirates back to 1975-82 — it is not the same franchise as the earlier Springfield Indians or Springfield Falcons that also played AHL hockey in the same city and arena.",
        'Because the city has such deep AHL roots, the Thunderbirds display banners honoring Eddie Shore (Springfield Indians, #2) and Rob Murray (Springfield Falcons, #23) even though neither number belongs to the Thunderbirds\' own franchise history.',
        'Springfield has never won a Calder Cup in the Thunderbirds era, but reached the Final in just their sixth season (2021-22), the same year they set their current franchise-best regular-season marks.',
      ],
      currentInfo: {
        owner: 'Springfield Hockey, LLC (independently owned local group, not the St. Louis Blues)',
        headCoach: 'Steve Ott',
        lastVerified: '2026-09-01',
      },
    },

    // ═══ NORTH (8 teams) ═════════════════════════════════════════════════════
    // VERIFIED INDEPENDENTLY (important, counter-narrative finding): the current
    // (2021-present) Utica Comets are NOT the same legal franchise as the
    // popular 2013-2021 Comets (Bo Horvat/Vancouver era) -- that franchise
    // became the Abbotsford Canucks in 2021, and the CURRENT Utica Comets are
    // actually the relocated Binghamton/Albany/Lowell Devils affiliate. Agent
    // flagged this itself as needing a check; confirmed via a second, independent
    // search (Vancouver bought the Peoria Rivermen in 2013 -> Comets -> Abbotsford
    // 2021; separately, NJ's Binghamton Devils -> Utica Comets 2021). This
    // entry deliberately excludes the 2013-2021 era's players/records/history.
    // FIXED: '&amp;' -> '&' throughout (ROC, TOR, UTC).
    // FIXED: BEL's relocations array had a null-valued entry ({to: null,
    // renamedTo: null}) that would have rendered the literal word "null" in the
    // UI -- merged the 1996 suspension into the 2002 revival entry's `from`/note
    // instead, preserving the real dormancy story without a broken row.
    // FIXED: dropped CLE's per-retiredNumber `note` fields (not rendered) --
    // the same context is already stated clearly in CLE's facts array.
    // FIXED: folded unrendered `records[].player` names into the label/note
    // text for ROC/TOR/HAM/LAV (component doesn't have a separate field for
    // this) so the info isn't silently dropped.
    // CAUGHT A CROSS-BATCH CONFLICT: ROC's claimed echl:'JAX' is stale -- per
    // the NHL-phase data already in this file, Jacksonville Icemen moved from
    // Buffalo's chain to Minnesota's in May 2026 (MIN/IA/JAX). Buffalo's whole
    // chain (BUF NHL + ROC AHL) has no confirmed ECHL affiliate right now --
    // already reflected on BUF's NHL entry, now matched here. Every other
    // nhl/echl pair in this batch (TOR/CIN, BEL/ALN, HAM/TRE) independently
    // matches what the NHL-phase agents already found -- strong signal the
    // overall affiliate graph is self-consistent.

    ROC: {
      founded: {
        year: 1956,
      },
      arena: {
        name: 'Blue Cross Arena',
        city: 'Rochester, NY',
        capacity: 10662,
        opened: 1955,
        formerNames: [
          { name: 'Rochester Community War Memorial', years: '1955–1998' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Blue_Cross_Arena_%28War_Memorial%29,_Exchange_Boulevard_and_Broad_Street,_Rochester,_NY_%2854420829289%29.jpg',
          attribution: 'Warren LeMay, CC BY-SA 2.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Calder Cup', years: [1965, 1966, 1968, 1983, 1987, 1996] },
      ],
      retiredNumbers: [
        { number: 6, player: 'Norm "Red" Armstrong' },
        { number: 9, player: 'Dick Gamble & Jody Gage' },
      ],
      notableAlumni: ['Gerry Cheevers', 'Al Arbour', 'Ryan Miller', 'Jody Gage', 'Rob Ray'],
      records: [
        { label: 'Most points, single season', value: 119, season: '1982-83', note: 'Geordie Robertson' },
        { label: 'Most goals, single season', value: 61, season: '1985-86', note: 'Paul Gardner' },
      ],
      affiliates: { nhl: 'BUF' },
      facts: [
        'The Amerks are the 4th-oldest continuously operating franchise in the AHL, formed in 1956 after the Pittsburgh Hornets folded.',
        "Owned directly by Terry Pegula's Pegula Sports & Entertainment — the same ownership group as the parent Buffalo Sabres.",
        'In 1959-60, Rochester became the first team in AHL history to win a playoff series after trailing 3 games to none.',
      ],
      currentInfo: {
        owner: 'Terry Pegula (Pegula Sports & Entertainment — same group as the Buffalo Sabres)',
        headCoach: 'Michael Leone',
        lastVerified: '2026-09-01',
      },
    },

    SYR: {
      founded: {
        year: 1992,
        asFranchise: 'Hamilton Canucks',
        relocations: [
          { year: 1994, from: 'Hamilton, ON', to: 'Syracuse, NY', renamedTo: 'Syracuse Crunch', note: 'Name chosen via public fan vote' },
        ],
      },
      arena: {
        name: 'Upstate Medical University Arena',
        city: 'Syracuse, NY',
        capacity: 5800,
        opened: 1951,
        formerNames: [
          { name: 'Onondaga County War Memorial', years: '1951–1999' },
          { name: 'Oncenter War Memorial Arena', years: '2000–2019' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Onondaga_County_War_Memorial_side.jpg',
          attribution: 'Crazyale, public domain, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: ['Nikita Kucherov', 'Brayden Point', 'Andrei Vasilevskiy', 'Tyler Johnson', 'Jonathan Drouin', 'Alex Killorn'],
      records: [
        { label: 'Most points, single season (76-game era)', value: 102, season: '2018-19' },
        { label: 'Most goals, single season (76-game era)', value: 264, season: '2018-19' },
      ],
      affiliates: { nhl: 'TBL', echl: 'ORL' },
      facts: [
        'Founder/owner Howard Dolgon coordinated the purchase of the Hamilton Canucks in 1994 to bring the AHL back to Syracuse; he still owns the team independently (not owned by the Lightning).',
        'The Crunch have never formally retired a number — a #14 banner (John Badduke, 1997) and a #7 Slap Shot tribute (2008-09) were both later reissued to other players.',
        "The Lightning–Crunch affiliation, running continuously since 2012, is one of the AHL's longest-standing single-team NHL partnerships.",
      ],
      currentInfo: {
        owner: 'Howard Dolgon (independent ownership, no NHL-parent stake)',
        headCoach: 'Joel Bouchard',
        lastVerified: '2026-09-01',
      },
    },

    TOR: {
      founded: {
        year: 1978,
        asFranchise: 'New Brunswick Hawks',
        relocations: [
          { year: 1982, from: 'New Brunswick', to: 'St. Catharines, ON', renamedTo: 'St. Catharines Saints' },
          { year: 1986, from: 'St. Catharines, ON', to: 'Newmarket, ON', renamedTo: 'Newmarket Saints' },
          { year: 1991, from: 'Newmarket, ON', to: "St. John's, NL", renamedTo: "St. John's Maple Leafs" },
          { year: 2005, from: "St. John's, NL", to: 'Toronto, ON', renamedTo: 'Toronto Marlies', note: 'Named for the Toronto Marlboros, a former Maple Leafs-sponsored junior team' },
        ],
      },
      arena: {
        name: 'Coca-Cola Coliseum',
        city: 'Toronto, ON',
        capacity: 8140,
        opened: 1921,
        formerNames: [
          { name: 'CNE Coliseum', years: '1921–2003' },
          { name: 'Ricoh Coliseum', years: '2003–2018' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Coca-Cola_Coliseum,_Exhibition_Place,_Toronto,_Ontario_%2829901775271%29.jpg',
          attribution: 'Ken Lund, CC BY-SA 2.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Calder Cup', years: [2018, 2026] },
      ],
      retiredNumbers: [],
      notableAlumni: ['Nazem Kadri', 'Connor Brown', 'Andreas Johnsson', 'Timothy Liljegren', 'Rich Clune'],
      records: [
        { label: 'Most points, single season (tied)', value: 79, season: '2008-09 & 2018-19', note: 'Tim Stapleton (2008-09) and Jeremy Bracco (2018-19)' },
        { label: 'Most goals, single season (tied)', value: 36, season: '2005-06 & 2024-25', note: 'John Pohl (2005-06) and Alex Steeves (2024-25)' },
      ],
      affiliates: { nhl: 'TOR', echl: 'CIN' },
      facts: [
        'The 2018 Calder Cup was the first professional hockey championship for a Toronto-based team since 1967.',
        'The Marlies won a second Calder Cup in June 2026, beating the Chicago Wolves 4-1, with goaltender Artur Akhtyamov winning playoff MVP honors.',
        'Owned directly by Maple Leaf Sports & Entertainment (MLSE), the same group that owns the parent Toronto Maple Leafs.',
      ],
      currentInfo: {
        owner: 'Maple Leaf Sports & Entertainment (MLSE — same group as the Toronto Maple Leafs)',
        headCoach: 'Steve Sullivan',
        lastVerified: '2026-09-01',
      },
    },

    CLE: {
      founded: {
        year: 1994,
        asFranchise: 'Denver Grizzlies (IHL)',
        relocations: [
          { year: 1995, from: 'Denver, CO', to: 'Salt Lake City / Utah', renamedTo: 'Utah Grizzlies' },
          { year: 2007, from: 'Utah (dormant 2005–2006)', to: 'Cleveland, OH', renamedTo: 'Cleveland Monsters', note: 'Dormant Utah franchise purchased by a Cleveland ownership group led by Dan Gilbert in 2006' },
        ],
      },
      arena: {
        name: 'Rocket Arena',
        city: 'Cleveland, OH',
        capacity: 19432,
        opened: 1994,
        formerNames: [
          { name: 'Gund Arena', years: '1994–2005' },
          { name: 'Quicken Loans Arena', years: '2005–2019' },
          { name: 'Rocket Mortgage FieldHouse', years: '2019–2025' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Rocket_Mortgage_FieldHouse_%282%29.jpg',
          attribution: 'Cards84664, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Calder Cup', years: [2016] },
      ],
      retiredNumbers: [
        { number: 1, player: 'Johnny Bower' },
        { number: 9, player: 'Fred Glover' },
        { number: 15, player: 'Jock Callander' },
        { number: 27, player: 'Dave Michayluk' },
      ],
      notableAlumni: ['Oliver Bjorkstrand', 'Calvin Pickard', 'Nathan Gerbe', 'Zac Dalpe', 'T.J. Hensick'],
      records: [
        { label: 'Most points, single season', value: 97, season: '2015-16' },
        { label: 'Most wins, single season', value: 44, season: '2010-11' },
      ],
      affiliates: { nhl: 'CBJ', echl: 'WHL' },
      facts: [
        "The Monsters have retired 4 numbers honoring Cleveland's earlier pro hockey franchises — Johnny Bower (#1) and Fred Glover (#9) played for the AHL's Cleveland Barons (1937-1973), Jock Callander (#15) and Dave Michayluk (#27) for the IHL's Cleveland Lumberjacks (1992-2001) — a deliberate nod to the city's hockey history predating the Monsters themselves, not honors earned by the Monsters' own on-ice alumni.",
        'Oliver Bjorkstrand scored the Calder Cup-winning overtime goal in a 4-0 sweep of the Hershey Bears in 2016.',
        "Independently owned by Dan Gilbert (also owner of the NBA's Cleveland Cavaliers) — a different ownership group from the parent Columbus Blue Jackets.",
      ],
      currentInfo: {
        owner: 'Dan Gilbert (independent ownership, separate from the Columbus Blue Jackets)',
        headCoach: 'Nick Bootland',
        lastVerified: '2026-09-01',
      },
    },

    UTC: {
      founded: {
        year: 1998,
        asFranchise: 'Lowell Lock Monsters (expansion)',
        relocations: [
          { year: 2006, from: 'Lowell, MA', to: 'Lowell, MA', renamedTo: 'Lowell Devils', note: 'Purchased and rebranded by the New Jersey Devils' },
          { year: 2010, from: 'Lowell, MA', to: 'Albany, NY', renamedTo: 'Albany Devils' },
          { year: 2017, from: 'Albany, NY', to: 'Binghamton, NY', renamedTo: 'Binghamton Devils' },
          { year: 2021, from: 'Binghamton, NY', to: 'Utica, NY', renamedTo: 'Utica Comets', note: "This is a DIFFERENT legal franchise from the original 2013-2021 Utica Comets (Vancouver Canucks-owned), which relocated to become the Abbotsford Canucks in the same 2021 swap. The Devils' Binghamton franchise took over the vacated 'Comets' name and city." },
        ],
      },
      arena: {
        name: 'Adirondack Bank Center',
        city: 'Utica, NY',
        capacity: 3999,
        opened: 1960,
        formerNames: [
          { name: 'Utica Memorial Auditorium', years: '1960–2017' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Utica_Memorial_Auditorium_Exterior-_December_15,_2013.jpg',
          attribution: 'Doug Kerr, CC BY-SA 2.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: ['Alexander Holtz', 'Simon Nemec', 'Nolan Foote', 'Akira Schmid', 'Kevin Bahl'],
      records: [
        { label: 'Best start to a season', value: '12-0-0-0', season: '2021-22', note: "AHL record for best start to a season since the league's 1936 founding, part of a 13-game overall winning streak" },
      ],
      affiliates: { nhl: 'NJD', echl: 'ADK' },
      facts: [
        "The 'Utica Comets' name has belonged to two entirely different franchises: the original 2013-2021 team (Vancouver Canucks-owned, now the Abbotsford Canucks) and the current one (2021-present), which is actually the relocated New Jersey Devils affiliate previously known as Binghamton/Albany/Lowell Devils, tracing to a 1998 Lowell expansion team.",
        "Because of that swap, real Utica-based highlights like the original team's AHL-record 121 consecutive sellouts (through 2018) belong to the OTHER (now-Abbotsford) franchise, not this one.",
        "The current Comets opened their first season in Utica (2021-22) with a 12-0-0-0 start, an AHL record for the best start to a season in the league's history.",
      ],
      currentInfo: {
        owner: 'Harris Blitzer Sports & Entertainment (Josh Harris & David Blitzer — same group as the New Jersey Devils)',
        headCoach: 'Ryan Parent',
        lastVerified: '2026-09-01',
      },
    },

    BEL: {
      founded: {
        year: 1972,
        asFranchise: 'New Haven Nighthawks (expansion)',
        relocations: [
          { year: 1992, from: 'New Haven, CT', to: 'New Haven, CT', renamedTo: 'New Haven Senators' },
          { year: 1993, from: 'New Haven, CT', to: 'Charlottetown, PE', renamedTo: 'Prince Edward Island Senators' },
          { year: 2002, from: 'Prince Edward Island (dormant since 1996)', to: 'Binghamton, NY', renamedTo: 'Binghamton Senators', note: 'The Prince Edward Island Senators suspended operations after 1995-96 (the market was deemed too small to support an AHL team) before being revived in Binghamton six years later' },
          { year: 2017, from: 'Binghamton, NY', to: 'Belleville, ON', renamedTo: 'Belleville Senators' },
        ],
      },
      arena: {
        name: 'CAA Arena',
        city: 'Belleville, ON',
        capacity: 4365,
        opened: 1978,
        formerNames: [
          { name: 'Yardmen Arena', years: '1978–2018' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Yardmen_Arena.JPG',
          attribution: 'Flibirigit, public domain, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Calder Cup', years: [2011] },
      ],
      retiredNumbers: [],
      notableAlumni: ['Drake Batherson', 'Nick Paul', 'Parker Kelly', 'Mark Kastelic', 'Jacob Bernard-Docker'],
      records: [
        { label: 'Most goals, single season', value: 234, season: '2019-20', note: "League-leading total before the season was cancelled due to COVID-19" },
      ],
      affiliates: { nhl: 'OTT', echl: 'ALN' },
      facts: [
        'The franchise sat dormant for 6 years (1996-2002) after the Prince Edward Island Senators folded before being revived in Binghamton, NY.',
        'Owner Michael Andlauer bought the NHL\'s Ottawa Senators in 2023 and directly owns the Belleville Senators too — after rumors the AHL team might move to Hamilton, he confirmed in 2025 that Belleville "is there to stay."',
        'The 2010-11 Binghamton Senators won the only Calder Cup in this franchise\'s history.',
      ],
      currentInfo: {
        owner: 'Michael Andlauer (same ownership group as the Ottawa Senators)',
        headCoach: 'Andrew Campbell',
        lastVerified: '2026-09-01',
      },
    },

    LAV: {
      founded: {
        year: 1969,
        asFranchise: 'Montreal Voyageurs',
        relocations: [
          { year: 1971, from: 'Montreal, QC', to: 'Halifax, NS', renamedTo: 'Nova Scotia Voyageurs' },
          { year: 1984, from: 'Halifax, NS', to: 'Sherbrooke, QC', renamedTo: 'Sherbrooke Canadiens' },
          { year: 1990, from: 'Sherbrooke, QC', to: 'Fredericton, NB', renamedTo: 'Fredericton Canadiens' },
          { year: 1999, from: 'Fredericton, NB', to: 'Quebec City, QC', renamedTo: 'Quebec Citadelles' },
          { year: 2002, from: 'Quebec City, QC', to: 'Hamilton, ON', renamedTo: 'Hamilton Bulldogs' },
          { year: 2015, from: 'Hamilton, ON', to: "St. John's, NL", renamedTo: "St. John's IceCaps", note: "Took over the 'IceCaps' brand left vacant by the unrelated Winnipeg Jets-affiliated St. John's IceCaps (2011-2015), which had itself moved to become the Manitoba Moose" },
          { year: 2017, from: "St. John's, NL", to: 'Laval, QC', renamedTo: 'Laval Rocket', note: 'Named for Maurice "Rocket" Richard via fan vote' },
        ],
      },
      arena: {
        name: 'Place Bell',
        city: 'Laval, QC',
        capacity: 10062,
        opened: 2017,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Place_Bell_Laval.20170601_195705.jpg',
          attribution: 'MaxCote, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Calder Cup', years: [1972, 1976, 1977, 1985, 2007] },
      ],
      retiredNumbers: [],
      notableAlumni: ['Patrick Roy', 'Carey Price', 'Jake Evans', 'Gabriel Bourque', 'Michael Pezzetta'],
      records: [
        { label: 'Regular-season champion (Macgregor Kilpatrick Trophy)', value: '2024-25', season: '2024-25', note: "First regular-season title in the franchise's current Laval-era history" },
      ],
      affiliates: { nhl: 'MTL', echl: 'TR' },
      facts: [
        "One of the AHL's most storied lineages: as the Nova Scotia Voyageurs it won back-to-back Calder Cups in 1976 and 1977 the same years the parent Montreal Canadiens won the Stanley Cup — the only franchise pair in AHL/NHL history to sweep both titles together twice.",
        'Patrick Roy (1985, Sherbrooke Canadiens) and Carey Price (2007, Hamilton Bulldogs) each won a Calder Cup as a teenage goaltender for this exact same continuous franchise, 22 years apart.',
        'Owned directly by the Molson family (Geoff Molson, chairman) — the same ownership as the parent Montreal Canadiens.',
      ],
      currentInfo: {
        owner: 'Molson family (Geoff Molson — same ownership as the Montreal Canadiens)',
        headCoach: 'Daniel Jacob',
        lastVerified: '2026-09-01',
      },
    },

    HAM: {
      founded: {
        year: 2001,
        asFranchise: 'Bridgeport Sound Tigers (expansion)',
        relocations: [
          { year: 2021, from: 'Bridgeport, CT', to: 'Bridgeport, CT', renamedTo: 'Bridgeport Islanders', note: 'Renamed only, no relocation' },
          { year: 2026, from: 'Bridgeport, CT', to: 'Hamilton, ON', renamedTo: 'Hamilton Hammers', note: "Relocation announced March 19, 2026; name unveiled May 21, 2026, honoring Hamilton's steelmaking history" },
        ],
      },
      arena: {
        name: 'TD Coliseum',
        city: 'Hamilton, ON',
        capacity: 17383,
        opened: 1985,
        formerNames: [
          { name: 'Copps Coliseum', years: '1985–2014' },
          { name: 'FirstOntario Centre', years: '2014–2024' },
          { name: 'Hamilton Arena', years: '2024–2025' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/TD_Coliseum_Exterior_2.jpg',
          attribution: 'Kyy0602 (Scarlett Kang), CC0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: ['Kyle Okposo', 'Josh Bailey', 'Anders Lee', 'Frans Nielsen', 'Chris Bourque'],
      records: [
        { label: 'Most points, single season', value: 78, season: '2022-23', note: 'Chris Terry' },
      ],
      affiliates: { nhl: 'NYI', echl: 'TRE' },
      facts: [
        "Brand new for 2026-27: relocated from Bridgeport, CT after 25 seasons, becoming the Hamilton Hammers — a name honoring the city's steel industry, with subtle puck details worked into the hammer-head logo as a nod to the Islanders' own logo.",
        'A true expansion franchise founded in 2001, not a relocation of any earlier team.',
        'Hamilton, ON is also home to PWHL Hamilton, a brand-new 2026-27 PWHL expansion team playing in the same building (TD Coliseum) — the two are completely unrelated franchises in different leagues.',
      ],
      currentInfo: {
        owner: 'Jon Ledecky (co-owner of the New York Islanders)',
        headCoach: 'Jay McKee',
        lastVerified: '2026-09-01',
      },
    },

    // ═══ CENTRAL (7 teams) ═══════════════════════════════════════════════════
    // MAJOR CATCH: this agent found a real bug in the already-merged (Phase 1)
    // nhl.CHI entry -- it claimed the Blackhawks' AHL affiliate is 'CHI'
    // (Chicago Wolves), but the Wolves are independently owned and actually
    // affiliated with CAROLINA (matches nhl.CAR's own ahl:'CHI', already
    // correct). The Blackhawks' real AHL affiliate is Rockford (RFD). Verified
    // independently via a direct search before touching already-shipped data --
    // fixed nhl.CHI's affiliates AND its misleading fact directly, above/before
    // this AHL section, not just noted here.
    // VERIFIED: every other nhl/echl pair in this batch matches the existing
    // NHL-phase data with zero discrepancies once the CHI/RFD swap is corrected
    // (NSH<->MIL<->ATL, DAL<->TEX<->IDH, MIN<->IA<->JAX, CAR<->CHI<->GSO).
    // FIXED: '&amp;' -> '&' throughout (MB, MIL, CHI, IA).
    // FIXED: renamed `joinedAHL` -> `joinedLeague` (schema/component now
    // supports this generically -- see TeamHistorySections.jsx).
    // FIXED: TEX's relocations array had a null-valued dormancy entry (same
    // rendering bug as BEL's North-division entry) -- merged into the revival
    // entry's `from` field instead.
    // FLAG: MB and IA both have no verified arena photo -- agent explicitly
    // checked and found only outdated-branding or non-exterior shots, correctly
    // omitted rather than ship a wrong one (matches the CAR/PHI precedent of
    // preferring no photo over a stale one).
    // FLAG: IA's records deliberately left empty -- agent hit conflicting
    // numbers from what it suspects was a table-parsing issue and couldn't
    // re-verify (WebSearch budget exhausted mid-team), correctly chose not to
    // guess. GR similarly has a possible additional record (best-ever points
    // percentage, 2025-26) not included here -- see agent's own note, a
    // reasonable optional addition rather than a required fix.

    MB: {
      founded: {
        year: 1994,
        asFranchise: 'Minnesota Moose (IHL)',
        joinedLeague: 2001,
        relocations: [
          { year: 1996, from: 'Minnesota', to: 'Winnipeg, MB', renamedTo: 'Manitoba Moose', note: 'Purchased by a Mark Chipman-led group after the original Winnipeg Jets left for Phoenix; played IHL 1996-2001, then AHL 2001-2011' },
          { year: 2011, from: 'Winnipeg, MB', to: "St. John's, NL", renamedTo: "St. John's IceCaps", note: 'Return of the NHL Jets to Winnipeg prompted relocation of the AHL club' },
          { year: 2015, from: "St. John's, NL", to: 'Winnipeg, MB', renamedTo: 'Manitoba Moose', note: 'Returned to Winnipeg as the same continuous franchise' },
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
      },
      championships: [],
      retiredNumbers: [
        { number: 12, player: 'Mike Keane' },
        { number: 21, player: 'Jimmy Roy' },
      ],
      notableAlumni: [
        'Kyle Connor', 'Mason Appleton', 'Ryan Kesler', 'Cory Schneider',
        'Logan Stanley', 'Mike Keane',
      ],
      records: [
        { label: 'Most wins, single season', value: 50, season: '2008-09' },
        { label: 'Most points, single season', value: 107, season: '2008-09' },
      ],
      affiliates: { nhl: 'WPG', echl: 'BLM' },
      facts: [
        "Despite two Calder Cup Final appearances (2009 as Manitoba, 2014 as the St. John's IceCaps), the franchise has never won the Calder Cup.",
        "Rick Rypien's #11 is unofficially honored by the club but was never formally retired the way #12 (Mike Keane) and #21 (Jimmy Roy) were.",
        'The franchise is owned by True North Sports & Entertainment, the same ownership group that owns the parent Winnipeg Jets — one continuous AHL/IHL franchise has now been the "Moose" in three different cities (Minneapolis, Winnipeg, St. John\'s) under two different names.',
      ],
      currentInfo: {
        owner: 'True North Sports & Entertainment (Mark Chipman, Chairman)',
        headCoach: 'Mark Morrison',
        lastVerified: '2026-09-01',
      },
    },

    MIL: {
      founded: {
        year: 1970,
        asFranchise: 'Milwaukee Wings (independent/amateur)',
        joinedLeague: 2001,
      },
      arena: {
        name: 'UW–Milwaukee Panther Arena',
        city: 'Milwaukee, WI',
        capacity: 9652,
        opened: 1950,
        formerNames: [
          { name: 'Milwaukee Arena', years: '1950–1974' },
          { name: 'MECCA', years: '1974–1995' },
          { name: 'Wisconsin Center Arena', years: '1995–2000' },
          { name: 'U.S. Cellular Arena', years: '2000–2014' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Milwaukee_July_2023_103_%28UW%E2%80%93Milwaukee_Panther_Arena%29.jpg',
          attribution: 'Michael Barera, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Calder Cup', years: [2004] },
      ],
      retiredNumbers: [
        { number: 9, player: 'Phil Wittliff' },
        { number: 14, player: 'Fred Berry & Mike McNeill' },
        { number: 20, player: 'Darren Haydar' },
        { number: 26, player: 'Tony Hrkac' },
        { number: 27, player: 'Danny Lecours' },
        { number: 44, player: 'Kevin Willison & Gino Cavallini' },
      ],
      notableAlumni: [
        'Pekka Rinne', 'Kevin Fiala', 'Dan Hamhuis', 'Colton Sissons',
        'Cody Franson', 'Darren Haydar',
      ],
      records: [
        { label: 'Most points, single season', value: 138, season: '1982-83' },
        { label: 'Most wins, single season', value: 49, season: '2005-06' },
      ],
      affiliates: { nhl: 'NSH', echl: 'ATL' },
      facts: [
        'The Admirals have never relocated in over 50 years of existence — the franchise has played continuously in Milwaukee since 1970, moving up through the USHL (1973), IHL (1977) and finally the AHL (2001) without ever changing cities.',
        "Darren Haydar's #20, retired in 2020, honors the driving force behind the Admirals' only Calder Cup, won in 2004 against Wilkes-Barre/Scranton.",
        "Karl Taylor became the winningest coach in franchise history in 2025, and the Admirals have been Nashville's AHL affiliate continuously since the Predators' own 1998 founding — one of the longest-running NHL-AHL partnerships in the league.",
      ],
      currentInfo: {
        owner: 'Harris Turer (independently owned, not Predators-owned)',
        headCoach: 'Karl Taylor',
        lastVerified: '2026-09-01',
      },
    },

    GR: {
      founded: {
        year: 1996,
        joinedLeague: 2001,
      },
      arena: {
        name: 'Van Andel Arena',
        city: 'Grand Rapids, MI',
        capacity: 10834,
        opened: 1996,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Van_Andel_Arena_2021.jpg',
          attribution: 'WMrapids, CC0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Calder Cup', years: [2013, 2017] },
      ],
      retiredNumbers: [
        { number: 24, player: 'Travis Richards' },
      ],
      notableAlumni: [
        'Tyler Bertuzzi', 'Dylan Larkin', 'Jimmy Howard', 'Petr Mrazek',
        'Travis Richards',
      ],
      records: [
        { label: 'Most wins, single season', value: 55, season: '2005-06' },
        { label: 'Most points, single season', value: 117, season: '2005-06' },
      ],
      affiliates: { nhl: 'DET', echl: 'TOL' },
      facts: [
        "Travis Richards played in each of the Griffins' first 10 seasons (1996-2006) and holds the franchise record for career games played (655); his #24 was the first number the club ever retired.",
        'Tyler Bertuzzi was named MVP of the 2017 Calder Cup Final, one of two championships (2013, 2017) the Griffins have won as Detroit\'s primary affiliate.',
        'The Griffins have been independently owned by the DeVos and Van Andel families since founding in 1996 (as West Michigan Hockey, Inc.) — the franchise itself is not owned by the Red Wings organization, despite being its exclusive AHL affiliate since 2002.',
      ],
      currentInfo: {
        owner: 'Dan DeVos (independently owned, not Red Wings-owned)',
        headCoach: 'Dan Watson',
        lastVerified: '2026-09-01',
      },
    },

    CHI: {
      founded: {
        year: 1994,
        asFranchise: 'Chicago Wolves (IHL expansion)',
        joinedLeague: 2001,
      },
      arena: {
        name: 'Allstate Arena',
        city: 'Rosemont, IL',
        capacity: 16692,
        opened: 1980,
        formerNames: [
          { name: 'Rosemont Horizon', years: '1980–1999' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Allstate_Arena_viewed_from_expressway_%28July_2023%29_1.jpg',
          attribution: 'SecretName101, CC BY 4.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Calder Cup', years: [2002, 2008, 2022] },
      ],
      retiredNumbers: [
        { number: 1, player: 'Wendell Young' },
        { number: 11, player: 'Steve Maltais' },
      ],
      notableAlumni: [
        'Jordan Binnington', 'Kari Lehtonen', 'Chris Butler', 'Derek MacKenzie',
        'Steve Maltais', 'Wendell Young',
      ],
      records: [
        { label: 'Most wins, single season', value: 50, season: '2021-22' },
        { label: 'Most points, single season', value: 110, season: '2021-22' },
      ],
      affiliates: { nhl: 'CAR', echl: 'GSO' },
      facts: [
        'The Wolves also won two IHL Turner Cups (1998, 2000) before the IHL folded and the franchise joined the AHL in 2001 — winning the Calder Cup in their very first AHL season, one of only a handful of teams in league history to do so.',
        'Unlike most AHL clubs, the Wolves have never been owned by their NHL parent — Don Levin and Buddy Meyers have owned the franchise independently through a long string of different NHL affiliations (Atlanta, Vancouver, St. Louis, Vegas, and now Carolina).',
        "The Wolves share their exact name and home city with the NHL's Chicago Blackhawks despite being a completely separate franchise — the Blackhawks' actual AHL affiliate is the Rockford IceHogs, not the Wolves.",
      ],
      currentInfo: {
        owner: 'Don Levin & Buddy Meyers (independently owned)',
        headCoach: 'Spiros Anastas',
        lastVerified: '2026-09-01',
      },
    },

    RFD: {
      founded: {
        year: 1995,
        asFranchise: 'Baltimore Bandits',
        relocations: [
          { year: 1997, from: 'Baltimore, MD', to: 'Cincinnati, OH', renamedTo: 'Cincinnati Mighty Ducks' },
          { year: 2007, from: 'Cincinnati, OH (dormant 2005–2007)', to: 'Rockford, IL', renamedTo: 'Rockford IceHogs', note: 'Not the same franchise as an earlier, unrelated UHL Rockford IceHogs (1999-2007) — only that separate club\'s name/logo were adopted' },
        ],
      },
      arena: {
        name: 'BMO Center',
        city: 'Rockford, IL',
        capacity: 5900,
        opened: 1981,
        formerNames: [
          { name: 'Rockford MetroCentre', years: '1981–2011' },
          { name: 'BMO Harris Bank Center', years: '2011–2022' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/BMO_Center_-_Rockford,_Illinois_-_March_2024.jpg',
          attribution: 'SimLibrarian, CC0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: [
        'Corey Crawford', 'Niklas Hjalmarsson', 'Brandon Saad', 'Kris Versteeg',
        'Bryan Bickell',
      ],
      records: [
        { label: 'Most wins, single season', value: 46, season: '2014-15' },
        { label: 'Most points, single season', value: 99, season: '2014-15' },
      ],
      affiliates: { nhl: 'CHI', echl: 'IND' },
      facts: [
        'The current AHL IceHogs are not the same franchise as an earlier, unrelated Rockford IceHogs that played in the United Hockey League from 1999 to 2007 — when the AHL club (previously the Baltimore Bandits, then Cincinnati Mighty Ducks) relocated to Rockford in 2007, it simply purchased and reused that earlier team\'s name and logo.',
        'The franchise has never won a Calder Cup, despite reaching the Western Conference Final for the first time in team history in 2017-18.',
        'The AHL Board of Governors approved the Chicago Blackhawks\' direct acquisition of the IceHogs in 2026 — the team is now owned by the Wirtz Corporation, the same family that owns the Blackhawks, matching a broader trend of NHL teams buying out independently-owned AHL affiliates.',
      ],
      currentInfo: {
        owner: "Wirtz Corporation (directly owned by the Blackhawks' ownership family)",
        headCoach: 'Jared Nightingale',
        lastVerified: '2026-09-01',
      },
    },

    TEX: {
      founded: {
        year: 1999,
        asFranchise: 'Louisville Panthers',
        relocations: [
          { year: 2005, from: 'Louisville, KY (dormant 2001–2005)', to: 'Des Moines, IA', renamedTo: 'Iowa Stars', note: 'Resurrected as a Dallas Stars affiliate after four dormant seasons with no NHL affiliate and no games played' },
          { year: 2008, from: 'Des Moines, IA', to: 'Des Moines, IA', renamedTo: 'Iowa Chops', note: 'Re-affiliated with the Anaheim Ducks; suspended by the AHL for 2009-10 after one season' },
          { year: 2010, from: 'Des Moines, IA', to: 'Cedar Park, TX', renamedTo: 'Texas Stars', note: "Purchased out of suspension by the Dallas Stars' ownership group" },
        ],
      },
      arena: {
        name: 'H-E-B Center at Cedar Park',
        city: 'Cedar Park, TX',
        capacity: 6778,
        opened: 2009,
        formerNames: [
          { name: 'Cedar Park Center', years: '2009–2016' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Cedar_park_center_2014.jpg',
          attribution: 'Larry D. Moore, CC BY 4.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Calder Cup', years: [2014] },
      ],
      retiredNumbers: [
        { number: 23, player: 'Travis Morin' },
      ],
      notableAlumni: [
        'Travis Morin', 'Colton Sceviour', 'Jamie Oleksiak', 'Radek Faksa',
        'Jack Campbell',
      ],
      records: [
        { label: 'Most wins, single season', value: 48, season: '2013-14' },
        { label: 'Most points, single season', value: 106, season: '2013-14' },
      ],
      affiliates: { nhl: 'DAL', echl: 'IDH' },
      facts: [
        "The Texas Stars' franchise history predates its Dallas affiliation by a decade: it began as the 1999 Louisville Panthers (Florida Panthers' affiliate), went dormant for four years, and was revived in 2005 as the Iowa Stars — spending one season as the Anaheim Ducks' Iowa Chops before Dallas Stars ownership bought and relocated the suspended franchise to Texas in 2010.",
        "Travis Morin, whose #23 is the only number the Stars have retired, is the franchise's all-time leader in points, goals, assists, and games played.",
        'The Stars won the Calder Cup in just their fifth season (2014), the same season they set their still-standing franchise records for wins (48) and points (106).',
      ],
      currentInfo: {
        owner: 'Tom Gaglardi / Northland Properties Corporation (same ownership as the Dallas Stars)',
        headCoach: 'Toby Petersen',
        lastVerified: '2026-09-01',
      },
    },

    IA: {
      founded: {
        year: 1994,
        asFranchise: 'Houston Aeros (IHL)',
        joinedLeague: 2001,
        relocations: [
          { year: 2013, from: 'Houston, TX', to: 'Des Moines, IA', renamedTo: 'Iowa Wild', note: "Relocated after Minnesota Sports & Entertainment couldn't reach a new lease at Houston's Toyota Center" },
        ],
      },
      arena: {
        name: "Casey's Center",
        city: 'Des Moines, IA',
        capacity: 15181,
        opened: 2005,
        formerNames: [
          { name: 'Wells Fargo Arena', years: '2005–2025' },
        ],
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: [
        'Kirill Kaprizov', 'Kevin Fiala', 'Marco Rossi', 'Matt Boldy',
        'Joel Eriksson Ek', 'Gerald Mayhew',
      ],
      records: [],
      affiliates: { nhl: 'MIN', echl: 'JAX' },
      facts: [
        "The Iowa Wild's franchise history goes back to the 1994 Houston Aeros, which won the Calder Cup in 2003 and reached the Final again in 2011 as the Minnesota Wild's AHL affiliate — the same continuous franchise that relocated to Des Moines in 2013, but the Iowa Wild itself has not yet won a Calder Cup under that name.",
        'Iowa has become one of the most productive development pipelines in the AHL, sending Kirill Kaprizov, Kevin Fiala, Marco Rossi, and Matt Boldy through its lineup on their way to becoming core Minnesota Wild players.',
        "Wells Fargo Arena, Iowa's home since it opened in 2005, was renamed Casey's Center in mid-2025 after Wells Fargo's naming rights expired.",
      ],
      currentInfo: {
        owner: "Minnesota Sports & Entertainment (directly owned by the Wild's ownership group)",
        headCoach: 'Stu Bickel',
        lastVerified: '2026-09-01',
      },
    },

    // ═══ PACIFIC (10 teams) — final AHL batch, all 32 teams now covered ═══════
    // VERIFIED: Willie O'Ree's retired SD number is #20, not #22 (agent's own
    // flagged conflict) -- confirmed via a direct search; #22 was likely
    // confused with an unrelated NHL/Bruins context.
    // VERIFIED: every single nhl/echl pair in this batch matches the existing
    // NHL-phase data with ZERO conflicts (EDM/FW, LAK/GVL, ANA/TUL, SJS/WIC,
    // COL/NM, VGK/TAH, VAN/KAL, CGY/RC, SEA/KC) -- strong closing signal the
    // whole 32-team affiliate graph is internally self-consistent.
    // FIXED: '&amp;' -> '&' throughout (SJ, HSK, ABB).
    // FIXED: several relocations arrays had entries missing from/to/renamedTo
    // (just a bare {year, note} for a dormancy/suspension/league-change) --
    // same rendering-bug family as BEL/TEX earlier (would show blank/undefined
    // text in the UI). Merged each into the adjacent real move's `from` field
    // instead (BAK, HSK, CGY). COL's two entries were removed entirely --
    // changing leagues (CHL -> ECHL -> AHL) while staying in the same city,
    // arena, and ownership isn't a relocation at all; used founded.joinedLeague
    // (the field added for exactly this Central-division pattern) instead.
    // FLAG: COL's 5 retired numbers are single-sourced (team's own site only,
    // not on Wikipedia) -- worth a second look before treating as gospel.
    // FLAG: CV's ownership is genuinely ambiguous between two sources (Oak View
    // Group vs. Seattle Hockey Partners) -- kept both rather than picking one.
    // FLAG: several very recent (2025-2026) head-coach hires across this batch
    // (COL, ABB, CGY, HSK) -- re-verify close to ship, fast-moving category.

    BAK: {
      founded: {
        year: 1984,
        asFranchise: 'Nova Scotia Oilers',
        relocations: [
          { year: 1988, from: 'Nova Scotia', to: 'Cape Breton, NS', renamedTo: 'Cape Breton Oilers' },
          { year: 1996, from: 'Cape Breton, NS', to: 'Hamilton, ON', renamedTo: 'Hamilton Bulldogs', note: 'A distinct, earlier franchise from the later Canadiens-affiliated Hamilton Bulldogs that used the same name 2002-2015' },
          { year: 2003, from: 'Hamilton, ON', to: 'Toronto, ON', renamedTo: 'Toronto Roadrunners' },
          { year: 2004, from: 'Toronto, ON', to: 'Edmonton, AB', renamedTo: 'Edmonton Road Runners' },
          { year: 2010, from: 'Edmonton, AB (dormant 2005–2010)', to: 'Oklahoma City, OK', renamedTo: 'Oklahoma City Barons', note: 'Revived after a five-season dormancy' },
          { year: 2015, from: 'Oklahoma City, OK', to: 'Bakersfield, CA', renamedTo: 'Bakersfield Condors' },
        ],
      },
      arena: {
        name: 'Dignity Health Arena',
        city: 'Bakersfield, CA',
        capacity: 8751,
        opened: 1998,
        formerNames: [
          { name: 'Centennial Garden', years: '1998–2005' },
          { name: 'Rabobank Arena', years: '2005–2019' },
          { name: 'Mechanics Bank Arena', years: '2019–2025' },
        ],
        photo: {
          source: 'wikimedia',
          url: "https://commons.wikimedia.org/wiki/Special:FilePath/2009-0726-CA-Bakersfield-RabobankArena.jpg",
          attribution: "Bobak Ha'Eri, CC BY 3.0, via Wikimedia Commons",
        },
      },
      championships: [
        { title: 'Calder Cup', years: [1993] },
      ],
      retiredNumbers: [],
      notableAlumni: ['Stuart Skinner', 'Dylan Holloway', 'Philip Broberg', 'Ryan McLeod', 'Drake Caggiula'],
      records: [
        { label: 'Most wins, single season', value: 42, season: '2018-19' },
        { label: 'Most points, single season', value: 89, season: '2018-19' },
      ],
      affiliates: { nhl: 'EDM', echl: 'FW' },
      facts: [
        "The Condors' AHL lineage traces back to 1984 as the Nova Scotia Oilers, and won a Calder Cup in 1993 as the Cape Breton Oilers — decades before ever playing a game in Bakersfield.",
        'The Oilers moved their AHL affiliate to Bakersfield in 2015 specifically to shorten road trips and callups between the NHL club and its farm team, one of several moves that reshaped the AHL into a new California-based Pacific Division that year.',
        'The franchise sat completely dormant for five seasons (2005-2010) between stints as the Edmonton Road Runners and the Oklahoma City Barons.',
      ],
      currentInfo: {
        owner: 'Oilers Entertainment Group (Daryl Katz, chairman)',
        headCoach: 'Colin Chaulk',
        lastVerified: '2026-09-01',
      },
    },

    ONT: {
      founded: {
        year: 2001,
        asFranchise: 'Manchester Monarchs',
        relocations: [
          { year: 2015, from: 'Manchester, NH', to: 'Ontario, CA', renamedTo: 'Ontario Reign', note: "Direct relocation immediately after Manchester won the 2015 Calder Cup in its final AHL game" },
        ],
      },
      arena: {
        name: 'Toyota Arena',
        city: 'Ontario, CA',
        capacity: 9736,
        opened: 2008,
        formerNames: [
          { name: 'Citizens Business Bank Arena', years: '2008–2019' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/CBBArena.JPG',
          attribution: 'Scottthezombie, CC BY-SA 3.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Calder Cup', years: [2015] },
      ],
      retiredNumbers: [],
      notableAlumni: ['Gabriel Vilardi', 'Alex Turcotte', 'Quinton Byfield', 'Cal Petersen', 'Martin Frk'],
      records: [
        { label: 'Most wins, single season', value: 47, season: '2025-26' },
        { label: 'Most points, single season', value: 99, season: '2025-26' },
      ],
      affiliates: { nhl: 'LAK', echl: 'GVL' },
      facts: [
        "The Reign's franchise won the Calder Cup as the Manchester Monarchs in June 2015 — the very last AHL game the Monarchs ever played before relocating to Ontario the following season.",
        "The Kings moved their AHL affiliate to Ontario, California in 2015 to cut player-development travel time to the NHL club, one of several such moves that built out the AHL's new Pacific Division that year.",
        'Ontario set franchise records for wins (47) and points (99) in 2025-26, its best regular season since joining the AHL.',
      ],
      currentInfo: {
        owner: 'Anschutz Entertainment Group (AEG)',
        headCoach: 'Andrew Lord',
        lastVerified: '2026-09-01',
      },
    },

    SD: {
      founded: {
        year: 2000,
        asFranchise: 'Norfolk Admirals',
        relocations: [
          { year: 2015, from: 'Norfolk, VA', to: 'San Diego, CA', renamedTo: 'San Diego Gulls', note: 'Anaheim purchased the Tampa Bay-affiliated Norfolk Admirals and relocated them; an unrelated new ECHL-affiliated Norfolk Admirals began play in Norfolk the same year' },
        ],
      },
      arena: {
        name: 'Pechanga Arena',
        city: 'San Diego, CA',
        capacity: 12920,
        opened: 1966,
        formerNames: [
          { name: 'San Diego International Sports Center', years: '1966–1970' },
          { name: 'San Diego Sports Arena', years: '1970–2005, 2007–2010' },
          { name: 'iPayOne Center', years: '2005–2007' },
          { name: 'Valley View Casino Center', years: '2010–2018' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/San_Diego_Sports_Arena.jpg',
          attribution: 'Nehrams2020, CC BY-SA 3.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Calder Cup', years: [2012] },
      ],
      retiredNumbers: [
        { number: 20, player: "Willie O'Ree" },
      ],
      notableAlumni: ['Trevor Zegras', 'Troy Terry', 'John Gibson', 'Max Comtois'],
      records: [
        { label: 'Most wins, single season (Norfolk Admirals era)', value: 55, season: '2011-12' },
        { label: 'Longest win streak to close a season (Norfolk Admirals era)', value: 28, season: '2011-12', note: 'Still a North American professional hockey record' },
      ],
      affiliates: { nhl: 'ANA', echl: 'TUL' },
      facts: [
        "The Gulls' franchise won the 2012 Calder Cup as the Norfolk Admirals, closing that regular season with 28 straight wins — still a North American professional hockey record.",
        "Pechanga Arena first opened in 1966 for an entirely unrelated original 'San Diego Gulls' team in the old Western Hockey League; the current AHL Gulls (relocated from Norfolk in 2015) reused that name and now play in the very same building.",
        "The arena's rafters honor Willie O'Ree — the first Black player in NHL history, whose #20 was retired for his time with that original 1960s WHL San Diego Gulls team, not the current AHL franchise's own on-ice history.",
      ],
      currentInfo: {
        owner: 'Henry and Susan Samueli',
        headCoach: 'Dave Manson',
        lastVerified: '2026-09-01',
      },
    },

    SJ: {
      founded: {
        year: 1996,
        asFranchise: 'Kentucky Thoroughblades',
        relocations: [
          { year: 2001, from: 'Lexington, KY', to: 'Cleveland, OH', renamedTo: 'Cleveland Barons' },
          { year: 2006, from: 'Cleveland, OH', to: 'Worcester, MA', renamedTo: 'Worcester Sharks' },
          { year: 2015, from: 'Worcester, MA', to: 'San Jose, CA', renamedTo: 'San Jose Barracuda' },
        ],
      },
      arena: {
        name: 'Tech CU Arena',
        city: 'San Jose, CA',
        capacity: 4200,
        opened: 2022,
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: ['William Eklund', 'Mario Ferraro', 'Tomas Hertl', 'Timo Meier', 'Danil Gushchin'],
      records: [
        { label: 'Most goals, single season', value: 244, season: '2024-25' },
        { label: 'Most power-play goals, single season', value: 69, season: '2024-25' },
      ],
      affiliates: { nhl: 'SJS', echl: 'WIC' },
      facts: [
        "The Barracuda's franchise dates to 1996 as the Kentucky Thoroughblades, and passed through Cleveland (Barons) and Worcester (Sharks) before the Sharks moved it to San Jose in 2015 to sit alongside the NHL club.",
        "At 4,200 seats, Tech CU Arena is one of the smallest arenas in the AHL — part of the Sharks Ice training complex, it replaced the much larger SAP Center (shared with the parent Sharks) starting in 2022.",
        "Forward Danil Gushchin is the franchise's all-time AHL leader in points, goals, and assists.",
      ],
      currentInfo: {
        owner: 'Hasso Plattner (Sharks Sports & Entertainment)',
        headCoach: 'John McCarthy',
        lastVerified: '2026-09-01',
      },
    },

    TUC: {
      founded: {
        year: 1994,
        asFranchise: 'Springfield Falcons',
        relocations: [
          { year: 2016, from: 'Springfield, MA', to: 'Tucson, AZ', renamedTo: 'Tucson Roadrunners' },
        ],
      },
      arena: {
        name: 'Tucson Arena (Tucson Convention Center)',
        city: 'Tucson, AZ',
        capacity: 6521,
        opened: 1971,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Tucson_May_2019_22_%28Tucson_Arena_at_the_Tucson_Convention_Center%29.jpg',
          attribution: 'Michael Barera, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [
        { number: 14, player: 'Craig Cunningham' },
      ],
      notableAlumni: ['Barrett Hayton', 'Dylan Guenther', 'Conor Garland', 'Dylan Strome', 'Lawson Crouse'],
      records: [],
      affiliates: { nhl: 'UTA' },
      facts: [
        'Despite the Arizona Coyotes relocating to Salt Lake City and becoming the Utah Mammoth in 2024, the Roadrunners stayed put in Tucson as Utah\'s AHL affiliate — an unusually direct case of an AHL team outlasting its NHL parent\'s own relocation.',
        "Captain Craig Cunningham's #14 was retired after he suffered sudden cardiac arrest on the ice before a November 2016 game; medical staff saved his life, though he later had part of his leg amputated and never played again.",
        'Roadrunners owner Alex Meruelo kept ownership of the AHL club even as the NHL franchise itself changed both hands and cities — the Roadrunners and Utah Mammoth are no longer under common ownership.',
      ],
      currentInfo: {
        owner: 'Alex Meruelo',
        headCoach: 'Steve Potvin',
        lastVerified: '2026-09-01',
      },
    },

    COL: {
      founded: {
        year: 2003,
        asFranchise: 'Colorado Eagles (Central Hockey League)',
        joinedLeague: 2018,
      },
      arena: {
        name: 'Blue Arena',
        city: 'Loveland, CO',
        capacity: 5089,
        opened: 2003,
        formerNames: [
          { name: 'Budweiser Events Center', years: '2003–2023' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/BudweiserEventsCenter.jpg',
          attribution: 'Icebourg, public domain, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [
        { number: 89, player: 'Greg Pankewicz' },
        { number: 12, player: 'Riley Nelson' },
        { number: 17, player: 'Ryan Tobler' },
        { number: 27, player: 'Brad Williamson' },
        { number: 23, player: 'Aaron Schneekloth' },
      ],
      notableAlumni: ['Alex Newhook', "Logan O'Connor", 'Justus Annunen', 'Riley Nelson'],
      records: [
        { label: 'Most goals in a season by a defenseman (AHL record)', value: 31, season: '2024-25', note: 'Jacob MacDonald' },
      ],
      affiliates: { nhl: 'COL', echl: 'NM' },
      facts: [
        'The Eagles played in the Central Hockey League (2003-2011) and ECHL (2011-2018) before joining the AHL in 2018 as an Avalanche-owned expansion team — same ownership, arena, and market throughout.',
        'The Eagles have never won a Calder Cup, but won two Central Hockey League titles (2005, 2007) and back-to-back ECHL Kelly Cups (2017, 2018) under the same Loveland ownership before moving up to the AHL.',
        'Colorado reached the 2026 Western Conference Final — one round short of the Calder Cup Finals — after sweeping Coachella Valley in the division final, then fell to the Chicago Wolves.',
      ],
      currentInfo: {
        owner: 'Martin Lind',
        headCoach: 'Jussi Ahokas',
        lastVerified: '2026-09-01',
      },
    },

    HSK: {
      founded: {
        year: 1971,
        asFranchise: 'Tidewater Wings',
        relocations: [
          { year: 1972, from: 'Tidewater, VA', to: 'Tidewater, VA', renamedTo: 'Virginia Wings', note: 'Name change only, same Norfolk-area market' },
          { year: 1979, from: 'Virginia (suspended 1975–1979)', to: 'Glens Falls, NY', renamedTo: 'Adirondack Red Wings', note: 'Revived after a several-season suspension' },
          { year: 2002, from: 'Adirondack (dormant 1999–2002)', to: 'San Antonio, TX', renamedTo: 'San Antonio Rampage', note: 'Purchased and revived by San Antonio Spurs ownership' },
          { year: 2020, from: 'San Antonio, TX', to: 'Henderson, NV', renamedTo: 'Henderson Silver Knights', note: 'Purchased by the Vegas Golden Knights' },
        ],
      },
      arena: {
        name: "Lee's Family Forum",
        city: 'Henderson, NV',
        capacity: 5567,
        opened: 2022,
        formerNames: [
          { name: 'Dollar Loan Center', years: '2022–2024' },
        ],
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: ['Pavel Dorofeyev', 'Brendan Brisson', 'Jesper Vikman'],
      records: [
        { label: 'Most wins, single season', value: 39, season: '2025-26' },
        { label: 'Most points, single season', value: 90, season: '2025-26' },
      ],
      affiliates: { nhl: 'VGK', echl: 'TAH' },
      facts: [
        "The Silver Knights' franchise dates to 1971 as the Tidewater/Virginia Wings, a Detroit Red Wings affiliate that later became the Adirondack Red Wings, then sat dormant for three years before being revived in 2002 by San Antonio Spurs ownership as the San Antonio Rampage.",
        'Vegas purchased the St. Louis-affiliated San Antonio Rampage in February 2020 and relocated it to Henderson to sit minutes from its own arena — one of the most direct "AHL team built to shadow its NHL parent" moves in the division.',
        'Despite more than 50 years of continuous franchise history under five different names, the organization has never won a Calder Cup.',
      ],
      currentInfo: {
        owner: 'Bill Foley / Vegas Golden Knights (Black Knight Sports & Entertainment)',
        headCoach: 'Joel Ward',
        lastVerified: '2026-09-01',
      },
    },

    ABB: {
      founded: {
        year: 1926,
        asFranchise: 'Springfield Indians (Canadian-American Hockey League)',
        relocations: [
          { year: 1932, from: 'Springfield, MA', to: 'Quebec City, QC', renamedTo: 'Quebec Beavers (Castors)' },
          { year: 1935, from: 'Quebec City, QC', to: 'Springfield, MA', renamedTo: 'Springfield Indians' },
          { year: 1951, from: 'Springfield, MA', to: 'Syracuse, NY', renamedTo: 'Syracuse Warriors' },
          { year: 1954, from: 'Syracuse, NY', to: 'Springfield, MA', renamedTo: 'Springfield Indians', note: "Also briefly the Springfield Kings (1967-1974) while leased to the Los Angeles Kings, before reverting" },
          { year: 1994, from: 'Springfield, MA', to: 'Worcester, MA', renamedTo: 'Worcester IceCats' },
          { year: 2005, from: 'Worcester, MA', to: 'Peoria, IL', renamedTo: 'Peoria Rivermen' },
          { year: 2013, from: 'Peoria, IL', to: 'Utica, NY', renamedTo: 'Utica Comets', note: 'Purchased by Canucks Sports & Entertainment' },
          { year: 2021, from: 'Utica, NY', to: 'Abbotsford, BC', renamedTo: 'Abbotsford Canucks' },
        ],
      },
      arena: {
        name: 'Rogers Forum',
        city: 'Abbotsford, BC',
        capacity: 7000,
        opened: 2009,
        formerNames: [
          { name: 'Abbotsford Centre (Abbotsford Entertainment and Sports Centre)', years: '2009–2025' },
        ],
      },
      championships: [
        { title: 'Calder Cup', years: [1960, 1961, 1962, 1971, 1975, 1990, 1991, 2025] },
      ],
      retiredNumbers: [],
      notableAlumni: ['Eddie Shore', 'Billy Smith', 'Thatcher Demko', 'Nils Höglander', 'Phil Di Giuseppe'],
      records: [
        { label: 'Most goals in a season (Springfield Indians era)', value: 56, season: '1990-91' },
      ],
      affiliates: { nhl: 'VAN', echl: 'KAL' },
      facts: [
        'The Abbotsford Canucks are the second-oldest continuously operating minor pro hockey franchise in North America, dating to 1926 as the Springfield Indians — nine years before the AHL itself was even formed — and have played under ten different names across four U.S. states and one Canadian province.',
        'Bruins Hall of Famer Eddie Shore bought the Springfield Indians in 1939 and built a dynasty: the team won three straight Calder Cups from 1960-1962, a three-peat no AHL team has matched before or since.',
        'In June 2025 the franchise won its first Calder Cup as the Abbotsford Canucks, becoming the first team from the AHL\'s Pacific Division and the first Western Canadian franchise ever to do so.',
      ],
      currentInfo: {
        owner: 'Canucks Sports & Entertainment (Francesco Aquilini, chairman)',
        headCoach: 'Ryan Papaioannou',
        lastVerified: '2026-09-01',
      },
    },

    CGY: {
      founded: {
        year: 1977,
        asFranchise: 'Maine Mariners',
        relocations: [
          { year: 1987, from: 'Portland, ME', to: 'Utica, NY', renamedTo: 'Utica Devils' },
          { year: 1993, from: 'Utica, NY', to: 'Saint John, NB', renamedTo: 'Saint John Flames' },
          { year: 2005, from: 'Saint John, NB (suspended 2003–2005)', to: 'Omaha, NE', renamedTo: 'Omaha Ak-Sar-Ben Knights', note: 'Revived after a two-season suspension' },
          { year: 2007, from: 'Omaha, NE', to: 'Moline, IL (Quad Cities)', renamedTo: 'Quad City Flames' },
          { year: 2009, from: 'Moline, IL', to: 'Abbotsford, BC', renamedTo: 'Abbotsford Heat' },
          { year: 2014, from: 'Abbotsford, BC', to: 'Glens Falls, NY', renamedTo: 'Adirondack Flames' },
          { year: 2015, from: 'Glens Falls, NY', to: 'Stockton, CA', renamedTo: 'Stockton Heat' },
          { year: 2022, from: 'Stockton, CA', to: 'Calgary, AB', renamedTo: 'Calgary Wranglers' },
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
        { title: 'Calder Cup', years: [1978, 1979, 1984, 2001] },
      ],
      retiredNumbers: [],
      notableAlumni: ['Dustin Wolf', 'Matthew Phillips', 'Martin Frk', 'Dryden Hunt'],
      records: [
        { label: 'Most points, single season', value: 76, season: '2022-23' },
        { label: 'Most wins by a goaltender, single season', value: 42, season: '2022-23', note: 'Dustin Wolf' },
      ],
      affiliates: { nhl: 'CGY', echl: 'RC' },
      facts: [
        'The Wranglers franchise dates to the 1977 Maine Mariners, who won three Calder Cups in Portland (1978, 1979, 1984) and a fourth as the Saint John Flames (2001), then passed through seven more cities and names — including two different stints in Abbotsford, BC — before landing in Calgary in 2022.',
        "The Wranglers are one of the few AHL teams to share their NHL parent's own arena rather than play in a separate building — the 19,289-seat Scotiabank Saddledome, home to the Flames since 1983.",
        'Goaltender Dustin Wolf set the franchise record with 42 wins in a single season (2022-23) on his way to the NHL with Calgary.',
      ],
      currentInfo: {
        owner: 'Calgary Sports and Entertainment (N. Murray Edwards, chairman)',
        headCoach: 'Brett Sutter',
        lastVerified: '2026-09-01',
      },
    },

    CV: {
      founded: {
        year: 2022,
      },
      arena: {
        name: 'Acrisure Arena',
        city: 'Thousand Palms, CA (Coachella Valley / Palm Desert area)',
        capacity: 11000,
        opened: 2022,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Ejf_8593_52987729096_o.jpg',
          attribution: 'Eric Fowler (TheAHL), CC BY 2.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: ['Tye Kartye', 'Nikke Kokko', 'Tyson Jugnauth'],
      records: [
        { label: 'Most points, single season', value: 103, season: '2022-23', note: 'Tied again in 2023-24' },
      ],
      affiliates: { nhl: 'SEA', echl: 'KC' },
      facts: [
        'Coachella Valley is a pure expansion franchise built specifically to give the Seattle Kraken a nearby Southern California development base — part of a wave of newer-market NHL teams (Vegas, Seattle, Utah) that built or affiliated with AHL teams close to home in the 2020s.',
        'The Firebirds reached the Calder Cup Finals in each of their first two seasons (2023, 2024), losing both times to the Hershey Bears, and have yet to win a title.',
        'Acrisure Arena was jointly developed by Oak View Group and the Kraken ownership group to bring the Firebirds to the previously hockey-less Coachella Valley resort region.',
      ],
      currentInfo: {
        owner: 'Seattle Hockey Partners (Seattle Kraken ownership group), with Oak View Group as arena developer/operator',
        headCoach: 'Derek Laxdal',
        lastVerified: '2026-09-01',
      },
    },


  },
  echl: {
    // Verified Phase 4 (ECHL) team entries, accumulated as agents report back.
    // Integrate into src/utils/teamHistory.js TEAM_HISTORY.echl after a final
    // spot-check pass. This is the final league -- once integrated, all 4
    // leagues (NHL/PWHL/AHL/ECHL) have full Team History coverage.

    // ═══ SOUTH (7 teams) ═════════════════════════════════════════════════════
    // VERIFIED: all 7 affiliates blocks match the pre-verified chain handed to
    // the agent exactly, including the JAX Buffalo->Minnesota switch already
    // established in Phase 1/3.
    // FIXED: '&amp;' -> '&' (SAV owner).
    // FIXED: FLA's and SC's career-total records had no `season` value, which
    // would have rendered a literal "(undefined)" in the UI (the component
    // always wraps whatever's in `season` in parens) -- gave both a `season:
    // 'career'` value instead, which reads naturally as plain text.
    // FLAG: ORL's verified photo is an interior shot, not exterior (same
    // departure-from-convention judgment call as AHL's Coachella Valley entry
    // in Phase 3) -- kept it since it's a real, verified, current-branding
    // photo rather than nothing.
    // FLAG: ATL and SAV ship with no photo -- agent could not verify a real,
    // current, non-degraded Commons file for either arena.

    ATL: {
      founded: {
        year: 1995,
        asFranchise: 'Mobile Mysticks',
        relocations: [
          { year: 2003, from: 'Mobile, AL (suspended 2002–2003)', to: 'Duluth, GA', renamedTo: 'Gwinnett Gladiators', note: 'Revived after the Mysticks suspended operations following the 2001-02 season' },
          { year: 2015, from: 'Duluth, GA', to: 'Duluth, GA', renamedTo: 'Atlanta Gladiators', note: 'Rebranded to better reflect the Atlanta metro area — no change in city or arena' },
        ],
      },
      arena: {
        name: 'Gas South Arena',
        city: 'Duluth, GA',
        capacity: 11355,
        opened: 2003,
        formerNames: [
          { name: 'Gwinnett Civic Center Arena', years: '2003–2004' },
          { name: 'The Arena at Gwinnett Center', years: '2004–2015' },
          { name: 'Infinite Energy Arena', years: '2015–2021' },
        ],
      },
      championships: [],
      retiredNumbers: [
        { number: 44, player: 'Cam Brown' },
        { number: 41, player: 'Andy Brandt' },
        { number: 17, player: 'Derek Nesbitt' },
      ],
      notableAlumni: ['Louis Domingue', 'Daniel Vladar', 'Ryan Garbutt', 'Patrick Dwyer'],
      records: [
        { label: 'Most wins, single season', value: 50, season: '2005-06' },
        { label: 'Most points, single season', value: 107, season: '2005-06' },
      ],
      affiliates: { ahl: 'MIL', nhl: 'NSH' },
      facts: [
        "The franchise's only Kelly Cup Finals appearance came in 2006, when the Gwinnett Gladiators fell 4-games-to-1 to the Alaska Aces.",
        'The team has played in the same Duluth, GA arena since 2003 despite three arena-name changes and one team rebrand (Gwinnett Gladiators to Atlanta Gladiators, 2015).',
        'Former NHL forward Anson Carter holds a minority ownership stake alongside majority owner Alex Campbell.',
      ],
      currentInfo: {
        owner: 'Alex Campbell (majority); Anson Carter (minority)',
        headCoach: 'Matt Ginn',
        lastVerified: '2026-09-01',
      },
    },

    FLA: {
      founded: {
        year: 1998,
      },
      arena: {
        name: 'Hertz Arena',
        city: 'Estero, FL',
        capacity: 7084,
        opened: 1998,
        formerNames: [
          { name: 'TECO Arena', years: '1998–2004' },
          { name: 'Germain Arena', years: '2004–2018' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Germain_Arena,_3-18-09.jpg',
          attribution: 'Tthaas, CC BY-SA 3.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Kelly Cup', years: [2012, 2022, 2023, 2024, 2026] },
      ],
      retiredNumbers: [
        { number: 10, player: 'Reggie Berg' },
        { number: 14, player: 'Tom Buckley' },
        { number: 9, player: 'Ernie Hartlieb' },
        { number: 25, player: 'John McCarron' },
      ],
      notableAlumni: ['Anton Khudobin', 'Tanner Jeannot', 'Alex Nedeljkovic', 'John McCarron', 'Cam Johnson'],
      records: [
        { label: 'Most points, single season (team)', value: 108, season: '2025-26' },
        { label: 'Most career points', value: 364, season: 'career', note: 'John McCarron (152G, 212A)' },
      ],
      affiliates: { ahl: 'WBS', nhl: 'PIT' },
      facts: [
        "The Everblades are the only franchise in ECHL history to win five Kelly Cups, including the league's first three-peat (2022, 2023, 2024).",
        'Owner David Hoffmann and the Hoffmann Family of Companies bought both the Everblades and Hertz Arena in 2019, then bought the Pittsburgh Penguins in 2025 — Florida became the Penguins/Wilkes-Barre-Scranton ECHL affiliate for 2026-27, succeeding a prior affiliation with the St. Louis Blues.',
        'Goaltender Cam Johnson won the Kelly Cup Playoffs MVP award three times (2022, 2023, 2026).',
      ],
      currentInfo: {
        owner: 'David Hoffmann (Hoffmann Family of Companies)',
        headCoach: 'Brad Ralph',
        lastVerified: '2026-09-01',
      },
    },

    GVL: {
      founded: {
        year: 1988,
        asFranchise: 'Johnstown Chiefs',
        relocations: [
          { year: 2010, from: 'Johnstown, PA', to: 'Greenville, SC', renamedTo: 'Greenville Road Warriors' },
          { year: 2015, from: 'Greenville, SC', to: 'Greenville, SC', renamedTo: 'Greenville Swamp Rabbits', note: 'Rebrand only, following a 2012 ownership sale to a local group led by Fred Festa' },
        ],
      },
      arena: {
        name: 'Bon Secours Wellness Arena',
        city: 'Greenville, SC',
        capacity: 13951,
        opened: 1998,
        formerNames: [
          { name: 'BI-LO Center', years: '1998–2013' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Bon_Secours_Wellness_Arena%2C_Greenville%2C_SC_%2827808983101%29.jpg',
          attribution: 'Nicolas Henderson, CC BY 2.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [
        { number: 11, player: 'Bretton Cameron' },
      ],
      notableAlumni: ['David Broll', 'Mackenzie Skapski', 'Isaiah Saville', 'Vinny Saponari'],
      records: [
        { label: 'Most wins, single season', value: 46, season: '2010-11', note: 'Road Warriors inaugural Greenville season' },
      ],
      affiliates: { ahl: 'ONT', nhl: 'LAK' },
      facts: [
        "This franchise traces back to the Johnstown Chiefs, one of the ECHL's eight founding members in 1988 — it relocated to Greenville in 2010 and rebranded from Road Warriors to Swamp Rabbits in 2015.",
        'Despite the long lineage, the franchise has never reached a Kelly Cup Final; its deepest run was the 2013-14 Eastern Conference Finals as the Road Warriors.',
        "Four numbers were retired for Johnstown Jets players (a separate, pre-ECHL Johnstown franchise) before the Chiefs even existed — they were never Chiefs/Road Warriors/Swamp Rabbits honors and did not travel with the franchise to Greenville.",
      ],
      currentInfo: {
        owner: 'Spire Sports + Entertainment (Spire Hockey South)',
        headCoach: 'Chad Costello',
        lastVerified: '2026-09-01',
      },
    },

    JAX: {
      founded: {
        year: 1992,
        asFranchise: 'Muskegon Fury (UHL)',
        joinedLeague: 2012,
        relocations: [
          { year: 2008, from: 'Muskegon, MI', to: 'Muskegon, MI', renamedTo: 'Muskegon Lumberjacks', note: 'Renamed when the UHL rebranded as the IHL; same city' },
          { year: 2010, from: 'Muskegon, MI', to: 'Evansville, IN', renamedTo: 'Evansville IceMen', note: 'Moved when the IHL merged into the Central Hockey League; joined the ECHL in 2012' },
          { year: 2017, from: 'Evansville, IN (dormant 2016–2017)', to: 'Jacksonville, FL', renamedTo: 'Jacksonville Icemen', note: 'Revived after going dormant following the 2015-16 season' },
        ],
      },
      arena: {
        name: 'VyStar Veterans Memorial Arena',
        city: 'Jacksonville, FL',
        capacity: 13141,
        opened: 2003,
        formerNames: [
          { name: 'Jacksonville Veterans Memorial Arena', years: '2003–2019' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Vystar_Veterans_2023.jpg',
          attribution: 'Excel23, CC BY 4.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: ['Jack Ahcan', 'Jansen Harkins', "Jerry D'Amigo", 'Mikhail Berdin', 'Kris Newbury'],
      records: [
        { label: 'Most wins, single season', value: 42, season: '2023-24' },
      ],
      affiliates: { ahl: 'IA', nhl: 'MIN' },
      facts: [
        'Jacksonville had been without professional hockey for a decade before the Icemen arrived in 2017, following the earlier Jacksonville Barracudas (2002-2008), a separate, unrelated lower-league franchise.',
        'The Icemen switched NHL/AHL affiliations from the Buffalo Sabres/Rochester Americans to the Minnesota Wild/Iowa Wild starting with the 2026-27 season.',
        'Ownership includes several NFL-connected investors added in 2020: Tim Tebow, Myles Jack, and Reggie Hayward.',
      ],
      currentInfo: {
        owner: 'SZH Hockey LLC (Andrew Kaufmann, majority)',
        headCoach: 'Sean Teakle',
        lastVerified: '2026-09-01',
      },
    },

    ORL: {
      founded: {
        year: 2012,
      },
      arena: {
        name: 'Kia Center',
        city: 'Orlando, FL',
        capacity: 17353,
        opened: 2010,
        formerNames: [
          { name: 'Amway Center', years: '2010–2023' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Kia_Center_12-22-24.jpg',
          attribution: 'Csab6482, CC0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: ['Darcy Kuemper', 'Mason Marchment', 'Ryan Reaves'],
      records: [
        { label: 'Most wins, single season', value: 43, season: '2013-14' },
        { label: 'Most points, single season', value: 91, season: '2013-14' },
        { label: 'Most points by a player, single season', value: 74, season: '2020-21', note: 'Aaron Luchuk (also 46 assists, a franchise record)' },
      ],
      affiliates: { ahl: 'SYR', nhl: 'TBL' },
      facts: [
        'The current ECHL franchise is an unrelated expansion team that revived the name of an earlier Orlando Solar Bears IHL franchise (1995-2001, which won the 1996 Turner Cup) — it is not a continuation of that team.',
        'The Solar Bears have reached the South Division Finals five times (2015, 2017, 2018, 2019, 2024) without winning a Kelly Cup, most recently losing to a Florida Everblades team in the middle of its three-peat.',
        "Owner RDV Sports (the DeVos family) also owns the NBA's Orlando Magic, who share Kia Center with the Solar Bears.",
      ],
      currentInfo: {
        owner: 'RDV Sports, Inc. (DeVos family)',
        headCoach: 'Matt Macdonald',
        lastVerified: '2026-09-01',
      },
    },

    SAV: {
      founded: {
        year: 2021,
      },
      arena: {
        name: 'Enmarket Arena',
        city: 'Savannah, GA',
        capacity: 7485,
        opened: 2022,
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: ['Matt Boudens (inaugural team captain)', "Tyler Drevich (franchise's first leading scorer)"],
      records: [],
      affiliates: { ahl: 'CLT', nhl: 'FLA' },
      facts: [
        'The ECHL approved Savannah\'s expansion franchise in January 2021; the Ghost Pirates played their first game in November 2022 at the newly opened Enmarket Arena.',
        'The team made its first-ever Kelly Cup Playoff appearance in 2025-26 (its 4th season), losing 0-4 to the Florida Everblades in the first round.',
        'Savannah briefly affiliated with the Vegas Golden Knights/Henderson Silver Knights for its inaugural 2022-23 season before switching to the Florida Panthers/Charlotte Checkers chain in June 2024.',
      ],
      currentInfo: {
        owner: 'Andy Kaufmann (Zawyer Sports & Entertainment)',
        headCoach: 'Jared Staal',
        lastVerified: '2026-09-01',
      },
    },

    SC: {
      founded: {
        year: 1993,
      },
      arena: {
        name: 'North Charleston Coliseum',
        city: 'North Charleston, SC',
        capacity: 10537,
        opened: 1993,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/North_Charleston_Coliseum_Aug2010.jpg',
          attribution: 'Chris Pruitt, CC BY-SA 3.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Kelly Cup', years: [1997, 2001, 2009] },
      ],
      retiredNumbers: [
        { number: 12, player: 'Mark Bavis' },
        { number: 14, player: 'David Seitz' },
        { number: 24, player: 'Brett Marietti' },
        { number: 28, player: 'Andrew Cherniwchan' },
      ],
      notableAlumni: ['Braden Holtby', 'Philipp Grubauer', 'Logan Thompson', 'James Reimer', 'Nathan Walker'],
      records: [
        { label: 'Most wins, single season', value: 52, season: '2024-25' },
        { label: 'Most points, single season', value: 109, season: '2024-25' },
        { label: 'Most career points', value: 587, season: 'career', note: 'David Seitz — also franchise leader in career goals (217) and assists (370)' },
      ],
      affiliates: { ahl: 'HER', nhl: 'WSH' },
      facts: [
        'The Stingrays are tied for the most Kelly Cup titles in ECHL history (3, with Hampton Roads and Alaska), winning in 1997, 2001, and 2009 — the franchise has never left its original arena since 1993.',
        "Mark Bavis's #12 was retired in 2001 in memory of the former Stingrays player and NHL scout, who was killed aboard United Flight 175 on September 11, 2001.",
        'Three former Stingrays head coaches — Jared Bednar, Spencer Carbery, and Ryan Warsofsky — went on to become NHL head coaches.',
      ],
      currentInfo: {
        owner: 'Todd Halloran (Halloran Sports Group)',
        headCoach: 'Jesse Kallechy',
        lastVerified: '2026-09-01',
      },
    },

    // ═══ MOUNTAIN (8 teams) ══════════════════════════════════════════════════
    // VERIFIED: all 8 affiliates blocks matched the pre-verified chain exactly,
    // AND the agent independently reconfirmed each is still current via live
    // search rather than just trusting the handed-down list.
    // FIXED: '&amp;' -> '&' throughout (ALN, TAH, WIC owners).
    // GOOD DISCIPLINE: TUL deliberately excludes pre-1992 "Tulsa Oilers"
    // alumni/records (Vanbiesbrouck, Miracle-on-Ice players) since those belong
    // to an unrelated, defunct 1964-1984 franchise -- exactly the lineage-
    // conflation trap flagged in the brief, correctly avoided. NM (brand-new
    // 2026-27 expansion) and TAH (empty records, conflicting press claims) are
    // both deliberately thin/incomplete rather than padded -- correct call.

    ALN: {
      founded: {
        year: 2009,
        joinedLeague: 2014,
      },
      arena: {
        name: 'Credit Union of Texas Event Center',
        city: 'Allen, TX',
        capacity: 6275,
        opened: 2009,
        formerNames: [
          { name: 'Allen Event Center', years: '2009–2021' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Allen_Event_Center_-_23_February_2013.jpg',
          attribution: 'Dravecky, CC BY-SA 3.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Kelly Cup', years: [2015, 2016] },
      ],
      retiredNumbers: [
        { number: 12, player: 'Gary Steffes' },
        { number: 30, player: 'Riley Gill' },
        { number: 13, player: 'Chad Costello' },
      ],
      notableAlumni: [
        'Alec Martinez', 'Jordie Benn', 'Aaron Dell', 'Chad Costello', 'Riley Gill',
      ],
      records: [
        { label: 'Most wins, single season', value: 47, season: '2010-11' },
        { label: 'Most points, single season', value: 97, season: '2010-11' },
      ],
      affiliates: { ahl: 'BEL', nhl: 'OTT' },
      facts: [
        "Allen won back-to-back CHL President's Cups (2013, 2014) immediately followed by back-to-back Kelly Cups in their first two ECHL seasons (2015, 2016) — four championships in the franchise's first seven years.",
        'Owner Myles Jack and his wife LaSonjia became the first African-American majority owners in ECHL history when they purchased the team in October 2023.',
        'Head coach Steve Martinson, who won all four of the franchise\'s championships behind the bench (2013-2016), returned to Allen in May 2025 after stepping away following the 2021-22 season.',
      ],
      currentInfo: {
        owner: 'Myles Jack & LaSonjia Jack',
        headCoach: 'Steve Martinson',
        lastVerified: '2026-09-01',
      },
    },

    IDH: {
      founded: {
        year: 1997,
        joinedLeague: 2003,
      },
      arena: {
        name: 'Idaho Central Arena',
        city: 'Boise, ID',
        capacity: 5002,
        opened: 1997,
        formerNames: [
          { name: 'Bank of America Centre', years: '1997–2005' },
          { name: 'Qwest Arena', years: '2005–2011' },
          { name: 'CenturyLink Arena', years: '2011–2020' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/CenturyLink_Arena_Boise_from_the_northeast_side_in_2019.jpg',
          attribution: 'Kyvuh, CC0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Kelly Cup', years: [2004, 2007] },
      ],
      retiredNumbers: [
        { number: 4, player: 'Jeremy Mylymok' },
        { number: 12, player: 'Scott Burt' },
        { number: 16, player: 'Marty Flichel' },
        { number: 22, player: 'Cal Ingraham' },
        { number: 71, player: 'Lance Galbraith' },
      ],
      notableAlumni: [
        'Zenon Konopka', 'Dan Ellis', 'Jay Beagle', 'Jeremy Yablonski', 'Marty Flichel',
      ],
      records: [
        { label: 'Most wins, single season', value: 58, season: '2022-23' },
        { label: 'Most points, single season', value: 119, season: '2022-23' },
      ],
      affiliates: { ahl: 'TEX', nhl: 'DAL' },
      facts: [
        'Idaho won the Kelly Cup in its very first ECHL season (2003-04), immediately after moving over from the WCHL.',
        'The Steelheads own the longest active playoff streak in pro hockey — appearing in the postseason every year since 1997 across the WCHL and ECHL.',
        'The team has played in the same downtown Boise arena since day one in 1997, even as it was renamed four times (Bank of America Centre, Qwest Arena, CenturyLink Arena, now Idaho Central Arena).',
      ],
      currentInfo: {
        owner: 'Idaho Sports Properties LLC (Eric Trapp, President)',
        headCoach: 'Everett Sheen',
        lastVerified: '2026-09-01',
      },
    },

    KC: {
      founded: {
        year: 2009,
        asFranchise: 'Missouri Mavericks',
        joinedLeague: 2014,
        relocations: [
          { year: 2017, from: 'Independence, MO (as Missouri Mavericks)', to: 'Independence, MO', renamedTo: 'Kansas City Mavericks', note: 'Rebrand to reflect the larger Kansas City metro area — no change of arena or city' },
        ],
      },
      arena: {
        name: 'Cable Dahmer Arena',
        city: 'Independence, MO',
        capacity: 5800,
        opened: 2009,
        formerNames: [
          { name: 'Independence Events Center', years: '2009–2015' },
          { name: 'Silverstein Eye Centers Arena', years: '2015–2020' },
        ],
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: [
        'Carter Verhaeghe', 'Ville Husso', 'Kyle Burroughs', 'Ross Johnston',
      ],
      records: [
        { label: 'Most wins, single season', value: 54, season: '2023-24' },
        { label: 'Most points, single season', value: 112, season: '2023-24' },
      ],
      affiliates: { ahl: 'CV', nhl: 'SEA' },
      facts: [
        'Despite four regular-season (Brabham Cup) titles since 2014, including three straight from 2023-24 through 2025-26, the Mavericks have never won a Kelly Cup — losing their only two Finals appearances to date (2024 and 2026, both to Florida).',
        'Owner Lamar Hunt Jr. is the son of NFL Hall of Famer Lamar Hunt, founder of the Kansas City Chiefs and the AFL.',
        'The franchise began as the Missouri Mavericks in the CHL in 2009 and was renamed the Kansas City Mavericks in 2017, without ever changing arenas.',
      ],
      currentInfo: {
        owner: 'Lamar Hunt Jr.',
        headCoach: "Tad O'Had",
        lastVerified: '2026-09-01',
      },
    },

    NM: {
      founded: {
        year: 2026,
      },
      arena: {
        name: 'Rio Rancho Events Center',
        city: 'Rio Rancho, NM',
        capacity: 7000,
        opened: 2006,
        formerNames: [
          { name: 'Santa Ana Star Center', years: '2006–2020' },
        ],
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: [],
      records: [],
      affiliates: { ahl: 'COL', nhl: 'COL' },
      facts: [
        'The Goatheads are a brand-new 2026-27 expansion franchise — entirely unrelated to the New Mexico Scorpions (CHL, folded 2009) or to the Utah Grizzlies, who separately relocated to Trenton, NJ (as the Trenton Ironhawks) the same offseason.',
        'The name "Goatheads" beat out finalists "Cutthroats" and "Tarantula Hawks" in a fan vote, honoring a notoriously tough desert thorn-plant native to New Mexico.',
        'First head coach Zack Stortini is a former NHL enforcer who played all of his NHL games with the Edmonton Oilers before moving into coaching, most recently as a Tucson Roadrunners (AHL) assistant.',
      ],
      currentInfo: {
        owner: 'REV Entertainment',
        headCoach: 'Zack Stortini',
        lastVerified: '2026-09-01',
      },
    },

    RC: {
      founded: {
        year: 2008,
        joinedLeague: 2014,
      },
      arena: {
        name: 'The Monument (Ice Arena)',
        city: 'Rapid City, SD',
        capacity: 7500,
        opened: 1977,
        formerNames: [
          { name: 'Rushmore Plaza Civic Center', years: '1977–2021' },
        ],
      },
      championships: [],
      retiredNumbers: [
        { number: 17, player: 'Scott Wray' },
        { number: 30, player: 'Danny Battochio' },
        { number: 6, player: 'Riley Weselowski' },
      ],
      notableAlumni: [
        'Adin Hill', 'Michael Bunting', 'Dakota Mermis', 'Scott Wray', 'Riley Weselowski',
      ],
      records: [
        { label: 'Most wins, single season', value: 43, season: '2009-10' },
        { label: 'Most points, single season', value: 93, season: '2009-10' },
      ],
      affiliates: { ahl: 'CGY', nhl: 'CGY' },
      facts: [
        "The Rush won the CHL's Ray Miron President's Cup in just their second season (2009-10) but have not won a Kelly Cup since joining the ECHL in 2014.",
        'Adin Hill, who backstopped the Vegas Golden Knights to the 2023 Stanley Cup, is a Rush alum.',
        'The organization survived a 2019 embezzlement scandal in which a former finance manager was convicted of stealing roughly $700,000 from the team between 2010 and 2018.',
      ],
      currentInfo: {
        owner: 'Spire Sports + Entertainment',
        headCoach: 'Dave Smith',
        lastVerified: '2026-09-01',
      },
    },

    TAH: {
      founded: {
        year: 2024,
      },
      arena: {
        name: 'Tahoe Blue Event Center',
        city: 'Stateline, NV',
        capacity: 4203,
        opened: 2023,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Tahoe_Blue_Event_Center.jpg',
          attribution: 'LittleT889, CC BY 4.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: [
        'Luke Adam', 'Casey Bailey',
      ],
      records: [],
      affiliates: { ahl: 'HSK', nhl: 'VGK' },
      facts: [
        'The team is named for Tahoe Tessie, the folkloric lake monster said to live in Lake Tahoe.',
        "The ownership group includes NFL Heisman winner Tim Tebow and HGTV's Chip and Joanna Gaines as minority partners, alongside majority owner David Hodges.",
        'In each of its first two seasons (2025 and 2026), Tahoe reached the Mountain Division Finals — losing to the Kansas City Mavericks both times.',
      ],
      currentInfo: {
        owner: 'David Hodges (majority); Tim & Demi Tebow, Chip & Joanna Gaines (minority)',
        headCoach: 'Connor Jones',
        lastVerified: '2026-09-01',
      },
    },

    TUL: {
      founded: {
        year: 1992,
        joinedLeague: 2014,
      },
      arena: {
        name: 'BOK Center',
        city: 'Tulsa, OK',
        capacity: 17096,
        opened: 2008,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/BOK_Center_faccade.JPG',
          attribution: 'Okiefromokla, public domain, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: [
        'Dakota Joshua', 'Austin Poganski', 'Olle Eriksson Ek', 'Bryce Kindopp', 'Hunter Drew',
      ],
      records: [
        { label: 'Most wins, single season', value: 40, season: '2018-19' },
      ],
      affiliates: { ahl: 'SD', nhl: 'ANA' },
      facts: [
        'This is the third hockey team called the "Tulsa Oilers" — an original 1928 American Hockey Association club and a separate 1964-1984 CPHL/CHL club both preceded today\'s franchise, which was founded fresh in 1992 and is not a continuation of either earlier team.',
        "The 1992-93 Oilers won the league championship in the newly revived CHL's very first season, the only current CHL-lineage franchise to do so.",
        'The Oilers moved from the Tulsa Convention Center into the newly built BOK Center in 2008, and are one of only two ECHL clubs (with Wichita) to have played every one of the original CHL\'s 22 seasons (1992-2014) before that league folded.',
      ],
      currentInfo: {
        owner: 'Andy Scurto (NL Sports, LLC)',
        headCoach: 'Rob Murray',
        lastVerified: '2026-09-01',
      },
    },

    WIC: {
      founded: {
        year: 1992,
        joinedLeague: 2014,
      },
      arena: {
        name: 'INTRUST Bank Arena',
        city: 'Wichita, KS',
        capacity: 13450,
        opened: 2010,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/InTrust_Bank_Arena.jpg',
          attribution: 'FUBAR007, CC BY-SA 3.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [
        { number: 9, player: 'Ron Handy' },
        { number: 11, player: 'Jason Duda' },
        { number: 15, player: 'Rob Weingartner' },
        { number: 35, player: 'Robert Desjardins' },
        { number: 38, player: 'Travis Clayton' },
      ],
      notableAlumni: [
        'Stuart Skinner', 'Vincent Desharnais', 'Theo Peckham', 'Ryan White', 'Pierre-Cedric Labrie',
      ],
      records: [
        { label: 'Most wins, single season', value: 44, season: '2011-12' },
        { label: 'Most points, single season', value: 92, season: '1994-95' },
      ],
      affiliates: { ahl: 'SJ', nhl: 'SJS' },
      facts: [
        'New head coach Travis Clayton (hired May 2026) is himself one of the five Thunder legends with a retired number (#38), having racked up 835 points over parts of a decade playing for Wichita.',
        'Wichita and Tulsa are the only two teams to have played all 22 seasons of the original Central Hockey League (1992-2014) before both moved to the ECHL.',
        'Despite two CHL championships in the 1990s (1993-94, 1994-95), the Thunder have not won a Kelly Cup since moving to the ECHL in 2014. Current Edmonton Oilers starting goaltender Stuart Skinner is a Thunder alum.',
      ],
      currentInfo: {
        owner: 'Steven Brothers Sports Management (Rodney, Brandon & Johnny Steven)',
        headCoach: 'Travis Clayton',
        lastVerified: '2026-09-01',
      },
    },

    // ═══ CENTRAL (7 teams) ═══════════════════════════════════════════════════
    // VERIFIED: all 7 affiliates blocks matched the pre-verified chain,
    // including both flagged mid-2026 switches (BLM to Winnipeg/Manitoba, WHL
    // to Columbus/Cleveland) and the real CIN 'TOR'/'TOR' cross-league overlap.
    // FIXED: '&amp;' -> '&' (BLM facts/owner, KAL owner).
    // FIXED: FW's and TOL's records had full sentences jammed into the
    // `season` field instead of a real season string (not a rendering bug like
    // the earlier `null`/`undefined` cases, just reads oddly as "(Len Thornson
    // 1966-67, tied by...)") -- moved the extra detail into `note` and gave
    // `season` a clean value instead.
    // GOOD DISCIPLINE: FW/CIN/KAL/WHL all involved a "current corporate entity
    // isn't literally the same franchise as the original name-bearer" pattern
    // -- each handled with the same no-blank-relocations-field rule and pushed
    // the nuance into facts, consistent with the AHL/UTC precedent.

    BLM: {
      founded: {
        year: 2024,
      },
      arena: {
        name: 'Grossinger Motors Arena',
        city: 'Bloomington, IL',
        capacity: 6000,
        opened: 2006,
        formerNames: [
          { name: 'U.S. Cellular Coliseum', years: '2006–2016' },
          { name: 'The Coliseum', years: '2016–2017' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/US_Cellular_Coliseum.jpg',
          attribution: 'Wahkeenah, Public Domain, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: [
        'Blake McLaughlin', 'Hugo Ollas', 'Brett Budgell', 'Carter Berger',
      ],
      records: [
        { label: 'Most points, single season', value: 79, season: '2025-26' },
      ],
      affiliates: { ahl: 'MB', nhl: 'WPG' },
      facts: [
        'The Bison are an ECHL expansion franchise that began play in 2024-25 and made their first-ever Kelly Cup Playoff appearance in just their second season (2025-26), going 37-30-5 for a franchise-best 79 points.',
        'Ownership group Hallett Sports & Entertainment (Jim Hallett) also owns fellow ECHL Central Division club the Indy Fuel — common ownership between two teams in the same division.',
        "The Bison spent their first two seasons (2024-26) as the ECHL affiliate of the New York Rangers and AHL's Hartford Wolf Pack before switching to the Winnipeg Jets and Manitoba Moose in July 2026.",
      ],
      currentInfo: {
        owner: 'Jim Hallett (Hallett Sports & Entertainment)',
        headCoach: 'Phillip Barski',
        lastVerified: '2026-09-01',
      },
    },

    CIN: {
      founded: {
        year: 1995,
        asFranchise: 'Louisville RiverFrogs (ECHL)',
        relocations: [
          { year: 1998, from: 'Louisville, KY', to: 'Miami, FL', renamedTo: 'Miami Matadors', note: 'Sold and moved after three seasons in Louisville' },
          { year: 2001, from: 'Miami, FL (dormant 1999–2001)', to: 'Cincinnati, OH', renamedTo: 'Cincinnati Cyclones', note: "The Matadors folded after one season and the franchise sat dormant for two years before revival in Cincinnati. This revival reused the 'Cyclones' name of two earlier, unrelated Cincinnati franchises (a 1990-92 ECHL club and a 1992-2001 IHL club) — this franchise's own lineage runs through Louisville/Miami, not either of those." },
        ],
      },
      arena: {
        name: 'Heritage Bank Center',
        city: 'Cincinnati, OH',
        capacity: 14453,
        opened: 1975,
        formerNames: [
          { name: 'Riverfront Coliseum', years: '1975–1997' },
          { name: 'The Crown', years: '1997–1999' },
          { name: 'Firstar Center', years: '1999–2002' },
          { name: 'U.S. Bank Arena', years: '2002–2019' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Heritage_Bank_Center_%28cropped%29.jpg',
          attribution: 'Ianbolender, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Kelly Cup', years: [2008, 2010] },
      ],
      retiredNumbers: [
        { number: 13, player: 'Paul Lawless' },
        { number: 21, player: 'Gilbert Dionne' },
        { number: 22, player: 'Don Biggs' },
      ],
      notableAlumni: [
        'David Desharnais', 'Cédrick Desjardins', 'Cory Conacher', 'Byron Froese', 'Gilbert Dionne',
      ],
      records: [
        { label: 'Most wins, single season', value: 55, season: '2007-08' },
        { label: 'Most points, single season', value: 115, season: '2007-08' },
      ],
      affiliates: { ahl: 'TOR', nhl: 'TOR' },
      facts: [
        "'Cincinnati Cyclones' has been the name of three separate franchises across two leagues; the CURRENT ECHL club actually began in 1995 as the Louisville RiverFrogs and only became the Cyclones after a stint as the Miami Matadors (1998-99) and a two-year dormancy, relocating to Cincinnati in 2001.",
        "The 2007-08 Cyclones posted a 55-win, 115-point season widely cited as the best regular season in ECHL history, en route to the franchise's first Kelly Cup that spring.",
        "In March 2026, the Cyclones switched from the New York Rangers to the Toronto Maple Leafs and AHL's Toronto Marlies — a same-abbreviation ('TOR'/'TOR') affiliate pair across two different leagues in this app's own team-code data, not a data bug.",
      ],
      currentInfo: {
        owner: 'Nederlander Entertainment',
        headCoach: 'Riley Weselowski',
        lastVerified: '2026-09-01',
      },
    },

    FW: {
      founded: {
        year: 1952,
        asFranchise: 'Fort Wayne Komets (IHL)',
        joinedLeague: 2012,
        relocations: [
          { year: 1990, from: 'Flint, MI (Flint Spirits, IHL, est. 1985)', to: 'Fort Wayne, IN', renamedTo: 'Fort Wayne Komets', note: "The original 1952 Komets left Fort Wayne for Albany, NY and folded in Feb 1991; two days after that departure, Fort Wayne's Franke family bought the Flint Spirits and relocated/renamed them the Komets, continuing the city's team identity. The organization's own official history counts continuously from 1952 despite this legal-franchise change." },
        ],
      },
      arena: {
        name: 'Allen County War Memorial Coliseum',
        city: 'Fort Wayne, IN',
        capacity: 10480,
        opened: 1952,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Allen_County_War_Memorial_Coliseum.JPG',
          attribution: 'FTSKfan, Public Domain, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Kelly Cup', years: [2021] },
      ],
      retiredNumbers: [
        { number: 1, player: 'Chuck Adamson' },
        { number: 2, player: 'Guy Dupuis' },
        { number: 5, player: 'Terry Pembroke' },
        { number: 6, player: 'Lionel Repka' },
        { number: 11, player: 'Len Thornson' },
        { number: 12, player: 'Reg Primeau' },
        { number: 16, player: 'Eddie Long' },
        { number: 18, player: 'Rob Laird' },
        { number: 19, player: 'Terry McDougall' },
        { number: 26, player: 'Colin Chin' },
        { number: 30, player: 'Robbie Irons' },
        { number: 33, player: 'Nick Boucher' },
        { number: 40, player: 'Bob Chase (broadcaster)' },
        { number: 58, player: 'Ken Ullyot (owner)' },
        { number: 59, player: 'Colin Lister (owner)' },
        { number: 77, player: 'Steven Fletcher' },
        { number: 91, player: 'Colin Chaulk' },
      ],
      notableAlumni: [
        'Bruce Boudreau', 'Len Thornson', 'Colin Chaulk', 'Guy Dupuis', 'Vyacheslav Butsayev',
      ],
      records: [
        { label: 'Most points, single season (player)', value: 139, season: 'record', note: 'Len Thornson, 1966-67; tied by Terry McDougall, 1978-79' },
        { label: 'Consecutive home wins', value: 23, season: '2007-08', note: 'Streak ended March 28, 2008' },
      ],
      affiliates: { ahl: 'BAK', nhl: 'EDM' },
      facts: [
        "The Komets are one of the oldest continuously-branded minor-league hockey franchises in North America, tracing the name to 1952 — though the current corporate entity actually dates to a 1990 purchase-and-rename of the Flint Spirits (see the founding timeline); the club's own records and rafters banners still treat 1952 as the true start.",
        'Before joining the ECHL in 2012, the Komets played in the IHL (1952-1999, then a revived IHL brand 2007-2010), the UHL (1999-2007), and the CHL (2010-2012) — winning 7 Turner Cups as IHL champions (1963, 1965, 1973, 1993, and three straight 2008-2010), none of which count as Kelly Cups.',
        'Bruce Boudreau, later an NHL head coach for five different franchises, finished his playing career with the Komets (1990-92) as a player-assistant coach; three decades later his son Ben Boudreau coached the Komets to their only Kelly Cup, in 2021, and returned for a second stint in 2026.',
      ],
      currentInfo: {
        owner: 'The Franke Family (Steve Franke, CEO)',
        headCoach: 'Ben Boudreau',
        lastVerified: '2026-09-01',
      },
    },

    IND: {
      founded: {
        year: 2014,
      },
      arena: {
        name: 'Fishers Event Center',
        city: 'Fishers, IN',
        capacity: 7500,
        opened: 2024,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/250219_-_Fishers_Event_Center.jpg',
          attribution: 'MitchDoner, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: [
        'Collin Delia', 'Justin Holl', 'Kevin Lankinen', 'Matt Tomkins',
      ],
      records: [
        { label: 'Most wins, single season', value: 43, season: '2022-23' },
        { label: 'Most points, single season', value: 91, season: '2022-23' },
      ],
      affiliates: { ahl: 'RFD', nhl: 'CHI' },
      facts: [
        'The Fuel were awarded to Indianapolis as an ECHL expansion franchise in November 2013 and began play in 2014-15, affiliated with the Chicago Blackhawks and AHL Rockford IceHogs from day one.',
        'After a decade at the Indiana Farmers Coliseum on the state fairgrounds, the Fuel moved into the new $170 million, 7,500-seat Fishers Event Center in the Indianapolis suburb of Fishers in late 2024.',
        'In April 2026, the Fuel met the Fort Wayne Komets in the Kelly Cup Playoffs for the first time in franchise history — a natural rivalry, since the two Indiana-based Central Division clubs are only about 40 miles apart.',
      ],
      currentInfo: {
        owner: 'Jim Hallett (Chairman) / Sean Hallett (CEO)',
        headCoach: 'Jesse Messier',
        lastVerified: '2026-09-01',
      },
    },

    KAL: {
      founded: {
        year: 1999,
        asFranchise: 'Madison Kodiaks (UHL)',
        joinedLeague: 2009,
        relocations: [
          { year: 2000, from: 'Madison, WI', to: 'Kalamazoo, MI', renamedTo: 'Kalamazoo Wings', note: "Moved after one season in Madison. The original 1974-2000 IHL 'Kalamazoo Wings' had just folded, and its owner gave this incoming UHL club permission to take the vacant 'Wings' name and local identity." },
        ],
      },
      arena: {
        name: 'Wings Event Center',
        city: 'Kalamazoo, MI',
        capacity: 5113,
        opened: 1974,
        formerNames: [
          { name: 'Wings Stadium', years: '1974–2015' },
        ],
      },
      championships: [],
      retiredNumbers: [
        { number: 1, player: 'Georges Gagnon' },
        { number: 11, player: 'Brent Jarrett' },
        { number: 13, player: 'Tyler Willis' },
        { number: 22, player: 'Mike Wanchuk' },
        { number: 26, player: 'Kevin Schamehorn' },
        { number: 27, player: 'Neil Meadmore' },
      ],
      notableAlumni: [
        'Justin Taylor', 'Joel Martin', 'Kevin Schamehorn', 'Neil Meadmore', 'Tyler Willis',
      ],
      records: [
        { label: 'Most road wins, single season', value: 21, season: '2025-26' },
      ],
      affiliates: { ahl: 'ABB', nhl: 'VAN' },
      facts: [
        "The current Kalamazoo Wings organization dates only to a 2000 relocation of the UHL's Madison Kodiaks, but it inherited the 'Wings' name and civic identity of a separate, defunct 1974-2000 IHL franchise (winner of two Turner Cups, 1978-79 and 1979-80) — most of the current club's retired numbers actually honor players from that earlier, unrelated IHL team.",
        "The Wings' only professional championship since 1980 is a UHL Colonial Cup in 2005-06, won a few years before the club joined the ECHL in 2009.",
        "Head coach Joel Martin is a K-Wings franchise icon in his own right: an ECHL Hall of Famer (inducted 2021) who set the organization's career goaltending wins record before retiring as a player in 2018 to join the coaching staff.",
      ],
      currentInfo: {
        owner: 'William D. Johnston & Ronda Stryker (Greenleaf Hospitality Group)',
        headCoach: 'Joel Martin',
        lastVerified: '2026-09-01',
      },
    },

    TOL: {
      founded: {
        year: 1991,
        asFranchise: 'Toledo Storm (ECHL)',
      },
      arena: {
        name: 'Huntington Center',
        city: 'Toledo, OH',
        capacity: 8000,
        opened: 2009,
        formerNames: [
          { name: 'Lucas County Arena', years: '2009–2010' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Huntington_Center_%28Toledo,_Ohio%29,_April_2022.jpg',
          attribution: 'MrJacon000, CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: [
        'Alex Hicks', 'Iain Duncan', 'Nick Vitucci', 'Jeff Lerg', 'Shane Berschbach',
      ],
      records: [
        { label: 'Most points, single season', value: 99, season: '2024-25' },
        { label: 'Single-season home attendance', value: 289348, season: '2024-25', note: "The franchise's first full sellout season" },
      ],
      affiliates: { ahl: 'GR', nhl: 'DET' },
      facts: [
        "The Walleye are the successor to the Toledo Storm (1991-2007), which won two Riley Cups — the ECHL's championship trophy before it was renamed the Kelly Cup in 1997 — in 1992-93 and 1993-94. The Storm suspended operations after 2006-07; new ownership revived the club in Toledo in 2009-10 as the Walleye, which does not count the Storm's Riley Cups as its own Kelly Cups.",
        'Despite being one of the ECHL\'s most successful modern franchises, the Walleye have reached the Kelly Cup Finals three times (2019, 2022, 2025) and lost all three.',
        "The Huntington Center's exterior features a 900-square-foot living 'green wall' of plants designed to shade and cool the glass-enclosed main entrance.",
      ],
      currentInfo: {
        owner: 'Toledo Arena Sports, Inc.',
        headCoach: 'Pat Mikesch',
        lastVerified: '2026-09-01',
      },
    },

    WHL: {
      founded: {
        year: 1981,
        asFranchise: 'Winston-Salem Thunderbirds (ACHL)',
        joinedLeague: 1988,
        relocations: [
          { year: 1982, from: 'Winston-Salem, NC', to: 'Winston-Salem, NC', renamedTo: 'Carolina Thunderbirds', note: 'Same-city rebrand, still in the ACHL' },
          { year: 1989, from: 'Winston-Salem, NC (as Carolina Thunderbirds)', to: 'Winston-Salem, NC', renamedTo: 'Winston-Salem Thunderbirds', note: 'Reverted to the original name; by this point the club was a charter ECHL franchise — the ACHL folded in 1987, the team spent 1987-88 in the short-lived All-American Hockey League, then joined the ECHL for its inaugural 1988-89 season' },
          { year: 1992, from: 'Winston-Salem, NC', to: 'Wheeling, WV', renamedTo: 'Wheeling Thunderbirds', note: 'Real relocation' },
          { year: 1996, from: 'Wheeling, WV (as Wheeling Thunderbirds)', to: 'Wheeling, WV', renamedTo: 'Wheeling Nailers', note: "Same-city rebrand via a fan 'Name the Team' contest; 'Nailers' honors Wheeling's nail-manufacturing history" },
        ],
      },
      arena: {
        name: 'WesBanco Arena',
        city: 'Wheeling, WV',
        capacity: 4890,
        opened: 1977,
        formerNames: [
          { name: 'Wheeling Civic Center', years: '1977–2003' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/WesBancoArena.jpg',
          attribution: 'Jgera5, CC0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: [
        'Tomas Vokoun', 'Paul Bissonnette', 'Daniel Carcillo', 'Scott Darling', 'Peter Laviolette',
      ],
      records: [
        { label: 'Most points, single season', value: 106, season: '2003-04' },
      ],
      affiliates: { ahl: 'CLE', nhl: 'CBJ' },
      facts: [
        "As the Carolina/Winston-Salem Thunderbirds, this franchise won the very first ECHL championship in the league's inaugural 1988-89 season — but the trophy wasn't yet the Kelly Cup; it was the Riley Cup, renamed for commissioner Patrick Kelly only in 1997. The Nailers themselves have never won a Kelly Cup.",
        'The Nailers are considered the oldest continuously-operating minor-league hockey franchise below the AHL level, an unbroken lineage stretching back to 1981 across five names and two cities.',
        'After 29 years affiliated with the Pittsburgh Penguins and AHL Wilkes-Barre/Scranton (2001-2026), the Nailers signed a two-year deal with the Columbus Blue Jackets and AHL Cleveland Monsters in August 2026.',
      ],
      currentInfo: {
        owner: 'Hockey Club of the Ohio Valley',
        headCoach: 'Nate DiCasmirro',
        lastVerified: '2026-09-01',
      },
    },

    // ═══ NORTH (8 teams) — final ECHL batch, all 30 teams now covered ═════════
    // IMPORTANT FINDING: Norfolk genuinely has no NHL/AHL affiliate right now
    // (confirmed live on both the team's own site and echl.com, which list
    // "TBD") -- not a research gap, a real live state. Omitted the `affiliates`
    // key entirely rather than guess; worth a follow-up check closer to the
    // 2026-27 season opener since this is very likely to resolve.
    // FIXED: '&amp;' -> '&' (GSO).
    // FIXED: TRE's career-total record had an odd `season` value ("2005-2025
    // (career)") -- normalized to `season: 'career'` (matching the FLA/SC
    // pattern from the South batch) with the date range moved into `note`.
    // FIXED: added NOR's 1998 Bakersfield Fog -> Bakersfield Condors rename to
    // `relocations` for consistency -- the agent's own facts mentioned it but
    // left it out of the timeline array, unlike every other team's full lineage.
    // GOOD DISCIPLINE: MNE deliberately has no `relocations` entry for the
    // Alaska Aces question given genuine source disagreement over continuation
    // vs. new franchise -- explained in facts instead of guessing a structure.

    ADK: {
      founded: {
        year: 1990,
        asFranchise: 'Cincinnati Cyclones (ECHL expansion)',
        relocations: [
          { year: 1992, from: 'Cincinnati, OH', to: 'Birmingham, AL', renamedTo: 'Birmingham Bulls' },
          { year: 2001, from: 'Birmingham, AL', to: 'Atlantic City, NJ', renamedTo: 'Atlantic City Boardwalk Bullies' },
          { year: 2005, from: 'Atlantic City, NJ', to: 'Stockton, CA', renamedTo: 'Stockton Thunder' },
          { year: 2015, from: 'Stockton, CA', to: 'Glens Falls, NY', renamedTo: 'Adirondack Thunder', note: "Essentially a market swap — Calgary's AHL affiliate left Glens Falls for Stockton (as the Heat) the same year this ECHL franchise moved the opposite direction" },
        ],
      },
      arena: {
        name: 'Harding Mazzotti Arena',
        city: 'Glens Falls, NY',
        capacity: 4794,
        opened: 1979,
        formerNames: [
          { name: 'Glens Falls Civic Center', years: '1979–2017' },
          { name: 'Cool Insuring Arena', years: '2017–2025' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Harding_Mazzotti_Arena_-_Glens_Falls,_NY.jpg',
          attribution: 'Quintin Soloviev, CC BY 4.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: [
        'MacKenzie Blackwood', 'Connor Ingram', 'Ryan Lomberg', 'Josh Jacobs', 'Colton White',
      ],
      records: [
        { label: 'Most points, single season', value: 97, season: '2023-24' },
        { label: 'Longest win streak', value: 12, season: '2023-24' },
      ],
      affiliates: { ahl: 'UTC', nhl: 'NJD' },
      facts: [
        "The franchise's roots trace to the 1990 expansion Cincinnati Cyclones — a different, unrelated franchise from today's ECHL Cincinnati Cyclones — and it was renamed four times across five cities before landing in Glens Falls in 2015.",
        "Long before the Thunder arrived, the same arena hosted the AHL's Adirondack Red Wings (1979-1999), a completely separate franchise that won three Calder Cups (1981, 1986, 1989). The Adirondack Hockey Hall of Fame at the arena honors that earlier, unrelated team — not the current ECHL Thunder, which has no retired numbers of its own.",
      ],
      currentInfo: {
        owner: 'Adirondack Civic Center Coalition (local ownership group, since 2017)',
        headCoach: 'Sylvain Cloutier',
        lastVerified: '2026-09-01',
      },
    },

    GSO: {
      founded: {
        year: 2025,
      },
      arena: {
        name: 'First Horizon Coliseum',
        city: 'Greensboro, NC',
        capacity: 22000,
        opened: 1959,
        formerNames: [
          { name: 'Greensboro Memorial Coliseum', years: '1959–1980' },
          { name: 'Greensboro Coliseum', years: '1980–2024' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Greensboro_Coliseum.jpg',
          attribution: 'Blueboy96, CC BY-SA 3.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: ['David Gagnon', 'Ethan Leyh'],
      records: [
        { label: 'Franchise leading scorer, inaugural season', value: 17, season: '2025-26' },
      ],
      affiliates: { ahl: 'CHI', nhl: 'CAR' },
      facts: [
        "Greensboro's first ECHL team since the Greensboro Generals folded in 2004 — and the Coliseum's first pro hockey tenant since the Hurricanes themselves played their first two NHL seasons there (1997-99) while Raleigh's arena was being built.",
        "Ownership group Zawyer Sports & Entertainment includes former NHL players Paul Bissonnette, Ryan Whitney, and Keith Yandle (hosts of the Spittin' Chiclets podcast) as part-owners, plus NFL long-snapper J.J. Jansen.",
        "First head coach Scott Burt was let go in May 2026 after going 19-46-6 in the inaugural season; Mitch Giguère was hired as the team's second head coach that June.",
      ],
      currentInfo: {
        owner: 'Zawyer Sports & Entertainment',
        headCoach: 'Mitch Giguère',
        lastVerified: '2026-09-01',
      },
    },

    MNE: {
      founded: {
        year: 2018,
      },
      arena: {
        name: 'Cross Insurance Arena',
        city: 'Portland, ME',
        capacity: 6206,
        opened: 1977,
        formerNames: [
          { name: 'Cumberland County Civic Center', years: '1977–2014' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Cross_Insurance_Arena_exterior_view.jpg',
          attribution: 'Quintin Soloviev, CC BY 4.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: [
        'Justin Brazeau', 'Adam Huska', 'Brandon Crawley', 'Austin Violette',
      ],
      records: [
        { label: 'Most wins, single season', value: 42, season: '2022-23' },
      ],
      affiliates: { ahl: 'PRO', nhl: 'BOS' },
      facts: [
        "The ECHL membership was purchased from the dormant Alaska Aces (2003-2017, three-time Kelly Cup champion out of Anchorage) and relaunched in Portland for 2018-19 — though hockeydb.com and most record-keepers treat the Mariners as a new franchise rather than a continuation of the Aces' history.",
        'Shares its name with an earlier, unrelated AHL team also called the "Maine Mariners" (1977-1992) that played in the same building — no corporate connection between the two.',
        'Voluntarily suspended operations for the 2020-21 season due to COVID-19, and won its first-ever playoff series in 2025-26.',
      ],
      currentInfo: {
        owner: 'Dexter Paine (since September 2024)',
        headCoach: 'Rick Kowalsky',
        lastVerified: '2026-09-01',
      },
    },

    NOR: {
      founded: {
        year: 1995,
        asFranchise: 'Bakersfield Fog (WCHL)',
        joinedLeague: 2003,
        relocations: [
          { year: 1998, from: 'Bakersfield, CA (as Bakersfield Fog)', to: 'Bakersfield, CA', renamedTo: 'Bakersfield Condors', note: 'Same-city rebrand, still in the WCHL' },
          { year: 2015, from: 'Bakersfield, CA', to: 'Norfolk, VA', renamedTo: 'Norfolk Admirals', note: "Took the name and logo of the AHL's Norfolk Admirals, which departed the same year for San Diego (as the Gulls) — a completely separate, unrelated franchise with its own history and championships" },
        ],
      },
      arena: {
        name: 'Norfolk Scope',
        city: 'Norfolk, VA',
        capacity: 8701,
        opened: 1971,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Norfolk_Scope.jpg',
          attribution: 'Faithlessthewonderboy, CC BY-SA, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: [
        'Luke Prokop', 'Domenick Fensore', 'Brandon Halverson', 'Matt Carey',
      ],
      records: [
        { label: 'Most points, single season', value: 89, season: '2023-24' },
      ],
      facts: [
        "The 'Norfolk Admirals' name has been used by two entirely separate franchises: an earlier ECHL/AHL team (1989-2015) that won a 1998 Kelly Cup and later became the AHL's San Diego Gulls, and this current ECHL franchise (the relocated Bakersfield Condors), which has no connection to that earlier team's championships, records, or scoring marks.",
        'As of September 2026, the Admirals have no NHL or AHL affiliate for the first time in franchise history — the Winnipeg Jets/Manitoba Moose partnership ended in July 2026 and no replacement had been announced.',
      ],
      currentInfo: {
        owner: 'Patrick Cavanagh (former Hampton Roads Admirals player, owner since 2019)',
        headCoach: 'Jeff Carr',
        lastVerified: '2026-09-01',
      },
    },

    REA: {
      founded: {
        year: 1991,
        asFranchise: 'Columbus Chill (ECHL)',
        relocations: [
          { year: 2001, from: 'Columbus, OH (dormant 1999–2001)', to: 'Reading, PA', renamedTo: 'Reading Royals', note: 'The Chill suspended operations in 1999 to make way for the NHL expansion Columbus Blue Jackets before this relocation revived the franchise' },
        ],
      },
      arena: {
        name: 'Santander Arena',
        city: 'Reading, PA',
        capacity: 7160,
        opened: 2001,
        formerNames: [
          { name: 'Sovereign Center', years: '2001–2013' },
        ],
      },
      championships: [
        { title: 'Kelly Cup', years: [2013] },
      ],
      retiredNumbers: [
        { number: 10, player: 'Yannick Tifu' },
        { number: 22, player: 'Larry Courville' },
      ],
      notableAlumni: [
        'Jonathan Quick', 'James Reimer', 'Philipp Grubauer', 'George Parros', 'Ben Scrivens',
      ],
      records: [
        { label: 'Most points, single season', value: 99, season: '2012-13' },
      ],
      affiliates: { ahl: 'LV', nhl: 'PHI' },
      facts: [
        'Nicknamed "Goaltender U" for the pipeline of future NHL goaltenders who came through Reading, including Jonathan Quick, Philipp Grubauer, James Reimer, Ben Scrivens, and Michael Hutchinson.',
        "Won its only Kelly Cup in 2013, in the franchise's 12th season in Reading, defeating the Stockton Thunder in five games.",
        'Uniquely for the ECHL tier, the team is owned by a public authority — the Berks County Convention Center Authority, which purchased the club from Jack Gulati in 2019.',
      ],
      currentInfo: {
        owner: 'Berks County Convention Center Authority',
        headCoach: 'Anthony Peters',
        lastVerified: '2026-09-01',
      },
    },

    TRE: {
      founded: {
        year: 1981,
        asFranchise: 'Nashville South Stars (CHL)',
        joinedLeague: 1988,
        relocations: [
          { year: 1983, from: 'Nashville, TN', to: 'Vinton, VA', renamedTo: 'Virginia Lancers', note: 'Became a founding member of the ECHL in 1988' },
          { year: 1990, from: 'Vinton, VA', to: 'Roanoke, VA', renamedTo: 'Roanoke Valley Rebels', note: 'Renamed Roanoke Valley Rampage in 1992, same city' },
          { year: 1993, from: 'Roanoke, VA', to: 'Huntsville, AL', renamedTo: 'Huntsville Blast' },
          { year: 1994, from: 'Huntsville, AL', to: 'Tallahassee, FL', renamedTo: 'Tallahassee Tiger Sharks' },
          { year: 2001, from: 'Tallahassee, FL', to: 'Macon, GA', renamedTo: 'Macon Whoopee' },
          { year: 2002, from: 'Macon, GA', to: 'Lexington, KY', renamedTo: "Lexington Men O' War", note: 'Suspended operations after one season (2002-03); the dormant franchise rights were purchased and moved to Utah in 2005' },
          { year: 2005, from: 'Lexington, KY', to: 'West Valley City, UT', renamedTo: 'Utah Grizzlies', note: 'Took the name of the just-departed IHL/AHL Utah Grizzlies (1995-2005), an unrelated corporate franchise, after that team ceased operations' },
          { year: 2026, from: 'West Valley City, UT', to: 'Trenton, NJ', renamedTo: 'Trenton Ironhawks' },
        ],
      },
      arena: {
        name: 'CURE Insurance Arena',
        city: 'Trenton, NJ',
        capacity: 7605,
        opened: 1999,
        formerNames: [
          { name: 'Sovereign Bank Arena', years: '1999–2009' },
          { name: 'Sun National Bank Center', years: '2009–2017' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Cure_Arena_across_NJ129_2021_jeh.jpg',
          attribution: 'Jim.henderson, CC BY 4.0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: [
        'Andrew MacDonald', 'Trevor Smith', 'Ryan Kinasewich',
      ],
      records: [
        { label: 'Most career points', value: 356, season: 'career', note: 'Ryan Kinasewich, 2005-2025 (as the Utah Grizzlies)' },
      ],
      affiliates: { ahl: 'HAM', nhl: 'NYI' },
      facts: [
        "One of the ECHL's deepest lineages: nine names across five states since 1981, most recently 21 seasons as the Utah Grizzlies (2005-2026) before relocating to Trenton for 2026-27.",
        'Trenton previously hosted the ECHL\'s Trenton Titans/Trenton Devils (1999-2013) at the same CURE Insurance Arena — an unrelated earlier tenant, not this franchise\'s own history.',
        "Chuck Weber, a two-time Kelly Cup champion as a coach, was named the Ironhawks' first head coach in June 2026 ahead of the team's October 2026 debut.",
      ],
      currentInfo: {
        owner: 'Pro Hockey Partners, LLC',
        headCoach: 'Chuck Weber',
        lastVerified: '2026-09-01',
      },
    },

    TR: {
      founded: {
        year: 2021,
      },
      arena: {
        name: 'Colisée Vidéotron',
        city: 'Trois-Rivières, QC',
        capacity: 4390,
        opened: 2021,
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Colis%C3%A9e_Vid%C3%A9otron_2024_%281%29.jpg',
          attribution: 'Gabriel Picard (Gacard), CC BY-SA 4.0, via Wikimedia Commons',
        },
      },
      championships: [
        { title: 'Kelly Cup', years: [2025] },
      ],
      retiredNumbers: [],
      notableAlumni: [
        'Artūrs Šilovs', 'Pierrick Dubé', 'Cameron Hillis', 'Morgan Adams-Moisan', 'Luke Cavallin',
      ],
      records: [
        { label: 'Most wins, single season', value: 45, season: '2024-25' },
      ],
      affiliates: { ahl: 'LAV', nhl: 'MTL' },
      facts: [
        'Named for the Trois-Rivières Lions of 1955-1960, the only earlier pro hockey team in the city — but this is an unrelated 2021 ECHL expansion franchise, not a continuation.',
        "Won the Kelly Cup in just its fourth season (2024-25), beating the Toledo Walleye in the final and ending the Florida Everblades' run of three straight championships along the way.",
        'Bought by Spire Sports + Entertainment in April 2024, whose ECHL portfolio also includes the Rapid City Rush and Greenville Swamp Rabbits.',
      ],
      currentInfo: {
        owner: 'Spire Sports + Entertainment (Jeff Dickerson)',
        headCoach: 'Ron Choules',
        lastVerified: '2026-09-01',
      },
    },

    WOR: {
      founded: {
        year: 2017,
      },
      arena: {
        name: 'DCU Center',
        city: 'Worcester, MA',
        capacity: 12135,
        opened: 1982,
        formerNames: [
          { name: 'Centrum in Worcester', years: '1982–1997' },
          { name: "Worcester's Centrum Centre", years: '1997–2004' },
        ],
        photo: {
          source: 'wikimedia',
          url: 'https://commons.wikimedia.org/wiki/Special:FilePath/DCU_Center_-_Worcester,_MA_-_DSC05773.jpg',
          attribution: 'Daderot, CC0, via Wikimedia Commons',
        },
      },
      championships: [],
      retiredNumbers: [],
      notableAlumni: [
        'Colten Ellis', 'Tristan Lennox', 'Jakub Skarek', 'Arnaud Durandeau', 'Barry Almeida',
      ],
      records: [
        { label: 'Most home wins, single season', value: 37, season: '2017-18' },
      ],
      affiliates: { ahl: 'SPR', nhl: 'STL' },
      facts: [
        "The ECHL's first franchise in Massachusetts, filling the void left when the AHL's Worcester Sharks relocated to San Jose in 2015.",
        'Voluntarily suspended operations for the entire 2020-21 season due to the COVID-19 pandemic.',
        'Switched NHL/AHL affiliations for 2026-27, moving from the New York Islanders/Bridgeport Islanders pairing (2017-2026) to the St. Louis Blues/Springfield Thunderbirds.',
      ],
      currentInfo: {
        owner: 'Cliff Rucker (Worcester Pro Hockey, LLC)',
        headCoach: 'Nick Tuzzolino',
        lastVerified: '2026-09-01',
      },
    },


  },
};

export function getTeamHistory(league, abbr) {
  return TEAM_HISTORY[league]?.[abbr] || null;
}
