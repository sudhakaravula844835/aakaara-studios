// ═══════ SMART NAVIGATION (HEADER COMPONENT LOGIC) ═══════
(function() {
  // This script runs immediately when Script.js is loaded.
  // By this point, include.js has already fetched and injected the header.
  const nav = document.getElementById('navbar');
  if (!nav) return;

  const navLinks = nav.querySelector('#navLinks');
  const logoLink = nav.querySelector('.nav-logo');
  const pathname = window.location.pathname;
  
  // A more robust check for the index page, works for both local and deployed paths
  const isIndex = ['', '/', '/index.html'].some(p => pathname.endsWith(p));

  // 1. Fix anchor links on sub-pages
  if (!isIndex) {
    if (logoLink) logoLink.href = 'index.html';
    if (navLinks) {
      navLinks.querySelectorAll('a[href^="#"]').forEach(a => {
        a.href = `index.html${a.getAttribute('href')}`;
      });
    }
  }

  // 2. Set active class for the current page's link
  const currentPageLink = Array.from(navLinks.querySelectorAll('a')).find(a => a.href === window.location.href);
  if (currentPageLink) {
    currentPageLink.classList.add('active');
  }
})();

const externalAssetPromises = new Map();

function loadScriptOnce(src, globalName) {
  if (globalName && window[globalName]) return Promise.resolve(window[globalName]);

  const cacheKey = `script:${src}`;
  if (externalAssetPromises.has(cacheKey)) return externalAssetPromises.get(cacheKey);

  const promise = new Promise((resolve, reject) => {
    let script = Array.from(document.scripts).find(node => node.src === src);
    const cleanup = () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };
    const onLoad = () => {
      cleanup();
      resolve(globalName ? window[globalName] : script);
    };
    const onError = () => {
      cleanup();
      externalAssetPromises.delete(cacheKey);
      reject(new Error(`Failed to load ${src}`));
    };

    if (!script) {
      script = document.createElement('script');
      script.src = src;
      script.async = true;
      document.head.appendChild(script);
    }

    if (globalName && window[globalName]) {
      resolve(window[globalName]);
      return;
    }

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
  });

  externalAssetPromises.set(cacheKey, promise);
  return promise;
}

function ensureHlsLibrary() {
  return loadScriptOnce('https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js', 'Hls');
}

// PERF FIX: lazy-inject a <link rel="stylesheet"> once; subsequent calls are no-ops
function loadCssOnce(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function ensureFlatpickrLibrary() {
  // PERF FIX: Flatpickr CSS injected here (lazily on first date-field focus) instead of
  // blocking the initial render via a <link> in <head>. Saves one cross-origin stylesheet
  // request on every page load for users who never touch the contact form date pickers.
  // WARN FIX 2: pinned Flatpickr to @4.6.13
  loadCssOnce('https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/themes/dark.css');
  return loadScriptOnce('https://cdn.jsdelivr.net/npm/flatpickr@4.6.13', 'flatpickr');
}
// ═══════ CINEMATIC INTRO ANIMATION ═══════
(function() {
  const intro = document.getElementById('intro');
  if (!intro) return;
  const heroContent = document.getElementById('heroContent');
  const heroScroll = document.getElementById('heroScroll');
  const navbar = document.getElementById('navbar');
  const shouldSkipIntro =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    Boolean(navigator.connection && navigator.connection.saveData);

  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  function revealHeroImmediately() {
    intro.classList.add('hidden');
    document.body.classList.remove('intro-active');
    if (heroContent) heroContent.style.opacity = '1';
    if (heroScroll) heroScroll.style.opacity = '1';
    if (navbar) navbar.classList.add('visible');
  }

  function runMobileIntro() {
    const mark = document.getElementById('introMark');
    const petals = [
      document.getElementById('petal1'),
      document.getElementById('petal2'),
      document.getElementById('petal3'),
      document.getElementById('petal4')
    ];
    const outerRing = document.getElementById('outerRing');
    const centerDot = document.getElementById('centerDot');
    const letters = document.querySelectorAll('#introTitle .letter');
    const dots = document.getElementById('introDots');
    const t = (delay, fn) => setTimeout(fn, delay);

    t(200, () => {
      mark.style.transition = 'opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)';
      mark.style.opacity = '1';
      mark.style.transform = 'scale(1)';
    });

    petals.forEach((p, i) => {
      t(250 + i * 150, () => {
        p.style.transition = 'stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1)';
        p.style.strokeDashoffset = '0';
      });
    });

    t(550, () => {
      if (outerRing) {
        outerRing.style.transition = 'opacity 0.5s cubic-bezier(0.16,1,0.3,1)';
        outerRing.style.opacity = '0.18';
      }
    });

    t(600, () => {
      centerDot.style.transition = 'r 0.4s cubic-bezier(0.16,1,0.3,1), opacity 0.4s cubic-bezier(0.16,1,0.3,1)';
      centerDot.setAttribute('r', '5');
      centerDot.style.opacity = '0.85';
    });

    t(700, () => {
      const WORD     = ['A','a','k','a','a','r','a'];
      const VARIANTS = { A: ['అ','अ','அ','A'], a: ['అ','अ','அ','a'], k: ['క','क','க','k'], r: ['ర','र','ர','r'] };
      const cycleMs  = 55;

      letters.forEach(el => {
        const w = el.getBoundingClientRect().width;
        if (w > 0) el.style.width = w + 'px';
      });
      letters.forEach(el => {
        el.style.transition = 'none';
        el.style.transform = 'translateY(8px)';
        el.style.opacity = '0';
      });

      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

      async function cycleLetter(el, char) {
        const vars = VARIANTS[char] || [char];
        el.style.transition = 'opacity 0.18s cubic-bezier(0.16,1,0.3,1), transform 0.38s cubic-bezier(0.16,1,0.3,1)';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
        for (let i = 0; i < vars.length - 1; i++) {
          el.textContent = vars[i];
          await sleep(cycleMs);
        }
        el.textContent = char;
      }

      (async () => {
        for (let i = 0; i < WORD.length; i++) await cycleLetter(letters[i], WORD[i]);
        dots.style.transition = 'opacity 0.55s cubic-bezier(0.16,1,0.3,1), transform 0.55s cubic-bezier(0.16,1,0.3,1)';
        dots.style.opacity = '1';
        dots.style.transform = 'scale(1)';
      })();
    });

    t(2000, () => {
      const introGroup = document.getElementById('introGroup');
      const navLogo = document.querySelector('.nav-logo');
      if (!introGroup || !navLogo) return;
      const navRect = navLogo.getBoundingClientRect();
      const groupRect = introGroup.getBoundingClientRect();
      const dx = navRect.left + navRect.width / 2 - (groupRect.left + groupRect.width / 2);
      const dy = navRect.top + navRect.height / 2 - (groupRect.top + groupRect.height / 2);
      introGroup.style.transition = 'transform 1.0s cubic-bezier(0.16,1,0.3,1)';
      introGroup.style.transform = `translate(${dx}px, ${dy}px) scale(0.22)`;
      intro.classList.add('fade-out');
      document.body.classList.remove('intro-active');
      const hc = document.getElementById('heroContent');
      if (hc) { hc.style.transition = 'opacity 1.2s cubic-bezier(0.16,1,0.3,1)'; hc.style.opacity = '1'; }
      const hs = document.getElementById('heroScroll');
      if (hs) t(500, () => { hs.style.transition = 'opacity 1s cubic-bezier(0.16,1,0.3,1)'; hs.style.opacity = '1'; });
    });

    t(2900, () => {
      const introGroup = document.getElementById('introGroup');
      if (introGroup) {
        introGroup.style.transition = 'opacity 0.5s cubic-bezier(0.16,1,0.3,1)';
        introGroup.style.opacity = '0';
      }
      navbar.classList.add('visible');
    });

    t(3600, () => { intro.classList.add('hidden'); });
  }

  // Skip intro when returning from a sub-page (e.g. couple-portraits)
  if (sessionStorage.getItem('skipIntro') === '1') {
    const savedY = parseInt(sessionStorage.getItem('returnScrollY') || '0', 10);
    sessionStorage.removeItem('skipIntro');
    sessionStorage.removeItem('returnScrollY');
    revealHeroImmediately();
    // Restore scroll after layout settles
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, savedY)));
    return;
  }

  // Skip intro if directly arriving via anchor hash (e.g. #contact, #video-works, #portfolio)
  if (window.location.hash && window.location.hash !== '#' && window.location.hash !== '#home') {
    revealHeroImmediately();
    requestAnimationFrame(() => {
      const target = document.querySelector(window.location.hash);
      if (target) {
        setTimeout(() => target.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    });
    return;
  }

  if (shouldSkipIntro) {
    revealHeroImmediately();
    return;
  }
  if (isMobile) { runMobileIntro(); return; }

  const mark = document.getElementById('introMark');
  const petals = [document.getElementById('petal1'), document.getElementById('petal2'), document.getElementById('petal3'), document.getElementById('petal4')];
  const outerRing = document.getElementById('outerRing');
  const centerDot = document.getElementById('centerDot');
  const letters = document.querySelectorAll('#introTitle .letter');
  const dots = document.getElementById('introDots');
  const sub = document.getElementById('introSub');
  const tag = document.getElementById('introTag');
  const t = (delay, fn) => setTimeout(fn, delay);
  t(300, () => { mark.style.transition = 'opacity 1s cubic-bezier(0.16,1,0.3,1), transform 1s cubic-bezier(0.16,1,0.3,1)'; mark.style.opacity = '1'; mark.style.transform = 'scale(1)'; });
  petals.forEach((p, i) => { t(500 + i * 280, () => { p.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)'; p.style.strokeDashoffset = '0'; }); });
  t(1100, () => { if (outerRing) { outerRing.style.transition = 'opacity 0.8s cubic-bezier(0.16,1,0.3,1)'; outerRing.style.opacity = '0.18'; } });
  t(1200, () => { centerDot.style.transition = 'r 0.6s cubic-bezier(0.16,1,0.3,1), opacity 0.6s cubic-bezier(0.16,1,0.3,1)'; centerDot.setAttribute('r', '5'); centerDot.style.opacity = '0.85'; });
  // Script-cycling letter reveal starts with the petals and resolves before the copy appears.
  t(500, () => {
    const WORD     = ['A','a','k','a','a','r','a'];
    const VARIANTS = { A: ['అ','अ','அ','α','А','أ','あ','A'], a: ['అ','अ','அ','α','А','أ','あ','a'], k: ['క','क','க','κ','К','ك','か','k'], r: ['ర','र','ர','ρ','р','ر','ら','r'] };
    const cycleMs = Math.floor(2040 / (WORD.length * 7)); // ~41ms

    // Lock each letter to its natural English width so non-Latin glyphs do not reflow the layout.
    letters.forEach(el => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) el.style.width = w + 'px';
    });

    // Reset CSS defaults so cycling starts clean.
    letters.forEach(el => { el.style.transition = 'none'; el.style.transform = 'translateY(8px)'; el.style.filter = 'none'; el.style.opacity = '0'; });

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    async function cycleLetter(el, char) {
      const vars = VARIANTS[char] || [char];
      el.style.transition = 'opacity 0.2s cubic-bezier(0.16,1,0.3,1), transform 0.5s cubic-bezier(0.16,1,0.3,1)';
      el.style.opacity = '1'; el.style.transform = 'translateY(0)';
      for (let i = 0; i < vars.length - 1; i++) { el.textContent = vars[i]; await sleep(cycleMs); }
      el.textContent = char;
    }

    // Letters cycle sequentially; dots appear when last letter locks
    (async () => {
      for (let i = 0; i < WORD.length; i++) await cycleLetter(letters[i], WORD[i]);
      dots.style.transition = 'opacity 0.55s cubic-bezier(0.16,1,0.3,1), transform 0.55s cubic-bezier(0.16,1,0.3,1)';
      dots.style.opacity = '1'; dots.style.transform = 'scale(1)';
    })();
  });

  t(2900, () => {
    // Subtitle: letter-spacing expands from 0 to full after the name resolves.
    sub.style.letterSpacing = '0em';
    sub.style.opacity = '0';
    sub.style.transition = 'none';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      sub.style.transition = 'letter-spacing 1.5s cubic-bezier(0.16,1,0.3,1), opacity 0.9s cubic-bezier(0.16,1,0.3,1)';
      sub.style.letterSpacing = '0.6em';
      sub.style.opacity = '1';
    }));
  });

  t(3200, () => {
    // Tagline: reveal as a complete line so the phrase never reads as broken.
    tag.textContent = 'Every story deserves its own canvas.';
    tag.style.opacity = '0';
    tag.style.transform = 'translateY(6px)';
    tag.style.transition = 'none';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      tag.style.transition = 'opacity 0.65s cubic-bezier(0.16,1,0.3,1), transform 0.65s cubic-bezier(0.16,1,0.3,1)';
      tag.style.opacity = '1';
      tag.style.transform = 'translateY(0)';
    }));
  });

  // MOB-03 FIX: Reveal hero content earlier (at 2.6s instead of 4.2s) to satisfy LCP
  t(2600, () => { const hc = document.getElementById('heroContent'); if(hc) hc.style.opacity = '0.4'; });
  t(4200, () => {
    const introGroup = document.getElementById('introGroup');
    navbar.style.transition = 'none'; navbar.style.opacity = '0'; navbar.style.transform = 'translateY(0)'; navbar.offsetHeight;
    const navLogo = document.querySelector('.nav-logo');
    const navRect = navLogo.getBoundingClientRect();
    const groupRect = introGroup.getBoundingClientRect();
    const dx = navRect.left + navRect.width / 2 - (groupRect.left + groupRect.width / 2);
    const dy = navRect.top + navRect.height / 2 - (groupRect.top + groupRect.height / 2);
    const scale = 0.22;
    navbar.style.opacity = ''; navbar.style.transform = ''; navbar.style.transition = '';
    sub.style.transition = 'opacity 0.4s cubic-bezier(0.16,1,0.3,1)'; sub.style.opacity = '0';
    tag.style.transition = 'opacity 0.4s cubic-bezier(0.16,1,0.3,1)'; tag.style.opacity = '0';
    t(350, () => {
      mark.style.transition = 'margin 0.9s cubic-bezier(0.16,1,0.3,1)'; mark.style.marginBottom = '0.3rem';
      introGroup.style.transition = 'transform 1.1s cubic-bezier(0.16,1,0.3,1)';
      introGroup.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
      intro.classList.add('fade-out'); document.body.classList.remove('intro-active');
      const hc = document.getElementById('heroContent'); hc.style.transition = 'opacity 1.2s cubic-bezier(0.16,1,0.3,1)'; hc.style.opacity = '1';
      const hs = document.getElementById('heroScroll'); t(500, () => { hs.style.transition = 'opacity 1s cubic-bezier(0.16,1,0.3,1)'; hs.style.opacity = '1'; });
    });
    t(1500, () => { introGroup.style.transition = 'opacity 0.5s cubic-bezier(0.16,1,0.3,1)'; introGroup.style.opacity = '0'; navbar.classList.add('visible'); });
    t(2300, () => { intro.classList.add('hidden'); });
  });
})();

// ═══════ MOBILE NAVIGATION TOGGLE ═══════
(function() {
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.getElementById('navLinks');
  const nav = document.getElementById('navbar');

  if (!navToggle || !navLinks) return;

  function closeMenu() {
    navLinks.classList.remove('show');
    navToggle.setAttribute('aria-expanded', 'false');
  }

  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('show');
    navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  // Close menu when a nav link is tapped on mobile
  navLinks.addEventListener('click', (e) => {
    if (e.target.tagName === 'A' && navLinks.classList.contains('show')) {
      closeMenu();
    }
  });

  // MOBILE FIX: close menu when tapping anywhere outside the nav bar
  document.addEventListener('click', (e) => {
    if (navLinks.classList.contains('show') && nav && !nav.contains(e.target)) {
      closeMenu();
    }
  }, { passive: true });

  // MOBILE FIX: close menu on Escape key for keyboard/switch-access users
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navLinks.classList.contains('show')) {
      closeMenu();
      navToggle.focus();
    }
  });
})();



// ═══════ SCROLL — Letter Spacing + Background logo ═══════
(function() {
  const heroTitle = document.getElementById('heroTitle');
  const bgMark = document.getElementById('heroBgMark');
  const hero = document.querySelector('.hero');
  if (!heroTitle || !bgMark || !hero) return;
  const heroH = hero.offsetHeight;
  let heroSpacingMin = 0.18;
  let heroSpacingMax = 1;

  function updateHeroSpacing() {
    if (window.innerWidth <= 480) {
      heroSpacingMin = 0.12;
      heroSpacingMax = 0.34;
    } else if (window.innerWidth <= 768) {
      heroSpacingMin = 0.14;
      heroSpacingMax = 0.5;
    } else {
      heroSpacingMin = 0.18;
      heroSpacingMax = 1;
    }
  }

  updateHeroSpacing();

  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const progress = Math.min(y / heroH, 1);
    heroTitle.style.letterSpacing = (heroSpacingMin + progress * (heroSpacingMax - heroSpacingMin)) + 'em';
    bgMark.style.opacity = progress > 0.2 ? Math.min((progress - 0.2) * 1.5, 1) : 0;
    document.getElementById('heroContent').style.opacity = Math.max(1 - progress * 1.5, 0);
    document.getElementById('navbar').classList.toggle('scrolled', y > 60);
  }, { passive: true });
  window.addEventListener('resize', updateHeroSpacing, { passive: true });
})();

// ═══════ REVEAL ON SCROLL ═══════
const revealObs = new IntersectionObserver((entries) => {
  let panelStaggerIndex = 0;
  entries.forEach(e => {
    if (e.isIntersecting) {
      if (e.target.classList.contains('about-panel')) {
        e.target.style.transitionDelay = `${panelStaggerIndex * 0.15}s`;
        panelStaggerIndex++;
      }
      e.target.classList.add('visible');
      revealObs.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

// ═══════ PORTFOLIO FILTER ═══════
function filterGallery(cat, btn) {
  const search = document.getElementById('portfolioSearch');
  if (search) search.value = ''; // Clear search when filtering
  const select = document.getElementById('portfolioSelect');
  if (select) select.value = ''; // Clear select when filtering
  const noResults = document.getElementById('galleryNoResults');
  if (noResults) noResults.style.display = 'none';
  document.querySelectorAll('.portfolio-filters button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // GA4 FIX: track which portfolio categories users navigate to most.
  // Reveals which service types drive the most browsing intent.
  if (typeof gtag === 'function') {
    gtag('event', 'portfolio_filter', {
      event_category: 'Navigation',
      event_label: btn.textContent.trim(),
      filter_value: cat
    });
  }

  // Disable gallery-item transitions so category switch feels instant
  const allItems = document.querySelectorAll('.gallery-item');
  allItems.forEach(item => { item.style.transition = 'none'; });

  if (cat === 'all') {
    const shownCats = new Set();
    allItems.forEach(item => {
      const itemCat = item.dataset.cat;
      if (item.dataset.hideAll === 'true') {
        item.style.display = 'none';
      } else if (!shownCats.has(itemCat)) {
        item.style.display = '';
        shownCats.add(itemCat);
      } else {
        item.style.display = 'none';
      }
    });
  } else {
    allItems.forEach(item => {
      item.style.display = item.dataset.cat === cat ? '' : 'none';
    });
  }
  if (typeof portfolioCarousel !== 'undefined' && portfolioCarousel) { portfolioCarousel.currentIndex = 0; portfolioCarousel.rebuild(); }

  // Re-enable transitions after a frame so next interactions (hover, nav) animate smoothly
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      allItems.forEach(item => { item.style.transition = ''; });
    });
  });
}

// ═══════ PORTFOLIO SEARCH ═══════
const searchInput = document.getElementById('portfolioSearch');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const select = document.getElementById('portfolioSelect');
    if (select) select.value = ''; // Clear select when searching
    document.querySelectorAll('.portfolio-filters button').forEach(b => b.classList.remove('active'));
    let visibleCount = 0;
    
    document.querySelectorAll('.gallery-item').forEach(item => {
      const title = (item.dataset.title || '').toLowerCase();
      const type = (item.dataset.type || '').toLowerCase();
      if (term === '' || title.includes(term) || type.includes(term)) {
        item.style.display = '';
        visibleCount++;
      } else {
        item.style.display = 'none';
      }
    });

    const noResults = document.getElementById('galleryNoResults');
    if (noResults) {
      noResults.style.display = visibleCount === 0 ? 'block' : 'none';
    }
    if (typeof portfolioCarousel !== 'undefined' && portfolioCarousel) { portfolioCarousel.currentIndex = 0; portfolioCarousel.rebuild(); }
  });
}

// ═══════ PORTFOLIO SELECT ═══════
const portfolioSelect = document.getElementById('portfolioSelect');
if (portfolioSelect) {
  // Populate options from extracted entries
  const titles = [];
  document.querySelectorAll('.gallery-item').forEach(item => {
    const t = item.dataset.title;
    if (t && !titles.includes(t)) titles.push(t);
  });
  titles.sort().forEach(title => {
    const opt = document.createElement('option');
    opt.value = title;
    opt.textContent = title;
    portfolioSelect.appendChild(opt);
  });

  // Filter on change
  portfolioSelect.addEventListener('change', (e) => {
    const selected = e.target.value;
    const search = document.getElementById('portfolioSearch');
    if (search) search.value = '';
    
    document.querySelectorAll('.portfolio-filters button').forEach(b => b.classList.remove('active'));
    if (selected === '') document.querySelector('.portfolio-filters button').classList.add('active'); // Reset to All
    
    document.querySelectorAll('.gallery-item').forEach(item => {
      const match = selected === '' || item.dataset.title === selected;
      item.style.display = match ? '' : 'none';
    });
    if (typeof portfolioCarousel !== 'undefined' && portfolioCarousel) { portfolioCarousel.currentIndex = 0; portfolioCarousel.rebuild(); }
  });
}

