import os
import shutil
import re
from datetime import datetime
from pathlib import Path

import csscompressor
import jsmin

# Import the image optimization function from the other script
from optimize_images import optimize_images # Assuming this script exists

# --- Configuration ---
SRC_DIR = Path(__file__).parent
DIST_DIR = SRC_DIR / 'dist'
SITE_URL = 'https://www.aakaarastudiosnyc.com' # Your production domain
GA_MEASUREMENT_ID = 'G-XXXXXXXXXX' # <-- REPLACE WITH YOUR GOOGLE ANALYTICS ID

# --- Analytics Injection Function ---
def inject_analytics(html_content, measurement_id):
    """
    Injects a performance-optimized, delayed Google Analytics snippet.
    """
    if not measurement_id or measurement_id == 'G-XXXXXXXXXX':
        return html_content # Don't inject if the placeholder ID is still there

    # This script delays loading GA until the first user interaction or a timeout.
    analytics_snippet = f"""
<script>
  function loadAnalytics() {{
    if (window.gaLoaded) return;
    window.gaLoaded = true;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id={measurement_id}';
    document.head.appendChild(script);
    window.dataLayer = window.dataLayer || [];
    function gtag(){{dataLayer.push(arguments);}}
    gtag('js', new Date());
    gtag('config', '{measurement_id}');
    ['scroll', 'mousemove', 'touchstart'].forEach(e => window.removeEventListener(e, loadAnalytics));
  }}
  setTimeout(loadAnalytics, 3000);
  ['scroll', 'mousemove', 'touchstart'].forEach(e => window.addEventListener(e, loadAnalytics, {{ once: true, passive: true }}));
</script>
"""
    # Insert the snippet right before the closing </body> tag
    return html_content.replace('</body>', f'{analytics_snippet}</body>')

# --- Sitemap Generation Function ---
def generate_sitemap(dist_dir, site_url):
    """
    Generates a sitemap.xml file from the .html files in the dist directory.
    """
    pages = []
    for html_file in Path(dist_dir).rglob('*.html'):
        # Get path relative to the dist directory
        page_path = html_file.relative_to(dist_dir).as_posix()

        # If it's an index file, represent it as its directory URL
        # e.g., 'about/index.html' -> 'about/', and 'index.html' -> ''
        if html_file.name == 'index.html':
            page_path = page_path[:-10]

        pages.append(page_path)

    # Get current date for lastmod
    lastmod_date = datetime.now().strftime('%Y-%m-%d')

    xml_content = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml_content += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

    for page in sorted(pages):
        priority = '1.0' if page == '' else '0.8' # Root page gets highest priority
        xml_content += '  <url>\n'
        xml_content += f'    <loc>{site_url}/{page}</loc>\n'
        xml_content += f'    <lastmod>{lastmod_date}</lastmod>\n'
        xml_content += f'    <priority>{priority}</priority>\n'
        xml_content += '  </url>\n'

    xml_content += '</urlset>'

    with open(dist_dir / 'sitemap.xml', 'w', encoding='utf-8') as f:
        f.write(xml_content)
    print(f"✅ Generated sitemap.xml with {len(pages)} pages.")

