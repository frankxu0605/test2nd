"""Generate a beautifully redesigned dashboard preview with gold price banner."""
from PIL import Image, ImageDraw, ImageFont
import os, math

W, H = 390, 980
OUT = os.path.join(os.path.dirname(__file__), "previews")
os.makedirs(OUT, exist_ok=True)


def font(size):
    paths = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/Hiragino Sans GB.ttc",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def gradient_rect(draw, xy, color_top, color_bot, radius=16):
    """Draw a vertical gradient rounded rectangle."""
    x0, y0, x1, y1 = xy
    ct = hex2rgb(color_top)
    cb = hex2rgb(color_bot)
    for y in range(y0, y1):
        ratio = (y - y0) / max(y1 - y0, 1)
        r = int(ct[0] + (cb[0] - ct[0]) * ratio)
        g = int(ct[1] + (cb[1] - ct[1]) * ratio)
        b = int(ct[2] + (cb[2] - ct[2]) * ratio)
        draw.line([(x0 + 1, y), (x1 - 1, y)], fill=(r, g, b))
    mask = Image.new("L", (x1 - x0, y1 - y0), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, x1 - x0, y1 - y0], radius=radius, fill=255)
    region = draw._image.crop((x0, y0, x1, y1))
    bg_region = Image.new("RGB", (x1 - x0, y1 - y0), hex2rgb("#F5F7FA"))
    result = Image.composite(region, bg_region, mask)
    draw._image.paste(result, (x0, y0))


