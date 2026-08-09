import os
import math
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# Define directories and images to generate
images_info = [
    # Banners
    ("images/banners/collection-banner.jpg", (1200, 675), "collection_banner", "Collection Banner"),
    
    # Tops
    ("images/tops/top-01.jpg", (600, 750), "top_cream_floral", "Cream Floral Cotton Top"),
    ("images/tops/top-02.jpg", (600, 750), "top_terracotta", "Terracotta Long-Sleeve Top"),
    ("images/tops/top-03.jpg", (600, 750), "top_embroidered", "Traditional Embroidered Top"),
    ("images/tops/top-04.jpg", (600, 750), "top_minimal_linen", "Minimal Linen Top"),

    # Kurtis
    ("images/kurtis/kurti-01.jpg", (600, 750), "kurti_floral", "Floral Kurti with Embroidery"),
    ("images/kurtis/kurti-02.jpg", (600, 750), "kurti_beige", "Light Beige Cotton Kurti"),
    ("images/kurtis/kurti-03.jpg", (600, 750), "kurti_terracotta", "Traditional Terracotta Kurti"),
    ("images/kurtis/kurti-04.jpg", (600, 750), "kurti_minimal", "Modern Minimalist Kurti"),

    # Sarees
    ("images/sarees/saree-01.jpg", (600, 750), "saree_silk", "Traditional Silk Saree"),
    ("images/sarees/saree-02.jpg", (600, 750), "saree_printed", "Printed Festive Saree"),
    ("images/sarees/saree-03.jpg", (600, 750), "saree_cotton", "Elegant Cotton Saree"),
    ("images/sarees/saree-04.jpg", (600, 750), "saree_party", "Premium Party-Wear Saree"),

    # Accessories
    ("images/accessories/accessory-01.jpg", (600, 750), "accessory_handbag", "Premium Handbag"),
    ("images/accessories/accessory-02.jpg", (600, 750), "accessory_jewellery", "Elegant Jewellery Collection"),
]

def draw_background(width, height, color1, color2):
    img = Image.new("RGB", (width, height), color1)
    draw = ImageDraw.Draw(img)
    # Radial or linear studio gradient
    for y in range(height):
        r = int(color1[0] + (color2[0] - color1[0]) * (y / height))
        g = int(color1[1] + (color2[1] - color1[1]) * (y / height))
        b = int(color1[2] + (color2[2] - color1[2]) * (y / height))
        draw.line([(0, y), (width, y)], fill=(r, g, b))
    
    # Add subtle studio light vignette/glow in center
    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    center_x, center_y = width // 2, height // 3
    max_radius = max(width, height) * 0.7
    for r_idx in range(int(max_radius), 0, -15):
        alpha = int(25 * (1 - r_idx / max_radius))
        glow_draw.ellipse(
            [center_x - r_idx, center_y - r_idx, center_x + r_idx, center_y + r_idx],
            fill=(255, 250, 245, alpha)
        )
    img.paste(glow, (0, 0), glow)
    return img

def add_shadow(img, shape_poly, color=(40, 25, 20, 70), blur=20, offset=(0, 25)):
    w, h = img.size
    shadow_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow_img)
    offset_poly = [(x + offset[0], y + offset[1]) for x, y in shape_poly]
    draw.polygon(offset_poly, fill=color)
    shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(blur))
    img.paste(shadow_img, (0, 0), shadow_img)

