/**
 * draftFixtures.js — Realistic 2026 draft fixture data for DevDraftView and Cypress tests.
 * Based on actual NHL Central Scouting rankings and known R1 pick order.
 */

export const FIXTURE_RANKINGS = {
  1: [ // NA Skaters
    { category_id: 1, final_rank: 1,  midterm_rank: 1,  first_name: 'Gavin',    last_name: 'McKenna',    position_code: 'C',  shoots_catches: 'L', height_inches: 73, weight_pounds: 183, last_amateur_club: 'Penn State',     last_amateur_league: 'Big Ten',    birth_country: 'CAN' },
    { category_id: 1, final_rank: 2,  midterm_rank: 4,  first_name: 'Chase',    last_name: 'Reid',       position_code: 'D',  shoots_catches: 'L', height_inches: 74, weight_pounds: 196, last_amateur_club: 'Soo',            last_amateur_league: 'OHL',        birth_country: 'CAN' },
    { category_id: 1, final_rank: 3,  midterm_rank: 2,  first_name: 'Caleb',    last_name: 'Malhotra',   position_code: 'C',  shoots_catches: 'L', height_inches: 73, weight_pounds: 185, last_amateur_club: 'Brantford',      last_amateur_league: 'OHL',        birth_country: 'CAN' },
    { category_id: 1, final_rank: 4,  midterm_rank: 5,  first_name: 'Keaton',   last_name: 'Verhoeff',   position_code: 'D',  shoots_catches: 'L', height_inches: 75, weight_pounds: 202, last_amateur_club: 'North Dakota',   last_amateur_league: 'NCHC',       birth_country: 'USA' },
    { category_id: 1, final_rank: 5,  midterm_rank: 3,  first_name: 'Carson',   last_name: 'Carels',     position_code: 'D',  shoots_catches: 'L', height_inches: 74, weight_pounds: 192, last_amateur_club: 'Prince George',  last_amateur_league: 'WHL',        birth_country: 'CAN' },
    { category_id: 1, final_rank: 6,  midterm_rank: 7,  first_name: 'Tynan',    last_name: 'Lawrence',   position_code: 'C',  shoots_catches: 'L', height_inches: 72, weight_pounds: 178, last_amateur_club: 'Boston University', last_amateur_league: 'HEA',     birth_country: 'USA' },
    { category_id: 1, final_rank: 7,  midterm_rank: 6,  first_name: 'Liam',     last_name: 'Ruck',       position_code: 'RW', shoots_catches: 'R', height_inches: 72, weight_pounds: 174, last_amateur_club: 'Medicine Hat',   last_amateur_league: 'WHL',        birth_country: 'CAN' },
    { category_id: 1, final_rank: 8,  midterm_rank: 10, first_name: 'Brooks',   last_name: 'Rogowski',   position_code: 'C',  shoots_catches: 'R', height_inches: 79, weight_pounds: 235, last_amateur_club: 'Oshawa',         last_amateur_league: 'OHL',        birth_country: 'USA' },
    { category_id: 1, final_rank: 9,  midterm_rank: 8,  first_name: 'Tommy',    last_name: 'Bleyl',      position_code: 'D',  shoots_catches: 'R', height_inches: 71, weight_pounds: 170, last_amateur_club: 'Moncton',        last_amateur_league: 'QMJHL',      birth_country: 'USA' },
    { category_id: 1, final_rank: 10, midterm_rank: 9,  first_name: 'Maddox',   last_name: 'Dagenais',   position_code: 'C',  shoots_catches: 'L', height_inches: 76, weight_pounds: 198, last_amateur_club: 'Quebec',         last_amateur_league: 'QMJHL',      birth_country: 'CAN' },
  ],
  2: [ // Intl Skaters
    { category_id: 2, final_rank: 1,  midterm_rank: 1,  first_name: 'Ivar',     last_name: 'Stenberg',   position_code: 'LW', shoots_catches: 'L', height_inches: 73, weight_pounds: 185, last_amateur_club: 'Frölunda HC',    last_amateur_league: 'SHL',        birth_country: 'SWE' },
    { category_id: 2, final_rank: 2,  midterm_rank: 3,  first_name: 'Alberts',  last_name: 'Smits',      position_code: 'D',  shoots_catches: 'L', height_inches: 76, weight_pounds: 200, last_amateur_club: 'Jukurit',        last_amateur_league: 'Liiga',      birth_country: 'LAT' },
    { category_id: 2, final_rank: 3,  midterm_rank: 2,  first_name: 'Viggo',    last_name: 'Björck',     position_code: 'C',  shoots_catches: 'R', height_inches: 72, weight_pounds: 176, last_amateur_club: 'Djurgårdens IF', last_amateur_league: 'SHL',        birth_country: 'SWE' },
    { category_id: 2, final_rank: 4,  midterm_rank: 5,  first_name: 'Malte',    last_name: 'Gustafsson', position_code: 'D',  shoots_catches: 'L', height_inches: 74, weight_pounds: 190, last_amateur_club: 'HV71',           last_amateur_league: 'SHL',        birth_country: 'SWE' },
    { category_id: 2, final_rank: 5,  midterm_rank: 4,  first_name: 'Emil',     last_name: 'Hemming',    position_code: 'LW', shoots_catches: 'L', height_inches: 73, weight_pounds: 182, last_amateur_club: 'Tappara',        last_amateur_league: 'Liiga',      birth_country: 'FIN' },
    { category_id: 2, final_rank: 6,  midterm_rank: 7,  first_name: 'Oliver',   last_name: 'Eklind',     position_code: 'C',  shoots_catches: 'L', height_inches: 73, weight_pounds: 181, last_amateur_club: 'MODO',           last_amateur_league: 'SHL',        birth_country: 'SWE' },
    { category_id: 2, final_rank: 7,  midterm_rank: 6,  first_name: 'Kasper',   last_name: 'Halttunen',  position_code: 'RW', shoots_catches: 'R', height_inches: 72, weight_pounds: 177, last_amateur_club: 'TPS',            last_amateur_league: 'Liiga',      birth_country: 'FIN' },
    { category_id: 2, final_rank: 8,  midterm_rank: 9,  first_name: 'Axel',     last_name: 'Hurtig',     position_code: 'LW', shoots_catches: 'L', height_inches: 74, weight_pounds: 188, last_amateur_club: 'Rögle',          last_amateur_league: 'SHL',        birth_country: 'SWE' },
    { category_id: 2, final_rank: 9,  midterm_rank: 8,  first_name: 'Tatu',     last_name: 'Raty',       position_code: 'C',  shoots_catches: 'L', height_inches: 72, weight_pounds: 179, last_amateur_club: 'Kärpät',         last_amateur_league: 'Liiga',      birth_country: 'FIN' },
    { category_id: 2, final_rank: 10, midterm_rank: 11, first_name: 'Mikhail',  last_name: 'Gulyayev',   position_code: 'D',  shoots_catches: 'L', height_inches: 75, weight_pounds: 196, last_amateur_club: 'Lokomotiv',      last_amateur_league: 'KHL',        birth_country: 'RUS' },
  ],
  3: [ // NA Goalies
    { category_id: 3, final_rank: 1,  midterm_rank: 1,  first_name: 'Carter',   last_name: 'George',     position_code: 'G',  shoots_catches: 'L', height_inches: 73, weight_pounds: 185, last_amateur_club: 'Windsor',        last_amateur_league: 'OHL',        birth_country: 'CAN' },
    { category_id: 3, final_rank: 2,  midterm_rank: 2,  first_name: 'Brady',    last_name: 'Portland',   position_code: 'G',  shoots_catches: 'L', height_inches: 74, weight_pounds: 192, last_amateur_club: 'Tri-City',       last_amateur_league: 'WHL',        birth_country: 'CAN' },
    { category_id: 3, final_rank: 3,  midterm_rank: 4,  first_name: 'Nathan',   last_name: 'Tal',        position_code: 'G',  shoots_catches: 'L', height_inches: 74, weight_pounds: 188, last_amateur_club: 'Sudbury',        last_amateur_league: 'OHL',        birth_country: 'CAN' },
  ],
  4: [ // Intl Goalies
    { category_id: 4, final_rank: 1,  midterm_rank: 1,  first_name: 'Leon',     last_name: 'Wallner',    position_code: 'G',  shoots_catches: 'L', height_inches: 75, weight_pounds: 194, last_amateur_club: 'Frölunda HC',    last_amateur_league: 'SHL',        birth_country: 'SWE' },
    { category_id: 4, final_rank: 2,  midterm_rank: 2,  first_name: 'Elias',    last_name: 'Hossain',    position_code: 'G',  shoots_catches: 'L', height_inches: 74, weight_pounds: 186, last_amateur_club: 'Djurgårdens IF', last_amateur_league: 'SHL',        birth_country: 'SWE' },
    { category_id: 4, final_rank: 3,  midterm_rank: 3,  first_name: 'Jakub',    last_name: 'Milota',     position_code: 'G',  shoots_catches: 'L', height_inches: 76, weight_pounds: 198, last_amateur_club: 'Kometa Brno',    last_amateur_league: 'Extraliga',  birth_country: 'CZE' },
  ],
};