# --- Robots.txt Generation Function ---
def generate_robots_txt(dist_dir, site_url):
    """
    Generates a robots.txt file to guide search engine crawlers.
    """
    # Disallow crawling of internal/utility pages
    content = (
        "User-agent: *\n"
        "Disallow: /quote-generator.html\n"
        "Disallow: /dashboard.html\n"
        "Allow: /\n\n"
        f"Sitemap: {site_url}/sitemap.xml\n"
    )
    with open(dist_dir / 'robots.txt', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Generated robots.txt")

# --- Archive Generation Function ---
def create_archive(dist_dir, src_dir):
    """
    Creates a zip archive of the dist directory for easy deployment.
    """
    now = datetime.now().strftime('%Y-%m-%d')
    archive_name = f"aakaara-site-build-{now}"
    # Place the archive in the root project directory, not inside 'dist'
    archive_path_base = src_dir / archive_name
    
    print(f"\n📦 Creating deployment archive...")
    try:
        final_archive_path = shutil.make_archive(archive_path_base, 'zip', root_dir=dist_dir)
        print(f"✅ Archive created: {Path(final_archive_path).name}")
    except Exception as e:
        print(f"   - ⚠️  Could not create archive: {e}")

# --- Main Build Function ---
def build():
    """
    Creates a production-ready build in the 'dist' directory.
    - Inlines partials, minifies assets, optimizes images, and generates SEO files.
    """
    print("🚀 Starting production build...")

    # 1. Create/clean the dist directory
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    DIST_DIR.mkdir()
    print(f"✅ Created clean build directory: {DIST_DIR}")

    # 2. Read HTML partials into memory
    try:
        header_content = (SRC_DIR / 'header.html').read_text(encoding='utf-8')
        footer_content = (SRC_DIR / 'footer.html').read_text(encoding='utf-8')
        print("✅ Read header and footer partials.")
    except FileNotFoundError:
        print("⚠️ Warning: header.html or footer.html not found. Skipping inlining.")
        header_content = None
        footer_content = None

    # 3. Process and copy all source files in a single pass
    print("\n🗜️  Processing, minifying, and copying assets...")
    total_css_saved = 0
    total_js_saved = 0
    excluded_dirs = {'.git', '__pycache__', '.vscode', 'dist'}
    excluded_files = {'build.py', 'optimize_images.py', 'header.html', 'footer.html', 'include.js', '.DS_Store', 'requirements.txt'}

    for src_path in SRC_DIR.rglob('*'):
        if src_path.is_dir():
            continue
        if any(part in excluded_dirs for part in src_path.parts):
            continue
        if src_path.name in excluded_files:
            continue

        rel_path = src_path.relative_to(SRC_DIR)
        dest_path = DIST_DIR / rel_path
        dest_path.parent.mkdir(parents=True, exist_ok=True)

        # --- HTML File Processing ---
        if src_path.suffix == '.html':
            content = src_path.read_text(encoding='utf-8')
            original_content = content

            if header_content and '<div id="header-placeholder"></div>' in content:
                content = content.replace('<div id="header-placeholder"></div>', header_content)
            if footer_content and '<div id="footer-placeholder"></div>' in content:
                content = content.replace('<div id="footer-placeholder"></div>', footer_content)

            if content != original_content:
                content = re.sub(r'<script\s+src="include\.js"></script>', '<script src="script.js"></script>', content)
                print(f"   - Inlined partials for: {src_path.name}")

            content = inject_analytics(content, GA_MEASUREMENT_ID)
            dest_path.write_text(content, encoding='utf-8')

        # --- CSS Minification ---
        elif src_path.suffix == '.css' and '.min.' not in src_path.name:
            original_content = src_path.read_text(encoding='utf-8')
            minified_content = csscompressor.compress(original_content)
            dest_path.write_text(minified_content, encoding='utf-8')
            saved = len(original_content) - len(minified_content)
            total_css_saved += saved
            print(f"   - Minified {src_path.name} (saved {saved/1024:.2f} KB)")

        # --- JS Minification ---
        elif src_path.suffix == '.js' and '.min.' not in src_path.name:
            original_content = src_path.read_text(encoding='utf-8')
            minified_content = jsmin.jsmin(original_content)
            dest_path.write_text(minified_content, encoding='utf-8')
            saved = len(original_content) - len(minified_content)
            total_js_saved += saved
            print(f"   - Minified {src_path.name} (saved {saved/1024:.2f} KB)")

        # --- Static File Copying (images, fonts, etc.) ---
        else:
            shutil.copy2(src_path, dest_path)

    print(f"   Total CSS space saved: {total_css_saved/1024:.2f} KB")
    print(f"   Total JS space saved: {total_js_saved/1024:.2f} KB")

    # 4. Run image optimization on the copied images in the dist folder
    dist_images_dir = DIST_DIR / 'images'
    if dist_images_dir.exists():
        print("\n🖼️  Running image optimization on build output...")
        # This function is imported from optimize_images.py
        optimize_images(dist_images_dir)
    else:
        print("\n🟡 Image directory not found in build output, skipping optimization.")

    # 5. Generate sitemap.xml
    print("\n🗺️  Generating sitemap...")
    generate_sitemap(DIST_DIR, SITE_URL)

    # 6. Generate robots.txt
    print("\n🤖 Generating robots.txt...")
    generate_robots_txt(DIST_DIR, SITE_URL)

    # 7. Create a zip archive for deployment
    create_archive(DIST_DIR, SRC_DIR)

    print("\n🎉 Build complete!")
    print("   - Your production-ready site is in the 'dist' folder.")
    print("   - A deployment-ready .zip file has also been created in the project's root directory.")

if __name__ == "__main__":
    build()