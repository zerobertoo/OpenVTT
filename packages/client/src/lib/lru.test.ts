import { expect, it } from "vitest";
import { touchLru } from "./lru";

it("evicts the least recently used entries that are not in use", () => {
  const cache = new Map<string, number>();
  const evicted: number[] = [];
  for (const [i, key] of ["a", "b", "c"].entries()) touchLru(cache, key, i, 3, new Set(), (v) => evicted.push(v));
  touchLru(cache, "a", 0, 3, new Set(), (v) => evicted.push(v));
  touchLru(cache, "d", 3, 3, new Set(["b"]), (v) => evicted.push(v));
  expect([...cache.keys()]).toEqual(["b", "a", "d"]);
  expect(evicted).toEqual([2]);
});
