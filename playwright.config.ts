import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3001",
    screenshot: "on",
    trace: "retain-on-failure",
  },
  outputDir: "tests/screenshots",
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "npx next dev --port 3001",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
