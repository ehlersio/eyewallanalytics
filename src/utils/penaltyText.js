// utils/penaltyText.js
// Readable text for an NHL play-by-play penalty: who it's against, who
// serves it, and what it was for.
//
// A bench penalty (too many men, a failed coach's challenge) names no
// player -- its committedByPlayerId is absent and the play carries
// servedByPlayerId instead, the skater who sits in the box. Lists used to
// read committedByPlayerId alone and showed such a penalty as "Unknown"
// (BOS-CAR 2026-04-07, game 2025021237, P1 17:25). A player's own penalty
// can carry servedByPlayerId too: a goalie's minor is served by a skater.

// Who a penalty is against, from the play's details. `nameOf(id)` returns
// a name or null; a name the roster doesn't have stays null, never a guess.
export function penaltyParties(details, nameOf) {
  const d = details || {};
  const committedId = d.committedByPlayerId ?? null;
  const servedId    = d.servedByPlayerId ?? null;
  return {
    committedName: committedId != null ? (nameOf(committedId) || null) : null,
    servedByName:  servedId != null && servedId !== committedId ? (nameOf(servedId) || null) : null,
    // No player committed it: a bench or team penalty.
    teamPenalty:   committedId == null,
    benchMinor:    d.typeCode === 'BEN' && (d.duration == null || d.duration === 2),
  };
}

// The line naming who a penalty is against: the player, "Bench minor" or
// "Team penalty". Null when a player committed it but the roster has no
// name for them -- the caller decides what to show then.
export function penaltyHeadline(parties, t) {
  if (parties?.committedName) return parties.committedName;
  if (parties?.benchMinor) return t('penalties.benchMinor');
  if (parties?.teamPenalty) return t('penalties.teamPenalty');
  return null;
}

// "served by <name>", or null when nobody else serves it.
export function penaltyServedBy(parties, t) {
  return parties?.servedByName ? t('penalties.servedBy', { name: parties.servedByName }) : null;
}

// A play's descKey ("delaying-game-unsuccessful-challenge") as a reader
// would say it ("Delay of game (unsuccessful challenge)"). Known keys are
// translated (penalties.desc.* in the locale files); a key the NHL adds
// later reads as its own words, hyphens to spaces, first letter capped.
export function penaltyDescription(descKey, t) {
  if (!descKey || typeof descKey !== 'string') return null;
  const words = descKey.replace(/-/g, ' ').trim();
  const fallback = words.charAt(0).toUpperCase() + words.slice(1);
  // i18next reads '.' and ':' in a key as separators.
  if (!/^[a-z0-9-]+$/.test(descKey)) return fallback;
  return t(`penalties.desc.${descKey}`, { defaultValue: fallback });
}

// A period or game summary's penalty row (usePeriodSummary.js's
// summaryPenalty) as its two lines: who, then what. A row saved before
// teamPenalty existed, whose player has no name, still reads "Unknown".
export function summaryPenaltyLines(p, t) {
  const parties = {
    committedName: p?.playerName || null,
    servedByName:  p?.servedByName || null,
    teamPenalty:   p?.teamPenalty === true,
    benchMinor:    p?.benchMinor === true,
  };
  const who = penaltyHeadline(parties, t) || t('periodSummary.penalties.unknown');
  const what = [
    penaltyDescription(p?.type, t) || t('periodSummary.penalties.typeFallback'),
    p?.duration ? t('periodSummary.penalties.durationSuffix', { count: p.duration }) : null,
    penaltyServedBy(parties, t),
    p?.period ? `P${p.period}` : null,
  ].filter(Boolean).join(' · ');
  return { who, what };
}
