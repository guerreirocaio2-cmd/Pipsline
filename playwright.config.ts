import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx tsx tests/e2e-server.ts",
    url: "http://127.0.0.1:4173/api/health",
    reuseExistingServer: false,
    timeout: 15000,
  },
});
