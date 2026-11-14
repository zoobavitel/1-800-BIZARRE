import { userCanEditNpcSheet } from "./CharacterPage";

// The NPC sheet's save data has the NPC id but no creator. The save check
// must still let the creator save, using the NPC record the page loaded.
const owner = { id: 7 };
const sheetPayload = { id: 41, name: "Loner", campaign: null };
const loadedRecord = { id: 41, name: "Loner", campaign: null, creator: 7 };

describe("NPC save permission", () => {
  test("the creator can save their own NPC that has no campaign", () => {
    expect(userCanEditNpcSheet(owner, sheetPayload, [], loadedRecord)).toBe(
      true,
    );
  });

  test("another user still can't save someone else's NPC with no campaign", () => {
    expect(
      userCanEditNpcSheet({ id: 8 }, sheetPayload, [], loadedRecord),
    ).toBe(false);
  });

  test("the campaign GM can save a campaign NPC they didn't create", () => {
    const campaigns = [{ id: 3, gm: { id: 9 } }];
    const npc = { id: 50, campaign: 3 };
    expect(
      userCanEditNpcSheet({ id: 9 }, npc, campaigns, { ...npc, creator: 7 }),
    ).toBe(true);
  });

  test("a new NPC (no id yet) can be created", () => {
    expect(userCanEditNpcSheet(owner, { name: "New" }, [], null)).toBe(true);
  });
});
