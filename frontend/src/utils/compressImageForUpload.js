/** Match backend CARD_IMAGE_MAX_BYTES (campaign/faction card art). */
export const CARD_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

const DEFAULT_MAX_DIMENSION = 1600;

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image file."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not compress image."));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

/**
 * Downscale/compress raster uploads so card art fits server limits.
 * Returns the original file when already small enough.
 */
export async function compressImageForUpload(
  file,
  {
    maxBytes = CARD_IMAGE_MAX_BYTES,
    maxDimension = DEFAULT_MAX_DIMENSION,
  } = {},
) {
  if (!(file instanceof Blob) || file.size <= maxBytes) {
    return file;
  }

  const image = await loadImageFromFile(file);
  const longest = Math.max(image.naturalWidth, image.naturalHeight, 1);
  const scale = Math.min(1, maxDimension / longest);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");
  ctx.drawImage(image, 0, 0, width, height);

  let quality = 0.88;
  let blob = await canvasToBlob(canvas, "image/jpeg", quality);
  while (blob.size > maxBytes && quality > 0.45) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, "image/jpeg", quality);
  }

  if (blob.size > maxBytes) {
    throw new Error("Image is too large even after compression. Try Crop or a smaller file.");
  }

  const baseName = String(file.name || "photo").replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
