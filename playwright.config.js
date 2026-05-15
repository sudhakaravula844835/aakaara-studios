const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './',
  testMatch: '*.spec.js',
  testIgnore: ['**/.claude/**', '**/node_modules/**', '**/gallery-preview/**'],
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
    command: 'python3 -m http.server 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
