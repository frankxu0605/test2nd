"""Generate UI preview images for the loan management mobile app."""
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 390, 780  # iPhone-like dimensions
OUT_DIR = os.path.join(os.path.dirname(__file__), "previews")
os.makedirs(OUT_DIR, exist_ok=True)

# Colors
BG = "#F0F2F5"
WHITE = "#FFFFFF"
PRIMARY = "#1890FF"
GREEN = "#52C41A"
ORANGE = "#FAAD14"
RED = "#FF4D4F"
PURPLE = "#722ED1"
CYAN = "#13C2C2"
DARK = "#001529"
TEXT_PRIMARY = "#262626"
TEXT_SECONDARY = "#8C8C8C"
BORDER = "#E8E8E8"

def get_font(size):
    """Try to load a CJK-capable font, fall back to default."""
    font_paths = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/Hiragino Sans GB.ttc",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                return ImageFont.truetype(fp, size)
            except Exception:
                continue
    return ImageFont.load_default()


def draw_status_bar(draw):
    """Draw phone status bar."""
    draw.rectangle([0, 0, W, 28], fill="#000000")
    f = get_font(11)
    draw.text((16, 7), "9:41", fill="white", font=f)
    draw.text((W - 60, 7), "100%", fill="white", font=f)


def draw_rounded_rect(draw, xy, fill, radius=12):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill)


def draw_bottom_nav(draw, active_idx=0):
    """Draw bottom navigation bar."""
    y = H - 60
    draw.rectangle([0, y, W, H], fill="#FAFAFA")
    draw.line([0, y, W, y], fill=BORDER, width=1)

    tabs = ["首页", "客户", "订单", "还款", "更多"]
    tab_w = W // len(tabs)
    f = get_font(13)

    for i, tab in enumerate(tabs):
        cx = tab_w * i + tab_w // 2
        color = PRIMARY if i == active_idx else TEXT_SECONDARY

        # Icon circle
        icon_y = y + 12
        draw.ellipse([cx - 10, icon_y - 2, cx + 10, icon_y + 18], fill=color if i == active_idx else None, outline=color, width=2)

        # Label
        bbox = f.getbbox(tab)
        tw = bbox[2] - bbox[0]
        draw.text((cx - tw // 2, icon_y + 22), tab, fill=color, font=f)


# =========================================================
# Preview 1: Login Screen
# =========================================================
def gen_login():
    img = Image.new("RGB", (W, H), "#FFFFFF")
    draw = ImageDraw.Draw(img)
    draw_status_bar(draw)

    # Title
    f_title = get_font(26)
    t = "贷款业务管理系统"
    bbox = f_title.getbbox(t)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) // 2, 120), t, fill=DARK, font=f_title)

    f_label = get_font(14)
    f_input = get_font(14)

    # Server field
    y = 210
    draw.text((40, y), "服务器地址", fill=TEXT_SECONDARY, font=f_label)
    y += 24
    draw_rounded_rect(draw, (40, y, W - 40, y + 42), fill="#F5F5F5", radius=8)
    draw.text((54, y + 11), "http://127.0.0.1:8000", fill=TEXT_PRIMARY, font=f_input)

    # Username
    y += 62
    draw.text((40, y), "用户名", fill=TEXT_SECONDARY, font=f_label)
    y += 24
    draw_rounded_rect(draw, (40, y, W - 40, y + 42), fill="#F5F5F5", radius=8)
    draw.text((54, y + 11), "admin", fill=TEXT_PRIMARY, font=f_input)

    # Password
    y += 62
    draw.text((40, y), "密码", fill=TEXT_SECONDARY, font=f_label)
    y += 24
    draw_rounded_rect(draw, (40, y, W - 40, y + 42), fill="#F5F5F5", radius=8)
    draw.text((54, y + 11), "••••••••", fill=TEXT_PRIMARY, font=f_input)

    # Login button
    y += 70
    draw_rounded_rect(draw, (40, y, W - 40, y + 48), fill=PRIMARY, radius=8)
    f_btn = get_font(17)
    t = "登  录"
    bbox = f_btn.getbbox(t)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) // 2, y + 13), t, fill="white", font=f_btn)

    # Hint
    y += 70
    f_hint = get_font(12)
    t = "默认管理员: admin / admin123"
    bbox = f_hint.getbbox(t)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) // 2, y), t, fill="#BFBFBF", font=f_hint)

    img.save(os.path.join(OUT_DIR, "01_login.png"))
    print("Generated: 01_login.png")


