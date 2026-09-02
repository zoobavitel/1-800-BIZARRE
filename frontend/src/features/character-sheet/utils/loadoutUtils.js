/** SRD load bands and load math (mirrors backend loadout service). */

export const LOAD_BANDS = [
  { value: "light", label: "Light", range: "1–3" },
  { value: "normal", label: "Normal", range: "4–5" },
  { value: "heavy", label: "Heavy", range: "6" },
  { value: "encumbered", label: "Encumbered", range: "7–9" },
];

const BASE_CAPS = {
  light: 3,
  normal: 5,
  heavy: 6,
  encumbered: 9,
};

const MULE_CAPS = {
  light: 5,
  normal: 7,
  heavy: 8,
  encumbered: 9,
};

export const RIGGING_CATEGORY_OPTIONS = [
  { value: "weapons", label: "Weapons" },
  { value: "implements", label: "Bizarre Implements" },
  { value: "supplies", label: "Supplies" },
  { value: "gear", label: "Gear" },
  { value: "documents", label: "Documents" },
  { value: "tools", label: "Tools" },
];

export const EQUIPMENT_CATEGORY_OPTIONS = [
  { value: "documents", label: "Documents" },
  { value: "gear", label: "Gear" },
  { value: "implements", label: "Bizarre Implements" },
  { value: "supplies", label: "Subterfuge Supplies" },
  { value: "tools", label: "Tools" },
  { value: "weapons", label: "Weapons" },
  { value: "other", label: "Other" },
];

export function categoryLabel(value) {
  const v = String(value || "other").toLowerCase();
  const hit = EQUIPMENT_CATEGORY_OPTIONS.find((o) => o.value === v);
  return hit?.label || v;
}

export function loadCapForBand(band, hasMule = false) {
  const b = String(band || "").toLowerCase();
  const caps = hasMule ? MULE_CAPS : BASE_CAPS;
  return caps[b] ?? 5;
}

export function bandLabel(band) {
  const b = LOAD_BANDS.find((x) => x.value === band);
  return b ? `${b.label} (${b.range})` : String(band || "—");
}

/** SRD band from total load (items + coin). */
export function loadBandForUsed(used) {
  const u = Math.max(0, Math.floor(Number(used) || 0));
  if (u <= 0) return "";
  if (u <= 3) return "light";
  if (u <= 5) return "normal";
  if (u <= 6) return "heavy";
  return "encumbered";
}

export function inventoryItemsWithLoad(inventory = []) {
  return (inventory || []).filter((item) => (Number(item?.load) || 0) > 0);
}

export function computeInventoryLoadUsed({
  inventory = [],
  coinFilled = 0,
  riggingCategories = [],
  hasRigging = false,
}) {
  const loadedIds = inventoryItemsWithLoad(inventory).map((item) =>
    String(item.id),
  );
  return computeLoadUsed({
    inventory,
    carriedIds: loadedIds,
    carryCoin: coinFilled > 0,
    coinFilled,
    riggingCategories,
    hasRigging,
  });
}

export function normalizeLoadoutEntry(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      band: "",
      carried_ids: [],
      carry_coin: false,
      rigging_categories: [],
      armor_restored: false,
    };
  }
  const band = String(raw.band || "").toLowerCase();
  const validBand = LOAD_BANDS.some((b) => b.value === band) ? band : "";
  const carried = Array.isArray(raw.carried_ids)
    ? raw.carried_ids.map((x) => String(x))
    : [];
  const rigging = Array.isArray(raw.rigging_categories)
    ? raw.rigging_categories
        .map((c) => String(c).toLowerCase())
        .filter((c) =>
          RIGGING_CATEGORY_OPTIONS.some((o) => o.value === c),
        )
        .slice(0, 2)
    : [];
  return {
    band: validBand,
    carried_ids: carried,
    carry_coin: Boolean(raw.carry_coin),
    rigging_categories: rigging,
    armor_restored: Boolean(raw.armor_restored),
  };
}

