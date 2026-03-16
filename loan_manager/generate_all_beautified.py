"""Generate all beautified UI preview images."""
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 390, 844
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
    """Vertical gradient fill (no rounding)."""
    x0, y0, x1, y1 = xy
    ct, cb = hex2rgb(c_top), hex2rgb(c_bot)
    for y in range(y0, y1):
        r = (y - y0) / max(y1 - y0, 1)
        c = tuple(int(ct[i] + (cb[i] - ct[i]) * r) for i in range(3))
        draw.line([(x0, y), (x1, y)], fill=c)


def gradient_rect(draw, img, xy, c_top, c_bot, radius=16):
    """Gradient rounded rect using mask compositing."""
    x0, y0, x1, y1 = xy
    rw, rh = x1 - x0, y1 - y0
    grad = Image.new("RGB", (rw, rh))
    gd = ImageDraw.Draw(grad)
    ct, cb = hex2rgb(c_top), hex2rgb(c_bot)
    for y in range(rh):
        r = y / max(rh, 1)
        c = tuple(int(ct[i] + (cb[i] - ct[i]) * r) for i in range(3))
        gd.line([(0, y), (rw, y)], fill=c)
    mask = Image.new("L", (rw, rh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, rw, rh], radius=radius, fill=255)
    bg = img.crop((x0, y0, x1, y1)).convert("RGB")
    result = Image.composite(grad, bg, mask)
    img.paste(result, (x0, y0))


def draw_status_bar(draw):
    draw.rectangle([0, 0, W, 44], fill=hex2rgb("#1A1A2E"))
    fs = font(12)
    draw.text((20, 14), "9:41", fill=(255, 255, 255), font=fs)
    draw.text((W - 55, 14), "100%", fill=(255, 255, 255), font=fs)


