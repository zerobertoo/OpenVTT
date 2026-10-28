/** Dice picked in the tray: how many of each kind of die. */
export type DiceHand = Readonly<Record<number, number>>;

export const TRAY_DICE = [4, 6, 8, 10, 12, 20, 100] as const;

/** At most this many dice in one throw, matching what the table can show at once. */
export const MAX_HAND_DICE = 12;
export const MAX_MODIFIER = 99;

export function handSize(hand: DiceHand): number {
  return Object.values(hand).reduce((sum, count) => sum + count, 0);
}

/** Adds one die of `sides` (does nothing once the hand is full). */
export function addDie(hand: DiceHand, sides: number): DiceHand {
  return handSize(hand) >= MAX_HAND_DICE ? hand : { ...hand, [sides]: (hand[sides] ?? 0) + 1 };
}

/** Takes one die of `sides` out of the hand. */
export function removeDie(hand: DiceHand, sides: number): DiceHand {
  const left = (hand[sides] ?? 0) - 1;
  const { [sides]: _removed, ...rest } = hand;
  return left > 0 ? { ...rest, [sides]: left } : rest;
}

/** The dice notation the server rolls, such as "2d6+1d20+3", or "" for an empty hand. */
export function handNotation(hand: DiceHand, modifier: number): string {
  const terms = TRAY_DICE.filter((sides) => (hand[sides] ?? 0) > 0).map((sides) => `${hand[sides]}d${sides}`);
  if (terms.length === 0) return "";
  return terms.join("+") + (modifier > 0 ? `+${modifier}` : modifier < 0 ? String(modifier) : "");
}
