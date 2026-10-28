import { type ImportedFoundry, type ImportedUvtt, parseFoundryScene, parseUvtt, UvttError, type UvttWarning } from "@openvtt/shared";
import { readMediaSize } from "./media";

/** Largest map data file read into memory; bigger files are refused before parsing. */
export const MAX_UVTT_BYTES = 100 * 1024 * 1024;

export type MapImportErrorCode = "not_uvtt" | "bad_grid" | "too_large" | "no_media" | "unsupported_file";
export type MapImportWarning = Exclude<UvttWarning, "no_image"> | "size_mismatch" | "grid_guessed";

export class MapImportError extends Error {
  constructor(readonly code: MapImportErrorCode) {
    super(code);
  }
}

/** Everything the dialog needs to show a preview and create a scene. */
export interface MapImportDraft {
  name: string;
  /** The picture or video that becomes the scene background. */
  media: Blob;
  mediaIsVideo: boolean;
  width: number;
  height: number;
  gridSize: number;
  gridDistance: number;
  distanceUnit: string;
  /** Walls, doors and lights from a Universal VTT or Foundry-style file, if one was given. */
  data: ImportedUvtt | ImportedFoundry | null;
  warnings: MapImportWarning[];
  /** Set when several files form the floors of one map (`Tavern_0`, `Tavern_1`); drafts of one map share it. */
  floorKey: string | null;
  floor: number;
}

const UVTT_EXTENSION = /\.(dd2vtt|uvtt)$/i;
const FOUNDRY_EXTENSION = /\.json$/i;
const MEDIA_EXTENSION = /\.(png|jpe?g|webp|webm|mp4)$/i;
const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  webm: "video/webm",
  mp4: "video/mp4",
};

const isFoundry = (data: ImportedUvtt | ImportedFoundry): data is ImportedFoundry => "gridDistance" in data;
const stem = (fileName: string) => fileName.replace(/\.[^.]+$/, "");
const FLOOR_SUFFIX = /[\s_-]*(\d{1,2})$/;

/**
 * Reads the grid from names such as `map_28x38.png` or `Crypt 28 x 38 grid.jpg`: columns x rows must
 * divide the picture into square cells that fit the allowed cell size. Returns pixels per cell, or null.
 */
export function parseGridFromName(fileName: string, width: number, height: number): number | null {
  for (const match of stem(fileName).matchAll(/(?<!\d)(\d{1,3})\s*[x×]\s*(\d{1,3})(?!\d)/gi)) {
    const columns = Number(match[1]);
    const rows = Number(match[2]);
    const cell = width / columns;
    if (columns > 0 && rows > 0 && cell >= 10 && cell <= 500 && Math.abs(cell - height / rows) <= 1) return Math.round(cell);
  }
  return null;
}

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** The browser leaves `File.type` empty for some video files, so fall back to the extension. */
function typedMedia(file: File): File {
  if (file.type) return file;
  const mime = MIME_BY_EXTENSION[file.name.split(".").pop()?.toLowerCase() ?? ""];
  return mime ? new File([file], file.name, { type: mime }) : file;
}

async function readMapData(file: File): Promise<ImportedUvtt | ImportedFoundry> {
  if (file.size > MAX_UVTT_BYTES) throw new MapImportError("too_large");
  try {
    const text = await file.text();
    return UVTT_EXTENSION.test(file.name) ? parseUvtt(text) : parseFoundryScene(text);
  } catch (error) {
    if (error instanceof UvttError) throw new MapImportError(error.code === "bad_grid" ? "bad_grid" : "not_uvtt");
    throw error;
  }
}

/** One scene's worth of files: an optional data file and its picture or video. */
async function prepareOne(dataFile: File | undefined, mediaFile: File | undefined): Promise<MapImportDraft> {
  const warnings: MapImportWarning[] = [];
  const data = dataFile ? await readMapData(dataFile) : null;
  if (data) warnings.push(...data.warnings.filter((w): w is Exclude<UvttWarning, "no_image"> => w !== "no_image"));

  // A sibling file wins over the embedded picture: video exports leave `image` empty.
  const media = mediaFile ?? (data?.image ? base64ToBlob(data.image.base64, data.image.mime) : null);
  if (!media) throw new MapImportError("no_media");

  const { width, height } = await readMediaSize(media);
  let gridSize = data?.gridSize ?? 70;
  if (data && (data.width !== width || data.height !== height)) warnings.push("size_mismatch");
  if (!data) {
    const guessed = mediaFile ? parseGridFromName(mediaFile.name, width, height) : null;
    if (guessed) gridSize = guessed;
    else warnings.push("grid_guessed");
  }

  const fileName = (dataFile ?? mediaFile)?.name ?? "Map";
  const foundry = data && isFoundry(data) ? data : null;
  return {
    name: stem(fileName).replace(/_+/g, " ").trim().slice(0, 80) || "Map",
    media,
    mediaIsVideo: media.type.startsWith("video/"),
    width,
    height,
    gridSize,
    gridDistance: foundry?.gridDistance ?? 5,
    distanceUnit: foundry?.distanceUnit ?? "ft",
    data,
    warnings,
    floorKey: null,
    floor: 0,
  };
}

/**
 * Turns what the game master picked into drafts, one per scene. A map data file (Universal VTT or the JSON of a
 * Foundry-style export) is paired with the picture or video that has the same name; pictures left over become
 * plain maps. Files named `Name_0`, `Name_1`... are the floors of one map and share a `floorKey`.
 * Throws `MapImportError` or the media errors.
 */
export async function prepareMapImports(files: File[]): Promise<MapImportDraft[]> {
  const dataFiles = files.filter((f) => UVTT_EXTENSION.test(f.name) || FOUNDRY_EXTENSION.test(f.name));
  const mediaFiles = files.map(typedMedia).filter((f) => MEDIA_EXTENSION.test(f.name));
  if (dataFiles.length === 0 && mediaFiles.length === 0) throw new MapImportError("unsupported_file");

  const unused = new Set(mediaFiles);
  const take = (dataFile: File) => {
    const sibling = [...unused].find((m) => stem(m.name).toLowerCase() === stem(dataFile.name).toLowerCase());
    // A lone data file and a lone picture belong together even when their names differ.
    const chosen = sibling ?? (dataFiles.length === 1 && mediaFiles.length === 1 ? mediaFiles[0] : undefined);
    if (chosen) unused.delete(chosen);
    return chosen;
  };

  const pairs = dataFiles.map((dataFile) => ({ dataFile, mediaFile: take(dataFile) }));
  const sources = [
    ...pairs,
    ...[...unused].map((mediaFile) => ({ dataFile: undefined as File | undefined, mediaFile: mediaFile as File | undefined })),
  ];
  const drafts = await Promise.all(sources.map((source) => prepareOne(source.dataFile, source.mediaFile)));

  const names = sources.map((source) => stem((source.dataFile ?? source.mediaFile)?.name ?? ""));
  const keys = names.map((n) => n.replace(FLOOR_SUFFIX, "").toLowerCase());
  drafts.forEach((draft, i) => {
    const key = keys[i] ?? "";
    const suffix = FLOOR_SUFFIX.exec(names[i] ?? "")?.[1];
    if (suffix !== undefined && key && keys.filter((k) => k === key).length > 1) {
      draft.floorKey = key;
      draft.floor = Number(suffix);
    }
  });
  return drafts.sort((a, b) => (a.floorKey === b.floorKey ? a.floor - b.floor : 0));
}
