import { connect } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { closeApps, newApp, signUp } from "./test-utils.ts";

afterEach(closeApps);

/** Resolves with "closed" or "hung" depending on whether `app.close()` finished within the time limit. */
async function closeOutcome(close: Promise<unknown>, limitMs = 1500) {
  return Promise.race([close.then(() => "closed"), new Promise((resolve) => setTimeout(() => resolve("hung"), limitMs))]);
}

describe("shutdown", () => {
  it("closes even with a live table socket open", async () => {
    const app = newApp();
    const { cookie } = await signUp(app, "alice");
    const world = (await app.inject({ method: "POST", url: "/api/worlds", headers: { cookie }, payload: { name: "W" } })).json();
    const address = await app.listen({ port: 0, host: "127.0.0.1" });
    const socket = new WebSocket(`${address.replace("http", "ws")}/ws?world=${world.id}`, { headers: { cookie } });
    await new Promise((resolve) => socket.once("open", resolve));

    expect(await closeOutcome(app.close())).toBe("closed");
  });

  it("closes even with an upload still in flight", async () => {
    const app = newApp();
    await signUp(app, "alice");
    const address = new URL(await app.listen({ port: 0, host: "127.0.0.1" }));
    const raw = connect({ port: Number(address.port), host: address.hostname });
    await new Promise((resolve) => raw.once("connect", resolve));
    // Announces a long body and never sends it.
    raw.write("POST /api/auth/login HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: 1000\r\n\r\n{");
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(await closeOutcome(app.close())).toBe("closed");
    raw.destroy();
  });

  it("closes even with an idle keep-alive connection open", async () => {
    const app = newApp();
    const address = new URL(await app.listen({ port: 0, host: "127.0.0.1" }));
    const raw = connect({ port: Number(address.port), host: address.hostname });
    await new Promise((resolve) => raw.once("connect", resolve));
    raw.write("GET /healthz HTTP/1.1\r\nHost: x\r\nConnection: keep-alive\r\n\r\n");
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(await closeOutcome(app.close())).toBe("closed");
    raw.destroy();
  });
});
