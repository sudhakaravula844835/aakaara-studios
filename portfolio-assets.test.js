import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');

function getGalleryItem(title) {
  const pattern = new RegExp(`<a\\b[^>]*data-title="${title}"[^>]*>`, 'i');
  const match = html.match(pattern);
  return match ? match[0] : '';
}

function getAttr(markup, attr) {
  return markup.match(new RegExp(`${attr}="([^"]+)"`))?.[1] || '';
}

describe('portfolio asset wiring', () => {
  it.each([
    ['Shreya'],
    ['Sanjana &amp; Subhash'],
  ])('keeps %s live when the maternity images exist', (title) => {
    const item = getGalleryItem(title);
    const folder = getAttr(item, 'data-folder');
    const count = Number(getAttr(item, 'data-count'));

    expect(item).toBeTruthy();
    expect(item).not.toContain('data-coming-soon="true"');

    for (let index = 1; index <= count; index += 1) {
      expect(existsSync(join(process.cwd(), folder, `${index}.jpg`))).toBe(true);
    }
  });

  it('keeps MRGA gallery images within the web delivery budget', () => {
    const item = getGalleryItem('Mrga');
    const folder = getAttr(item, 'data-folder');
    const count = Number(getAttr(item, 'data-count'));
    const maxBytes = 2 * 1024 * 1024;

    expect(item).toBeTruthy();
    for (let index = 1; index <= count; index += 1) {
      const imagePath = join(process.cwd(), folder, `${index}.jpg`);
      expect(existsSync(imagePath)).toBe(true);
      expect(statSync(imagePath).size).toBeLessThanOrEqual(maxBytes);
    }
  });
});
