import { describe, expect, it } from "vitest";
import { addDie, handNotation, handSize, MAX_HAND_DICE, removeDie } from "./diceHand";
import { clampLaunch, planThrow, randomLaunch } from "./diceThrow";

const screen = { width: 1200, height: 700 };
const RADIUS = 34;
/** A fixed sequence stands in for Math.random so the throw is the same on every run. */
const steady = () => {
  let n = 0;
  return () => ((n = (n * 7 + 3) % 10) + 0.5) / 10;
};

describe("planThrow", () => {
  it("brings every die to rest inside the screen, apart from each other", () => {
    const frames = planThrow(5, { x: 600, y: 650, vx: 300, vy: -1500 }, screen, RADIUS, steady());
    const last = frames.at(-1)!;
    expect(last).toHaveLength(5);
    for (const die of last) {
      expect(die.x).toBeGreaterThanOrEqual(RADIUS);
      expect(die.x).toBeLessThanOrEqual(screen.width - RADIUS);
      expect(die.y).toBeGreaterThanOrEqual(RADIUS);
      expect(die.y).toBeLessThanOrEqual(screen.height - RADIUS);
    }
    for (const [i, a] of last.entries())
      for (const b of last.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(RADIUS * 1.5);
    expect(frames.length).toBeGreaterThan(20);
  });

  it("travels the way it was thrown", () => {
    const [first] = planThrow(1, { x: 100, y: 350, vx: 1600, vy: 0 }, screen, RADIUS, steady());
    const [end] = planThrow(1, { x: 100, y: 350, vx: 1600, vy: 0 }, screen, RADIUS, steady()).at(-1)!;
    expect(end!.x).toBeGreaterThan(first![0]!.x + 200);
  });

  it("stays on screen even when thrown hard at a wall", () => {
    const last = planThrow(2, { x: 1100, y: 100, vx: 5000, vy: -5000 }, screen, RADIUS, steady()).at(-1)!;
    for (const die of last) expect(die.x <= screen.width && die.y >= 0).toBe(true);
  });
});

describe("launches", () => {
  it("clamps a feeble drop to a toss and a wild flick to a fast throw", () => {
    expect(clampLaunch({ x: 0, y: 0, vx: 0, vy: 0 }).vy).toBeLessThan(0);
    expect(Math.hypot(clampLaunch({ x: 0, y: 0, vx: 9000, vy: 0 }).vx, 0)).toBeLessThan(2300);
    expect(Math.hypot(clampLaunch({ x: 0, y: 0, vx: 20, vy: 0 }).vx, 0)).toBeGreaterThan(300);
  });

  it("throws other people's rolls in from the side towards the middle", () => {
    const launch = randomLaunch(screen, steady());
    const fromLeft = launch.x < screen.width / 2;
    expect(fromLeft ? launch.vx > 0 : launch.vx < 0).toBe(true);
  });
});

describe("dice hand", () => {
  it("writes the notation in die order, with a signed modifier", () => {
    let hand = addDie(addDie(addDie({}, 20), 6), 6);
    expect(handNotation(hand, 0)).toBe("2d6+1d20");
    expect(handNotation(hand, 3)).toBe("2d6+1d20+3");
    expect(handNotation(hand, -2)).toBe("2d6+1d20-2");
    hand = removeDie(removeDie(hand, 6), 6);
    expect(handNotation(hand, 0)).toBe("1d20");
    expect(handNotation({}, 5)).toBe("");
  });

  it("stops adding dice once the hand is full", () => {
    let hand = {};
    for (let i = 0; i < MAX_HAND_DICE + 5; i++) hand = addDie(hand, 6);
    expect(handSize(hand)).toBe(MAX_HAND_DICE);
  });
});
