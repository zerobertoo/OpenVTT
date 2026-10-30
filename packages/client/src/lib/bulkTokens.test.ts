import { describe, expect, it } from "vitest";
import { bulkPosition, tokenNameFromFile } from "./bulkTokens";

describe("tokenNameFromFile", () => {
  it("drops the extension and turns separators into spaces", () => {
    expect(tokenNameFromFile("goblin_archer-02.png")).toBe("goblin archer 02");
  });

  it("never returns an empty name", () => {
    expect(tokenNameFromFile("___.webp")).toBe("Token");
  });
});

describe("bulkPosition", () => {
  const scene = { width: 500, gridSize: 100 };

  it("walks along a row and wraps at the map's edge", () => {
    expect(bulkPosition(0, scene)).toEqual({ x: 100, y: 100 });
    expect(bulkPosition(3, scene)).toEqual({ x: 400, y: 100 });
    expect(bulkPosition(4, scene)).toEqual({ x: 100, y: 200 });
  });

  it("still places tokens on a map narrower than three cells", () => {
    expect(bulkPosition(1, { width: 150, gridSize: 100 })).toEqual({ x: 100, y: 200 });
  });
});
