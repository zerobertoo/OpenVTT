import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import { Hub } from "./hub.ts";
import type { Services } from "./services.ts";
import { call, closeApps, connect, listen, newApp, signUp } from "./test-utils.ts";

afterEach(closeApps);

async function setup(options: Parameters<typeof newApp>[1] = {}) {
  const app = newApp(":memory:", options);
  const gm = await signUp(app, "alice");
  const world = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "Table" })).json();
  const port = await listen(app);
  return { gm, world, port };
}

/** Resolves "open" when the upgrade succeeds and "refused" when the server turns it down. */
const tryOpen = (port: number, worldId: string, cookie: string, origin?: string) =>
  new Promise<"open" | "refused">((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?world=${worldId}`, { headers: { cookie, ...(origin && { origin }) } });
    ws.on("open", () => {
      ws.close();
      resolve("open");
    });
    ws.on("error", () => resolve("refused"));
  });

describe("WebSocket upgrade origin", () => {
  it("refuses a page from another site and accepts the app's own page or a client without an origin", async () => {
    const { gm, world, port } = await setup();
    expect(await tryOpen(port, world.id, gm.cookie, "https://evil.example")).toBe("refused");
    expect(await tryOpen(port, world.id, gm.cookie, `http://127.0.0.1:${port}`)).toBe("open");
    expect(await tryOpen(port, world.id, gm.cookie)).toBe("open");
  });

  it("accepts the app's own page when the proxy passes the host on without its port", async () => {
    const { gm, world, port } = await setup();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?world=${world.id}`, {
      headers: { cookie: gm.cookie, origin: "https://127.0.0.1:8443", host: "127.0.0.1" },
    });
    const outcome = await new Promise((resolve) => {
      ws.on("open", () => resolve("open"));
      ws.on("error", () => resolve("refused"));
    });
    ws.terminate();
    expect(outcome).toBe("open");
  });
});

describe("WebSocket traffic limits", () => {
  it("drops a connection that floods messages and leaves the others alone", async () => {
    const { gm, world, port } = await setup();
    const flooder = connect(port, world.id, gm.cookie);
    const bystander = connect(port, world.id, gm.cookie);
    await Promise.all([flooder.opened, bystander.opened]);
    const closed = new Promise((resolve) => flooder.ws.on("close", resolve));

    for (let i = 0; i < 500; i++) flooder.ws.send(JSON.stringify({ type: "map.ping", x: 1, y: 1 }));
    await closed;

    expect(bystander.ws.readyState).toBe(WebSocket.OPEN);
  });

  it("answers a burst of resync requests only once", async () => {
    const { gm, world, port } = await setup();
    const client = connect(port, world.id, gm.cookie);
    await client.opened;
    await client.waitFor((m) => m.type === "world.state");
    const before = client.seen.filter((m) => m.type === "world.state").length;

    for (let i = 0; i < 10; i++) client.ws.send(JSON.stringify({ type: "world.resync" }));
    await client.settle();

    expect(client.seen.filter((m) => m.type === "world.state").length - before).toBe(1);
  });

  it("drops a connection that no longer answers pings", async () => {
    const { gm, world, port } = await setup({ webSocketHeartbeatMs: 50 });
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?world=${world.id}`, { headers: { cookie: gm.cookie }, autoPong: false });
    await new Promise((resolve) => ws.on("open", resolve));
    const closed = new Promise((resolve) => ws.on("close", resolve));

    await expect(Promise.race([closed.then(() => "closed"), new Promise((r) => setTimeout(() => r("alive"), 1500))])).resolves.toBe(
      "closed",
    );
  });

  it("keeps a connection that answers pings", async () => {
    const { gm, world, port } = await setup({ webSocketHeartbeatMs: 50 });
    const client = connect(port, world.id, gm.cookie);
    await client.opened;
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(client.ws.readyState).toBe(WebSocket.OPEN);
  });

  it("drops a connection whose unsent data keeps piling up instead of buffering without bound", () => {
    const hub = new Hub({} as Services, "session");
    const socket = { OPEN: 1, readyState: 1, bufferedAmount: 64 * 1024 * 1024, send: vi.fn(), terminate: vi.fn() };
    (hub as unknown as { send: (c: unknown, m: unknown) => void }).send({ socket }, { type: "error", code: "forbidden" });

    expect(socket.send).not.toHaveBeenCalled();
    expect(socket.terminate).toHaveBeenCalledOnce();
  });
});
