import os
import sys
from PIL import Image

def optimize_images(folder_path, watermark_path=None, max_width=1920, quality=80):
    print(f"Optimizing images in {folder_path}...")
    
    wm_img = None
    if watermark_path and os.path.exists(watermark_path):
        try:
            wm_img = Image.open(watermark_path).convert("RGBA")
            print(f"Loaded watermark: {watermark_path}")
        except Exception as e:
            print(f"Could not load watermark: {e}")
    else:
        print(f"Watermark not found at {watermark_path}. Skipping watermark.")

    count = 0
    saved_space = 0

    for root, dirs, files in os.walk(folder_path):
        for file in files:
            if file.lower().endswith(('.jpg', '.jpeg', '.png')):
                file_path = os.path.join(root, file)
                
                # Avoid processing the watermark itself if it's in the images tree
                if "watermark" in file_path.lower():
                    continue

                try:
                    with Image.open(file_path) as img:
                        original_size = os.path.getsize(file_path)
                        
                        # Convert to RGBA for processing
                        if img.mode != 'RGBA':
                            img = img.convert('RGBA')

                        # 1. Resize if too big
                        if img.width > max_width:
                            ratio = max_width / img.width
                            new_height = int(img.height * ratio)
                            img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
                        
                        # 2. Apply Watermark
                        if wm_img:
                            # Scale watermark to 30% of image width
                            wm_scale = (img.width * 0.30) / wm_img.width
                            wm_w = int(wm_img.width * wm_scale)
                            wm_h = int(wm_img.height * wm_scale)
                            
                            if wm_w > 10 and wm_h > 10:
                                wm_resized = wm_img.resize((wm_w, wm_h), Image.Resampling.LANCZOS)
                                
                                # Reduce opacity to 50%
                                alpha = wm_resized.split()[3]
                                alpha = alpha.point(lambda p: p * 0.50)
                                wm_resized.putalpha(alpha)
                                
                                # Position: Top Left with 5% padding
                                pad = int(img.width * 0.05)
                                x = pad
                                y = pad
                                
                                img.alpha_composite(wm_resized, (x, y))

                        # 3. Save
                        if file.lower().endswith(('.jpg', '.jpeg')):
                            img = img.convert('RGB')
                            img.save(file_path, 'JPEG', quality=quality, optimize=True)
                        else:
                            img.save(file_path, 'PNG', optimize=True)
                        
                        new_size = os.path.getsize(file_path)
                        saved = original_size - new_size
                        if saved > 0:
                            saved_space += saved
                        count += 1
                        
                except Exception as e:
                    print(f"Skipped {file}: {e}")

    print(f"\nDone! Processed {count} images.")
    print(f"Total space saved: {saved_space/1024/1024:.2f} MB")

if __name__ == "__main__":
    base_dir = os.getcwd()
    images_dir = os.path.join(base_dir, "images")
    wm_path = os.path.join(base_dir, "watermark", "aakaara-watermark-white.png")
    
    if os.path.exists(images_dir):
        optimize_images(images_dir, watermark_path=wm_path)
    else:
        print(f"Images directory not found: {images_dir}")