import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PLAYWRIGHT_PORT ?? "3099";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `rm -f .playwright-test.db .playwright-test.db-journal && npm run build && PORT=${PORT} npm run start`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 360_000,
    env: {
      ...process.env,
      PORT,
      PAYLOAD_SECRET:
        process.env.PAYLOAD_SECRET ?? "playwright-test-secret-minimum-32-characters",
      DATABASE_URI: process.env.DATABASE_URI ?? "file:./.playwright-test.db",
      PAYLOAD_SQLITE_PUSH_SCHEMA: "1",
      NEXT_PUBLIC_SITE_URL: baseURL,
      NEXT_PUBLIC_SERVER_URL: baseURL,
      NODE_ENV: "production",
    },
  },
});