def render_item(item_type, size, title):
    w, h = size
    # Base palette
    cream = (247, 239, 229)
    soft_beige = (234, 215, 192)
    terracotta = (180, 95, 77)
    deep_terracotta = (140, 61, 61)
    dark_brown = (45, 41, 38)
    gold = (212, 175, 55)
    rose_beige = (225, 195, 180)
    white = (255, 253, 250)

    # 1. Background
    bg = draw_background(w, h, cream, soft_beige)

    # 2. Studio pedestal / stand
    pedestal_poly = [(w*0.15, h*0.82), (w*0.85, h*0.82), (w*0.78, h*0.95), (w*0.22, h*0.95)]
    add_shadow(bg, pedestal_poly, color=(40, 30, 25, 60), blur=15, offset=(0, 15))
    
    draw = ImageDraw.Draw(bg)
    draw.polygon(pedestal_poly, fill=rose_beige)
    draw.line([(w*0.15, h*0.82), (w*0.85, h*0.82)], fill=white, width=3)

    # 3. Main Subject rendering based on item_type
    cx, cy = w // 2, int(h * 0.42)

    if "collection_banner" in item_type:
        # Luxury layout with folded fabrics, jewellery box, handbag
        # Fabric 1 (Saree fold)
        f1_poly = [(150, 250), (450, 220), (480, 520), (120, 550)]
        add_shadow(bg, f1_poly, blur=25)
        draw.polygon(f1_poly, fill=terracotta)
        # Gold embroidery lines on fabric
        for i in range(5):
            draw.line([(180 + i*60, 240), (150 + i*60, 540)], fill=gold, width=4)
        
        # Fabric 2 (Silk beige)
        f2_poly = [(420, 280), (750, 230), (790, 480), (460, 530)]
        add_shadow(bg, f2_poly, blur=25)
        draw.polygon(f2_poly, fill=cream)
        for i in range(6):
            draw.line([(440, 300 + i*35), (770, 250 + i*35)], fill=rose_beige, width=3)
        
        # Handbag
        hb_poly = [(750, 320), (1020, 300), (1050, 520), (720, 540)]
        add_shadow(bg, hb_poly, blur=30)
        draw.polygon(hb_poly, fill=deep_terracotta)
        draw.arc([820, 220, 950, 340], 180, 0, fill=gold, width=6)

        # Jewellery display
        draw.ellipse([500, 420, 680, 540], fill=white, outline=gold, width=3)
        draw.ellipse([540, 450, 640, 510], outline=gold, width=4)

    elif "top" in item_type:
        # Mannequin or elegant top outline
        # Main body shape of top
        top_poly = [
            (cx - 110, cy - 140), (cx + 110, cy - 140),
            (cx + 170, cy - 40),  (cx + 130, cy + 180),
            (cx - 130, cy + 180), (cx - 170, cy - 40)
        ]
        add_shadow(bg, top_poly, blur=25, offset=(0, 20))
        
        main_color = cream if "cream" in item_type or "linen" in item_type else terracotta
        if "embroidered" in item_type:
            main_color = deep_terracotta

        draw.polygon(top_poly, fill=main_color)
        
        # Sleeves
        s_left = [(cx - 110, cy - 140), (cx - 210, cy + 40), (cx - 160, cy + 80), (cx - 110, cy - 20)]
        s_right = [(cx + 110, cy - 140), (cx + 210, cy + 40), (cx + 160, cy + 80), (cx + 110, cy - 20)]
        draw.polygon(s_left, fill=main_color)
        draw.polygon(s_right, fill=main_color)

        # Neckline & Accents
        draw.ellipse([cx - 45, cy - 160, cx + 45, cy - 100], fill=soft_beige)

        if "floral" in item_type:
            # Subtle floral prints
            for fx, fy in [(cx-50, cy-30), (cx+40, cy+50), (cx-30, cy+100), (cx+50, cy-50)]:
                draw.ellipse([fx-18, fy-18, fx+18, fy+18], fill=rose_beige)
                draw.ellipse([fx-8, fy-8, fx+8, fy+8], fill=terracotta)
        elif "embroidered" in item_type:
            # Gold embroidery down center
            draw.rectangle([cx - 12, cy - 100, cx + 12, cy + 160], fill=gold)
            for ey in range(cy - 80, cy + 150, 30):
                draw.line([(cx - 35, ey), (cx + 35, ey)], fill=gold, width=3)
        elif "terracotta" in item_type:
            # Button accents
            for by in range(cy - 80, cy + 120, 45):
                draw.ellipse([cx - 6, by - 6, cx + 6, by + 6], fill=cream)

    elif "kurti" in item_type:
        # Long kurti silhouette
        kurti_poly = [
            (cx - 95, cy - 160), (cx + 95, cy - 160),
            (cx + 165, cy + 240), (cx - 165, cy + 240)
        ]
        add_shadow(bg, kurti_poly, blur=25, offset=(0, 25))

        k_color = terracotta if "terracotta" in item_type else (cream if "beige" in item_type else rose_beige)
        if "minimal" in item_type:
            k_color = soft_beige

        draw.polygon(kurti_poly, fill=k_color)

        # Neckline slit
        draw.polygon([(cx - 35, cy - 160), (cx + 35, cy - 160), (cx, cy - 80)], fill=dark_brown)
        
        # Borders & Embroidery
        if "floral" in item_type or "embroidered" in item_type:
            draw.rectangle([cx - 25, cy - 80, cx + 25, cy + 200], fill=gold)
            draw.rectangle([cx - 165, cy + 210, cx + 165, cy + 240], fill=terracotta)
        else:
            draw.rectangle([cx - 165, cy + 220, cx + 165, cy + 240], fill=deep_terracotta)

    elif "saree" in item_type:
        # Pleated Saree on mannequin drape
        saree_poly = [
            (cx - 100, cy - 170), (cx + 100, cy - 170),
            (cx + 180, cy + 250), (cx - 180, cy + 250)
        ]
        add_shadow(bg, saree_poly, blur=30)
        
        s_color = deep_terracotta if "silk" in item_type or "party" in item_type else (terracotta if "printed" in item_type else soft_beige)
        draw.polygon(saree_poly, fill=s_color)

        # Pallu drape across chest
        pallu_poly = [(cx - 100, cy - 170), (cx + 120, cy - 120), (cx - 140, cy + 250), (cx - 180, cy + 250)]
        draw.polygon(pallu_poly, fill=cream if "silk" in item_type else gold)

        # Gold zari border
        draw.line([(cx - 180, cy + 235), (cx + 180, cy + 235)], fill=gold, width=12)
        draw.line([(cx - 180, cy + 248), (cx + 180, cy + 248)], fill=white, width=4)

        if "printed" in item_type:
            for py in range(cy - 100, cy + 200, 50):
                draw.ellipse([cx + 30, py, cx + 70, py + 30], fill=rose_beige)

    elif "accessory" in item_type:
        if "handbag" in item_type:
            # Luxury handbag shape
            bag_poly = [(cx - 130, cy - 40), (cx + 130, cy - 40), (cx + 160, cy + 160), (cx - 160, cy + 160)]
            add_shadow(bg, bag_poly, blur=30, offset=(0, 30))
            draw.polygon(bag_poly, fill=terracotta)

            # Flap
            draw.polygon([(cx - 130, cy - 40), (cx + 130, cy - 40), (cx, cy + 60)], fill=deep_terracotta)
            # Gold lock
            draw.ellipse([cx - 20, cy + 40, cx + 20, cy + 80], fill=gold)

            # Handle
            draw.arc([cx - 90, cy - 150, cx + 90, cy - 20], 180, 0, fill=gold, width=8)

        elif "jewellery" in item_type:
            # Royal necklace & earrings display
            bust_poly = [(cx - 100, cy - 40), (cx + 100, cy - 40), (cx + 140, cy + 200), (cx - 140, cy + 200)]
            add_shadow(bg, bust_poly, blur=25)
            draw.polygon(bust_poly, fill=dark_brown)

            # Gold & pearl necklace
            draw.arc([cx - 80, cy - 30, cx + 80, cy + 90], 0, 180, fill=gold, width=6)
            for angle in range(20, 165, 20):
                rad = math.radians(angle)
                nx = cx + int(70 * math.cos(rad))
                ny = cy + 30 + int(60 * math.sin(rad))
                draw.ellipse([nx - 8, ny - 8, nx + 8, ny + 8], fill=cream, outline=gold, width=2)
            
            # Earrings
            for ex in [cx - 110, cx + 110]:
                draw.line([(ex, cy - 90), (ex, cy - 30)], fill=gold, width=3)
                draw.ellipse([ex - 12, cy - 30, ex + 12, cy - 6], fill=terracotta, outline=gold, width=2)

    # Convert image to RGB and return
    return bg.convert("RGB")

print("Starting image generation...")
for rel_path, size, item_type, title in images_info:
    # Skip hero banner as it was already generated via tool
    if rel_path == "images/banners/hero-banner.jpg":
        continue
    
    full_path = os.path.join("c:\\RJ Ladies Fashion", rel_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    
    img = render_item(item_type, size, title)
    img.save(full_path, "JPEG", quality=92)
    print(f"Generated: {rel_path}")

print("All images generated successfully.")
