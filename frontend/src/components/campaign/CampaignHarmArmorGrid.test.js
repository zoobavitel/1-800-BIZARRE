import {
  characterOwnerUserId,
  harmCardEditable,
} from "./CampaignHarmArmorGrid";

describe("harmCardEditable", () => {
  test("GM can edit any character", () => {
    expect(
      harmCardEditable({
        isGM: true,
        userId: 1,
        character: { id: 9, user_id: 2 },
        forceReadOnly: false,
      }),
    ).toBe(true);
  });

  test("player can edit own character via user_id", () => {
    expect(
      harmCardEditable({
        isGM: false,
        userId: 7,
        character: { id: 9, user_id: 7 },
        forceReadOnly: false,
      }),
    ).toBe(true);
  });

  test("player cannot edit another character", () => {
    expect(
      harmCardEditable({
        isGM: false,
        userId: 7,
        character: { id: 9, user: { id: 3 } },
        forceReadOnly: false,
      }),
    ).toBe(false);
  });

  test("forceReadOnly blocks even GM", () => {
    expect(
      harmCardEditable({
        isGM: true,
        userId: 1,
        character: { id: 9, user_id: 1 },
        forceReadOnly: true,
      }),
    ).toBe(false);
  });

  test("characterOwnerUserId reads nested user", () => {
    expect(characterOwnerUserId({ user: { id: 42 } })).toBe(42);
    expect(characterOwnerUserId({ user_id: 11 })).toBe(11);
    expect(characterOwnerUserId({ user: 5 })).toBe(5);
  });
});
