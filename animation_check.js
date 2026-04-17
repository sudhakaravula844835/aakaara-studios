const sampleImages = [
  {
    src: './images/nyfw-runway/1.jpg',
    title: 'Runway Light',
    subtitle: 'Editorial motion study',
  },
  {
    src: './images/nyfw-runway/4.jpg',
    title: 'City Tempo',
    subtitle: 'Movement in layered frames',
  },
  {
    src: './images/nyfw-runway/7.jpg',
    title: 'After Dark',
    subtitle: 'Low light fashion portrait',
  },
  {
    src: './images/nyfw-runway/10.jpg',
    title: 'Quiet Entrance',
    subtitle: 'Soft contrast sequence',
  },
  {
    src: './images/nyc/dumbo.jpg',
    title: 'Dumbo Drift',
    subtitle: 'New York texture study',
  },
  {
    src: './images/nyc/lib.jpg',
    title: 'Library Still',
    subtitle: 'Architectural pause',
  },
  {
    src: './images/nyc/st.jpg',
    title: 'Street Echo',
    subtitle: 'Urban portrait framing',
  },
  {
    src: './images/about/1.JPG',
    title: 'Studio Presence',
    subtitle: 'Signature portrait mood',
  },
];

const settings = {
  visibleCount: 10,
  depthRange: 56,
  autoplayForce: 0.22,
  wheelForce: 0.0028,
  keyForce: 1.8,
  touchForce: 0.035,
  resumeDelay: 2800,
  fadeIn: { start: 0.08, end: 0.18 },
  fadeOut: { start: 0.8, end: 0.95 },
  blurIn: { start: 0.0, end: 0.1 },
  blurOut: { start: 0.82, end: 1.0 },
  maxBlur: 6,
};

const root = document.getElementById('root');

