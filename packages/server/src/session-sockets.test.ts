import { afterEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "./app.ts";
import { type App, call, closeApps, connect, listen, newApp, signUp } from "./test-utils.ts";

afterEach(async () => {
  vi.restoreAllMocks();
  await closeApps();
});

async function setup() {
  const app = newApp();
  const admin = await signUp(app, "alice");
  const bob = await signUp(app, "bob");
  const world = (await call(app, admin.cookie, "POST", "/api/worlds", { name: "Table" })).json();
  const { code } = (await call(app, admin.cookie, "POST", `/api/worlds/${world.id}/invites`)).json();
  await call(app, bob.cookie, "POST", `/api/invites/${code}/join`, { displayName: "Bob", color: "#112233" });
  return { app, admin, bob, world, port: await listen(app) };
}

async function secondSession(app: App, username: string) {
  const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username, password: "correct horse" } });
  return `${SESSION_COOKIE}=${res.cookies.find((c) => c.name === SESSION_COOKIE)?.value}`;
}

async function openSocket(port: number, worldId: string, cookie: string) {
  const client = connect(port, worldId, cookie);
  await client.opened;
  const closed = new Promise<void>((resolve) => client.ws.on("close", () => resolve()));
  return { client, closed };
}

describe("sockets of an ended session", () => {
  it("closes on logout, leaving the same user's other session connected", async () => {
    const { app, bob, world, port } = await setup();
    const otherDevice = await secondSession(app, "bob");
    const loggedOut = await openSocket(port, world.id, bob.cookie);
    const stillIn = await openSocket(port, world.id, otherDevice);

    await call(app, bob.cookie, "POST", "/api/auth/logout");
    await loggedOut.closed;
    await stillIn.client.settle();
    expect(stillIn.client.ws.readyState).toBe(stillIn.client.ws.OPEN);
    stillIn.client.ws.close();
    await stillIn.closed;
  });

  it("closes every socket of a user whose password an admin reset", async () => {
    const { app, admin, bob, world, port } = await setup();
    const otherDevice = await secondSession(app, "bob");
    const first = await openSocket(port, world.id, bob.cookie);
    const second = await openSocket(port, world.id, otherDevice);
    const adminSocket = await openSocket(port, world.id, admin.cookie);

    await call(app, admin.cookie, "POST", "/api/admin/reset-password", { username: "bob", newPassword: "another horse" });
    await Promise.all([first.closed, second.closed]);
    expect(adminSocket.client.ws.readyState).toBe(adminSocket.client.ws.OPEN);
    adminSocket.client.ws.close();
    await adminSocket.closed;
  });

  it("applies nothing more from a client that ignores the closing handshake after logout", async () => {
    const { app, admin, bob, world, port } = await setup();
    const scene = (await call(app, admin.cookie, "POST", `/api/worlds/${world.id}/scenes`, { name: "A", width: 700, height: 500 })).json();
    await call(app, admin.cookie, "PATCH", `/api/worlds/${world.id}`, { activeSceneId: scene.id });
    const token = (
      await call(app, admin.cookie, "POST", `/api/worlds/${world.id}/tokens`, {
        sceneId: scene.id,
        name: "Hero",
        x: 100,
        y: 100,
        controllerIds: [bob.user.id],
      })
    ).json();
    const { client } = await openSocket(port, world.id, bob.cookie);
    await client.settle();
    // A paused client never reads the close frame, so it never answers it.
    client.ws.pause();
    await call(app, bob.cookie, "POST", "/api/auth/logout");
    client.ws.send(JSON.stringify({ type: "token.move", tokenId: token.id, x: 300, y: 100 }));
    await client.settle();
    expect((await call(app, admin.cookie, "PATCH", `/api/tokens/${token.id}`, {})).json().x).toBe(100);
    client.ws.terminate();
  });

  describe("when the session simply expires", () => {
    const ONE_MONTH_AND_A_DAY_MS = 31 * 24 * 60 * 60 * 1000;

    async function expiredSocket() {
      const realNow = Date.now;
      let elapsed = 0;
      vi.spyOn(Date, "now").mockImplementation(() => realNow() + elapsed);
      const context = await setup();
      const socket = await openSocket(context.port, context.world.id, context.bob.cookie);
      await socket.client.settle();
      elapsed = ONE_MONTH_AND_A_DAY_MS;
      return { ...context, ...socket };
    }

    it("closes the socket on its next message", async () => {
      const { client, closed } = await expiredSocket();
      client.ws.send(JSON.stringify({ type: "world.resync" }));
      await closed;
    });

    it("closes the socket instead of sending it new state", async () => {
      const { app, world, client, closed } = await expiredSocket();
      client.seen.length = 0;
      const stillSignedIn = await secondSession(app, "alice");
      await call(app, stillSignedIn, "PATCH", `/api/worlds/${world.id}`, { name: "Renamed" });
      await closed;
      expect(client.seen.map((m) => m.type)).not.toContain("world.state");
    });
  });
});
