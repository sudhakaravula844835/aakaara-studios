import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');

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
    expect(getAttr(card, 'data-video')).toBe('https://vz-757250d0-999.b-cdn.net/ab5c8475-2b31-45b6-8054-1eeaf87359bd/playlist.m3u8');
  });
});
