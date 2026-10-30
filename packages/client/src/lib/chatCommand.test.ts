import { describe, expect, it } from "vitest";
import { parseWhisper, rollBody } from "./chatCommand";

const recipients = [
  { userId: "u1", displayName: "Ana" },
  { userId: "u2", displayName: "Ana Maria" },
];

describe("parseWhisper", () => {
  it("finds the recipient by name, ignoring case", () => {
    expect(parseWhisper("/w ana psst", recipients)).toEqual({ toUserId: "u1", content: "psst" });
  });

  it("prefers the longest name when one contains another", () => {
    expect(parseWhisper("/w Ana Maria hello there", recipients)).toEqual({ toUserId: "u2", content: "hello there" });
  });

  it("does not match half a name", () => {
    expect(parseWhisper("/w Anabel hi", recipients)).toBe("unknown-recipient");
  });

  it("asks for a message and ignores other text", () => {
    expect(parseWhisper("/w Ana", recipients)).toBe("empty");
    expect(parseWhisper("hello", recipients)).toBeNull();
  });
});

describe("rollBody", () => {
  it("drops an advantage keyword and keeps the dice", () => {
    expect(rollBody("/r 1d20+3 adv")).toBe("1d20+3");
    expect(rollBody("/gr 2d6")).toBe("2d6");
  });

  it("is null for anything that is not a roll", () => {
    expect(rollBody("hello")).toBeNull();
  });
});
