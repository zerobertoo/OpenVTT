import { describe, expect, it } from "vitest";
import { fitWithin, shrinkImage } from "./shrinkImage";

describe("fitWithin", () => {
  it("scales the longest side down to the maximum, keeping the proportions", () => {
    expect(fitWithin(2000, 1000, 500)).toEqual({ width: 500, height: 250 });
    expect(fitWithin(600, 1200, 600)).toEqual({ width: 300, height: 600 });
  });

  it("never enlarges a small image", () => {
    expect(fitWithin(100, 80, 512)).toEqual({ width: 100, height: 80 });
  });
});

describe("shrinkImage", () => {
  it("hands back the original when the browser cannot decode it", async () => {
    const file = new Blob(["not an image"], { type: "image/png" });
    expect(await shrinkImage(file)).toBe(file);
  });
});
