// Adapts this app's internal shot-event shape (isCanes boolean, a Carolina-
// origin leftover -- see CLAUDE.md) to react-hockey-rink's public schema
// (team: 'primary' | 'opponent'). Every call site that renders <HockeyRink>
// should pass its events through this first; the app's own isCanes-shaped
// event objects otherwise stay unchanged everywhere else in the codebase.
export function toHockeyRinkEvents(events) {
  return events.map(e => ({ ...e, team: e.isCanes ? 'primary' : 'opponent' }));
}
