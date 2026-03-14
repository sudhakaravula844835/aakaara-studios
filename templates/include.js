document.addEventListener("DOMContentLoaded", async () => {
    const loadHTML = async (placeholder, url) => {
        if (!placeholder) return;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Network response was not ok for ${url}`);
            const text = await response.text();
            
            const fragment = document.createRange().createContextualFragment(text);
            placeholder.replaceWith(fragment);
        } catch (error) {
            console.error(`Failed to load ${url}:`, error);
            placeholder.innerHTML = `<p style="color:red; text-align:center; padding: 1rem;">Error: Could not load ${url.split('/').pop()}.</p>`;
        }
    };

    const headerPlaceholder = document.getElementById('header-placeholder');
    const footerPlaceholder = document.getElementById('footer-placeholder');

    // Wait for both components to be fetched before proceeding.
    await Promise.all([
        loadHTML(headerPlaceholder, 'header.html'),
        loadHTML(footerPlaceholder, 'footer.html')
    ]);

    // Now that components are loaded, dynamically load the main script.
    const mainScript = document.createElement('script');
    mainScript.src = 'script.js';
    document.body.appendChild(mainScript);
});