// ═══════ PORTFOLIO STORY CARDS ═══════
const portfolioNarrativeDefaults = {
  wedding: {
    kicker: 'Wedding Story',
    scene: '',
    story: 'A quiet beginning, then a celebration that gathered everyone close.'
  },
  engagement: {
    kicker: 'Engagement Session',
    scene: '',
    story: 'Soft light, easy laughter, and the feeling of what comes next.'
  },
  couple: {
    kicker: 'Portrait Session',
    scene: '',
    story: 'Two people, one rhythm, and a frame that lingers a little longer.'
  },
  graduation: {
    kicker: 'Graduation Portraits',
    scene: 'Milestone Story',
    story: 'A chapter closing with pride, and the next one already in view.'
  },
  maternity: {
    kicker: 'Maternity Story',
    scene: '',
    story: 'A season of waiting, tenderness, and becoming held with care.'
  },
  brand: {
    kicker: 'Brand Story',
    scene: 'Editorial Collaboration',
    story: 'Craft, texture, and identity shaped into images with quiet confidence.'
  },
  housewarming: {
    kicker: 'House Warming',
    scene: 'Home Story',
    story: 'Blessings, movement, and a home slowly filling with meaning.'
  },
  events: {
    kicker: 'Event Story',
    scene: 'Live Coverage',
    story: 'A fast-moving room, distilled into moments that still feel personal.'
  },
  birthday: {
    kicker: 'Celebration Story',
    scene: 'Family Milestone',
    story: 'Joy in motion, held with the warmth of the people around it.'
  },
  spring: {
    kicker: 'Seasonal Portrait',
    scene: 'Editorial Study',
    story: 'Light, texture, and atmosphere shaped into something quietly memorable.'
  },
  default: {
    kicker: 'Featured Story',
    scene: '',
    story: 'A cinematic moment shaped to feel lived in, not staged.'
  }
};

const portfolioNarrativeLibrary = {
  '/images/weddings/manishanthan-harshini': {
    story: 'Temple stone, rich silk, and a family gathered close around every ritual.'
  },
  '/images/weddings/abhinav-megha': {
    story: 'A poised beginning that opened into a celebration full of warmth.'
  },
  '/images/weddings/Pradyuma-ausha': {
    story: 'A backyard first look, a ceremony at home, and family gathered close.'
  },
  '/images/weddings/bhavya-subodh': {
    story: 'Sacred rituals, steady glances, and a room that kept leaning closer.'
  },
  '/images/weddings/abhishek-tanya': {
    story: 'Classic, luminous, and carried by the energy of everyone present.'
  },
  '/images/weddings/sophie-eric': {
    story: 'Tender vows, elegant light, and a day that felt quietly cinematic.'
  },
  '/images/weddings/central-park-wedding': {
    scene: 'Central Park, New York City',
    story: 'Open sky, city air, and promises held right in the middle of it all.'
  },
  '/images/engagement/vyshnavi-daniel': {
    story: 'Easy laughter, held glances, and the quiet certainty of what comes next.'
  },
  '/images/couple-portraits/anusha-akshay': {
    story: 'A soft conversation between style, chemistry, and unhurried presence.'
  },
  '/images/couple-portraits/abhinav-megha': {
    story: 'Playful, intimate, and shaped around the spaces between the poses.'
  },
  '/images/couple-portraits/karthik-sowmya': {
    story: 'Warm light, quiet confidence, and a love that reads effortlessly on camera.'
  },
  '/images/couple-portraits/anagha-revanth': {
    story: 'A gentle city story shaped by closeness, movement, and quiet ease.'
  },
  '/images/couple-portraits/sripad-ritika': {
    story: 'Classic portraiture with the kind of ease that makes it feel lived in.'
  },
  '/images/couple-portraits/arvind-nikhila': {
    story: 'A calm, grounded story built from glances, pacing, and presence.'
  },
  '/images/couple-portraits/sachin-poojitha': {
    story: 'Playfulness in the frame, tenderness underneath it.'
  },
  '/images/couple-portraits/yogesh-supritha': {
    story: 'Elegant, affectionate, and made to feel effortless rather than posed.'
  },
  '/images/couple-portraits/sameeksha-aman': {
    story: 'Editorial in mood, intimate in feeling, and full of quiet confidence.'
  },
  '/images/couple-portraits/suprith-pragnya': {
    story: 'A portrait story with movement, softness, and just enough restraint.'
  },
  '/images/couple-portraits/vyshnavi-shiva': {
    story: 'Gentle light, expressive styling, and a connection that carries the frame.'
  },
  '/images/couple-portraits/anuradha-suresh': {
    story: 'Simple, warm, and centered on the comfort they carry together.'
  },
  '/images/couple-portraits/sai-srinivas-akruthi': {
    story: 'Natural chemistry, clean composition, and emotion that never feels forced.'
  },
  '/images/graduation/Nicoli': {
    story: 'A proud turning point captured with elegance and a sense of arrival.'
  },
  '/images/graduation/bhandhavi': {
    story: 'The kind of milestone portrait that feels both accomplished and deeply personal.'
  },
  '/images/maternity/shreya': {
    story: 'Grace, anticipation, and the softness of a new chapter beginning.'
  },
  '/images/brand-collabs/mrga': {
    scene: 'Editorial Brand Story — The Met Museum, NYC',
    story: 'Heritage woven with intention — photographed where the world keeps its most enduring art.'
  },
  '/images/house-warming/Sharan & soundarya': {
    story: 'Threshold rituals, gathered voices, and warmth settling into every room.'
  },
  '/images/house-warming/bhargavi': {
    story: 'A home becoming memory through detail, blessing, and family presence.'
  }
};

function createStoryElement(tagName, className, text) {
  const node = document.createElement(tagName);
  node.className = className;
  node.textContent = text;
  return node;
}

function initPortfolioStoryCards() {
  document.querySelectorAll('.gallery-item:not(.gi-cinematic)').forEach(item => {
    if (item.dataset.comingSoon === 'true') return;

    const overlayBody = item.querySelector('.gi-overlay > div');
    if (!overlayBody) return;

    const category = item.dataset.cat || 'default';
    const defaults = portfolioNarrativeDefaults[category] || portfolioNarrativeDefaults.default;
    const custom = portfolioNarrativeLibrary[item.dataset.folder] || {};
    const title = item.dataset.title || overlayBody.querySelector('h3')?.textContent?.trim() || '';
    const kicker = item.dataset.type || custom.kicker || defaults.kicker;
    const scene = item.dataset.location || custom.scene || defaults.scene;
    const story = item.dataset.story || custom.story || defaults.story;

    const storyCard = document.createElement('div');
    storyCard.className = 'gi-story-card';
    storyCard.append(
      createStoryElement('div', 'gi-kicker', kicker),
      createStoryElement('h3', 'gi-editorial-title', title),
    );

    if (scene) {
      storyCard.append(createStoryElement('div', 'gi-scene', scene));
    }

    storyCard.append(createStoryElement('span', 'gi-divider gi-editorial-divider', ''));
    storyCard.append(createStoryElement('p', 'gi-storyline', story));

    overlayBody.replaceWith(storyCard);
    item.classList.add('gi-editorial');
  });
}

initPortfolioStoryCards();

// ═══════ AUTO-LOAD COVER IMAGES ═══════
const galleryObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const item = entry.target;
      const folder = item.dataset.folder;
      const ext = item.dataset.ext || 'jpg';
      const coverSrc = item.dataset.cover || (folder ? `${folder}/1.${ext}` : null);
      if (coverSrc) {
        const assetVersion = item.dataset.assetVersion;
        const versionedCoverSrc = assetVersion
          ? `${coverSrc}?v=${encodeURIComponent(assetVersion)}`
          : coverSrc;
        const bg = item.querySelector('.gi-bg');
        if (bg) {
          const img = new Image();
          img.decoding = 'async';
          img.onload = function() {
            bg.style.backgroundImage = `url('${versionedCoverSrc}')`;
            if (item.dataset.bgSize) bg.style.backgroundSize = item.dataset.bgSize;
            if (item.dataset.bgPos) bg.style.backgroundPosition = item.dataset.bgPos;
          };
          img.src = versionedCoverSrc;
        }
      }
      observer.unobserve(item);
    }
  });
}, { rootMargin: '50% 0px' });

document.querySelectorAll('.gallery-item').forEach(item => {
  galleryObserver.observe(item);
});

// ═══════ LAZY LOAD BACKGROUND IMAGES ═══════
const bgObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const bgSrc = el.dataset.bgSrc;
      if (bgSrc) {
        el.style.backgroundImage = `url('${bgSrc}')`;
      }
      observer.unobserve(el);
    }
  });
}, { rootMargin: '200px 0px' });

document.querySelectorAll('[data-bg-src]').forEach(el => {
  bgObserver.observe(el);
});
// ═══════ CUSTOM CURSOR — FIX 1 ═══════
// Root cause of lag: cursor.style.left/top triggers layout reflow every frame.
// Fix: translate3d() is GPU-composited — zero layout impact. Scale is also
// animated in the same rAF loop to avoid CSS-vs-JS transform conflicts.
(function() {
  const cursor = document.getElementById('cursorFollow');
  if (!cursor) return;
  let mouseX = 0, mouseY = 0, curX = 0, curY = 0;
  let curScale = 0.3, targetScale = 0.3;
  // Half-width / half-height of the pill to center it on the pointer
  const OX = 40, OY = 16;

  document.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });

  (function animateCursor() {
    const posEase   = 0.18;  // smooth trailing for position
    const scaleEase = 0.38;  // snappy pop for scale — appears fast on hover
    curX    += (mouseX      - curX)      * posEase;
    curY    += (mouseY      - curY)      * posEase;
    curScale += (targetScale - curScale) * scaleEase;
    // translate3d forces GPU compositing — no layout reflow, zero jank
    cursor.style.transform = `translate3d(${curX - OX}px, ${curY - OY}px, 0) scale(${curScale})`;
    requestAnimationFrame(animateCursor);
  })();

  // Gallery + video cards — delegated cursor activation (only on center card)
  document.querySelectorAll('.ethereal-carousel').forEach(carousel => {
    carousel.addEventListener('mouseenter', (e) => {
      const card = e.target.closest('.gallery-item, .vw-card');
      if (card && card.getAttribute('data-ec-offset') === '0') {
        cursor.classList.add('active'); targetScale = 1;
      }
    }, true);
    carousel.addEventListener('mouseleave', (e) => {
      const card = e.target.closest('.gallery-item, .vw-card');
      if (card) { cursor.classList.remove('active'); targetScale = 0.3; }
    }, true);
    carousel.addEventListener('mouseover', (e) => {
      const card = e.target.closest('.gallery-item, .vw-card');
      if (card && card.getAttribute('data-ec-offset') === '0') {
        cursor.classList.add('active'); targetScale = 1;
      } else {
        cursor.classList.remove('active'); targetScale = 0.3;
      }
    });
  });
})();