// R1 order — first 10 picks for simulation
export const FIXTURE_ORDER = [
  { pick_overall: 1,  round: 1, pick_in_round: 1,  team_abbrev: 'TOR', original_team: null },
  { pick_overall: 2,  round: 1, pick_in_round: 2,  team_abbrev: 'SJS', original_team: null },
  { pick_overall: 3,  round: 1, pick_in_round: 3,  team_abbrev: 'VAN', original_team: null },
  { pick_overall: 4,  round: 1, pick_in_round: 4,  team_abbrev: 'CHI', original_team: null },
  { pick_overall: 5,  round: 1, pick_in_round: 5,  team_abbrev: 'NYR', original_team: null },
  { pick_overall: 6,  round: 1, pick_in_round: 6,  team_abbrev: 'CGY', original_team: null },
  { pick_overall: 7,  round: 1, pick_in_round: 7,  team_abbrev: 'SEA', original_team: null },
  { pick_overall: 8,  round: 1, pick_in_round: 8,  team_abbrev: 'WPG', original_team: null },
  { pick_overall: 9,  round: 1, pick_in_round: 9,  team_abbrev: 'FLA', original_team: null },
  { pick_overall: 10, round: 1, pick_in_round: 10, team_abbrev: 'NSH', original_team: null },
  { pick_overall: 15, round: 1, pick_in_round: 15, team_abbrev: 'STL', original_team: 'DET' },
  { pick_overall: 20, round: 1, pick_in_round: 20, team_abbrev: 'SJS', original_team: 'EDM' },
  { pick_overall: 26, round: 1, pick_in_round: 26, team_abbrev: 'NYR', original_team: 'DAL' },
  { pick_overall: 30, round: 1, pick_in_round: 30, team_abbrev: 'CGY', original_team: 'VGK' },
  { pick_overall: 31, round: 1, pick_in_round: 31, team_abbrev: 'CAR', original_team: null },
  { pick_overall: 32, round: 1, pick_in_round: 32, team_abbrev: 'OTT', original_team: null },
  { pick_overall: 33, round: 2, pick_in_round: 1,  team_abbrev: 'VAN', original_team: null },
  { pick_overall: 64, round: 2, pick_in_round: 32, team_abbrev: 'NYR', original_team: 'CAR' },
];

