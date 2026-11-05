import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError } from "./errors.ts";
import { errorCodeForClient } from "./hub.ts";
import { closeApps, newApp } from "./test-utils.ts";

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
});
