const SAFE_DATA_IMAGE_SRC =
  /^data:image\/(?:avif|gif|jpe?g|png|webp);base64,[a-z0-9+/=\s]+$/i;

/** Allow only http(s), blob:, or safe raster data: URLs for home card images. */
export function sanitizeHomeImageSrc(src) {
  const value = typeof src === "string" ? src.trim() : "";
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("blob:")) return value;
  if (SAFE_DATA_IMAGE_SRC.test(value)) return value;
  return "";
}
