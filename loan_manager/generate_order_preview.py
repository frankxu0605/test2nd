"""Generate beautified order form preview with new fields."""
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 390, 1400  # Taller to fit all fields
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


def gradient_rect(draw, img, xy, c_top, c_bot, radius=12):
    x0, y0, x1, y1 = xy
    rw, rh = x1 - x0, y1 - y0
    grad = Image.new("RGB", (rw, rh))
    gd = ImageDraw.Draw(grad)
    ct, cb = hex2rgb(c_top), hex2rgb(c_bot)
    for yy in range(rh):
        r = yy / max(rh, 1)
        c = tuple(int(ct[i] + (cb[i] - ct[i]) * r) for i in range(3))
        gd.line([(0, yy), (rw, yy)], fill=c)
    mask = Image.new("L", (rw, rh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, rw, rh], radius=radius, fill=255)
    bg = img.crop((x0, y0, x1, y1)).convert("RGB")
    result = Image.composite(grad, bg, mask)
    img.paste(result, (x0, y0))


def gen():
    img = Image.new("RGB", (W, H), hex2rgb("#F5F7FA"))
    draw = ImageDraw.Draw(img)

    # Status bar
    draw.rectangle([0, 0, W, 44], fill=hex2rgb("#1A1A2E"))
    fs = font(12)
    draw.text((20, 14), "9:41", fill=(255, 255, 255), font=fs)
    draw.text((W - 55, 14), "100%", fill=(255, 255, 255), font=fs)

    # Header
    gradient_v(draw, (0, 44, W, 100), "#1A1A2E", "#2D3A7A")
    ft = font(18)
    draw.text((20, 58), "新增订单", fill=(255, 255, 255), font=ft)
    draw.rounded_rectangle([W - 56, 58, W - 16, 82], radius=12, fill=(255, 255, 255, 30))
    draw.text((W - 46, 62), "取消", fill=(220, 225, 255), font=font(12))

    # Form card
    card_top = 110
    card_bot = H - 80
    draw.rounded_rectangle([14, card_top, W - 14, card_bot], radius=18, fill=(255, 255, 255))

    # Section helper
    fl = font(12)
    fi = font(13)
    fsec = font(13)

    def draw_section(y, title, color):
        draw.rounded_rectangle([34, y, 38, y + 16], radius=2, fill=hex2rgb(color))
        draw.text((44, y), title, fill=hex2rgb("#2D3436"), font=fsec)
        return y + 26

    def draw_field(y, label, value, ftype="text"):
        draw.text((34, y), label, fill=(140, 145, 160), font=fl)
        y += 18
        draw.rounded_rectangle([34, y, W - 34, y + 36], radius=8, fill=hex2rgb("#F7F8FC"))
        if ftype == "combo":
            draw.text((46, y + 8), value, fill=hex2rgb("#2D3436"), font=fi)
            ax = W - 56
            draw.polygon([(ax, y + 14), (ax + 8, y + 14), (ax + 4, y + 22)], fill=(160, 165, 180))
        else:
            if value:
                draw.text((46, y + 8), value, fill=hex2rgb("#2D3436"), font=fi)
            else:
                draw.text((46, y + 8), "请输入...", fill=(190, 195, 210), font=fi)
        return y + 44

    y = card_top + 18

    # Section: Basic Info
    y = draw_section(y, "基本信息", "#4E6AFF")
    y = draw_field(y, "日期", "2026-02-18")
    y = draw_field(y, "订单编号", "ORD-2026-0218")
    y = draw_field(y, "客户ID", "1")

    # Section: Customer Info
    y += 6
    y = draw_section(y, "客户信息", "#00C48C")
    y = draw_field(y, "电话", "138-0000-1234")
    y = draw_field(y, "身份证", "310101199001011234")
    y = draw_field(y, "地址", "上海市浦东新区张江路88号")
    y = draw_field(y, "邮箱", "zhangsan@email.com")
    y = draw_field(y, "客户经理", "王经理")
    y = draw_field(y, "紧急联系人", "李某 139-xxxx-xxxx")
    y = draw_field(y, "是否有当前逾期", "否", "combo")
    y = draw_field(y, "是否有房产", "是", "combo")

    # Section: Product & Pricing
    y += 6
    y = draw_section(y, "产品与费用", "#FF9F43")
    y = draw_field(y, "克重 (g)", "50.00")
    y = draw_field(y, "单价 (元/g)", "580.00")
    y = draw_field(y, "加工费", "1,200.00")
    y = draw_field(y, "公证费", "500.00")

    # Section: Payment Plan
    y += 6
    y = draw_section(y, "分期方案", "#6C5CE7")
    y = draw_field(y, "首付比例 (%)", "30.00")
    y = draw_field(y, "首付金额", "9,510.00")
    y = draw_field(y, "分期期数", "12")
    y = draw_field(y, "每期金额", "1,849.17")
    y = draw_field(y, "状态", "待审核", "combo")

    # Bottom buttons
    btn_y = card_bot + 16
    draw.rounded_rectangle([24, btn_y, W // 2 - 8, btn_y + 48], radius=12, fill=hex2rgb("#F0F2F5"))
    fb = font(15)
    t = "取消"
    bbox = fb.getbbox(t)
    tw = bbox[2] - bbox[0]
    draw.text(((W // 2 - 32 - tw) // 2 + 24, btn_y + 14), t, fill=hex2rgb("#666666"), font=fb)

    gradient_rect(draw, img, (W // 2 + 8, btn_y, W - 24, btn_y + 48), "#4E6AFF", "#7B8CFF", radius=12)
    draw = ImageDraw.Draw(img)
    t = "提交"
    bbox = fb.getbbox(t)
    tw = bbox[2] - bbox[0]
    draw.text((W // 2 + 8 + (W // 2 - 32 - tw) // 2, btn_y + 14), t, fill=(255, 255, 255), font=fb)

    img.save(os.path.join(OUT, "04_order_form.png"), quality=95)
    print("Generated: 04_order_form.png")


if __name__ == "__main__":
    gen()