def draw_bottom_nav(draw, img, active_idx=0):
    nav_y = H - 64
    draw.rectangle([0, nav_y, W, H], fill=(255, 255, 255))
    draw.line([0, nav_y, W, nav_y], fill=(235, 235, 240), width=1)
    tabs = ["首页", "客户", "订单", "还款", "更多"]
    icons = ["首", "客", "单", "还", "···"]
    tw = W // len(tabs)
    fn = font(10)
    fi = font(13)
    for i, (label, ic) in enumerate(zip(tabs, icons)):
        cx = tw * i + tw // 2
        if i == active_idx:
            draw.ellipse([cx - 22, nav_y + 6, cx + 22, nav_y + 36], fill=hex2rgb("#3366FF"))
            draw.text((cx - 7, nav_y + 10), ic, fill=(255, 255, 255), font=fi)
            bbox = fn.getbbox(label)
            lw = bbox[2] - bbox[0]
            draw.text((cx - lw // 2, nav_y + 42), label, fill=hex2rgb("#3366FF"), font=fn)
        else:
            draw.text((cx - 7, nav_y + 10), ic, fill=(180, 185, 195), font=fi)
            bbox = fn.getbbox(label)
            lw = bbox[2] - bbox[0]
            draw.text((cx - lw // 2, nav_y + 42), label, fill=(180, 185, 195), font=fn)


# =================================================================
#  1. LOGIN
# =================================================================
def gen_login():
    img = Image.new("RGB", (W, H), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw_status_bar(draw)

    # Top decorative gradient blob
    gradient_v(draw, (0, 44, W, 280), "#1A1A2E", "#2D3A7A")
    # Decorative circles
    for cx, cy, rad in [(60, 100, 70), (W - 40, 200, 50), (W // 2, 60, 30)]:
        draw.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=(255, 255, 255, 8))

    # Logo circle
    logo_cx, logo_cy = W // 2, 150
    draw.ellipse([logo_cx - 40, logo_cy - 40, logo_cx + 40, logo_cy + 40], fill=(255, 255, 255, 25))
    draw.ellipse([logo_cx - 34, logo_cy - 34, logo_cx + 34, logo_cy + 34], fill=(255, 255, 255, 40))
    fl = font(24)
    draw.text((logo_cx - 12, logo_cy - 14), "贷", fill=(255, 255, 255), font=fl)

    # Title below blob
    ft = font(22)
    t = "贷款业务管理系统"
    bbox = ft.getbbox(t)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) // 2, 220), t, fill=(255, 255, 255), font=ft)

    # White card form area
    card_y = 290
    draw.rounded_rectangle([24, card_y, W - 24, 700], radius=20, fill=(255, 255, 255))
    # Card shadow
    draw.rounded_rectangle([28, 698, W - 28, 706], radius=10, fill=(0, 0, 0, 10))

    fl = font(13)
    fi = font(14)
    y = card_y + 28

    fields = [
        ("服务器地址", "http://127.0.0.1:8000"),
        ("用户名", "admin"),
        ("密码", "••••••••"),
    ]
    for label, val in fields:
        draw.text((44, y), label, fill=(140, 145, 160), font=fl)
        y += 22
        draw.rounded_rectangle([44, y, W - 44, y + 44], radius=10, fill=hex2rgb("#F7F8FC"))
        draw.text((60, y + 12), val, fill=hex2rgb("#2D3436"), font=fi)
        y += 60

    # Login button with gradient
    btn_y = y + 10
    gradient_rect(draw, img, (44, btn_y, W - 44, btn_y + 50), "#4E6AFF", "#7B8CFF", radius=12)
    draw = ImageDraw.Draw(img)
    fb = font(17)
    t = "登  录"
    bbox = fb.getbbox(t)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) // 2, btn_y + 14), t, fill=(255, 255, 255), font=fb)

    # Hint
    fh = font(12)
    t = "默认管理员: admin / admin123"
    bbox = fh.getbbox(t)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) // 2, btn_y + 68), t, fill=(190, 195, 210), font=fh)

    # Bottom branding
    fb2 = font(11)
    t = "Loan Manager v1.0"
    bbox = fb2.getbbox(t)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) // 2, H - 40), t, fill=(200, 205, 215), font=fb2)

    img.save(os.path.join(OUT, "01_login.png"), quality=95)
    print("  01_login.png")


# =================================================================
#  2. CUSTOMER LIST
# =================================================================
def gen_customer_list():
    img = Image.new("RGB", (W, H), hex2rgb("#F5F7FA"))
    draw = ImageDraw.Draw(img)
    draw_status_bar(draw)

    # Header
    gradient_v(draw, (0, 44, W, 100), "#1A1A2E", "#2D3A7A")
    ft = font(18)
    draw.text((20, 58), "客户信息", fill=(255, 255, 255), font=ft)
    # Count badge
    draw.rounded_rectangle([W - 100, 58, W - 16, 82], radius=12, fill=(255, 255, 255, 30))
    fc = font(12)
    draw.text((W - 88, 62), "共 128 位", fill=(220, 225, 255), font=fc)

    # Search bar
    sy = 112
    draw.rounded_rectangle([14, sy, W - 120, sy + 40], radius=10, fill=(255, 255, 255))
    fs = font(13)
    draw.text((30, sy + 11), "搜索客户姓名/电话...", fill=(180, 185, 195), font=fs)
    # Search icon circle
    draw.ellipse([W - 118, sy + 4, W - 86, sy + 36], fill=hex2rgb("#3366FF"))
    draw.text((W - 110, sy + 10), "搜", fill=(255, 255, 255), font=font(12))
    # Add button
    gradient_rect(draw, img, (W - 78, sy, W - 14, sy + 40), "#00C48C", "#4DD9A8", radius=10)
    draw = ImageDraw.Draw(img)
    draw.text((W - 68, sy + 10), "+ 新增", fill=(255, 255, 255), font=font(13))

    # Customer cards
    customers = [
        ("张三", "138-0000-1234", "上海市浦东新区张江路88号", "A", "信用贷款 · ¥50万"),
        ("李四", "139-0000-5678", "北京市朝阳区望京SOHO", "B", "抵押贷款 · ¥120万"),
        ("王五", "137-0000-9012", "深圳市南山区科技园", "A", "担保贷款 · ¥80万"),
        ("赵六", "136-0000-3456", "广州市天河区珠江新城", "C", "信用贷款 · ¥15万"),
    ]

    rating_colors = {"A": "#00C48C", "B": "#FF9F43", "C": "#FF6B6B", "D": "#999999"}
    fn = font(16)
    fd = font(12)
    ft_badge = font(11)
    fb = font(11)

    card_y = sy + 54
    card_h = 136

    for name, phone, addr, rating, loan_info in customers:
        # Card
        draw.rounded_rectangle([14, card_y, W - 14, card_y + card_h], radius=14, fill=(255, 255, 255))
        # Subtle left accent
        rc = hex2rgb(rating_colors[rating])
        draw.rounded_rectangle([14, card_y, 18, card_y + card_h], radius=2, fill=rc)

        # Avatar circle
        ax = 42
        draw.ellipse([ax - 14, card_y + 18, ax + 14, card_y + 46], fill=(*rc, 40))
        fa = font(14)
        bbox = fa.getbbox(name[0])
        cw = bbox[2] - bbox[0]
        draw.text((ax - cw // 2, card_y + 22), name[0], fill=rc, font=fa)

        # Name
        draw.text((64, card_y + 16), name, fill=hex2rgb("#2D3436"), font=fn)

        # Rating badge
        nx = 64 + fn.getbbox(name)[2] + 10
        draw.rounded_rectangle([nx, card_y + 18, nx + 32, card_y + 36], radius=4, fill=rc)
        bbox = ft_badge.getbbox(rating)
        bw = bbox[2] - bbox[0]
        draw.text((nx + 16 - bw // 2, card_y + 20), rating, fill=(255, 255, 255), font=ft_badge)

        # Loan info tag
        lx = nx + 42
        draw.rounded_rectangle([lx, card_y + 18, lx + fd.getbbox(loan_info)[2] + 16, card_y + 36], radius=4, fill=hex2rgb("#F0F2FF"))
        draw.text((lx + 8, card_y + 20), loan_info, fill=hex2rgb("#4E6AFF"), font=ft_badge)

        # Details
        draw.text((64, card_y + 46), f"电话  {phone}", fill=(140, 145, 160), font=fd)
        draw.text((64, card_y + 66), f"地址  {addr}", fill=(140, 145, 160), font=fd)

        # Action buttons
        btn_y_pos = card_y + 94
        # Edit
        draw.rounded_rectangle([W - 140, btn_y_pos, W - 82, btn_y_pos + 30], radius=6, fill=hex2rgb("#EEF2FF"))
        draw.text((W - 130, btn_y_pos + 7), "编辑", fill=hex2rgb("#4E6AFF"), font=fb)
        # Delete
        draw.rounded_rectangle([W - 72, btn_y_pos, W - 22, btn_y_pos + 30], radius=6, fill=hex2rgb("#FFF0F0"))
        draw.text((W - 62, btn_y_pos + 7), "删除", fill=hex2rgb("#FF6B6B"), font=fb)

        card_y += card_h + 10

    draw_bottom_nav(draw, img, active_idx=1)
    img.save(os.path.join(OUT, "03_customer_list.png"), quality=95)
    print("  03_customer_list.png")


# =================================================================
#  3. ORDER FORM
# =================================================================
def gen_order_form():
    img = Image.new("RGB", (W, H), hex2rgb("#F5F7FA"))
    draw = ImageDraw.Draw(img)
    draw_status_bar(draw)

    # Header
    gradient_v(draw, (0, 44, W, 100), "#1A1A2E", "#2D3A7A")
    ft = font(18)
    draw.text((20, 58), "新增订单", fill=(255, 255, 255), font=ft)
    # Close button
    draw.rounded_rectangle([W - 56, 58, W - 16, 82], radius=12, fill=(255, 255, 255, 30))
    draw.text((W - 46, 62), "取消", fill=(220, 225, 255), font=font(12))

    # Form card
    draw.rounded_rectangle([14, 110, W - 14, H - 90], radius=18, fill=(255, 255, 255))

    fields = [
        ("订单编号", "ORD-2026-0001", "text"),
        ("客户ID", "1", "text"),
        ("贷款金额 (元)", "500,000.00", "text"),
        ("贷款期限 (月)", "12", "text"),
        ("年利率", "4.50%", "text"),
        ("贷款类型", "抵押贷款", "combo"),
        ("状态", "待审核", "combo"),
        ("抵押物描述", "房产-浦东新区XX路XX号", "text"),
        ("审批人", "", "text"),
    ]

    fl = font(12)
    fi = font(14)
    y = 128

    for label, value, ftype in fields:
        draw.text((34, y), label, fill=(140, 145, 160), font=fl)
        y += 20
        input_color = "#F7F8FC"
        draw.rounded_rectangle([34, y, W - 34, y + 40], radius=8, fill=hex2rgb(input_color))

        if ftype == "combo":
            # Dropdown indicator
            draw.text((48, y + 10), value if value else "请选择...", fill=hex2rgb("#2D3436") if value else (190, 195, 210), font=fi)
            # Arrow
            arrow_x = W - 60
            draw.polygon([(arrow_x, y + 16), (arrow_x + 10, y + 16), (arrow_x + 5, y + 24)], fill=(160, 165, 180))
        else:
            if value:
                draw.text((48, y + 10), value, fill=hex2rgb("#2D3436"), font=fi)
            else:
                draw.text((48, y + 10), "请输入...", fill=(190, 195, 210), font=fi)

        y += 50

    # Bottom buttons
    btn_y = H - 78
    # Cancel
    draw.rounded_rectangle([24, btn_y, W // 2 - 8, btn_y + 48], radius=12, fill=hex2rgb("#F0F2F5"))
    fb = font(15)
    t = "取消"
    bbox = fb.getbbox(t)
    tw = bbox[2] - bbox[0]
    draw.text(((W // 2 - 32 - tw) // 2 + 24, btn_y + 14), t, fill=hex2rgb("#666666"), font=fb)

    # Submit with gradient
    gradient_rect(draw, img, (W // 2 + 8, btn_y, W - 24, btn_y + 48), "#4E6AFF", "#7B8CFF", radius=12)
    draw = ImageDraw.Draw(img)
    t = "提交"
    bbox = fb.getbbox(t)
    tw = bbox[2] - bbox[0]
    draw.text((W // 2 + 8 + (W // 2 - 32 - tw) // 2, btn_y + 14), t, fill=(255, 255, 255), font=fb)

    img.save(os.path.join(OUT, "04_order_form.png"), quality=95)
    print("  04_order_form.png")


# =================================================================
#  4. REPAYMENT LIST (NEW - bonus page)
# =================================================================
def gen_repayment():
    img = Image.new("RGB", (W, H), hex2rgb("#F5F7FA"))
    draw = ImageDraw.Draw(img)
    draw_status_bar(draw)

    # Header
    gradient_v(draw, (0, 44, W, 100), "#1A1A2E", "#2D3A7A")
    ft = font(18)
    draw.text((20, 58), "还款计划", fill=(255, 255, 255), font=ft)

    # Summary bar
    sy = 108
    draw.rounded_rectangle([14, sy, W - 14, sy + 70], radius=14, fill=(255, 255, 255))
    stats = [("待还", "23笔", "#FF9F43"), ("已还", "189笔", "#00C48C"), ("逾期", "3笔", "#FF6B6B")]
    sw = (W - 28) // 3
    for i, (label, val, color) in enumerate(stats):
        cx = 14 + sw * i + sw // 2
        if i < 2:
            draw.line([(14 + sw * (i + 1), sy + 14), (14 + sw * (i + 1), sy + 56)], fill=(235, 238, 245), width=1)
        fsl = font(11)
        bbox = fsl.getbbox(label)
        lw = bbox[2] - bbox[0]
        draw.text((cx - lw // 2, sy + 12), label, fill=(150, 155, 170), font=fsl)
        fsv = font(16)
        bbox = fsv.getbbox(val)
        vw = bbox[2] - bbox[0]
        draw.text((cx - vw // 2, sy + 34), val, fill=hex2rgb(color), font=fsv)

    # Repayment cards
    plans = [
        ("ORD-2026-0001", "张三", "第3期/共12期", "2026-03-15", "¥45,833", "待还", "#FF9F43"),
        ("ORD-2026-0001", "张三", "第2期/共12期", "2026-02-15", "¥45,833", "已还", "#00C48C"),
        ("ORD-2026-0003", "王五", "第6期/共24期", "2026-02-20", "¥38,200", "逾期", "#FF6B6B"),
        ("ORD-2026-0002", "李四", "第1期/共6期", "2026-03-01", "¥210,500", "待还", "#FF9F43"),
    ]

    card_y = sy + 84
    fn = font(14)
    fd = font(12)
    fb = font(11)
    fs_tag = font(10)

    for order_no, customer, period, due, amount, status, color in plans:
        ch = 110
        draw.rounded_rectangle([14, card_y, W - 14, card_y + ch], radius=14, fill=(255, 255, 255))

        # Status color bar
        draw.rounded_rectangle([14, card_y, 18, card_y + ch], radius=2, fill=hex2rgb(color))

        # Order number + customer
        draw.text((30, card_y + 12), order_no, fill=hex2rgb("#2D3436"), font=fn)
        draw.text((30 + fn.getbbox(order_no)[2] + 8, card_y + 14), customer, fill=(150, 155, 170), font=fd)

        # Status badge
        sc = hex2rgb(color)
        badge_w = fs_tag.getbbox(status)[2] + 16
        draw.rounded_rectangle([W - 30 - badge_w, card_y + 10, W - 30, card_y + 30], radius=5, fill=(*sc, 25))
        draw.text((W - 30 - badge_w + 8, card_y + 13), status, fill=sc, font=fs_tag)

        # Period
        draw.text((30, card_y + 38), period, fill=(120, 125, 140), font=fd)

        # Due date + amount
        draw.text((30, card_y + 62), f"应还日期  {due}", fill=(150, 155, 170), font=fd)
        # Amount (right aligned, prominent)
        fa = font(18)
        bbox = fa.getbbox(amount)
        aw = bbox[2] - bbox[0]
        draw.text((W - 30 - aw, card_y + 55), amount, fill=hex2rgb(color), font=fa)

        # Buttons
        btn_by = card_y + ch - 34
        draw.rounded_rectangle([W - 140, btn_by, W - 82, btn_by + 26], radius=6, fill=hex2rgb("#EEF2FF"))
        draw.text((W - 130, btn_by + 5), "编辑", fill=hex2rgb("#4E6AFF"), font=fb)
        draw.rounded_rectangle([W - 72, btn_by, W - 22, btn_by + 26], radius=6, fill=hex2rgb("#FFF0F0"))
        draw.text((W - 62, btn_by + 5), "删除", fill=hex2rgb("#FF6B6B"), font=fb)

        card_y += ch + 10

    draw_bottom_nav(draw, img, active_idx=3)
    img.save(os.path.join(OUT, "05_repayment.png"), quality=95)
    print("  05_repayment.png")


if __name__ == "__main__":
    print("Generating beautified previews...")
    gen_login()
    gen_customer_list()
    gen_order_form()
    gen_repayment()
    print(f"\nAll saved to: {OUT}/")
