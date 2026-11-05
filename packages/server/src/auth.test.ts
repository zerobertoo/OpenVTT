import { describe, expect, it } from "vitest";
import { AuthService, MAX_TRACKED_FAILURES, SESSION_TTL_MS } from "./auth.ts";
import { openDatabase } from "./db.ts";

const PASSWORD = "correct horse";

function newAuth(now: () => number = Date.now) {
  const db = openDatabase(":memory:");
  return { db, auth: new AuthService(db, now) };
}

const failLogin = (auth: AuthService, username: string, client: string, times = 1) =>
  Array.from({ length: times }).reduce<Promise<unknown>>(
    (previous) => previous.then(() => auth.login(username, "wrong password", client).catch(() => undefined)),
    Promise.resolve(),
  );

describe("login lockout", () => {
  it("locks a name only for the client that kept failing, so a stranger cannot lock the owner out", async () => {
    const { auth } = newAuth();
    await auth.register("alice", PASSWORD);
    await failLogin(auth, "alice", "attacker", 5);

    await expect(auth.login("alice", PASSWORD, "attacker")).rejects.toMatchObject({ code: "too_many_attempts" });
    await expect(auth.login("alice", PASSWORD, "owner")).resolves.toMatchObject({ username: "alice" });
  });

  it("does not grow without bound when many names fail", async () => {
    const { auth } = newAuth();
    for (let i = 0; i < MAX_TRACKED_FAILURES + 50; i++) await failLogin(auth, `ghost${i}`, "attacker");

    const tracked = (auth as unknown as { failures: Map<string, unknown> }).failures;
    expect(tracked.size).toBeLessThanOrEqual(MAX_TRACKED_FAILURES);
  });
});

describe("sessions", () => {
  it("removes expired sessions when a new one is created", async () => {
    let clock = 1_000_000;
    const { db, auth } = newAuth(() => clock);
    const user = await auth.register("alice", PASSWORD);
    const old = auth.createSession(user.id);
    clock += SESSION_TTL_MS + 1;

    const fresh = auth.createSession(user.id);

    expect(db.prepare("SELECT COUNT(*) AS n FROM sessions").get()).toEqual({ n: 1 });
    expect(auth.userFromSession(old)).toBeNull();
    expect(auth.userFromSession(fresh)?.username).toBe("alice");
  });
});
