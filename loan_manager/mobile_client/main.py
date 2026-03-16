"""Kivy mobile app entry point for the loan management system."""
import os
import sys

# Add mobile_client to path so imports work both locally and when packaged
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from kivy.app import App
from kivy.uix.screenmanager import ScreenManager, FadeTransition
from kivy.core.window import Window
from kivy.core.text import LabelBase

from screens.login_screen import LoginScreen
from screens.main_screen import MainScreen


class LoanManagerApp(App):
    title = "黄金分期管理系统"

    def build(self):
        # Register bundled Chinese font (overrides default 'Roboto') if present
        font_path = os.path.join(os.path.dirname(__file__), "fonts", "NotoSansSC-Regular.ttf")
        if os.path.exists(font_path):
            LabelBase.register(name="Roboto", fn_regular=font_path)
        # Set window size for desktop testing (ignored on Android)
        Window.size = (400, 700)

        self.sm = ScreenManager(transition=FadeTransition(duration=0.3))
        self.sm.add_widget(LoginScreen())
        self.sm.add_widget(MainScreen(app_root=self.sm))
        return self.sm


if __name__ == "__main__":
    LoanManagerApp().run()