# =========================================================
# Preview 2: Dashboard
# =========================================================
def gen_dashboard():
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    draw_status_bar(draw)

    # Top bar
    draw.rectangle([0, 28, W, 78], fill=DARK)
    f_top = get_font(17)
    draw.text((16, 43), "首页概览", fill="white", font=f_top)
    # Logout
    draw_rounded_rect(draw, (W - 80, 41, W - 16, 67), fill=RED, radius=4)
    f_sm = get_font(12)
    draw.text((W - 68, 47), "退出登录", fill="white", font=f_sm)

    # Welcome
    f_welcome = get_font(18)
    draw.text((16, 92), "欢迎使用贷款业务管理系统", fill=TEXT_PRIMARY, font=f_welcome)

    # Stat cards - 2 columns
    cards = [
        ("客户总数", "128", PRIMARY),
        ("订单总数", "256", GREEN),
        ("在贷订单", "45", ORANGE),
        ("逾期笔数", "3", RED),
        ("在库物品", "67", PURPLE),
        ("待处理预约", "12", CYAN),
        ("贷款总额", "¥5,680,000", PRIMARY),
        ("支出总额", "¥234,500", RED),
    ]

    f_card_title = get_font(12)
    f_card_value = get_font(22)

    col_w = (W - 48) // 2
    card_h = 76
    start_y = 128

    for i, (title, value, color) in enumerate(cards):
        col = i % 2
        row = i // 2
        x = 16 + col * (col_w + 16)
        y = start_y + row * (card_h + 12)

        draw_rounded_rect(draw, (x, y, x + col_w, y + card_h), fill=WHITE, radius=10)
        # Color accent line
        draw.rectangle([x, y, x + 4, y + card_h], fill=color)
        draw.text((x + 14, y + 10), title, fill=TEXT_SECONDARY, font=f_card_title)
        draw.text((x + 14, y + 32), value, fill=color, font=f_card_value)

    draw_bottom_nav(draw, active_idx=0)
    img.save(os.path.join(OUT_DIR, "02_dashboard.png"))
    print("Generated: 02_dashboard.png")


# =========================================================
# Preview 3: Customer List
# =========================================================
def gen_customer_list():
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    draw_status_bar(draw)

    # Top bar
    draw.rectangle([0, 28, W, 78], fill=DARK)
    f_top = get_font(17)
    draw.text((16, 43), "客户信息", fill="white", font=f_top)
    draw_rounded_rect(draw, (W - 80, 41, W - 16, 67), fill=RED, radius=4)
    f_sm = get_font(12)
    draw.text((W - 68, 47), "退出登录", fill="white", font=f_sm)

    # Search bar
    y = 88
    draw_rounded_rect(draw, (12, y, W - 110, y + 36), fill=WHITE, radius=6)
    f14 = get_font(14)
    draw.text((24, y + 9), "搜索...", fill="#BFBFBF", font=f14)
    # Search btn
    draw_rounded_rect(draw, (W - 104, y, W - 62, y + 36), fill=PRIMARY, radius=6)
    draw.text((W - 98, y + 9), "搜索", fill="white", font=f14)
    # Add btn
    draw_rounded_rect(draw, (W - 56, y, W - 8, y + 36), fill=GREEN, radius=6)
    draw.text((W - 50, y + 9), "新增", fill="white", font=f14)

    # Customer cards
    customers = [
        {"name": "张三", "phone": "138-0000-1234", "id_card": "310***1234", "addr": "上海市浦东新区", "rating": "A"},
        {"name": "李四", "phone": "139-0000-5678", "id_card": "320***5678", "addr": "北京市朝阳区", "rating": "B"},
        {"name": "王五", "phone": "137-0000-9012", "id_card": "330***9012", "addr": "深圳市南山区", "rating": "A"},
        {"name": "赵六", "phone": "136-0000-3456", "id_card": "440***3456", "addr": "广州市天河区", "rating": "C"},
    ]

    f_name = get_font(16)
    f_detail = get_font(12)
    f_btn = get_font(12)

    card_y = 138
    for c in customers:
        ch = 120
        draw_rounded_rect(draw, (12, card_y, W - 12, card_y + ch), fill=WHITE, radius=10)

        # Name + Rating badge
        draw.text((24, card_y + 12), c["name"], fill=TEXT_PRIMARY, font=f_name)
        # Rating badge
        badge_color = GREEN if c["rating"] == "A" else (ORANGE if c["rating"] == "B" else RED)
        rx = 24 + f_name.getbbox(c["name"])[2] + 12
        draw_rounded_rect(draw, (rx, card_y + 12, rx + 28, card_y + 30), fill=badge_color, radius=4)
        draw.text((rx + 8, card_y + 14), c["rating"], fill="white", font=f_detail)

        # Details
        draw.text((24, card_y + 38), f"电话: {c['phone']}", fill=TEXT_SECONDARY, font=f_detail)
        draw.text((24, card_y + 58), f"身份证: {c['id_card']}", fill=TEXT_SECONDARY, font=f_detail)
        draw.text((24, card_y + 78), f"地址: {c['addr']}", fill=TEXT_SECONDARY, font=f_detail)

        # Edit / Delete buttons
        draw_rounded_rect(draw, (W - 120, card_y + 76, W - 72, card_y + 100), fill=PRIMARY, radius=4)
        draw.text((W - 112, card_y + 80), "编辑", fill="white", font=f_btn)
        draw_rounded_rect(draw, (W - 64, card_y + 76, W - 20, card_y + 100), fill=RED, radius=4)
        draw.text((W - 56, card_y + 80), "删除", fill="white", font=f_btn)

        card_y += ch + 10

    draw_bottom_nav(draw, active_idx=1)
    img.save(os.path.join(OUT_DIR, "03_customer_list.png"))
    print("Generated: 03_customer_list.png")


