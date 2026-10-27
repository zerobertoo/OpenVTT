import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";
import {
  type ActorType,
  actorTypeSchema,
  type SheetTemplate,
  type SystemManifest,
  sheetTemplateSchema,
  systemManifestSchema,
} from "@openvtt/sdk";
import { unzipSync } from "fflate";
import { AppError } from "./errors.ts";

export const OPENVTT_VERSION = "0.1.0";
const MAX_PACKAGE_BYTES = 2 * 1024 * 1024;
const SAFE_PATH = /^(system\.json|(templates|locales)\/[A-Za-z0-9_.-]+\.json)$/;

export interface LoadedSystem {
  manifest: SystemManifest;
  templates: Partial<Record<ActorType, SheetTemplate>>;
  strings: Record<string, Record<string, string>>;
}

const parseJson = (text: string | undefined, what: string): unknown => {
  if (text === undefined) throw new Error(`missing ${what}`);
  return JSON.parse(text);
};

/** Validates a package given as {relative path: file text}; throws on any problem. */
export function parseSystemPackage(files: Record<string, string>): LoadedSystem {
  const manifest = systemManifestSchema.parse(parseJson(files["system.json"], "system.json"));
  const templates: LoadedSystem["templates"] = {};
  for (const [type, entry] of Object.entries(manifest.actorTypes)) {
    const path = posix.normalize(entry.template);
    if (!SAFE_PATH.test(path)) throw new Error(`unsafe template path ${entry.template}`);
    templates[actorTypeSchema.parse(type)] = sheetTemplateSchema.parse(parseJson(files[path], path));
  }
  const strings: LoadedSystem["strings"] = {};
  for (const locale of manifest.locales) {
    const path = `locales/${locale}.json`;
    if (!SAFE_PATH.test(path)) throw new Error(`unsafe locale ${locale}`);
    strings[locale] = parseJson(files[path], path) as Record<string, string>;
  }
  return { manifest, templates, strings };
}

function readPackageDir(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const sub of ["", "templates", "locales"]) {
    const base = join(dir, sub);
    if (!existsSync(base)) continue;
    for (const name of readdirSync(base)) {
      const full = join(base, name);
      if (name.endsWith(".json") && statSync(full).isFile()) files[posix.join(sub, name)] = readFileSync(full, "utf8");
    }
  }
  return files;
}

/** Systems shipped with the app plus those installed by the admin into the data directory. */
export class SystemRegistry {
  private systems = new Map<string, LoadedSystem>();

  constructor(
    private builtInDir: string,
    private installedDir: string,
  ) {
    for (const dir of [builtInDir, installedDir]) this.loadDirectory(dir);
  }

  private loadDirectory(root: string) {
    if (!existsSync(root)) return;
    for (const name of readdirSync(root)) {
      const dir = join(root, name);
      if (!statSync(dir).isDirectory()) continue;
      try {
        const system = parseSystemPackage(readPackageDir(dir));
        if (!this.systems.has(system.manifest.id)) this.systems.set(system.manifest.id, system);
      } catch (error) {
        console.error(`Skipping invalid system package ${dir}: ${(error as Error).message}`);
      }
    }
  }

  get(id: string): LoadedSystem | undefined {
    return this.systems.get(id);
  }

  list(): SystemManifest[] {
    return [...this.systems.values()].map((s) => s.manifest);
  }

  /** Installs a zipped package (admin only, enforced by the caller). */
  installZip(zip: Buffer): SystemManifest {
    let files: Record<string, string>;
    try {
      const entries = unzipSync(new Uint8Array(zip), { filter: (f) => f.originalSize <= MAX_PACKAGE_BYTES });
      files = {};
      let total = 0;
      for (const [path, data] of Object.entries(entries)) {
        if (path.endsWith("/")) continue;
        if (!SAFE_PATH.test(path)) throw new Error(`unexpected file ${path}`);
        total += data.length;
        if (total > MAX_PACKAGE_BYTES) throw new Error("package too large");
        files[path] = new TextDecoder().decode(data);
      }
    } catch {
      throw new AppError("import_invalid");
    }
    let system: LoadedSystem;
    try {
      system = parseSystemPackage(files);
    } catch {
      throw new AppError("import_invalid");
    }
    if (this.systems.has(system.manifest.id)) throw new AppError("import_invalid");
    const target = join(this.installedDir, system.manifest.id);
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(target, posix.dirname(path)), { recursive: true });
      writeFileSync(join(target, path), text);
    }
    this.systems.set(system.manifest.id, system);
    return system.manifest;
  }
}
