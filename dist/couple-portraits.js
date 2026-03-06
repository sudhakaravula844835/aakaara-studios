document.addEventListener('DOMContentLoaded', function() {
    const nycPreviewContainer = document.querySelector('.nyc-preview');
    const nycPreviewImages = document.querySelectorAll('.nyc-preview-img');
    const imageAspectRatios = {};
    let imagesToLoad = 0;

    function setPreviewAspectRatio(loc) {
        if (!nycPreviewContainer || !imageAspectRatios[loc]) return;
        const containerWidth = nycPreviewContainer.offsetWidth;
        if (containerWidth > 0) {
            const newHeight = containerWidth * imageAspectRatios[loc];
            nycPreviewContainer.style.height = `${newHeight}px`;
        }
    }

    function showNYC(loc) {
        document.querySelectorAll('.nyc-preview-img').forEach(el => el.classList.remove('active'));
        const targetPreview = document.querySelector(`.nyc-preview-img.nyc-${loc}`);
        if (targetPreview) {
            targetPreview.classList.add('active');
            setPreviewAspectRatio(loc);
        }
    }

    if (nycPreviewContainer && nycPreviewImages.length > 0) {
        // Preload images to get their aspect ratios
        nycPreviewImages.forEach(previewImg => {
            const locMatch = previewImg.className.match(/nyc-([a-z]+)/);
            if (!locMatch) return;
            const loc = locMatch[1];
            
            const bgDiv = previewImg.querySelector('.preview-bg');
            const urlMatch = bgDiv?.style.backgroundImage.match(/url\("?(.+?)"?\)/);

            if (urlMatch && urlMatch[1]) {
                imagesToLoad++;
                const img = new Image();
                img.onload = () => {
                    if (img.naturalWidth > 0) {
                        imageAspectRatios[loc] = img.naturalHeight / img.naturalWidth;
                    }
                    imagesToLoad--;
                    if (imagesToLoad === 0) {
                        // All images loaded, set initial aspect ratio
                        const initialLocMatch = document.querySelector('.nyc-preview-img.active')?.className.match(/nyc-([a-z]+)/);
                        if (initialLocMatch) setPreviewAspectRatio(initialLocMatch[1]);
                    }
                };
                img.src = urlMatch[1];
            }
        });
    }

    const nycList = document.querySelector('.nyc-list');
    if (nycList) {
        nycList.addEventListener('mouseover', function(event) {
            const locItem = event.target.closest('.nyc-loc');
            if (locItem && locItem.dataset.loc) {
                showNYC(locItem.dataset.loc);
            }
        });
        nycList.addEventListener('click', function(event) {
            const locItem = event.target.closest('.nyc-loc');
            if (locItem && locItem.dataset.mapsUrl) {
                window.open(locItem.dataset.mapsUrl, '_blank');
            }
        });
    }

    // --- Gallery Filter Interaction ---
    const filterBar = document.querySelector('.filter-bar');
    if (filterBar) {
        filterBar.addEventListener('click', function(event) {
            const btn = event.target.closest('.filter-btn');
            if (btn && btn.dataset.filter) {
                const category = btn.dataset.filter;
                filterBar.querySelector('.active').classList.remove('active');
                btn.classList.add('active');
                document.querySelectorAll('.work-item').forEach(item => {
                    const isVisible = (category === 'all' || item.dataset.location === category);
                    item.style.display = isVisible ? '' : 'none';
                });
            }
        });
    }

    // --- Responsive Aspect Ratio on Resize ---
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const activeLocMatch = document.querySelector('.nyc-preview-img.active')?.className.match(/nyc-([a-z]+)/);
            if (activeLocMatch) {
                setPreviewAspectRatio(activeLocMatch[1]);
            }
        }, 100);
    });
});