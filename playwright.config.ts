import { defineConfig, devices } from "@playwright/test";

const externalServer = Boolean(process.env.PLAYWRIGHT_BASE_URL);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./apps/web/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: externalServer
    ? undefined
    : {
        command: "npm run start --workspace @bioctl/web",
        reuseExistingServer: true,
        timeout: 60_000,
        url: baseURL,
      },
});
