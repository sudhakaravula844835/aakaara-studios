#!/usr/bin/env python3
"""Generate Aakaara watermark PNGs with transparent backgrounds."""

from PIL import Image, ImageDraw, ImageFont
import math
import os

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

# Canvas dimensions (2x for retina sharpness)
W, H = 1400, 300
SCALE = 2
CW, CH = W * SCALE, H * SCALE

def draw_petal(draw, cx, cy, rotation_deg, opacity, color_rgb, scale=1.0, line_width=3):
    """Draw a single lotus petal as a series of line segments approximating bezier curves."""

    def cubic_bezier(p0, p1, p2, p3, steps=60):
        """Generate points along a cubic bezier curve."""
        pts = []
        for i in range(steps + 1):
            t = i / steps
            x = (1-t)**3*p0[0] + 3*(1-t)**2*t*p1[0] + 3*(1-t)*t**2*p2[0] + t**3*p3[0]
            y = (1-t)**3*p0[1] + 3*(1-t)**2*t*p1[1] + 3*(1-t)*t**2*p2[1] + t**3*p3[1]
            pts.append((x, y))
        return pts

    # Petal path segments (from SVG: M0,-52 C15,-52 27,-35 22,-10 C17,15 -7,22 -22,10 C-37,-2 -27,-38 -10,-50 C-6,-51.5 -3,-52 0,-52Z)
    segments = [
        ((0,-52), (15,-52), (27,-35), (22,-10)),
        ((22,-10), (17,15), (-7,22), (-22,10)),
        ((-22,10), (-37,-2), (-27,-38), (-10,-50)),
        ((-10,-50), (-6,-51.5), (-3,-52), (0,-52)),
    ]

    # Generate all points
    all_pts = []
    for seg in segments:
        all_pts.extend(cubic_bezier(*seg))

    # Apply rotation
    rad = math.radians(rotation_deg)
    cos_r, sin_r = math.cos(rad), math.sin(rad)
    rotated = [(cx + (x * cos_r - y * sin_r) * scale,
                cy + (x * sin_r + y * cos_r) * scale) for x, y in all_pts]

    # Draw as polygon outline
    alpha = int(255 * opacity)
    color_with_alpha = (*color_rgb, alpha)

    # Draw lines between consecutive points
    for i in range(len(rotated) - 1):
        draw.line([rotated[i], rotated[i+1]], fill=color_with_alpha, width=line_width)


