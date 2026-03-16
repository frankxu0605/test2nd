"""Main screen with bottom navigation bar."""
from kivy.uix.screenmanager import Screen, ScreenManager, SlideTransition
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.uix.popup import Popup
from kivy.metrics import dp, sp
from kivy.graphics import Color, Rectangle

from utils.common_widgets import TopBar
from screens.dashboard_screen import DashboardScreen
from screens.customer_screen import CustomerScreen
from screens.order_screen import OrderScreen
from screens.repayment_screen import RepaymentScreen
from screens.warehouse_screen import WarehouseScreen
from screens.inventory_screen import InventoryScreen
from screens.appointment_screen import AppointmentScreen
from screens.expense_screen import ExpenseScreen
from api_client import api


NAV_ITEMS = [
    ("首页", "dashboard"),
    ("客户", "customer"),
    ("订单", "order"),
    ("还款", "repayment"),
    ("更多", "more"),
]

MORE_ITEMS = [
    ("入库管理", "warehouse"),
    ("库存管理", "inventory"),
    ("预约管理", "appointment"),
    ("支出明细", "expense"),
]

SCREEN_CLASSES = {
    "dashboard": DashboardScreen,
    "customer": CustomerScreen,
    "order": OrderScreen,
    "repayment": RepaymentScreen,
    "warehouse": WarehouseScreen,
    "inventory": InventoryScreen,
    "appointment": AppointmentScreen,
    "expense": ExpenseScreen,
}

SCREEN_TITLES = {
    "dashboard": "首页概览",
    "customer": "客户信息",
    "order": "订单管理",
    "repayment": "还款计划",
    "warehouse": "入库管理",
    "inventory": "库存管理",
    "appointment": "预约管理",
    "expense": "支出明细",
}


class MainScreen(Screen):
    def __init__(self, app_root=None, **kwargs):
        super().__init__(name="main", **kwargs)
        self.app_root = app_root
        self._build_ui()

    def _build_ui(self):
        root = BoxLayout(orientation="vertical")

        # Top bar
        logout_btn = Button(text="退出", font_size=sp(13), size_hint=(None, None),
                            size=(dp(60), dp(34)), background_color=(1, 0.3, 0.31, 1), color=(1, 1, 1, 1))
        logout_btn.bind(on_release=lambda _: self._on_logout())
        self.top_bar = TopBar(title="首页概览", right_widget=logout_btn)
        root.add_widget(self.top_bar)

        # Content area (inner ScreenManager)
        self.content_sm = ScreenManager(transition=SlideTransition(duration=0.2))
        for name, cls in SCREEN_CLASSES.items():
            self.content_sm.add_widget(cls())
        root.add_widget(self.content_sm)

        # Bottom nav bar
        bottom_bar = BoxLayout(orientation="horizontal", size_hint_y=None, height=dp(54), spacing=0)
        with bottom_bar.canvas.before:
            Color(0.96, 0.96, 0.96, 1)
            self._bb_bg = Rectangle(pos=bottom_bar.pos, size=bottom_bar.size)
        bottom_bar.bind(pos=self._update_bb, size=self._update_bb)

        self.nav_buttons = {}
        for label, name in NAV_ITEMS:
            btn = Button(
                text=label, font_size=sp(13),
                background_color=(0, 0, 0, 0),
                color=(0.5, 0.5, 0.5, 1) if name != "dashboard" else (0.094, 0.565, 1, 1),
            )
            btn.bind(on_release=lambda _, n=name: self._switch_tab(n))
            self.nav_buttons[name] = btn
            bottom_bar.add_widget(btn)

        root.add_widget(bottom_bar)
        self.add_widget(root)

    def _update_bb(self, widget, *_):
        self._bb_bg.pos = widget.pos
        self._bb_bg.size = widget.size

    def _switch_tab(self, name):
        if name == "more":
            self._show_more_menu()
            return

        if name in SCREEN_CLASSES:
            self.content_sm.current = name
            self.top_bar.set_title(SCREEN_TITLES.get(name, ""))
            # Refresh data
            screen = self.content_sm.get_screen(name)
            if hasattr(screen, "load_data"):
                screen.load_data()

        # Update button colors
        for btn_name, btn in self.nav_buttons.items():
            if btn_name == name:
                btn.color = (0.094, 0.565, 1, 1)
            elif btn_name != "more":
                btn.color = (0.5, 0.5, 0.5, 1)

    def _show_more_menu(self):
        content = BoxLayout(orientation="vertical", spacing=dp(8), padding=[dp(12), dp(8)])
        for label, name in MORE_ITEMS:
            btn = Button(
                text=label, font_size=sp(15), size_hint_y=None, height=dp(44),
                background_color=(0.094, 0.565, 1, 1), color=(1, 1, 1, 1),
            )
            btn.bind(on_release=lambda _, n=name: self._select_more(n))
            content.add_widget(btn)
        content.add_widget(BoxLayout())  # spacer

        self._more_popup = Popup(title="更多功能", content=content, size_hint=(0.8, 0.5))
        self._more_popup.open()

    def _select_more(self, name):
        if hasattr(self, "_more_popup"):
            self._more_popup.dismiss()
        self._switch_tab(name)

    def _on_logout(self):
        api.token = ""
        api.user_info = {}
        if self.app_root:
            self.app_root.current = "login"

    def on_enter(self):
        # Load dashboard data when entering main screen
        screen = self.content_sm.get_screen("dashboard")
        if hasattr(screen, "load_data"):
            screen.load_data()
