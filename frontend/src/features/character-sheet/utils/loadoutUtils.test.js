import {
  computeInventoryLoadUsed,
  computeLoadUsed,
  armorChargesForItem,
  inventoryHasPhysicalArmor,
  inventoryPhysicalArmorCharges,
  inventoryPhysicalArmorByKind,
  inventoryArmorEntries,
  inventoryHasSpecialArmor,
  inventorySpecialArmorCount,
  normalizeInventoryKitList,
  loadBandForUsed,
  loadCapForBand,
  normalizeLoadoutEntry,
} from "./loadoutUtils";

describe("loadoutUtils", () => {
  test("normalizeLoadoutEntry defaults", () => {
    const e = normalizeLoadoutEntry(null);
    expect(e.band).toBe("");
    expect(e.carried_ids).toEqual([]);
  });

  test("loadCapForBand mule", () => {
    expect(loadCapForBand("heavy", false)).toBe(6);
    expect(loadCapForBand("heavy", true)).toBe(8);
  });

  test("loadBandForUsed", () => {
    expect(loadBandForUsed(0)).toBe("");
    expect(loadBandForUsed(2)).toBe("light");
    expect(loadBandForUsed(4)).toBe("normal");
    expect(loadBandForUsed(6)).toBe("heavy");
    expect(loadBandForUsed(8)).toBe("encumbered");
  });

  test("computeLoadUsed counts carried and coin", () => {
    const inv = [
      { id: "a", name: "Gun", load: 1, category: "weapons" },
      { id: "b", name: "Docs", load: 0, category: "documents" },
    ];
    expect(
      computeLoadUsed({
        inventory: inv,
        carriedIds: ["a", "b"],
        carryCoin: true,
        coinFilled: 1,
      }),
    ).toBe(2);
  });

  test("normalizeInventoryKitList resolves legacy is_armor", () => {
    const rows = normalizeInventoryKitList([
      { id: "1", name: "Vest", is_armor: true },
    ]);
    expect(rows[0].armor_kind).toBe("standard");
    expect(inventoryArmorEntries(rows)).toHaveLength(1);
    expect(inventoryArmorEntries(rows)[0].charges).toBe(1);
  });

  test("inventoryHasPhysicalArmor and charges", () => {
    expect(inventoryHasPhysicalArmor([])).toBe(false);
    expect(
      inventoryHasPhysicalArmor([
        { id: "1", name: "Vest", armor_kind: "standard" },
      ]),
    ).toBe(true);
    expect(
      inventoryPhysicalArmorCharges([
        { id: "1", name: "Vest", armor_kind: "standard" },
        { id: "2", name: "Plate", armor_kind: "heavy" },
      ]),
    ).toBe(3);
    expect(armorChargesForItem({ armor_kind: "heavy" })).toBe(2);
    expect(armorChargesForItem({ is_armor: true })).toBe(1);
    expect(inventorySpecialArmorCount([{ armor_kind: "special" }])).toBe(1);
    expect(inventoryHasSpecialArmor([{ armor_kind: "special" }])).toBe(true);
    expect(
      inventoryPhysicalArmorCharges([{ armor_kind: "special" }]),
    ).toBe(0);
    expect(
      inventoryPhysicalArmorByKind([
        { armor_kind: "standard" },
        { armor_kind: "heavy" },
      ]),
    ).toEqual({ standard: 1, heavy: 2, total: 3 });
  });

  test("computeInventoryLoadUsed sums all loaded items", () => {
    const inv = [
      { id: "a", name: "Gun", load: 1, category: "weapons" },
      { id: "b", name: "Rope", load: 2, category: "gear" },
      { id: "c", name: "Note", load: 0, category: "documents" },
    ];
    expect(
      computeInventoryLoadUsed({
        inventory: inv,
        coinFilled: 1,
      }),
    ).toBe(4);
  });
});
