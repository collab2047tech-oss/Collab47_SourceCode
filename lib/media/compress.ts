import imageCompression from "browser-image-compression";

/**
 * Compress an image file before uploading to Supabase Storage.
 * Settings: max ~1 MB output, max dimension 1600 px, web-worker enabled.
 * On any error the original file is returned so the upload still succeeds.
 */
export async function compressImage(file: File): Promise<File> {
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      fileType: file.type as string | undefined,
    });
    // imageCompression returns a Blob; wrap in File to preserve the name.
    return new File([compressed], file.name, { type: compressed.type });
  } catch {
    // Best-effort: fall back to original file, never block the user.
    return file;
  }
}

export const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25 MB

export function videoTooLarge(file: File): boolean {
  return file.size > MAX_VIDEO_BYTES;
}
