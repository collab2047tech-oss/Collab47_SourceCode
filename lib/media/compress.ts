import imageCompression from "browser-image-compression";

/**
 * Detect Apple HEIC/HEIF images. Browsers cannot decode or display these, so we
 * convert them to JPEG before upload. Match on MIME type (when the browser sets
 * it) and on file extension (desktop Chrome often reports an empty type).
 */
function isHeic(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  if (t === "image/heic" || t === "image/heif") return true;
  return /\.(heic|heif)$/i.test(file.name);
}

/**
 * Convert a HEIC/HEIF file to a JPEG File. heic2any is browser-only and large,
 * so it is dynamically imported the first time it is needed.
 */
async function heicToJpeg(file: File): Promise<File> {
  const { default: heic2any } = await import("heic2any");
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  const blob = Array.isArray(out) ? out[0] : out;
  const name = file.name.replace(/\.(heic|heif)$/i, ".jpg");
  return new File([blob], name, { type: "image/jpeg" });
}

/**
 * Prepare any image for upload: convert HEIC/HEIF -> JPEG, then compress to
 * ~1 MB / 1600 px. Accepts every browser-renderable format (JPEG/PNG/WebP/GIF/
 * AVIF/HEIC...). On any failure the most-usable version we have is returned so
 * the upload still succeeds - we never block the user on a transient error.
 */
export async function compressImage(file: File): Promise<File> {
  let working = file;

  // 1. HEIC/HEIF -> JPEG (so it can be displayed at all).
  if (isHeic(file)) {
    try {
      working = await heicToJpeg(file);
    } catch {
      // Conversion failed - fall through and try to upload the original.
      return file;
    }
  }

  // 2. Animated GIFs must NOT be re-encoded (compression flattens them).
  if ((working.type || "").toLowerCase() === "image/gif") return working;

  // 3. Compress raster images.
  try {
    const compressed = await imageCompression(working, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      // Force JPEG output for broad compatibility unless already PNG/WebP.
      fileType: working.type || "image/jpeg",
    });
    return new File([compressed], working.name, { type: compressed.type });
  } catch {
    return working;
  }
}

/** Alias - clearer name at call sites. */
export const prepareImageForUpload = compressImage;

// ---------------------------------------------------------------------------
// Accept-attribute strings + validation for file <input>s
// ---------------------------------------------------------------------------

/** Broad accept for image inputs - every common format incl. Apple HEIC/HEIF. */
export const IMAGE_ACCEPT =
  "image/*,.heic,.heif,.avif,.webp,.jpg,.jpeg,.png,.gif";

/** Broad accept for video inputs - every common container. */
export const VIDEO_ACCEPT =
  "video/*,.mp4,.mov,.m4v,.webm,.avi,.mkv,.3gp";

export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

export function videoTooLarge(file: File): boolean {
  return file.size > MAX_VIDEO_BYTES;
}