# =========================================================
# Preview 4: Order Form (New Order)
# =========================================================
def gen_order_form():
    img = Image.new("RGB", (W, H), "#F5F5F5")
    draw = ImageDraw.Draw(img)
    draw_status_bar(draw)

    # Popup header
    py = 50
    draw.rectangle([0, py, W, H - 40], fill=WHITE)
    draw.rectangle([0, py, W, py + 46], fill=PRIMARY)
    f_title = get_font(17)
    draw.text((16, py + 12), "新增订单", fill="white", font=f_title)

    # Form fields
    fields = [
        ("订单编号", "ORD-2026-0001"),
        ("客户ID", "1"),
        ("贷款金额", "500000.00"),
        ("贷款期限(月)", "12"),
        ("利率", "0.0450"),
        ("贷款类型", "抵押贷款  ▼"),
        ("状态", "待审核  ▼"),
        ("抵押物描述", "房产-浦东新区XX路XX号"),
        ("审批人", ""),
    ]

    f_label = get_font(13)
    f_input = get_font(14)
    y = py + 58

    for label, value in fields:
        draw.text((20, y), label, fill=TEXT_SECONDARY, font=f_label)
        y += 20
        draw_rounded_rect(draw, (20, y, W - 20, y + 38), fill="#F5F5F5", radius=6)
        if value:
            draw.text((32, y + 9), value, fill=TEXT_PRIMARY, font=f_input)
        else:
            draw.text((32, y + 9), "请输入...", fill="#BFBFBF", font=f_input)
        y += 50

    # Bottom buttons
    btn_y = H - 90
    draw_rounded_rect(draw, (20, btn_y, W // 2 - 8, btn_y + 44), fill="#E8E8E8", radius=8)
    f_btn = get_font(15)
    t = "取消"
    bbox = f_btn.getbbox(t)
    tw = bbox[2] - bbox[0]
    draw.text(((W // 2 - 28 - tw) // 2 + 20, btn_y + 12), t, fill=TEXT_PRIMARY, font=f_btn)

    draw_rounded_rect(draw, (W // 2 + 8, btn_y, W - 20, btn_y + 44), fill=PRIMARY, radius=8)
    t = "确定"
    bbox = f_btn.getbbox(t)
    tw = bbox[2] - bbox[0]
    draw.text((W // 2 + 8 + (W // 2 - 28 - tw) // 2, btn_y + 12), t, fill="white", font=f_btn)

    img.save(os.path.join(OUT_DIR, "04_order_form.png"))
    print("Generated: 04_order_form.png")


if __name__ == "__main__":
    gen_login()
    gen_dashboard()
    gen_customer_list()
    gen_order_form()
    print(f"\nAll previews saved to: {OUT_DIR}/")
