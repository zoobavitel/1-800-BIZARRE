/**
 * Derive Recharts-friendly datasets for the homepage POC stats visualizations.
 */

const MONTHS_BACK = 12;

/**
 * Prefer GM-set proposed play date for charts; fall back to record `session_date`.
 * @param {{ session_date?: string, proposed_date?: string | null }} s
 * @returns {Date | null}
 */
export function effectiveSessionChartDate(s) {
  if (!s || typeof s !== "object") return null;
  const pd = s.proposed_date;
  if (pd != null && pd !== "") {
    if (typeof pd === "string") {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(pd.trim());
      if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]) - 1;
        const day = Number(m[3]);
        const d = new Date(y, mo, day, 12, 0, 0, 0);
        if (!Number.isNaN(d.getTime())) return d;
      }
    }
    const tryPd = new Date(pd);
    if (!Number.isNaN(tryPd.getTime())) return tryPd;
  }
  if (!s.session_date) return null;
  const dt = new Date(s.session_date);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

const SCATTER_PALETTE = [
  "#e6b422",
  "#c084fc",
  "#d97b2a",
  "#7c3aed",
  "#4ade80",
  "#fbbf24",
  "#f97316",
  "#60a5fa",
];

/**
 * Sessions in the last N months as scatter points: x = effective date (ms),
 * y = row index per campaign (stable order). Uses `proposed_date` when set.
 * @returns {{ points: Array<{x:number,y:number,fill:string,sessionName:string,campaignName:string,sessionId:number}>, rowLabels: string[], xDomain: [number, number] }}
 */
export function buildSessionScatterPoints(campaigns, monthsBack = MONTHS_BACK) {
  const now = new Date();
  const windowStart = new Date(
    now.getFullYear(),
    now.getMonth() - (monthsBack - 1),
    1,
  );
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );

  const raw = [];
  const seen = new Set();
  for (const c of campaigns || []) {
    const sessions = Array.isArray(c.sessions) ? c.sessions : [];
    for (const s of sessions) {
      if (s?.id != null && seen.has(s.id)) continue;
      if (s?.id != null) seen.add(s.id);
      const d = effectiveSessionChartDate(s);
      if (!d || d < windowStart || d > windowEnd) continue;
      raw.push({
        x: d.getTime(),
        campaign: c,
        session: s,
      });
    }
  }
  raw.sort((a, b) => a.x - b.x);

  const idOrder = [];
  const seenCid = new Set();
  for (const r of raw) {
    const cid = r.campaign?.id;
    if (cid == null || seenCid.has(cid)) continue;
    seenCid.add(cid);
    idOrder.push(cid);
  }
  const rowForId = new Map(idOrder.map((id, i) => [id, i]));
  const rowLabels = idOrder.map((id) => {
    const c = (campaigns || []).find((x) => x.id === id);
    return (c && c.name) || `Campaign ${id}`;
  });

  const points = raw.map((r) => {
    const cy = rowForId.get(r.campaign.id) ?? 0;
    return {
      x: r.x,
      y: cy,
      fill: SCATTER_PALETTE[cy % SCATTER_PALETTE.length],
      sessionName: r.session.name || `Session ${r.session.id}`,
      campaignName: r.campaign.name || `Campaign ${r.campaign.id}`,
      sessionId: r.session.id,
    };
  });

  return {
    points,
    rowLabels,
    xDomain: [windowStart.getTime(), windowEnd.getTime()],
  };
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