export function computeLoadUsed({
  inventory = [],
  carriedIds = [],
  carryCoin = false,
  coinFilled = 0,
  riggingCategories = [],
  hasRigging = false,
}) {
  const carriedSet = new Set(carriedIds.map(String));
  const byId = {};
  for (const item of inventory) {
    if (item?.id != null) byId[String(item.id)] = item;
  }
  const riggingFree = {};
  if (hasRigging) {
    for (const cat of riggingCategories.slice(0, 2)) {
      riggingFree[cat] = 2;
    }
  }
  let total = 0;
  for (const cid of carriedSet) {
    const item = byId[cid];
    if (!item) continue;
    const load = Number(item.load) || 0;
    if (load <= 0) continue;
    const cat = String(item.category || "other").toLowerCase();
    if (riggingFree[cat] > 0) {
      riggingFree[cat] -= 1;
      continue;
    }
    total += load;
  }
  if (carryCoin && coinFilled > 0) {
    total += Math.max(0, Math.floor(coinFilled));
  }
  return total;
}

export function characterHasAbility(abilities, name) {
  const target = String(name || "").toLowerCase();
  return (abilities || []).some(
    (a) =>
      a?.type === "standard" &&
      String(a?.name || "").toLowerCase() === target,
  );
}

export function inventoryHasPhysicalArmor(inventory = []) {
  return inventoryPhysicalArmorCharges(inventory) > 0;
}

export const ARMOR_KIND_OPTIONS = [
  { value: "standard", label: "Armor", charges: 1, pool: "physical" },
  { value: "heavy", label: "Heavy Armor", charges: 2, pool: "physical" },
  {
    value: "special",
    label: "Special Armor",
    charges: 1,
    pool: "special",
  },
];

export function normalizeArmorKind(item) {
  const k = String(item?.armor_kind || "").toLowerCase();
  if (k === "standard" || k === "heavy" || k === "special") return k;
  if (item?.is_armor) return "standard";
  return null;
}

export function isArmorInventoryItem(item) {
  return normalizeArmorKind(item) != null;
}

export function armorKindLabel(kind) {
  const k = normalizeArmorKind({ armor_kind: kind, is_armor: kind === "standard" });
  const hit = ARMOR_KIND_OPTIONS.find((o) => o.value === k);
  return hit?.label || "Armor";
}

export function armorChargesForItem(item) {
  const k = normalizeArmorKind(item);
  if (k === "heavy") return 2;
  if (k === "standard") return 1;
  return 0;
}

export function inventoryPhysicalArmorCharges(inventory = []) {
  return normalizeInventoryKitList(inventory).reduce(
    (sum, item) => sum + armorChargesForItem(item),
    0,
  );
}

