import type { TokenDto } from "@openvtt/shared";
import { describe, expect, it } from "vitest";
import { tokenChangeEffects } from "./mapEffects";

const token = (patch: Partial<TokenDto>): TokenDto => ({ id: "t1", x: 100, y: 200, size: 2, hp: 10, hpMax: 10, ...patch }) as TokenDto;
const before = (...tokens: TokenDto[]) => new Map(tokens.map((t) => [t.id, t]));

describe("tokenChangeEffects", () => {
  it("shows damage and healing at the middle of the token, with the size of the change", () => {
    expect(tokenChangeEffects(before(token({})), [token({ hp: 6 })], 50, true)).toEqual([{ kind: "damage", x: 150, y: 250, value: 4 }]);
    expect(tokenChangeEffects(before(token({ hp: 3 })), [token({ hp: 10 })], 50, true)).toEqual([
      { kind: "heal", x: 150, y: 250, value: 7 },
    ]);
  });

  it("stays quiet for moves and for health the viewer cannot see", () => {
    expect(tokenChangeEffects(before(token({})), [token({ x: 300 })], 50, true)).toEqual([]);
    expect(tokenChangeEffects(before(token({ hp: null })), [token({ hp: 4 })], 50, true)).toEqual([]);
  });

  it("makes a new token arrive, unless arrivals are off", () => {
    expect(tokenChangeEffects(before(), [token({})], 50, true)).toEqual([{ kind: "arrive", x: 150, y: 250 }]);
    expect(tokenChangeEffects(before(), [token({})], 50, false)).toEqual([]);
  });
});