// ════════════════════════════════════════════════════════════
// CINEMATIC GALLERY VIEWER
// ════════════════════════════════════════════════════════════
(function () {
  // Use const/let for better scoping
  const gallery = document.getElementById('swGallery');
  const galleryImg = document.getElementById('swGalleryImg');
  const galleryStrip = document.getElementById('swGalleryStrip');
  const galleryTitle = document.getElementById('swGalleryTitle');
  const gallerySubtitle = document.getElementById('swGallerySubtitle');
  const galleryCounter = document.getElementById('swGalleryCounter');
  const stage = document.getElementById('swGalleryStage');
  if (!gallery || !galleryImg || !galleryTitle || !gallerySubtitle || !galleryCounter || !stage) return;

  let swImages = [], swIndex = 0, swIsOpen = false, swParafRAF = null, lastFocusedElement = null;
  // Tracks the carousel card that triggered the currently-open lightbox, so its
  // black-and-white -> color "tap reveal" (.gi-color-reveal, see styles.css) can
  // be cleared again once the lightbox closes.
  let swSourceCard = null;
  let stripThumbCache = [];
  let dockMouseMoveFn = null, dockMouseLeaveFn = null;
  let dockCurrentScales = [], dockTargetScales = [], dockRAF = null, dockRAFRunning = false, dockLerp = 0.18;
  let _dockBoundMoveFn = null;
  const photoJournal = window.createPhotoJournal?.({ gallery, onClose: closeSwGallery });

  function updateGalleryBackdrop(url, animate) {
    const safeUrl = String(url).replace(/(["\\])/g, '\\$1');
    stage.style.setProperty('--sw-gallery-backdrop', `url("${safeUrl}")`);
    if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    stage.classList.remove('sw-bg-anim');
    void stage.offsetWidth;
    stage.classList.add('sw-bg-anim');
  }

  function openSwGallery(work) {
    lastFocusedElement = document.activeElement;
    // Turn the tapped cover from black & white to color, and keep it that way
    // for the whole open/close cycle (a :hover-only trigger reverts the instant
    // a finger lifts, which flashed back to black & white as the lightbox
    // faded in — see styles.css comment above .gi-color-reveal).
    swSourceCard = work;
    work.classList.add('gi-color-reveal');
    const folder = work.dataset.folder || 'images/default';
    const count = parseInt(work.dataset.count || '1', 10);
    const ext = work.dataset.ext || 'jpg';
    const assetVersion = work.dataset.assetVersion;
    const isStatic = work.dataset.static === 'true';
    const isComingSoon = work.dataset.comingSoon === 'true';

    // Build image array
    swImages = Array.from({ length: count }, (_, i) => {
      const src = `${folder}/${i + 1}.${ext}`;
      return assetVersion ? `${src}?v=${encodeURIComponent(assetVersion)}` : src;
    });
    
    swIndex = 0;
    galleryTitle.textContent = work.dataset.title || '';
    gallerySubtitle.textContent = work.dataset.type || '';

    // GA4 FIX: fire gallery_open event — tracks which collections get the most interest.
    // cat maps to the portfolio filter category (wedding, couple, maternity, etc.)
    if (typeof gtag === 'function') {
      gtag('event', 'gallery_open', {
        event_category: 'Gallery',
        event_label: work.dataset.title || 'Unknown',
        gallery_type: work.dataset.cat || 'Unknown',
        is_coming_soon: (work.dataset.comingSoon === 'true')
      });
    }

    gallery.classList.add('sw-open', 'sw-gallery-enter');
    gallery.classList.toggle('sw-static', isStatic);
    
    // Handle Coming Soon state
    gallery.classList.toggle('sw-is-coming-soon', isComingSoon);
    if (isComingSoon) {
      const cardGradient = work.className.match(/gi-\d+/);
      if (cardGradient) gallery.classList.add(cardGradient[0]);
      const noticeTitle = document.getElementById('swComingSoonTitle');
      if (noticeTitle) noticeTitle.textContent = work.dataset.title || '';
      galleryCounter.textContent = "";
      if (galleryImg) galleryImg.style.backgroundImage = 'none';
      stage.style.removeProperty('--sw-gallery-backdrop');
      document.body.style.overflow = 'hidden';
      swIsOpen = true;
      // Focus close button for accessibility
      setTimeout(() => {
        const closeBtn = document.getElementById('swGalleryClose');
        if (closeBtn) closeBtn.focus();
      }, 100);
      return;
    }

    document.body.style.overflow = 'hidden'; 
    swIsOpen = true;

    if (photoJournal?.shouldOpen(work)) {
      photoJournal.open(work, swImages);
      return;
    }

    // Focus close button for accessibility
    setTimeout(() => {
      const closeBtn = document.getElementById('swGalleryClose');
      if (closeBtn) closeBtn.focus();
    }, 100);

    renderSwStrip();
    renderSwImage(swIndex, true);
    if (!isStatic) startParallax();
  }

  function renderSwImage(index, isFirst) {
    const url = swImages[index];
    galleryCounter.textContent = `${index + 1} / ${swImages.length}`;
    
    const progressFill = document.getElementById('swProgressFill');
    if (progressFill) progressFill.style.width = `${((index + 1) / swImages.length) * 100}%`;

    // Keep the stage anchored. Element.scrollIntoView() used to scroll this
    // overflow-hidden ancestor horizontally, exposing a blank strip on the right.
    stage.scrollLeft = 0;
    stage.scrollTop = 0;

    // Update thumbnails immediately, scrolling only the filmstrip container.
    document.querySelectorAll('.sw-strip-thumb').forEach((t, i) => {
      t.classList.toggle('active', i === index);
      if (i === index && galleryStrip) {
        const centeredLeft = t.offsetLeft - (galleryStrip.clientWidth - t.offsetWidth) / 2;
        galleryStrip.scrollTo({ left: Math.max(0, centeredLeft), behavior: 'smooth' });
      }
    });

    if (isFirst) {
        updateGalleryBackdrop(url, true);
        galleryImg.style.backgroundImage = `url('${url}')`;
        galleryImg.style.backgroundSize = "contain";
        galleryImg.classList.add('sw-img-enter');
        return;
    }

    // Navigation: Exit current -> Enter new immediately after exit animation
    galleryImg.classList.remove('sw-img-enter');
    galleryImg.classList.add('sw-img-exit');

    galleryImg.addEventListener('animationend', () => {
        if (swImages[swIndex] !== url) return; // Prevent race conditions
        updateGalleryBackdrop(url, true);
        galleryImg.style.backgroundImage = `url('${url}')`;
        galleryImg.style.backgroundSize = "contain";
        galleryImg.classList.remove('sw-img-exit');
        void galleryImg.offsetWidth; // Force reflow
        galleryImg.classList.add('sw-img-enter');
    }, { once: true });
  }

  function renderSwStrip() {
    if (!galleryStrip) return;
    galleryStrip.innerHTML = swImages.map((url, i) =>
      `<div class="sw-strip-thumb${i === swIndex ? ' active' : ''}" data-idx="${i}">
         <div class="sw-strip-thumb-img" style="background-image:url('${url}')"></div>
       </div>`
    ).join('');
    stripThumbCache = Array.from(galleryStrip.querySelectorAll('.sw-strip-thumb'));
    stripThumbCache.forEach(thumb => {
      thumb.addEventListener('click', () => {
        swIndex = parseInt(thumb.dataset.idx, 10);
        renderSwImage(swIndex, false);
      });
    });

    // Reset dock scale state for fresh strip, then re-attach listeners.
    // Re-attachment is needed because closeSwGallery removes listeners on every close.
    dockCurrentScales = stripThumbCache.map(() => 1.0);
    dockTargetScales  = stripThumbCache.map(() => 1.0);
    if (dockMouseMoveFn) {
      if (_dockBoundMoveFn) galleryStrip.removeEventListener('mousemove', _dockBoundMoveFn);
      galleryStrip.removeEventListener('mouseleave', dockMouseLeaveFn);
      // Cache strip's left edge (viewport-relative, stable while gallery is open).
      // Thumb centres use offsetLeft (scroll-content space) so they stay valid after horizontal scroll.
      const cachedStripLeft = galleryStrip.getBoundingClientRect().left;
      const thumbCenters = stripThumbCache.map(t => t.offsetLeft + t.offsetWidth / 2);
      // Wrap listener with cached values to avoid per-event layout reads
      _dockBoundMoveFn = (e) => dockMouseMoveFn(e, cachedStripLeft, thumbCenters);
      galleryStrip.addEventListener('mousemove', _dockBoundMoveFn);
      galleryStrip.addEventListener('mouseleave', dockMouseLeaveFn);
    }
  }

  function closeSwGallery() {
    if (!swIsOpen) return;
    swIsOpen = false;
    gallery.classList.add('sw-gallery-exit');
    let cleanupCalled = false;
    function cleanup(event) {
      if (event && (event.target !== gallery || event.animationName !== 'swGalleryOut')) return;
      if (cleanupCalled) return;
      cleanupCalled = true;
      gallery.removeEventListener('animationend', cleanup);
      photoJournal?.close();
      gallery.classList.remove('sw-open', 'sw-gallery-enter', 'sw-gallery-exit', 'sw-static', 'sw-is-coming-soon');
      // Remove any gi- classes added for coming soon background
      gallery.className = gallery.className.replace(/gi-\d+/g, '').trim();
      
      galleryImg.style.backgroundImage = '';
      stage.style.removeProperty('--sw-gallery-backdrop');
      stage.classList.remove('sw-bg-anim');
      if (dockRAF) { cancelAnimationFrame(dockRAF); dockRAF = null; dockRAFRunning = false; }
      if (galleryStrip) {
        galleryStrip.innerHTML = '';
        if (_dockBoundMoveFn) { galleryStrip.removeEventListener('mousemove', _dockBoundMoveFn); _dockBoundMoveFn = null; }
        // dockMouseLeaveFn is stable (set once in IIFE) — null check guards touch devices where it was never assigned
        if (dockMouseLeaveFn) { galleryStrip.removeEventListener('mouseleave', dockMouseLeaveFn); }
      }
      stripThumbCache = [];
      swIsOpen = false;
      // Return focus to triggering element
      if (lastFocusedElement) {
        lastFocusedElement.focus({ preventScroll: true });
        lastFocusedElement = null;
      }
      // Reset the cover back to black & white for the next time it's viewed
      if (swSourceCard) {
        swSourceCard.classList.remove('gi-color-reveal', 'gi-tap-reveal');
        swSourceCard = null;
      }
    }
    gallery.addEventListener('animationend', cleanup);
    // Fallback if animationend never fires
    setTimeout(cleanup, 600);
    document.body.style.overflow = '';
    stopParallax();
  }

  function swNav(dir) {
    swIndex = (swIndex + dir + swImages.length) % swImages.length;
    renderSwImage(swIndex, false);
  }

  document.getElementById('swGalleryPrev').addEventListener('click', function () { swNav(-1); });
  document.getElementById('swGalleryNext').addEventListener('click', function () { swNav(1); });
  document.getElementById('swGalleryClose').addEventListener('click', closeSwGallery);

  document.addEventListener('keydown', function (e) {
    if (!swIsOpen || photoJournal?.isOpen()) return;
    if (e.key === 'Escape')     closeSwGallery();
    if (e.key === 'ArrowRight') swNav(1);
    if (e.key === 'ArrowLeft')  swNav(-1);
  });

  // Touch / Swipe Support — finger-following, prevents browser back gesture
  let swTouchStartX = 0, swTouchStartY = 0, swTouchDX = 0, swIsHorizontal = null;

  gallery.addEventListener('touchstart', (e) => {
    if (!swIsOpen || photoJournal?.isOpen() || e.touches.length !== 1) return;
    swTouchStartX = e.touches[0].clientX;
    swTouchStartY = e.touches[0].clientY;
    swTouchDX = 0;
    swIsHorizontal = null;
    galleryImg.style.transition = 'none';
  }, { passive: true });

  gallery.addEventListener('touchmove', (e) => {
    if (!swIsOpen || photoJournal?.isOpen() || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - swTouchStartX;
    const dy = e.touches[0].clientY - swTouchStartY;
    if (swIsHorizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      swIsHorizontal = Math.abs(dx) > Math.abs(dy);
    }
    if (swIsHorizontal) {
      e.preventDefault();
      swTouchDX = dx;
      const fade = 1 - Math.min(Math.abs(dx) / 350, 0.35);
      galleryImg.style.transform = `translateX(${dx}px)`;
      galleryImg.style.opacity = fade;
    }
  }, { passive: false });

  gallery.addEventListener('touchend', () => {
    if (!swIsOpen || photoJournal?.isOpen()) return;
    galleryImg.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    if (Math.abs(swTouchDX) > 50) {
      swNav(swTouchDX < 0 ? 1 : -1);
    }
    galleryImg.style.transform = '';
    galleryImg.style.opacity = '';
    swTouchDX = 0;
    swIsHorizontal = null;
  });

  // Parallax
  let pMouseX = 0, pMouseY = 0;
  stage.addEventListener('mousemove', function (e) {
    const rect = stage.getBoundingClientRect();
    pMouseX = ((e.clientX - rect.left)  / rect.width  - 0.5) * 2;
    pMouseY = ((e.clientY - rect.top)   / rect.height - 0.5) * 2;
  });
  stage.addEventListener('mouseleave', function () { pMouseX = 0; pMouseY = 0; });

  function startParallax() {
    if (window.matchMedia('(hover: none)').matches) return;
    let curX = 0, curY = 0;
    function loop() {
      const ease = 0.055;
      curX += (pMouseX - curX) * ease;
      curY += (pMouseY - curY) * ease;
      galleryImg.style.transform = `translate(${curX * 14}px, ${curY * 9}px) scale(1.06)`;
      swParafRAF = requestAnimationFrame(loop);
    }
    loop();
  }

  function stopParallax() {
    if (swParafRAF) { cancelAnimationFrame(swParafRAF); swParafRAF = null; }
    galleryImg.style.transform = '';
  }

  // Mac Dock Effect for Filmstrip — desktop/pointer only
  // Listeners are re-attached in renderSwStrip() on every gallery open
  if (galleryStrip && !window.matchMedia('(hover: none)').matches) {
    const EFFECT_WIDTH = 240, MAX_SCALE = 1.85, MIN_SCALE = 1.0;

    function dockTick() {
      let settled = true;
      stripThumbCache.forEach((thumb, i) => {
        const diff = dockTargetScales[i] - dockCurrentScales[i];
        if (Math.abs(diff) > 0.002) {
          dockCurrentScales[i] += diff * dockLerp;
          settled = false;
        } else {
          dockCurrentScales[i] = dockTargetScales[i];
        }
        thumb.style.transform = `scale(${dockCurrentScales[i].toFixed(4)})`;
      });
      if (!settled) {
        dockRAF = requestAnimationFrame(dockTick);
      } else {
        dockRAFRunning = false;
        dockRAF = null;
      }
    }

    dockMouseMoveFn = (e, stripLeft, thumbCenters) => {
      // Add scrollLeft so mouseRelX and thumbCenters share the same scroll-content coordinate space
      const mouseRelX = e.clientX - stripLeft + galleryStrip.scrollLeft;
      thumbCenters.forEach((thumbCenterX, i) => {
        const minX = mouseRelX - EFFECT_WIDTH / 2;
        const maxX = mouseRelX + EFFECT_WIDTH / 2;
        if (thumbCenterX >= minX && thumbCenterX <= maxX) {
          // Cosine bell: theta sweeps 0→2π across EFFECT_WIDTH; (1-cos(θ))/2 gives 0 at edges, 1 at centre (θ=π)
          const theta = ((thumbCenterX - minX) / EFFECT_WIDTH) * 2 * Math.PI;
          const scaleFactor = (1 - Math.cos(theta)) / 2;
          dockTargetScales[i] = MIN_SCALE + scaleFactor * (MAX_SCALE - MIN_SCALE);
        } else {
          dockTargetScales[i] = MIN_SCALE;
        }
      });
      dockLerp = 0.18; // Reset to fast lerp (may have been slowed to 0.10 by a prior mouseleave)
      if (!dockRAFRunning) {
        dockRAFRunning = true;
        dockRAF = requestAnimationFrame(dockTick);
      }
    };

    dockMouseLeaveFn = () => {
      for (let i = 0; i < dockTargetScales.length; i++) dockTargetScales[i] = MIN_SCALE;
      dockLerp = 0.10;
      if (!dockRAFRunning) {
        dockRAFRunning = true;
        dockRAF = requestAnimationFrame(dockTick);
      }
    };
  }

  window.openSwGallery = openSwGallery;
})();
// ════════════════════════════════════════════════════════════
// CINEMATIC SERVICES — Scroll Stack Engine (rAF-throttled)
// Panels slide UP over each other (incoming z=2 > active z=1).
// Text lives in shared overlay at z=100 — always above everything.
// ════════════════════════════════════════════════════════════
(function () {
  var wrapper    = document.querySelector('.cs-wrapper');
  if (!wrapper) return;
  // QA FIX: skip HLS init and scroll handlers when services section is hidden (display:none)
  var servicesSection = document.getElementById('services');
  if (servicesSection && window.getComputedStyle(servicesSection).display === 'none') return;

  var panels     = Array.from(document.querySelectorAll('.cs-panel'));
  var PANEL_COUNT = panels.length;
  var bgs        = panels.map(function(p) { return p.querySelector('.cs-bg'); });
  var slides     = Array.from(document.querySelectorAll('.cs-text-slide'));
  var dots       = document.querySelectorAll('.cs-dot');
  var counterEl  = document.getElementById('csCounterCurrent');
  var scrollHint = document.getElementById('csScrollHint');
  var counterWrapper = document.getElementById('csCounter');

  /* Mobile reels mode disabled — scroll-stack slide-over effect runs on all sizes */

  var wrapTop      = 0;
  var rafPending   = false;
  var lastScrollY  = -1;
  var lastActive   = 0;
  var hintDismissed = false;
  var isVisible    = false;

  function pauseAllVideos() { videos.forEach(function(v) { if (v) v.pause(); }); }

  function cacheLayout() {
    var scrollTop = window.scrollY || document.documentElement.scrollTop;
    wrapTop     = wrapper.getBoundingClientRect().top + scrollTop;
  }
  cacheLayout();
  window.addEventListener('load', cacheLayout);

  /* ── Smart media loader — video → image → gradient fallback ── */
  var videos = panels.map(function(p) { return p.querySelector('.cs-video'); });
  var serviceHlsInstances = []; // Audit Fix: Track instances for memory management
  var serviceVideoPausedForModal = false;

  function parseTimestamp(val) {
    if (!val) return null;
    val = String(val).trim();
    if (val.indexOf(':') !== -1) {
      var parts = val.split(':');
      return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
    }
    return parseFloat(val);
  }

  function attachServiceHls(vid, videoSrc, onReady) {
    ensureHlsLibrary().then(function(HlsCtor) {
      if (!HlsCtor || !HlsCtor.isSupported()) return;
      var hls = new HlsCtor();
      hls.loadSource(videoSrc);
      hls.attachMedia(vid);
      hls.on(HlsCtor.Events.MANIFEST_PARSED, function() {
        if (serviceVideoPausedForModal) {
          hls.stopLoad();
          return;
        }
        onReady();
        vid.play().catch(function(){});
      });
      serviceHlsInstances.push(hls);
    }).catch(function() {
      // Allow a later retry if the library could not be fetched yet.
    });
  }

  var panelMediaReady = panels.map(function() { return false; });

  function ensurePanelMedia(i) {
    if (i < 0 || i >= PANEL_COUNT || panelMediaReady[i]) return;

    panelMediaReady[i] = true;
    var panel = panels[i];
    var videoSrc = panel.dataset.video;
    var imgSrc   = panel.dataset.bg;
    var vid      = videos[i];
    var bg       = bgs[i];

    if (videoSrc && videoSrc !== '') {
      /* VIDEO path — HLS (.m3u8) or direct file */
      var startTime = parseTimestamp(panel.dataset.start) || 0;
      var endTime   = parseTimestamp(panel.dataset.end);

      function showVideo() {
        bg.className = bg.className.replace(/cs-bg-\d/, '').trim();
        vid.classList.add('cs-vid-ready');
      }

      /* Try multiple events — whichever fires first wins */
      vid.addEventListener('loadeddata',     function() { showVideo(); }, { once: true });
      vid.addEventListener('canplay',        function() { showVideo(); }, { once: true });
      vid.addEventListener('loadedmetadata', function() {
        if (startTime > 0) vid.currentTime = startTime;
        if (!serviceVideoPausedForModal) vid.play().catch(function(){});
      }, { once: true });

      /* Loop between start and end if data-end is set */
      if (endTime !== null) {
        vid.addEventListener('timeupdate', function() {
          if (vid.currentTime >= endTime) {
            vid.currentTime = startTime;
          }
        });
      }

      if (videoSrc.indexOf('.m3u8') !== -1 && vid.canPlayType('application/vnd.apple.mpegurl')) {
        vid.setAttribute('src', videoSrc);
        vid.load();
      } else if (videoSrc.indexOf('.m3u8') !== -1) {
        attachServiceHls(vid, videoSrc, showVideo);
      } else {
        vid.setAttribute('src', videoSrc);
        vid.load();
      }

    } else if (imgSrc && imgSrc !== '') {
      /* IMAGE path */
      var img = new Image();
      img.onload = function() {
        bg.style.backgroundImage = "url('" + imgSrc + "')";
        bg.className = bg.className.replace(/cs-bg-\d/, '').trim();
      };
      img.src = imgSrc;
    }
    /* else — gradient fallback stays */
  }

  /* Viewport Observer: Pause videos when out of view */
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      isVisible = entry.isIntersecting;
      if (!isVisible) {
        pauseAllVideos();
        // Stop HLS buffering to save memory/bandwidth when section is hidden
        serviceHlsInstances.forEach(function(h) { h.stopLoad(); });
      } else {
        if (serviceVideoPausedForModal) {
          pauseAllVideos();
          serviceHlsInstances.forEach(function(h) { h.stopLoad(); });
          return;
        }
        // Resume loading when section becomes visible
        serviceHlsInstances.forEach(function(h) { h.startLoad(); });
        ensurePanelMedia(lastActive);
        ensurePanelMedia(lastActive + 1);
        requestAnimationFrame(render);
      }
    });
  }, { threshold: 0 });
  observer.observe(wrapper);

  /* Play active panel video(s), pause others */
  function syncVideos(idx1, idx2) {
    if (!isVisible || serviceVideoPausedForModal) {
      pauseAllVideos();
      return;
    }

    videos.forEach(function(vid, i) {
      if (!vid || (!vid.currentSrc && !vid.src)) return;
      // Ensure mute state is consistent
      vid.muted = true;
      
      if (i === idx1 || (idx2 !== undefined && i === idx2)) {
        vid.play().catch(function(){});
      } else {
        vid.pause();
      }
    });
  }

  document.addEventListener('aakaara:modal-video-open', function() {
    serviceVideoPausedForModal = true;
    pauseAllVideos();
    serviceHlsInstances.forEach(function(h) { h.stopLoad(); });
  });

  document.addEventListener('aakaara:modal-video-close', function() {
    serviceVideoPausedForModal = false;
    if (!isVisible) return;
    serviceHlsInstances.forEach(function(h) { h.startLoad(); });
    requestAnimationFrame(render);
  });

  /* Show first slide immediately */
  slides[0].classList.add('cs-slide-active');

  /* Dot clicks */
  dots.forEach(function(dot) {
    dot.addEventListener('click', function() {
      var target  = parseInt(dot.dataset.panel, 10);
      var targetY = wrapTop + target * window.innerHeight;
      window.scrollTo({ top: targetY, behavior: 'smooth' });
    });
  });

  setTimeout(function() {
    if (!hintDismissed && window.scrollY < wrapTop + 100)
      scrollHint.classList.add('visible');
  }, 1200);

  /* Crossfade text overlay to the active slide index */
  function showSlide(idx) {
    if (lastActive === idx) return;
    slides.forEach(function(s, i) {
      if (i === idx) {
        s.classList.remove('cs-slide-exit');
        s.classList.add('cs-slide-active');
      } else if (i === lastActive) {
        s.classList.remove('cs-slide-active');
        s.classList.add('cs-slide-exit');
        (function(el) {
          setTimeout(function() { el.classList.remove('cs-slide-exit'); }, 360);
        })(s);
      } else {
        s.classList.remove('cs-slide-active', 'cs-slide-exit');
      }
    });
    lastActive = idx;
  }

  function render() {
    rafPending = false;
    var scrollY = window.scrollY;
    if (scrollY === lastScrollY) return;
    lastScrollY = scrollY;

    var scrollInto = scrollY - wrapTop;
    var panelH     = window.innerHeight;

    if (scrollInto > panelH * 0.5 && !hintDismissed) { // Dismiss hint after scrolling 50% of first panel
      hintDismissed = true;
      scrollHint.classList.remove('visible');
    }

    /* Before sticky zone — reset */
    if (scrollInto < 0) {
      if (counterWrapper) counterWrapper.style.opacity = '0';
      panels.forEach(function(panel, i) {
        panel.style.transform  = i === 0 ? 'translateY(0%)' : 'translateY(100%)';
        panel.style.zIndex     = '0';
        panel.style.filter     = 'brightness(1)';
      });
      if (counterEl) counterEl.textContent = '00';
      dots.forEach(function(d, i) { d.classList.toggle('active', i === 0); });
      showSlide(0);
      syncVideos(0);
      return;
    }

    var rawPanel  = scrollInto / panelH;
    var activeIdx = Math.max(0, Math.min(PANEL_COUNT - 1, Math.floor(rawPanel)));
    var progress  = rawPanel - activeIdx;

    var displayIdx = (progress > 0.72 && activeIdx < PANEL_COUNT - 1) ? activeIdx + 1 : activeIdx;

    // Keep the UI in sync with the panel that is visually dominant,
    // not the one that has only just started sliding in.
    if (counterWrapper) {
      counterWrapper.style.opacity = displayIdx === 0 ? '0' : '1';
      counterWrapper.style.transition = 'opacity 0.4s ease';
    }
    if (counterEl && displayIdx > 0) {
      var newCount = String(displayIdx).padStart(2, '0');
      if (counterEl.textContent !== newCount) counterEl.textContent = newCount;
    }

    dots.forEach(function(d, i) { d.classList.toggle('active', i === displayIdx); });
    showSlide(displayIdx);
    
    /* Play both the base panel (being covered) and the incoming panel (covering) */
    var nextIdx = (activeIdx < PANEL_COUNT - 1) ? activeIdx + 1 : undefined;
    ensurePanelMedia(activeIdx);
    if (nextIdx !== undefined) ensurePanelMedia(nextIdx);
    syncVideos(activeIdx, nextIdx);

    /* Position panels:
       past     → translateY(-100%), z=0
       active   → translateY(0%),    z=1  (incoming wipes over this bg)
       incoming → translateY(0-100%),z=2  (slides over active bg)
       waiting  → translateY(100%),  z=0
       Text overlay is z=100, totally independent — never covered */
    panels.forEach(function(panel, i) {
      var yPct;
      var transform;

      if (i < activeIdx) {
        yPct = -100;
        panel.style.zIndex     = '0';
        transform = `translateY(${yPct}%)`;
      } else if (i === activeIdx) {
        yPct = 0;
        panel.style.zIndex     = '1';
        transform = `translateY(0%)`;
        panel.style.filter = 'brightness(1)';
      } else if (i === activeIdx + 1) {
        yPct = (1 - progress) * 100;
        panel.style.zIndex     = '2';
        transform = `translateY(${yPct}%)`;
        panel.style.filter = 'brightness(1)';
      } else {
        yPct = 100;
        panel.style.zIndex     = '0';
        transform = `translateY(${yPct}%)`;
        panel.style.filter = 'brightness(1)';
      }
      panel.style.transform = transform;
    });
  }

  window.addEventListener('scroll', function() {
    if (!rafPending) { rafPending = true; requestAnimationFrame(render); }
  }, { passive: true });

  window.addEventListener('resize', function() {
    cacheLayout(); rafPending = true; requestAnimationFrame(render);
  }, { passive: true });

  render();
})();
// ═══════ 3D FLOATING TITLE — FIX 5 ═══════
// The .hero-title-float wrapper handles the vertical bob via CSS keyframe.
// This IIFE drives the 3D mouse-parallax rotateX/Y on the title itself
// using a separate RAF loop — no conflict with the CSS animation.
(function() {
  const hero  = document.querySelector('.hero');
  const title = document.getElementById('heroTitle');
  if (!hero || !title) return;

  let rotX = 0, rotY = 0, tX = 0, tY = 0;

  hero.addEventListener('mousemove', (e) => {
    const r = hero.getBoundingClientRect();
    // Map cursor position to -1…+1 range relative to hero centre
    tX = ((e.clientY - r.top  - r.height / 2) / r.height) * -9;  // rotateX: tilt fwd/back
    tY = ((e.clientX - r.left - r.width  / 2) / r.width)  *  6;  // rotateY: tilt left/right
  });
  hero.addEventListener('mouseleave', () => { tX = 0; tY = 0; });

  (function loop() {
    const ease = 0.055;  // slow ease for a luxurious, weighty feel
    rotX += (tX - rotX) * ease;
    rotY += (tY - rotY) * ease;
    // perspective is set on .hero-content via CSS; this transform projects through it
    title.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    requestAnimationFrame(loop);
  })();
})();

// ═══════ VIDEO WORKS — FIX 4 ═══════

// Filter
function filterVideos(cat, btn) {
  document.querySelectorAll('.vw-filters button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // GA4 FIX: track video section filter navigation alongside portfolio_filter.
  // Same event name so both filter types appear together in GA4 reports.
  if (typeof gtag === 'function') {
    gtag('event', 'portfolio_filter', {
      event_category: 'Navigation',
      event_label: btn.textContent.trim(),
      filter_value: cat,
      filter_section: 'video'
    });
  }

  // Disable transitions so category switch feels instant
  const allCards = document.querySelectorAll('.vw-card');
  allCards.forEach(c => { c.style.transition = 'none'; });

  if (cat === 'all') {
    const shownCats = new Set();
    allCards.forEach(card => {
      const vCat = card.dataset.vcat;
      if (!shownCats.has(vCat)) {
        card.style.display = '';
        card.style.animation = 'fadeIn 0.45s ease both';
        shownCats.add(vCat);
      } else {
        card.style.display = 'none';
      }
    });
  } else {
    allCards.forEach(card => {
      if (card.dataset.vcat === cat) {
        card.style.display = '';
        card.style.animation = 'fadeIn 0.45s ease both';
      } else {
        card.style.display = 'none';
      }
    });
  }
  if (typeof videoCarousel !== 'undefined' && videoCarousel) { videoCarousel.currentIndex = 0; videoCarousel.rebuild(); }

  // Re-enable transitions after a frame so hover/nav still animate
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      allCards.forEach(c => { c.style.transition = ''; });
    });
  });
}

// Auto-load video poster/cover images from data-poster attribute
(function() {
  const posterObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const card = entry.target;
      const posterSrc = card.dataset.poster;
      const posterEl = card.querySelector('.vw-poster');
      if (posterSrc && posterEl && !posterEl.style.backgroundImage) {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          posterEl.style.backgroundImage = `url('${posterSrc}')`;
        };
        img.src = posterSrc;
      }
      observer.unobserve(card);
    });
  }, { rootMargin: '300px 0px' });

  document.querySelectorAll('.vw-card').forEach(card => posterObserver.observe(card));
})();

// Auto-compute "N Films" badge for multi-chapter video projects (Haldi/Sangeet/Wedding, etc.)
// Count is derived from .vw-chapter children so it can't drift out of sync when a chapter is added.
(function() {
  document.querySelectorAll('.vw-card').forEach(card => {
    const chapterCount = card.querySelectorAll('.vw-chapter').length;
    if (chapterCount < 2) return;
    const badge = document.createElement('div');
    badge.className = 'vw-badge-count';
    badge.textContent = `${chapterCount} Films`;
    card.appendChild(badge);
  });
})();

// Hover muted preview — delayed so modal playback is not competing with preloads
// Exclusive playback: only one card plays at a time (prevents audio overlap on swipe)
(function() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const cardControllers = new Map();
  window.aakaaraStopVideoWorkPreviews = function(options = {}) {
    cardControllers.forEach(ctrl => ctrl.pause(true, Boolean(options.unload)));
  };

  document.querySelectorAll('.vw-card').forEach(card => {
    const src = card.dataset.video;
    if (!src) return;
    const poster = card.querySelector('.vw-poster');
    let vid = null;
    let hoverTimer = null;

    const preload = () => {
      if (vid) return;
      vid = document.createElement('video');
      vid.muted = true; vid.loop = true;
      vid.playsInline = true; vid.preload = 'metadata';
      vid.src = src;
      vid.load();
      poster.appendChild(vid);
    };

    const play = () => {
      if (!vid) preload();
      vid.muted = true;
      vid.play().catch(() => {});
      poster.classList.add('active');
    };

    const pause = (reset = false, unload = false) => {
      if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
      if (vid) {
        vid.pause();
        vid.muted = true;
        if (reset) vid.currentTime = 0;
        if (unload) {
          vid.removeAttribute('src');
          vid.load();
          vid.remove();
          vid = null;
        }
      }
      poster.classList.remove('active');
    };

    cardControllers.set(card, { play, pause });

    // Desktop: Hover — pause all other cards first, then play this one
    card.addEventListener('mouseenter', () => {
      if (window.matchMedia('(hover: none)').matches) return;
      cardControllers.forEach((ctrl, c) => { if (c !== card) ctrl.pause(true); });
      hoverTimer = window.setTimeout(play, 250);
    });

    card.addEventListener('mouseleave', () => {
      pause(true);
    });
  });
})();

