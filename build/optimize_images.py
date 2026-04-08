import os
import sys
import shutil
from pathlib import Path
from PIL import Image
 
def optimize_images(folder_path, backup_dir=None, max_width=1920, quality=75, webp_quality=80, watermark_path=None, watermark_opacity=0.15):
    folder_path = Path(folder_path)
    print(f"Optimizing images in {folder_path} (Max Width: {max_width}px, Quality: {quality}%)...")
 
    if backup_dir:
        backup_dir = Path(backup_dir)
        if backup_dir.exists():
            print(f"⚠️  Backup directory already exists, skipping backup: {backup_dir.name}")
        else:
            print(f"Backing up original images to: {backup_dir.name} ...")
            shutil.copytree(folder_path, backup_dir)
            print(f"✅ Backup complete: {backup_dir.name}")

    watermark = None
    if watermark_path and Path(watermark_path).exists():
        watermark = Image.open(watermark_path).convert("RGBA")
 
    count = 0
    saved_space = 0

    for root, dirs, files in os.walk(folder_path):
        for file in files:
            if file.lower().endswith(('.jpg', '.jpeg', '.png')) and not file.lower().startswith('._'):
                file_path = Path(root) / file
 
                # Avoid processing the watermark itself if it's in the images tree
                if "watermark" in str(file_path).lower():
                    continue

                # Print progress on a single line
                print(f"   - Processing: {file.ljust(40)}", end='\r')
                try:
                    with Image.open(file_path) as img:
                        original_size = file_path.stat().st_size
                        img = img.convert("RGBA") # Convert to RGBA to handle transparency
 
                        # 1. Resize if too big
                        if img.width > max_width:
                            ratio = max_width / img.width
                            new_height = int(img.height * ratio)
                            img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
 
                        # 2. Apply watermark (optional)
                        # if watermark:
                        #     # Example: tile watermark
                        #     # This is a simple implementation; a more robust one would handle scaling and positioning better.
                        #     base_image = img.copy()
                        #     watermark_resized = watermark.resize((img.width // 4, int(watermark.height * (img.width / 4 / watermark.width))), Image.Resampling.LANCZOS)
                        #     
                        #     # Adjust opacity
                        #     alpha = watermark_resized.split()[3]
                        #     alpha = alpha.point(lambda p: p * watermark_opacity)
                        #     watermark_resized.putalpha(alpha)
                        # 
                        #     base_image.paste(watermark_resized, (20, 20), watermark_resized)
                        #     img = base_image
 
                        # 3. Save
                        if file.lower().endswith(('.jpg', '.jpeg')):
                            img = img.convert('RGB')
                            img.save(file_path, 'JPEG', quality=quality, optimize=True, progressive=True)
                            # Save WebP version
                            img.save(file_path.with_suffix('.webp'), 'WEBP', quality=webp_quality)
                        else:
                            img.save(file_path, 'PNG', optimize=True)
                            # Save WebP version for PNGs (maintains transparency)
                            img.save(file_path.with_suffix('.webp'), 'WEBP', quality=webp_quality)
                        
                        new_size = file_path.stat().st_size
                        saved = original_size - new_size
                        if saved > 0:
                            saved_space += saved
                        count += 1
 
                except Exception as e:
                    # Print error on a new line to not interfere with progress line
                    print(f"\n   - ⚠️  Skipped {file}: {e}")

    print(" " * 80, end='\r') # Clear the progress line before printing final summary
    print(f"\nDone! Processed {count} images.")
    print(f"Total space saved: {saved_space/1024/1024:.2f} MB")
 
if __name__ == "__main__":
    SRC_DIR = Path(__file__).parent.parent
    images_dir = SRC_DIR / "images"
    backup_dir = SRC_DIR / "images_original_backup"
 
    if images_dir.exists():
        print("="*50)
        print("⚠️  This script will PERMANENTLY optimize images in-place")
        print(f"    within your source '{images_dir.name}' directory.")
        print("    It will also generate .webp versions for each image.")
        print("="*50)
        
        try:
            confirm = input(f"A backup of your original files will be saved to '{backup_dir.name}'.\nDo you want to proceed? (y/n): ")
            if confirm.lower().strip() == 'y':
                optimize_images(images_dir, backup_dir=backup_dir)
            else:
                print("Operation cancelled by user.")
        except KeyboardInterrupt:
            print("\nOperation cancelled by user.")
            sys.exit(0)
    else:
        print(f"Source images directory not found: {images_dir}")