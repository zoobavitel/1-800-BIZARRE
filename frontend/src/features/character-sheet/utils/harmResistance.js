/** One resistance roll lowers one filled harm entry. The lowered entry is not offered again. */

const LEVELS = ["level4", "level3", "level2", "level1"];
const SLOT_COUNTS = { level4: 1, level3: 1, level2: 2, level1: 2 };
const LEVEL_LABELS = {
  level4: "Level 4",
  level3: "Level 3",
  level2: "Level 2",
  level1: "Level 1",
};
const DOWNGRADE = {
  level4: "level3",
  level3: "level2",
  level2: "level1",
  level1: null,
};

export function emptyHarmResisted() {
  return {
    level4: [false],
    level3: [false],
    level2: [false, false],
    level1: [false, false],
  };
}

function flagAt(flags, level, idx) {
  const row = flags && flags[level];
  return Array.isArray(row) ? !!row[idx] : false;
}

export function normalizeHarmResisted(flags) {
  const out = emptyHarmResisted();
  LEVELS.forEach((level) => {
    out[level] = out[level].map((_, idx) => flagAt(flags, level, idx));
  });
  return out;
}

function cloneHarm(harm) {
  return {
    level4: [String(harm?.level4?.[0] ?? "")],
    level3: [String(harm?.level3?.[0] ?? "")],
    level2: [String(harm?.level2?.[0] ?? ""), String(harm?.level2?.[1] ?? "")],
    level1: [String(harm?.level1?.[0] ?? ""), String(harm?.level1?.[1] ?? "")],
  };
}

function rowHasEmptySlot(harm, level) {
  const count = SLOT_COUNTS[level];
  const slots = Array.isArray(harm?.[level]) ? harm[level] : [];
  for (let idx = 0; idx < count; idx += 1) {
    if (!String(slots[idx] || "").trim()) return true;
  }
  return false;
}

/** Level 1 clears. Any higher level needs an empty slot one row down. */
function canReduceSlot(harm, level) {
  const nextLevel = DOWNGRADE[level];
  if (!nextLevel) return true;
  return rowHasEmptySlot(harm, nextLevel);
}

export function harmHasFilledText(harm) {
  return LEVELS.some((level) => {
    const count = SLOT_COUNTS[level];
    const slots = Array.isArray(harm?.[level]) ? harm[level] : [];
    for (let idx = 0; idx < count; idx += 1) {
      if (String(slots[idx] || "").trim()) return true;
    }
    return false;
  });
}

export function resistableHarmOptions(harm, resisted) {
  const flags = normalizeHarmResisted(resisted);
  const out = [];
  LEVELS.forEach((level) => {
    if (!canReduceSlot(harm, level)) return;
    const count = SLOT_COUNTS[level];
    const slots = Array.isArray(harm?.[level]) ? harm[level] : [];
    for (let idx = 0; idx < count; idx += 1) {
      const text = String(slots[idx] || "").trim();
      if (!text || flags[level][idx]) continue;
      const letter = count > 1 ? String.fromCharCode(65 + idx) : "";
      out.push({
        value: `${level}:${idx}`,
        label: `${LEVEL_LABELS[level]}${letter} — ${text}`,
      });
    }
  });
  return out;
}

/**
 * Lower one filled, not-yet-resisted entry by one level.
 * Level 1 is cleared. The destination entry is marked resisted.
 */
export function reduceHarmOnce(harm, resisted, target) {
  const originalHarm = cloneHarm(harm);
  const originalFlags = normalizeHarmResisted(resisted);
  const texts = cloneHarm(harm);
  const flags = normalizeHarmResisted(resisted);
  const [level, idxRaw] = String(target || "").split(":");
  const idx = parseInt(String(idxRaw || ""), 10);
  if (!SLOT_COUNTS[level] || !Number.isFinite(idx)) {
    return { ok: false, harm: originalHarm, resisted: originalFlags };
  }
  if (idx < 0 || idx >= SLOT_COUNTS[level]) {
    return { ok: false, harm: originalHarm, resisted: originalFlags };
  }
  const value = String(texts[level][idx] || "").trim();
  if (!value || flags[level][idx]) {
    return { ok: false, harm: originalHarm, resisted: originalFlags };
  }

  const nextLevel = DOWNGRADE[level];
  texts[level][idx] = "";
  flags[level][idx] = false;
  if (!nextLevel) {
    return { ok: true, harm: texts, resisted: flags };
  }

  const toRow = texts[nextLevel];
  let targetSlot = idx < toRow.length ? idx : -1;
  if (targetSlot < 0 || String(toRow[targetSlot] || "").trim()) {
    targetSlot = toRow.findIndex((v) => !String(v || "").trim());
  }
  if (targetSlot < 0) {
    return { ok: false, harm: originalHarm, resisted: originalFlags };
  }
  toRow[targetSlot] = value;
  flags[nextLevel][targetSlot] = true;
  return { ok: true, harm: texts, resisted: flags };
}

/** A renamed or cleared slot is a new injury and can be resisted again. */
export function resistedAfterTextEdit(
  resisted,
  level,
  slotIndex,
  previousText,
  nextText,
) {
  const flags = normalizeHarmResisted(resisted);
  if (!SLOT_COUNTS[level]) return flags;
  const idx = Math.max(
    0,
    Math.min(SLOT_COUNTS[level] - 1, Math.floor(Number(slotIndex) || 0)),
  );
  if (String(previousText ?? "").trim() !== String(nextText ?? "").trim()) {
    flags[level][idx] = false;
  }
  return flags;
}

/** Healing-clock shift. Flags follow the text the same way the names move. */
export function shiftAllHarmDown(harm, resisted) {
  const texts = cloneHarm(harm);
  const flags = normalizeHarmResisted(resisted);
  const keep = (value) => String(value || "").trim();
  const l4 = keep(texts.level4[0]);
  const l3 = keep(texts.level3[0]);
  const l2a = keep(texts.level2[0]);
  const l2b = keep(texts.level2[1]);
  return {
    harm: {
      level4: [""],
      level3: [l4],
      level2: [l3, ""],
      level1: [l2a, l2b],
    },
    resisted: {
      level4: [false],
      level3: [l4 ? flags.level4[0] : false],
      level2: [l3 ? flags.level3[0] : false, false],
      level1: [
        l2a ? flags.level2[0] : false,
        l2b ? flags.level2[1] : false,
      ],
    },
  };
}
