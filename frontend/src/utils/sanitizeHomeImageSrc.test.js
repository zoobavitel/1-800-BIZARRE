import { sanitizeHomeImageSrc } from "./sanitizeHomeImageSrc";

describe("sanitizeHomeImageSrc", () => {
  test("allows http(s) and blob URLs", () => {
    expect(sanitizeHomeImageSrc("https://example.com/a.png")).toBe(
      "https://example.com/a.png",
    );
    expect(sanitizeHomeImageSrc("http://example.com/a.png")).toBe(
      "http://example.com/a.png",
    );
    expect(sanitizeHomeImageSrc("blob:https://example.com/uuid")).toBe(
      "blob:https://example.com/uuid",
    );
  });

  test("allows safe raster data URLs", () => {
    const data =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    expect(sanitizeHomeImageSrc(data)).toBe(data);
  });

  test("rejects empty, javascript, and svg data URLs", () => {
    expect(sanitizeHomeImageSrc("")).toBe("");
    expect(sanitizeHomeImageSrc(null)).toBe("");
    expect(sanitizeHomeImageSrc("javascript:alert(1)")).toBe("");
    expect(sanitizeHomeImageSrc("data:image/svg+xml;base64,PHN2Zz4=")).toBe(
      "",
    );
  });
});