// Cinematic modal player
(function() {
  const modal    = document.getElementById('videoModal');
  const vmVideo  = document.getElementById('vmVideo');
  const vmTitle  = document.getElementById('vmTitle');
  const vmSub    = document.getElementById('vmSubtitle');
  const vmChapters = document.getElementById('vmChapters');
  const vmClose  = document.getElementById('vmClose');
  const vmBg     = document.getElementById('vmBackdrop');
  const vmStage  = document.getElementById('vmStage');
  const vmPlay   = document.getElementById('vmPlayToggle');
  const vmMute   = document.getElementById('vmMuteToggle');
  const vmFs     = document.getElementById('vmFsToggle');
  const vmShare  = document.getElementById('vmShare');
  const vmTrack  = document.getElementById('vmProgressTrack');
  const vmFill   = document.getElementById('vmProgressFill');
  const vmTime   = document.getElementById('vmTimeDisplay');
  const vmSkipBackBtn = document.getElementById('vmSkipBackBtn');
  const vmSkipFwdBtn  = document.getElementById('vmSkipFwdBtn');
  const vmSkipBackOvl = document.getElementById('vmSkipBack');
  const vmSkipFwdOvl  = document.getElementById('vmSkipFwd');
  const vmPlaceholderText = document.getElementById('vmPlaceholderText');
  const vmRetry  = document.getElementById('vmRetry');
  if (!modal) return;

  var activeHls = null; // Track active HLS instance for cleanup
  var modalScrollY = 0;
  var modalRequestId = 0;
  var modalLastFocusedEl = null;
  var currentShareUrl = '';
  // a11y audit #02: a load error must never look like "coming soon".
  // loadAttempt bumps on every attach/teardown so late errors from an old
  // source are ignored; each film gets one automatic retry before the
  // "didn't load" state with a Try again button.
  var loadAttempt = 0;
  var currentModalSrc = '';
  var retriedThisSrc = false;
  const FILM_RETRY_DELAY_MS = 600;
  const YT_ARROW_SKIP = 5;
  const YT_JL_SKIP = 10;
  const YT_VOLUME_STEP = 0.05;

  if (!modal.hasAttribute('tabindex')) modal.setAttribute('tabindex', '-1');
  if (vmPlay) vmPlay.setAttribute('aria-keyshortcuts', 'Space K');
  if (vmMute) vmMute.setAttribute('aria-keyshortcuts', 'M');
  if (vmFs) vmFs.setAttribute('aria-keyshortcuts', 'F');
  if (vmSkipBackBtn) vmSkipBackBtn.setAttribute('aria-keyshortcuts', 'ArrowLeft J');
  if (vmSkipFwdBtn) vmSkipFwdBtn.setAttribute('aria-keyshortcuts', 'ArrowRight L');

  function lockModalScroll(scrollY) {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }

  function restoreModalScroll(scrollY) {
    const root = document.documentElement;
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, scrollY);
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY);
        root.style.scrollBehavior = previousBehavior;
      });
    });
  }

  // Stage shows one of: the video ('video'), "Video coming soon" for cards with
  // no film ('soon'), or "This film didn't load" + Try again ('error').
  function setStageState(state) {
    vmStage.classList.toggle('vm-has-video', state === 'video');
    vmStage.classList.toggle('vm-load-error', state === 'error');
    if (vmPlaceholderText) {
      vmPlaceholderText.textContent = state === 'error' ? 'This film didn’t load.' : 'Video coming soon';
    }
    if (vmRetry) vmRetry.hidden = state !== 'error';
  }

  // Detach any source without `src = ''`, which itself raises MediaError 4.
  function teardownMedia() {
    loadAttempt += 1;
    if (activeHls) { activeHls.destroy(); activeHls = null; }
    vmVideo.pause();
    if (vmVideo.hasAttribute('src')) {
      vmVideo.removeAttribute('src');
      vmVideo.load();
    }
  }

  function handleLoadFailure(attempt, reason) {
    if (attempt !== loadAttempt) return; // superseded by a newer load or a close
    if (!modal.classList.contains('vm-open') || !currentModalSrc) return;
    const requestId = modalRequestId;
    teardownMedia();
    if (!retriedThisSrc) {
      retriedThisSrc = true;
      window.setTimeout(() => {
        if (requestId === modalRequestId) startModalLoad(currentModalSrc, requestId);
      }, FILM_RETRY_DELAY_MS);
      return;
    }
    console.warn('[film] playback failed after retry:', reason);
    setStageState('error');
    syncPlayToggle();
  }

  async function startModalLoad(src, requestId) {
    setStageState('video');
    const attempt = loadAttempt + 1;
    try {
      await attachHLS(vmVideo, src, requestId, attempt);
    } catch (err) {
      if (requestId === modalRequestId) handleLoadFailure(attempt, err && err.message);
    }
  }

  async function attachHLS(videoEl, src, requestId, attempt) {
    if (activeHls) { activeHls.destroy(); activeHls = null; }
    loadAttempt = attempt;
    if (src.includes('.m3u8')) {
      if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS (Safari, and Chrome builds that ship it). Errors arrive
        // through the <video> 'error' listener below.
        videoEl.src = src;
        videoEl.load();
        videoEl.play().catch(function(){});
        return;
      }

      const HlsCtor = await ensureHlsLibrary(); // rejection → startModalLoad's catch
      if (requestId !== modalRequestId) return;
      if (!HlsCtor || !HlsCtor.isSupported()) throw new Error('HLS playback unsupported');

      const hls = new HlsCtor({
        maxBufferLength: 60,
        maxMaxBufferLength: 600,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 1000,
        fragLoadingMaxRetryTimeout: 64000,
        levelLoadingMaxRetry: 4,
        manifestLoadingMaxRetry: 3,
        abrEwmaDefaultEstimate: 1500000,
      });
      activeHls = hls;
      var mediaRecoveries = 0;
      hls.loadSource(src);
      hls.attachMedia(videoEl);
      hls.on(HlsCtor.Events.MANIFEST_PARSED, function() { videoEl.play().catch(function(){}); });
      hls.on(HlsCtor.Events.ERROR, function(event, data) {
        if (hls !== activeHls) return;
        if (!data.fatal) {
          // Non-fatal buffer stall: nudge playback position to unblock decoder
          if (data.details === 'bufferStalledError' && !videoEl.paused) {
            videoEl.currentTime += 0.1;
          }
          return;
        }
        // Fatal network errors have already used hls.js's own retries (config above).
        if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 1) {
          mediaRecoveries += 1;
          hls.recoverMediaError();
          return;
        }
        handleLoadFailure(attempt, data.details || data.type);
      });
      return;
    }

    videoEl.src = src;
    videoEl.load();
    videoEl.play().catch(function(){});
  }

  function syncPlayToggle() {
    if (!vmPlay) return;
    vmPlay.innerHTML = vmVideo.paused
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
  }

  function syncMuteToggle() {
    if (!vmMute) return;
    vmMute.innerHTML = vmVideo.muted
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93L4.93 19.07"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
  }

  function modalHasPlayableVideo() {
    return vmStage.classList.contains('vm-has-video') && !!vmVideo.currentSrc;
  }

  function togglePlayback() {
    if (!modalHasPlayableVideo()) return;
    if (vmVideo.paused) {
      vmVideo.play().catch(() => {});
    } else {
      vmVideo.pause();
    }
    syncPlayToggle();
  }

  function toggleMute(forceMuted) {
    if (!modalHasPlayableVideo()) return;
    vmVideo.muted = typeof forceMuted === 'boolean' ? forceMuted : !vmVideo.muted;
    syncMuteToggle();
  }

  function setVolume(nextVolume) {
    if (!modalHasPlayableVideo()) return;
    const clampedVolume = Math.max(0, Math.min(1, nextVolume));
    vmVideo.volume = clampedVolume;
    vmVideo.muted = clampedVolume === 0 ? true : false;
    syncMuteToggle();
  }

  function toggleFullscreen() {
    if (!modalHasPlayableVideo()) return;
    if (!document.fullscreenElement) {
      if (vmStage.requestFullscreen) vmStage.requestFullscreen();
      else if (vmStage.webkitRequestFullscreen) vmStage.webkitRequestFullscreen();
      else if (vmVideo.webkitEnterFullscreen) vmVideo.webkitEnterFullscreen(); // iOS fallback
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  }

  async function loadModalSrc(src, requestId) {
    resetProgress();
    currentModalSrc = src || '';
    retriedThisSrc = false;
    if (src) {
      await startModalLoad(src, requestId);
      if (requestId !== modalRequestId) return;
      syncPlayToggle();
    } else {
      teardownMedia();
      setStageState('soon');
      syncPlayToggle();
    }
  }

  // Native-HLS / MP4 errors (hls.js reports its own through Hls.Events.ERROR).
  vmVideo.addEventListener('error', () => {
    if (activeHls || !vmVideo.hasAttribute('src')) return;
    handleLoadFailure(loadAttempt, 'MediaError ' + (vmVideo.error ? vmVideo.error.code : '?'));
  });

  if (vmRetry) {
    vmRetry.addEventListener('click', async () => {
      if (!currentModalSrc) return;
      const requestId = ++modalRequestId;
      const src = currentModalSrc;
      modal.focus({ preventScroll: true }); // the button hides itself; keep focus in the player
      await loadModalSrc(src, requestId);
    });
  }

  function renderChapterTabs(chapters, defaultChapter) {
    if (!vmChapters) return;
    vmChapters.innerHTML = '';
    if (chapters.length < 2) {
      vmChapters.hidden = true;
      return;
    }
    vmChapters.hidden = false;
    chapters.forEach(chapter => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'vm-chapter-tab' + (chapter === defaultChapter ? ' active' : '');
      tab.textContent = chapter.dataset.label || '';
      tab.setAttribute('aria-pressed', chapter === defaultChapter ? 'true' : 'false');
      tab.addEventListener('click', () => selectChapter(chapter, tab));
      vmChapters.appendChild(tab);
    });
  }

  function buildShareUrl(slug) {
    if (!slug) return '';
    return new URL(`/films/${slug}`, window.location.origin).toString();
  }

  function updateShareButton(card) {
    currentShareUrl = buildShareUrl(card.dataset.shareSlug || '');
    if (!vmShare) return;
    vmShare.hidden = !currentShareUrl;
    vmShare.querySelector('span').textContent = 'Share';
  }

  function fallbackCopyText(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-999px';
    modal.appendChild(textarea); // inside the dialog so the focus guard leaves it alone
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  }

  async function copyShareUrl() {
    if (!currentShareUrl || !vmShare) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(currentShareUrl);
      } else if (!fallbackCopyText(currentShareUrl)) {
        throw new Error('Copy command failed');
      }
      vmShare.querySelector('span').textContent = 'Copied';
      window.setTimeout(() => {
        if (currentShareUrl && vmShare) vmShare.querySelector('span').textContent = 'Share';
      }, 1600);
    } catch (err) {
      window.prompt('Copy this film link:', currentShareUrl);
    }
  }

  async function selectChapter(chapter, tab) {
    if (tab.classList.contains('active')) return;
    Array.from(vmChapters.children).forEach(el => {
      el.classList.remove('active');
      el.setAttribute('aria-pressed', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-pressed', 'true');
    vmSub.textContent = chapter.dataset.type || '';
    const requestId = ++modalRequestId;
    await loadModalSrc(chapter.dataset.video, requestId);
  }

  async function openModal(card) {
    const chapters = Array.from(card.querySelectorAll('.vw-chapter'));
    const defaultChapter = chapters.find(ch => ch.classList.contains('active')) || chapters[0];
    const src  = chapters.length ? defaultChapter.dataset.video : card.dataset.video;
    const type = chapters.length ? (defaultChapter.dataset.type || '') : (card.dataset.type || '');
    const requestId = ++modalRequestId;
    if (typeof window.aakaaraStopVideoWorkPreviews === 'function') {
      window.aakaaraStopVideoWorkPreviews({ unload: true });
    }
    document.dispatchEvent(new CustomEvent('aakaara:modal-video-open'));
    modalLastFocusedEl = document.activeElement instanceof HTMLElement ? document.activeElement : card;
    vmTitle.textContent = card.dataset.title || '';
    vmSub.textContent   = type;
    renderChapterTabs(chapters, defaultChapter);
    updateShareButton(card);

    // GA4 FIX: fire video_play event — marks this as an engagement conversion in GA4.
    // video_type matches the playing chapter (or the card badge for single-video cards).
    if (typeof gtag === 'function') {
      gtag('event', 'video_play', {
        event_category: 'Video',
        event_label: card.dataset.title || 'Unknown',
        video_type: type || 'Unknown',
        video_category: card.dataset.vcat || 'Unknown'
      });
    }

    modalScrollY = window.scrollY || window.pageYOffset || 0;
    vmVideo.muted = true;
    vmVideo.volume = 1;
    vmVideo.playsInline = true;
    vmVideo.setAttribute('muted', '');
    vmVideo.setAttribute('playsinline', '');
    vmVideo.setAttribute('webkit-playsinline', 'true');
    syncMuteToggle();
    modal.classList.add('vm-open');
    lockModalScroll(modalScrollY);
    requestAnimationFrame(() => modal.focus({ preventScroll: true }));

    await loadModalSrc(src, requestId);
  }

  function closeModal() {
    modalRequestId += 1;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    modal.classList.remove('vm-open');
    resetProgress();
    currentModalSrc = '';
    teardownMedia();
    setStageState('soon');
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    restoreModalScroll(modalScrollY);
    document.dispatchEvent(new CustomEvent('aakaara:modal-video-close'));
    syncPlayToggle();
    syncMuteToggle();
    if (modalLastFocusedEl && document.contains(modalLastFocusedEl)) {
      const elToFocus = modalLastFocusedEl;
      requestAnimationFrame(() => elToFocus?.focus({ preventScroll: true }));
    }

    // Pause any hover-preview videos that may still be playing on .vw-card elements
    document.querySelectorAll('.vw-poster video').forEach(function(v) {
      v.pause();
      v.currentTime = 0;
    });
    document.querySelectorAll('.vw-poster.active').forEach(function(p) {
      p.classList.remove('active');
    });
    modalLastFocusedEl = null;
    currentShareUrl = '';
    if (vmShare) vmShare.hidden = true;
  }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  }

  // Controls Logic
  if (vmPlay) {
    vmPlay.addEventListener('click', togglePlayback);
  }

  if (vmMute) {
    vmMute.addEventListener('click', () => toggleMute());
  }

  if (vmFs) {
    vmFs.addEventListener('click', toggleFullscreen);

    function updateFsIcon() {
      if (document.fullscreenElement) {
        vmFs.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>';
      } else {
        vmFs.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2-2h3"/></svg>';
      }
    }

    document.addEventListener('fullscreenchange', updateFsIcon);
    document.addEventListener('webkitfullscreenchange', updateFsIcon);
    
    // Reset icon on close
    vmClose.addEventListener('click', () => { if(document.fullscreenElement) document.exitFullscreen(); });
  }

  if (vmShare) {
    vmShare.addEventListener('click', copyShareUrl);
  }

  function renderProgress(currentTime, duration) {
    const time = Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0;
    const validDuration = Number.isFinite(duration) && duration > 0;
    const elapsed = validDuration ? Math.min(time, duration) : 0;
    const percent = validDuration ? (elapsed / duration) * 100 : 0;
    if (vmFill) vmFill.style.width = `${percent}%`;
    if (vmTime) vmTime.textContent = formatTime(elapsed);
    if (vmTrack) vmTrack.setAttribute('aria-valuenow', String(Math.round(percent)));
  }

  function resetProgress() {
    renderProgress(0, 0);
  }

  function syncProgress() {
    if (!modal.classList.contains('vm-open')) return resetProgress();
    renderProgress(vmVideo.currentTime, vmVideo.duration);
  }

  if (vmVideo) {
    resetProgress();
    ['timeupdate', 'loadedmetadata', 'durationchange'].forEach(event => {
      vmVideo.addEventListener(event, syncProgress);
    });
    ['loadstart', 'emptied'].forEach(event => {
      vmVideo.addEventListener(event, resetProgress);
    });
    vmVideo.addEventListener('play', syncPlayToggle);
    vmVideo.addEventListener('pause', syncPlayToggle);
  }

  if (vmTrack) {
    vmTrack.addEventListener('click', (e) => {
      if (!vmVideo || !Number.isFinite(vmVideo.duration) || vmVideo.duration <= 0) return;
      const rect = vmTrack.getBoundingClientRect();
      if (rect.width <= 0) return;
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      vmVideo.currentTime = pos * vmVideo.duration;
      syncProgress();
    });
  }

  // 5-second skip with on-screen overlay animation
  function triggerSkip(seconds) {
    if (!vmVideo || !Number.isFinite(vmVideo.duration) || vmVideo.duration <= 0) return;
    vmVideo.currentTime = Math.max(0, Math.min(vmVideo.duration, vmVideo.currentTime + seconds));
    const overlay = seconds < 0 ? vmSkipBackOvl : vmSkipFwdOvl;
    if (overlay) {
      const overlayText = overlay.querySelector('text');
      if (overlayText) overlayText.textContent = Math.abs(seconds);
      overlay.classList.remove('vm-skip-active');
      void overlay.offsetWidth; // force reflow to restart animation
      overlay.classList.add('vm-skip-active');
      overlay.addEventListener('animationend', () => overlay.classList.remove('vm-skip-active'), { once: true });
    }
  }

  if (vmSkipBackBtn) vmSkipBackBtn.addEventListener('click', () => triggerSkip(-5));
  if (vmSkipFwdBtn) vmSkipFwdBtn.addEventListener('click', () => triggerSkip(5));

  function seekToPercentage(percent) {
    if (!modalHasPlayableVideo() || !Number.isFinite(vmVideo.duration)) return;
    vmVideo.currentTime = vmVideo.duration * percent;
  }

  function isTypingTarget(target) {
    if (!(target instanceof HTMLElement)) return false;
    return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
  }

  function handleModalKeydown(e) {
    if (!modal.classList.contains('vm-open')) return;
    if (isTypingTarget(e.target)) return;

    const key = e.key;
    const lowerKey = key.length === 1 ? key.toLowerCase() : key;
    const modalShortcutKeys = new Set([
      ' ', 'Spacebar', 'k', 'K', 'j', 'J', 'l', 'L', 'm', 'M', 'f', 'F',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Escape',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
    ]);

    if (!modalShortcutKeys.has(key) && !modalShortcutKeys.has(lowerKey)) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    if (key === 'Escape') {
      closeModal();
      return;
    }

    if (!modalHasPlayableVideo()) return;

    if (key === ' ' || key === 'Spacebar' || lowerKey === 'k') {
      togglePlayback();
      return;
    }

    if (lowerKey === 'j') {
      triggerSkip(-YT_JL_SKIP);
      return;
    }

    if (lowerKey === 'l') {
      triggerSkip(YT_JL_SKIP);
      return;
    }

    if (key === 'ArrowLeft') {
      triggerSkip(-YT_ARROW_SKIP);
      return;
    }

    if (key === 'ArrowRight') {
      triggerSkip(YT_ARROW_SKIP);
      return;
    }

    if (key === 'ArrowUp') {
      setVolume((vmVideo.muted ? 0 : vmVideo.volume) + YT_VOLUME_STEP);
      return;
    }

    if (key === 'ArrowDown') {
      setVolume((vmVideo.muted ? 0 : vmVideo.volume) - YT_VOLUME_STEP);
      return;
    }

    if (lowerKey === 'm') {
      toggleMute();
      return;
    }

    if (lowerKey === 'f') {
      toggleFullscreen();
      return;
    }

    if (key === 'Home') {
      vmVideo.currentTime = 0;
      return;
    }

    if (key === 'End') {
      vmVideo.currentTime = Math.max(0, vmVideo.duration - 0.1);
      return;
    }

    if (/^[0-9]$/.test(key)) {
      if (key === '0') {
        vmVideo.currentTime = 0;
      } else {
        seekToPercentage(Number(key) / 10);
      }
    }
  }

  document.addEventListener('keydown', handleModalKeydown);

  // a11y audit #06: the closed player is only faded out, so make it inert to
  // drop its 7 controls from the tab order and the accessibility tree.
  // Derived from `vm-open` so every open/close path stays in sync.
  function syncModalInert() {
    if (modal.classList.contains('vm-open')) modal.removeAttribute('inert');
    else modal.setAttribute('inert', '');
  }
  syncModalInert();
  new MutationObserver(syncModalInert).observe(modal, { attributes: true, attributeFilter: ['class'] });

  // a11y audit #05: keep keyboard focus inside the open player (aria-modal
  // alone doesn't), wrapping from the last control to the first.
  const MODAL_FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  function modalFocusables() {
    return Array.from(modal.querySelectorAll(MODAL_FOCUSABLE)).filter(el =>
      !el.disabled && !el.closest('[hidden]') && el.getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== 'hidden');
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !modal.classList.contains('vm-open')) return;
    const items = modalFocusables();
    if (!items.length) { e.preventDefault(); modal.focus({ preventScroll: true }); return; }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    const outside = !modal.contains(active);
    if (e.shiftKey && (outside || active === first || active === modal)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (outside || active === last)) {
      e.preventDefault();
      first.focus();
    }
  });
  document.addEventListener('focusin', (e) => {
    if (modal.classList.contains('vm-open') && !modal.contains(e.target)) {
      modal.focus({ preventScroll: true });
    }
  });

  document.querySelectorAll('.vw-card').forEach(c => c.addEventListener('click', () => openModal(c)));
  vmClose.addEventListener('click', closeModal);
  vmBg.addEventListener('click', closeModal);
})();

// ═══════ SMOOTH SCROLL ═══════
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', function(e) {
    e.preventDefault();
    const t = document.querySelector(this.getAttribute('href'));
    if (t) t.scrollIntoView({ behavior: 'smooth' });
    // a11y audit #19: the skip link must move focus, not just scroll
    if (t && this.classList.contains('skip-link')) t.focus({ preventScroll: true });
    document.getElementById('navLinks').classList.remove('show');
  });
});

// ═══════ ACCESSIBILITY & KEYBOARD NAV ═══════
(function() {
  function initA11y(selector, labelPrefix) {
    const items = document.querySelectorAll(selector);
    items.forEach(item => {
      if (!item.hasAttribute('tabindex')) item.setAttribute('tabindex', '0');
      if (!item.hasAttribute('role')) item.setAttribute('role', 'button');
      
      if (!item.hasAttribute('aria-label') && !item.matches('.gallery-item')) {
        const title = item.dataset.title || '';
        const isComingSoon = item.dataset.comingSoon === 'true';
        const label = (isComingSoon ? 'Coming Soon: ' : labelPrefix) + title;
        if (title) item.setAttribute('aria-label', label);
      }
    });
  }

  initA11y('.gallery-item', 'View photo gallery: ');
  initA11y('.vw-card', 'Play film: ');

  // Event delegation for keyboard interaction
  document.addEventListener('keydown', function(e) {
    const galleryOpen = document.getElementById('swGallery')?.classList.contains('sw-open');
    const modalOpen = document.getElementById('videoModal')?.classList.contains('vm-open');
    if (galleryOpen || modalOpen) return;

    const item = e.target.closest('.gallery-item, .vw-card');
    if (item && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      item.click(); // Triggers the inline onclick handler
    }
  });
})();