if (!root) {
  document.body.innerHTML =
    '<div class="error-state">Preview root not found.</div>';
} else {
  root.innerHTML = `
    <main class="hero-shell">
      <div class="gallery-stage">
        <div class="gallery-track"></div>
      </div>
      <div class="hero-overlay">
        <div class="hero-copy">
          <p class="hero-kicker">Animation Check</p>
          <h1 class="hero-title"><em>Cinematic</em> gallery motion preview</h1>
        </div>
      </div>
      <div class="hero-meta">
        <span>Wheel, drag, or arrow keys</span>
        <span>Autoplay resumes after 3 seconds</span>
      </div>
    </main>
  `;

  const stage = root.querySelector('.gallery-stage');
  const track = root.querySelector('.gallery-track');
  const state = {
    velocity: 0,
    autoplay: true,
    lastInteraction: Date.now(),
    lastTouchY: null,
    hoveredCard: null,
    planes: [],
    cards: [],
    spatialPositions: [],
    lastFrame: performance.now(),
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const makeSpatialPositions = () => {
    const positions = [];

    for (let i = 0; i < settings.visibleCount; i += 1) {
      const horizontalAngle = (i * 2.618) % (Math.PI * 2);
      const verticalAngle = (i * 1.618 + Math.PI / 3) % (Math.PI * 2);
      const horizontalRadius = (i % 3) * 1.35;
      const verticalRadius = ((i + 1) % 4) * 0.85;

      positions.push({
        x: (Math.sin(horizontalAngle) * horizontalRadius * 220) / 3,
        y: (Math.cos(verticalAngle) * verticalRadius * 160) / 3,
      });
    }

    return positions;
  };

  const opacityFor = (normalized) => {
    if (normalized >= settings.fadeIn.start && normalized <= settings.fadeIn.end) {
      return (
        (normalized - settings.fadeIn.start) /
        (settings.fadeIn.end - settings.fadeIn.start)
      );
    }

    if (normalized < settings.fadeIn.start) {
      return 0;
    }

    if (normalized >= settings.fadeOut.start && normalized <= settings.fadeOut.end) {
      return (
        1 -
        (normalized - settings.fadeOut.start) /
          (settings.fadeOut.end - settings.fadeOut.start)
      );
    }

    if (normalized > settings.fadeOut.end) {
      return 0;
    }

    return 1;
  };

  const blurFor = (normalized) => {
    if (normalized >= settings.blurIn.start && normalized <= settings.blurIn.end) {
      return (
        settings.maxBlur *
        (1 -
          (normalized - settings.blurIn.start) /
            (settings.blurIn.end - settings.blurIn.start))
      );
    }

    if (normalized < settings.blurIn.start) {
      return settings.maxBlur;
    }

    if (normalized >= settings.blurOut.start && normalized <= settings.blurOut.end) {
      return (
        settings.maxBlur *
        ((normalized - settings.blurOut.start) /
          (settings.blurOut.end - settings.blurOut.start))
      );
    }

    if (normalized > settings.blurOut.end) {
      return settings.maxBlur;
    }

    return 0;
  };

  const registerInteraction = () => {
    state.autoplay = false;
    state.lastInteraction = Date.now();
  };

  const applyVelocity = (amount) => {
    state.velocity += amount;
    registerInteraction();
  };

  const createCard = (index) => {
    const card = document.createElement('article');
    card.className = 'gallery-card';
    card.innerHTML = `
      <div class="gallery-card__copy">
        <p class="gallery-card__eyebrow">Frame</p>
        <h3 class="gallery-card__title"></h3>
        <p class="gallery-card__subtitle"></p>
      </div>
    `;

    card.addEventListener('pointerenter', () => {
      state.hoveredCard = index;
      card.classList.add('is-hovered');
      registerInteraction();
    });

    card.addEventListener('pointerleave', () => {
      if (state.hoveredCard === index) {
        state.hoveredCard = null;
      }
      card.classList.remove('is-hovered');
    });

    track.appendChild(card);
    return card;
  };

  const syncCardContent = (card, item, imageIndex) => {
    if (card.dataset.imageSrc === item.src) {
      return;
    }

    card.dataset.imageSrc = item.src;
    card.style.backgroundImage = `
      linear-gradient(180deg, rgba(16, 10, 10, 0.06), rgba(16, 10, 10, 0.28)),
      url("${item.src}")
    `;
    card.querySelector('.gallery-card__eyebrow').textContent = `Frame ${String(
      imageIndex + 1
    ).padStart(2, '0')}`;
    card.querySelector('.gallery-card__title').textContent = item.title;
    card.querySelector('.gallery-card__subtitle').textContent = item.subtitle;
  };

  const buildScene = () => {
    state.spatialPositions = makeSpatialPositions();
    state.cards = Array.from({ length: settings.visibleCount }, (_, index) =>
      createCard(index)
    );
    state.planes = Array.from({ length: settings.visibleCount }, (_, index) => ({
      index,
      z:
        settings.visibleCount > 0
          ? ((settings.depthRange / settings.visibleCount) * index) %
            settings.depthRange
          : 0,
      imageIndex: index % sampleImages.length,
      x: state.spatialPositions[index]?.x ?? 0,
      y: state.spatialPositions[index]?.y ?? 0,
    }));
  };

  const renderScene = () => {
    state.planes.forEach((plane, index) => {
      const card = state.cards[index];
      const item = sampleImages[plane.imageIndex % sampleImages.length];
      syncCardContent(card, item, plane.imageIndex % sampleImages.length);

      const normalized = plane.z / settings.depthRange;
      const depth = (0.52 - normalized) * 1180;
      const opacity = clamp(opacityFor(normalized), 0, 1);
      const blur = clamp(blurFor(normalized), 0, settings.maxBlur);
      const cardScale = 0.72 + (1 - normalized) * 0.42;
      const velocityTilt = clamp(state.velocity * 22, -14, 14);
      const hoverLift = state.hoveredCard === index ? 55 : 0;
      const hoverScale = state.hoveredCard === index ? 0.06 : 0;
      const x = plane.x * 0.9;
      const y = plane.y * 0.95 - hoverLift;
      const rotateY = velocityTilt + plane.x * 0.035;
      const rotateX = -velocityTilt * 0.35 - plane.y * 0.04;

      card.style.opacity = String(opacity);
      card.style.filter = `blur(${blur}px) saturate(${0.92 + opacity * 0.18})`;
      card.style.zIndex = String(Math.round((1 - normalized) * 1000));
      card.style.transform = `
        translate(-50%, -50%)
        translate3d(${x}px, ${y}px, ${depth}px)
        rotateY(${rotateY}deg)
        rotateX(${rotateX}deg)
        scale(${cardScale + hoverScale})
      `;
    });
  };

  const tick = (now) => {
    const delta = Math.min((now - state.lastFrame) / 1000, 0.04);
    state.lastFrame = now;

    if (Date.now() - state.lastInteraction > settings.resumeDelay) {
      state.autoplay = true;
    }

    if (state.autoplay) {
      state.velocity += settings.autoplayForce * delta;
    }

    state.velocity *= 0.965;

    const imageAdvance =
      sampleImages.length > 0
        ? settings.visibleCount % sampleImages.length || sampleImages.length
        : 0;

    state.planes.forEach((plane, index) => {
      let newZ = plane.z + state.velocity * delta * 18;
      let wrapsForward = 0;
      let wrapsBackward = 0;

      if (newZ >= settings.depthRange) {
        wrapsForward = Math.floor(newZ / settings.depthRange);
        newZ -= settings.depthRange * wrapsForward;
      } else if (newZ < 0) {
        wrapsBackward = Math.ceil(-newZ / settings.depthRange);
        newZ += settings.depthRange * wrapsBackward;
      }

      if (wrapsForward > 0 && imageAdvance > 0) {
        plane.imageIndex =
          (plane.imageIndex + wrapsForward * imageAdvance) % sampleImages.length;
      }

      if (wrapsBackward > 0 && imageAdvance > 0) {
        const step = plane.imageIndex - wrapsBackward * imageAdvance;
        plane.imageIndex = ((step % sampleImages.length) + sampleImages.length) % sampleImages.length;
      }

      plane.z = ((newZ % settings.depthRange) + settings.depthRange) % settings.depthRange;
      plane.x = state.spatialPositions[index]?.x ?? 0;
      plane.y = state.spatialPositions[index]?.y ?? 0;
    });

    renderScene();
    requestAnimationFrame(tick);
  };

  const handleWheel = (event) => {
    event.preventDefault();
    applyVelocity(event.deltaY * settings.wheelForce);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      applyVelocity(-settings.keyForce);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      applyVelocity(settings.keyForce);
    }
  };

  const handleTouchStart = (event) => {
    state.lastTouchY = event.touches[0]?.clientY ?? null;
    registerInteraction();
  };

  const handleTouchMove = (event) => {
    if (state.lastTouchY === null) {
      return;
    }

    const currentTouchY = event.touches[0]?.clientY;
    if (typeof currentTouchY !== 'number') {
      return;
    }

    const delta = state.lastTouchY - currentTouchY;
    state.lastTouchY = currentTouchY;
    applyVelocity(delta * settings.touchForce);

    if (event.cancelable) {
      event.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    state.lastTouchY = null;
  };

  stage.addEventListener('wheel', handleWheel, { passive: false });
  stage.addEventListener('touchstart', handleTouchStart, { passive: true });
  stage.addEventListener('touchmove', handleTouchMove, { passive: false });
  stage.addEventListener('touchend', handleTouchEnd);
  document.addEventListener('keydown', handleKeyDown);

  buildScene();
  renderScene();
  requestAnimationFrame((now) => {
    state.lastFrame = now;
    requestAnimationFrame(tick);
  });
}
