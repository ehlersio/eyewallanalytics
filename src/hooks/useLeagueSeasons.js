// hooks/useLeagueSeasons.js
// An AHL/ECHL league's season list, re-rendering the component when it's
// rebuilt from the Worker after load (league.config.seasonsUpdatedEvent;
// see ahlConfig.js's "Seasons from the Worker"). Season pickers read
// league.config.seasons; this makes a picker that mounted on the seed
// pick up the Worker's list.
import { useEffect, useState } from 'react';

export function useLeagueSeasons(league) {
  const [, setVersion] = useState(0);
  const event = league.config.seasonsUpdatedEvent;
  useEffect(() => {
    if (!event) return undefined;
    const bump = () => setVersion(v => v + 1);
    window.addEventListener(event, bump);
    return () => window.removeEventListener(event, bump);
  }, [event]);
  return league.config.seasons;
}
