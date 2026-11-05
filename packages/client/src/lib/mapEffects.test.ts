import type { TokenDto } from "@openvtt/shared";
import { describe, expect, it } from "vitest";
import { tokenAt, tokenChangeEffects } from "./mapEffects";

const token = (patch: Partial<TokenDto>): TokenDto => ({ id: "t1", x: 100, y: 200, size: 2, hp: 10, hpMax: 10, ...patch }) as TokenDto;
const previous = (...tokens: TokenDto[]) => new Map(tokens.map((t) => [t.id, t]));

describe("tokenChangeEffects", () => {
  it("shows damage and healing at the middle of the token, with the size of the change", () => {
    expect(tokenChangeEffects(previous(token({})), [token({ hp: 6 })], 50, true)).toEqual([{ kind: "damage", x: 150, y: 250, value: 4 }]);
    expect(tokenChangeEffects(previous(token({ hp: 3 })), [token({ hp: 10 })], 50, true)).toEqual([
      { kind: "heal", x: 150, y: 250, value: 7 },
    ]);
  });

  it("stays quiet for moves and for health the viewer cannot see", () => {
    expect(tokenChangeEffects(previous(token({})), [token({ x: 300 })], 50, true)).toEqual([]);
    expect(tokenChangeEffects(previous(token({ hp: null })), [token({ hp: 4 })], 50, true)).toEqual([]);
  });

  it("makes a new token arrive, unless arrivals are off", () => {
    expect(tokenChangeEffects(previous(), [token({})], 50, true)).toEqual([{ kind: "arrive", x: 150, y: 250 }]);
    expect(tokenChangeEffects(previous(), [token({})], 50, false)).toEqual([]);
  });
});

describe("tokenAt", () => {
  const tokens = [token({ id: "below", x: 0, y: 0, size: 2 }), token({ id: "above", x: 70, y: 70, size: 1 })];

  it("finds the token whose square covers the point, the last drawn where two overlap", () => {
    expect(tokenAt(tokens, 70, 10, 10)?.id).toBe("below");
    expect(tokenAt(tokens, 70, 100, 100)?.id).toBe("above");
  });

  it("finds nothing on an empty spot", () => {
    expect(tokenAt(tokens, 70, 500, 500)).toBeUndefined();
  });
});
