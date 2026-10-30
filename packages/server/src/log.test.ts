import { afterEach, expect, it } from "vitest";
import { call, closeApps, newApp, signUp } from "./test-utils.ts";

afterEach(closeApps);

it("exports each person's session log with only the messages they could read", async () => {
  const app = newApp();
  const gm = await signUp(app, "alice");
  const bob = await signUp(app, "bob");
  const carol = await signUp(app, "carol");
  const world = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "Tomb run" })).json();
  const { code } = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/invites`)).json();
  await call(app, bob.cookie, "POST", `/api/invites/${code}/join`, { displayName: "Bob", color: "#112233" });
  await call(app, carol.cookie, "POST", `/api/invites/${code}/join`, { displayName: "Carol", color: "#112233" });
  const say = (cookie: string, body: object) => call(app, cookie, "POST", `/api/worlds/${world.id}/messages`, body);
  await say(gm.cookie, { content: "Welcome" });
  await say(gm.cookie, { content: "/gr 1d20" });
  await say(gm.cookie, { content: "Bob, the idol is cursed", toUserId: bob.user.id });
  await say(bob.cookie, { content: "/r 2d6+1" });

  const log = async (cookie: string) => (await call(app, cookie, "GET", `/api/worlds/${world.id}/log.md`)).body;
  const gmLog = await log(gm.cookie);
  expect(gmLog).toContain("# Tomb run");
  expect(gmLog).toContain("(gm)");
  expect(gmLog).toContain("cursed");
  const bobLog = await log(bob.cookie);
  expect(bobLog).toContain("cursed");
  expect(bobLog).toMatch(/\*\*Bob\*\*: \/r 2d6\+1 = \*\*\d+\*\*/);
  expect(bobLog).not.toContain("/gr");
  const carolLog = await log(carol.cookie);
  expect(carolLog).toContain("Welcome");
  expect(carolLog).not.toContain("cursed");
  expect(carolLog).not.toContain("/gr");
  const stranger = await signUp(app, "dave");
  expect((await call(app, stranger.cookie, "GET", `/api/worlds/${world.id}/log.md`)).statusCode).toBe(403);
});
