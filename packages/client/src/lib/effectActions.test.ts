import type { TokenDto } from "@openvtt/shared";
import { describe, expect, it } from "vitest";
import { effectHits } from "./effectActions";

const scene = { gridSize: 50, width: 1000, height: 1000 };
const token = (patch: Partial<TokenDto>): TokenDto =>
  ({ id: "t1", x: 100, y: 100, size: 1, hp: 10, hpMax: 12, hidden: false, conditions: [], ...patch }) as TokenDto;
const hits = (kind: Parameters<typeof effectHits>[0], at: { x: number; y: number }, radius: number, amount: number, tokens: TokenDto[]) =>
  effectHits(kind, at, radius, amount, tokens, scene).map(({ token: t, changes, moveTo }) => ({
    id: t.id,
    changes,
    ...(moveTo && { moveTo }),
  }));

describe("effectHits", () => {
  it("takes hit points from the token a strike lands on, never below zero", () => {
    expect(hits("bolt", { x: 120, y: 120 }, 0, 4, [token({})])).toEqual([{ id: "t1", changes: { hp: 6 } }]);
    expect(hits("damage", { x: 120, y: 120 }, 0, 40, [token({})])).toEqual([{ id: "t1", changes: { hp: 0 } }]);
  });

  it("heals up to the maximum", () => {
    expect(hits("heal", { x: 120, y: 120 }, 0, 5, [token({})])).toEqual([{ id: "t1", changes: { hp: 12 } }]);
  });

  it("does nothing on an empty spot, to a token without health, or with no damage", () => {
    expect(hits("slash", { x: 500, y: 500 }, 0, 4, [token({})])).toEqual([]);
    expect(hits("slash", { x: 120, y: 120 }, 0, 4, [token({ hp: null, hpMax: null })])).toEqual([]);
    expect(hits("slash", { x: 120, y: 120 }, 0, 0, [token({})])).toEqual([]);
    expect(hits("shield", { x: 120, y: 120 }, 0, 4, [token({})])).toEqual([]);
  });

  it("hides and shows the token for vanish and arrive, only when that changes something", () => {
    expect(hits("vanish", { x: 120, y: 120 }, 0, 0, [token({})])).toEqual([{ id: "t1", changes: { hidden: true } }]);
    expect(hits("arrive", { x: 120, y: 120 }, 0, 0, [token({ hidden: true })])).toEqual([{ id: "t1", changes: { hidden: false } }]);
    expect(hits("arrive", { x: 120, y: 120 }, 0, 0, [token({})])).toEqual([]);
  });

  it("hurts every token an area touches and leaves the others alone", () => {
    const inside = token({ id: "in", x: 150, y: 100 });
    const edge = token({ id: "edge", x: 240, y: 100 });
    const outside = token({ id: "out", x: 400, y: 100 });
    expect(hits("fireball", { x: 150, y: 125 }, 2, 3, [inside, edge, outside])).toEqual([
      { id: "in", changes: { hp: 7 } },
      { id: "edge", changes: { hp: 7 } },
    ]);
  });

  it("adds the condition an area brings once, even without damage", () => {
    expect(hits("poison", { x: 120, y: 120 }, 1, 0, [token({})])).toEqual([{ id: "t1", changes: { conditions: ["poisoned"] } }]);
    expect(hits("frost", { x: 120, y: 120 }, 1, 2, [token({ conditions: ["restrained"] })])).toEqual([{ id: "t1", changes: { hp: 8 } }]);
    expect(hits("quake", { x: 120, y: 120 }, 1, 0, [token({ hp: null })])).toEqual([{ id: "t1", changes: { conditions: ["prone"] } }]);
  });

  it("throws tokens one cell away from the eye of a whirlwind, staying on the map", () => {
    const right = token({ id: "right", x: 200, y: 100 });
    const corner = token({ id: "corner", x: 0, y: 0 });
    const eye = token({ id: "eye", x: 100, y: 100 });
    expect(hits("whirlwind", { x: 125, y: 125 }, 3, 0, [right, corner, eye])).toEqual([
      { id: "right", changes: {}, moveTo: { x: 250, y: 100 } },
    ]);
  });
});
