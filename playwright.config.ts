import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  // Tests share one seeded database, so run them one at a time.
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:3000",
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
  },
  projects: [{ name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 1180, height: 820 } } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
