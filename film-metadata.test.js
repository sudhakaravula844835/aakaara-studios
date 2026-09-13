import { test, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM } from 'jsdom';

test('all film routes serve unique crawler-readable metadata and generation is repeatable', () => {
  execFileSync(process.execPath, ['build/generate-film-pages.mjs']);
  const redirects = readFileSync('_redirects', 'utf8');
  const titles = new Set();
  const files = readdirSync('films/generated').filter(file => file.endsWith('.html'));
  expect(files.length).toBeGreaterThan(20);
  for (const file of files) {
    const slug = file.replace('.html', '');
    const doc = new JSDOM(readFileSync(`films/generated/${file}`, 'utf8')).window.document;
    titles.add(doc.title);
    expect(doc.querySelector('[property="og:title"]').content).toBe(doc.title);
    expect(doc.querySelector('[name="twitter:title"]').content).toBe(doc.title);
    expect(doc.querySelector('[property="og:image"]').content).toMatch(/^https:\/\//);
    expect(doc.querySelector('[name="twitter:image"]').content).toBe(doc.querySelector('[property="og:image"]').content);
    expect(doc.querySelector('[rel="canonical"]').href).toBe(`https://aakaarastudios.com/films/${slug}`);
    expect(redirects.indexOf(`/films/${slug}  `)).toBeLessThan(redirects.indexOf('/films/:slug'));
    expect(redirects).toContain(`/films/${slug}  /films/generated/${slug}.html  200`);
  }
  expect(titles.size).toBe(files.length);
  execFileSync(process.execPath, ['build/generate-film-pages.mjs']);
  expect(readFileSync('_redirects', 'utf8')).toBe(redirects);
});
