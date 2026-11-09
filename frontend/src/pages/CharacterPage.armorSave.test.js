import { normalizeSheetPayloadToFrontend } from "./CharacterPage";
import { transformFrontendToBackend } from "../features/character-sheet/services/api";
import { inventoryPhysicalArmorCharges } from "../features/character-sheet/utils/loadoutUtils";

// The sheet save runs normalizeSheetPayloadToFrontend, then
// transformFrontendToBackend. A field the first step drops is saved as 0.
const saveBody = (payload) =>
  transformFrontendToBackend({
    ...normalizeSheetPayloadToFrontend(payload, []),
    name: "Armor PC",
  });

describe("sheet save keeps every armor count", () => {
  test("a spin armor tick reaches the save body", () => {
    expect(saveBody({ spinArmorUsed: 2 }).spin_armor_used).toBe(2);
  });

  test("a hamon armor tick reaches the save body", () => {
    expect(saveBody({ hamonArmorUsed: 1 }).hamon_armor_used).toBe(1);
  });

  test("a special armor tick reaches the save body", () => {
    const inventory = [
      { id: "s1", name: "Plate", armor_kind: "special" },
      { id: "s2", name: "Shield", armor_kind: "special" },
    ];
    expect(
      saveBody({ specialArmorUsed: 2, inventory }).special_armor_used,
    ).toBe(2);
  });

  test("a stand armor tick still reaches the save body", () => {
    // Durability index 2 (grade C) gives 3 stand armor charges.
    const body = saveBody({ standArmorUsed: 2, standStats: { durability: 2 } });
    expect(body.stand_armor_used).toBe(2);
  });

  // Regular and heavy armor share the physical count. The sheet sends the
  // charges its inventory gives (regular 1, heavy 2) with the count.
  const physicalPayload = (inventory, used) => ({
    inventory,
    hasPhysicalArmorItem: true,
    physicalArmorBonusCharges: inventoryPhysicalArmorCharges(inventory),
    physicalArmorUsed: used,
  });

  test("a regular armor tick reaches the save body", () => {
    const inventory = [{ id: "a1", name: "Vest", armor_kind: "standard" }];
    expect(saveBody(physicalPayload(inventory, 1)).physical_armor_used).toBe(1);
  });

  test("heavy armor ticks reach the save body", () => {
    const inventory = [
      { id: "a1", name: "Vest", armor_kind: "standard" },
      { id: "h1", name: "Plate", armor_kind: "heavy" },
    ];
    expect(saveBody(physicalPayload(inventory, 3)).physical_armor_used).toBe(3);
  });

  test("counts are clamped", () => {
    expect(saveBody({ spinArmorUsed: 9 }).spin_armor_used).toBe(3);
    expect(saveBody({ hamonArmorUsed: -2 }).hamon_armor_used).toBe(0);
  });
});
