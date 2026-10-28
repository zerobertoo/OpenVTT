import { type ImportedUvtt, parseUvtt, UvttError } from "@openvtt/shared";
import { readMediaSize } from "./media";

/** Largest `.dd2vtt` read into memory; bigger files are refused before parsing. */
export const MAX_UVTT_BYTES = 100 * 1024 * 1024;

export type MapImportErrorCode = "not_uvtt" | "bad_grid" | "too_large" | "no_media" | "unsupported_file";
export type MapImportWarning = "no_walls" | "truncated" | "size_mismatch" | "grid_guessed";

export class MapImportError extends Error {
  constructor(readonly code: MapImportErrorCode) {
    super(code);
  }
}

/** Everything the dialog needs to show a preview and create the scene. */
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
  /** What the Universal VTT file carried, if one was given. */
  uvtt: ImportedUvtt | null;
  warnings: MapImportWarning[];
}

const UVTT_EXTENSION = /\.(dd2vtt|uvtt)$/i;
const MEDIA_EXTENSION = /\.(png|jpe?g|webp|webm|mp4)$/i;
const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  webm: "video/webm",
  mp4: "video/mp4",
};

const stem = (fileName: string) => fileName.replace(/\.[^.]+$/, "");

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

/**
 * Turns what the game master picked into a draft: a Universal VTT file with its sibling picture or video,
 * or just a picture/video whose name may carry the grid. Throws `MapImportError` or the media errors.
 */
export async function prepareMapImport(files: File[]): Promise<MapImportDraft> {
  const uvttFile = files.find((f) => UVTT_EXTENSION.test(f.name));
  const mediaFile = files.map(typedMedia).find((f) => MEDIA_EXTENSION.test(f.name));
  if (!uvttFile && !mediaFile) throw new MapImportError("unsupported_file");

  const warnings: MapImportWarning[] = [];
  let uvtt: ImportedUvtt | null = null;
  if (uvttFile) {
    if (uvttFile.size > MAX_UVTT_BYTES) throw new MapImportError("too_large");
    try {
      uvtt = parseUvtt(await uvttFile.text());
    } catch (error) {
      if (error instanceof UvttError) throw new MapImportError(error.code === "bad_grid" ? "bad_grid" : "not_uvtt");
      throw error;
    }
    warnings.push(...uvtt.warnings.filter((w) => w !== "no_image"));
  }

  // A sibling file wins over the embedded picture: video exports leave `image` empty.
  const media = mediaFile ?? (uvtt?.image ? base64ToBlob(uvtt.image.base64, uvtt.image.mime) : null);
  if (!media) throw new MapImportError("no_media");

  const { width, height } = await readMediaSize(media);
  let gridSize = uvtt?.gridSize ?? 70;
  if (uvtt && (uvtt.width !== width || uvtt.height !== height)) warnings.push("size_mismatch");
  if (!uvtt) {
    const guessed = mediaFile ? parseGridFromName(mediaFile.name, width, height) : null;
    if (guessed) gridSize = guessed;
    else warnings.push("grid_guessed");
  }

  return {
    name:
      stem((uvttFile ?? mediaFile)?.name ?? "Map")
        .trim()
        .slice(0, 80) || "Map",
    media,
    mediaIsVideo: media.type.startsWith("video/"),
    width,
    height,
    gridSize,
    gridDistance: 5,
    distanceUnit: "ft",
    uvtt,
    warnings,
  };
}
