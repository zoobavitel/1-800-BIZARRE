import { getCharacterPortraitSrc, getUserAvatarSrc } from "./homeAvatar";

jest.mock("../features/character-sheet/services/api", () => ({
  resolveMediaUrl: (path) => {
    const s = String(path || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("/")) return `https://api.example.com${s}`;
    return `https://api.example.com/${s}`;
  },
}));

describe("getCharacterPortraitSrc", () => {
  test("prefers resolved upload over image_url", () => {
    expect(
      getCharacterPortraitSrc({
        image: "/media/character_images/a.jpg",
        image_url: "https://cdn.example.com/b.png",
      }),
    ).toBe("https://api.example.com/media/character_images/a.jpg");
  });

  test("uses HTTPS image_url when no upload", () => {
    expect(
      getCharacterPortraitSrc({
        image_url: "https://cdn.example.com/pc.png",
      }),
    ).toBe("https://cdn.example.com/pc.png");
  });
});

describe("getUserAvatarSrc", () => {
  test("resolves uploaded profile avatar via API host", () => {
    expect(
      getUserAvatarSrc({
        id: 7,
        profile: { avatar: "/media/avatars/me.jpg" },
      }),
    ).toBe("https://api.example.com/media/avatars/me.jpg");
  });

  test("falls back to campaign PC portrait", () => {
    expect(
      getUserAvatarSrc(
        { id: 42, profile: {} },
        {
          campaignCharacters: [
            {
              user_id: 42,
              image_url: "https://cdn.example.com/ojon.png",
            },
          ],
        },
      ),
    ).toBe("https://cdn.example.com/ojon.png");
  });

  test("account avatar_url wins over PC portrait", () => {
    expect(
      getUserAvatarSrc(
        { id: 1, profile: { avatar_url: "https://cdn.example.com/user.png" } },
        {
          campaignCharacters: [
            { user_id: 1, image_url: "https://cdn.example.com/pc.png" },
          ],
        },
      ),
    ).toBe("https://cdn.example.com/user.png");
  });

  test("respects show_avatars=false", () => {
    expect(
      getUserAvatarSrc({
        id: 1,
        profile: { avatar_url: "https://cdn.example.com/user.png", show_avatars: false },
      }),
    ).toBeNull();
  });
});
