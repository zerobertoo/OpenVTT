import { randomUUID } from "node:crypto";
import {
  closeSync,
  createReadStream,
  createWriteStream,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { type Readable, Transform } from "node:stream";
import {
  type ALLOWED_AUDIO_TYPES,
  type ALLOWED_IMAGE_TYPES,
  type ALLOWED_VIDEO_TYPES,
  type AssetSummaryDto,
  DEFAULT_MAX_VIDEO_BYTES,
  MAX_UPLOAD_BYTES,
} from "@openvtt/shared";
import type { Db } from "./db.ts";
import { AppError } from "./errors.ts";

type ImageType = (typeof ALLOWED_IMAGE_TYPES)[number];
type VideoType = (typeof ALLOWED_VIDEO_TYPES)[number];
type AudioType = (typeof ALLOWED_AUDIO_TYPES)[number];
export type AssetType = ImageType | VideoType | AudioType;

const EXTENSIONS: Record<AssetType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/webm": "webm",
  "video/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
};

/** How many leading bytes are enough to recognise every supported container. */
const SIGNATURE_BYTES = 4096;

/** MP4 brands accepted in the `ftyp` box; HEIC, AVIF, 3GP and friends share the box but are not videos we play. */
const MP4_BRANDS = new Set(["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "dash", "M4V "]);

export const isVideoType = (mime: string): mime is VideoType => mime === "video/webm" || mime === "video/mp4";

/** Checks the file signature instead of trusting the declared content type. */
export function detectImageType(buffer: Buffer): ImageType | null {
  if (buffer.length > 12 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length > 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

/** WebM (EBML magic plus the `webm` doc type, so Matroska files are refused) or MP4 (`ftyp` box with a known brand). */
export function detectVideoType(head: Buffer): VideoType | null {
  if (head.length > 12 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3)
    return head.toString("latin1", 4, 64).includes("webm") ? "video/webm" : null;
  if (head.length > 12 && head.toString("latin1", 4, 8) === "ftyp" && MP4_BRANDS.has(head.toString("latin1", 8, 12))) return "video/mp4";
  return null;
}

/** MP3 (an ID3 tag or an MPEG audio frame header) or Ogg. */
export function detectAudioType(head: Buffer): AudioType | null {
  if (head.length > 4 && head.toString("latin1", 0, 4) === "OggS") return "audio/ogg";
  if (head.length > 4 && (head.toString("latin1", 0, 3) === "ID3" || (head[0] === 0xff && (head[1]! & 0xe0) === 0xe0))) return "audio/mpeg";
  return null;
}

const isStreamedType = (mime: string) => isVideoType(mime) || mime.startsWith("audio/");

/**
 * Pipes `source` through `guard` into a new file. Unlike `stream.pipeline` it never destroys `source` on
 * failure (destroying an HTTP request would drop the connection before the error response can be sent):
 * the rest of the body is simply discarded. Resolves once the file is flushed and closed; on failure
 * the file is already closed, so the caller can delete it.
 */
function copyToFile(source: Readable, guard: Transform, path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const out = createWriteStream(path);
    let failure: Error | null = null;
    const fail = (error: Error) => {
      if (failure) return;
      failure = error;
      source.unpipe(guard);
      source.resume();
      out.destroy();
    };
    source.on("error", fail);
    source.on("close", () => {
      if (!source.readableEnded) fail(new Error("upload aborted"));
    });
    guard.on("error", fail);
    out.on("error", fail);
    out.on("close", () => (failure ? reject(failure) : resolve()));
    source.pipe(guard).pipe(out);
  });
}

/**
 * Parses a single-range `Range` header against a file size (RFC 9110). Returns the inclusive byte
 * range, "unsatisfiable" for a 416, or null when the header is absent, malformed or asks for
 * several ranges (the caller then sends the whole file, which the RFC allows).
 */
export function parseRange(header: string | undefined, size: number): { start: number; end: number } | "unsatisfiable" | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? "");
  if (!match || (match[1] === "" && match[2] === "")) return null;
  let start: number;
  let end: number;
  if (match[1] === "") {
    // Suffix range: the last N bytes.
    const length = Number(match[2]);
    if (length === 0) return "unsatisfiable";
    start = Math.max(0, size - length);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
    if (start >= size) return "unsatisfiable";
    if (end < start) return null;
  }
  return { start, end };
}

export interface AssetRecord {
  id: string;
  worldId: string;
  mime: AssetType;
  size: number;
  fileName: string;
}

export interface AssetLimits {
  maxVideoBytes: number;
}

export class AssetService {
  constructor(
    private db: Db,
    private dir: string,
    private limits: AssetLimits = { maxVideoBytes: DEFAULT_MAX_VIDEO_BYTES },
  ) {
    mkdirSync(dir, { recursive: true });
  }

  /** Largest accepted size for a type of asset. */
  maxBytesFor(mime: AssetType): number {
    return isStreamedType(mime) ? this.limits.maxVideoBytes : MAX_UPLOAD_BYTES;
  }

