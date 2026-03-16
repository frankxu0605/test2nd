"""Generate web client preview image."""
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1200, 780
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


def gradient_v(draw, xy, c_top, c_bot):
    x0, y0, x1, y1 = xy
    ct, cb = hex2rgb(c_top), hex2rgb(c_bot)
    for y in range(y0, y1):
        r = (y - y0) / max(y1 - y0, 1)
        c = tuple(int(ct[i] + (cb[i] - ct[i]) * r) for i in range(3))
        draw.line([(x0, y), (x1, y)], fill=c)


def gen():
    img = Image.new("RGB", (W, H), hex2rgb("#f0f2f5"))
    draw = ImageDraw.Draw(img)

    # ===== Sidebar =====
    sw = 220
    gradient_v(draw, (0, 0, sw, H), "#1a1a2e", "#16213e")

    # Sidebar logo
    draw.ellipse([18, 18, 52, 52], fill=hex2rgb("#ffd700"))
    draw.text((26, 24), "Au", fill=(255, 255, 255), font=font(14))
    draw.text((62, 26), "贷款管理", fill=(255, 255, 255), font=font(16))

    # Sidebar nav items
    nav_items = [
        ("📊", "首页", True),
        ("👥", "客户管理", False),
        ("📋", "订单管理", False),
        ("💰", "还款计划", False),
        ("📦", "入库管理", False),
        ("🏷", "库存管理", False),
        ("📅", "预约管理", False),
        ("💸", "支出明细", False),
    ]
    ny = 76
    fn = font(13)
    for icon, label, active in nav_items:
        if active:
            draw.rounded_rectangle([8, ny, sw - 8, ny + 38], radius=8, fill=(51, 102, 255, 90))
            draw.text((44, ny + 9), label, fill=(255, 255, 255), font=fn)
        else:
            draw.text((44, ny + 9), label, fill=(200, 205, 220), font=fn)
        ny += 42

    # User info at bottom
    draw.line([(12, H - 60), (sw - 12, H - 60)], fill=(255, 255, 255, 20))
    draw.ellipse([16, H - 50, 42, H - 24], fill=hex2rgb("#3366ff"))
    draw.text((21, H - 46), "管", fill=(255, 255, 255), font=font(11))
    draw.text((50, H - 44), "管理员", fill=(200, 205, 220), font=font(12))
    draw.rounded_rectangle([sw - 56, H - 48, sw - 12, H - 28], radius=6, fill=(255, 255, 255, 25))
    draw.text((sw - 50, H - 44), "退出", fill=(200, 200, 210), font=font(11))

    # ===== Top bar =====
    draw.rectangle([sw, 0, W, 52], fill=(255, 255, 255))
    draw.line([(sw, 52), (W, 52)], fill=hex2rgb("#e8eaed"))
    draw.text((sw + 24, 15), "首页", fill=hex2rgb("#1a1a2e"), font=font(17))
    draw.text((W - 140, 18), "2026-02-18", fill=(150, 150, 160), font=font(13))

    # ===== Content area =====
    cx0 = sw + 20
    cy0 = 70

    # -- Gold Price Banner --
    gx0, gy0, gx1, gy1 = cx0, cy0, W - 20, cy0 + 110
    # Gold gradient
    ct_g, cb_g = hex2rgb("#ffd700"), hex2rgb("#ff8c00")
    for y in range(gy0, gy1):
        r = (y - gy0) / max(gy1 - gy0, 1)
        c = tuple(int(ct_g[i] + (cb_g[i] - ct_g[i]) * r) for i in range(3))
        draw.line([(gx0, y), (gx1, y)], fill=c)
    # Rounded corners mask
    mask = Image.new("L", (gx1 - gx0, gy1 - gy0), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, gx1 - gx0, gy1 - gy0], radius=14, fill=255)
    region = img.crop((gx0, gy0, gx1, gy1))
    bg = Image.new("RGB", (gx1 - gx0, gy1 - gy0), hex2rgb("#f0f2f5"))
    result = Image.composite(region, bg, mask)
    img.paste(result, (gx0, gy0))
    draw = ImageDraw.Draw(img)

    # Decorative circle
    draw.ellipse([gx1 - 70, gy0 - 10, gx1 + 10, gy0 + 70], fill=(255, 255, 255, 30))

    # Gold content
    draw.text((gx0 + 20, gy0 + 12), "Au · 今日黄金价格", fill=(100, 50, 0), font=font(13))
    draw.text((gx1 - 180, gy0 + 12), "更新: 2026-02-18", fill=(140, 90, 0), font=font(11))
    draw.text((gx0 + 20, gy0 + 38), "¥580.00", fill=(90, 40, 0), font=font(32))
    draw.text((gx0 + 170, gy0 + 56), "/g", fill=(120, 70, 0), font=font(14))

    # Sell price
    draw.text((gx0 + 280, gy0 + 38), "回收价", fill=(120, 70, 0), font=font(11))
    draw.text((gx0 + 280, gy0 + 56), "¥565.00 /g", fill=(90, 40, 0), font=font(18))

    # Update inputs (simplified)
    inp_y = gy0 + 82
    draw.rounded_rectangle([gx0 + 20, inp_y, gx0 + 180, inp_y + 22], radius=5, fill=(255, 255, 255, 130))
    draw.text((gx0 + 28, inp_y + 3), "买入价", fill=(140, 90, 0, 120), font=font(11))
    draw.rounded_rectangle([gx0 + 190, inp_y, gx0 + 350, inp_y + 22], radius=5, fill=(255, 255, 255, 130))
    draw.text((gx0 + 198, inp_y + 3), "回收价", fill=(140, 90, 0, 120), font=font(11))
    draw.rounded_rectangle([gx0 + 360, inp_y, gx0 + 440, inp_y + 22], radius=5, fill=(100, 50, 0))
    draw.text((gx0 + 372, inp_y + 3), "更新金价", fill=(255, 230, 150), font=font(11))

    # -- Section: 业务概览 --
    sec_y = gy1 + 16
    draw.rounded_rectangle([cx0, sec_y + 2, cx0 + 3, sec_y + 18], radius=1, fill=hex2rgb("#3366ff"))
    draw.text((cx0 + 10, sec_y), "业务概览", fill=hex2rgb("#2d3436"), font=font(15))

    # -- Stat Cards --
    cards = [
        ("客户总数", "128 人", "#4e6aff", "#7b8cff"),
        ("订单总数", "256 笔", "#00c48c", "#4dd9a8"),
        ("在贷订单", "45 笔", "#ff9f43", "#ffb976"),
        ("逾期笔数", "3 笔", "#ff6b6b", "#ff9292"),
        ("在库物品", "67 件", "#6c5ce7", "#a29bfe"),
        ("待处理预约", "12 个", "#00b4d8", "#48cae4"),
    ]
    card_y = sec_y + 28
    cw = (W - 20 - cx0 - 5 * 12) // 6
    ch = 85

    for i, (title, val, c1, c2) in enumerate(cards):
        x = cx0 + i * (cw + 12)
        # Gradient card
        ct_c, cb_c = hex2rgb(c1), hex2rgb(c2)
        for y in range(card_y, card_y + ch):
            r = (y - card_y) / max(ch, 1)
            c = tuple(int(ct_c[j] + (cb_c[j] - ct_c[j]) * r) for j in range(3))
            draw.line([(x, y), (x + cw, y)], fill=c)
        # Rounded corners
        m = Image.new("L", (cw, ch), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, cw, ch], radius=10, fill=255)
        reg = img.crop((x, card_y, x + cw, card_y + ch))
        bg2 = Image.new("RGB", (cw, ch), hex2rgb("#f0f2f5"))
        img.paste(Image.composite(reg, bg2, m), (x, card_y))
    draw = ImageDraw.Draw(img)

    for i, (title, val, c1, c2) in enumerate(cards):
        x = cx0 + i * (cw + 12)
        draw.text((x + 12, card_y + 14), title, fill=(255, 255, 255, 210), font=font(11))
        draw.text((x + 12, card_y + 40), val, fill=(255, 255, 255), font=font(20))
        # Decorative circle
        draw.ellipse([x + cw - 28, card_y + 6, x + cw - 2, card_y + 32], fill=(255, 255, 255, 30))

    # -- Section: 财务汇总 --
    fin_y = card_y + ch + 20
    draw.rounded_rectangle([cx0, fin_y + 2, cx0 + 3, fin_y + 18], radius=1, fill=hex2rgb("#00c48c"))
    draw.text((cx0 + 10, fin_y), "财务汇总", fill=hex2rgb("#2d3436"), font=font(15))

    fw_y = fin_y + 28
    # Two finance cards
    half_w = (W - 20 - cx0 - 12) // 2
    for i, (label, val, color) in enumerate([("支出总额", "¥234,500.00", "#ff4757"), ("逾期笔数", "3 笔", "#ff9f43")]):
        x = cx0 + i * (half_w + 12)
        draw.rounded_rectangle([x, fw_y, x + half_w, fw_y + 70], radius=10, fill=(255, 255, 255))
        draw.text((x + 18, fw_y + 12), label, fill=(150, 150, 160), font=font(12))
        draw.text((x + 18, fw_y + 34), val, fill=hex2rgb(color), font=font(20))

    # ===== Browser chrome (top) =====
    # Add a subtle browser bar effect at the very top
    # (optional, let's skip for cleaner look)

    img.save(os.path.join(OUT, "06_web_dashboard.png"), quality=95)
    print("Generated: 06_web_dashboard.png")


if __name__ == "__main__":
    gen()
