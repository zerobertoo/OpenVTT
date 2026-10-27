// Fails when any locale file has a different set of keys than en.json.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "../packages/client/src/i18n");

function flatten(obj, prefix = "") {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === "object" && value !== null ? flatten(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

const keysByLocale = Object.fromEntries(
  readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => [f, new Set(flatten(JSON.parse(readFileSync(join(dir, f), "utf8"))))]),
);

const reference = keysByLocale["en.json"];
let failed = false;
for (const [file, keys] of Object.entries(keysByLocale)) {
  const missing = [...reference].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !reference.has(k));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`${file}: missing [${missing.join(", ")}] extra [${extra.join(", ")}]`);
  }
}
if (failed) process.exit(1);
console.log(`i18n OK: ${Object.keys(keysByLocale).join(", ")}`);
