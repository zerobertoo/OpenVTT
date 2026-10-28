import { describe, expect, it } from "vitest";
import { applyTwoFingerGesture, twoFingerState } from "./gestures";

const view = { scale: 1, x: 0, y: 0 };

describe("twoFingerState", () => {
  it("reports the midpoint and the spread", () => {
    expect(twoFingerState({ x: 0, y: 0 }, { x: 6, y: 8 })).toEqual({ center: { x: 3, y: 4 }, distance: 10 });
  });
});

describe("applyTwoFingerGesture", () => {
  it("zooms around the midpoint so the map point under it does not move", () => {
    const from = twoFingerState({ x: 90, y: 100 }, { x: 110, y: 100 });
    const to = twoFingerState({ x: 80, y: 100 }, { x: 120, y: 100 });
    const next = applyTwoFingerGesture(view, from, to, 0.1, 8);
    expect(next.scale).toBe(2);
    // The map point that was under (100, 100) is still under it.
    expect((100 - next.x) / next.scale).toBeCloseTo(100);
  });

  it("pans when both fingers move together", () => {
    const from = twoFingerState({ x: 10, y: 10 }, { x: 30, y: 10 });
    const to = twoFingerState({ x: 60, y: 40 }, { x: 80, y: 40 });
    expect(applyTwoFingerGesture(view, from, to, 0.1, 8)).toEqual({ scale: 1, x: 50, y: 30 });
  });

  it("keeps the scale inside the limits", () => {
    const from = twoFingerState({ x: 0, y: 0 }, { x: 10, y: 0 });
    const huge = twoFingerState({ x: 0, y: 0 }, { x: 1000, y: 0 });
    const tiny = twoFingerState({ x: 0, y: 0 }, { x: 0.5, y: 0 });
    expect(applyTwoFingerGesture(view, from, huge, 0.1, 8).scale).toBe(8);
    expect(applyTwoFingerGesture(view, from, tiny, 0.1, 8).scale).toBe(0.1);
  });

  it("ignores a gesture that starts with the fingers on top of each other", () => {
    const from = twoFingerState({ x: 5, y: 5 }, { x: 5, y: 5 });
    const to = twoFingerState({ x: 0, y: 0 }, { x: 50, y: 0 });
    expect(applyTwoFingerGesture(view, from, to, 0.1, 8).scale).toBe(1);
  });
});
