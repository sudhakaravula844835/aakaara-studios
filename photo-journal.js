// Mobile Framed Stories: one journal renderer for every album's existing data.
(function () {
  let manifestPromise;
  function loadDimensions() {
    if (!manifestPromise) {
      manifestPromise = fetch('/images/gallery-manifest.json')
        .then(response => {
          if (!response.ok) throw new Error('Image dimensions unavailable');
          return response.json();
        })
        .then(dimensions => dimensions && typeof dimensions === 'object' ? dimensions : {})
        .catch(() => {
          // New albums also work before the optional dimension index is rebuilt.
          manifestPromise = null;
          return {};
        });
    }
    return manifestPromise;
  }

  window.createPhotoJournal = function ({ gallery, onClose }) {
    const template = document.getElementById('swJournalTemplate');
    if (!template) return null;
    gallery.append(template.content.cloneNode(true));
    const get = id => gallery.querySelector('#' + id);
    const journal = get('swJournal');
    const scroll = get('swJournalScroll');
    const grid = get('swJournalGrid');
    const detail = get('swJournalDetail');
    const detailImage = get('swJournalDetailImg');
    const detailError = get('swJournalDetailError');
    const status = get('swJournalStatus');
    const closeButton = get('swJournalClose');
    const backButton = get('swJournalBack');
    let opened = false, generation = 0, photographs = [], selectedIndex = 0;
    let title = '', selectedButton = null, savedScrollTop = 0;

    function renderDetail(index) {
      selectedIndex = index;
      detailError.hidden = true;
      detailImage.hidden = false;
      detailImage.alt = `${title} — photograph ${index + 1} of ${photographs.length}`;
      get('swJournalDetailCounter').textContent = `${index + 1} / ${photographs.length}`;
      detailImage.src = photographs[index];
      // Keep focus on an end control; nextDetail ignores out-of-range moves.
      get('swJournalPrev').setAttribute('aria-disabled', String(index === 0));
      get('swJournalNext').setAttribute('aria-disabled', String(index === photographs.length - 1));
    }

    function openDetail(index, button) {
      selectedButton = button;
      savedScrollTop = scroll.scrollTop;
      journal.inert = true;
      detail.hidden = false;
      gallery.setAttribute('aria-labelledby', 'swJournalDetailTitle');
      renderDetail(index);
      backButton.focus({ preventScroll: true });
    }

    function closeDetail() {
      detail.hidden = true;
      journal.inert = false;
      gallery.setAttribute('aria-labelledby', 'swJournalTitle');
      scroll.scrollTop = savedScrollTop;
      selectedButton?.focus({ preventScroll: true });
    }

    function nextDetail(direction) {
      const next = selectedIndex + direction;
      if (next >= 0 && next < photographs.length) renderDetail(next);
    }

    function fillRow(row) {
      if (!row) return;
      const buttons = Array.from(row.children);
      const ratios = buttons.map(button => {
        const image = button.querySelector('img');
        return Number(image.getAttribute('width')) / Number(image.getAttribute('height'));
      });
      // Flex grow factors whose sum is below 1 leave part of the row empty.
      // Keep proportional widths, but give every photo a factor of at least 1.
      const smallestRatio = Math.min(...ratios);
      buttons.forEach((button, index) => {
        button.style.flexGrow = ratios[index] / smallestRatio;
      });
    }

    function makePhoto(photo, eager) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sw-journal-photo';
      button.dataset.index = photo.index;
      button.setAttribute('aria-label', `Enlarge photograph ${photo.index + 1} of ${photographs.length} — ${title}`);
      const image = document.createElement('img');
      image.alt = `${title} — photograph ${photo.index + 1}`;
      image.width = photo.width;
      image.height = photo.height;
      image.loading = eager ? 'eager' : 'lazy';
      image.decoding = 'async';
      if (eager) image.fetchPriority = 'high';
      const error = document.createElement('span');
      error.className = 'sw-journal-error';
      error.textContent = 'Photograph unavailable';
      error.hidden = true;
      image.addEventListener('error', () => {
        button.classList.add('sw-photo-unavailable');
        error.hidden = false;
      });
      if (!photo.knownDimensions) {
        image.addEventListener('load', () => {
          image.width = image.naturalWidth;
          image.height = image.naturalHeight;
          fillRow(button.parentElement);
        }, { once: true });
      }
      image.src = photo.url;
      button.append(image, error);
      button.addEventListener('click', () => openDetail(photo.index, button));
      return button;
    }

    function renderPhotos(dimensions) {
      const photos = photographs.map((url, index) => {
        const size = dimensions[url];
        const knownDimensions = Array.isArray(size) && size[0] > 0 && size[1] > 0;
        return { url, index, width: knownDimensions ? size[0] : 1200,
          height: knownDimensions ? size[1] : 1800, knownDimensions };
      });
      const fragment = document.createDocumentFragment();
      function appendRow(items, eager = false) {
        const row = document.createElement('div');
        row.className = 'sw-journal-row';
        items.forEach(photo => row.append(makePhoto(photo, eager)));
        fillRow(row);
        fragment.append(row);
      }
      // Use an early establishing landscape when present, then keep source order.
      const landscape = photos.slice(0, 6).findIndex(photo => photo.width > photo.height);
      if (photos.length) appendRow(photos.splice(Math.max(0, landscape), 1), true);
      let pairedRows = 0;
      while (photos.length) {
        const photo = photos.shift();
        const next = photos[0];
        const isPortrait = item => item && item.width / item.height < 0.9;
        if (isPortrait(photo) && isPortrait(next) && pairedRows < 2) {
          appendRow([photo, photos.shift()]);
          pairedRows++;
        } else {
          appendRow([photo]);
          if (isPortrait(photo)) pairedRows = 0;
        }
      }
      grid.replaceChildren(fragment);
      grid.setAttribute('aria-busy', 'false');
      status.hidden = photographs.length > 0;
      if (!photographs.length) status.textContent = 'This story will be ready soon.';
    }

    async function open(work, images) {
      const request = ++generation;
      opened = true;
      photographs = images.slice();
      title = work.dataset.title || 'Framed story';
      selectedButton = null;
      selectedIndex = 0;
      detail.hidden = true;
      journal.hidden = false;
      journal.inert = false;
      gallery.classList.add('sw-journal-mode');
      gallery.setAttribute('aria-labelledby', 'swJournalTitle');
      get('swJournalTitle').textContent = title;
      get('swJournalCompactTitle').textContent = title;
      get('swJournalDetailTitle').textContent = title;
      get('swJournalSubtitle').textContent = work.dataset.type || '';
      get('swJournalCount').textContent = `${images.length} photograph${images.length === 1 ? '' : 's'}`;
      grid.replaceChildren();
      grid.setAttribute('aria-busy', 'true');
      status.textContent = 'Loading photographs…';
      status.hidden = false;
      scroll.scrollTop = 0;
      journal.classList.remove('sw-journal-scrolled');
      closeButton.focus({ preventScroll: true });
      const dimensions = await loadDimensions();
      if (!opened || generation !== request) return;
      renderPhotos(dimensions);
    }

    function close() {
      opened = false;
      generation++;
      journal.hidden = true;
      journal.inert = false;
      detail.hidden = true;
      detailImage.removeAttribute('src');
      grid.replaceChildren();
      gallery.classList.remove('sw-journal-mode');
      gallery.setAttribute('aria-labelledby', 'swGalleryTitle');
    }

    scroll.addEventListener('scroll', () => {
      journal.classList.toggle('sw-journal-scrolled', scroll.scrollTop > 130);
    }, { passive: true });
    closeButton.addEventListener('click', onClose);
    backButton.addEventListener('click', closeDetail);
    get('swJournalPrev').addEventListener('click', () => nextDetail(-1));
    get('swJournalNext').addEventListener('click', () => nextDetail(1));
    detailImage.addEventListener('error', () => {
      detailImage.hidden = true;
      detailError.hidden = false;
    });
    gallery.addEventListener('keydown', event => {
      if (!opened) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (detail.hidden) onClose(); else closeDetail();
      }
      if (!detail.hidden && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        nextDetail(event.key === 'ArrowLeft' ? -1 : 1);
      }
      if (event.key === 'Tab') {
        const surface = detail.hidden ? journal : detail;
        const buttons = Array.from(surface.querySelectorAll('button:not(:disabled)'));
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    });

    return { open, close, isOpen: () => opened,
      shouldOpen: work => Boolean(work.closest('#portfolio')) &&
        window.matchMedia('(max-width: 768px), (hover: none) and (max-height: 600px)').matches };
  };
})();
