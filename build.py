import os
import shutil
import re
from datetime import datetime

import csscompressor
import jsmin

# Import the image optimization function from the other script
from optimize_images import optimize_images

# --- Configuration ---
SRC_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(SRC_DIR, 'dist')
SITE_URL = 'https://www.aakaarastudiosnyc.com' # Your production domain

# --- Sitemap Generation Function ---
def generate_sitemap(dist_dir, site_url):
    """
    Generates a sitemap.xml file from the .html files in the dist directory.
    """
    pages = []
    for root, _, files in os.walk(dist_dir):
        for name in files:
            if name.endswith('.html'):
                # Create a relative path from the dist_dir
                page_path = os.path.relpath(os.path.join(root, name), dist_dir)
                # Handle index.html for the root URL
                if name == 'index.html':
                    page_path = ''
                pages.append(page_path.replace('\\', '/'))

    # Get current date for lastmod
    lastmod_date = datetime.now().strftime('%Y-%m-%d')

    xml_content = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml_content += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

    for page in sorted(pages):
        priority = '1.0' if page == '' else '0.8'
        xml_content += '  <url>\n'
        xml_content += f'    <loc>{site_url}/{page}</loc>\n'
        xml_content += f'    <lastmod>{lastmod_date}</lastmod>\n'
        xml_content += f'    <priority>{priority}</priority>\n'
        xml_content += '  </url>\n'

    xml_content += '</urlset>'

    with open(os.path.join(dist_dir, 'sitemap.xml'), 'w', encoding='utf-8') as f:
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
    with open(os.path.join(dist_dir, 'robots.txt'), 'w', encoding='utf-8') as f:
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
    archive_path_base = os.path.join(src_dir, archive_name)
    
    print(f"\n📦 Creating deployment archive...")
    try:
        final_archive_path = shutil.make_archive(archive_path_base, 'zip', root_dir=dist_dir)
        print(f"✅ Archive created: {os.path.basename(final_archive_path)}")
    except Exception as e:
        print(f"   - ⚠️  Could not create archive: {e}")

# --- Main Build Function ---
def build():
    """
    Creates a production-ready build in the 'dist' directory.
    - Optimizes images in the build output.
    - Inlines header.html and footer.html into pages that use placeholders.
    - Copies all other necessary assets.
    """
    print("🚀 Starting production build...")

    # 1. Create/clean the dist directory
    if os.path.exists(DIST_DIR):
        shutil.rmtree(DIST_DIR)
    os.makedirs(DIST_DIR)
    print(f"✅ Created clean build directory: {DIST_DIR}")

    # 2. Read HTML partials into memory
    try:
        with open(os.path.join(SRC_DIR, 'header.html'), 'r', encoding='utf-8') as f:
            header_content = f.read()
        with open(os.path.join(SRC_DIR, 'footer.html'), 'r', encoding='utf-8') as f:
            footer_content = f.read()
        print("✅ Read header and footer partials.")
    except FileNotFoundError:
        print("⚠️ Warning: header.html or footer.html not found. Skipping inlining.")
        header_content = None
        footer_content = None

    # 3. Walk through the source directory and process/copy files
    for root, dirs, files in os.walk(SRC_DIR):
        # Skip the build directory itself and any hidden/system directories
        dirs[:] = [d for d in dirs if d not in ['dist', '.git', '__pycache__', '.vscode']]
        
        for name in files:
            src_path = os.path.join(root, name)
            rel_path = os.path.relpath(src_path, SRC_DIR)
            dest_path = os.path.join(DIST_DIR, rel_path)
            
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)

            # --- HTML File Processing ---
            if name.endswith('.html') and name not in ['header.html', 'footer.html']:
                with open(src_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                original_content = content
                
                if header_content and '<div id="header-placeholder"></div>' in content:
                    content = content.replace('<div id="header-placeholder"></div>', header_content)
                if footer_content and '<div id="footer-placeholder"></div>' in content:
                    content = content.replace('<div id="footer-placeholder"></div>', footer_content)
                
                if content != original_content:
                    content = re.sub(r'<script\s+src="include\.js"></script>', '<script src="Script.js"></script>', content)
                    print(f"📦 Inlined partials for: {name}")
                
                with open(dest_path, 'w', encoding='utf-8') as f:
                    f.write(content)

            # --- Static File Copying ---
            elif not name.endswith(('.py', '.pyc')) and name not in ['header.html', 'footer.html', 'include.js']:
                shutil.copy2(src_path, dest_path)

    # 4. Run image optimization on the copied images in the dist folder
    dist_images_dir = os.path.join(DIST_DIR, 'images')
    if os.path.exists(dist_images_dir):
        print("\n🖼️  Running image optimization on build output...")
        # This function is imported from optimize_images.py
        optimize_images(dist_images_dir)
    else:
        print("\n🟡 Image directory not found in build output, skipping optimization.")

    # 5. Minify CSS and JS files in the dist folder
    print("\n🗜️  Minifying CSS and JavaScript...")
    total_css_saved = 0
    total_js_saved = 0
    for root, _, files in os.walk(DIST_DIR):
        for name in files:
            if not (name.endswith('.css') or name.endswith('.js')) or '.min.' in name:
                continue

            file_path = os.path.join(root, name)
            try:
                with open(file_path, 'r+', encoding='utf-8') as f:
                    original_content = f.read()
                    original_size = len(original_content)
                    
                    if name.endswith('.css'):
                        minified_content = csscompressor.compress(original_content)
                        total_css_saved += original_size - len(minified_content)
                        print(f"   - Minified {name} (saved {(original_size - len(minified_content))/1024:.2f} KB)")
                    elif name.endswith('.js'):
                        minified_content = jsmin.jsmin(original_content)
                        total_js_saved += original_size - len(minified_content)
                        print(f"   - Minified {name} (saved {(original_size - len(minified_content))/1024:.2f} KB)")

                    f.seek(0)
                    f.write(minified_content)
                    f.truncate()
            except Exception as e:
                print(f"   - ⚠️ Could not minify {name}: {e}")

    print(f"   Total CSS space saved: {total_css_saved/1024:.2f} KB")
    print(f"   Total JS space saved: {total_js_saved/1024:.2f} KB")

    # 6. Generate sitemap.xml
    print("\n🗺️  Generating sitemap...")
    generate_sitemap(DIST_DIR, SITE_URL)

    # 7. Generate robots.txt
    print("\n🤖 Generating robots.txt...")
    generate_robots_txt(DIST_DIR, SITE_URL)

    # 8. Create a zip archive for deployment
    create_archive(DIST_DIR, SRC_DIR)

    print("\n🎉 Build complete!")
    print("   - Your production-ready site is in the 'dist' folder.")
    print("   - A deployment-ready .zip file has also been created in the project's root directory.")

if __name__ == "__main__":
    build()