// Simulated picks — fed one at a time in play mode
// Each pick matches a prospect in FIXTURE_RANKINGS for popup testing
export const FIXTURE_PICKS_SEQUENCE = [
  { pick_overall: 1,  round: 1, pick_in_round: 1,  team_abbrev: 'TOR', prospect_first: 'Gavin',   prospect_last: 'McKenna',  position_code: 'C',  shoots_catches: 'L', height_inches: 73, weight_pounds: 183, last_amateur_club: 'Penn State',    last_amateur_league: 'Big Ten',  birth_country: 'CAN', final_rank: 1,  midterm_rank: 1,  category_id: 1, ai_analysis: 'Toronto gets the best player in the draft. McKenna is a generational playmaker — elite vision, two-way game, and the skating to match. A slam dunk at #1 that gives TOR their franchise center.' },
  { pick_overall: 2,  round: 1, pick_in_round: 2,  team_abbrev: 'SJS', prospect_first: 'Chase',   prospect_last: 'Reid',     position_code: 'D',  shoots_catches: 'L', height_inches: 74, weight_pounds: 196, last_amateur_club: 'Soo',           last_amateur_league: 'OHL',      birth_country: 'CAN', final_rank: 2,  midterm_rank: 4,  category_id: 1, ai_analysis: 'San Jose lands a top defensive prospect who rose four spots at final rankings. Reid\'s skating and positioning make him an ideal fit for a rebuilding SJS blue line.' },
  { pick_overall: 3,  round: 1, pick_in_round: 3,  team_abbrev: 'VAN', prospect_first: 'Caleb',   prospect_last: 'Malhotra', position_code: 'C',  shoots_catches: 'L', height_inches: 73, weight_pounds: 185, last_amateur_club: 'Brantford',     last_amateur_league: 'OHL',      birth_country: 'CAN', final_rank: 3,  midterm_rank: 2,  category_id: 1, ai_analysis: 'Vancouver adds a high-end center who dropped one spot from midterm but remains elite. Malhotra\'s two-way game and faceoff dominance complement VAN\'s core nicely.' },
  { pick_overall: 4,  round: 1, pick_in_round: 4,  team_abbrev: 'CHI', prospect_first: 'Ivar',    prospect_last: 'Stenberg', position_code: 'LW', shoots_catches: 'L', height_inches: 73, weight_pounds: 185, last_amateur_club: 'Frölunda HC',   last_amateur_league: 'SHL',      birth_country: 'SWE', final_rank: 1,  midterm_rank: 1,  category_id: 2, ai_analysis: 'Chicago goes international with Stenberg, the top-ranked Intl skater. A power forward with elite production in the SHL — high floor, high ceiling for the rebuilding Blackhawks.' },
  { pick_overall: 5,  round: 1, pick_in_round: 5,  team_abbrev: 'NYR', prospect_first: 'Keaton',  prospect_last: 'Verhoeff', position_code: 'D',  shoots_catches: 'L', height_inches: 75, weight_pounds: 202, last_amateur_club: 'North Dakota',  last_amateur_league: 'NCHC',     birth_country: 'USA', final_rank: 4,  midterm_rank: 5,  category_id: 1, ai_analysis: 'New York adds a big-bodied offensive defenseman. Verhoeff has the tools to quarterback a power play at the NHL level — exactly what NYR needs for their next window.' },
  { pick_overall: 6,  round: 1, pick_in_round: 6,  team_abbrev: 'CGY', prospect_first: 'Carson',  prospect_last: 'Carels',   position_code: 'D',  shoots_catches: 'L', height_inches: 74, weight_pounds: 192, last_amateur_club: 'Prince George',  last_amateur_league: 'WHL',     birth_country: 'CAN', final_rank: 5,  midterm_rank: 3,  category_id: 1, ai_analysis: 'Calgary takes the best available defender at #6. Carels dropped two spots from midterm but remains a premium talent — an elite skater who drives play in his own zone.' },
  { pick_overall: 31, round: 1, pick_in_round: 31, team_abbrev: 'CAR', prospect_first: 'Maddox',  prospect_last: 'Dagenais', position_code: 'C',  shoots_catches: 'L', height_inches: 76, weight_pounds: 198, last_amateur_club: 'Quebec',        last_amateur_league: 'QMJHL',    birth_country: 'CAN', final_rank: 10, midterm_rank: 9,  category_id: 1, ai_analysis: 'Carolina gets outstanding value at #31. Dagenais has prototype NHL size and plays a north-south game that fits perfectly in Rod Brind\'Amour\'s system. A steal at the back end of R1.' },
  { pick_overall: 33, round: 2, pick_in_round: 1,  team_abbrev: 'VAN', prospect_first: 'Leon',    prospect_last: 'Wallner',  position_code: 'G',  shoots_catches: 'L', height_inches: 75, weight_pounds: 194, last_amateur_club: 'Frölunda HC',   last_amateur_league: 'SHL',      birth_country: 'SWE', final_rank: 1,  midterm_rank: 1,  category_id: 4, ai_analysis: 'Vancouver lands the top international goalie prospect to pair with their existing core. Wallner showed elite puck-handling and athleticism in the SHL this season.' },
  { pick_overall: 64, round: 2, pick_in_round: 32, team_abbrev: 'NYR', prospect_first: 'Nathan',  prospect_last: 'Tal',      position_code: 'G',  shoots_catches: 'L', height_inches: 74, weight_pounds: 188, last_amateur_club: 'Sudbury',       last_amateur_league: 'OHL',      birth_country: 'CAN', final_rank: 3,  midterm_rank: 4,  category_id: 3, ai_analysis: 'Rangers close out Round 2 with a goalie taken from CAR\'s traded pick. Tal is raw but has the compete level and athleticism that develops well at the NHL level.' },
];

// CAR-specific picks for PicksTab simulation
export const FIXTURE_PICKS_CAR = FIXTURE_PICKS_SEQUENCE.filter(p => p.team_abbrev === 'CAR');

// Multi-team view — picks involving specific teams for team switcher
export const getPicksForTeam = (abbr) =>
  FIXTURE_PICKS_SEQUENCE.filter(p => p.team_abbrev === abbr);

export const getOrderForTeam = (abbr) =>
  FIXTURE_ORDER.filter(p => p.team_abbrev === abbr);
