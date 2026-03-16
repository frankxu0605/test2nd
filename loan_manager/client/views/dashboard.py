from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QFrame, QGridLayout,
    QPushButton, QLineEdit, QMessageBox,
)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont
from datetime import date

from ..api_client import api


CARD_STYLE = """
QFrame {{
    background-color: white;
    border-radius: 8px;
    border: 1px solid #e8e8e8;
}}
QLabel#cardTitle {{
    color: #8c8c8c;
    font-size: 13px;
}}
QLabel#cardValue {{
    color: {color};
    font-size: 28px;
    font-weight: bold;
}}
"""

GOLD_BANNER_STYLE = """
QFrame#goldBanner {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 #FFD700, stop:0.5 #FFA500, stop:1 #FF8C00);
    border-radius: 12px;
    border: none;
}
"""


class StatCard(QFrame):
    def __init__(self, title: str, value: str = "0", color: str = "#1890ff"):
        super().__init__()
        self.setFixedHeight(120)
        self.setStyleSheet(CARD_STYLE.format(color=color))

        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 16, 20, 16)

        self.title_label = QLabel(title)
        self.title_label.setObjectName("cardTitle")
        layout.addWidget(self.title_label)

        self.value_label = QLabel(value)
        self.value_label.setObjectName("cardValue")
        layout.addWidget(self.value_label)
        layout.addStretch()

    def set_value(self, value: str):
        self.value_label.setText(value)


