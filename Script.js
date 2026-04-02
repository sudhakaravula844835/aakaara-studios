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
  return loadScriptOnce('https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js', 'Hls');
}

function ensureFlatpickrLibrary() {
  return loadScriptOnce('https://cdn.jsdelivr.net/npm/flatpickr', 'flatpickr');
}
// ═══════ CINEMATIC INTRO ANIMATION ═══════
(function() {
  const intro = document.getElementById('intro');
  if (!intro) return;
  const heroContent = document.getElementById('heroContent');
  const heroScroll = document.getElementById('heroScroll');
  const navbar = document.getElementById('navbar');
  const shouldSkipIntro =
    window.matchMedia('(max-width: 768px)').matches ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    Boolean(navigator.connection && navigator.connection.saveData);

  function revealHeroImmediately() {
    intro.classList.add('hidden');
    document.body.classList.remove('intro-active');
    if (heroContent) heroContent.style.opacity = '1';
    if (heroScroll) heroScroll.style.opacity = '1';
    if (navbar) navbar.classList.add('visible');
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

  // Mobile users should land directly on the hero so the primary message paints
  // immediately instead of waiting through the cinematic intro timeline.
  if (shouldSkipIntro) {
    revealHeroImmediately();
    return;
  }

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
  t(1200, () => { centerDot.style.transition = 'r 0.6s cubic-bezier(0.16,1,0.3,1), opacity 0.6s'; centerDot.setAttribute('r', '5'); centerDot.style.opacity = '0.85'; });
  letters.forEach((l, i) => { t(1800 + i * 90, () => { l.style.transition = 'opacity 0.9s cubic-bezier(0.16,1,0.3,1), transform 0.9s cubic-bezier(0.16,1,0.3,1), filter 0.9s cubic-bezier(0.25,0.46,0.45,0.94)'; l.style.opacity = '1'; l.style.transform = 'translateY(0) scale(1)'; l.style.filter = 'blur(0px)'; }); });
  
  // MOB-03 FIX: Reveal hero content earlier (at 2.6s instead of 4.2s) to satisfy LCP
  t(2600, () => { const hc = document.getElementById('heroContent'); if(hc) hc.style.opacity = '0.4'; });

  t(2600, () => { dots.style.transition = 'opacity 0.5s'; dots.style.opacity = '1'; });
  t(2900, () => { sub.style.transition = 'opacity 0.8s'; sub.style.opacity = '1'; });
  t(3200, () => { tag.style.transition = 'opacity 0.8s'; tag.style.opacity = '1'; });
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
    sub.style.transition = 'opacity 0.3s'; sub.style.opacity = '0';
    tag.style.transition = 'opacity 0.3s'; tag.style.opacity = '0';
    t(350, () => {
      mark.style.transition = 'margin 0.9s cubic-bezier(0.16,1,0.3,1)'; mark.style.marginBottom = '0.3rem';
      introGroup.style.transition = 'transform 1.1s cubic-bezier(0.16,1,0.3,1)';
      introGroup.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
      intro.classList.add('fade-out'); document.body.classList.remove('intro-active');
      const hc = document.getElementById('heroContent'); hc.style.transition = 'opacity 1.2s cubic-bezier(0.16,1,0.3,1)'; hc.style.opacity = '1';
      const hs = document.getElementById('heroScroll'); t(500, () => { hs.style.transition = 'opacity 1s'; hs.style.opacity = '1'; });
    });
    t(1500, () => { introGroup.style.transition = 'opacity 0.35s'; introGroup.style.opacity = '0'; navbar.classList.add('visible'); });
    t(2300, () => { intro.classList.add('hidden'); });
  });
})();