  listFor(worldId: string): AssetSummaryDto[] {
    return (
      this.db
        .prepare("SELECT id, mime, size, created_at FROM assets WHERE world_id = ? ORDER BY created_at DESC, rowid DESC")
        .all(worldId) as {
        id: string;
        mime: string;
        size: number;
        created_at: number;
      }[]
    ).map((r) => ({ id: r.id, mime: r.mime, size: r.size, createdAt: r.created_at }));
  }

  /** Stores an image held in memory. Videos go through `saveStream`. */
  save(worldId: string, buffer: Buffer): AssetRecord {
    if (buffer.length === 0) throw new AppError("asset_invalid");
    if (buffer.length > MAX_UPLOAD_BYTES) throw new AppError("asset_too_large");
    const mime = detectImageType(buffer);
    if (!mime) throw new AppError("asset_invalid");
    const id = randomUUID();
    const fileName = `${id}.${EXTENSIONS[mime]}`;
    writeFileSync(join(this.dir, fileName), buffer);
    return this.insert(id, worldId, mime, buffer.length, fileName);
  }

  /**
   * Streams a video or an audio file straight to disk without holding it in memory. The type comes from the first
   * bytes and the size is counted as it arrives; on any failure the partial file is removed.
   */
  async saveMediaStream(worldId: string, source: Readable): Promise<AssetRecord> {
    const id = randomUUID();
    const partPath = join(this.dir, `${id}.part`);
    const max = this.limits.maxVideoBytes;
    let size = 0;
    let head = Buffer.alloc(0);
    let mime: VideoType | AudioType | null = null;
    const checkHead = () => {
      mime = detectVideoType(head) ?? detectAudioType(head);
      if (!mime) throw new AppError("asset_invalid");
    };
    const guard = new Transform({
      transform(chunk: Buffer, _encoding, done) {
        try {
          size += chunk.length;
          if (size > max) throw new AppError("asset_too_large");
          if (!mime) {
            head = Buffer.concat([head, chunk]);
            if (head.length >= SIGNATURE_BYTES) checkHead();
          }
          done(null, chunk);
        } catch (error) {
          done(error as Error);
        }
      },
      flush(done) {
        try {
          if (!mime) checkHead();
          done();
        } catch (error) {
          done(error as Error);
        }
      },
    });
    try {
      await copyToFile(source, guard, partPath);
    } catch (error) {
      rmSync(partPath, { force: true });
      throw error instanceof AppError ? error : new AppError("asset_invalid");
    }
    const fileName = `${id}.${EXTENSIONS[mime!]}`;
    renameSync(partPath, join(this.dir, fileName));
    return this.insert(id, worldId, mime!, size, fileName);
  }

  /**
   * Takes ownership of a file already on disk (an import's temp file): the type is detected from its
   * bytes and the file is moved into the asset directory. The source is left alone when this throws.
   */
  adoptFile(worldId: string, sourcePath: string): AssetRecord {
    const size = statSync(sourcePath).size;
    const head = Buffer.alloc(Math.min(size, SIGNATURE_BYTES));
    const fd = openSync(sourcePath, "r");
    try {
      readSync(fd, head, 0, head.length, 0);
    } finally {
      closeSync(fd);
    }
    const mime = detectImageType(head) ?? detectVideoType(head) ?? detectAudioType(head);
    if (!mime || size === 0) throw new AppError("asset_invalid");
    if (size > this.maxBytesFor(mime)) throw new AppError("asset_too_large");
    const id = randomUUID();
    const fileName = `${id}.${EXTENSIONS[mime]}`;
    renameSync(sourcePath, join(this.dir, fileName));
    return this.insert(id, worldId, mime, size, fileName);
  }

  private insert(id: string, worldId: string, mime: AssetType, size: number, fileName: string): AssetRecord {
    this.db
      .prepare("INSERT INTO assets (id, world_id, mime, size, file_name, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, worldId, mime, size, fileName, Date.now());
    return { id, worldId, mime, size, fileName };
  }

  find(id: string): AssetRecord | null {
    const row = this.db.prepare("SELECT id, world_id, mime, size, file_name FROM assets WHERE id = ?").get(id) as
      | { id: string; world_id: string; mime: AssetType; size: number; file_name: string }
      | undefined;
    return row ? { id: row.id, worldId: row.world_id, mime: row.mime, size: row.size, fileName: row.file_name } : null;
  }

  path(asset: AssetRecord): string {
    return join(this.dir, asset.fileName);
  }

  read(asset: AssetRecord): Buffer {
    return readFileSync(this.path(asset));
  }

  /** Opens (part of) the file as a stream; `end` is inclusive, like an HTTP range. */
  open(asset: AssetRecord, range?: { start: number; end: number }) {
    return createReadStream(this.path(asset), range);
  }

  /** True when the asset exists and belongs to the world; used to reject cross-world references. */
  belongsToWorld(assetId: string | null, worldId: string, kind: "image" | "map" | "audio"): boolean {
    if (assetId === null) return true;
    const asset = this.find(assetId);
    if (asset?.worldId !== worldId) return false;
    if (kind === "audio") return asset.mime.startsWith("audio/");
    return asset.mime.startsWith("image/") || (kind === "map" && isVideoType(asset.mime));
  }
}
