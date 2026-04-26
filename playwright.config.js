const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './',
  testMatch: '*.spec.js',
  testIgnore: [],
  fullyParallel: true,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173', 
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npx http-server . -p 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
