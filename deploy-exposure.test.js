import { test, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// netlify.toml publishes the repo root, so every tracked file is served unless
// _redirects hides it. These checks keep internal files from leaking to prod.
const rules = readFileSync('_redirects', 'utf8')
  .split('\n')
  .map(line => line.trim())
  .filter(line => line && !line.startsWith('#'))
  .map(line => line.split(/\s+/));
const hidden = rules.filter(([, to, status]) => to === '/404.html' && status === '404!').map(([from]) => from);
const isHidden = path => hidden.some(rule => rule.endsWith('/*') ? path.startsWith(rule.slice(0, -1)) : path === rule);

test('root-level docs, specs and unit tests are hidden from the deployed site', () => {
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n');
  const internal = tracked.filter(file => !file.includes('/') && /\.(md|spec\.js|test\.js)$/.test(file));
  expect(internal.length).toBeGreaterThan(0);
  for (const file of internal) expect(isHidden(`/${file}`), `/${file} is publicly served`).toBe(true);
});

test('internal folders are hidden and the rules beat the /board/* passthrough', () => {
  for (const path of ['/docs/plans/x.md', '/board/test/helpers.js', '/netlify/edge-functions/admin-auth.ts']) {
    expect(isHidden(path), path).toBe(true);
  }
  const froms = rules.map(([from]) => from);
  expect(froms.indexOf('/board/test/*')).toBeLessThan(froms.indexOf('/board/*'));
});

test('public pages and assets are not hidden', () => {
  for (const path of ['/', '/index.html', '/styles.css', '/Script.js', '/photo-journal.js', '/experience-3d.js',
    '/couple-portraits.html', '/intake.html', '/films/watch.html', '/board/index.html', '/templates/include.js',
    '/robots.txt', '/sitemap.xml', '/testimonials.json']) {
    expect(isHidden(path), path).toBe(false);
  }
});
