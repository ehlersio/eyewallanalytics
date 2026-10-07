// utils/hockeyTechI18n.js
// AHL/ECHL share one set of i18n namespaces (hockeyTech*: TeamView,
// PlayersView, PlayerPopup, ScheduleView, LeagueView, ShotMapView,
// GameEvents); the few strings that name the league take these
// interpolation values. The name is translated (the AHL is "LAH" in
// French), and French needs the article with it ("de la LAH", "de l'ECHL"),
// so strings use {{league}} or {{ofLeague}}:
//
//   t('hockeyTechPlayersView.noTeamSelected', leagueNameVars(t, league))
//   // en "No AHL team selected." / fr "Aucune équipe de la LAH sélectionnée."

export function leagueNameVars(t, league) {
  return {
    league:   t(`hockeyTechLeagues.${league.key}.name`),
    ofLeague: t(`hockeyTechLeagues.${league.key}.of`),
  };
}
