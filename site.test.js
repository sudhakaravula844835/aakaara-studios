const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

describe('Aakaara Studios Website Unit Tests', () => {
  
  // Helper to load HTML files into JSDOM
  const loadHtml = (filename) => {
    const filePath = path.resolve(__dirname, filename);
    const html = fs.readFileSync(filePath, 'utf8');
    const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable" });
    
    // Mock browser APIs not supported by JSDOM
    dom.window.IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));
    dom.window.scrollTo = jest.fn();
    dom.window.fetch = jest.fn();
    dom.window.Hls = class { static isSupported() { return false; } };
    dom.window.flatpickr = jest.fn();

    return dom.window;
  };

  describe('Home Page (index.html)', () => {
    let window, doc;
    beforeAll(() => { 
      window = loadHtml('index.html');
      doc = window.document;
      
      // Manually trigger Script.js execution in this window context
      const scriptPath = path.resolve(__dirname, 'Script.js');
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      const scriptElement = doc.createElement('script');
      scriptElement.textContent = scriptContent;
      doc.body.appendChild(scriptElement);
    });

    test('should have the correct SEO title', () => {
      expect(doc.title).toBe('Aakaara Studios NYC — Where Photography Feels Like Cinema');
    });

    test('should have essential meta tags', () => {
      const desc = doc.querySelector('meta[name="description"]');
      expect(desc).not.toBeNull();
      expect(desc.getAttribute('content')).toContain('Wedding, couple, maternity');
      
      const ogTitle = doc.querySelector('meta[property="og:title"]');
      expect(ogTitle).not.toBeNull();
    });

    test('navigation should contain key links', () => {
      const nav = doc.getElementById('navLinks');
      expect(nav).not.toBeNull();
      const links = Array.from(nav.querySelectorAll('a')).map(a => a.getAttribute('href'));
      expect(links).toContain('#portfolio');
      expect(links).toContain('#video-works');
      expect(links).toContain('/couple-portraits.html');
      expect(links).toContain('#contact');
    });

    test('portfolio section should be populated', () => {
      const portfolio = doc.getElementById('portfolio');
      expect(portfolio).not.toBeNull();
      const items = portfolio.querySelectorAll('.gallery-item');
      expect(items.length).toBeGreaterThan(0);
    });

    test('video works section should exist and have items', () => {
      const videoSection = doc.getElementById('video-works');
      expect(videoSection).not.toBeNull();
      const cards = videoSection.querySelectorAll('.vw-card');
      expect(cards.length).toBeGreaterThan(0);
    });

    test('contact form should be configured correctly', () => {
      const form = doc.getElementById('contactForm');
      expect(form).not.toBeNull();
      // Verify Formspree action
      expect(form.getAttribute('action')).toContain('https://formspree.io/f/');
      expect(form.method.toUpperCase()).toBe('POST');
      
      // Check required inputs
      expect(form.querySelector('input[name="email"]')).not.toBeNull();
      expect(form.querySelector('textarea[name="message"]')).not.toBeNull();
    });

    test('form submission should trigger fetch with form data', async () => {
      const form = doc.getElementById('contactForm');
      window.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      // Fill out form
      doc.getElementById('contactName').value = 'Jane Doe';
      doc.getElementById('contactEmail').value = 'jane@example.com';
      doc.getElementById('contactMessage').value = 'Wedding inquiry';

      // Dispatch submit event
      const event = new window.Event('submit', { cancelable: true, bubbles: true });
      form.dispatchEvent(event);

      expect(window.fetch).toHaveBeenCalledWith(
        expect.stringContaining('formspree.io'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(window.FormData)
        })
      );
    });

    test('gallery filtering should toggle visibility of items', () => {
      const weddingBtn = doc.querySelector('button[data-filter="wedding"]');
      const engagementItem = doc.querySelector('.gallery-item[data-cat="engagement"]');
      const weddingItem = doc.querySelector('.gallery-item[data-cat="wedding"]');

      // Simulate filter click
      weddingBtn.click();

      expect(weddingItem.style.display).toBe('');
      expect(engagementItem.style.display).toBe('none');
    });

    test('EtherealCarousel should re-render and update items after filtering', () => {
      // Access the global carousel instance created in Script.js
      const carousel = window.portfolioCarousel;
      expect(carousel).toBeDefined();

      const initialCount = carousel.filteredItems.length;
      const weddingBtn = doc.querySelector('button[data-filter="wedding"]');
      
      // Spy on the render method to verify it is called
      const renderSpy = jest.spyOn(carousel, 'render');

      // Trigger the filter - this calls filterGallery which triggers carousel.rebuild()
      weddingBtn.click();

      // 1. Verify internal state: filteredItems should only contain wedding items
      expect(carousel.filteredItems.length).toBeLessThan(initialCount);
      expect(carousel.currentIndex).toBe(0);
      
      // 2. Verify re-render was triggered
      expect(renderSpy).toHaveBeenCalled();

      // 3. Verify DOM: the first visible item must now have data-ec-offset="0"
      const firstWeddingItem = doc.querySelector('.gallery-item[data-cat="wedding"]');
      expect(firstWeddingItem.getAttribute('data-ec-offset')).toBe('0');

      renderSpy.mockRestore();
    });

    test('mobile filter bar should apply active class and trigger filtering', () => {
      const weddingBtn = doc.querySelector('.portfolio-filters button[data-filter="wedding"]');
      weddingBtn.click();

      expect(weddingBtn.classList.contains('active')).toBe(true);
      expect(doc.querySelector('.portfolio-filters button[data-filter="all"]').classList.contains('active')).toBe(false);
    });
  });

  describe('Couple Portraits Page (couple-portraits.html)', () => {
    let window, doc;
    beforeAll(() => { 
      window = loadHtml('couple-portraits.html');
      doc = window.document;
    });

    test('should have the correct title', () => {
      expect(doc.title).toBe('Couple Portraits — Aakaara Studios NYC');
    });

    test('location guide should be present', () => {
      const guide = doc.querySelector('.location-guide');
      expect(guide).not.toBeNull();
      const locations = doc.querySelectorAll('.nyc-loc');
      expect(locations.length).toBeGreaterThan(0);
    });

    test('masonry grid should contain work items', () => {
      const items = doc.querySelectorAll('.work-item');
      expect(items.length).toBeGreaterThan(0);
    });

    test('images should have accessibility attributes', () => {
      const images = doc.querySelectorAll('.work-item img');
      images.forEach(img => {
        expect(img.getAttribute('alt')).toBeTruthy();
        expect(img.getAttribute('loading')).toBe('lazy');
      });
    });

    test('filter bar should have filter buttons', () => {
      const filters = doc.querySelectorAll('.filter-btn');
      expect(filters.length).toBeGreaterThan(0);
      
      // Check if data-filter attributes match existing locations in items
      const itemLocations = new Set(Array.from(doc.querySelectorAll('.work-item')).map(i => i.dataset.location));
      const filterValues = new Set(Array.from(filters).map(f => f.dataset.filter));
      
      // Ensure 'all' exists
      expect(filterValues.has('all')).toBe(true);
      
      // Ensure filters correspond to actual data (sanity check)
      itemLocations.forEach(loc => {
        if (loc) expect(filterValues.has(loc)).toBe(true);
      });
    });

    test('back button should link to home', () => {
      const backBtn = doc.querySelector('.back-btn');
      expect(backBtn).not.toBeNull();
      expect(backBtn.getAttribute('href')).toBe('index.html');
    });
  });

  describe('404 Page (404.html)', () => {
    let window, doc;
    beforeAll(() => { 
      window = loadHtml('404.html');
      doc = window.document;
    });

    test('should have a "noindex" robot meta tag', () => {
      const robots = doc.querySelector('meta[name="robots"]');
      expect(robots).not.toBeNull();
      expect(robots.getAttribute('content')).toContain('noindex');
    });

    test('should display a helpful error message', () => {
      const title = doc.querySelector('.not-found-title');
      expect(title.textContent).toContain("This page doesn't exist");
    });

    test('should provide a link back to home', () => {
      const link = doc.querySelector('.not-found-link');
      expect(link).not.toBeNull();
      expect(link.getAttribute('href')).toBe('index.html');
    });
  });

  describe('Thank You Page (thank-you.html)', () => {
    let window, doc;
    beforeAll(() => { 
      window = loadHtml('thank-you.html');
      doc = window.document;
    });

    test('should confirm message receipt', () => {
      const title = doc.querySelector('.thank-you-title');
      expect(title.textContent).toBe('Thank You for Reaching Out');
      
      const message = doc.querySelector('.thank-you-message');
      expect(message.textContent).toContain('24 hours');
    });
  });
});