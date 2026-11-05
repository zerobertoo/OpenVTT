import type { ServerMessage } from "@openvtt/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError } from "./errors.ts";
import { errorCodeForClient, Hub } from "./hub.ts";
import { call, closeApps, connect, listen, newApp, signUp } from "./test-utils.ts";

afterEach(async () => {
  vi.restoreAllMocks();
  await closeApps();
});

describe("unexpected errors", () => {
  it("logs an HTTP failure and still answers with only a code", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = newApp();
    const failure = new Error("database is on fire");
    app.get("/boom", async () => {
      throw failure;
    });
    const res = await app.inject({ method: "GET", url: "/boom" });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "internal_error" });
    expect(log).toHaveBeenCalledWith("Unexpected error on GET /boom", failure);
  });

  it("logs a WebSocket failure only when it is a server bug", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(errorCodeForClient(new AppError("forbidden"))).toBe("forbidden");
    expect(errorCodeForClient(z.string().safeParse(1).error)).toBe("invalid_input");
    expect(errorCodeForClient(new SyntaxError("bad JSON"))).toBe("invalid_input");
    expect(log).not.toHaveBeenCalled();

    expect(errorCodeForClient(new TypeError("broken"))).toBe("internal_error");
    expect(log).toHaveBeenCalledOnce();
  });

  it("logs a failure while opening a table connection, survives it and leaves nobody falsely online", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = newApp();
    const gm = await signUp(app, "alice");
    const bob = await signUp(app, "bob");
    const world = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "Table" })).json();
    const { code } = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/invites`)).json();
    await call(app, bob.cookie, "POST", `/api/invites/${code}/join`, { displayName: "Bob", color: "#112233" });
    const port = await listen(app);
    const gmSocket = connect(port, world.id, gm.cookie);
    await gmSocket.opened;
    await gmSocket.settle();

    const failure = new Error("database is on fire");
    const broadcast = vi.spyOn(Hub.prototype, "broadcastState");
    // Both the broadcast on opening and the one when the failed socket closes.
    broadcast.mockImplementationOnce(() => {
      throw failure;
    });
    broadcast.mockImplementationOnce(() => {
      throw failure;
    });
    const bobSocket = connect(port, world.id, bob.cookie);
    await new Promise((resolve) => bobSocket.ws.on("close", resolve));
    await gmSocket.settle();
    expect(log).toHaveBeenCalledWith("Unexpected error opening a table connection", failure);
    expect(log).toHaveBeenCalledWith("Unexpected error closing a table connection", failure);

    gmSocket.seen.length = 0;
    await call(app, gm.cookie, "PATCH", `/api/worlds/${world.id}`, { name: "Renamed" });
    const message = await gmSocket.waitFor((m): m is Extract<ServerMessage, { type: "world.state" }> => m.type === "world.state");
    expect(message.state.members.filter((member) => member.online)).toHaveLength(1);
    gmSocket.ws.close();
  });
});
