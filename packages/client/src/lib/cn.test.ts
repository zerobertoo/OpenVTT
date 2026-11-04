import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { cn, FONT_SIZE_NAMES } from "./cn";

describe("cn", () => {
  it("lists exactly the font sizes declared in styles.css", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
    const declared = [...css.matchAll(/--text-([a-z]+):\s*[\d.]+rem/g)].map((match) => match[1]);
    expect([...FONT_SIZE_NAMES].sort()).toEqual([...declared].sort());
  });

  it("keeps a custom font size together with a text color", () => {
    expect(cn("text-caption", "text-on-chrome-2")).toBe("text-caption text-on-chrome-2");
  });
});
