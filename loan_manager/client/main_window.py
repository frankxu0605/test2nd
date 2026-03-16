from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QHBoxLayout, QVBoxLayout,
    QListWidget, QListWidgetItem, QStackedWidget, QLabel, QPushButton,
    QFrame, QMessageBox,
)
from PyQt6.QtCore import Qt, QSize
from PyQt6.QtGui import QFont, QIcon

from .api_client import api
from .views.dashboard import DashboardView
from .views.customer_view import CustomerView
from .views.order_view import OrderView
from .views.repayment_view import RepaymentView
from .views.warehouse_view import WarehouseView
from .views.inventory_view import InventoryView
from .views.appointment_view import AppointmentView
from .views.expense_view import ExpenseView


NAV_ITEMS = [
    ("首页概览", DashboardView),
    ("客户信息", CustomerView),
    ("订单管理", OrderView),
    ("还款计划", RepaymentView),
    ("入库管理", WarehouseView),
    ("库存管理", InventoryView),
    ("预约管理", AppointmentView),
    ("支出明细", ExpenseView),
]

STYLE = """
QMainWindow {
    background-color: #f0f2f5;
}
QListWidget#nav {
    background-color: #001529;
    color: white;
    border: none;
    font-size: 14px;
    outline: none;
}
QListWidget#nav::item {
    padding: 14px 20px;
    border: none;
}
QListWidget#nav::item:selected {
    background-color: #1890ff;
    color: white;
}
QListWidget#nav::item:hover:!selected {
    background-color: #002140;
}
QLabel#header {
    font-size: 15px;
    font-weight: bold;
    color: #001529;
    padding: 0 16px;
}
QPushButton#logoutBtn {
    background-color: transparent;
    color: #ff4d4f;
    border: 1px solid #ff4d4f;
    border-radius: 4px;
    padding: 4px 12px;
    font-size: 12px;
}
QPushButton#logoutBtn:hover {
    background-color: #ff4d4f;
    color: white;
}
"""


class MainWindow(QMainWindow):
    def __init__(self, on_logout=None):
        super().__init__()
        self.on_logout = on_logout
        self.setWindowTitle("黄金分期管理系统")
        self.resize(1200, 750)
        self.setStyleSheet(STYLE)
        self._init_ui()

    def _init_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        main_layout = QHBoxLayout(central)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        # ---- Left Nav ----
        nav_container = QWidget()
        nav_container.setFixedWidth(180)
        nav_container.setStyleSheet("background-color: #001529;")
        nav_layout = QVBoxLayout(nav_container)
        nav_layout.setContentsMargins(0, 0, 0, 0)
        nav_layout.setSpacing(0)

        # Logo area
        logo_label = QLabel("黄金分期管理")
        logo_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        logo_label.setStyleSheet("color: white; font-size: 16px; font-weight: bold; padding: 20px 0;")
        nav_layout.addWidget(logo_label)

        line = QFrame()
        line.setFrameShape(QFrame.Shape.HLine)
        line.setStyleSheet("background-color: #003a70; max-height: 1px;")
        nav_layout.addWidget(line)

        self.nav_list = QListWidget()
        self.nav_list.setObjectName("nav")
        for name, _ in NAV_ITEMS:
            item = QListWidgetItem(name)
            item.setSizeHint(QSize(180, 48))
            self.nav_list.addItem(item)
        self.nav_list.setCurrentRow(0)
        self.nav_list.currentRowChanged.connect(self._on_nav_changed)
        nav_layout.addWidget(self.nav_list)
        nav_layout.addStretch()

        main_layout.addWidget(nav_container)

        # ---- Right Content ----
        right = QWidget()
        right_layout = QVBoxLayout(right)
        right_layout.setContentsMargins(0, 0, 0, 0)
        right_layout.setSpacing(0)

        # Header bar
        header = QWidget()
        header.setFixedHeight(50)
        header.setStyleSheet("background-color: white; border-bottom: 1px solid #e8e8e8;")
        header_layout = QHBoxLayout(header)
        header_layout.setContentsMargins(16, 0, 16, 0)

        self.page_title = QLabel("首页概览")
        self.page_title.setObjectName("header")
        header_layout.addWidget(self.page_title)
        header_layout.addStretch()

        user_label = QLabel(f"用户: {api.user_info.get('real_name', '')}")
        user_label.setStyleSheet("color: #666; font-size: 13px; margin-right: 12px;")
        header_layout.addWidget(user_label)

        logout_btn = QPushButton("退出登录")
        logout_btn.setObjectName("logoutBtn")
        logout_btn.clicked.connect(self._on_logout)
        header_layout.addWidget(logout_btn)

        right_layout.addWidget(header)

        # Stacked widget for pages
        self.stack = QStackedWidget()
        self.stack.setStyleSheet("background-color: #f0f2f5;")
        for _, view_cls in NAV_ITEMS:
            self.stack.addWidget(view_cls())
        right_layout.addWidget(self.stack)

        main_layout.addWidget(right)

    def _on_nav_changed(self, index: int):
        self.stack.setCurrentIndex(index)
        self.page_title.setText(NAV_ITEMS[index][0])
        # Refresh data when switching pages
        widget = self.stack.currentWidget()
        if hasattr(widget, "load_data"):
            widget.load_data()

    def _on_logout(self):
        reply = QMessageBox.question(self, "确认", "确定要退出登录吗？")
        if reply == QMessageBox.StandardButton.Yes:
            api.token = ""
            api.user_info = {}
            if self.on_logout:
                self.on_logout()
