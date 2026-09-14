import {
  getNpcPortraitReplacementFailureState,
  getNpcPortraitSavedState,
} from "./NPCSheet";

describe("NPCSheet portrait state helpers", () => {
  test("failed replacement restores the last persisted preview and clears pending state", () => {
    expect(
      getNpcPortraitReplacementFailureState("/media/npcs/persisted.png"),
    ).toEqual({
      imageFile: null,
      imagePreview: "/media/npcs/persisted.png",
      portraitPreviewError: false,
    });
  });

  test("successful replacement save prefers the persisted path from the response", () => {
    expect(
      getNpcPortraitSavedState(
        { image: "/media/npcs/new.png" },
        "/media/npcs/old.png",
      ),
    ).toEqual({
      imageFile: null,
      imageUrl: "/media/npcs/new.png",
      imagePreview: "/media/npcs/new.png",
    });
  });

  test("successful replacement save falls back to the last persisted path when omitted", () => {
    expect(getNpcPortraitSavedState({}, "/media/npcs/existing.png")).toEqual({
      imageFile: null,
      imageUrl: "/media/npcs/existing.png",
      imagePreview: "/media/npcs/existing.png",
    });
  });
});
