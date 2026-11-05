import { resolve } from "node:path";
import { buildApp } from "./app.ts";

/** Reads a positive integer from the environment; unset means "use the default", anything else invalid aborts startup. */
function positiveIntFromEnv(name: string): number | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer, got "${raw}"`);
  return value;
}

const port = positiveIntFromEnv("PORT") ?? 3000;
if (port > 65535) throw new Error(`PORT must be at most 65535, got "${port}"`);
const app = buildApp({
  dbPath: resolve(process.env.OPENVTT_DB ?? "data/openvtt.db"),
  clientDir: resolve(import.meta.dirname, "../../client/dist"),
  maxVideoBytes: positiveIntFromEnv("OPENVTT_MAX_VIDEO_BYTES"),
  secureCookies: process.env.OPENVTT_SECURE_COOKIES === "1",
  trustProxy: process.env.OPENVTT_TRUST_PROXY === "1",
  registrationsPerMinute: positiveIntFromEnv("OPENVTT_REGISTRATIONS_PER_MINUTE"),
  maxWorldsPerUser: positiveIntFromEnv("OPENVTT_MAX_WORLDS_PER_USER"),
  maxWorldAssetBytes: positiveIntFromEnv("OPENVTT_MAX_WORLD_ASSET_BYTES"),
  backupIntervalHours: positiveIntFromEnv("OPENVTT_BACKUP_INTERVAL_HOURS"),
  backupKeep: positiveIntFromEnv("OPENVTT_BACKUP_KEEP"),
});

await app.listen({ port, host: process.env.HOST ?? "0.0.0.0" });
console.log(`OpenVTT listening on http://localhost:${port}`);

// Docker and process managers stop the container with SIGTERM; closing cleanly flushes the database before exit.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    console.log(`${signal} received, shutting down`);
    // Safety net in case something keeps the process alive after close.
    setTimeout(() => process.exit(1), 10_000).unref();
    app.close().then(
      () => process.exit(0),
      (error) => {
        console.error("Shutdown failed", error);
        process.exit(1);
      },
    );
  });
}
