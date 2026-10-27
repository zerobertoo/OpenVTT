import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@openvtt/shared";
import type { Db } from "./db.ts";
import { AppError } from "./errors.ts";

type ImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

const EXTENSIONS: Record<ImageType, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Checks the file signature instead of trusting the declared content type. */
export function detectImageType(buffer: Buffer): ImageType | null {
  if (buffer.length > 12 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length > 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export interface AssetRecord {
  id: string;
  worldId: string;
  mime: ImageType;
  size: number;
  fileName: string;
}

export class AssetService {
  constructor(
    private db: Db,
    private dir: string,
  ) {
    mkdirSync(dir, { recursive: true });
  }

  save(worldId: string, buffer: Buffer): AssetRecord {
    if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) throw new AppError("asset_invalid");
    const mime = detectImageType(buffer);
    if (!mime) throw new AppError("asset_invalid");
    const id = randomUUID();
    const fileName = `${id}.${EXTENSIONS[mime]}`;
    writeFileSync(join(this.dir, fileName), buffer);
    this.db
      .prepare("INSERT INTO assets (id, world_id, mime, size, file_name, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, worldId, mime, buffer.length, fileName, Date.now());
    return { id, worldId, mime, size: buffer.length, fileName };
  }

  find(id: string): AssetRecord | null {
    const row = this.db.prepare("SELECT id, world_id, mime, size, file_name FROM assets WHERE id = ?").get(id) as
      | { id: string; world_id: string; mime: ImageType; size: number; file_name: string }
      | undefined;
    return row ? { id: row.id, worldId: row.world_id, mime: row.mime, size: row.size, fileName: row.file_name } : null;
  }

  read(asset: AssetRecord): Buffer {
    return readFileSync(join(this.dir, asset.fileName));
  }

  /** True when the asset exists and belongs to the world; used to reject cross-world references. */
  belongsToWorld(assetId: string | null, worldId: string): boolean {
    return assetId === null || this.find(assetId)?.worldId === worldId;
  }
}
