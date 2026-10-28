import { describe, expect, it } from "vitest";
import { permissionsFor } from "./permissions";

describe("permissionsFor", () => {
  it("lets a game master do everything", () => {
    const can = permissionsFor("gm", "u1");
    expect(can.isGm).toBe(true);
    expect(can.canControlToken({ controllerIds: [] })).toBe(true);
    expect(can.canWhisperTo({ userId: "u2", role: "player" })).toBe(true);
  });

  it("lets a player move only their tokens and whisper only to the game master", () => {
    const can = permissionsFor("player", "u2");
    expect(can.isGm).toBe(false);
    expect(can.canControlToken({ controllerIds: ["u2"] })).toBe(true);
    expect(can.canControlToken({ controllerIds: ["u3"] })).toBe(false);
    expect(can.canWhisperTo({ userId: "u1", role: "gm" })).toBe(true);
    expect(can.canWhisperTo({ userId: "u3", role: "player" })).toBe(false);
    expect(can.canWhisperTo({ userId: "u2", role: "player" })).toBe(false);
  });

  it("treats an unknown role as a player", () => {
    expect(permissionsFor(undefined, "u1").isGm).toBe(false);
  });
});
