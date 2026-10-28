import type { RollResult } from "@openvtt/sdk";

/** Shapes with a solid we can draw. A d100 is thrown as two d10 (tens and units), as at a real table. */
export type DiceShape = 4 | 6 | 8 | 10 | 12 | 20;
const SHAPES: readonly number[] = [4, 6, 8, 10, 12, 20];

/** More dice than this do not fit on screen, so such rolls fall back to the flat dice. */
export const MAX_3D_DICE = 12;

/** One die to throw: every die rolled counts, including the ones adv/dis drops. */
export interface ThrownDie {
  shape: DiceShape;
  /** What its faces say: "tens" is the 00-90 die of a d100. */
  kind: "normal" | "tens";
  /** 0-based index of the face that must end up on top. */
  face: number;
  kept: boolean;
}

/** The number written on face `index` of a die. A d10 reads 0-9 (the 0 standing for 10), the tens die 00-90. */
export function faceLabel(die: Pick<ThrownDie, "shape" | "kind">, index: number): string {
  if (die.kind === "tens") return index === 0 ? "00" : String(index * 10);
  return String(die.shape === 10 ? index : index + 1);
}

function thrown(sides: number, value: number, kept: boolean): ThrownDie[] | null {
  if (sides === 100) {
    // 100 is "00" and "0"; every other value reads as its tens digit and units digit.
    const wrapped = value % 100;
    return [
      { shape: 10, kind: "tens", face: Math.floor(wrapped / 10), kept },
      { shape: 10, kind: "normal", face: wrapped % 10, kept },
    ];
  }
  if (!SHAPES.includes(sides)) return null;
  // On a d10 the face reading 0 is the tenth one, so a roll of 10 rests on index 0.
  return [{ shape: sides as DiceShape, kind: "normal", face: sides === 10 ? value % 10 : value - 1, kept }];
}

/** The dice of a roll in order, or null when any of them cannot be shown as a solid. */
export function thrownDice(roll: RollResult): ThrownDie[] | null {
  const dice: ThrownDie[] = [];
  for (const part of roll.parts) {
    for (const [i, value] of part.results.entries()) {
      const pair = thrown(part.sides, value, part.kept.includes(i));
      if (!pair) return null;
      dice.push(...pair);
    }
  }
  return dice.length === 0 || dice.length > MAX_3D_DICE ? null : dice;
}