/** Physical pool split for separate Armor vs Heavy Armor rows. */
export function normalizeInventoryKitItem(raw) {
  if (typeof raw === "string") {
    const name = raw.trim();
    if (!name) return null;
    return normalizeInventoryKitItem({
      id: `item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      name,
      detail: "",
      category: "other",
      load: 1,
      quality: 1,
      is_armor: false,
      armor_kind: "",
    });
  }
  if (!raw || typeof raw !== "object") return null;
  const kind = normalizeArmorKind(raw);
  const isPhysical = kind === "standard" || kind === "heavy";
  return {
    ...raw,
    id: raw.id != null ? String(raw.id) : raw.id,
    name: String(raw.name || "Item").trim() || "Item",
    armor_kind: kind || "",
    is_armor: isPhysical,
    load: isPhysical ? 0 : Math.max(0, Math.min(2, Number(raw.load) || 0)),
  };
}

export function normalizeInventoryKitList(inv) {
  const list = Array.isArray(inv) ? inv : inv != null && typeof inv === "object" ? [inv] : [];
  return list.map(normalizeInventoryKitItem).filter(Boolean);
}

/** Inventory armor rows for the sheet ARMOR panel (gear only). */
export function inventoryArmorEntries(inventory = []) {
  const entries = [];
  for (const item of normalizeInventoryKitList(inventory)) {
    const kind = normalizeArmorKind(item);
    if (kind === "standard") {
      entries.push({ item, kind, pool: "physical", charges: 1 });
    } else if (kind === "heavy") {
      entries.push({ item, kind, pool: "physical", charges: 2 });
    } else if (kind === "special") {
      entries.push({ item, kind, pool: "special", charges: 1 });
    }
  }
  return entries;
}

export function inventoryPhysicalArmorByKind(inventory = []) {
  let standard = 0;
  let heavy = 0;
  for (const item of normalizeInventoryKitList(inventory)) {
    const k = normalizeArmorKind(item);
    if (k === "standard") standard += 1;
    else if (k === "heavy") heavy += 2;
  }
  return { standard, heavy, total: standard + heavy };
}

export function inventorySpecialArmorCount(inventory = []) {
  return normalizeInventoryKitList(inventory).filter(
    (item) => normalizeArmorKind(item) === "special",
  ).length;
}

export function inventoryHasSpecialArmor(inventory = []) {
  return inventorySpecialArmorCount(inventory) > 0;
}

export function inventorySpecialArmorItems(inventory = []) {
  return normalizeInventoryKitList(inventory).filter(
    (item) => normalizeArmorKind(item) === "special",
  );
}

export function newInventoryItemDraft(partial = {}) {
  return {
    id: crypto.randomUUID?.() || `item-${Date.now()}`,
    name: "",
    detail: "",
    category: "other",
    load: 1,
    quality: 1,
    coin_value: null,
    catalog_id: null,
    is_armor: false,
    armor_kind: "",
    ...partial,
  };
}

export function newArmorItemDraft(partial = {}) {
  return {
    id: crypto.randomUUID?.() || `item-${Date.now()}`,
    name: "",
    detail: "",
    category: "gear",
    load: 0,
    quality: 1,
    coin_value: null,
    catalog_id: null,
    is_armor: true,
    armor_kind: "standard",
    ...partial,
  };
}

export function catalogItemToKitRow(catalogItem) {
  if (!catalogItem) return newInventoryItemDraft();
  return {
    id: crypto.randomUUID?.() || `item-${Date.now()}`,
    name: catalogItem.name || "",
    detail: catalogItem.description || "",
    category: catalogItem.category || "other",
    load: Number(catalogItem.load_slots) || 1,
    quality: Number(catalogItem.quality) || 1,
    coin_value: catalogItem.coin_value ?? null,
    catalog_id: catalogItem.id ?? null,
  };
}

function _catalogIdNum(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function _catalogNameKey(value) {
  return String(value || "").trim().toLowerCase();
}

/** Match kit row to catalog: id first, else same name (prefer TEMPLATE, then SITE). */
export function catalogRowsForKitItem(item, catalogItems = []) {
  if (!item) return [];
  const list = Array.isArray(catalogItems) ? catalogItems : [];
  const cid = _catalogIdNum(item.catalog_id);
  if (cid != null) {
    const byId = list.filter((row) => Number(row?.id) === cid);
    if (byId.length) return byId;
  }
  const name = _catalogNameKey(item.name);
  if (!name) return [];
  return list.filter((row) => _catalogNameKey(row?.name) === name);
}

function _strongestCatalogScope(rows) {
  let best = null;
  for (const row of rows) {
    const s = String(row?.scope || "").toUpperCase();
    if (s === "TEMPLATE") return "TEMPLATE";
    if (s === "SITE") best = "SITE";
    else if (s === "CAMPAIGN" && best !== "SITE") best = "CAMPAIGN";
  }
  return best;
}

/**
 * Custom kit rows can be saved. Hide when this name/id is already a campaign
 * library, site, or SRD template entry (do not clone Demolition Tools).
 */
export function kitItemCanSaveToCampaignLibrary(item, catalogItems = []) {
  if (!_catalogNameKey(item?.name)) return false;
  const scope = _strongestCatalogScope(catalogRowsForKitItem(item, catalogItems));
  if (scope === "TEMPLATE" || scope === "SITE" || scope === "CAMPAIGN") {
    return false;
  }
  if (_catalogIdNum(item.catalog_id) != null) return false;
  return true;
}

/**
 * Custom and campaign-library rows can publish. Hide for SRD TEMPLATE and
 * already-SITE items so base game kits are not double-saved.
 */
export function kitItemCanPublishToSiteCatalog(item, catalogItems = []) {
  if (!_catalogNameKey(item?.name)) return false;
  const scope = _strongestCatalogScope(catalogRowsForKitItem(item, catalogItems));
  return scope !== "TEMPLATE" && scope !== "SITE";
}
