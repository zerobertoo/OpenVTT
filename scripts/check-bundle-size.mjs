// Fails when a client chunk grows past its gzip budget. Run after `pnpm build`.
// Budgets are ceilings with some headroom over today's size; raise one only on purpose, in the commit that needs it.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const dist = join(import.meta.dirname, "../packages/client/dist");
const assets = join(dist, "assets");

/** Gzip size in KB of the first chunk whose file name matches. */
function gzipKb(namePattern) {
  const file = readdirSync(assets).find((name) => namePattern.test(name));
  if (!file) throw new Error(`No chunk matching ${namePattern} in ${assets}; did the build run?`);
  return { file, kb: gzipSync(readFileSync(join(assets, file))).length / 1024 };
}

// The entry chunk is what the sign-in screen downloads; the table chunk (PixiJS, motion) loads only on /world/*.
const budgets = [
  { label: "sign-in entry", pattern: /^index-.*\.js$/, maxKb: 190 },
  { label: "table (lazy)", pattern: /^Table-.*\.js$/, maxKb: 220 },
  // Three.js for the solid dice; downloaded only when a roll is thrown with them.
  { label: "3D dice (lazy)", pattern: /^Dice3D-.*\.js$/, maxKb: 130 },
];

let failed = false;
for (const { label, pattern, maxKb } of budgets) {
  const { file, kb } = gzipKb(pattern);
  const ok = kb <= maxKb;
  failed ||= !ok;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}: ${kb.toFixed(1)} KB gzip (budget ${maxKb} KB) [${file}]`);
}
process.exit(failed ? 1 : 0);
