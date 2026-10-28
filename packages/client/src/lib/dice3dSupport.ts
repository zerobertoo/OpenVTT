import type { RollResult } from "@openvtt/sdk";

/** Dice that have a solid with exactly that many faces we can draw. Others (d10, d100, d3...) keep the flat dice. */
export const SOLID_SIDES = [4, 6, 8, 12, 20] as const;

/** More dice than this do not fit in the overlay, so they stay flat as well. */
export const MAX_3D_DICE = 8;

/** One die to throw: every die rolled counts, including the ones adv/dis drops. */
export interface ThrownDie {
  sides: number;
  value: number;
  kept: boolean;
}

/** The dice of a roll in order, or null when any of them cannot be shown as a solid. */
export function thrownDice(roll: RollResult): ThrownDie[] | null {
  const dice = roll.parts.flatMap((part) => part.results.map((value, i) => ({ sides: part.sides, value, kept: part.kept.includes(i) })));
  if (dice.length === 0 || dice.length > MAX_3D_DICE) return null;
  return dice.every((die) => (SOLID_SIDES as readonly number[]).includes(die.sides)) ? dice : null;
}
