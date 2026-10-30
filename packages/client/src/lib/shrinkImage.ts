/** Tokens are drawn a few hundred pixels wide at most; anything bigger only costs memory and download time. */
export const TOKEN_IMAGE_MAX_SIDE = 512;

/** The size that fits `width` x `height` inside a square of `max`, never enlarging. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Downscales an image to fit `max` pixels, as WebP so transparency survives. Small images and anything the browser
 * cannot decode or re-encode are returned untouched, so shrinking can never block an upload.
 */
export async function shrinkImage(file: Blob, max = TOKEN_IMAGE_MAX_SIDE): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
    if (width === bitmap.width && height === bitmap.height) return file;
    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
    const shrunk = await canvas.convertToBlob({ type: "image/webp", quality: 0.9 });
    return shrunk.type === "image/webp" && shrunk.size < file.size ? shrunk : file;
  } catch {
    return file;
  }
}
