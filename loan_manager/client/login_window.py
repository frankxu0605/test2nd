from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
    QPushButton, QMessageBox, QFrame,
)
from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QFont

from .api_client import api


class LoginWindow(QWidget):
    login_success = pyqtSignal()

    def __init__(self):
        super().__init__()
        self.setWindowTitle("黄金分期管理系统 - 登录")
        self.setFixedSize(420, 280)
        self._init_ui()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(40, 30, 40, 30)

        # Title
        title = QLabel("黄金分期管理系统")
        title.setFont(QFont("Microsoft YaHei", 18, QFont.Weight.Bold))
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title)
        layout.addSpacing(20)

        # Username
        user_layout = QHBoxLayout()
        user_layout.addWidget(QLabel("用户名:"))
        self.username_input = QLineEdit()
        self.username_input.setPlaceholderText("请输入用户名")
        user_layout.addWidget(self.username_input)
        layout.addLayout(user_layout)
        layout.addSpacing(8)

        # Password
        pwd_layout = QHBoxLayout()
        pwd_layout.addWidget(QLabel("密  码:"))
        self.password_input = QLineEdit()
        self.password_input.setPlaceholderText("请输入密码")
        self.password_input.setEchoMode(QLineEdit.EchoMode.Password)
        pwd_layout.addWidget(self.password_input)
        layout.addLayout(pwd_layout)
        layout.addSpacing(20)

        # Login button
        self.login_btn = QPushButton("登 录")
        self.login_btn.setFixedHeight(38)
        self.login_btn.setFont(QFont("Microsoft YaHei", 11))
        self.login_btn.setStyleSheet(
            "QPushButton { background-color: #1890ff; color: white; border: none; border-radius: 4px; }"
            "QPushButton:hover { background-color: #40a9ff; }"
            "QPushButton:pressed { background-color: #096dd9; }"
        )
        self.login_btn.clicked.connect(self._on_login)
        layout.addWidget(self.login_btn)

        # Hint
        hint = QLabel("默认管理员账号: admin / admin123")
        hint.setStyleSheet("color: #999;")
        hint.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(hint)

        self.password_input.returnPressed.connect(self._on_login)

    def _on_login(self):
        username = self.username_input.text().strip()
        password = self.password_input.text().strip()

        if not username or not password:
            QMessageBox.warning(self, "提示", "请输入用户名和密码")
            return

        try:
            api.login(username, password)
            self.login_success.emit()
        except Exception as e:
            error_msg = str(e)
            if "401" in error_msg:
                error_msg = "用户名或密码错误"
            elif "Connection" in error_msg:
                error_msg = "无法连接到服务器"
            QMessageBox.critical(self, "登录失败", error_msg)
