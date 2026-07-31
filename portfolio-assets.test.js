import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
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
  it('keeps Sanjana & Shubash live when the maternity images exist', () => {
    const item = getGalleryItem('Sanjana &amp; Shubash');
    const folder = getAttr(item, 'data-folder');
    const count = Number(getAttr(item, 'data-count'));

    expect(item).toBeTruthy();
    expect(item).not.toContain('data-coming-soon="true"');

    for (let index = 1; index <= count; index += 1) {
      expect(existsSync(join(process.cwd(), folder, `${index}.jpg`))).toBe(true);
    }
  });
});
