import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const html = fs.readFileSync(path.resolve(__dirname, './couple-portraits.html'), 'utf8');

describe('Location Guide Interaction', () => {
  let document;
  let window;

  beforeEach(async () => {
    const dom = new JSDOM(html, {
      runScripts: 'dangerously',
      url: 'https://www.aakaarastudiosnyc.com/couple-portraits.html',
      beforeParse(parsedWindow) {
        parsedWindow.IntersectionObserver = class IntersectionObserver {
          observe() {}
          unobserve() {}
          disconnect() {}
        };
        parsedWindow.matchMedia = () => ({
          matches: false,
          media: '',
          addEventListener() {},
          removeEventListener() {},
          addListener() {},
          removeListener() {},
          dispatchEvent() { return false; }
        });
        parsedWindow.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
        parsedWindow.cancelAnimationFrame = (id) => clearTimeout(id);
        parsedWindow.scrollTo = () => {};
      }
    });

    window = dom.window;
    document = window.document;

    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it('marks the first location preview active by default', () => {
    const centralParkPreview = document.querySelector('.nyc-preview-img.nyc-cp');
    const activeLocation = document.querySelector('.nyc-loc.is-active');

    expect(centralParkPreview?.classList.contains('active')).toBe(true);
    expect(activeLocation?.dataset.locationId).toBe('cp');
  });

  it('activates the matching preview when a different location is hovered', () => {
    const dumboLocation = document.querySelector('.nyc-loc[data-location-id="dumbo"]');
    const dumboPreview = document.querySelector('.nyc-preview-img.nyc-dumbo');
    const centralParkPreview = document.querySelector('.nyc-preview-img.nyc-cp');

    dumboLocation.dispatchEvent(new window.MouseEvent('mouseenter', { bubbles: true }));

    expect(dumboLocation.classList.contains('is-active')).toBe(true);
    expect(dumboPreview.classList.contains('active')).toBe(true);
    expect(centralParkPreview.classList.contains('active')).toBe(false);
  });
});
