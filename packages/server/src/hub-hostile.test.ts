import net, { type Socket } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { parseCookies } from "./hub.ts";
import { call, closeApps, connect, listen, newApp, signUp } from "./test-utils.ts";

afterEach(closeApps);

async function setup() {
  const app = newApp();
  const gm = await signUp(app, "alice");
  const world = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "Table" })).json();
  const port = await listen(app);
  return { gm, world, port };
}

/** Sends a raw upgrade request and resolves once the server has answered or closed the connection. */
function rawUpgrade(port: number, path: string, extraHeaders = "") {
  return new Promise<void>((resolve) => {
    const socket = net.connect(port, "127.0.0.1", () => {
      socket.write(
        `GET ${path} HTTP/1.1\r\nHost: x\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n${extraHeaders}\r\n`,
      );
    });
    // Reading the answer is what lets the socket reach its end and close.
    socket.resume();
    socket.on("close", () => resolve());
    socket.on("error", () => resolve());
  });
}

/** The server is still alive if a new member can connect and receive the world state. */
async function expectServerStillServes(port: number, worldId: string, cookie: string) {
  const client = connect(port, worldId, cookie);
  await client.opened;
  await client.waitFor((m) => m.type === "world.state");
  client.ws.close();
}

describe("hostile WebSocket input", () => {
  it("survives an undecodable cookie on the upgrade request", async () => {
    const { gm, world, port } = await setup();
    await rawUpgrade(port, `/ws?world=${world.id}`, "Cookie: x=%E0%A4%A\r\n");
    await expectServerStillServes(port, world.id, gm.cookie);
  });

  it("survives an upgrade URL that cannot be parsed", async () => {
    const { gm, world, port } = await setup();
    await rawUpgrade(port, "//");
    await expectServerStillServes(port, world.id, gm.cookie);
  });

  it("drops only the connection that sends a frame over the size limit", async () => {
    const { gm, world, port } = await setup();
    const attacker = connect(port, world.id, gm.cookie);
    await attacker.opened;
    const closed = new Promise((resolve) => attacker.ws.on("close", resolve));
    attacker.ws.send("x".repeat(17 * 1024));
    await closed;
    await expectServerStillServes(port, world.id, gm.cookie);
  });

  it("drops only the connection that sends an invalid frame", async () => {
    const { gm, world, port } = await setup();
    const attacker = connect(port, world.id, gm.cookie);
    await attacker.opened;
    const closed = new Promise((resolve) => attacker.ws.on("close", resolve));
    // Reserved bits set and an unknown opcode, written past the client library's own checks.
    (attacker.ws as unknown as { _socket: Socket })._socket.write(Buffer.from([0xff, 0x80, 0, 0, 0, 0]));
    await closed;
    await expectServerStillServes(port, world.id, gm.cookie);
  });
});

describe("parseCookies", () => {
  it("keeps a valid session next to a cookie it cannot decode", () => {
    expect(parseCookies("x=%E0%A4%A; session=abc%20d")).toEqual({ x: "%E0%A4%A", session: "abc d" });
  });
});