class DashboardView(QWidget):
    def __init__(self):
        super().__init__()
        self._init_ui()
        self.load_data()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)

        # ---- Gold price banner ----
        self.gold_banner = QFrame()
        self.gold_banner.setObjectName("goldBanner")
        self.gold_banner.setFixedHeight(100)
        self.gold_banner.setStyleSheet(GOLD_BANNER_STYLE)

        gold_layout = QHBoxLayout(self.gold_banner)
        gold_layout.setContentsMargins(24, 12, 24, 12)

        gold_left = QVBoxLayout()
        gold_title = QLabel("今日黄金价格")
        gold_title.setFont(QFont("Microsoft YaHei", 11))
        gold_title.setStyleSheet("color: rgba(255,255,255,0.85); background: transparent;")
        gold_left.addWidget(gold_title)

        self.gold_price_label = QLabel("--")
        self.gold_price_label.setFont(QFont("Microsoft YaHei", 26, QFont.Weight.Bold))
        self.gold_price_label.setStyleSheet("color: white; background: transparent;")
        gold_left.addWidget(self.gold_price_label)

        self.gold_date_label = QLabel("")
        self.gold_date_label.setFont(QFont("Microsoft YaHei", 9))
        self.gold_date_label.setStyleSheet("color: rgba(255,255,255,0.7); background: transparent;")
        gold_left.addWidget(self.gold_date_label)

        gold_layout.addLayout(gold_left)
        gold_layout.addStretch()

        # Right side: sell price + update
        gold_right = QVBoxLayout()
        gold_right.setSpacing(6)

        self.gold_sell_label = QLabel("回收价: --")
        self.gold_sell_label.setFont(QFont("Microsoft YaHei", 12))
        self.gold_sell_label.setStyleSheet("color: rgba(255,255,255,0.9); background: transparent;")
        gold_right.addWidget(self.gold_sell_label, alignment=Qt.AlignmentFlag.AlignRight)

        # Inline update row
        update_row = QHBoxLayout()
        update_row.setSpacing(6)
        self.gold_buy_input = QLineEdit()
        self.gold_buy_input.setPlaceholderText("买入价")
        self.gold_buy_input.setFixedSize(80, 28)
        self.gold_buy_input.setStyleSheet("background: rgba(255,255,255,0.9); border-radius: 4px; padding: 0 6px; font-size: 12px;")
        update_row.addWidget(self.gold_buy_input)

        self.gold_sell_input = QLineEdit()
        self.gold_sell_input.setPlaceholderText("回收价")
        self.gold_sell_input.setFixedSize(80, 28)
        self.gold_sell_input.setStyleSheet("background: rgba(255,255,255,0.9); border-radius: 4px; padding: 0 6px; font-size: 12px;")
        update_row.addWidget(self.gold_sell_input)

        update_btn = QPushButton("更新")
        update_btn.setFixedSize(50, 28)
        update_btn.setStyleSheet("background: rgba(255,255,255,0.25); color: white; border: 1px solid rgba(255,255,255,0.5); border-radius: 4px; font-size: 12px;")
        update_btn.clicked.connect(self._on_update_gold)
        update_row.addWidget(update_btn)

        gold_right.addLayout(update_row)
        gold_layout.addLayout(gold_right)

        layout.addWidget(self.gold_banner)
        layout.addSpacing(12)

        # ---- Welcome ----
        welcome = QLabel("业务概览")
        welcome.setFont(QFont("Microsoft YaHei", 15, QFont.Weight.Bold))
        welcome.setStyleSheet("color: #262626;")
        layout.addWidget(welcome)
        layout.addSpacing(4)

        # Stats grid
        grid = QGridLayout()
        grid.setSpacing(16)

        self.card_customers = StatCard("客户总数", "0", "#1890ff")
        self.card_orders = StatCard("订单总数", "0", "#52c41a")
        self.card_active = StatCard("在贷订单", "0", "#faad14")
        self.card_overdue = StatCard("逾期笔数", "0", "#ff4d4f")
        self.card_inventory = StatCard("在库物品", "0", "#722ed1")
        self.card_appointments = StatCard("待处理预约", "0", "#13c2c2")
        self.card_expense_total = StatCard("支出总额", "0", "#ff4d4f")

        grid.addWidget(self.card_customers, 0, 0)
        grid.addWidget(self.card_orders, 0, 1)
        grid.addWidget(self.card_active, 0, 2)
        grid.addWidget(self.card_overdue, 0, 3)
        grid.addWidget(self.card_inventory, 1, 0)
        grid.addWidget(self.card_appointments, 1, 1)
        grid.addWidget(self.card_expense_total, 1, 2)

        layout.addLayout(grid)
        layout.addStretch()

    def load_data(self):
        try:
            data = api.dashboard()
            self.card_customers.set_value(str(data.get("customer_count", 0)))
            self.card_orders.set_value(str(data.get("order_count", 0)))
            self.card_active.set_value(str(data.get("active_orders", 0)))
            self.card_overdue.set_value(str(data.get("overdue_count", 0)))
            self.card_inventory.set_value(str(data.get("inventory_count", 0)))
            self.card_appointments.set_value(str(data.get("pending_appointments", 0)))
            self.card_expense_total.set_value(f"¥{data.get('total_expense', 0):,.2f}")

            gold = data.get("gold_price")
            if gold:
                self.gold_price_label.setText(f"¥{gold['buy_price']:.2f} /g")
                self.gold_sell_label.setText(f"回收价: ¥{gold['sell_price']:.2f} /g")
                self.gold_date_label.setText(f"更新日期: {gold['price_date']}")
            else:
                self.gold_price_label.setText("暂无报价")
                self.gold_sell_label.setText("回收价: --")
                self.gold_date_label.setText("请设置今日金价")
        except Exception:
            pass

    def _on_update_gold(self):
        buy_text = self.gold_buy_input.text().strip()
        sell_text = self.gold_sell_input.text().strip()
        if not buy_text:
            QMessageBox.warning(self, "提示", "请输入买入价")
            return
        try:
            buy = float(buy_text)
            sell = float(sell_text) if sell_text else 0.0
        except ValueError:
            QMessageBox.warning(self, "提示", "请输入有效数字")
            return
        try:
            api.post("/api/gold-price/", {
                "price_date": str(date.today()),
                "buy_price": buy,
                "sell_price": sell,
                "updated_by": api.user_info.get("real_name", ""),
            })
            self.gold_buy_input.clear()
            self.gold_sell_input.clear()
            self.load_data()
        except Exception as e:
            QMessageBox.warning(self, "错误", f"更新失败: {e}")
