import { afterEach, describe, expect, it } from "vitest";
import { call, closeApps, newApp, signUp } from "./test-utils.ts";

afterEach(closeApps);

describe("security headers", () => {
  it("sends the browser hardening headers on pages and on API answers", async () => {
    const app = newApp();
    const page = await app.inject({ method: "GET", url: "/healthz" });
    expect(page.headers["x-content-type-options"]).toBe("nosniff");
    expect(page.headers["referrer-policy"]).toBe("same-origin");
    expect(page.headers["permissions-policy"]).toContain("camera=()");

    const csp = String(page.headers["content-security-policy"]);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);

    const gm = await signUp(app, "alice");
    const worlds = await call(app, gm.cookie, "GET", "/api/worlds");
    expect(worlds.headers["content-security-policy"]).toBe(csp);
  });

  it("keeps the nosniff header an asset already sets", async () => {
    const app = newApp();
    const res = await app.inject({ method: "GET", url: "/api/assets/missing" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});
