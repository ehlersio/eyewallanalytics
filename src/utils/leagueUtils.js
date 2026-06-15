// src/utils/leagueUtils.js
// Pure grouping/sorting helpers for LeagueView.
// Extracted here so they can be unit-tested independently.

export function groupByDivision(entries) {
  const groups = {};
  for (const e of entries) {
    const div = e.divisionName;
    if (!groups[div]) groups[div] = { conf: e.conferenceName, rows: [] };
    groups[div].rows.push(e);
  }
  for (const g of Object.values(groups)) {
    g.rows.sort((a, b) => a.divisionSequence - b.divisionSequence);
  }
  return groups;
}

export function groupByConference(entries) {
  const groups = {};
  for (const e of entries) {
    const conf = e.conferenceName;
    if (!groups[conf]) groups[conf] = [];
    groups[conf].push(e);
  }
  for (const rows of Object.values(groups)) {
    rows.sort((a, b) => a.conferenceSequence - b.conferenceSequence);
  }
  return groups;
}

export function buildWildCard(entries) {
  const confs = {};
  for (const e of entries) {
    const conf = e.conferenceName;
    if (!confs[conf]) confs[conf] = { divLeaders: {}, wcPool: [] };
    if (e.divisionSequence <= 3) {
      if (!confs[conf].divLeaders[e.divisionName]) confs[conf].divLeaders[e.divisionName] = [];
      confs[conf].divLeaders[e.divisionName].push(e);
    } else {
      confs[conf].wcPool.push(e);
    }
  }
  for (const conf of Object.values(confs)) {
    conf.wcPool.sort((a, b) => a.wildcardSequence - b.wildcardSequence);
    for (const div of Object.values(conf.divLeaders)) {
      div.sort((a, b) => a.divisionSequence - b.divisionSequence);
    }
  }
  return confs;
}