// ═══════ BACK TO TOP ═══════
(function() {
  const btn = document.getElementById('backToTop');
  if (!btn) return;
  
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 500);
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

// ═══════ GALLERY PARALLAX ON SCROLL ═══════
(function() {
  const parallaxBgs = document.querySelectorAll('.gallery-item .gi-bg');
  if (!parallaxBgs.length || window.matchMedia('(hover: none)').matches) {
    return; // Don't run on touch devices or if no items
  }

  const parallaxFactor = 0.15; // Adjust for strength (e.g., 0.1 = 10% of scroll speed)

  function updateParallax() {
    const vh = window.innerHeight;
    parallaxBgs.forEach(bg => {
      const item = bg.parentElement;
      const rect = item.getBoundingClientRect();

      // Only animate if the parent card is in the viewport
      if (rect.bottom >= 0 && rect.top <= vh) {
        const y = rect.top + rect.height / 2;
        const offset = (vh / 2 - y) * parallaxFactor;
        bg.style.transform = `translateY(${offset}px)`;
      }
    });
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => { updateParallax(); ticking = false; });
      ticking = true;
    }
  }, { passive: true });

  updateParallax(); // Initial call
})();

// ═══════ CONTACT FORM SUBMISSION (AJAX) ═══════
(function() {
  const form = document.getElementById('contactForm');
  const statusEl = document.getElementById('formStatus');
  if (!form) return;

  async function handleSubmit(event) {
    event.preventDefault();
    const submitButton = event.target.querySelector('button[type="submit"]');
    const data = new FormData(event.target);

    // Honeypot check: if _gotcha is filled, it's a bot.
    if (data.get('_gotcha')) {
      statusEl.textContent = "Thank you for your message! We'll be in touch soon.";
      statusEl.className = 'success';
      statusEl.style.display = 'block';
      form.reset();
      return;
    }

    // Clear previous status and disable button
    statusEl.style.display = 'none';
    statusEl.className = '';
    statusEl.textContent = '';
    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';

    try {
      const response = await fetch(event.target.action, {
        method: form.method,
        body: data,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        form.reset();
        // GA4 FIX: fire contact_form_submit — this is the PRIMARY CONVERSION event.
        // Mark this as a Conversion in GA4: Admin → Events → contact_form_submit → toggle Conversion.
        // value:1 lets you sum conversions in reports; event_type captures the selected service.
        if (typeof gtag === 'function') {
          const eventTypeEl = document.getElementById('contactEventType');
          gtag('event', 'contact_form_submit', {
            event_category: 'Lead',
            event_label: 'Contact Form',
            event_type: eventTypeEl ? eventTypeEl.value : 'Unknown',
            value: 1
          });
        }
        window.location.href = 'thank-you.html';
      } else {
        const responseData = await response.json();
        if (Object.hasOwn(responseData, 'errors')) {
          statusEl.textContent = responseData["errors"].map(error => error["message"]).join(", ");
        } else {
          statusEl.textContent = "Oops! There was a problem submitting your form. Please try again.";
        }
        statusEl.className = 'error';
      }
    } catch (error) {
      statusEl.textContent = "Oops! There was a network error. Please check your connection and try again.";
      statusEl.className = 'error';
    } finally {
      statusEl.style.display = 'block';
      submitButton.disabled = false;
      submitButton.textContent = 'Send Message';
    }
  }
  form.addEventListener("submit", handleSubmit);
})();

// ═══════ INITIALIZE FLATPCIKR (DATE PICKER) ═══════
(function() {
  const dateFrom = document.getElementById('dateFrom');
  const dateTo = document.getElementById('dateTo');

  if (dateFrom && dateTo) {
    const useNativeDateInputs = window.matchMedia('(max-width: 768px), (hover: none)').matches;
    const today = new Date().toISOString().split('T')[0];
    let flatpickrInitialized = false;

    if (useNativeDateInputs) {
      [dateFrom, dateTo].forEach(input => {
        input.type = 'date';
        input.min = today;
        input.inputMode = 'none';
        input.placeholder = '';
      });

      dateFrom.addEventListener('change', () => {
        if (dateFrom.value) {
          dateTo.min = dateFrom.value;
          if (dateTo.value && dateTo.value < dateFrom.value) {
            dateTo.value = dateFrom.value;
          }
        }
      });
      return;
    }

    const initializeFlatpickr = () => {
      if (flatpickrInitialized) return Promise.resolve();
      return ensureFlatpickrLibrary().then((flatpickrLib) => {
        if (flatpickrInitialized || typeof flatpickrLib !== 'function') return;
        flatpickrInitialized = true;
        const fpFrom = flatpickrLib(dateFrom, {
          altInput: true,
          altFormat: "F j, Y",
          dateFormat: "Y-m-d",
          minDate: "today",
          onChange: function(selectedDates, dateStr, instance) {
            fpTo.set('minDate', dateStr);
          }
        });
        const fpTo = flatpickrLib(dateTo, {
          altInput: true,
          altFormat: "F j, Y",
          dateFormat: "Y-m-d",
          minDate: "today"
        });
      });
    };

    [dateFrom, dateTo].forEach(input => {
      input.addEventListener('focus', () => { initializeFlatpickr(); }, { once: true });
    });

    const contactSection = document.getElementById('contact');
    if (contactSection && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer.disconnect();
        initializeFlatpickr();
      }, { rootMargin: '260px 0px' });
      observer.observe(contactSection);
    }
  }
})();

// ═══════════════════════════════════════════════════════════════
// ETHEREAL COVERFLOW CAROUSEL
// ═══════════════════════════════════════════════════════════════
class EtherealCarousel {
  constructor(containerEl, { itemSelector, lazyLoadFn }) {
    this.container = containerEl;
    this.track = containerEl.querySelector('.ec-track');
    this.itemSelector = itemSelector;
    this.lazyLoadFn = lazyLoadFn || null;
    this.currentIndex = 0;
    this.filteredItems = [];
    this.prevBtn = containerEl.querySelector('.ec-prev');
    this.nextBtn = containerEl.querySelector('.ec-next');
    this.counterCurrent = containerEl.querySelector('.ec-counter-current');
    this.counterTotal = containerEl.querySelector('.ec-counter-total');
    this._cachedCardW = 0;
    this._nativeScrollTicking = false;
    this._hasRenderedNative = false;
    this._nativeScrollSettleTimer = null;
    this._suppressClicksUntil = 0;
    this._blockNextCardClick = false;
    this._nativeTouchStart = null;
    this._bindEvents();
  }

  _useNativeScroll() {
    // Keep the cinematic coverflow consistent across desktop, tablet, and phone.
    // Reserve the simpler native rail for reduced-motion users only.
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  _noteInteraction(duration = 520) {
    this._suppressClicksUntil = performance.now() + duration;
  }

  _shouldSuppressClick() {
    return performance.now() < this._suppressClicksUntil;
  }

  _consumeBlockedCardClick() {
    if (!this._blockNextCardClick) return false;
    this._blockNextCardClick = false;
    return true;
  }

  _markNativeOffsets() {
    this.filteredItems.forEach((item, i) => {
      const offset = i - this.currentIndex;
      if (offset !== 0) item.classList.remove('gi-tap-reveal');
      if (offset === 0) item.setAttribute('data-ec-offset', '0');
      else item.setAttribute('data-ec-offset', offset < 0 ? '-1' : '1');
    });
  }

  _scrollToCurrentItem(smooth) {
    if (!this._useNativeScroll()) return;
    const item = this.filteredItems[this.currentIndex];
    if (!item) return;
    const trackRect = this.track.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const targetLeft = this.track.scrollLeft + (itemRect.left - trackRect.left) - ((trackRect.width - itemRect.width) / 2);
    this.track.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: smooth ? 'smooth' : 'auto'
    });
  }

  _syncIndexFromScroll() {
    if (!this._useNativeScroll() || !this.filteredItems.length) return;
    const trackRect = this.track.getBoundingClientRect();
    const trackCenter = trackRect.left + (trackRect.width / 2);
    let nextIndex = this.currentIndex;
    let minDistance = Infinity;

    this.filteredItems.forEach((item, i) => {
      const rect = item.getBoundingClientRect();
      const center = rect.left + (rect.width / 2);
      const distance = Math.abs(center - trackCenter);
      if (distance < minDistance) {
        minDistance = distance;
        nextIndex = i;
      }
    });

    if (nextIndex !== this.currentIndex) {
      this.currentIndex = nextIndex;
      this._markNativeOffsets();
      this._updateCounter();
      this._updateNav();
      this._triggerLazyLoad();
    }
  }

  rebuild() {
    // Collect items that are NOT hidden by the filter (display !== 'none')
    const allItems = this.track.querySelectorAll(this.itemSelector);
    this.filteredItems = [];
    allItems.forEach(item => {
      if (item.style.display !== 'none') {
        this.filteredItems.push(item);
      }
    });
    // Clamp index
    if (this.currentIndex >= this.filteredItems.length) {
      this.currentIndex = Math.max(0, this.filteredItems.length - 1);
    }
    this.render();
  }

  navigate(dir, source = 'programmatic') {
    const next = this.currentIndex + dir;
    if (next < 0 || next >= this.filteredItems.length) return;
    this.currentIndex = next;
    if (source === 'gesture') this._blockNextCardClick = true;
    this._noteInteraction(source === 'gesture' ? 520 : 320);
    this.render();
  }

  goTo(index) {
    if (index < 0 || index >= this.filteredItems.length) return;
    this.currentIndex = index;
    this._noteInteraction(320);
    this.render();
  }

  _clearCoverReveal(activeCard) {
    this.container.querySelectorAll('.gi-tap-reveal').forEach(card => {
      if (card !== activeCard) card.classList.remove('gi-tap-reveal');
    });
  }

  render() {
    this._clearCoverReveal(this.filteredItems[this.currentIndex]);
    const allItems = this.track.querySelectorAll(this.itemSelector);
    const filtered = this.filteredItems;
    const ci = this.currentIndex;

    if (this._useNativeScroll()) {
      this.container.classList.add('is-native-scroll');
      this.track.style.transform = '';
      allItems.forEach(item => {
        item.style.animation = 'none';
        item.style.transform = 'none';
        item.style.pointerEvents = item.style.display === 'none' ? 'none' : 'auto';
      });
      this._markNativeOffsets();
      this._updateCounter();
      this._updateNav();
      this._triggerLazyLoad();
      this._scrollToCurrentItem(this._hasRenderedNative);
      this._hasRenderedNative = true;
      return;
    }

    this.container.classList.remove('is-native-scroll');
    this._hasRenderedNative = false;

    // Determine width of the ACTIVE card to calculate spacing dynamically
    const activeItem = filtered[ci];
    const activeW = activeItem ? activeItem.offsetWidth : 380;

    const isMobile = window.innerWidth <= 768;
    const isTablet = window.innerWidth <= 1024;
    const isVideoCarousel = this.container.id === 'videoCarousel';

    // Portfolio cards need more breathing room and a clearer twist so the
    // side planes feel intentionally behind the hero frame.
    let offsetPx = activeW * (isVideoCarousel ? 0.82 : 0.9);
    if (activeW > 600) offsetPx = activeW * (isVideoCarousel ? 0.6 : 0.64);

    if (isMobile) offsetPx = activeW * (isVideoCarousel ? 0.62 : 0.72);
    else if (isTablet) offsetPx = activeW * (isVideoCarousel ? 0.81 : 0.84);

    // 3D depth values — keep video rail as-is, but give portfolio side cards
    // a little more depth and yaw so the stack feels more sculpted.
    let sideZ = isMobile ? (isVideoCarousel ? -28 : -42) : (isVideoCarousel ? -74 : -104);
    let sideRot = isMobile ? (isVideoCarousel ? 10 : 14) : (isVideoCarousel ? 18 : 24);
    let sideScale = isMobile ? (isVideoCarousel ? 0.86 : 0.84) : (isVideoCarousel ? 0.82 : 0.79);
    let centerZ = isMobile ? 20 : (isVideoCarousel ? 42 : 52);

    if (isVideoCarousel && isMobile) {
      sideZ = -42;
      sideRot = 15;
      sideScale = 0.86;
      centerZ = 24;
    } else if (isVideoCarousel && isTablet) {
      sideZ = -92;
      sideRot = 28;
      sideScale = 0.79;
      centerZ = 48;
    }

    // Hide every item first (clear fadeIn animation — its fill-mode overrides inline transforms)
    allItems.forEach(item => {
      item.style.animation = 'none';
      item.setAttribute('data-ec-offset', 'hidden');
      item.style.transform = 'translate(-50%, -50%) translateZ(-200px) scale(0.5)';
      item.style.pointerEvents = 'none';
    });

    // Position filtered items
    filtered.forEach((item, i) => {
      const offset = i - ci;

      if (isVideoCarousel) {
        // ── FocusRail formula for video carousel ──────────────────────────
        const dist = Math.abs(offset);
        const visible = dist <= 2;
        item.setAttribute('data-ec-offset', visible ? String(offset) : 'hidden');
        if (!visible) {
          const dir = offset > 0 ? 1 : -1;
          item.style.transform = `translate(-50%, -50%) translateX(${dir * 480 * 2.5}px) translateZ(-500px) scale(0.4)`;
          item.style.opacity = '0';
          item.style.filter = 'blur(8px) brightness(0.3)';
          item.style.zIndex = '0';
          item.style.pointerEvents = 'none';
        } else {
          // Side cards visible like portfolio carousel — tight spacing, clear content, dimmed
          const xPx        = offset * 420;
          const zPx        = -dist * 160;
          const rotY       = offset * -18;
          const scale      = offset === 0 ? 1 : dist === 1 ? 0.78 : 0.62;
          const opacity    = offset === 0 ? 1 : dist === 1 ? 0.75 : 0.4;
          const blur       = offset === 0 ? 0 : dist === 1 ? 2 : 4;
          const brightness = offset === 0 ? 1 : dist === 1 ? 0.55 : 0.35;
          item.style.transform = `translate(-50%, -50%) translateX(${xPx}px) translateZ(${zPx}px) rotateY(${rotY}deg) scale(${scale})`;
          item.style.opacity   = String(opacity);
          item.style.filter    = `blur(${blur}px) brightness(${brightness})`;
          item.style.zIndex    = String(offset === 0 ? 5 : 5 - dist);
          item.style.pointerEvents = 'auto';
        }
      } else {
        // ── Original EtherealCarousel formula for portfolio ───────────────
        if (offset === 0) {
          item.setAttribute('data-ec-offset', '0');
          item.style.transform = `translate(-50%, -50%) translateZ(${centerZ}px) scale(1) rotateY(0deg)`;
          item.style.opacity = '';
          item.style.filter = '';
          item.style.zIndex = '';
          item.style.pointerEvents = 'auto';
        } else if (offset === 1) {
          item.setAttribute('data-ec-offset', '1');
          item.style.transform = `translate(calc(-50% + ${offsetPx}px), -50%) translateZ(${sideZ}px) scale(${sideScale}) rotateY(-${sideRot}deg)`;
          item.style.opacity = '';
          item.style.filter = '';
          item.style.zIndex = '';
          item.style.pointerEvents = 'auto';
        } else if (offset === -1) {
          item.setAttribute('data-ec-offset', '-1');
          item.style.transform = `translate(calc(-50% - ${offsetPx}px), -50%) translateZ(${sideZ}px) scale(${sideScale}) rotateY(${sideRot}deg)`;
          item.style.opacity = '';
          item.style.filter = '';
          item.style.zIndex = '';
          item.style.pointerEvents = 'auto';
        } else {
          item.setAttribute('data-ec-offset', 'hidden');
          const dir = offset > 0 ? 1 : -1;
          item.style.transform = `translate(calc(-50% + ${dir * offsetPx * 2}px), -50%) translateZ(-200px) scale(0.5)`;
          item.style.opacity = '';
          item.style.filter = '';
          item.style.zIndex = '';
          item.style.pointerEvents = 'none';
        }
      }
    });

    this._updateCounter();
    this._updateNav();
    this._triggerLazyLoad();
    this.container.dispatchEvent(new CustomEvent('ec:change', { bubbles: true }));
  }

  _updateCounter() {
    if (this.counterCurrent) this.counterCurrent.textContent = this.filteredItems.length > 0 ? this.currentIndex + 1 : 0;
    if (this.counterTotal) this.counterTotal.textContent = this.filteredItems.length;
  }

  _updateNav() {
    const isFirst = this.currentIndex <= 0;
    const isLast = this.currentIndex >= this.filteredItems.length - 1;
    if (this.prevBtn) {
      this.prevBtn.classList.toggle('ec-disabled', isFirst);
      this.prevBtn.setAttribute('aria-disabled', isFirst);
    }
    if (this.nextBtn) {
      this.nextBtn.classList.toggle('ec-disabled', isLast);
      this.nextBtn.setAttribute('aria-disabled', isLast);
    }
  }

  _triggerLazyLoad() {
    // Load images for current ±1 cards
    const range = [this.currentIndex - 1, this.currentIndex, this.currentIndex + 1];
    range.forEach(i => {
      if (i >= 0 && i < this.filteredItems.length) {
        const item = this.filteredItems[i];
        if (this.lazyLoadFn) this.lazyLoadFn(item);
      }
    });
  }

  _bindEvents() {
    // Arrow clicks
    if (this.prevBtn) this.prevBtn.addEventListener('click', (e) => { e.stopPropagation(); this.navigate(-1); });
    if (this.nextBtn) this.nextBtn.addEventListener('click', (e) => { e.stopPropagation(); this.navigate(1); });

    // Click on side cards → navigate (capture phase prevents card-level handlers from firing)
    this.container.addEventListener('click', (e) => {
      const blockedCardClick = this._consumeBlockedCardClick();
      const suppressedClick = this._shouldSuppressClick();

      if (suppressedClick || blockedCardClick) {
        e.stopImmediatePropagation();
        e.preventDefault();
        return;
      }
      const card = e.target.closest(this.itemSelector);
      if (!card) return;
      const offset = card.getAttribute('data-ec-offset');
      if (!this._useNativeScroll() && (offset === '1' || offset === '-1')) {
        e.stopImmediatePropagation();
        e.preventDefault();
        this.navigate(parseInt(offset));
        return;
      }

      // On phones, one completed tap reveals the cover; the next opens it.
      // Keyboard activation and desktop mouse clicks still open immediately.
      if (this.container.id === 'portfolioCarousel' &&
          window.matchMedia('(hover: none)').matches && e.detail !== 0 &&
          !card.classList.contains('gi-tap-reveal')) {
        e.stopImmediatePropagation();
        e.preventDefault();
        this._clearCoverReveal();
        card.classList.add('gi-tap-reveal');
      }
    }, true); // capture phase — fires before card-level handlers

    // Keyboard: ArrowLeft / ArrowRight when carousel is in view
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      // Skip if gallery viewer or video modal is open
      const galleryOpen = document.getElementById('swGallery')?.classList.contains('sw-open');
      const modalOpen = document.getElementById('videoModal')?.classList.contains('vm-open');
      if (galleryOpen || modalOpen) return;
      // Only respond if this carousel is in viewport
      const rect = this.container.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      if (!inView) return;
      e.preventDefault();
      this.navigate(e.key === 'ArrowLeft' ? -1 : 1);
    });

    // Keep the first-tap reveal after the finger lifts, until another selection.
    if (this.container.id === 'portfolioCarousel') {
      document.addEventListener('click', (e) => {
        if (!this.container.contains(e.target)) this._clearCoverReveal();
      });
    }

    // Touch swipe — finger-following, prevents browser back gesture
    let touchStartX = 0, touchStartY = 0, touchDX = 0, touchIsHorizontal = null;

    this.container.addEventListener('touchstart', (e) => {
      if (this._useNativeScroll()) {
        this._nativeTouchStart = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
        return;
      }
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchDX = 0;
      touchIsHorizontal = null;
      this.track.style.transition = 'none';
    }, { passive: true });

    this.container.addEventListener('touchmove', (e) => {
      if (this._useNativeScroll()) {
        if (this._nativeTouchStart) {
          const dx = e.touches[0].clientX - this._nativeTouchStart.x;
          const dy = e.touches[0].clientY - this._nativeTouchStart.y;
          if (Math.abs(dx) > 8 || Math.abs(dy) > 8) this._noteInteraction(700);
        }
        return;
      }
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      if (touchIsHorizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        touchIsHorizontal = Math.abs(dx) > Math.abs(dy);
      }
      if (touchIsHorizontal) {
        e.preventDefault();
        touchDX = dx;
        const dragResistance = window.innerWidth <= 768 ? 0.42 : 0.38;
        this.track.style.transform = `translateX(${dx * dragResistance}px)`;
      }
    }, { passive: false });

    this.container.addEventListener('touchend', () => {
      if (this._useNativeScroll()) {
        this._nativeTouchStart = null;
        return;
      }
      this.track.style.transition = 'transform 0.3s ease';
      this.track.style.transform = '';
      if (Math.abs(touchDX) > 10) this._noteInteraction(700);
      if (Math.abs(touchDX) > 30) {
        this.navigate(touchDX < 0 ? 1 : -1, 'gesture');
      }
      touchDX = 0;
      touchIsHorizontal = null;
    });

    // Mouse drag swipe (trackpad / click-and-drag)
    let mouseDown = false, mouseStartX = 0, mouseMoved = false;
    this.container.addEventListener('mousedown', (e) => {
      if (this._useNativeScroll()) return;
      // Ignore clicks on nav buttons
      if (e.target.closest('.ec-nav')) return;
      mouseDown = true;
      mouseMoved = false;
      mouseStartX = e.clientX;
      this.container.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', (e) => {
      if (!mouseDown) return;
      if (Math.abs(e.clientX - mouseStartX) > 10) mouseMoved = true;
    });
    document.addEventListener('mouseup', (e) => {
      if (!mouseDown) return;
      mouseDown = false;
      this.container.style.cursor = '';
      const dx = e.clientX - mouseStartX;
      if (mouseMoved && Math.abs(dx) > 10) this._noteInteraction(700);
      if (Math.abs(dx) > 30 && mouseMoved) {
        this.navigate(dx < 0 ? 1 : -1, 'gesture');
      }
    });

    // Scroll wheel navigation — only intercept horizontal swipes, let vertical scroll pass through
    let wheelTimer = null;
    let wheelAccum = 0;
    this.container.addEventListener('wheel', (e) => {
      if (this._useNativeScroll()) return;
      // Only intercept horizontal gestures (trackpad two-finger swipe left/right)
      // Let vertical scroll pass through so user can scroll down the page
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      // Horizontal swipe detected — prevent page scroll and navigate carousel
      e.preventDefault();
      wheelAccum += e.deltaX;
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        if (Math.abs(wheelAccum) > 30) {
          this._noteInteraction(700);
          this.navigate(wheelAccum > 0 ? 1 : -1, 'gesture');
        }
        wheelAccum = 0;
      }, 50);
    }, { passive: false });

    // Responsive — invalidate cached width and re-render on resize
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this._cachedCardW = 0; // Force recalculation
        this.render();
      }, 150);
    });

    this.track.addEventListener('scroll', () => {
      if (!this._useNativeScroll()) return;
      this._noteInteraction(700);
      clearTimeout(this._nativeScrollSettleTimer);
      this._nativeScrollSettleTimer = setTimeout(() => {
        this._syncIndexFromScroll();
      }, 90);
    }, { passive: true });

  }
}

