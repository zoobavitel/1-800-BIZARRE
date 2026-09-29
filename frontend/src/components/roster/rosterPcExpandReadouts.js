/**
 * Shared PC expand readout helpers (campaign + session roster).
 */
import {
  bandLabel,
  characterHasAbility,
  computeInventoryLoadUsed,
  loadBandForUsed,
  loadCapForBand,
  normalizeLoadoutEntry,
} from "../../features/character-sheet/utils/loadoutUtils";

export const STAND_GRADES = ["F", "D", "C", "B", "A", "S"];

export function stepGrade(letter, delta) {
  const u = String(letter || "D").toUpperCase();
  const i = STAND_GRADES.indexOf(u);
  const base = i >= 0 ? i : 1;
  const j = Math.max(0, Math.min(STAND_GRADES.length - 1, base + delta));
  return STAND_GRADES[j];
}

export function rawStandToGrades(raw) {
  const g = (k) => {
    if (!raw || typeof raw !== "object") return "D";
    const v = raw[k] ?? raw[k.toUpperCase()] ?? "D";
    const t = String(v).toUpperCase();
    return STAND_GRADES.includes(t) ? t : "D";
  };
  return {
    power: g("power"),
    speed: g("speed"),
    range: g("range"),
    durability: g("durability"),
    precision: g("precision"),
    development: g("development"),
  };
}

export function readoutsFromGrades(grades) {
  const out = {};
  for (const k of Object.keys(grades)) {
    out[k] = `Grade ${grades[k]}`;
  }
  return out;
}

export function flatActionDots(actionDots) {
  if (!actionDots || typeof actionDots !== "object") return [];
  const first = Object.values(actionDots)[0];
  if (first && typeof first === "object" && !Array.isArray(first)) {
    return Object.entries(actionDots).flatMap(([, g]) =>
      Object.entries(g || {}).map(([a, d]) => [a, d]),
    );
  }
  return Object.entries(actionDots);
}

/** Sheet column order — same groups as CharacterSheet action rating columns. */
export const SESSION_ACTION_DOT_COLUMNS = [
  {
    attr: "INSIGHT",
    actions: ["hunt", "study", "survey", "tinker"],
  },
  {
    attr: "PROWESS",
    actions: ["finesse", "prowl", "skirmish", "wreck"],
  },
  {
    attr: "RESOLVE",
    actions: ["bizarre", "command", "consort", "sway"],
  },
];

export function actionDotRatingMap(actionDots) {
  const out = {};
  for (const [k, v] of flatActionDots(actionDots)) {
    const key = String(k || "")
      .trim()
      .toLowerCase();
    if (!key) continue;
    const n = Math.max(0, Math.min(4, Math.floor(Number(v) || 0)));
    if (key === "attune") {
      out.bizarre = Math.max(out.bizarre || 0, n);
    } else {
      out[key] = n;
    }
  }
  return out;
}

export function rosterHeritageAbilityLines(character) {
  const details = character?.heritage_details || {};
  const selectedBenefits = new Set(
    (Array.isArray(character?.selected_benefits)
      ? character.selected_benefits
      : []
    ).map((x) => Number(x)),
  );
  const selectedDetriments = new Set(
    (Array.isArray(character?.selected_detriments)
      ? character.selected_detriments
      : []
    ).map((x) => Number(x)),
  );
  const lines = [];
  (details.benefits || []).forEach((b) => {
    if (!b) return;
    if (!(Boolean(b.required) || selectedBenefits.has(Number(b.id)))) return;
    const name = String(b.name || "").trim();
    if (name) lines.push({ kind: "benefit", name });
  });
  (details.detriments || []).forEach((d) => {
    if (!d) return;
    if (!(Boolean(d.required) || selectedDetriments.has(Number(d.id)))) return;
    const name = String(d.name || "").trim();
    if (name) lines.push({ kind: "detriment", name });
  });
  return lines;
}

