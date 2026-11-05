import { afterEach, describe, expect, it } from "vitest";
import { SESSION_COOKIE } from "./app.ts";
import { type App, call, closeApps, connect, listen, newApp, signUp } from "./test-utils.ts";

afterEach(closeApps);

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
});
