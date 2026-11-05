import { describe, expect, it } from "vitest";
import {
  assetIdsInUse,
  draggedCenter,
  dropToken,
  extendSketch,
  isDeliberateStroke,
  rulerReadout,
  tokenCenter,
  tokensInBox,
  zoomAtCursor,
} from "./mapInteraction";

const scene = { id: "s1", gridType: "square", gridSize: 70 };
const token = (id: string, x: number, y: number, size = 1, sceneId = "s1") => ({ id, sceneId, x, y, size });

describe("tokensInBox", () => {
  it("selects the tokens of the scene whose centre falls inside the box, whichever way it was dragged", () => {
    const tokens = [token("inside", 0, 0), token("edge-out", 100, 0), token("far", 500, 500)];
    // `inside` has its centre at (35, 35); `edge-out` at (135, 35).
    expect(tokensInBox(tokens, scene, { x: 0, y: 0 }, { x: 100, y: 100 })).toEqual(["inside"]);
    expect(tokensInBox(tokens, scene, { x: 100, y: 100 }, { x: 0, y: 0 })).toEqual(["inside"]);
  });

  it("counts the box edge as inside and scales the centre with the token size", () => {
    expect(tokensInBox([token("big", 0, 0, 2)], scene, { x: 70, y: 70 }, { x: 70, y: 70 })).toEqual(["big"]);
  });

  it("ignores tokens that belong to another scene", () => {
    expect(tokensInBox([token("other", 0, 0, 1, "s2")], scene, { x: 0, y: 0 }, { x: 100, y: 100 })).toEqual([]);
  });
});

describe("rulerReadout", () => {
  const cells = (n: number) => `${n} cells`;
  const start = { x: 0, y: 0 };

  it("shows the straight distance in cells for a circle and a cone", () => {
    expect(rulerReadout("circle", start, { x: 210, y: 0 }, scene, "exact", cells)).toBe("3 cells");
    expect(rulerReadout("cone", start, { x: 0, y: 140 }, scene, "exact", cells)).toBe("2 cells");
  });

  it("shows both sides of a rectangle, ignoring the drag direction", () => {
    expect(rulerReadout("rectangle", start, { x: -140, y: -70 }, scene, "exact", cells)).toBe("2 cells × 1 cells");
  });

  it("measures a line by the table's diagonal rule", () => {
    const end = { x: 210, y: 210 };
    expect(rulerReadout("line", start, end, scene, "simple", cells)).toBe("3 cells");
    expect(rulerReadout("line", start, end, scene, "alternating", cells)).toBe("4 cells");
  });

  it("reads zero without a scene", () => {
    expect(rulerReadout("line", start, { x: 70, y: 0 }, null, "exact", cells)).toBe("0 cells");
    expect(rulerReadout("circle", start, { x: 70, y: 0 }, null, "exact", cells)).toBe("0 cells");
  });
});

describe("extendSketch", () => {
  it("adds a free-hand point only once it is a few screen pixels from the last one", () => {
    const sketch = [0, 0];
    // At scale 2, 1 map unit is 2 screen pixels: 1.5 units = 3 px is too close, 2 units = 4 px is enough.
    expect(extendSketch(sketch, "free", { x: 1.5, y: 0 }, 2)).toEqual([0, 0]);
    expect(extendSketch(sketch, "free", { x: 2, y: 0 }, 2)).toEqual([0, 0, 2, 0]);
  });

  it("stops growing a free-hand stroke at the server's point limit", () => {
    const full = Array.from({ length: 3998 }, () => 0);
    expect(extendSketch(full, "free", { x: 100, y: 100 }, 1)).toHaveLength(3998);
  });

  it("keeps only the start and the latest point for a shape", () => {
    expect(extendSketch([5, 6, 7, 8], "rect", { x: 20, y: 30 }, 1)).toEqual([5, 6, 20, 30]);
    expect(extendSketch([5, 6], "line", { x: 1, y: 2 }, 1)).toEqual([5, 6, 1, 2]);
  });
});