export function rosterPlaybookAbilityGroups(character) {
  const groups = [];
  const push = (label, raw, mapFn) => {
    if (!Array.isArray(raw) || raw.length === 0) return;
    const items = raw.map(mapFn).filter(Boolean);
    if (items.length) groups.push({ label, items });
  };
  push("Standard", character?.standard_ability_details, (a) =>
    String(a?.name || "").trim(),
  );
  push("Hamon", character?.hamon_ability_details, (a) =>
    String(a?.name || "").trim(),
  );
  push("Spin", character?.spin_ability_details, (a) =>
    String(a?.name || "").trim(),
  );

  const customType =
    character?.custom_ability_type || "single_with_3_uses";
  const desc = String(character?.custom_ability_description || "").trim();
  const extra = Array.isArray(character?.extra_custom_abilities)
    ? character.extra_custom_abilities
    : [];
  const customItems = [];
  if (customType === "three_separate_uses" && extra.length > 0) {
    extra.forEach((a, i) => {
      const name = String(a?.name || a?.description || `Custom ${i + 1}`).trim();
      if (name) customItems.push(name);
    });
  } else if (desc || extra.length > 0) {
    const name =
      desc ||
      String(extra[0]?.name || extra[0]?.description || "Custom Ability").trim();
    if (name) customItems.push(name);
  }
  if (customItems.length) {
    groups.push({ label: "Custom", items: customItems });
  }
  return groups;
}

/** One-line summary for roster inventory row (strings or common object shapes). */
export function rosterFormatInventoryLine(item) {
  if (item == null || item === "") return null;
  if (typeof item === "string") {
    const t = item.trim();
    return t || null;
  }
  if (typeof item === "object" && !Array.isArray(item)) {
    const name = String(item.name ?? item.label ?? "").trim();
    const desc = String(item.description ?? item.detail ?? "").trim();
    const qty =
      item.quantity != null && item.quantity !== ""
        ? ` ×${item.quantity}`
        : "";
    const loadN = Number(item.load);
    const loadBit =
      Number.isFinite(loadN) && loadN > 0 ? ` (${loadN} load)` : "";
    if (name && desc) return `${name}${qty}${loadBit} — ${desc}`;
    if (name) return `${name}${qty}${loadBit}`;
    try {
      return JSON.stringify(item);
    } catch {
      return "[item]";
    }
  }
  try {
    return JSON.stringify(item);
  } catch {
    return String(item);
  }
}

/** Count `true` entries in character sheet coin_boxes / stash_slots arrays. */
export function countSheetBoolSlots(arr) {
  if (!Array.isArray(arr)) return 0;
  return arr.reduce((n, x) => n + (x === true ? 1 : 0), 0);
}

/** Sheet-matching load used + band for PC expand Items tab. */
export function rosterPcLoadSummary(character, sessionData) {
  const cid = character?.id;
  const map = sessionData?.loadout_by_character;
  const entry =
    map && cid != null
      ? normalizeLoadoutEntry(map[String(cid)] ?? map[cid])
      : normalizeLoadoutEntry(null);
  const std = Array.isArray(character?.standard_ability_details)
    ? character.standard_ability_details.map((a) => ({
        type: "standard",
        name: a?.name,
      }))
    : [];
  const hasMule = characterHasAbility(std, "Mule");
  const hasRigging = characterHasAbility(std, "Rigging");
  const coinFilled = countSheetBoolSlots(character?.coin_boxes);
  const used = computeInventoryLoadUsed({
    inventory: character?.inventory,
    coinFilled,
    riggingCategories: entry.rigging_categories,
    hasRigging,
  });
  const derivedBand = loadBandForUsed(used);
  const bandMax = derivedBand ? loadCapForBand(derivedBand, hasMule) : null;
  return { used, derivedBand, bandMax, bandLabel: bandLabel(derivedBand) };
}

export function rosterCharacterNoteSections(ch) {
  const out = [];
  const push = (label, val) => {
    const t = String(val ?? "").trim();
    if (t) out.push({ label, text: t });
  };
  push("Background", ch.background_note);
  push("Appearance", ch.appearance);
  push("Vice details", ch.vice_details);
  return out;
}

/** Primary sheet NOTES field (API `background_note2` / FE `sheetNotes`). */
export function rosterPcSheetNotes(character) {
  if (!character || typeof character !== "object") return "";
  if (character.background_note2 != null) {
    return String(character.background_note2);
  }
  if (character.sheetNotes != null) {
    return String(character.sheetNotes);
  }
  return "";
}

export function gradesFromCharacterStand(character) {
  const stand = character?.stand || {};
  if (
    stand.power != null ||
    stand.speed != null ||
    stand.range != null ||
    stand.durability != null ||
    stand.precision != null ||
    stand.development != null
  ) {
    return rawStandToGrades({
      power: stand.power,
      speed: stand.speed,
      range: stand.range,
      durability: stand.durability,
      precision: stand.precision,
      development: stand.development,
    });
  }
  return rawStandToGrades(character?.stand_coin_stats || {});
}
