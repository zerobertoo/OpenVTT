import { afterEach, describe, expect, it } from "vitest";
import { call, closeApps, fakeWebm, newApp, PNG, signUp, upload } from "./test-utils.ts";

afterEach(closeApps);

const bigPng = (bytes: number) => Buffer.concat([PNG.subarray(0, 8), Buffer.alloc(bytes - 8)]);

describe("world quotas", () => {
  it("stops a user from creating more worlds than allowed without affecting others", async () => {
    const app = newApp(":memory:", { maxWorldsPerUser: 2 });
    const alice = await signUp(app, "alice");
    const bob = await signUp(app, "bob");
    const create = (cookie: string) => call(app, cookie, "POST", "/api/worlds", { name: "Table" });

    expect((await create(alice.cookie)).statusCode).toBe(200);
    expect((await create(alice.cookie)).statusCode).toBe(200);
    const refused = await create(alice.cookie);
    expect(refused.statusCode).toBe(403);
    expect(refused.json().error).toBe("quota_exceeded");
    expect((await create(bob.cookie)).statusCode).toBe(200);
  });

  it("refuses uploads past the storage allowance of a world, for images and for streamed media", async () => {
    const app = newApp(":memory:", { maxWorldAssetBytes: 6000 });
    const gm = await signUp(app, "alice");
    const world = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "Table" })).json();

    expect((await upload(app, gm.cookie, world.id, bigPng(4000))).statusCode).toBe(200);
    const image = await upload(app, gm.cookie, world.id, bigPng(4000));
    expect(image.statusCode).toBe(403);
    expect(image.json().error).toBe("quota_exceeded");
    const video = await upload(app, gm.cookie, world.id, fakeWebm(3000), "video/webm");
    expect(video.json().error).toBe("quota_exceeded");
    // Smaller files that still fit are accepted.
    expect((await upload(app, gm.cookie, world.id, bigPng(1500))).statusCode).toBe(200);
  });
});

describe("request limits", () => {
  it("limits how fast one address can register accounts", async () => {
    const app = newApp();
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      statuses.push(
        (await app.inject({ method: "POST", url: "/api/auth/register", payload: { username: `user${i}`, password: "correct horse" } }))
          .statusCode,
      );
    }
    expect(statuses.slice(0, 10)).not.toContain(429);
    expect(statuses.at(-1)).toBe(429);
  });

  it("limits chat messages per account, so a table sharing one address is not throttled together", async () => {
    const app = newApp();
    const alice = await signUp(app, "alice");
    const bob = await signUp(app, "bob");
    const world = (await call(app, alice.cookie, "POST", "/api/worlds", { name: "Table" })).json();
    const send = (cookie: string) =>
      call(app, cookie, "POST", `/api/worlds/${world.id}/messages`, { content: "hi", toUserId: null, gmOnly: false });

    let last = 200;
    for (let i = 0; i < 130; i++) last = (await send(alice.cookie)).statusCode;
    expect(last).toBe(429);
    // A different account on the same address still gets through (the status is not 429).
    expect((await send(bob.cookie)).statusCode).not.toBe(429);
  });
});
