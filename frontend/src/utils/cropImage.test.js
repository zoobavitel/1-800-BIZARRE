/**
 * @jest-environment jsdom
 */

import { croppedBlobToFile } from "./cropImage";

describe("croppedBlobToFile", () => {
  test("wraps blob as jpeg File with default name", () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
    const file = croppedBlobToFile(blob);
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("avatar.jpg");
    expect(file.type).toBe("image/jpeg");
  });
});