// Lazy-load helper for gallery items
function shouldPreloadGalleryFrames() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const onTouchDevice = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  if (onTouchDevice) return false;
  if (connection && connection.saveData) return false;
  if (connection && /(^|slow-)?2g|3g/.test(connection.effectiveType || '')) return false;
  return true;
}

function lazyLoadGalleryItem(item) {
  const bg = item.querySelector('.gi-bg');
  if (!bg || bg.style.backgroundImage) return; // Already loaded
  const folder = item.dataset.folder;
  const ext = item.dataset.ext || 'jpg';
  const coverSrc = item.dataset.cover || (folder ? `${folder}/1.${ext}` : null);
  if (coverSrc) {
    const img = new Image();
    img.decoding = 'async';
    img.onload = function() {
      bg.style.backgroundImage = `url('${coverSrc}')`;
      if (item.dataset.bgSize) bg.style.backgroundSize = item.dataset.bgSize;
      if (item.dataset.bgPos) bg.style.backgroundPosition = item.dataset.bgPos;
    };
    img.src = coverSrc;
    // Keep the first-click experience snappy on desktop without front-loading
    // several multi-megabyte gallery frames on mobile.
    if (!item.dataset.comingSoon && folder && shouldPreloadGalleryFrames()) {
      const count = parseInt(item.dataset.count || '1', 10);
      for (let i = 2; i <= Math.min(2, count); i++) {
        const preImg = new Image();
        preImg.decoding = 'async';
        preImg.src = `${folder}/${i}.${ext}`;
      }
    }
  }
}

// ═══════ VIDEO FOCUS RAIL ═══════

function vfrWrap(n, count) {
  return ((n % count) + count) % count;
}

function vfrCardStyle(offset) {
  const dist = Math.abs(offset);
  const xPx = offset * 480;
  const zPx = -dist * 220;
  const rotY = offset * -12;
  const scale = offset === 0 ? 1 : 0.82;
  const opacity = offset === 0 ? 1 : Math.max(0.1, 1 - dist * 0.5);
  const blur = offset === 0 ? 0 : dist * 4;
  const brightness = offset === 0 ? 1 : 0.5;
  return {
    transform: `translateX(${xPx}px) translateZ(${zPx}px) rotateY(${rotY}deg) scale(${scale})`,
    opacity,
    filter: `blur(${blur}px) brightness(${brightness})`,
    zIndex: offset === 0 ? 5 : 5 - dist,
  };
}

class VideoFocusRail {
  constructor(container) {
    this.container = container;
    this.cards = Array.from(container.querySelectorAll('.vfr-card'));
    this.count = this.cards.length;
    this.activeIndex = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.lastWheelTime = 0;

    // Inject poster <img> and sheen overlay into each card
    this.cards.forEach(card => {
      const img = document.createElement('img');
      img.src = card.dataset.poster || '';
      img.alt = card.dataset.title || '';
      card.appendChild(img);
      const sheen = document.createElement('div');
      sheen.className = 'vfr-card-sheen';
      card.appendChild(sheen);
    });

    this._ambA    = container.querySelector('.vfr-amb-a');
    this._ambB    = container.querySelector('.vfr-amb-b');
    this._ambSlot = 'a';
    this._text    = container.querySelector('.vfr-text');
    this._meta    = container.querySelector('.vfr-meta');
    this._titleEl = container.querySelector('.vfr-title');
    this._descEl  = container.querySelector('.vfr-desc');
    this._countEl = container.querySelector('.vfr-count');
    this._prevBtn = container.querySelector('.vfr-prev');
    this._nextBtn = container.querySelector('.vfr-next');
    this._watchBtn = container.querySelector('.vfr-watch-btn');

    this._keydownHandler = null;

    this.render();
    this.updateAmbience(true);
    this.updateInfo(true);
    this.bindEvents();
  }

  render() {
    this.cards.forEach((card, i) => {
      let offset = i - this.activeIndex;
      if (offset > Math.floor(this.count / 2))  offset -= this.count;
      if (offset < -Math.floor(this.count / 2)) offset += this.count;

      const visible = Math.abs(offset) <= 2;
      if (!visible) {
        card.style.opacity = '0';
        card.style.pointerEvents = 'none';
        card.classList.remove('is-center');
        card._vfrOffset = null;
        return;
      }

      const s = vfrCardStyle(offset);
      card.style.transform     = s.transform;
      card.style.opacity       = s.opacity;
      card.style.filter        = s.filter;
      card.style.zIndex        = s.zIndex;
      card.style.pointerEvents = 'auto';
      card.classList.toggle('is-center', offset === 0);
      card._vfrOffset = offset;
    });
  }

  updateAmbience(immediate = false) {
    const poster = this.cards[this.activeIndex].dataset.poster;
    if (!poster) return;
    const incoming = this._ambSlot === 'a' ? this._ambB : this._ambA;
    const outgoing = this._ambSlot === 'a' ? this._ambA : this._ambB;

    if (immediate) {
      incoming.src = poster;
      incoming.classList.add('vfr-amb-active');
      outgoing.classList.remove('vfr-amb-active');
      this._ambSlot = incoming === this._ambA ? 'a' : 'b';
      return;
    }

    incoming.src = poster;
    incoming.onload = () => {
      incoming.classList.add('vfr-amb-active');
      outgoing.classList.remove('vfr-amb-active');
      this._ambSlot = incoming === this._ambA ? 'a' : 'b';
    };
  }

  updateInfo(immediate = false) {
    const card = this.cards[this.activeIndex];
    const doUpdate = () => {
      this._meta.textContent    = card.dataset.type  || '';
      this._titleEl.textContent = card.dataset.title || '';
      this._descEl.textContent  = card.dataset.desc  || '';
      this._countEl.textContent = `${this.activeIndex + 1} / ${this.count}`;
    };

    if (immediate) { doUpdate(); return; }

    this._text.classList.add('vfr-exit');
    setTimeout(() => {
      doUpdate();
      this._text.classList.remove('vfr-exit');
      this._text.classList.add('vfr-enter');
      setTimeout(() => this._text.classList.remove('vfr-enter'), 350);
    }, 220);
  }

  prev() {
    this.activeIndex = vfrWrap(this.activeIndex - 1, this.count);
    this.render();
    this.updateAmbience();
    this.updateInfo();
  }

  next() {
    this.activeIndex = vfrWrap(this.activeIndex + 1, this.count);
    this.render();
    this.updateAmbience();
    this.updateInfo();
  }

  goTo(offset) {
    this.activeIndex = vfrWrap(this.activeIndex + offset, this.count);
    this.render();
    this.updateAmbience();
    this.updateInfo();
  }

  openActive() {
    if (typeof openModal === 'function') {
      openModal(this.cards[this.activeIndex]);
    }
  }

  bindEvents() {
    this._prevBtn.addEventListener('click', () => this.prev());
    this._nextBtn.addEventListener('click', () => this.next());
    this._watchBtn.addEventListener('click', () => this.openActive());

    this.cards.forEach(card => {
      card.addEventListener('click', () => {
        if (this.isDragging) return;
        const offset = card._vfrOffset;
        if (offset === 0) { this.openActive(); }
        else if (offset !== null && offset !== undefined) { this.goTo(offset); }
      });
    });

    // Keyboard — in-viewport guard prevents conflict with EtherealCarousel arrow keys
    this._keydownHandler = (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const modal = document.getElementById('videoModal');
      if (modal && modal.classList.contains('vm-open')) return;
      const rect = this.container.getBoundingClientRect();
      if (rect.top >= window.innerHeight || rect.bottom <= 0) return;
      e.key === 'ArrowLeft' ? this.prev() : this.next();
    };
    document.addEventListener('keydown', this._keydownHandler);

    // Mouse wheel — debounced 400ms
    this.container.addEventListener('wheel', (e) => {
      const now = Date.now();
      if (now - this.lastWheelTime < 400) return;
      const isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const delta = isHorizontal ? e.deltaX : e.deltaY;
      if (Math.abs(delta) > 20) {
        delta > 0 ? this.next() : this.prev();
        this.lastWheelTime = now;
      }
    }, { passive: true });

    // Pointer drag / swipe
    this.container.addEventListener('pointerdown', (e) => {
      this.isDragging = false;
      this.dragStartX = e.clientX;
    });
    this.container.addEventListener('pointermove', (e) => {
      if (Math.abs(e.clientX - this.dragStartX) > 5) this.isDragging = true;
    });
    this.container.addEventListener('pointerup', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.dragStartX;
      if (Math.abs(dx) > 60) { dx < 0 ? this.next() : this.prev(); }
      setTimeout(() => { this.isDragging = false; }, 50);
    });
  }

  destroy() {
    if (this._keydownHandler) {
      document.removeEventListener('keydown', this._keydownHandler);
    }
  }
}

// Global references
let portfolioCarousel, videoCarousel;

// ═══════ INITIALIZE FILTERS + CAROUSELS ═══════
(function() {
  // 1. Run initial filters
  const allBtnPortfolio = document.querySelector('.portfolio-filters button.active');
  if (allBtnPortfolio) filterGallery('all', allBtnPortfolio);

  const allBtnVideo = document.querySelector('.vw-filters button.active');
  if (allBtnVideo) filterVideos('all', allBtnVideo);

  // 2. Instantiate carousels
  const portfolioEl = document.getElementById('portfolioCarousel');
  if (portfolioEl) {
    portfolioCarousel = new EtherealCarousel(portfolioEl, {
      itemSelector: '.gallery-item',
      lazyLoadFn: lazyLoadGalleryItem,
    });
    portfolioCarousel.rebuild();
  }

  const videoEl = document.getElementById('videoCarousel');
  if (videoEl) {
    videoCarousel = new EtherealCarousel(videoEl, {
      itemSelector: '.vw-card',
    });
    videoCarousel.rebuild();
  }

  // 3. Wire full-section ambience to active videoCarousel card
  (function() {
    const ambience = document.getElementById('vwAmbience');
    if (!ambience || !videoCarousel) return;
    const imgA = ambience.querySelector('.vfr-amb-a');
    const imgB = ambience.querySelector('.vfr-amb-b');
    if (!imgA || !imgB) return;
    let useA = true;
    let lastPoster = '';

    function updateAmbience() {
      const center = document.querySelector('#vwGrid .vw-card[data-ec-offset="0"]');
      const poster = center ? (center.dataset.poster || '') : '';
      if (!poster || poster === lastPoster) return;
      lastPoster = poster;
      const next = useA ? imgA : imgB;
      const prev = useA ? imgB : imgA;
      next.src = poster;
      next.onload = () => {
        next.classList.add('vfr-amb-active');
        prev.classList.remove('vfr-amb-active');
        useA = !useA;
      };
    }

    // Run on carousel navigation
    const carouselEl = document.getElementById('videoCarousel');
    if (carouselEl) {
      carouselEl.addEventListener('ec:change', updateAmbience);
    }
    // Also run after filters change (videoCarousel.rebuild resets the grid)
    document.querySelectorAll('.vw-filters button').forEach(btn => {
      btn.addEventListener('click', () => setTimeout(updateAmbience, 50));
    });
    // Initial
    setTimeout(updateAmbience, 100);
  })();
})();

// ═══════ PORTFOLIO SECTION - CINEMATIC INTRO ═══════
(function() {
  const portfolioSection = document.getElementById('portfolio');
  if (!portfolioSection) return;

  const title = document.getElementById('portfolioTitle');
  const desc = document.getElementById('portfolioDesc');

  // Wrap title words in mask containers for cinematic rise reveal
  if (title && !title.querySelector('.word-mask')) {
    const text = title.textContent.trim();
    title.innerHTML = '';
    text.split(' ').forEach((word, i) => {
      if (i > 0) title.appendChild(document.createTextNode('\u00A0'));
      const mask = document.createElement('span');
      mask.className = 'word-mask';
      const inner = document.createElement('span');
      inner.className = 'word-inner';
      inner.textContent = word;
      mask.appendChild(inner);
      title.appendChild(mask);
    });
  }
  const wordInners = title ? title.querySelectorAll('.word-inner') : [];

  const portfolioObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        portfolioSection.classList.add('is-animated');

        // Stagger: accent line first, then words, then desc (filter pills stagger via CSS animation-delay)
        wordInners.forEach((inner, i) => { inner.style.transitionDelay = `${300 + i * 180}ms`; });
        if (desc) desc.style.transitionDelay = '750ms';

        portfolioObserver.unobserve(portfolioSection);
      }
    });
  }, { threshold: 0.25 });

  portfolioObserver.observe(portfolioSection);
})();

// ═══════ VIDEO WORKS SECTION INTRO ═══════
(function() {
  const videoSection = document.getElementById('video-works');
  const videoIntro = document.getElementById('videoIntro');
  const videoEyebrow = document.getElementById('videoEyebrow');
  const videoTitle = document.getElementById('videoTitle');
  const videoDesc = document.getElementById('videoDesc');
  if (!videoSection || !videoIntro || !videoEyebrow || !videoTitle || !videoDesc) return;

  if (!videoEyebrow.querySelector('.video-tag-letter')) {
    const text = videoEyebrow.textContent.trim();
    videoEyebrow.textContent = '';

    // a11y audit #10: screen readers get the phrase once, not 13 single letters.
    const label = document.createElement('span');
    label.className = 'sr-only';
    label.textContent = text;
    videoEyebrow.appendChild(label);

    [...text].forEach((char, i) => {
      const span = document.createElement('span');
      span.className = 'video-tag-letter';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = char === ' ' ? '\u00A0' : char;
      span.style.transitionDelay = `${80 + i * 34}ms`;
      videoEyebrow.appendChild(span);
    });
  }

  videoSection.classList.add('video-works-enhanced');

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    videoSection.classList.add('is-animated');
    return;
  }

  videoTitle.style.transitionDelay = '320ms';
  videoDesc.style.transitionDelay = '520ms';

  const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      videoSection.classList.add('is-animated');
      videoObserver.unobserve(videoSection);
    });
  }, { threshold: 0.28 });

  videoObserver.observe(videoSection);
})();

// ═══════ ATTACH FILTER EVENT LISTENERS ═══════
(function() {
  // This runs after the DOM is ready because the script is at the end of the body.
  // It replaces the old inline onclick="" attributes with a more robust method.

  const portfolioFilters = document.querySelector('.portfolio-filters');
  if (portfolioFilters) {
    portfolioFilters.addEventListener('click', e => {
      if (e.target.tagName === 'BUTTON' && e.target.dataset.filter) {
        filterGallery(e.target.dataset.filter, e.target);
      }
    });
  }

  const videoFilters = document.querySelector('.vw-filters');
  if (videoFilters) {
    videoFilters.addEventListener('click', e => {
      if (e.target.tagName === 'BUTTON' && e.target.dataset.filter) {
        filterVideos(e.target.dataset.filter, e.target);
      }
    });
  }
})();

// ═══════ COUPLE PORTRAITS PAGE — LOCATION GUIDE HOVER ═══════
(function() {
  const locs = document.querySelectorAll('.nyc-loc');
  const previews = document.querySelectorAll('.nyc-preview-img');
  const previewShell = document.querySelector('.nyc-preview');
  if (!locs.length || !previews.length || !previewShell) return;

  // Map data-location-id → preview class suffix (e.g. "cp" → ".nyc-cp")
  function showPreview(id) {
    let activePreview = null;
    previews.forEach(p => {
      const matches = p.classList.contains('nyc-' + id);
      p.classList.toggle('active', matches);
      if (matches) activePreview = p;
    });

    if (!activePreview) return;

    const previewAspect = activePreview.dataset.previewAspect;
    const previewWidth = activePreview.dataset.previewWidth;

    if (previewAspect) {
      previewShell.style.setProperty('--preview-aspect', previewAspect);
    }

    if (previewWidth) {
      previewShell.style.setProperty('--preview-width', previewWidth);
    }
  }

  locs.forEach(loc => {
    loc.addEventListener('mouseenter', () => {
      showPreview(loc.dataset.locationId);
    });

    loc.addEventListener('focus', () => {
      showPreview(loc.dataset.locationId);
    });

    loc.addEventListener('click', (e) => {
      if (loc.tagName === 'A' && loc.href) return;
      const url = loc.dataset.locationUrl;
      if (!url) return;
      e.preventDefault();
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  });
})();

// ═══════ COUPLE PORTRAITS PAGE — GALLERY FILTER BAR ═══════
(function() {
  const filterBar = document.querySelector('.filter-bar');
  const workItems = document.querySelectorAll('.work-item');
  if (!filterBar || !workItems.length) return;

  filterBar.addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;

    filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const filter = btn.dataset.filter;
    workItems.forEach(item => {
      const show = filter === 'all' || item.dataset.location === filter;
      item.style.display = show ? '' : 'none';
    });
  });
})();

// ═══════ TESTIMONIALS — FLOATING SCROLL ANIMATION ═══════
(function() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const wrapper = document.querySelector('.lab-testimonial-wrapper');
  const stage = document.querySelector('.lab-testimonial-stage');
  if (!wrapper || !stage) return;

  const marquee = stage.querySelector('.lab-testimonial-marquee');
  const track = stage.querySelector('.lab-testimonial-track');
  const cards = Array.from(stage.querySelectorAll('.lab-quote-card'));
  if (!marquee || !track || !cards.length) return;

  const interactiveViewport = () => window.innerWidth > 767 && !prefersReducedMotion.matches;
  const mobileCurrentEl = stage.querySelector('[data-testimonial-mobile-current]');
  const mobilePips = Array.from(stage.querySelectorAll('.lab-testimonial-mobile-pip'));
  const clampValue = (value, min, max) => Math.min(max, Math.max(min, value));

  let wrapTop = 0;
  let currentProgress = 0;
  let targetProgress = 0;
  let mobileScrollTick = 0;
  let mobileSnapTimer = 0;

  const setMobileActive = (index) => {
    cards.forEach((card, cardIndex) => {
      card.classList.toggle('is-mobile-active', cardIndex === index);
    });

    mobilePips.forEach((pip, pipIndex) => {
      pip.classList.toggle('is-active', pipIndex === index);
    });

    if (mobileCurrentEl) {
      mobileCurrentEl.textContent = String(index + 1).padStart(2, '0');
    }
  };

  const syncMobileActive = () => {
    if (interactiveViewport()) return;
    const trackRect = track.getBoundingClientRect();
    const trackCenter = trackRect.left + (trackRect.width / 2);

    let activeIndex = 0;
    let nearestDistance = Infinity;

    cards.forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      const cardCenter = rect.left + (rect.width / 2);
      const deltaPx = cardCenter - trackCenter;
      const distance = Math.abs(deltaPx);
      const normalized = clampValue(deltaPx / (rect.width * 0.92), -1.35, 1.35);
      const depth = 1 - Math.min(Math.abs(normalized), 1);
      const scale = 0.92 + (depth * 0.08);
      const rotateY = normalized * -10;
      const shiftX = normalized * -12;
      const lift = 5 - (depth * 8);
      const opacity = 0.5 + (depth * 0.5);
      const shadow = 0.08 + (depth * 0.14);
      const quoteParallax = -1 * depth;
      const footerParallax = 4.5 * depth;
      const avatarParallax = -3 * depth;
      const sealParallax = 2 * depth;

      card.style.setProperty('--mobile-rotateY', `${rotateY.toFixed(2)}deg`);
      card.style.setProperty('--mobile-shift-x', `${shiftX.toFixed(2)}px`);
      card.style.setProperty('--mobile-lift', `${lift.toFixed(2)}px`);
      card.style.setProperty('--mobile-scale', `${scale.toFixed(3)}`);
      card.style.setProperty('--mobile-opacity', `${opacity.toFixed(3)}`);
      card.style.setProperty('--mobile-shadow', `${shadow.toFixed(3)}`);
      card.style.setProperty('--quote-parallax', `${quoteParallax.toFixed(2)}px`);
      card.style.setProperty('--footer-parallax', `${footerParallax.toFixed(2)}px`);
      card.style.setProperty('--avatar-parallax', `${avatarParallax.toFixed(2)}px`);
      card.style.setProperty('--seal-parallax', `${sealParallax.toFixed(2)}px`);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        activeIndex = index;
      }
    });

    setMobileActive(activeIndex);
    return activeIndex;
  };

  const snapMobileTrack = () => {
    if (interactiveViewport()) return;
    const activeIndex = syncMobileActive();
    const activeCard = cards[activeIndex];
    if (!activeCard) return;

    const targetLeft = activeCard.offsetLeft - ((track.clientWidth - activeCard.offsetWidth) / 2);
    track.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: 'smooth'
    });
  };

  const cacheLayout = () => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    wrapTop = wrapper.getBoundingClientRect().top + scrollTop;
    if (!interactiveViewport()) {
      syncMobileActive();
    }
  };

  const pauseTrack = () => stage.classList.add('is-paused');
  const resumeTrack = () => stage.classList.remove('is-paused');

  marquee.addEventListener('pointerenter', pauseTrack);
  marquee.addEventListener('pointerleave', resumeTrack);
  marquee.addEventListener('focusin', pauseTrack);
  marquee.addEventListener('focusout', resumeTrack);

  track.addEventListener('scroll', () => {
    if (mobileScrollTick) return;
    mobileScrollTick = requestAnimationFrame(() => {
      mobileScrollTick = 0;
      syncMobileActive();
    });

    window.clearTimeout(mobileSnapTimer);
    mobileSnapTimer = window.setTimeout(() => {
      snapMobileTrack();
    }, 110);
  }, { passive: true });

  cards.forEach((card) => {
    card.addEventListener('pointerenter', pauseTrack);
    card.addEventListener('pointerleave', resumeTrack);
    card.addEventListener('focusin', pauseTrack);
    card.addEventListener('focusout', resumeTrack);
  });

  cacheLayout();
  window.addEventListener('resize', cacheLayout, { passive: true });
  window.addEventListener('load', cacheLayout, { once: true });
  setMobileActive(0);

  const motionCards = cards.map((card, index) => ({
    element: card,
    order: Number(card.dataset.cardIndex || index),
    baseX: Number(card.dataset.x || 0),
    amplitude: Number(card.dataset.amp || 14),
    speed: 0.00055 * Number(card.dataset.speed || 1),
    phase: Number(card.dataset.phase || 0) + index * 0.37,
    rotationBase: Number(card.dataset.rotate || 0),
    rotationAmplitude: 0.28 + (index % 4) * 0.09,
    driftAmplitude: 4.2 + (index % 3) * 1.8
  }));

  let activeTime = 0;
  let lastTime = 0;

  const render = (time) => {
    if (!lastTime) lastTime = time;
    const delta = Math.min(time - lastTime, 40);
    lastTime = time;

    const isInteractive = interactiveViewport();
    const isPaused = stage.classList.contains('is-paused');

    if (isInteractive && !isPaused) activeTime += delta;

    if (isInteractive) {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const viewportHeight = window.innerHeight || 1;
      const scrollInto = scrollY - wrapTop;
      const maxProgress = Math.max(cards.length - 1, 0);
      targetProgress = Math.max(0, Math.min(maxProgress, scrollInto / viewportHeight));
      currentProgress += (targetProgress - currentProgress) * 0.12;
    } else {
      currentProgress = 0;
      targetProgress = 0;
    }

    const stageWidth = stage.clientWidth || window.innerWidth;
    const horizontalGutter = Math.max(18, stageWidth * 0.025);

    motionCards.forEach((card) => {
      const t = activeTime * card.speed + card.phase;
      const driftX = Math.cos(t * 0.82) * card.driftAmplitude;
      const y = Math.sin(t) * card.amplitude;
      const rotation = card.rotationBase + Math.sin(t * 0.74) * card.rotationAmplitude;
      const relative = card.order - currentProgress;
      const distance = Math.abs(relative);
      const verticalStep = (window.innerHeight || 900) * 0.74;
      const scrollY = relative * verticalStep;
      const opacity = Math.max(0, Math.min(1, 1 - distance * 0.4));
      const scale = Math.max(0.84, 1 - distance * 0.08);
      const zIndex = String(40 - Math.round(distance * 10));
      const halfCardWidth = (card.element.offsetWidth * scale) / 2;
      const baseX = (card.baseX / 100) * stageWidth;
      const safeX = Math.max(
        (-stageWidth / 2) + halfCardWidth + horizontalGutter,
        Math.min((stageWidth / 2) - halfCardWidth - horizontalGutter, baseX + driftX)
      );

      card.element.style.setProperty('--float-x', '0px');
      card.element.style.setProperty('--card-safe-x', `${safeX.toFixed(2)}px`);
      card.element.style.setProperty('--float-y', `${y.toFixed(2)}px`);
      card.element.style.setProperty('--float-rotate', `${rotation.toFixed(2)}deg`);
      card.element.style.setProperty('--scroll-react-y', `${scrollY.toFixed(2)}px`);
      card.element.style.setProperty('--card-scale', `${scale.toFixed(3)}`);
      card.element.style.setProperty('--card-opacity', `${opacity.toFixed(3)}`);
      card.element.style.zIndex = zIndex;
    });

    if (!isInteractive) {
      syncMobileActive();
    }

    requestAnimationFrame(render);
  };

  requestAnimationFrame(render);
})();

