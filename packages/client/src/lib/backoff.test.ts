import { describe, expect, it } from "vitest";
import { reconnectDelay } from "./backoff";

describe("reconnectDelay", () => {
  it("doubles with every attempt", () => {
    const full = () => 1;
    expect([0, 1, 2, 3].map((attempt) => reconnectDelay(attempt, full))).toEqual([1000, 2000, 4000, 8000]);
  });

  it("stops growing at 30 seconds", () => {
    expect(reconnectDelay(20, () => 1)).toBe(30_000);
  });

  it("takes off at most a quarter for jitter", () => {
    expect(reconnectDelay(2, () => 0)).toBe(3000);
  });
});
