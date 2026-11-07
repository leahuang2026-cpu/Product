import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 2,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
  },
  projects: [
    {
      name: "desktop-1440",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile-390",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "narrow-320",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 320, height: 760 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "tablet-768",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: "npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
