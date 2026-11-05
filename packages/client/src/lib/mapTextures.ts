import { Texture } from "pixi.js";
import { assetUrl } from "../api";
import { touchLru } from "./lru";
import { closeVideo, openVideo } from "./media";

/** Decoded images kept in GPU memory; past this the least recently used ones not on screen are released. */
const MAX_TEXTURES = 96;
const textureCache = new Map<string, Promise<Texture>>();

/**
 * Pixi cannot infer the parser from our extension-less asset URLs, so decode through an ImageBitmap. A video is
 * reduced to its first frame (`still`): the decoder is released right away, so a faint floor below costs no playback.
 * `inUse` lists the assets on screen, which are never released.
 */
export function loadTexture(assetId: string, inUse: () => Set<string>, still = false): Promise<Texture> {
  const cached =
    textureCache.get(assetId) ??
    (still
      ? openVideo(assetUrl(assetId)).then(async (video) => {
          const bitmap = await createImageBitmap(video);
          closeVideo(video);
          return Texture.from(bitmap);
        })
      : fetch(assetUrl(assetId))
          .then((r) => {
            if (!r.ok) throw new Error(`asset ${assetId}: ${r.status}`);
            return r.blob();
          })
          .then((blob) => createImageBitmap(blob))
          .then((bitmap) => Texture.from(bitmap)));
  touchLru(
    textureCache,
    assetId,
    cached,
    MAX_TEXTURES,
    inUse(),
    (texture) => void texture.then((t) => t.destroy(true)).catch(() => undefined),
  );
  // A failed load must not stay cached, or the picture could never be retried without reloading the page.
  cached.catch(() => {
    if (textureCache.get(assetId) === cached) textureCache.delete(assetId);
  });
  return cached;
}
