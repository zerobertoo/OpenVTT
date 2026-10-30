import { TOKEN_CONDITIONS } from "@openvtt/shared";
import { describe, expect, it } from "vitest";
import { CONDITION_GLYPHS, healthColor, healthRatio } from "./tokenStatus";

describe("token status", () => {
  it("keeps the health ratio between empty and full", () => {
    expect(healthRatio(15, 30)).toBe(0.5);
    expect(healthRatio(-4, 30)).toBe(0);
    expect(healthRatio(50, 30)).toBe(1);
  });

  it("turns from green to amber to red as hit points drop", () => {
    expect(healthColor(1)).toBe(0x3ddc84);
    expect(healthColor(0.5)).toBe(0xffb000);
    expect(healthColor(0.1)).toBe(0xff4d4d);
  });

  it("has a picture for every condition", () => {
    for (const id of TOKEN_CONDITIONS) expect(CONDITION_GLYPHS[id]).toBeTruthy();
  });
});
