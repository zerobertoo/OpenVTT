import { resolve } from "node:path";
import { buildApp } from "./app.ts";

/** Reads a positive integer from the environment; unset means "use the default", anything else invalid aborts startup. */
function positiveIntFromEnv(name: string): number | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer (bytes), got "${raw}"`);
  return value;
}

const port = Number(process.env.PORT ?? 3000);
const app = buildApp({
  dbPath: resolve(process.env.OPENVTT_DB ?? "data/openvtt.db"),
  clientDir: resolve(import.meta.dirname, "../../client/dist"),
  maxVideoBytes: positiveIntFromEnv("OPENVTT_MAX_VIDEO_BYTES"),
  secureCookies: process.env.OPENVTT_SECURE_COOKIES === "1",
});

await app.listen({ port, host: process.env.HOST ?? "0.0.0.0" });
console.log(`OpenVTT listening on http://localhost:${port}`);
