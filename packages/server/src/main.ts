import { resolve } from "node:path";
import { buildApp } from "./app.ts";

const port = Number(process.env.PORT ?? 3000);
const app = buildApp({
  dbPath: resolve(process.env.OPENVTT_DB ?? "data/openvtt.db"),
  clientDir: resolve(import.meta.dirname, "../../client/dist"),
  secureCookies: process.env.OPENVTT_SECURE_COOKIES === "1",
});

await app.listen({ port, host: process.env.HOST ?? "0.0.0.0" });
console.log(`OpenVTT listening on http://localhost:${port}`);
