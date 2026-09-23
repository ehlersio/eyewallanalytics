// src/utils/goalReplayTarget.js
// Which goal a shot-map dot's replay should ask for: (gameId, eventId),
// the pair eyewall-poller's /nhl/goal-replay takes.
//
// A dot reaches the rink by one of two routes, and they identify a goal
// differently:
//
//   season aggregate ("All N games")  -- rows from shot_events via the
//     Worker, each carrying its own gameId and the NHL's event id, so any
//     goal from any game that season can be replayed. A row whose game
//     predates shot_events.event_id has none.
//
//   a single game -- events straight from that game's play-by-play, where
//     the NHL event id is the dot's own `id`, and the game is whichever one
//     those events are for (they differ from the selected game only under
//     ?mockGame=, DEV).
//
// null means "no replay for this dot" -- the popup then shows whatever
// else it has, or nothing, rather than asking for a goal that can't be
// looked up.
export function goalReplayTarget(event, { isAllN, gameId }) {
  if (event?.type !== 'goal') return null;
  const replayGameId = event.gameId ?? gameId;
  const replayEventId = event.eventId ?? (isAllN ? null : event.id);
  if (!replayGameId || replayEventId == null) return null;
  return { gameId: replayGameId, eventId: replayEventId };
}
