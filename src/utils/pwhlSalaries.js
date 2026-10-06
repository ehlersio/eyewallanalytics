// utils/pwhlSalaries.js
// The PWHL Team > Salaries tab shows the newest season with salary rows
// for the team. pwhl_salaries.py (eyewall-pipeline) is run by hand once the
// PWHLPA publishes a season's guide, so after the season flip (~Nov 20)
// the new season has no rows for a while, and the 2026-27 expansion teams
// have none at all. /pwhl/salaries matches on the label string
// pwhl_salaries.season stores ("2025-26"), not a season id.

// The labels to try, newest first, deduplicated, keeping only the
// "YYYY-YY" form the table stores.
export function salarySeasonLabels(labels) {
  return [...new Set(labels)].filter(l => /^\d{4}-\d{2}$/.test(l || ''));
}

// { season, rows } for the first (newest) label with salary rows for the
// team. rows [] when no label has any (the tab is hidden); rows null when a
// request failed -- unknown, so the tab stays offered and says it has no
// data rather than vanishing on a network blip.
export async function fetchLatestSalaries(teamId, labels, fetchSalaries) {
  for (const label of labels) {
    const rows = await fetchSalaries(teamId, label);
    if (!Array.isArray(rows)) return { season: label, rows: null };
    if (rows.length) return { season: label, rows };
  }
  return { season: null, rows: [] };
}
