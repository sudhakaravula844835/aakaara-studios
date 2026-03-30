import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const html = fs.readFileSync(path.resolve(__dirname, './couple-portraits.html'), 'utf8');
const script = fs.readFileSync(path.resolve(__dirname, './Script.js'), 'utf8');

describe('Location Guide Interaction', () => {
  let document;

  beforeEach(() => {
    const dom = new JSDOM(html, { runScripts: "dangerously" });
    document = dom.window.document;
    const { window } = dom;

    // Mock missing browser globals in JSDOM context
    window.IntersectionObserver = class IntersectionObserver {
      constructor() {}
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    window.requestAnimationFrame = (callback) => setTimeout(callback, 0);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
    window.scrollTo = () => {};
    
    // Mock external libraries used in Script.js to prevent runtime errors
    window.Hls = class { static isSupported() { return false; } };
    window.flatpickr = () => ({ set: () => {} });

    // Inject Script.js content manually. 
    // JSDOM does not automatically load external scripts from the local filesystem.
    const scriptEl = document.createElement('script');
    scriptEl.textContent = script;
    document.body.appendChild(scriptEl);
  });

  it('should activate the correct preview image on hover', () => {
    const locationTrigger = document.querySelector('.nyc-loc[data-location-id="dumbo"]');
    const dumboPreview = document.querySelector('.nyc-preview-img.nyc-dumbo');
    const centralParkPreview = document.querySelector('.nyc-preview-img.nyc-cp');

    // Simulate mouseenter
    const event = new document.defaultView.MouseEvent('mouseenter');
    locationTrigger.dispatchEvent(event);

    // Check classes
    expect(dumboPreview.classList.contains('active')).toBe(true);
    expect(centralParkPreview.classList.contains('active')).toBe(false);
  });
});