def gen_dashboard():
    img = Image.new("RGBA", (W, H), hex2rgb("#F5F7FA"))
    draw = ImageDraw.Draw(img)

    # ====== Status bar ======
    draw.rectangle([0, 0, W, 44], fill=hex2rgb("#1A1A2E"))
    fs = font(12)
    draw.text((20, 14), "9:41", fill=(255, 255, 255), font=fs)
    draw.text((W - 55, 14), "100%", fill=(255, 255, 255), font=fs)

    # ====== Top header area with gradient ======
    header_h = 200
    for y in range(44, 44 + header_h):
        ratio = (y - 44) / header_h
        r = int(22 + (30 - 22) * ratio)
        g = int(28 + (48 - 28) * ratio)
        b = int(65 + (120 - 65) * ratio)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # Decorative circles in header
    for cx, cy, rad, alpha in [(340, 80, 60, 15), (50, 200, 40, 10), (W - 30, 180, 30, 12)]:
        draw.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=(255, 255, 255, alpha))

    # App title
    ft = font(22)
    draw.text((24, 62), "贷款业务管理系统", fill=(255, 255, 255), font=ft)

    # Welcome text
    fw = font(13)
    draw.text((24, 94), "欢迎回来，管理员", fill=(200, 210, 240), font=fw)

    # User avatar circle
    ax, ay = W - 48, 78
    draw.ellipse([ax - 20, ay - 20, ax + 20, ay + 20], fill=(255, 255, 255, 40))
    draw.ellipse([ax - 17, ay - 17, ax + 17, ay + 17], fill=(100, 140, 220))
    fa = font(16)
    draw.text((ax - 8, ay - 10), "管", fill=(255, 255, 255), font=fa)

    # ====== Quick summary bar (overlapping header) ======
    bar_y = 130
    bar_h = 90
    draw.rounded_rectangle([16, bar_y, W - 16, bar_y + bar_h], radius=14, fill=(255, 255, 255))
    draw.rounded_rectangle([18, bar_y + bar_h - 2, W - 18, bar_y + bar_h + 4], radius=8, fill=(0, 0, 0, 8))

    quick_stats = [
        ("总贷款额", "¥568万", "#3366FF"),
        ("本月放款", "¥45.2万", "#00C48C"),
        ("逾期率", "1.2%", "#FF6B6B"),
    ]
    sec_w = (W - 32) // 3
    fqs_title = font(11)
    fqs_val = font(18)

    for i, (title, val, color) in enumerate(quick_stats):
        cx = 16 + sec_w * i + sec_w // 2
        if i < 2:
            lx = 16 + sec_w * (i + 1)
            draw.line([(lx, bar_y + 20), (lx, bar_y + bar_h - 20)], fill=(230, 230, 235), width=1)

        bbox = fqs_title.getbbox(title)
        tw = bbox[2] - bbox[0]
        draw.text((cx - tw // 2, bar_y + 16), title, fill=(150, 155, 170), font=fqs_title)

        bbox = fqs_val.getbbox(val)
        tw = bbox[2] - bbox[0]
        draw.text((cx - tw // 2, bar_y + 40), val, fill=hex2rgb(color), font=fqs_val)

    # ====== Gold Price Banner (NEW) ======
    gold_y = bar_y + bar_h + 16
    gold_h = 120
    # Gold gradient background
    gx0, gy0, gx1, gy1 = 16, gold_y, W - 16, gold_y + gold_h
    ct_gold = hex2rgb("#FFD700")
    cb_gold = hex2rgb("#FFA500")
    for y in range(gy0, gy1):
        ratio = (y - gy0) / max(gy1 - gy0, 1)
        r = int(ct_gold[0] + (cb_gold[0] - ct_gold[0]) * ratio)
        g = int(ct_gold[1] + (cb_gold[1] - ct_gold[1]) * ratio)
        b = int(ct_gold[2] + (cb_gold[2] - ct_gold[2]) * ratio)
        draw.line([(gx0 + 1, y), (gx1 - 1, y)], fill=(r, g, b))
    # Apply rounded corners via mask
    mask_g = Image.new("L", (gx1 - gx0, gy1 - gy0), 0)
    ImageDraw.Draw(mask_g).rounded_rectangle([0, 0, gx1 - gx0, gy1 - gy0], radius=14, fill=255)
    region_g = img.crop((gx0, gy0, gx1, gy1))
    bg_g = Image.new("RGBA", (gx1 - gx0, gy1 - gy0), hex2rgb("#F5F7FA"))
    result_g = Image.composite(region_g, bg_g, mask_g)
    img.paste(result_g, (gx0, gy0))
    draw = ImageDraw.Draw(img)

    # Decorative gold sparkle circles
    draw.ellipse([gx1 - 60, gy0 + 8, gx1 - 20, gy0 + 48], fill=(255, 255, 255, 25))
    draw.ellipse([gx1 - 45, gy0 + 55, gx1 - 15, gy0 + 85], fill=(255, 255, 255, 15))

    # Gold icon
    f_gold_icon = font(20)
    draw.text((32, gold_y + 12), "Au", fill=(120, 70, 0), font=f_gold_icon)
    # Separator dot
    draw.ellipse([58, gold_y + 18, 64, gold_y + 24], fill=(160, 100, 0, 120))

    # Title
    f_gold_title = font(13)
    draw.text((70, gold_y + 14), "今日黄金价格", fill=(100, 60, 0), font=f_gold_title)

    # Date
    f_gold_date = font(10)
    draw.text((32, gold_y + 40), "更新日期: 2026-02-18", fill=(140, 90, 0), font=f_gold_date)

    # Buy price (large)
    f_gold_buy = font(30)
    draw.text((32, gold_y + 58), "¥580.00", fill=(100, 50, 0), font=f_gold_buy)
    f_gold_unit = font(13)
    draw.text((180, gold_y + 76), "/g", fill=(130, 80, 0), font=f_gold_unit)

    # Sell price (right side)
    f_gold_sell_label = font(11)
    draw.text((W - 140, gold_y + 60), "回收价", fill=(130, 80, 0), font=f_gold_sell_label)
    f_gold_sell = font(18)
    draw.text((W - 140, gold_y + 78), "¥565.00/g", fill=(100, 50, 0), font=f_gold_sell)

    # Update button (small, at bottom-right of banner)
    btn_x0 = W - 110
    btn_y0 = gold_y + 14
    btn_x1 = W - 30
    btn_y1 = gold_y + 38
    draw.rounded_rectangle([btn_x0, btn_y0, btn_x1, btn_y1], radius=10, fill=(120, 70, 0))
    f_btn = font(11)
    bbox_btn = f_btn.getbbox("更新金价")
    btn_tw = bbox_btn[2] - bbox_btn[0]
    draw.text((btn_x0 + (btn_x1 - btn_x0 - btn_tw) // 2, btn_y0 + 4), "更新金价",
              fill=(255, 230, 150), font=f_btn)

    # ====== Section title ======
    sec_y = gold_y + gold_h + 18
    fst = font(16)
    draw.text((22, sec_y), "业务概览", fill=hex2rgb("#2D3436"), font=fst)
    draw.rounded_rectangle([22, sec_y + 26, 62, sec_y + 29], radius=2, fill=hex2rgb("#3366FF"))

    # ====== Stat cards grid (2x2) ======
    cards = [
        ("客户总数", "128", "人", "#4E6AFF", "#7B8CFF", "客"),
        ("订单总数", "256", "笔", "#00C48C", "#4DD9A8", "单"),
        ("在贷订单", "45",  "笔", "#FF9F43", "#FFB976", "贷"),
        ("逾期笔数", "3",   "笔", "#FF6B6B", "#FF9292", "逾"),
    ]

    card_w = (W - 48) // 2
    card_h = 100
    start_y = sec_y + 42
    gap = 12

    for i, (title, value, unit, c1, c2, icon) in enumerate(cards):
        col = i % 2
        row = i // 2
        x = 16 + col * (card_w + 16)
        y = start_y + row * (card_h + gap)

        gradient_rect(draw, (x, y, x + card_w, y + card_h), c1, c2, radius=14)

        ix = x + card_w - 32
        iy = y + 30
        draw.ellipse([ix - 18, iy - 18, ix + 18, iy + 18], fill=(255, 255, 255, 50))
        fi = font(14)
        bbox = fi.getbbox(icon)
        tw = bbox[2] - bbox[0]
        draw.text((ix - tw // 2, iy - 9), icon, fill=(255, 255, 255, 180), font=fi)

        ft_c = font(12)
        draw.text((x + 16, y + 14), title, fill=(255, 255, 255, 210), font=ft_c)

        fv = font(28)
        draw.text((x + 16, y + 40), value, fill=(255, 255, 255), font=fv)
        fu = font(11)
        bbox = fv.getbbox(value)
        vw = bbox[2] - bbox[0]
        draw.text((x + 18 + vw + 4, y + 56), unit, fill=(255, 255, 255, 180), font=fu)

    # ====== Second row: detail cards ======
    detail_y = start_y + 2 * (card_h + gap) + 10
    fdt = font(16)
    draw.text((22, detail_y), "资产与预约", fill=hex2rgb("#2D3436"), font=fdt)
    draw.rounded_rectangle([22, detail_y + 26, 62, detail_y + 29], radius=2, fill=hex2rgb("#00C48C"))

    detail_cards = [
        ("在库物品", "67", "件", "#6C5CE7", "#A29BFE", "库"),
        ("待处理预约", "12", "个", "#00B4D8", "#48CAE4", "约"),
    ]

    dy = detail_y + 40
    for i, (title, value, unit, c1, c2, icon) in enumerate(detail_cards):
        col = i % 2
        x = 16 + col * (card_w + 16)
        gradient_rect(draw, (x, dy, x + card_w, dy + card_h), c1, c2, radius=14)

        ix = x + card_w - 32
        iy = dy + 30
        draw.ellipse([ix - 18, iy - 18, ix + 18, iy + 18], fill=(255, 255, 255, 50))
        fi = font(14)
        bbox = fi.getbbox(icon)
        tw = bbox[2] - bbox[0]
        draw.text((ix - tw // 2, iy - 9), icon, fill=(255, 255, 255, 180), font=fi)

        ft_c = font(12)
        draw.text((x + 16, dy + 14), title, fill=(255, 255, 255, 210), font=ft_c)
        fv = font(28)
        draw.text((x + 16, dy + 40), value, fill=(255, 255, 255), font=fv)
        fu = font(11)
        bbox = fv.getbbox(value)
        vw = bbox[2] - bbox[0]
        draw.text((x + 18 + vw + 4, dy + 56), unit, fill=(255, 255, 255, 180), font=fu)

    # ====== Finance summary card ======
    fin_y = dy + card_h + 20
    fin_h = 80
    draw.rounded_rectangle([16, fin_y, W - 16, fin_y + fin_h], radius=14, fill=(255, 255, 255))
    draw.rounded_rectangle([18, fin_y + fin_h - 2, W - 18, fin_y + fin_h + 3], radius=8, fill=(0, 0, 0, 6))

    fin_items = [
        ("贷款总额", "¥5,680,000", "#3366FF"),
        ("支出总额", "¥234,500", "#FF6B6B"),
    ]
    half = (W - 32) // 2
    for i, (title, val, color) in enumerate(fin_items):
        cx = 16 + half * i + half // 2
        if i == 0:
            draw.line([(16 + half, fin_y + 16), (16 + half, fin_y + fin_h - 16)], fill=(235, 235, 240), width=1)

        fft = font(11)
        bbox = fft.getbbox(title)
        tw = bbox[2] - bbox[0]
        draw.text((cx - tw // 2, fin_y + 14), title, fill=(150, 155, 170), font=fft)

        ffv = font(17)
        bbox = ffv.getbbox(val)
        tw = bbox[2] - bbox[0]
        draw.text((cx - tw // 2, fin_y + 38), val, fill=hex2rgb(color), font=ffv)

    # ====== Bottom navigation ======
    nav_y = H - 64
    draw.rectangle([0, nav_y, W, H], fill=(255, 255, 255))
    draw.line([0, nav_y, W, nav_y], fill=(235, 235, 240), width=1)

    tabs = [
        ("首页", True),
        ("客户", False),
        ("订单", False),
        ("还款", False),
        ("更多", False),
    ]
    tab_icons = ["首", "客", "单", "还", "···"]
    tab_w = W // len(tabs)
    fn = font(10)
    fi_nav = font(13)

    for i, ((label, active), icon_t) in enumerate(zip(tabs, tab_icons)):
        cx = tab_w * i + tab_w // 2

        if active:
            draw.ellipse([cx - 22, nav_y + 6, cx + 22, nav_y + 6 + 30], fill=hex2rgb("#3366FF"))
            draw.text((cx - 7, nav_y + 10), icon_t, fill=(255, 255, 255), font=fi_nav)
            draw.text((cx - 10, nav_y + 42), label, fill=hex2rgb("#3366FF"), font=fn)
        else:
            draw.text((cx - 7, nav_y + 10), icon_t, fill=(180, 185, 195), font=fi_nav)
            bbox = fn.getbbox(label)
            tw = bbox[2] - bbox[0]
            draw.text((cx - tw // 2, nav_y + 42), label, fill=(180, 185, 195), font=fn)

    # Save
    img = img.convert("RGB")
    img.save(os.path.join(OUT, "02_dashboard.png"), quality=95)
    print("Generated: 02_dashboard.png (with gold price banner)")


if __name__ == "__main__":
    gen_dashboard()
