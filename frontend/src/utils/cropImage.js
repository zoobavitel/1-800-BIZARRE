/**
 * Load an image for canvas crop. Sets crossOrigin for remote URLs so same-origin
 * /media and CORS-enabled hosts can export; blob:/data: need no CORS flag.
 */
function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const src = String(url || "");
    if (/^https?:\/\//i.test(src)) {
      image.crossOrigin = "anonymous";
    }
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (e) =>
      reject(e?.error || new Error("Failed to load image for crop")),
    );
    image.src = src;
  });
}

/**
 * Bake a square crop from react-easy-crop pixel area into a Blob.
 * @param {string} imageSrc
 * @param {{ x: number, y: number, width: number, height: number }} croppedAreaPixels
 * @param {number} [size=256]
 * @returns {Promise<Blob>}
 */
export async function getCroppedImg(imageSrc, croppedAreaPixels, size = 256) {
  if (!croppedAreaPixels || !(croppedAreaPixels.width > 0)) {
    throw new Error("No crop area selected.");
  }
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const out = Math.max(32, Math.min(1024, Number(size) || 256));
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");

  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    out,
    out,
  );

  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(
              new Error(
                "Could not export crop. Upload the image to crop it.",
              ),
            );
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        0.92,
      );
    } catch (err) {
      // Tainted canvas (CORS) throws SecurityError on toBlob in some browsers.
      reject(
        new Error(
          err?.name === "SecurityError" || /taint|security/i.test(String(err))
            ? "Upload the image to crop it."
            : err?.message || "Could not export crop.",
        ),
      );
    }
  });
}

/** Turn crop Blob into a File suitable for multipart avatar upload. */
export function croppedBlobToFile(blob, filename = "avatar.jpg") {
  return new File([blob], filename, {
    type: blob.type || "image/jpeg",
    lastModified: Date.now(),
  });
}
