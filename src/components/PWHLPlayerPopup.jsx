// components/PWHLPlayerPopup.jsx
// PWHL player popup: the shared HockeyTechPlayerPopup (also AHL/ECHL's) with
// a PWHL league object whose `playerPopup` options switch on what only the
// PWHL has data for -- the percentile radar header and bio row, the
// "vs Player" entry, percentile-highlighted season tiles, OT/SO goalie
// decisions with SV% in Recent Form, the goalie heat map, and the Scout tab
// (components/pwhl/PWHLPlayerPopupExtras.jsx).
//
// Props:
//   player {object} — minimum shape: { player_id }. Self-fetches identity +
//                      the given season's stat line via GET
//                      /pwhl/player/landing; any other fields paint first.
//   season {number}  — season_id to pin the self-fetched stat line to.
//   seasonLabel, onClose.
import HockeyTechPlayerPopup from './HockeyTechPlayerPopup';
import {
  PWHLPopupHeaderPanel, PWHLGoalieHeatMapTab, PWHLScout, pwhlGoalieDecision,
} from './pwhl/PWHLPlayerPopupExtras';
import {
  fetchPWHLPlayerShots, fetchPWHLPlayerLanding, fetchPWHLPlayerGameLog, fetchPWHLPlayerCareer,
  fetchPWHLPlayerPercentiles, fetchPWHLGoaliePercentiles,
} from '../utils/pwhlApi';
import { PWHL_CURRENT_SEASON, PWHL_TEAM_MAP, getPWHLTeamById } from '../utils/pwhlConfig';
import * as stats from '../utils/pwhlPlayerStats';

const SEASON_LABEL = '2025–26';

// Just what the popup reads -- the PWHL views don't use the HockeyTech
// league objects.
const PWHL = {
  key: 'pwhl',
  headshotSize: '240x240',
  api: {
    fetchPlayerLanding:     fetchPWHLPlayerLanding,
    fetchPlayerCareer:      fetchPWHLPlayerCareer,
    fetchPlayerGameLog:     fetchPWHLPlayerGameLog,
    fetchPlayerShots:       fetchPWHLPlayerShots,
    fetchPlayerPercentiles: fetchPWHLPlayerPercentiles,
    fetchGoaliePercentiles: fetchPWHLGoaliePercentiles,
  },
  config: {
    getTeamById:   getPWHLTeamById,
    getTeamByAbbr: abbr => PWHL_TEAM_MAP[abbr],
  },
  stats,
  playerPopup: {
    percentiles:           true,
    HeaderPanel:           PWHLPopupHeaderPanel,
    comparisonEntry:       true,
    birthPlaceField:       'birth_city',
    goalieDecision:        pwhlGoalieDecision,
    formSavePct:           true,
    goalieFormLegendKey:   'playerPopup.recentForm.legendGoaliePwhl',
    seasonSectionLabelKey: 'playerPopup.sections.seasonRegularPwhl',
    pctMap:                stats.PWHL_STAT_PCT_MAP,
    GoalieHeatMap:         PWHLGoalieHeatMapTab,
    shotTypeMap:           { g: 'goal', s: 'shot-on-goal', m: 'missed-shot', b: 'blocked-shot' },
    heatMapFallbackAbbr:   'BOS',
    ScoutTab:              PWHLScout,
    compareNoDataKey:      'playerPopup.compareTab.noDataPwhl',
  },
};

export default function PWHLPlayerPopup({ seasonLabel = SEASON_LABEL, season = PWHL_CURRENT_SEASON, ...props }) {
  return <HockeyTechPlayerPopup league={PWHL} seasonLabel={seasonLabel} season={season} {...props} />;
}
