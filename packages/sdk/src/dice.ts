export interface RollPart {
  /** +1 or -1 */
  sign: 1 | -1;
  count: number;
  sides: number;
  results: number[];
  /** Indexes of `results` that count toward the total (differs from all of them on adv/dis). */
  kept: number[];
}

export interface RollResult {
  notation: string;
  parts: RollPart[];
  modifier: number;
  advantage: "adv" | "dis" | null;
  total: number;
}

export class DiceError extends Error {}

const MAX_DICE = 100;
const MAX_SIDES = 1000;
const MAX_TERMS = 20;

/** Returns an integer in [1, sides]. */
export type Rng = (sides: number) => number;

const TERM = /([+-])?\s*(?:(\d*)d(\d+)|(\d+))/gy;

/**
 * Rolls dice notation such as `2d6+3`, `d20-1` or `1d20 adv`.
 * `adv`/`dis` roll the first single d20 twice and keep the higher/lower result.
 */
export function rollDice(input: string, rng: Rng): RollResult {
  const match = /^\s*(.*?)\s*(adv|dis)?\s*$/i.exec(input);
  const body = (match?.[1] ?? "").replace(/\s*([+-])\s*/g, "$1");
  const advantage = (match?.[2]?.toLowerCase() as "adv" | "dis" | undefined) ?? null;
  if (!body) throw new DiceError("empty");

  const parts: RollPart[] = [];
  let modifier = 0;
  let terms = 0;
  let advantageUsed = false;
  TERM.lastIndex = 0;
  let consumed = 0;
  for (let m = TERM.exec(body); m; m = TERM.exec(body)) {
    const sign = m[1] === "-" ? -1 : 1;
    if (consumed > 0 && !m[1]) throw new DiceError("missing operator");
    consumed = TERM.lastIndex;
    if (++terms > MAX_TERMS) throw new DiceError("too many terms");

    if (m[4] !== undefined) {
      modifier += sign * Number(m[4]);
      continue;
    }
    const count = m[2] === "" ? 1 : Number(m[2]);
    const sides = Number(m[3]);
    if (count < 1 || count > MAX_DICE || sides < 2 || sides > MAX_SIDES) throw new DiceError("out of range");

    const useAdvantage = advantage !== null && !advantageUsed && count === 1 && sides === 20 && sign === 1;
    if (useAdvantage) advantageUsed = true;
    const results = Array.from({ length: useAdvantage ? 2 : count }, () => rng(sides));
    let kept = results.map((_, i) => i);
    if (useAdvantage) {
      const pickHigher = advantage === "adv";
      const winner = results[0]! >= results[1]! === pickHigher ? 0 : 1;
      kept = [winner];
    }
    parts.push({ sign, count, sides, results, kept });
  }
  if (consumed !== body.length) throw new DiceError("invalid notation");
  if (advantage && !advantageUsed) throw new DiceError("adv/dis needs a single d20");

  const total = modifier + parts.reduce((sum, p) => sum + p.sign * p.kept.reduce((s, i) => s + p.results[i]!, 0), 0);
  return { notation: input.trim(), parts, modifier, advantage, total };
}
