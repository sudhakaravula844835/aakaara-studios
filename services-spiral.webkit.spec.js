// Same cases as services-spiral.spec.js, in WebKit (Safari's engine).
// browserName must be set at the top level: Playwright rejects it inside a
// describe, and the project config's `projects` rule out `--browser`.
const { test, expect } = require('@playwright/test');
test.use({ browserName: 'webkit' });
require('./services-spiral.cases')(test, expect);
