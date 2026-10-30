import { describe, expect, it } from "vitest";
import { arrowHead, distanceToDrawing, drawingAt } from "./drawings";

describe("drawing hit test", () => {
  it("measures the distance to lines, rectangles, circles and pins", () => {
    expect(distanceToDrawing({ kind: "line", points: [0, 0, 100, 0] }, { x: 50, y: 10 })).toBe(10);
    expect(distanceToDrawing({ kind: "free", points: [0, 0, 10, 0, 10, 10] }, { x: 12, y: 5 })).toBe(2);
    expect(distanceToDrawing({ kind: "rect", points: [0, 0, 100, 100] }, { x: 50, y: 50 })).toBe(50);
    expect(distanceToDrawing({ kind: "circle", points: [0, 0, 10, 0] }, { x: 0, y: 13 })).toBe(3);
    expect(distanceToDrawing({ kind: "note", points: [5, 5] }, { x: 8, y: 9 })).toBe(5);
  });

  it("picks the topmost drawing within reach", () => {
    const drawings = [
      { id: "a", kind: "line" as const, points: [0, 0, 100, 0] },
      { id: "b", kind: "line" as const, points: [0, 2, 100, 2] },
    ];
    expect(drawingAt(drawings, { x: 50, y: 1 }, 4)?.id).toBe("b");
    expect(drawingAt(drawings, { x: 50, y: 40 }, 4)).toBeNull();
  });

  it("draws arrow heads pointing back from the tip", () => {
    const [left, right] = arrowHead({ x: 0, y: 0 }, { x: 100, y: 0 }, 10);
    expect(left.x).toBeLessThan(100);
    expect(right.x).toBeLessThan(100);
    expect(left.y).toBeCloseTo(-right.y);
  });
});
