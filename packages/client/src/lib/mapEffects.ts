import type { EffectDto, EffectKind, TokenDto } from "@openvtt/shared";

/**
 * The effects worth showing when the tokens on a floor change: a token that appeared arrives, and one whose hit points
 * moved takes damage or heals. Every screen works this out from the state it already has, so nothing is sent.
 * `arrivals` is off when tokens come and go with sight, which would make every step of a player flash.
 */
export function tokenChangeEffects(before: ReadonlyMap<string, TokenDto>, after: readonly TokenDto[], grid: number, arrivals: boolean) {
  const effects: Pick<EffectDto, "kind" | "x" | "y" | "value">[] = [];
  for (const token of after) {
    const x = token.x + (token.size * grid) / 2;
    const y = token.y + (token.size * grid) / 2;
    const old = before.get(token.id);
    if (!old) {
      if (arrivals) effects.push({ kind: "arrive", x, y });
    } else if (old.hp !== null && token.hp !== null && old.hp !== token.hp) {
      effects.push({ kind: token.hp < old.hp ? "damage" : "heal", x, y, value: Math.abs(token.hp - old.hp) });
    }
  }
  return effects;
}

/** The topmost token whose square covers a point on the map. */
export function tokenAt(tokens: readonly TokenDto[], grid: number, x: number, y: number) {
  return tokens.findLast((t) => x >= t.x && x <= t.x + t.size * grid && y >= t.y && y <= t.y + t.size * grid);
}

/**
 * How long after an effect starts it lands, so what it does to the tokens (hit points, conditions, hiding) happens
 * while the effect is at its peak.
 */
export const EFFECT_IMPACT_MS: Record<EffectKind, number> = {
  arrive: 250,
  vanish: 600,
  damage: 60,
  heal: 300,
  shield: 320,
  slash: 120,
  arrow: 260,
  projectile: 550,
  bolt: 60,
  beam: 450,
  fireball: 600,
  blast: 80,
  meteor: 900,
  frost: 250,
  poison: 600,
  quake: 250,
  whirlwind: 600,
  arcane: 1600,
  radiant: 220,
  necrotic: 700,
};
