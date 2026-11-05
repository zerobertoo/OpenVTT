import { floorOf, type WorldStateDto } from "@openvtt/shared";
import { assetUrl } from "../api";
import { loadDice3D } from "./dice3dLoader";

/** A file that is slow to arrive holds the person at the door no longer than this. */
const TASK_TIMEOUT_MS = 8000;
const MAX_IMAGES = 60;

/** The pictures the table shows at first: the map of the scene on screen and the tokens standing on it. */
export function tableImages(state: WorldStateDto): string[] {
  const scene = state.scenes.find((s) => s.id === state.activeSceneId);
  if (!scene) return [];
  const floor = floorOf(scene, scene.tableFloorId);
  const ids = new Set<string>();
  if (floor.assetId && floor.assetKind === "image") ids.add(floor.assetId);
  for (const token of state.tokens) if (token.sceneId === scene.id && token.assetId) ids.add(token.assetId);
  return [...ids].slice(0, MAX_IMAGES);
}

const loadImage = (url: string) =>
  new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = image.onerror = () => resolve();
    image.src = url;
  });

/**
 * Downloads what the table needs before it opens: fonts, the 3D dice chunk when solid dice are on, and the first
 * pictures. Never fails: a file that errors or is slow counts as done, because the table still works without it.
 * `onProgress` is told after every finished load.
 */
export async function preloadTable(state: WorldStateDto, solidDice: boolean, onProgress: (done: number, total: number) => void) {
  const loads: Promise<unknown>[] = [document.fonts?.ready ?? Promise.resolve()];
  if (solidDice) loads.push(loadDice3D());
  for (const id of tableImages(state)) loads.push(loadImage(assetUrl(id)));
  let done = 0;
  onProgress(0, loads.length);
  await Promise.all(
    loads.map((load) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const tooSlow = new Promise((resolve) => {
        timer = setTimeout(resolve, TASK_TIMEOUT_MS);
      });
      return Promise.race([load.catch(() => undefined), tooSlow]).then(() => {
        clearTimeout(timer);
        onProgress(++done, loads.length);
      });
    }),
  );
}