def draw_watermark(color_rgb, filename, opacity_mult=1.0):
    """Draw the complete watermark and save as PNG."""
    img = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    s = SCALE  # shorthand

    # ── Logo Mark ──
    logo_cx = 110 * s
    logo_cy = 130 * s
    logo_scale = 0.52 * s

    # Outer ring
    ring_r = int(64 * logo_scale)
    ring_alpha = int(255 * 0.18 * opacity_mult)
    draw.ellipse(
        [logo_cx - ring_r, logo_cy - ring_r, logo_cx + ring_r, logo_cy + ring_r],
        outline=(*color_rgb, ring_alpha), width=max(1, int(0.8 * s))
    )

    # Petals
    draw_petal(draw, logo_cx, logo_cy, 0, 0.9 * opacity_mult, color_rgb, logo_scale, line_width=max(2, int(2 * s)))
    draw_petal(draw, logo_cx, logo_cy, 60, 0.55 * opacity_mult, color_rgb, logo_scale, line_width=max(2, int(2 * s)))
    draw_petal(draw, logo_cx, logo_cy, 120, 0.3 * opacity_mult, color_rgb, logo_scale, line_width=max(2, int(2 * s)))

    # Center dot
    dot_r = int(5.5 * logo_scale)
    dot_alpha = int(255 * 0.9 * opacity_mult)
    draw.ellipse(
        [logo_cx - dot_r, logo_cy - dot_r, logo_cx + dot_r, logo_cy + dot_r],
        fill=(*color_rgb, dot_alpha)
    )

    # ── Brand Name "Aakaara" ──
    text_x = 225 * s
    text_y = 120 * s

    # Try to load Cormorant Garamond, fall back to system serif
    font_size = int(48 * s)
    tag_font_size = int(9.5 * s)
    try:
        # Check common macOS font paths
        font_paths = [
            "/Users/sudhakaravula/Library/Fonts/CormorantGaramond-Light.ttf",
            "/Library/Fonts/CormorantGaramond-Light.ttf",
            "/System/Library/Fonts/Supplemental/Georgia.ttf",
            "/System/Library/Fonts/Georgia.ttf",
        ]
        font = None
        for fp in font_paths:
            if os.path.exists(fp):
                font = ImageFont.truetype(fp, font_size)
                break
        if font is None:
            font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Times New Roman.ttf", font_size)

        tag_font_paths = [
            "/Users/sudhakaravula/Library/Fonts/Outfit-Light.ttf",
            "/Library/Fonts/Outfit-Light.ttf",
            "/System/Library/Fonts/Supplemental/Helvetica Neue.ttc",
            "/System/Library/Fonts/Helvetica.ttc",
        ]
        tag_font = None
        for fp in tag_font_paths:
            if os.path.exists(fp):
                tag_font = ImageFont.truetype(fp, tag_font_size)
                break
        if tag_font is None:
            tag_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", tag_font_size)

    except Exception:
        font = ImageFont.load_default()
        tag_font = ImageFont.load_default()

    # Draw letters with manual spacing
    letters = list('Aakaara')
    letter_spacing = int(8 * s)
    x_cursor = text_x
    text_alpha = int(255 * 0.92 * opacity_mult)
    letter_positions = []

    for letter in letters:
        bbox = font.getbbox(letter)
        lw = bbox[2] - bbox[0]
        letter_positions.append({'x': x_cursor, 'w': lw})
        draw.text((x_cursor, text_y), letter, fill=(*color_rgb, text_alpha), font=font, anchor='lm')
        x_cursor += lw + letter_spacing

    # Diacritic dots — above the 2nd letter "a"
    second_a = letter_positions[1]
    dot_center_x = second_a['x'] + second_a['w'] // 2
    dot_y_pos = text_y - int(24 * s)
    dot_radius = int(2.5 * s)
    dot_gap = int(7 * s)
    dot_alpha = int(255 * 0.85 * opacity_mult)

    for dx in [-dot_gap // 2, dot_gap // 2]:
        cx = dot_center_x + dx
        draw.ellipse(
            [cx - dot_radius, dot_y_pos - dot_radius, cx + dot_radius, dot_y_pos + dot_radius],
            fill=(*color_rgb, dot_alpha)
        )

    # ── Tagline ──
    tagline = "STUDIOS  ·  NEW YORK CITY"
    tag_x = int(228 * s)
    tag_y = int(165 * s)
    tag_alpha = int(255 * 0.45 * opacity_mult)

    # Draw with letter spacing
    tag_cursor = tag_x
    tag_spacing = int(4.5 * s)
    for ch in tagline:
        if ch == ' ':
            tag_cursor += int(3 * s)
            continue
        draw.text((tag_cursor, tag_y), ch, fill=(*color_rgb, tag_alpha), font=tag_font)
        bbox = tag_font.getbbox(ch)
        tag_cursor += (bbox[2] - bbox[0]) + tag_spacing

    # ── Crop to content ──
    bbox = img.getbbox()
    if bbox:
        pad = 20 * s
        crop_box = (
            max(0, bbox[0] - pad),
            max(0, bbox[1] - pad),
            min(CW, bbox[2] + pad),
            min(CH, bbox[3] + pad),
        )
        img = img.crop(crop_box)

    # Save
    filepath = os.path.join(OUTPUT_DIR, filename)
    img.save(filepath, 'PNG', optimize=True)
    w, h = img.size
    size_kb = os.path.getsize(filepath) / 1024
    print(f"  ✓ {filename}: {w}x{h}px, {size_kb:.0f}KB")
    return filepath


if __name__ == '__main__':
    print("Generating Aakaara watermarks...\n")

    # White version (for dark/colorful photos)
    draw_watermark((255, 255, 255), 'aakaara-watermark-white.png')

    # Gold version (for light photos) — brand color #c9956b
    draw_watermark((201, 149, 107), 'aakaara-watermark-gold.png')

    # Semi-transparent white (for direct overlay without Lightroom opacity)
    draw_watermark((255, 255, 255), 'aakaara-watermark-white-50.png', opacity_mult=0.5)

    print(f"\nSaved to: {OUTPUT_DIR}/")
    print("Use in Lightroom: Edit → Watermark → Graphic → choose PNG")