// ═══════ ABOUT NAME REVEAL ═══════
(function() {
  const aboutNameWrapper = document.querySelector('.about-name-wrapper');
  if (!aboutNameWrapper) return;
  const nameObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('about-name--visible');
        nameObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });
  nameObserver.observe(aboutNameWrapper);
})();

// ═══════ GA4 — SERVICES SECTION VIEWED ═══════
// GA4 FIX: fires once when #services-overview scrolls into view (50% visible).
// Signals high-intent browsing — users who reach pricing/services are more likely
// to enquire. Use this in GA4 to build a retargeting audience:
//   Admin → Audiences → "Viewed Services, No Form Submit"
//   Condition: services_viewed AND NOT contact_form_submit
(function() {
  const servicesSection = document.getElementById('services-overview');
  if (!servicesSection || typeof IntersectionObserver === 'undefined') return;

  const servicesObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        if (typeof gtag === 'function') {
          gtag('event', 'services_viewed', {
            event_category: 'Engagement',
            event_label: 'Services Overview Section',
            value: 1
          });
        }
        servicesObserver.unobserve(entry.target); // fire once per session
      }
    });
  }, { threshold: 0.5 });

  servicesObserver.observe(servicesSection);
})();

// ═══════ COUPLE PORTRAITS LINKS: SKIP INTRO + REMEMBER SCROLL ═══════
// Delegated instead of inline onclick: Netlify's Pretty URLs rewrite
// re-quotes inline handlers on .html links and breaks them in production.
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href*="couple-portraits"]');
  if (!link) return;
  sessionStorage.setItem('skipIntro', '1');
  sessionStorage.setItem('returnScrollY', String(window.scrollY));
});

