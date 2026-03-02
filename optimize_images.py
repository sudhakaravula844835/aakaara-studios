import os
import sys
from PIL import Image

def optimize_images(folder_path, max_width=1920, quality=80):
    print(f"Optimizing images in {folder_path}...")

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
                        
                        # 1. Resize if too big
                        if img.width > max_width:
                            ratio = max_width / img.width
                            new_height = int(img.height * ratio)
                            img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
                        
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
    
    if os.path.exists(images_dir):
        optimize_images(images_dir)
    else:
        print(f"Images directory not found: {images_dir}")