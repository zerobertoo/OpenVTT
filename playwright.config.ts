import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// Fresh file per run (the web server starts before any global setup could clean it). Absolute, because the
// server script runs from packages/server. Never touches data/openvtt.db.
const TEMP_DB = resolve(import.meta.dirname, `e2e/.tmp/openvtt-${Date.now()}.db`);

export default defineConfig({
  testDir: "./e2e",
  // One worker: every test registers its own user against the same temporary database.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  // Reduced motion makes animations instant, so axe never measures a half-faded element.
  use: { baseURL: `http://localhost:${PORT}`, locale: "en-US", reducedMotion: "reduce", trace: "retain-on-failure" },
  projects: [
    // Locally the installed Chrome is used so no browser download is needed; CI installs Chromium.
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome" } },
    { name: "mobile-dark", use: { ...devices["Pixel 7"], colorScheme: "dark", channel: process.env.CI ? undefined : "chrome" } },
  ],
  webServer: {
    // The client must already be built (`pnpm build`); `pnpm test:e2e` does both.
    command: "pnpm --filter @openvtt/server start",
    url: `http://localhost:${PORT}/api/systems`,
    // /api/systems answers 401 without a session, which still proves the server is up.
    reuseExistingServer: false,
    env: { PORT: String(PORT), OPENVTT_DB: TEMP_DB },
  },
});
