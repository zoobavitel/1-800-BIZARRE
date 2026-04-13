/**
 * Derive Recharts-friendly datasets for the homepage POC stats visualizations.
 */

const MONTHS_BACK = 12;

function monthKeyFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Last N calendar months (oldest first) with session counts from nested campaign sessions.
 */
export function buildSessionsByMonth(campaigns, monthsBack = MONTHS_BACK) {
  const now = new Date();
  const buckets = [];
  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKeyFromDate(d);
    const label = d.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
    buckets.push({ monthKey: key, label, count: 0 });
  }

  const seenIds = new Set();
  for (const c of campaigns || []) {
    const sessions = Array.isArray(c.sessions) ? c.sessions : [];
    for (const s of sessions) {
      if (s?.id != null && seenIds.has(s.id)) continue;
      if (s?.id != null) seenIds.add(s.id);
      if (!s?.session_date) continue;
      const dt = new Date(s.session_date);
      if (Number.isNaN(dt.getTime())) continue;
      const key = monthKeyFromDate(dt);
      const bucket = buckets.find((b) => b.monthKey === key);
      if (bucket) bucket.count += 1;
    }
  }

  return buckets.map(({ label, count }) => ({ label, count }));
}

/** Bar chart rows aligned with new palette: p1=purple, p2=gold, p3=burnt-orange, p4=warm-gold, green for sessions. */
export function buildBarChartRows(heroStats) {
  return [
    { name: "Campaigns", value: heroStats.activeCampaigns, fill: "#6c3989" },
    { name: "Sessions", value: heroStats.sessionCount, fill: "#e8ca70" },
    { name: "Crews", value: heroStats.crewCount, fill: "#b64200" },
    { name: "PCs", value: heroStats.pcCount, fill: "#b38f27" },
    { name: "NPCs", value: heroStats.npcCount, fill: "#a09060" },
  ];
}
