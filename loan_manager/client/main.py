import sys

from PyQt6.QtWidgets import QApplication

from .login_window import LoginWindow
from .main_window import MainWindow


class App:
    def __init__(self):
        self.qapp = QApplication(sys.argv)
        self.qapp.setStyle("Fusion")
        self.login_win = None
        self.main_win = None

    def show_login(self):
        if self.main_win:
            self.main_win.close()
            self.main_win = None
        self.login_win = LoginWindow()
        self.login_win.login_success.connect(self._on_login_success)
        self.login_win.show()

    def _on_login_success(self):
        if self.login_win:
            self.login_win.close()
            self.login_win = None
        self.main_win = MainWindow(on_logout=self.show_login)
        self.main_win.show()

    def run(self):
        self.show_login()
        sys.exit(self.qapp.exec())


def main():
    app = App()
    app.run()


if __name__ == "__main__":
    main()
