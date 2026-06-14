import os
import sys
from PIL import Image

def generate_pwa_icons(source_image_path, output_dir):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"Created directory: {output_dir}")

    # Load source image
    try:
        img = Image.open(source_image_path)
        print(f"Loaded source image: {source_image_path} ({img.size})")
    except Exception as e:
        print(f"Error loading source image: {e}")
        sys.exit(1)

    # 1. Generate standard 192x192 and 512x512 icons
    sizes = [192, 512]
    for size in sizes:
        dest_path = os.path.join(output_dir, f"pwa-{size}x{size}.png")
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(dest_path, "PNG")
        print(f"Generated standard icon: {dest_path}")

    # 2. Generate maskable 512x512 icon (usually has ~15% padding around the safe area)
    # The logo should be placed within the inner 70% of the canvas.
    maskable_size = 512
    maskable_logo_size = int(maskable_size * 0.7)  # 358x358 logo
    
    # Resize original image to the inner logo size
    inner_logo = img.resize((maskable_logo_size, maskable_logo_size), Image.Resampling.LANCZOS)
    
    # Create background image of size 512x512 with background color #131313 (R=19, G=19, B=19)
    bg_color = (19, 19, 19)
    maskable_img = Image.new("RGB", (maskable_size, maskable_size), bg_color)
    
    # Paste inner logo onto the center of the background
    offset = (maskable_size - maskable_logo_size) // 2
    maskable_img.paste(inner_logo, (offset, offset))
    
    maskable_path = os.path.join(output_dir, "maskable-icon.png")
    maskable_img.save(maskable_path, "PNG")
    print(f"Generated maskable icon: {maskable_path}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python pwa_generator.py <source_image_path> <output_dir>")
        sys.exit(1)
    
    generate_pwa_icons(sys.argv[1], sys.argv[2])