// ═══════ SERVICES ORBIT (desktop + phone) ═══════
// Desktop: a copy of the first spiral on animation_spatial_gallery.html (same
// helix, hand-tuned waiting/past paths, field pan, spring, wheel capture and
// video loading) — keep that in step with the study page. Phones
// (.sov-orbit-phone) show a looping ring instead (ringProps), turned by
// sideways swipes, with buttons; this differs from the study. Tablets keep the list.
(function () {
  'use strict';
  var section = document.getElementById('services-overview');
  var field = section && section.querySelector('.sov-orbit-field');
  if (!section || !field) return;
  var cards = Array.prototype.slice.call(field.querySelectorAll('.sov-orbit-card'));
  if (!cards.length) return;

  var compact = window.matchMedia('(max-width: 1199px), (max-width: 1366px) and (any-pointer: coarse)');
  var phone = window.matchMedia('(max-width: 599px), (max-width: 959px) and (max-height: 500px)');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var copies = cards.map(function (card) { return card.querySelector('.sov-orbit-copy'); });
  var previousButton = section.querySelector('.sov-orbit-prev');
  var nextButton = section.querySelector('.sov-orbit-next');
  var countLabel = section.querySelector('.sov-orbit-count');
  var gestureLabel = section.querySelector('.sov-orbit-gesture');

  /* ─── From the study page, verbatim ─────────────────────────── */
  // One continuous helix: positive offsets wait below/right; negative offsets recede above/left.
  function spiralProps(offset) {
    var angle = offset * Math.PI * 55 / 180;
    var distance = Math.abs(offset);
    // Local position adjustment for the third slot; zero at slots two and four.
    var thirdSlot = offset > 1 && offset < 3
      ? Math.pow(Math.sin(Math.PI * (offset - 1) / 2), 2) : 0;
    var fade = Math.max(0, Math.min(1, (4.5 - distance) / 0.75));
    return {
      // Shift the second slot right, blending smoothly into adjacent positions.
      tx: 34 * Math.sin(angle) + (offset > 0 && offset < 2
        ? 4 * Math.pow(Math.sin(Math.PI * offset / 2), 2) : 0) + 12.85 * thirdSlot,
      ty: -25 + 52 * offset + 32.7 * thirdSlot,
      tz: -650 * (1 - Math.cos(angle)),
      // Open the second slot toward the viewer, easing away toward adjacent slots.
      ry: offset * 55 + (offset > 0 && offset < 2
        ? -10 * Math.pow(Math.sin(Math.PI * offset / 2), 2) : 0),
      // Card 3 recedes behind card 2, then returns to full size along the path.
      sc: 1 - 0.28 * thirdSlot,
      op: fade * fade * (3 - 2 * fade)
    };
  }

  // Critically damped spring (units: cards, cards/s): velocity stays continuous,
  // it settles exactly on the target with no overshoot, and requests frames only while moving.
  function createSpiralSpring(render) {
    var FREQUENCY = 11.4; // rad/s = 2π / 0.55 s — iOS's default spring response; settles in ~0.9 s
    var position = 0, velocity = 0, target = 0;
    var frame = null, lastTime = 0;

    function step(time) {
      frame = null;
      var dt = lastTime ? Math.min(0.064, Math.max(0, (time - lastTime) / 1000)) : 1 / 60;
      lastTime = time;
      // Exact solution of the critically damped spring over dt (frame-rate independent).
      var offset = position - target;
      var drift = velocity + FREQUENCY * offset;
      var decay = Math.exp(-FREQUENCY * dt);
      position = target + (offset + drift * dt) * decay;
      velocity = (drift - FREQUENCY * (offset + drift * dt)) * decay;
      if (Math.abs(position - target) < 0.0005 && Math.abs(velocity) < 0.01) {
        position = target; // sub-pixel from the slot: land exactly on it
        velocity = 0;
      }
      render(position);
      if (position !== target || velocity !== 0) frame = requestAnimationFrame(step);
      else lastTime = 0;
    }

    return {
      moveTo: function (next, handoffVelocity) {
        target = next;
        if (typeof handoffVelocity === 'number') velocity = handoffVelocity;
        if (frame === null && (position !== target || velocity !== 0)) {
          frame = requestAnimationFrame(step);
        }
      },
      jumpTo: function (next) {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
        lastTime = 0;
        position = target = next;
        velocity = 0;
        render(position);
      }
    };
  }


  // The spiral turns only while its section sits flush with the viewport. If the
  // wheel arrives while the section is part-way scrolled, glide the page into
  // place first (one smooth scroll, not restarted by every event).
  var alignY = null, alignUntil = 0;
  function sectionAligned() {
    var top = section.getBoundingClientRect().top;
    var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    return Math.abs(top) <= 1 ||
      (top > 0 && window.scrollY >= maxScroll - 1) || (top < 0 && window.scrollY <= 0);
  }
  function alignSection() {
    var y = Math.round(window.scrollY + section.getBoundingClientRect().top);
    var now = performance.now();
    if (y === alignY && now < alignUntil) return;
    alignY = y;
    alignUntil = now + 700;
    window.scrollTo({ top: y, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  }

  // Desktop paths: waiting cards approach along a hand-tuned arc (card 3 tucks
  // behind card 2); past cards keep receding in depth. tx: vw, ty: % of card height,
  // tz: px, ry: degrees.
  var waitingSlots = [
    spiralProps(1),
    { tx: 39.53, ty: 77.52, tz: -610,  ry: 95 },  // 3: behind card 2
    { tx: 28,    ty: 159,   tz: -1500, ry: 146 }, // 4: below and to the left
    { tx: -6.32, ty: 227,   tz: -1700, ry: 180 }, // 5: below/left, facing back
    { tx: -40.64, ty: 295,  tz: -1900, ry: 214 }  // 6: continues the same outward arc
  ];
  var pastSlots = [
    spiralProps(0),
    { tx: -34.61, ty: -110.22, tz: -529.5,  ry: -46.62 },
    { tx: -51.81, ty: -240.91, tz: -1492.4, ry: -99.42 },
    { tx: -30.21, ty: -260.74, tz: -1630.9, ry: -134.72 },
    { tx: 0,      ty: -320.20, tz: -2142.5, ry: -180 },
    { tx: 30.21,  ty: -379.66, tz: -2654.1, ry: -225.28 }
  ];
  var pathKeys = ['tx', 'ty', 'tz', 'ry'];
  var entryAngle = 55 * Math.PI / 180;
  var entrySlope = {
    tx: 34 * entryAngle * Math.cos(entryAngle),
    ty: 52,
    tz: -650 * entryAngle * Math.sin(entryAngle),
    ry: 55
  };
  // Shape-preserving tangents prevent a stop or reversal between positions.
  function pathTangents(slots, firstSlope) {
    return slots.map(function (slot, index) {
      var tangent = {};
      pathKeys.forEach(function (key) {
        if (index === 0) {
          tangent[key] = firstSlope[key];
        } else if (index === slots.length - 1) {
          tangent[key] = slot[key] - slots[index - 1][key];
        } else {
          var before = slot[key] - slots[index - 1][key];
          var after = slots[index + 1][key] - slot[key];
          tangent[key] = before * after <= 0 ? 0 : 2 * before * after / (before + after);
        }
      });
      return tangent;
    });
  }
  var waitingTangents = pathTangents(waitingSlots, entrySlope);
  var pastTangents = pathTangents(pastSlots, { tx: -34 * entryAngle, ty: -52, tz: 0, ry: -55 });

  function samplePath(p, slots, tangents, position) {
    position = Math.min(position, slots.length - 1);
    var segment = Math.min(slots.length - 2, Math.floor(position));
    var t = position - segment;
    var t2 = t * t, t3 = t2 * t;
    pathKeys.forEach(function (key) {
      p[key] = (2 * t3 - 3 * t2 + 1) * slots[segment][key]
        + (t3 - 2 * t2 + t) * tangents[segment][key]
        + (-2 * t3 + 3 * t2) * slots[segment + 1][key]
        + (t3 - t2) * tangents[segment + 1][key];
    });
    p.sc = 1; // Perspective depth supplies the gradual size reduction.
    return p;
  }

  // Phones: a ring. The five cards stand on a circle seen slightly from above;
  // the front card faces you, the others turn away round the ring and the far
  // ones show their backs. It loops: past card 5 comes card 1 again. Radius and
  // tilt come from the phone CSS (measurePath). tx/tz are in card widths; ry is
  // the card's angle on the ring.
  var ringRadius = 1.03, ringTilt = 9;
  function ringProps(offset) {
    var deg = offset * 360 / cards.length;
    var a = deg * Math.PI / 180;
    return {
      tx: Math.sin(a) * ringRadius,
      ty: 0,
      tz: (Math.cos(a) - 1) * ringRadius,
      ry: deg,
      sc: 1,
      op: Math.max(0.25, 1 - Math.abs(deg) / 150)
    };
  }
  // A card's place relative to the front one: on phones the shortest way round
  // the ring (-2.5…2.5), elsewhere the plain difference.
  function cardOffset(index, progress) {
    if (!isPhone) return index - progress;
    var n = cards.length;
    var o = ((index - progress) % n + n) % n;
    return o > n / 2 ? o - n : o;
  }
  function cardAt(progress) {
    var n = cards.length;
    return ((Math.round(progress) % n) + n) % n;
  }

  function slotProps(offset) {
    if (isPhone) return ringProps(offset);
    var p = spiralProps(offset);
    if (offset < 0) return samplePath(p, pastSlots, pastTangents, -offset);
    if (offset <= 1) return p;
    return samplePath(p, waitingSlots, waitingTangents, offset - 1);
  }

  // Our cards are smaller than the study's (35rem) and the path's spread is set
  // separately: ty is a % of the STUDY card's height (not ours), and both tx and
  // ty are multiplied by --sov-orbit-spacing (1 = the study's spacing). The
  // curve's shape, depth (tz) and turns (ry) stay the study's.
  var pathCardHeight = 394;
  var spacing = 1;
  var cardWidth = 560;
  function measurePath() {
    var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    pathCardHeight = 35 * rem / 1.42;
    spacing = parseFloat(getComputedStyle(section).getPropertyValue('--sov-orbit-spacing')) || 1;
    cardWidth = cards[0].offsetWidth || cardWidth;
    var css = getComputedStyle(section);
    ringRadius = parseFloat(css.getPropertyValue('--sov-orbit-ring-radius')) || 1.03;
    ringTilt = parseFloat(css.getPropertyValue('--sov-orbit-ring-tilt')) || 9;
  }

  function buildTransform(p) {
    if (isPhone) {
      // Step back to the ring's centre, tilt the ring towards the viewer, turn
      // to the card's angle and step out to the rim.
      var r = (ringRadius * cardWidth).toFixed(2);
      return 'translateZ(' + -r + 'px) rotateX(' + -ringTilt + 'deg) ' +
        'rotateY(' + p.ry.toFixed(3) + 'deg) translateZ(' + r + 'px)';
    }
    return 'translateX(' + (p.tx * spacing).toFixed(3) + 'vw) ' +
      'translateY(' + (p.ty * pathCardHeight * spacing / 100).toFixed(2) + 'px) ' +
      'translateZ(' + p.tz.toFixed(2) + 'px) ' +
      'rotateY(' + p.ry.toFixed(3) + 'deg) ' +
      'scale(' + p.sc.toFixed(4) + ')';
  }
  /* ─── end of study code ──────────────────────────────────────── */

  var MAX_PROGRESS = cards.length - 1;
  var on = false;
  var isPhone = false;
  var finalPan = 0;
  var targetProgress = 0;
  var lerpedProgress = 0;
  var scrollLocked = true;   // true = wheel turns the orbit
  var inView = false;        // ≥ 50% visible: wheel may turn the orbit
  var visible = false;       // ≥ 15% visible: videos may play
  var announcedCard = -1;
  var booted = false;
  var entryActive = false;
  var entryTimers = [];

  /* ─── Video: a card starts when it first reaches the front ─── */
  var videos = cards.map(function (card) { return card.querySelector('video'); });
  var started = videos.map(function () { return false; });
  var playedOnce = videos.map(function () { return false; }); // desktop: has reached the front
  function loadMp4(video, preload) {
    var source = video && video.querySelector('source[data-src]');
    if (!source) return;
    source.src = source.getAttribute('data-src');
    source.removeAttribute('data-src');
    video.preload = preload;
    video.load();
  }
  // A card whose <video> has data-hls streams from Bunny instead (adaptive, up
  // to 4K): native HLS on Safari, hls.js elsewhere, capped to the card's size
  // so a 448px card never pulls the 4K rendition. Its MP4 <source> is only the
  // fallback. HLS cards start when they reach the front (no metadata warm-up).
  function loadVideo(video, preload) {
    if (!video) return;
    var hlsUrl = video.getAttribute('data-hls');
    if (!hlsUrl) { loadMp4(video, preload); return; }
    if (preload !== 'auto' || video.dataset.hlsState) return;
    video.dataset.hlsState = 'loading';
    // hls.js may replace the <video>'s <source> children with its own (Managed
    // MediaSource), so keep the MP4 fallback URL aside and drop that <source>.
    var mp4Source = video.querySelector('source[data-src]');
    var mp4Url = mp4Source && mp4Source.getAttribute('data-src');
    if (mp4Source) mp4Source.remove();
    function useMp4(reason) {
      video.dataset.hlsState = 'fallback: ' + reason;
      video.removeAttribute('src');
      if (mp4Url) { video.src = mp4Url; video.preload = 'auto'; video.load(); }
      syncVideos();
    }
    function playNative() {
      // No MediaSource (older iPhones): the browser's own HLS player.
      if (!video.canPlayType('application/vnd.apple.mpegurl')) throw new Error('no HLS');
      video.src = hlsUrl;
      video.addEventListener('error', function () { useMp4('native error'); }, { once: true });
      syncVideos();
    }
    // Prefer hls.js wherever it runs: unlike native HLS it can cap the rendition
    // to the card's size and start from a sensible quality.
    ensureHlsLibrary().then(function (HlsCtor) {
      if (!HlsCtor || !HlsCtor.isSupported()) { playNative(); return; }
      var hls = new HlsCtor({
        capLevelToPlayerSize: true,          // a 448px card never pulls 1440p/4K
        abrEwmaDefaultEstimate: 5000000      // open near 720p, not 240p, then adapt
      });
      var recovered = false;
      var manifestLoaded = false;
      hls.on(HlsCtor.Events.MANIFEST_PARSED, function () { manifestLoaded = true; });
      hls.on(HlsCtor.Events.ERROR, function (event, data) {
        if (!data || !data.fatal) return;
        video.dataset.hlsLastError = data.type + ' / ' + data.details;
        // Once the stream is playing, one recovery attempt for a network blip or
        // decode hiccup. If the playlist itself never loaded, there is nothing to
        // resume (startLoad would sit idle), so go straight to the MP4.
        if (manifestLoaded && !recovered && data.type === HlsCtor.ErrorTypes.NETWORK_ERROR) { recovered = true; hls.startLoad(); return; }
        if (manifestLoaded && !recovered && data.type === HlsCtor.ErrorTypes.MEDIA_ERROR) { recovered = true; hls.recoverMediaError(); return; }
        hls.destroy(); // stream still failing: fall back to the bundled MP4
        useMp4(data.type + ' / ' + data.details);
      });
      video.dataset.hlsState = 'hls.js';
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      syncVideos();
    }).catch(function (err) {
      // Library couldn't load (or no HLS at all): native HLS, else the MP4.
      try { playNative(); video.dataset.hlsState = 'native'; } catch (e) {
        useMp4((err && err.message) || 'hls.js unavailable');
      }
    });
  }
  function syncVideos() {
    if (on && visible && announcedCard >= 0 && !started[announcedCard]) {
      started[announcedCard] = true;
      loadVideo(videos[announcedCard], 'auto');
      // The next card's film starts loading; on the phone ring, card 1 follows card 5.
      loadVideo(videos[isPhone ? (announcedCard + 1) % videos.length : announcedCard + 1], 'metadata');
    }
    videos.forEach(function (video, i) {
      if (!video) return;
      // A card faded fully out of view (phone: 2.5+ cards away) pauses to save
      // battery, and resumes when it comes back.
      var cardShown = announcedCard < 0 || slotProps(cardOffset(i, announcedCard)).op > 0.01;
      // A film starts only once its card has landed in front (not mid-turn:
      // starting decode while the card moves in 3D dropped frames).
      // Desktop: every card waits paused until it first reaches the front, then
      // keeps looping from there on, even after it moves past (playedOnce).
      // Phones: only the front card plays; the others hold their frame.
      var front = i === announcedCard && !turning;
      if (front && !isPhone) playedOnce[i] = true;
      var shouldPlay = on && visible && started[i] && cardShown &&
        (front || (!isPhone && playedOnce[i]));
      if (shouldPlay && video.paused) {
        var attempt = video.play();
        if (attempt && attempt.catch) attempt.catch(function () {}); // autoplay refused: poster stays
      } else if (!shouldPlay && !video.paused) {
        video.pause();
      }
    });
  }

  /* ─── Render ─────────────────────────────────────────────────── */
  var lastStyles = new WeakMap();
  function setStyle(el, prop, value) {
    var cache = lastStyles.get(el);
    if (!cache) { cache = {}; lastStyles.set(el, cache); }
    if (cache[prop] === value) return;
    cache[prop] = value;
    el.style[prop] = value;
  }
  function forgetStyles(el) { lastStyles.delete(el); }

  function applyFrame() {
    if (!on) return;
    // Hold the opening framing on card 1, then pan down to open space above the
    // featured card as the earlier cards recede.
    var panProgress = Math.max(0, Math.min(1, (lerpedProgress - 1) / Math.max(1, MAX_PROGRESS - 1)));
    var pan = panProgress * panProgress * (3 - 2 * panProgress);
    // Write a style only when its value changes: re-setting z-index on every
    // card every frame forces Chrome to rebuild the 3D stacking each frame.
    setStyle(field, 'transform', isPhone ? '' : 'translateY(' + (finalPan * pan).toFixed(2) + 'px)');
    var props = cards.map(function (card, i) { return slotProps(cardOffset(i, lerpedProgress)); });
    // Stacking: rank cards by depth (nearest on top). The rank only changes when
    // two cards actually swap depth, so z-index is rewritten a handful of times
    // per turn instead of every frame.
    var order = props.map(function (p, i) { return i; })
      .sort(function (a, b) { return props[a].tz - props[b].tz; });
    order.forEach(function (cardIndex, rank) { setStyle(cards[cardIndex], 'zIndex', String(rank + 1)); });
    cards.forEach(function (card, i) {
      var offset = cardOffset(i, lerpedProgress);
      var p = props[i];
      setStyle(card, 'transform', buildTransform(p));
      if (!entryActive) setStyle(card, 'opacity', p.op.toFixed(3));
      // Phone cards overlap, so only the card in focus shows its words; they
      // fade out within the first ~half card of travel and back in on arrival.
      var words = 1;
      if (isPhone) {
        words = Math.max(0, 1 - Math.abs(offset) / 0.45);
        words = words * words * (3 - 2 * words);
      }
      setStyle(copies[i], 'opacity', words === 1 ? '' : words.toFixed(2));
    });
    var currentCard = isPhone ? cardAt(lerpedProgress) : Math.round(lerpedProgress);
    if (currentCard !== announcedCard) {
      announcedCard = currentCard;
      section.setAttribute('data-sov-position', String(currentCard));
      if (countLabel) countLabel.textContent = String(currentCard + 1).padStart(2, '0') + ' / ' + String(cards.length).padStart(2, '0');
      if (gestureLabel) gestureLabel.textContent = !isPhone && currentCard === MAX_PROGRESS ? 'Scroll on to continue' : 'Swipe to explore';
      cards.forEach(function (card, index) { card.setAttribute('aria-hidden', String(index !== currentCard)); });
      syncVideos();
    }
    // The phone ring loops, so its buttons never run out.
    if (previousButton) previousButton.disabled = !isPhone && targetProgress <= 0;
    if (nextButton) nextButton.disabled = !isPhone && targetProgress >= MAX_PROGRESS;
  }

  var turning = false;
  var motion = createSpiralSpring(function (position) {
    lerpedProgress = position;
    applyFrame();
    var nowTurning = Math.abs(targetProgress - position) > 0.002;
    if (nowTurning !== turning) {
      turning = nowTurning;
      if (!turning) landedAt = performance.now();
      syncVideos();
    }
  });
  // Glide to targetProgress; a velocity (cards/s) hands off a finger's speed.
  function requestTick(handoffVelocity) {
    if (entryActive) return;
    if (reducedMotion.matches) {
      // No glide: jump, softened on phones by a brief dip of the field.
      if (isPhone && Math.abs(lerpedProgress - targetProgress) > 0.01) {
        field.classList.remove('sov-orbit-jump');
        void field.offsetWidth; // restart the animation
        field.classList.add('sov-orbit-jump');
      }
      motion.jumpTo(targetProgress);
    }
    else motion.moveTo(targetProgress, handoffVelocity);
  }
  /* ─── Wheel / trackpad: one gesture turns one card ───────────────
     Paging like iOS: a gesture commits to a turn once it has travelled a
     little, then the rest of it — including the trackpad's momentum tail,
     which keeps firing for ~1 s after the fingers lift — is absorbed. Adding
     those deltas up (the study page's model) overshot the next card and
     snapped back, which read as a stutter. A gesture ends after a short pause,
     a change of direction, or a fresh push once the turn has landed (momentum
     only ever decays, so a rising delta is a new swipe). */
  var WHEEL_GAP_MS = 200;   // a pause this long ends a gesture
  var WHEEL_COMMIT_PX = 12; // travel before a gesture commits to a turn
  var gesture = null;       // { dir, sum, stepped, last, lastAbs }

  function trackGesture(dy, now) {
    var abs = Math.abs(dy);
    var dir = dy > 0 ? 1 : -1;
    var settled = Math.abs(targetProgress - lerpedProgress) < 0.02;
    // Momentum only decays, so a delta that jumps well above the previous one
    // (once the last turn has landed) is a new swipe, not the tail.
    var fresh = !gesture || now - gesture.last > WHEEL_GAP_MS || dir !== gesture.dir ||
      (gesture.stepped && settled && abs >= 10 && abs > gesture.lastAbs * 1.6);
    if (fresh) gesture = { dir: dir, sum: 0, stepped: false, last: now, lastAbs: abs };
    gesture.last = now;
    gesture.lastAbs = abs;
    return gesture;
  }

  function turn(direction) {
    var next = Math.max(0, Math.min(MAX_PROGRESS, Math.round(targetProgress) + direction));
    if (next === targetProgress) return;
    targetProgress = next;
    requestTick();
  }

  window.addEventListener('wheel', function (e) {
    // Phones: scrolling never turns the ring (only a sideways swipe does).
    if (!on || isPhone || !inView || e.ctrlKey || Math.abs(section.getBoundingClientRect().top) > window.innerHeight * 0.49) return;
    var dy = e.deltaY * (e.deltaMode === 1 ? 20 : e.deltaMode === 2 ? window.innerHeight : 1);
    if (!dy) return;

    if (!scrollLocked) {
      // Re-lock when the wheel turns back into the orbit's range.
      if (targetProgress >= MAX_PROGRESS && dy < 0) scrollLocked = true;
      else if (targetProgress <= 0 && dy > 0) scrollLocked = true;
      else return; // still unlocked: let the page scroll
      gesture = null;
    }

    var g = trackGesture(dy, e.timeStamp || performance.now());
    if (g.stepped) { e.preventDefault(); return; } // rest of a gesture that already turned

    // A new gesture pushing outward at a settled end hands the page back.
    var settled = Math.abs(targetProgress - lerpedProgress) < 0.02;
    if (g.sum === 0 && settled &&
        ((targetProgress >= MAX_PROGRESS && dy > 0) || (targetProgress <= 0 && dy < 0))) {
      scrollLocked = false;
      gesture = null;
      return;
    }

    e.preventDefault();
    if (!sectionAligned()) {
      alignSection();
      g.stepped = true; // the gesture that brings the section into place doesn't also turn it
      return;
    }
    finishEntry();
    g.sum += dy;
    if (Math.abs(g.sum) >= WHEEL_COMMIT_PX) {
      g.stepped = true;
      turn(g.dir);
    }
  }, { passive: false });

  /* ─── Phone buttons ──────────────────────────────────────────── */
  function stepCard(direction) {
    var next = Math.round(targetProgress) + direction;
    targetProgress = isPhone ? next : Math.max(0, Math.min(MAX_PROGRESS, next));
    holdAutoTurn();
    scrollLocked = true;
    finishEntry();
    applyFrame();
    requestTick();
  }
  if (previousButton) previousButton.addEventListener('click', function () { stepCard(-1); });
  if (nextButton) nextButton.addEventListener('click', function () { stepCard(1); });

  /* ─── Phone touch: from the study page, verbatim ─────────────── */
  function installSpiralTouch(options) {
    var element = options.element;
    var win = options.window || element.ownerDocument.defaultView;
    // wrap: the cards loop, so there are no ends to stop at.
    var maximum = options.wrap ? Infinity : options.max;
    var lowest = options.wrap ? -Infinity : 0;
    var gesture = null;
    var threshold = 6;
    // 'y': an upward finger advances (the study page). 'x': a leftward finger
    // advances, and only a mostly-sideways gesture is taken; anything else
    // stays native so the page scrolls.
    var horizontal = options.axis === 'x';
    // Sideways: decide later and only take a clearly sideways swipe, so a
    // thumb's diagonal scroll always stays with the page.
    if (horizontal) threshold = 10;
    var dominance = horizontal ? 1.5 : 1;
    function along(touch) { return horizontal ? touch.clientX : touch.clientY; }
    var interactive = 'a,button,input,select,textarea,summary,video,audio,' +
      '[contenteditable]:not([contenteditable="false"]),[role="button"],' +
      '[role="link"],[tabindex]';

    function clamp(value, minimum, maximumValue) {
      return Math.max(minimum, Math.min(maximumValue, value));
    }
    function eligible() {
      return (!options.enabled || options.enabled()) &&
        (!options.isVisible || options.isVisible());
    }
    function findTouch(touches, identifier) {
      for (var i = 0; i < touches.length; i++) {
        if (touches[i].identifier === identifier) return touches[i];
      }
      return null;
    }
    function cancel() {
      if (gesture && gesture.captured) {
        options.onSettle(clamp(Math.round(gesture.progress), lowest, maximum));
      }
      gesture = null;
    }
    function start(event) {
      if (event.touches.length !== 1) {
        cancel();
        return;
      }
      if (!eligible()) return;
      var target = event.target;
      if (target && target.nodeType !== 1) target = target.parentElement;
      // Only controls INSIDE the orbit count (changed from the study page): the
      // home page's <main tabindex="-1"> would otherwise match every touch.
      var control = target && target.closest && target.closest(interactive);
      if (control && element.contains(control)) return;
      var touch = event.touches[0];
      gesture = {
        identifier: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        lastP: along(touch),
        lastTime: event.timeStamp,
        velocity: 0,
        captured: false
      };
    }
    function move(event) {
      if (!gesture) return;
      if (event.touches.length !== 1) {
        cancel();
        return;
      }
      if (!eligible()) {
        cancel();
        return;
      }
      var touch = findTouch(event.touches, gesture.identifier);
      if (!touch) {
        cancel();
        return;
      }
      var cross = horizontal ? touch.clientY - gesture.y : touch.clientX - gesture.x;
      var travel = horizontal ? gesture.x - touch.clientX : gesture.y - touch.clientY;
      var elapsed = event.timeStamp - gesture.lastTime;
      if (elapsed > 0) {
        var sampleVelocity = (gesture.lastP - along(touch)) / elapsed;
        gesture.velocity = elapsed > 120 ? sampleVelocity
          : 0.6 * sampleVelocity + 0.4 * gesture.velocity;
      }
      gesture.lastP = along(touch);
      gesture.lastTime = event.timeStamp;

      if (!gesture.captured) {
        if (Math.max(Math.abs(cross), Math.abs(travel)) < threshold) return;
        if (Math.abs(travel) <= dominance * Math.abs(cross)) {
          gesture = null; // Let a gesture across the axis remain native.
          return;
        }
        var progress = clamp(options.getProgress(), lowest, maximum);
        if (!options.wrap && ((progress <= 0.001 && travel < 0) ||
            (progress >= maximum - 0.001 && travel > 0))) {
          gesture = null; // Outward motion at an endpoint scrolls the page.
          return;
        }
        if (!event.cancelable) {
          gesture = null;
          return;
        }
        gesture.captured = true;
        gesture.originProgress = progress;
        gesture.originIndex = Math.round(progress);
        gesture.minimum = Math.max(lowest, gesture.originIndex - 1);
        gesture.maximum = Math.min(maximum, gesture.originIndex + 1);
        gesture.distance = options.getStepDistance
          ? Math.max(1, options.getStepDistance())
          : horizontal ? clamp(element.clientWidth * 0.35, 110, 220)
          : clamp(element.clientHeight * 0.4, 180, 360);
        gesture.progress = progress;
        if (options.onCapture) options.onCapture();
      }
      if (!event.cancelable) {
        cancel();
        return;
      }
      event.preventDefault();
      gesture.progress = clamp(gesture.originProgress + travel / gesture.distance,
        gesture.minimum, gesture.maximum);
      options.onDrag(gesture.progress);
    }
    function end(event) {
      if (!gesture) return;
      if (findTouch(event.touches, gesture.identifier)) return;
      if (!gesture.captured) {
        gesture = null;
        return;
      }
      var touch = findTouch(event.changedTouches, gesture.identifier);
      var travel = horizontal
        ? gesture.x - (touch ? touch.clientX : gesture.lastP)
        : gesture.y - (touch ? touch.clientY : gesture.lastP);
      var velocity = event.timeStamp - gesture.lastTime <= 100 ? gesture.velocity : 0;
      var enoughTravel = Math.abs(travel) >= gesture.distance * 0.22;
      var flick = Math.abs(travel) >= 12 && Math.abs(velocity) >= 0.45 &&
        travel * velocity > 0;
      var next = gesture.originIndex;
      if (enoughTravel || flick) next += travel > 0 ? 1 : -1;
      // Hand the finger's speed to the settle animation (px/ms → cards/s).
      var handoff = velocity / gesture.distance * 1000;
      gesture = null;
      options.onSettle(clamp(next, lowest, maximum), handoff);
    }
    function interrupted() {
      cancel();
    }

    element.addEventListener('touchstart', start, { passive: true });
    element.addEventListener('touchmove', move, { passive: false });
    element.addEventListener('touchend', end, { passive: true });
    element.addEventListener('touchcancel', interrupted, { passive: true });
    win.addEventListener('resize', cancel);
  }

  installSpiralTouch({
    element: section,
    axis: 'x', // phones turn the ring sideways; vertical swipes scroll the page
    wrap: true, // the ring loops: past card 5 comes card 1
    enabled: function () { return on && isPhone; },
    // A sideways swipe never fights the page scroll, so the section only needs
    // to be mostly on screen (not lined up with the top, as the vertical swipe needed).
    isVisible: function () { return inView; },
    max: MAX_PROGRESS,
    getProgress: function () { return lerpedProgress; },
    onCapture: function () { finishEntry(); holdAutoTurn(); scrollLocked = true; },
    onDrag: function (progress) {
      targetProgress = progress;
      motion.jumpTo(progress); // the cards follow the finger exactly
    },
    onSettle: function (progress, handoffVelocity) {
      holdAutoTurn();
      targetProgress = progress;
      applyFrame();
      requestTick(handoffVelocity);
    }
  });

  /* ─── Entry: cards fade in one by one the first time the section shows ─── */
  // Phones: while they fade in, the ring also turns into place from about half
  // a card back, easing out, so the section arrives already moving.
  var ENTRY_TURN_FROM = -0.45; // rounds to card 1, so the counter and film don't change
  var entryTurn = null;
  function turnIn(duration) {
    var startTime = 0;
    turning = true;
    motion.jumpTo(ENTRY_TURN_FROM);
    function step(now) {
      if (!startTime) startTime = now;
      var t = Math.min(1, (now - startTime) / duration);
      var eased = 1 - Math.pow(1 - t, 3);
      lerpedProgress = targetProgress + ENTRY_TURN_FROM * (1 - eased);
      applyFrame();
      if (t < 1) { entryTurn = requestAnimationFrame(step); return; }
      stopTurnIn();
    }
    entryTurn = requestAnimationFrame(step);
  }
  function stopTurnIn() {
    if (entryTurn === null) return;
    cancelAnimationFrame(entryTurn);
    entryTurn = null;
    motion.jumpTo(lerpedProgress); // the spring carries on from where the ring is
    turning = false;
    landedAt = performance.now();
    if (!entryActive) requestTick();
    syncVideos();
  }
  function finishEntry() {
    stopTurnIn();
    if (!entryActive) return;
    entryActive = false;
    entryTimers.forEach(function (timer) { clearTimeout(timer); });
    entryTimers = [];
    cards.forEach(function (card) { card.style.transition = ''; forgetStyles(card); });
    applyFrame();
    requestTick();
  }
  function boot() {
    if (booted || !on) return;
    booted = true;
    if (reducedMotion.matches) return;
    entryActive = true;
    var fadeEnd = 220 + MAX_PROGRESS * 110 + 700;
    if (isPhone) turnIn(fadeEnd + 200);
    cards.forEach(function (card) { card.style.opacity = '0'; });
    cards.forEach(function (card, i) {
      entryTimers.push(setTimeout(function () {
        card.style.transition = 'opacity 700ms ease';
        card.style.opacity = slotProps(cardOffset(i, targetProgress)).op.toFixed(3);
      }, 220 + i * 110));
    });
    entryTimers.push(setTimeout(finishEntry, fadeEnd + 80));
  }

  /* ─── Phones: the ring turns itself, card by card ───────────────
     Each card stays in front for AUTO_HOLD_MS while its film plays, then the
     ring glides on to the next and loops. A swipe or tap holds it for
     AUTO_IDLE_MS. Never with reduced motion, while the page is hidden, or
     while keyboard focus is inside the section. */
  var AUTO_HOLD_MS = 6000;
  var AUTO_IDLE_MS = 8000;
  var autoTimer = null, landedAt = 0, touchedAt = -Infinity;
  function holdAutoTurn() { touchedAt = performance.now(); }
  function autoAllowed() {
    return on && isPhone && inView && !entryActive && entryTurn === null && !turning &&
      !reducedMotion.matches && !document.hidden && !section.querySelector(':focus-visible');
  }
  function autoTick() {
    autoTimer = null;
    if (!on || !isPhone || !inView) return;
    var now = performance.now();
    if (autoAllowed() && now - landedAt >= AUTO_HOLD_MS && now - touchedAt >= AUTO_IDLE_MS) {
      targetProgress = Math.round(targetProgress) + 1;
      applyFrame();
      requestTick();
    }
    autoTimer = setTimeout(autoTick, 250);
  }
  function startAutoTurn() {
    if (autoTimer === null && on && isPhone && inView) {
      landedAt = performance.now(); // a fresh arrival gets a full hold first
      autoTimer = setTimeout(autoTick, 250);
    }
  }
  function stopAutoTurn() {
    if (autoTimer !== null) clearTimeout(autoTimer);
    autoTimer = null;
  }

  /* ─── On / off, desktop / phone ──────────────────────────────── */
  function updateLayout() {
    if (!on) return;
    measurePath();
    finalPan = field.offsetHeight * 0.1 + pathCardHeight * spacing * 0.25;
    applyFrame();
  }
  function setMode(next, nextPhone) {
    if (next === on && nextPhone === isPhone) return;
    var wasOn = on;
    on = next;
    isPhone = next && nextPhone;
    section.classList.toggle('sov-orbit-on', on);
    section.classList.toggle('sov-orbit-phone', isPhone);
    if (on && wasOn) { // desktop ↔ phone: same orbit, new framing
      stopAutoTurn();
      if (!isPhone) { targetProgress = cardAt(targetProgress); motion.jumpTo(targetProgress); }
      else startAutoTurn();
      announcedCard = -1;
      updateLayout();
      return;
    }
    if (on) {
      announcedCard = -1;
      updateLayout();
      var rect = section.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) boot();
      return;
    }
    finishEntry();
    stopAutoTurn();
    targetProgress = cardAt(targetProgress);
    motion.jumpTo(targetProgress);
    field.style.removeProperty('transform');
    forgetStyles(field);
    cards.forEach(function (card, i) {
      ['transform', 'opacity', 'z-index', 'transition'].forEach(function (prop) { card.style.removeProperty(prop); });
      card.removeAttribute('aria-hidden');
      copies[i].style.removeProperty('opacity');
      forgetStyles(card);
      forgetStyles(copies[i]);
    });
    section.removeAttribute('data-sov-position');
    syncVideos();
  }

  new IntersectionObserver(function (entries) {
    inView = entries[0].intersectionRatio >= 0.5;
    if (entries[0].isIntersecting) boot();
    if (inView) startAutoTurn(); else stopAutoTurn();
  }, { threshold: [0, 0.3, 0.5] }).observe(section);
  // Looser threshold for playback: keep the front card playing while any
  // meaningful part of the orbit is on screen.
  new IntersectionObserver(function (entries) {
    visible = entries[0].intersectionRatio >= 0.15;
    syncVideos();
    syncBackToTop();
  }, { threshold: [0, 0.15] }).observe(section);

  // On phones the floating back-to-top button would sit on the Next button;
  // hide it while the orbit is on screen (as it hides over the inquiry form).
  var backToTop = document.getElementById('backToTop');
  function syncBackToTop() {
    if (backToTop) backToTop.classList.toggle('over-orbit', on && isPhone && visible);
  }

  function syncMode() {
    setMode(!compact.matches || phone.matches, phone.matches);
    syncBackToTop();
  }
  compact.addEventListener('change', syncMode);
  phone.addEventListener('change', syncMode);
  window.addEventListener('resize', updateLayout);
  reducedMotion.addEventListener('change', function () { finishEntry(); requestTick(); });
  syncMode();
})();

// ═══════ A11Y: FILTER PILLS ANNOUNCE THEIR STATE ═══════
// a11y audit #09: several code paths toggle `.active` on filter buttons;
// mirror it into aria-pressed so screen readers hear which filter is on.
(function() {
  const buttons = document.querySelectorAll('.portfolio-filters button, .vw-filters button, .filter-bar .filter-btn');
  if (!buttons.length) return;
  const sync = (b) => b.setAttribute('aria-pressed', b.classList.contains('active') ? 'true' : 'false');
  const observer = new MutationObserver(records => records.forEach(r => sync(r.target)));
  buttons.forEach(b => {
    sync(b);
    observer.observe(b, { attributes: true, attributeFilter: ['class'] });
  });
})();

// ═══════ A11Y: BACK-TO-TOP STAYS OFF THE INQUIRY FORM ═══════
// a11y audit #20: at phone widths the floating button covered the corner of
// the form card next to "Send Message"; hide it while the form is on screen.
(function() {
  const btn = document.getElementById('backToTop');
  const form = document.getElementById('contactForm');
  if (!btn || !form || typeof IntersectionObserver === 'undefined') return;
  new IntersectionObserver((entries) => {
    entries.forEach(entry => btn.classList.toggle('over-form', entry.isIntersecting));
  }).observe(form);
})();
