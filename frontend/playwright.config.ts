import { defineConfig, devices } from '@playwright/test'

/**
 * E2E tests require both servers to be running:
 *   backend : uvicorn main:app --port 8000   (cd backend)
 *   frontend: npm run dev                     (cd frontend)
 *
 * Or start them manually and set reuseExistingServer: true (already set below).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 15_000,
    },
  ],
})
