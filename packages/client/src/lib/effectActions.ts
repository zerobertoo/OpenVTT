import { AREA_EFFECTS, type EffectKind, type TOKEN_CONDITIONS, type TokenDto } from "@openvtt/shared";
import { tokenAt } from "./mapEffects";

type Condition = (typeof TOKEN_CONDITIONS)[number];

/** Effects that hurt the one token they land on. */
export const STRIKE_EFFECTS: readonly EffectKind[] = ["damage", "slash", "arrow", "projectile", "bolt", "beam", "radiant", "necrotic"];
/** Effects whose own number is the hit or the healing; the other strikes and the areas take a separate damage number. */
export const AMOUNT_EFFECTS: readonly EffectKind[] = ["damage", "heal"];
/** What an area leaves on the tokens inside it, besides its damage. */
const AREA_CONDITIONS: Partial<Record<EffectKind, Condition>> = { frost: "restrained", poison: "poisoned", quake: "prone" };

/** What an effect does to one token: fields to change and, for a push, where it ends up. */
export interface EffectHit {
  token: TokenDto;
  changes: Partial<Pick<TokenDto, "hp" | "conditions" | "hidden">>;
  moveTo?: { x: number; y: number };
}

interface Scene {
  gridSize: number;
  width: number;
  height: number;
}

/** The middle of a token in map pixels. */
export const tokenCenter = (token: TokenDto, grid: number) => ({
  x: token.x + (token.size * grid) / 2,
  y: token.y + (token.size * grid) / 2,
});

/** How far a point is from the nearest part of a token's square; 0 inside it. */
function distanceToToken(token: TokenDto, grid: number, x: number, y: number) {
  const side = token.size * grid;
  return Math.hypot(x - Math.min(Math.max(x, token.x), token.x + side), y - Math.min(Math.max(y, token.y), token.y + side));
}

/**
 * Works out what an effect landing at `at` does to the tokens on the floor, so an effect is more than a picture: strikes
 * take hit points from the token they land on, healing gives them back, areas hurt every token they touch (frost also
 * holds them, poison poisons them, an earthquake knocks them down and a whirlwind throws them one cell outward), and
 * arrival and vanishing show and hide the token. `amount` is the damage or the healing; `radius` is in cells.
 */
export function effectHits(
  kind: EffectKind,
  at: { x: number; y: number },
  radius: number,
  amount: number,
  tokens: readonly TokenDto[],
  scene: Scene,
): EffectHit[] {
  const grid = scene.gridSize;
  const hurt = (token: TokenDto) => (token.hp !== null && amount > 0 ? { hp: Math.max(0, token.hp - amount) } : {});

  if (!AREA_EFFECTS.includes(kind)) {
    const token = tokenAt(tokens, grid, at.x, at.y);
    if (!token) return [];
    let changes: EffectHit["changes"] = {};
    if (kind === "arrive" || kind === "vanish") changes = token.hidden === (kind === "arrive") ? { hidden: kind === "vanish" } : {};
    else if (kind === "heal")
      changes = token.hp !== null && amount > 0 ? { hp: Math.min(token.hpMax ?? Number.POSITIVE_INFINITY, token.hp + amount) } : {};
    else if (STRIKE_EFFECTS.includes(kind)) changes = hurt(token);
    return Object.keys(changes).length ? [{ token, changes }] : [];
  }

  const hits: EffectHit[] = [];
  for (const token of tokens) {
    if (distanceToToken(token, grid, at.x, at.y) >= radius * grid) continue;
    const changes: EffectHit["changes"] = hurt(token);
    const condition = AREA_CONDITIONS[kind];
    if (condition && !token.conditions.includes(condition)) changes.conditions = [...token.conditions, condition];
    const hit: EffectHit = { token, changes };
    if (kind === "whirlwind") {
      // Thrown one cell straight away from the eye, along the nearest of the eight directions, and kept on the map.
      const center = tokenCenter(token, grid);
      const length = Math.hypot(center.x - at.x, center.y - at.y);
      if (length > grid / 4) {
        const limit = (size: number) => Math.max(0, size - token.size * grid);
        const x = Math.min(Math.max(token.x + Math.round((center.x - at.x) / length) * grid, 0), limit(scene.width));
        const y = Math.min(Math.max(token.y + Math.round((center.y - at.y) / length) * grid, 0), limit(scene.height));
        if (x !== token.x || y !== token.y) hit.moveTo = { x, y };
      }
    }
    if (Object.keys(changes).length || hit.moveTo) hits.push(hit);
  }
  return hits;
}
