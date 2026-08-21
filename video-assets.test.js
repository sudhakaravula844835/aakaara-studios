import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
const watchHtml = readFileSync(join(process.cwd(), 'films/watch.html'), 'utf8');

function getVideoCard(title) {
  const pattern = new RegExp(`<div\\b[^>]*class="[^"]*vw-card[^"]*"[^>]*data-title="${title}"[^>]*>`, 'i');
  const match = html.match(pattern);
  return match ? match[0] : '';
}

function getAttr(markup, attr) {
  return markup.match(new RegExp(`${attr}="([^"]*)"`))?.[1] || '';
}

describe('video asset wiring', () => {
  it('wires the Manish & Sreeja pre-wedding HLS card', () => {
    const card = getVideoCard('Manish &amp; Sreeja');

    expect(card).toBeTruthy();
    expect(getAttr(card, 'data-vcat')).toBe('prewedding');
    expect(getAttr(card, 'data-type')).toBe('Pre-Wedding Film · NYC');
    expect(getAttr(card, 'data-poster')).toBe('/images/video-covers/prewedding/Manish-Sreeja.jpg');
    expect(getAttr(card, 'data-video')).toBe('https://vz-757250d0-999.b-cdn.net/ab5c8475-2b31-45b6-8054-1eeaf87359bd/playlist.m3u8');
  });

  it('wires Hemanth pre-wedding to a shareable watch page slug', () => {
    const card = getVideoCard('Hemanth');

    expect(card).toBeTruthy();
    expect(getAttr(card, 'data-vcat')).toBe('prewedding');
    expect(getAttr(card, 'data-type')).toBe('Pre-Wedding Film');
    expect(getAttr(card, 'data-poster')).toBe('/images/video-covers/prewedding/hemanth.jpg');
    expect(getAttr(card, 'data-video')).toBe('https://videos.aakaarastudiosnyc.com/ede4e777-1f11-42ee-935a-b5cd09d973b1/playlist.m3u8');
    expect(getAttr(card, 'data-share-slug')).toBe('hemanth-lasya');
  });

  it('only uses video share slugs that exist on the watch page', () => {
    const shareSlugs = Array.from(html.matchAll(/data-share-slug="([^"]+)"/g), match => match[1]);

    expect(shareSlugs).toContain('hemanth-lasya');
    expect(shareSlugs.length).toBeGreaterThan(1);
    for (const slug of shareSlugs) {
      expect(watchHtml).toContain(`'${slug}':`);
    }
  });

  it('normalizes accidental quote characters in shared film URLs', () => {
    expect(watchHtml).toContain('function normalizeSlug(value)');
    expect(watchHtml).toContain('const slug = normalizeSlug(');
    expect(watchHtml).toContain('hemanth-lasya');
  });
});
