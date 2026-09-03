import { defineConfig, devices } from "@playwright/test";

const e2ePort = 3197;
const e2eBaseUrl = `http://localhost:${e2ePort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: e2eBaseUrl, screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: process.env.CI
      ? `npm run start -- -p ${e2ePort}`
      : `npm run dev -- -p ${e2ePort}`,
    url: `${e2eBaseUrl}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { BETTER_AUTH_URL: e2eBaseUrl, NEXT_PUBLIC_APP_URL: e2eBaseUrl },
  },
});
