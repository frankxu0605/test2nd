"""Dashboard screen showing gold price banner and key statistics."""
from datetime import date

from kivy.uix.screenmanager import Screen
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.gridlayout import GridLayout
from kivy.uix.scrollview import ScrollView
from kivy.uix.label import Label
from kivy.uix.textinput import TextInput
from kivy.uix.button import Button
from kivy.uix.popup import Popup
from kivy.metrics import dp, sp
from kivy.graphics import Color, RoundedRectangle

from utils.common_widgets import StatCard
from api_client import api


class GoldPriceBanner(BoxLayout):
    """Top banner showing today's gold price with update controls."""

    def __init__(self, **kwargs):
        super().__init__(orientation="vertical", size_hint_y=None, height=dp(140),
                         padding=[dp(16), dp(12)], spacing=dp(6), **kwargs)
        with self.canvas.before:
            Color(1.0, 0.84, 0.0, 1)  # Gold
            self._bg = RoundedRectangle(pos=self.pos, size=self.size, radius=[dp(14)])
        self.bind(pos=self._upd, size=self._upd)

        # Title
        self.title = Label(text="今日黄金价格", font_size=sp(13),
                           color=(0.45, 0.3, 0, 1), halign="left", valign="middle",
                           size_hint_y=None, height=dp(20))
        self.title.bind(size=self.title.setter("text_size"))
        self.add_widget(self.title)

        # Price row
        price_row = BoxLayout(orientation="horizontal", size_hint_y=None, height=dp(38))
        self.buy_label = Label(text="¥-- /g", font_size=sp(28), bold=True,
                               color=(0.4, 0.2, 0, 1), halign="left", valign="middle")
        self.buy_label.bind(size=self.buy_label.setter("text_size"))
        price_row.add_widget(self.buy_label)

        self.sell_label = Label(text="回收: ¥--", font_size=sp(14),
                                color=(0.5, 0.3, 0, 1), halign="right", valign="bottom",
                                size_hint_x=0.4)
        self.sell_label.bind(size=self.sell_label.setter("text_size"))
        price_row.add_widget(self.sell_label)
        self.add_widget(price_row)

        self.date_label = Label(text="", font_size=sp(11), color=(0.55, 0.35, 0, 1),
                                halign="left", size_hint_y=None, height=dp(16))
        self.date_label.bind(size=self.date_label.setter("text_size"))
        self.add_widget(self.date_label)

        # Update row
        update_row = BoxLayout(orientation="horizontal", size_hint_y=None, height=dp(34), spacing=dp(6))
        self.buy_input = TextInput(hint_text="买入价", multiline=False, input_filter="float",
                                   font_size=sp(12), size_hint_x=0.3, padding=[dp(6), dp(4)])
        update_row.add_widget(self.buy_input)
        self.sell_input = TextInput(hint_text="回收价", multiline=False, input_filter="float",
                                    font_size=sp(12), size_hint_x=0.3, padding=[dp(6), dp(4)])
        update_row.add_widget(self.sell_input)
        upd_btn = Button(text="更新金价", font_size=sp(12), size_hint_x=0.4,
                         background_color=(0.55, 0.35, 0, 1), color=(1, 1, 1, 1))
        upd_btn.bind(on_release=lambda _: self._on_update())
        update_row.add_widget(upd_btn)
        self.add_widget(update_row)

        self.on_updated = None  # callback

    def _upd(self, *_):
        self._bg.pos = self.pos
        self._bg.size = self.size

    def set_data(self, gold_info):
        if gold_info:
            self.buy_label.text = f"¥{gold_info['buy_price']:.2f} /g"
            self.sell_label.text = f"回收: ¥{gold_info['sell_price']:.2f} /g"
            self.date_label.text = f"更新日期: {gold_info['price_date']}"
        else:
            self.buy_label.text = "暂无报价"
            self.sell_label.text = "回收: --"
            self.date_label.text = "请设置今日金价"

    def _on_update(self):
        buy = self.buy_input.text.strip()
        sell = self.sell_input.text.strip()
        if not buy:
            return
        try:
            api.post("/api/gold-price/", {
                "price_date": str(date.today()),
                "buy_price": float(buy),
                "sell_price": float(sell) if sell else 0.0,
                "updated_by": api.user_info.get("real_name", ""),
            })
            self.buy_input.text = ""
            self.sell_input.text = ""
            if self.on_updated:
                self.on_updated()
        except Exception:
            pass


class DashboardScreen(Screen):
    def __init__(self, **kwargs):
        super().__init__(name="dashboard", **kwargs)
        self._build_ui()

    def _build_ui(self):
        root = BoxLayout(orientation="vertical", padding=[dp(12), dp(12)], spacing=dp(10))

        # Gold price banner
        self.gold_banner = GoldPriceBanner()
        self.gold_banner.on_updated = self.load_data
        root.add_widget(self.gold_banner)

        # Section title
        sec = Label(text="业务概览", font_size=sp(16), bold=True,
                    color=(0.15, 0.15, 0.15, 1), size_hint_y=None, height=dp(30),
                    halign="left", valign="middle")
        sec.bind(size=sec.setter("text_size"))
        root.add_widget(sec)

        scroll = ScrollView()
        grid = GridLayout(cols=2, spacing=dp(10), size_hint_y=None, padding=[0, dp(4)])
        grid.bind(minimum_height=grid.setter("height"))

        self.card_customers = StatCard("客户总数", "0", (0.094, 0.565, 1))
        self.card_orders = StatCard("订单总数", "0", (0.322, 0.769, 0.102))
        self.card_active = StatCard("在贷订单", "0", (0.98, 0.678, 0.078))
        self.card_overdue = StatCard("逾期笔数", "0", (1, 0.3, 0.31))
        self.card_inventory = StatCard("在库物品", "0", (0.447, 0.18, 0.82))
        self.card_appts = StatCard("待处理预约", "0", (0.075, 0.761, 0.761))
        self.card_expense = StatCard("支出总额", "¥0", (1, 0.3, 0.31))

        for card in [self.card_customers, self.card_orders, self.card_active, self.card_overdue,
                     self.card_inventory, self.card_appts, self.card_expense]:
            grid.add_widget(card)

        scroll.add_widget(grid)
        root.add_widget(scroll)
        self.add_widget(root)

    def load_data(self):
        try:
            data = api.dashboard()
            self.card_customers.set_value(str(data.get("customer_count", 0)))
            self.card_orders.set_value(str(data.get("order_count", 0)))
            self.card_active.set_value(str(data.get("active_orders", 0)))
            self.card_overdue.set_value(str(data.get("overdue_count", 0)))
            self.card_inventory.set_value(str(data.get("inventory_count", 0)))
            self.card_appts.set_value(str(data.get("pending_appointments", 0)))
            self.card_expense.set_value(f"¥{data.get('total_expense', 0):,.2f}")
            self.gold_banner.set_data(data.get("gold_price"))
        except Exception:
            pass