describe("isDeliberateStroke", () => {
  it("needs two points at least 3 screen pixels apart", () => {
    expect(isDeliberateStroke([0, 0], 1)).toBe(false);
    expect(isDeliberateStroke([0, 0, 2, 0], 1)).toBe(false);
    expect(isDeliberateStroke([0, 0, 3, 0], 1)).toBe(true);
    // Zoomed in, the same map distance is more screen pixels.
    expect(isDeliberateStroke([0, 0, 2, 0], 2)).toBe(true);
  });

  it("judges a free-hand stroke by where it ends, not how far it travelled", () => {
    expect(isDeliberateStroke([0, 0, 50, 0, 0, 1], 1)).toBe(false);
  });
});

describe("zoomAtCursor", () => {
  const view = { scale: 1, x: 100, y: 50 };

  it("keeps the map point under the cursor where it is", () => {
    const cursor = { x: 300, y: 250 };
    const before = { x: (cursor.x - view.x) / view.scale, y: (cursor.y - view.y) / view.scale };
    const next = zoomAtCursor(view, cursor, -200, 0.1, 8);
    expect(next.scale).toBeGreaterThan(1);
    expect(cursor.x - before.x * next.scale).toBeCloseTo(next.x);
    expect(cursor.y - before.y * next.scale).toBeCloseTo(next.y);
  });

  it("zooms in on a negative wheel delta and out on a positive one", () => {
    expect(zoomAtCursor(view, { x: 0, y: 0 }, -100, 0.1, 8).scale).toBeCloseTo(Math.exp(0.15));
    expect(zoomAtCursor(view, { x: 0, y: 0 }, 100, 0.1, 8).scale).toBeCloseTo(Math.exp(-0.15));
  });

  it("stays within the zoom limits", () => {
    expect(zoomAtCursor({ ...view, scale: 7.9 }, { x: 0, y: 0 }, -5000, 0.1, 8).scale).toBe(8);
    expect(zoomAtCursor({ ...view, scale: 0.11 }, { x: 0, y: 0 }, 5000, 0.1, 8).scale).toBe(0.1);
  });
});

describe("assetIdsInUse", () => {
  it("collects the backgrounds of the floor and the floor below and every token image, without empties or repeats", () => {
    const ids = assetIdsInUse({ assetId: "a" }, { assetId: "b" }, [{ assetId: "c" }, { assetId: null }, { assetId: "a" }]);
    expect([...ids].sort()).toEqual(["a", "b", "c"]);
  });

  it("copes with no floors", () => {
    expect(assetIdsInUse(null, null, [{ assetId: null }]).size).toBe(0);
  });
});

describe("token dragging", () => {
  const goblin = { id: "g", x: 140, y: 70, size: 2 };

  it("centres a token's picture half its size from its corner", () => {
    expect(tokenCenter(goblin, 70)).toEqual({ x: 210, y: 140 });
  });

  it("moves the picture with the pointer from the token's own centre", () => {
    expect(draggedCenter(goblin, { x: 30, y: -20 }, 70)).toEqual({ x: 240, y: 120 });
  });

  it("snaps the corner to the grid on drop and records the move", () => {
    // Centre (250, 190) puts the corner at (180, 120), which snaps to (210, 140).
    expect(dropToken(scene, goblin, { x: 250, y: 190 })).toEqual({
      corner: { x: 210, y: 140 },
      move: { tokenId: "g", from: { x: 140, y: 70 }, to: { x: 210, y: 140 } },
    });
  });

  it("records no move when the token lands where it was", () => {
    expect(dropToken(scene, goblin, { x: 215, y: 143 })).toEqual({ corner: { x: 140, y: 70 }, move: null });
  });

  it("keeps the exact drop position on a map without a grid", () => {
    const free = { id: "f", gridType: "none", gridSize: 70 };
    expect(dropToken(free, { id: "t", x: 0, y: 0, size: 1 }, { x: 100.5, y: 60.25 }).corner).toEqual({ x: 65.5, y: 25.25 });
  });
});