// ═══════ MOBILE NAVIGATION TOGGLE ═══════
(function() {
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.getElementById('navLinks');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('show');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Good practice: close menu when a link is clicked on mobile
    navLinks.addEventListener('click', (e) => {
      // Check if the clicked element is a link inside the nav
      if (e.target.tagName === 'A' && navLinks.classList.contains('show')) {
        navLinks.classList.remove('show');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }
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
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revealObs.unobserve(e.target); } });
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

// ═══════ AUTO-LOAD COVER IMAGES ═══════
const galleryObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const item = entry.target;
      const folder = item.dataset.folder;
      const ext = item.dataset.ext || 'jpg';
      const coverSrc = item.dataset.cover || (folder ? `${folder}/1.${ext}` : null);
      if (coverSrc) {
        const bg = item.querySelector('.gi-bg');
        if (bg) {
          const img = new Image();
          img.decoding = 'async';
          img.onload = function() {
            bg.style.backgroundImage = `url('${coverSrc}')`;
            if (item.dataset.bgSize) bg.style.backgroundSize = item.dataset.bgSize;
            if (item.dataset.bgPos) bg.style.backgroundPosition = item.dataset.bgPos;
          };
          img.src = coverSrc;
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
  let stripThumbCache = [];
  let dockMouseMoveFn = null, dockMouseLeaveFn = null;

  function openSwGallery(work) {
    lastFocusedElement = document.activeElement;
    const folder = work.dataset.folder || 'images/default';
    const count = parseInt(work.dataset.count || '1', 10);
    const ext = work.dataset.ext || 'jpg';
    const isStatic = work.dataset.static === 'true';
    const isComingSoon = work.dataset.comingSoon === 'true';

    // Build image array
    swImages = Array.from({ length: count }, (_, i) => `${folder}/${i + 1}.${ext}`);
    
    swIndex = 0;
    galleryTitle.textContent = work.dataset.title || '';
    gallerySubtitle.textContent = work.dataset.type || '';
    
    gallery.classList.add('sw-open', 'sw-gallery-enter');
    if (isStatic) gallery.classList.add('sw-static');
    
    // Handle Coming Soon state
    gallery.classList.toggle('sw-is-coming-soon', isComingSoon);
    if (isComingSoon) {
      const cardGradient = work.className.match(/gi-\d+/);
      if (cardGradient) gallery.classList.add(cardGradient[0]);
      const noticeTitle = document.getElementById('swComingSoonTitle');
      if (noticeTitle) noticeTitle.textContent = work.dataset.title || '';
      galleryCounter.textContent = "";
      if (galleryImg) galleryImg.style.backgroundImage = 'none';
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

    // Update thumbnails immediately
    document.querySelectorAll('.sw-strip-thumb').forEach((t, i) => {
      t.classList.toggle('active', i === index);
      if (i === index) t.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });

    const img = new Image();
    
    if (isFirst) {
        img.onload = () => {
            galleryImg.style.backgroundImage = `url('${url}')`;
            galleryImg.style.backgroundSize = "contain";
            galleryImg.classList.add('sw-img-enter');
        };
        img.src = url;
        return;
    }

    // Navigation: Exit current -> Load new -> Enter new
    galleryImg.classList.remove('sw-img-enter');
    galleryImg.classList.add('sw-img-exit');

    let animDone = false;
    let imgLoaded = false;

    const trySwap = () => {
        if (animDone && imgLoaded) {
            if (swImages[swIndex] !== url) return; // Prevent race conditions
            galleryImg.style.backgroundImage = `url('${url}')`;
            galleryImg.style.backgroundSize = "contain";
            galleryImg.classList.remove('sw-img-exit');
            void galleryImg.offsetWidth; // Force reflow
            galleryImg.classList.add('sw-img-enter');
        }
    };

    galleryImg.addEventListener('animationend', () => { animDone = true; trySwap(); }, { once: true });
    img.onload = () => { imgLoaded = true; trySwap(); };
    img.src = url;
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
  }

  function closeSwGallery() {
    if (!swIsOpen) return;
    gallery.classList.add('sw-gallery-exit');
    function cleanup() {
      gallery.classList.remove('sw-open', 'sw-gallery-enter', 'sw-gallery-exit', 'sw-static', 'sw-is-coming-soon');
      // Remove any gi- classes added for coming soon background
      gallery.className = gallery.className.replace(/gi-\d+/g, '').trim();
      
      galleryImg.style.backgroundImage = '';
      if (galleryStrip) {
        galleryStrip.innerHTML = '';
        if (dockMouseMoveFn)  { galleryStrip.removeEventListener('mousemove',  dockMouseMoveFn);  }
        if (dockMouseLeaveFn) { galleryStrip.removeEventListener('mouseleave', dockMouseLeaveFn); }
      }
      stripThumbCache = [];
      swIsOpen = false;
      // Return focus to triggering element
      if (lastFocusedElement) {
        lastFocusedElement.focus();
        lastFocusedElement = null;
      }
    }
    gallery.addEventListener('animationend', cleanup, { once: true });
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
    if (!swIsOpen) return;
    if (e.key === 'Escape')     closeSwGallery();
    if (e.key === 'ArrowRight') swNav(1);
    if (e.key === 'ArrowLeft')  swNav(-1);
  });

  // Touch / Swipe Support — finger-following, prevents browser back gesture
  let swTouchStartX = 0, swTouchStartY = 0, swTouchDX = 0, swIsHorizontal = null;

  gallery.addEventListener('touchstart', (e) => {
    if (!swIsOpen) return;
    swTouchStartX = e.touches[0].clientX;
    swTouchStartY = e.touches[0].clientY;
    swTouchDX = 0;
    swIsHorizontal = null;
    galleryImg.style.transition = 'none';
  }, { passive: true });

  gallery.addEventListener('touchmove', (e) => {
    if (!swIsOpen) return;
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
    if (!swIsOpen) return;
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
  if (galleryStrip && !window.matchMedia('(hover: none)').matches) {
    const RADIUS = 120, MAX_BOOST = 0.9;
    dockMouseMoveFn = (e) => {
      const mx = e.clientX;
      stripThumbCache.forEach(thumb => {
        const rect = thumb.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const dist = Math.abs(mx - cx);
        // Gaussian-style falloff: max scale 1.9, influence radius 120px
        const scale = dist < RADIUS ? 1 + MAX_BOOST * Math.pow(1 - dist / RADIUS, 2) : 1;
        thumb.style.transform = `scale(${scale.toFixed(3)})`;
      });
    };
    dockMouseLeaveFn = () => {
      stripThumbCache.forEach(thumb => { thumb.style.transform = ''; });
    };
    galleryStrip.addEventListener('mousemove', dockMouseMoveFn);
    galleryStrip.addEventListener('mouseleave', dockMouseLeaveFn);
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
        vid.play().catch(function(){});
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
    if (!isVisible) {
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
          setTimeout(function() { el.classList.remove('cs-slide-exit'); }, 700);
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

    // Handle counter visibility and text
    if (counterWrapper) {
      counterWrapper.style.opacity = activeIdx === 0 ? '0' : '1';
      counterWrapper.style.transition = 'opacity 0.4s ease';
    }
    if (counterEl && activeIdx > 0) {
      var newCount = String(activeIdx).padStart(2, '0');
      if (counterEl.textContent !== newCount) counterEl.textContent = newCount;
    }

    dots.forEach(function(d, i) { d.classList.toggle('active', i === activeIdx); });

    var slideIdx = (progress > 0.4 && activeIdx < PANEL_COUNT - 1) ? activeIdx + 1 : activeIdx;
    showSlide(slideIdx);
    
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

// Hover muted preview — preloaded on viewport entry, plays instantly on hover
// Exclusive playback: only one card plays at a time (prevents audio overlap on swipe)
(function() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const cardControllers = new Map();

  document.querySelectorAll('.vw-card').forEach(card => {
    const src = card.dataset.video;
    if (!src) return;
    const poster = card.querySelector('.vw-poster');
    let vid = null;

    // Pre-create the video element when the card enters the viewport
    // so it's ready to play instantly on hover
    const preload = () => {
      if (vid) return;
      vid = document.createElement('video');
      vid.muted = true; vid.loop = true;
      vid.playsInline = true; vid.preload = 'auto';
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

    const pause = (reset = false) => {
      if (vid) {
        vid.pause();
        vid.muted = true;
        if (reset) vid.currentTime = 0;
      }
      poster.classList.remove('active');
    };

    cardControllers.set(card, { play, pause });

    // Preload video as soon as the card scrolls into view
    const preloadObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { preload(); preloadObserver.disconnect(); } });
    }, { threshold: 0.1 });
    preloadObserver.observe(card);

    // Desktop: Hover — pause all other cards first, then play this one
    card.addEventListener('mouseenter', () => {
      if (window.matchMedia('(hover: none)').matches) return;
      cardControllers.forEach((ctrl, c) => { if (c !== card) ctrl.pause(true); });
      play();
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
  const vmClose  = document.getElementById('vmClose');
  const vmBg     = document.getElementById('vmBackdrop');
  const vmStage  = document.getElementById('vmStage');
  const vmPlay   = document.getElementById('vmPlayToggle');
  const vmMute   = document.getElementById('vmMuteToggle');
  const vmFs     = document.getElementById('vmFsToggle');
  const vmTrack  = document.getElementById('vmProgressTrack');
  const vmFill   = document.getElementById('vmProgressFill');
  const vmTime   = document.getElementById('vmTimeDisplay');
  const vmSkipBackBtn = document.getElementById('vmSkipBackBtn');
  const vmSkipFwdBtn  = document.getElementById('vmSkipFwdBtn');
  const vmSkipBackOvl = document.getElementById('vmSkipBack');
  const vmSkipFwdOvl  = document.getElementById('vmSkipFwd');
  if (!modal) return;

  var activeHls = null; // Track active HLS instance for cleanup
  var modalScrollY = 0;
  var modalRequestId = 0;
  var modalLastFocusedEl = null;
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

  async function attachHLS(videoEl, src, requestId) {
    if (activeHls) { activeHls.destroy(); activeHls = null; }
    if (src.includes('.m3u8')) {
      if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        videoEl.src = src;
        videoEl.load();
        videoEl.play().catch(function(){});
        return;
      }

      const HlsCtor = await ensureHlsLibrary();
      if (requestId !== modalRequestId || !HlsCtor || !HlsCtor.isSupported()) return;

      activeHls = new HlsCtor();
      activeHls.loadSource(src);
      activeHls.attachMedia(videoEl);
      activeHls.on(HlsCtor.Events.MANIFEST_PARSED, function() { videoEl.play().catch(function(){}); });
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

  async function openModal(card) {
    const src = card.dataset.video;
    const requestId = ++modalRequestId;
    modalLastFocusedEl = document.activeElement instanceof HTMLElement ? document.activeElement : card;
    vmTitle.textContent = card.dataset.title || '';
    vmSub.textContent   = card.dataset.type  || '';
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

    if (src) {
      await attachHLS(vmVideo, src, requestId);
      if (requestId !== modalRequestId) return;
      vmStage.classList.add('vm-has-video');
      // Reset controls
      syncPlayToggle();
      if (vmFill) vmFill.style.width = '0%';
    } else {
      vmStage.classList.remove('vm-has-video');
      syncPlayToggle();
    }
  }

  function closeModal() {
    modalRequestId += 1;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    modal.classList.remove('vm-open');
    vmVideo.pause();
    if (activeHls) { activeHls.destroy(); activeHls = null; }
    vmVideo.src = '';
    vmStage.classList.remove('vm-has-video');
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    restoreModalScroll(modalScrollY);
    syncPlayToggle();
    syncMuteToggle();
    if (modalLastFocusedEl && document.contains(modalLastFocusedEl)) {
      requestAnimationFrame(() => modalLastFocusedEl.focus({ preventScroll: true }));
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

  if (vmVideo) {
    if (vmTrack) {
      vmTrack.setAttribute('role', 'slider');
      vmTrack.setAttribute('aria-label', 'Video progress');
      vmTrack.setAttribute('aria-valuemin', '0');
      vmTrack.setAttribute('aria-valuemax', '100');
    }
    vmVideo.addEventListener('timeupdate', () => {
      const pct = (vmVideo.currentTime / vmVideo.duration) * 100;
      if (vmFill) vmFill.style.width = `${pct}%`;
      if (vmTime) vmTime.textContent = formatTime(vmVideo.currentTime);
      if (vmTrack) vmTrack.setAttribute('aria-valuenow', Math.round(pct));
    });
    vmVideo.addEventListener('play', syncPlayToggle);
    vmVideo.addEventListener('pause', syncPlayToggle);
  }

  if (vmTrack) {
    vmTrack.addEventListener('click', (e) => {
      const rect = vmTrack.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      vmVideo.currentTime = pos * vmVideo.duration;
    });
  }

  // 5-second skip with on-screen overlay animation
  function triggerSkip(seconds) {
    if (!vmVideo || !vmVideo.duration) return;
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
      
      if (!item.hasAttribute('aria-label')) {
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

  render() {
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
    
    // Adjust offset based on active card width (Wide cards need different spacing factor)
    let offsetPx = activeW * 0.9; 
    if (activeW > 600) offsetPx = activeW * 0.65; // Wide card (760px) needs more absolute space
    
    if (isMobile) offsetPx = activeW * (isVideoCarousel ? 0.62 : 0.72);
    else if (isTablet) offsetPx = activeW * (isVideoCarousel ? 0.81 : 0.87);

    // 3D depth values — reduced on mobile for cleaner look inside overflow:hidden
    let sideZ = isMobile ? -60 : -120;
    let sideRot = isMobile ? 18 : 35;
    let sideScale = isMobile ? 0.8 : 0.75;
    let centerZ = isMobile ? 30 : 60;

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
      if (offset === 0) {
        // Center card — pops forward
        item.setAttribute('data-ec-offset', '0');
        item.style.transform = `translate(-50%, -50%) translateZ(${centerZ}px) scale(1) rotateY(0deg)`;
        item.style.pointerEvents = 'auto';
      } else if (offset === 1) {
        // Right side — tilts back into depth
        item.setAttribute('data-ec-offset', '1');
        item.style.transform = `translate(calc(-50% + ${offsetPx}px), -50%) translateZ(${sideZ}px) scale(${sideScale}) rotateY(-${sideRot}deg)`;
        item.style.pointerEvents = 'auto';
      } else if (offset === -1) {
        // Left side — tilts back into depth
        item.setAttribute('data-ec-offset', '-1');
        item.style.transform = `translate(calc(-50% - ${offsetPx}px), -50%) translateZ(${sideZ}px) scale(${sideScale}) rotateY(${sideRot}deg)`;
        item.style.pointerEvents = 'auto';
      } else {
        // Off-screen — deep in background
        item.setAttribute('data-ec-offset', 'hidden');
        const dir = offset > 0 ? 1 : -1;
        item.style.transform = `translate(calc(-50% + ${dir * offsetPx * 2}px), -50%) translateZ(-200px) scale(0.5)`;
        item.style.pointerEvents = 'none';
      }
    });

    this._updateCounter();
    this._updateNav();
    this._triggerLazyLoad();
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

      if (this._useNativeScroll()) {
        if (suppressedClick || blockedCardClick) {
          e.stopImmediatePropagation();
          e.preventDefault();
        }
        return;
      }
      if (suppressedClick || blockedCardClick) {
        e.stopImmediatePropagation();
        e.preventDefault();
        return;
      }
      const card = e.target.closest(this.itemSelector);
      if (!card) return;
      const offset = card.getAttribute('data-ec-offset');
      if (offset === '1' || offset === '-1') {
        e.stopImmediatePropagation();
        e.preventDefault();
        this.navigate(parseInt(offset));
      }
      // offset '0' — let click propagate to existing onclick / addEventListener handlers
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
})();

// ═══════ PORTFOLIO SECTION - CINEMATIC INTRO ═══════
(function() {
  const portfolioSection = document.getElementById('portfolio');
  if (!portfolioSection) return;

  const title = document.getElementById('portfolioTitle');
  const desc = document.getElementById('portfolioDesc');
  const filters = document.querySelectorAll('.portfolio-filters button');

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

        // Stagger: accent line first, then words, then desc, then filters
        wordInners.forEach((inner, i) => { inner.style.transitionDelay = `${300 + i * 180}ms`; });
        if (desc) desc.style.transitionDelay = '750ms';
        filters.forEach((button, i) => { button.style.transitionDelay = `${900 + i * 55}ms`; });

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

    [...text].forEach((char, i) => {
      const span = document.createElement('span');
      span.className = 'video-tag-letter';
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

// ═══════ MOBILE TESTIMONIALS CAROUSEL ═══════
(function() {
  function makeSvgArrow(pointLeft) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '20'); svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', pointLeft ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6');
    svg.appendChild(path);
    return svg;
  }

  function initTestimonialsCarousel() {
    if (window.innerWidth > 768) return;
    const section = document.getElementById('testimonials');
    if (!section) return;
    const grid = section.querySelector('.testimonials-grid');
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll('.testimonial-card'));
    if (cards.length < 2) return;

    // Wrap grid with arrow-hint container
    const wrapper = document.createElement('div');
    wrapper.className = 'tm-arrow-hints';
    grid.parentNode.insertBefore(wrapper, grid);
    wrapper.appendChild(grid);

    const leftArrow = document.createElement('div');
    leftArrow.className = 'tm-arrow-hint tm-arrow-hint--left';
    leftArrow.appendChild(makeSvgArrow(true));
    wrapper.appendChild(leftArrow);

    const rightArrow = document.createElement('div');
    rightArrow.className = 'tm-arrow-hint tm-arrow-hint--right';
    rightArrow.appendChild(makeSvgArrow(false));
    wrapper.appendChild(rightArrow);

    // Dot indicators below the wrapper
    const dotsEl = document.createElement('div');
    dotsEl.className = 'tm-dots';
    cards.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'tm-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', 'Go to testimonial ' + (i + 1));
      dot.addEventListener('click', () => {
        grid.scrollTo({ left: i * window.innerWidth, behavior: 'smooth' });
      });
      dotsEl.appendChild(dot);
    });
    wrapper.parentNode.insertBefore(dotsEl, wrapper.nextSibling);

    // Fade arrows after 2 seconds
    setTimeout(() => {
      leftArrow.classList.add('faded');
      rightArrow.classList.add('faded');
    }, 2000);

    // Sync active dot on scroll
    const dots = Array.from(dotsEl.querySelectorAll('.tm-dot'));
    grid.addEventListener('scroll', () => {
      const idx = Math.round(grid.scrollLeft / window.innerWidth);
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    }, { passive: true });

    // Touch swipe — explicit handler for reliability across iOS/Android
    let tmTouchStartX = 0, tmTouchStartY = 0, tmIsHorizontal = null;
    grid.addEventListener('touchstart', (e) => {
      tmTouchStartX = e.touches[0].clientX;
      tmTouchStartY = e.touches[0].clientY;
      tmIsHorizontal = null;
    }, { passive: true });
    grid.addEventListener('touchmove', (e) => {
      const dx = e.touches[0].clientX - tmTouchStartX;
      const dy = e.touches[0].clientY - tmTouchStartY;
      if (tmIsHorizontal === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        tmIsHorizontal = Math.abs(dx) > Math.abs(dy);
      }
      if (tmIsHorizontal) e.preventDefault();
    }, { passive: false });
    grid.addEventListener('touchend', (e) => {
      if (!tmIsHorizontal) return;
      const dx = e.changedTouches[0].clientX - tmTouchStartX;
      if (Math.abs(dx) > 40) {
        const current = Math.round(grid.scrollLeft / window.innerWidth);
        const next = Math.max(0, Math.min(cards.length - 1, current + (dx < 0 ? 1 : -1)));
        grid.scrollTo({ left: next * window.innerWidth, behavior: 'smooth' });
      }
      tmIsHorizontal = null;
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTestimonialsCarousel);
  } else {
    initTestimonialsCarousel();
  }
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
