export const COMPACT_HARM_FIELDS = [
  ["l4", "L4", "1 / -1"],
  ["l3", "L3", "1 / -1"],
  ["l2a", "L2A", null],
  ["l2b", "L2B", null],
  ["l1a", "L1A", null],
  ["l1b", "L1B", null],
];

/** SRD row penalties while a filled harm slot applies to the action. */
export const COMPACT_HARM_DETRIMENT = {
  l4: "Fatal — need help (or Staying Power)",
  l3: "Incapacitated — help or push (2 stress)",
  l2a: "−1d while this harm applies",
  l2b: "−1d while this harm applies",
  l1a: "Reduced effect while this harm applies",
  l1b: "Reduced effect while this harm applies",
};

export function compactHarmActiveDetriments(draft) {
  const d = draft || {};
  const out = [];
  const seen = new Set();
  for (const [key] of COMPACT_HARM_FIELDS) {
    if (!String(d[key] ?? "").trim()) continue;
    const label = COMPACT_HARM_DETRIMENT[key];
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}

export const COMPACT_HARM_DETRIMENT_IDLE =
  "Filled slots apply until healed/cleared: L1 reduced effect · L2 −1d · L3 incapacitated · L4 fatal.";

export const EMPTY_HARM_PAYLOAD = {
  harm_level1_name: "",
  harm_level1_used: false,
  harm_level1_slot2_name: "",
  harm_level1_slot2_used: false,
  harm_level2_name: "",
  harm_level2_used: false,
  harm_level2_slot2_name: "",
  harm_level2_slot2_used: false,
  harm_level3_name: "",
  harm_level3_used: false,
  harm_level4_name: "",
  harm_level4_used: false,
};

export function harmDraftFromApiCharacter(ch) {
  const o = ch || {};
  return {
    l1a: String(o.harm_level1_name ?? "").trim(),
    l1b: String(o.harm_level1_slot2_name ?? "").trim(),
    l2a: String(o.harm_level2_name ?? "").trim(),
    l2b: String(o.harm_level2_slot2_name ?? "").trim(),
    l3: String(o.harm_level3_name ?? "").trim(),
    l4: String(o.harm_level4_name ?? "").trim(),
  };
}

export function harmPayloadFromDraft(d) {
  const draft = d || {};
  return {
    harm_level1_name: draft.l1a || "",
    harm_level1_used: !!(draft.l1a || "").trim(),
    harm_level1_slot2_name: draft.l1b || "",
    harm_level1_slot2_used: !!(draft.l1b || "").trim(),
    harm_level2_name: draft.l2a || "",
    harm_level2_used: !!(draft.l2a || "").trim(),
    harm_level2_slot2_name: draft.l2b || "",
    harm_level2_slot2_used: !!(draft.l2b || "").trim(),
    harm_level3_name: draft.l3 || "",
    harm_level3_used: !!(draft.l3 || "").trim(),
    harm_level4_name: draft.l4 || "",
    harm_level4_used: !!(draft.l4 || "").trim(),
  };
}

export function compactHarmFieldStyle(key, rawValue) {
  const filled = String(rawValue ?? "").trim().length > 0;
  const borderA = filled ? 1 : 0.55;
  const fillA = filled ? 0.28 : 0.14;
  if (key === "l4") {
    return {
      border: `1px solid rgba(248, 113, 113, ${borderA})`,
      background: `rgba(127, 29, 29, ${fillA})`,
      color: "#fecaca",
    };
  }
  if (key === "l3") {
    return {
      border: `1px solid rgba(251, 146, 60, ${borderA})`,
      background: `rgba(154, 52, 18, ${fillA})`,
      color: "#ffedd5",
    };
  }
  if (key === "l2a" || key === "l2b") {
    return {
      border: `1px solid rgba(250, 204, 21, ${borderA})`,
      background: `rgba(113, 63, 18, ${fillA})`,
      color: "#fef9c3",
    };
  }
  return {
    border: `1px solid rgba(96, 165, 250, ${borderA})`,
    background: `rgba(30, 58, 138, ${fillA})`,
    color: "#dbeafe",
  };
}

const ROSTER_DUR_STAND_ARMOR_MAX = {
  F: 0,
  D: 1,
  C: 2,
  B: 4,
  A: 5,
  S: 6,
};

export function rosterStandArmorMaxFromDurabilityGrade(letter) {
  const k = String(letter ?? "F")
    .trim()
    .toUpperCase()
    .slice(0, 1);
  return ROSTER_DUR_STAND_ARMOR_MAX[k] ?? 0;
}
