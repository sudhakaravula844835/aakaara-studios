// ═══════ CINEMATIC INTRO ANIMATION ═══════
(function() {
  const intro = document.getElementById('intro');

  // Skip intro when returning from a sub-page (e.g. couple-portraits)
  if (sessionStorage.getItem('skipIntro') === '1') {
    const savedY = parseInt(sessionStorage.getItem('returnScrollY') || '0', 10);
    sessionStorage.removeItem('skipIntro');
    sessionStorage.removeItem('returnScrollY');
    intro.classList.add('hidden');
    document.body.classList.remove('intro-active');
    document.getElementById('heroContent').style.opacity = '1';
    document.getElementById('heroScroll').style.opacity = '1';
    document.getElementById('navbar').classList.add('visible');
    // Restore scroll after layout settles
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, savedY)));
    return;
  }

  const mark = document.getElementById('introMark');
  const petals = [document.getElementById('petal1'), document.getElementById('petal2'), document.getElementById('petal3'), document.getElementById('petal4')];
  const centerDot = document.getElementById('centerDot');
  const letters = document.querySelectorAll('#introTitle .letter');
  const dots = document.getElementById('introDots');
  const sub = document.getElementById('introSub');
  const tag = document.getElementById('introTag');
  const t = (delay, fn) => setTimeout(fn, delay);
  t(300, () => { mark.style.transition = 'opacity 1s cubic-bezier(0.16,1,0.3,1), transform 1s cubic-bezier(0.16,1,0.3,1)'; mark.style.opacity = '1'; mark.style.transform = 'scale(1)'; });
  petals.forEach((p, i) => { t(500 + i * 280, () => { p.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)'; p.style.strokeDashoffset = '0'; }); });
  t(1200, () => { centerDot.style.transition = 'r 0.6s cubic-bezier(0.16,1,0.3,1), opacity 0.6s'; centerDot.setAttribute('r', '5'); centerDot.style.opacity = '0.85'; });
  letters.forEach((l, i) => { t(1800 + i * 90, () => { l.style.transition = 'opacity 0.9s cubic-bezier(0.16,1,0.3,1), transform 0.9s cubic-bezier(0.16,1,0.3,1), filter 0.9s cubic-bezier(0.25,0.46,0.45,0.94)'; l.style.opacity = '1'; l.style.transform = 'translateY(0) scale(1)'; l.style.filter = 'blur(0px)'; }); });
  t(2600, () => { dots.style.transition = 'opacity 0.5s'; dots.style.opacity = '1'; });
  t(2900, () => { sub.style.transition = 'opacity 0.8s'; sub.style.opacity = '1'; });
  t(3200, () => { tag.style.transition = 'opacity 0.8s'; tag.style.opacity = '1'; });
  t(4200, () => {
    const introGroup = document.getElementById('introGroup');
    const navbar = document.getElementById('navbar');
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

// ═══════ SCROLL — Letter Spacing + Background logo ═══════
(function() {
  const heroTitle = document.getElementById('heroTitle');
  const bgMark = document.getElementById('heroBgMark');
  const hero = document.querySelector('.hero');
  const heroH = hero.offsetHeight;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const progress = Math.min(y / heroH, 1);
    heroTitle.style.letterSpacing = (0.18 + progress * 0.82) + 'em';
    bgMark.style.opacity = progress > 0.2 ? Math.min((progress - 0.2) * 1.5, 1) : 0;
    document.getElementById('heroContent').style.opacity = Math.max(1 - progress * 1.5, 0);
    document.getElementById('navbar').classList.toggle('scrolled', y > 60);
  }, { passive: true });
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
  if (cat === 'all') {
    const shownCats = new Set();
    document.querySelectorAll('.gallery-item').forEach(item => {
      const itemCat = item.dataset.cat;
      if (!shownCats.has(itemCat)) {
        item.style.display = '';
        item.style.animation = 'fadeIn 0.5s ease both';
        shownCats.add(itemCat);
      } else {
        item.style.display = 'none';
      }
    });
  } else {
    document.querySelectorAll('.gallery-item').forEach(item => {
      if (item.dataset.cat === cat) {
        item.style.display = '';
        item.style.animation = 'fadeIn 0.5s ease both';
      } else {
        item.style.display = 'none';
      }
    });
  }
  if (typeof portfolioCarousel !== 'undefined' && portfolioCarousel) { portfolioCarousel.currentIndex = 0; portfolioCarousel.rebuild(); }
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
        if (term !== '') item.style.animation = 'fadeIn 0.5s ease both';
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
      if (match && selected !== '') item.style.animation = 'fadeIn 0.5s ease both';
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

// ═══════ CUSTOM CURSOR — FIX 1 ═══════
// Root cause of lag: cursor.style.left/top triggers layout reflow every frame.
// Fix: translate3d() is GPU-composited — zero layout impact. Scale is also
// animated in the same rAF loop to avoid CSS-vs-JS transform conflicts.
(function() {
  const cursor = document.getElementById('cursorFollow');
  let mouseX = 0, mouseY = 0, curX = 0, curY = 0;
  let curScale = 0.3, targetScale = 0.3;
  // Half-width / half-height of the pill to center it on the pointer
  const OX = 40, OY = 16;

  document.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });

  (function animateCursor() {
    const ease = 0.18;   // slightly snappier than 0.15 for immediate feel
    curX    += (mouseX      - curX)      * ease;
    curY    += (mouseY      - curY)      * ease;
    curScale += (targetScale - curScale) * ease;
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

  let swImages = [], swIndex = 0, swIsOpen = false, swParafRAF = null;

  function openSwGallery(work) {
    const folder = work.dataset.folder || 'images/default';
    const count = parseInt(work.dataset.count || '1', 10);
    const ext = work.dataset.ext || 'jpg';
    const isStatic = work.dataset.static === 'true';

    // Build image array
    swImages = Array.from({ length: count }, (_, i) => `${folder}/${i + 1}.${ext}`);
    
    swIndex = 0;
    galleryTitle.textContent = work.dataset.title || '';
    gallerySubtitle.textContent = work.dataset.type || '';
    
    gallery.classList.add('sw-open', 'sw-gallery-enter');
    if (isStatic) gallery.classList.add('sw-static');

    document.body.style.overflow = 'hidden'; 
    swIsOpen = true;

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
    galleryStrip.querySelectorAll('.sw-strip-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        swIndex = parseInt(thumb.dataset.idx, 10);
        renderSwImage(swIndex, false);
      });
    });
  }

  function closeSwGallery() {
    if (!swIsOpen) return;
    gallery.classList.add('sw-gallery-exit');
    gallery.addEventListener('animationend', function () {
      gallery.classList.remove('sw-open', 'sw-gallery-exit', 'sw-static');
      galleryImg.style.backgroundImage = '';
      if (galleryStrip) galleryStrip.innerHTML = '';
      swIsOpen = false;
    }, { once: true });
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

  // Touch / Swipe Support
  let swTouchX = 0;
  gallery.addEventListener('touchstart', (e) => { swTouchX = e.changedTouches[0].screenX; }, { passive: true });
  gallery.addEventListener('touchend', (e) => {
    const diff = swTouchX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 50) swNav(diff > 0 ? 1 : -1);
  }, { passive: true });

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
    galleryStrip.addEventListener('mousemove', (e) => {
      const mx = e.clientX;
      const thumbs = galleryStrip.querySelectorAll('.sw-strip-thumb');
      thumbs.forEach(thumb => {
        const rect = thumb.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const dist = Math.abs(mx - cx);
        // Gaussian-style falloff: max scale 1.9, influence radius 120px
        const RADIUS = 120, MAX_BOOST = 0.9;
        const scale = dist < RADIUS ? 1 + MAX_BOOST * Math.pow(1 - dist / RADIUS, 2) : 1;
        thumb.style.transform = `scale(${scale.toFixed(3)})`;
        thumb.style.zIndex = Math.round(scale * 10);
      });
    });
    galleryStrip.addEventListener('mouseleave', () => {
      const thumbs = galleryStrip.querySelectorAll('.sw-strip-thumb');
      thumbs.forEach(thumb => { thumb.style.transform = ''; thumb.style.zIndex = ''; });
    });
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
  var muteBtn    = document.getElementById('csMuteToggle');

  var introHeight  = window.innerHeight * 0.8;
  var wrapTop      = 0;
  var rafPending   = false;
  var lastScrollY  = -1;
  var lastActive   = 0;
  var hintDismissed = false;
  var isMuted      = true;
  var isVisible    = false;

  function cacheLayout() {
    var scrollTop = window.scrollY || document.documentElement.scrollTop;
    wrapTop     = wrapper.getBoundingClientRect().top + scrollTop;
    introHeight = window.innerHeight * 0.8;
  }
  cacheLayout();
  window.addEventListener('load', cacheLayout);

  /* ── Smart media loader — video → image → gradient fallback ── */
  var videos = panels.map(function(p) { return p.querySelector('.cs-video'); });

  panels.forEach(function(panel, i) {
    var videoSrc = panel.dataset.video;
    var imgSrc   = panel.dataset.bg;
    var vid      = videos[i];
    var bg       = bgs[i];

    if (videoSrc && videoSrc !== '') {
      /* VIDEO path — HLS (.m3u8) or direct file */
      function showVideo() {
        bg.className = bg.className.replace(/cs-bg-\d/, '').trim();
        vid.classList.add('cs-vid-ready');
      }

      /* Try multiple events — whichever fires first wins */
      vid.addEventListener('loadeddata',     function() { showVideo(); }, { once: true });
      vid.addEventListener('canplay',        function() { showVideo(); }, { once: true });
      vid.addEventListener('loadedmetadata', function() {
        vid.play().catch(function(){});
      }, { once: true });

      /* Hard fallback — force-show after 2s regardless */
      setTimeout(function() { showVideo(); }, 2000);

      if (videoSrc.indexOf('.m3u8') !== -1 && typeof Hls !== 'undefined' && Hls.isSupported()) {
        var hls = new Hls();
        hls.loadSource(videoSrc);
        hls.attachMedia(vid);
        hls.on(Hls.Events.MANIFEST_PARSED, function() { vid.play().catch(function(){}); });
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
  });

  /* Mute Toggle Logic */
  if (muteBtn) {
    muteBtn.addEventListener('click', function() {
      isMuted = !isMuted;
      muteBtn.classList.toggle('unmuted', !isMuted);
      videos.forEach(function(v) { if(v) v.muted = isMuted; });
    });
  }

  /* Viewport Observer: Pause videos when out of view */
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      isVisible = entry.isIntersecting;
      if (!isVisible) {
        videos.forEach(function(v) { if(v) v.pause(); });
      } else {
        requestAnimationFrame(render);
      }
    });
  }, { threshold: 0 });
  observer.observe(wrapper);

  /* Play active panel video(s), pause others */
  function syncVideos(idx1, idx2) {
    if (!isVisible) {
      videos.forEach(function(vid) { if(vid) vid.pause(); });
      return;
    }

    videos.forEach(function(vid, i) {
      if (!vid || !vid.getAttribute('src')) return;
      // Ensure mute state is consistent
      vid.muted = isMuted;
      
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
      var targetY = wrapTop + introHeight + target * window.innerHeight;
      window.scrollTo({ top: targetY, behavior: 'smooth' });
    });
  });

  setTimeout(function() {
    if (!hintDismissed && window.scrollY < wrapTop + introHeight + 100)
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

    var scrollInto = scrollY - wrapTop - introHeight;
    var panelH     = window.innerHeight;

    if (scrollInto > 80 && !hintDismissed) {
      hintDismissed = true;
      scrollHint.classList.remove('visible');
    }

    /* Before sticky zone — reset */
    if (scrollInto < 0) {
      panels.forEach(function(panel, i) {
        panel.style.transform  = i === 0 ? 'translateY(0%)' : 'translateY(100%)';
        panel.style.zIndex     = '0';
        bgs[i].style.transform = 'scale(1.04)';
      });
      counterEl.textContent = '01';
      dots.forEach(function(d, i) { d.classList.toggle('active', i === 0); });
      showSlide(0);
      syncVideos(0);
      return;
    }

    var rawPanel  = scrollInto / panelH;
    var activeIdx = Math.max(0, Math.min(PANEL_COUNT - 1, Math.floor(rawPanel)));
    var progress  = rawPanel - activeIdx;

    var newCount = String(activeIdx + 1).padStart(2, '0');
    if (counterEl.textContent !== newCount) counterEl.textContent = newCount;
    dots.forEach(function(d, i) { d.classList.toggle('active', i === activeIdx); });

    /* Switch text early — when incoming panel is ~35% up the screen */
    var slideIdx = (progress > 0.35 && activeIdx < PANEL_COUNT - 1) ? activeIdx + 1 : activeIdx;
    showSlide(slideIdx);
    
    /* Play both the base panel (being covered) and the incoming panel (covering) */
    var nextIdx = (activeIdx < PANEL_COUNT - 1) ? activeIdx + 1 : undefined;
    syncVideos(activeIdx, nextIdx);

    /* Position panels:
       past     → translateY(-100%), z=0
       active   → translateY(0%),    z=1  (incoming wipes over this bg)
       incoming → translateY(0-100%),z=2  (slides over active bg)
       waiting  → translateY(100%),  z=0
       Text overlay is z=100, totally independent — never covered */
    panels.forEach(function(panel, i) {
      var yPct;
      if (i < activeIdx) {
        yPct = -100;
        panel.style.zIndex     = '0';
        bgs[i].style.transform = 'scale(1.04)';
      } else if (i === activeIdx) {
        yPct = 0;
        panel.style.zIndex     = '1';
        bgs[i].style.transform = 'translateY(' + (-progress * 4) + '%) scale(1.04)';
      } else if (i === activeIdx + 1) {
        yPct = (1 - progress) * 100;
        panel.style.zIndex     = '2';
        bgs[i].style.transform = 'translateY(' + ((1 - progress) * 3) + '%) scale(1.04)';
      } else {
        yPct = 100;
        panel.style.zIndex     = '0';
        bgs[i].style.transform = 'scale(1.04)';
      }
      panel.style.transform = 'translateY(' + yPct + '%)';
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
  if (cat === 'all') {
    const shownCats = new Set();
    document.querySelectorAll('.vw-card').forEach(card => {
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
    document.querySelectorAll('.vw-card').forEach(card => {
      if (card.dataset.vcat === cat) {
        card.style.display = '';
        card.style.animation = 'fadeIn 0.45s ease both';
      } else {
        card.style.display = 'none';
      }
    });
  }
  if (typeof videoCarousel !== 'undefined' && videoCarousel) { videoCarousel.currentIndex = 0; videoCarousel.rebuild(); }
}

// Auto-load video poster/cover images from data-poster attribute
(function() {
  document.querySelectorAll('.vw-card').forEach(card => {
    const posterSrc = card.dataset.poster;
    if (!posterSrc) return;
    const posterEl = card.querySelector('.vw-poster');
    if (!posterEl) return;
    const img = new Image();
    img.onload = () => {
      posterEl.style.backgroundImage = `url('${posterSrc}')`;
    };
    img.src = posterSrc;
  });
})();

// Hover muted preview — lazy-loaded on first hover, paused on leave
(function() {
  document.querySelectorAll('.vw-card').forEach(card => {
    const src = card.dataset.video;
    if (!src) return;
    const poster = card.querySelector('.vw-poster');
    let vid = null, hoverTimer = null;

    const play = () => {
      if (!vid) {
        vid = document.createElement('video');
        vid.muted = true; vid.loop = true;
        vid.playsInline = true; vid.preload = 'metadata';
        vid.src = src;
        poster.appendChild(vid);
      }
      vid.play().catch(() => {});
      poster.classList.add('active');
    };

    const pause = (reset = false) => {
      if (vid) {
        vid.pause();
        if (reset) vid.currentTime = 0;
      }
      poster.classList.remove('active');
    };

    // Desktop: Hover
    card.addEventListener('mouseenter', () => {
      if (window.matchMedia('(hover: none)').matches) return;
      hoverTimer = setTimeout(play, 250);
    });

    card.addEventListener('mouseleave', () => {
      if (window.matchMedia('(hover: none)').matches) return;
      clearTimeout(hoverTimer);
      pause(true);
    });

    // Mobile: Auto-play on scroll
    if (window.matchMedia('(hover: none)').matches) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) play();
          else pause();
        });
      }, { threshold: 0.6 });
      observer.observe(card);
    }
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
  if (!modal) return;

  var activeHls = null; // Track active HLS instance for cleanup

  function attachHLS(videoEl, src) {
    if (activeHls) { activeHls.destroy(); activeHls = null; }
    if (src.includes('.m3u8')) {
      if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        activeHls = new Hls();
        activeHls.loadSource(src);
        activeHls.attachMedia(videoEl);
        activeHls.on(Hls.Events.MANIFEST_PARSED, function() { videoEl.play().catch(function(){}); });
      } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        videoEl.src = src;
        videoEl.play().catch(function(){});
      }
    } else {
      videoEl.src = src;
      videoEl.play().catch(function(){});
    }
  }

  function openModal(card) {
    const src = card.dataset.video;
    vmTitle.textContent = card.dataset.title || '';
    vmSub.textContent   = card.dataset.type  || '';

    if (src) {
      attachHLS(vmVideo, src);
      vmStage.classList.add('vm-has-video');
      // Reset controls
      if (vmPlay) vmPlay.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
      if (vmFill) vmFill.style.width = '0%';
    } else {
      vmStage.classList.remove('vm-has-video');
    }
    modal.classList.add('vm-open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('vm-open');
    vmVideo.pause();
    if (activeHls) { activeHls.destroy(); activeHls = null; }
    vmVideo.src = '';
    vmStage.classList.remove('vm-has-video');
    document.body.style.overflow = '';
  }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  }

  // Controls Logic
  if (vmPlay) {
    vmPlay.addEventListener('click', () => {
      if (vmVideo.paused) {
        vmVideo.play();
        vmPlay.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
      } else {
        vmVideo.pause();
        vmPlay.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
      }
    });
  }

  if (vmMute) {
    vmMute.addEventListener('click', () => {
      vmVideo.muted = !vmVideo.muted;
      vmMute.innerHTML = vmVideo.muted 
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93L4.93 19.07"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
    });
  }

  if (vmFs) {
    vmFs.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        if (vmStage.requestFullscreen) vmStage.requestFullscreen();
        else if (vmStage.webkitRequestFullscreen) vmStage.webkitRequestFullscreen();
        else if (vmVideo.webkitEnterFullscreen) vmVideo.webkitEnterFullscreen(); // iOS fallback
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      }
    });

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
    vmVideo.addEventListener('timeupdate', () => {
      const pct = (vmVideo.currentTime / vmVideo.duration) * 100;
      if (vmFill) vmFill.style.width = `${pct}%`;
      if (vmTime) vmTime.textContent = formatTime(vmVideo.currentTime);
    });
  }

  if (vmTrack) {
    vmTrack.addEventListener('click', (e) => {
      const rect = vmTrack.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      vmVideo.currentTime = pos * vmVideo.duration;
    });
  }

  document.querySelectorAll('.vw-card').forEach(c => c.addEventListener('click', () => openModal(c)));
  vmClose.addEventListener('click', closeModal);
  vmBg.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('vm-open')) closeModal();
  });
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
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;

  // Initialize accessibility attributes for all gallery items
  const items = grid.querySelectorAll('.gallery-item');
  items.forEach(item => {
    if (!item.hasAttribute('tabindex')) item.setAttribute('tabindex', '0');
    if (!item.hasAttribute('role')) item.setAttribute('role', 'button');
    if (!item.hasAttribute('aria-label') && item.dataset.title) {
      item.setAttribute('aria-label', 'View gallery: ' + item.dataset.title);
    }
  });

  // Event delegation for keyboard interaction
  grid.addEventListener('keydown', function(e) {
    const item = e.target.closest('.gallery-item');
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
    const fpFrom = flatpickr(dateFrom, {
      altInput: true,
      altFormat: "F j, Y", // e.g., "November 4, 2023" - what the user sees
      dateFormat: "Y-m-d", // Actual value submitted in the form (e.g., "2023-11-04")
      minDate: "today", // Prevents selecting past dates
      onChange: function(selectedDates, dateStr, instance) {
        fpTo.set('minDate', dateStr);
      }
    });
    const fpTo = flatpickr(dateTo, {
      altInput: true,
      altFormat: "F j, Y",
      dateFormat: "Y-m-d",
      minDate: "today"
    });
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
    this._bindEvents();
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

  navigate(dir) {
    const next = this.currentIndex + dir;
    if (next < 0 || next >= this.filteredItems.length) return;
    this.currentIndex = next;
    this.render();
  }

  goTo(index) {
    if (index < 0 || index >= this.filteredItems.length) return;
    this.currentIndex = index;
    this.render();
  }

  render() {
    const allItems = this.track.querySelectorAll(this.itemSelector);
    const filtered = this.filteredItems;
    const ci = this.currentIndex;

    // Use cached card width (updated on resize) — avoids getComputedStyle every render
    if (!this._cachedCardW) {
      const sampleCard = filtered[0] || allItems[0];
      this._cachedCardW = sampleCard ? sampleCard.offsetWidth : 380;
    }
    const cardW = this._cachedCardW;
    const isMobile = window.innerWidth <= 768;
    const isTablet = window.innerWidth <= 1024;
    let offsetPx = cardW * 0.9;
    if (isMobile) offsetPx = cardW * 0.72;
    else if (isTablet) offsetPx = cardW * 0.87;

    // 3D depth values — reduced on mobile for cleaner look inside overflow:hidden
    const sideZ    = isMobile ? -60  : -120;
    const sideRot  = isMobile ? 18   : 35;
    const sideScale = isMobile ? 0.8 : 0.75;
    const centerZ  = isMobile ? 30   : 60;

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
    if (this.prevBtn) this.prevBtn.classList.toggle('ec-disabled', this.currentIndex <= 0);
    if (this.nextBtn) this.nextBtn.classList.toggle('ec-disabled', this.currentIndex >= this.filteredItems.length - 1);
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
      const galleryOpen = document.getElementById('swGallery')?.classList.contains('open');
      const modalOpen = document.getElementById('videoModal')?.classList.contains('active');
      if (galleryOpen || modalOpen) return;
      // Only respond if this carousel is in viewport
      const rect = this.container.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      if (!inView) return;
      e.preventDefault();
      this.navigate(e.key === 'ArrowLeft' ? -1 : 1);
    });

    // Touch swipe
    let touchStartX = 0;
    let touchStartY = 0;
    this.container.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    this.container.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
        this.navigate(dx < 0 ? 1 : -1);
      }
    }, { passive: true });

    // Mouse drag swipe (trackpad / click-and-drag)
    let mouseDown = false, mouseStartX = 0, mouseMoved = false;
    this.container.addEventListener('mousedown', (e) => {
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
      if (Math.abs(dx) > 30 && mouseMoved) {
        this.navigate(dx < 0 ? 1 : -1);
      }
    });

    // Scroll wheel navigation — only intercept horizontal swipes, let vertical scroll pass through
    let wheelTimer = null;
    let wheelAccum = 0;
    this.container.addEventListener('wheel', (e) => {
      // Only intercept horizontal gestures (trackpad two-finger swipe left/right)
      // Let vertical scroll pass through so user can scroll down the page
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      // Horizontal swipe detected — prevent page scroll and navigate carousel
      e.preventDefault();
      wheelAccum += e.deltaX;
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        if (Math.abs(wheelAccum) > 30) {
          this.navigate(wheelAccum > 0 ? 1 : -1);
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

  }
}

// Lazy-load helper for gallery items
function lazyLoadGalleryItem(item) {
  const bg = item.querySelector('.gi-bg');
  if (!bg || bg.style.backgroundImage) return; // Already loaded
  const folder = item.dataset.folder;
  const ext = item.dataset.ext || 'jpg';
  const coverSrc = item.dataset.cover || (folder ? `${folder}/1.${ext}` : null);
  if (coverSrc) {
    const img = new Image();
    img.onload = function() {
      bg.style.backgroundImage = `url('${coverSrc}')`;
      if (item.dataset.bgSize) bg.style.backgroundSize = item.dataset.bgSize;
      if (item.dataset.bgPos) bg.style.backgroundPosition = item.dataset.bgPos;
    };
    img.src = coverSrc;
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