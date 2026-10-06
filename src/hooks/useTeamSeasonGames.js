// hooks/useTeamSeasonGames.js
// { [seasonId]: { games, finals } | null } for the team's schedule in each
// of `seasonIds`, or null until every request has answered. See
// utils/teamSeasons.js for how views use it to build their season pickers.
import { useFetch } from './useFetch';
import { summarizeSeasonGames } from '../utils/teamSeasons';

export function useTeamSeasonGames(fetchSchedule, teamId, seasonIds) {
  const ids = [...new Set(seasonIds.filter(id => id != null).map(Number))].sort((a, b) => a - b);
  const key = ids.join(',');
  const { data, loading } = useFetch(async () => {
    if (!teamId || !ids.length) return {};
    const rows = await Promise.all(ids.map(id => fetchSchedule(teamId, id).catch(() => null)));
    return Object.fromEntries(ids.map((id, i) => [id, summarizeSeasonGames(rows[i])]));
  }, [teamId, key]);
  return loading ? null : data;
}
