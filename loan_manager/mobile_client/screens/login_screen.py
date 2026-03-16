"""Login screen for the mobile client."""
from kivy.uix.screenmanager import Screen
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.label import Label
from kivy.uix.textinput import TextInput
from kivy.uix.button import Button
from kivy.uix.popup import Popup
from kivy.uix.spinner import Spinner
from kivy.metrics import dp, sp

from api_client import api
from utils.i18n import t, set_language, get_language


class LoginScreen(Screen):
    def __init__(self, **kwargs):
        super().__init__(name="login", **kwargs)
        self._build_ui()

    def _build_ui(self):
        root = BoxLayout(orientation="vertical", padding=[dp(40), dp(60)], spacing=dp(16))

        # Title + language selector row
        top_row = BoxLayout(orientation="horizontal", size_hint_y=None, height=dp(50))
        title = Label(text=t("title"), font_size=sp(24), bold=True,
                      color=(0.094, 0.082, 0.161, 1), size_hint_x=0.85)
        lang_spinner = Spinner(
            text=("中文" if get_language() == "zh" else "English"),
            values=("中文", "English"), size_hint_x=0.15
        )

        def _on_lang_select(spinner, val):
            lang_code = "zh" if val == "中文" else "en"
            set_language(lang_code)
            # update visible texts
            title.text = t("title")
            username_lbl.text = t("username")
            self.username_input.hint_text = t("username_hint")
            password_lbl.text = t("password")
            self.password_input.hint_text = t("password_hint")
            login_btn.text = t("login")
            hint.text = t("default_admin")

        lang_spinner.bind(text=_on_lang_select)
        top_row.add_widget(title)
        top_row.add_widget(lang_spinner)
        root.add_widget(top_row)
        root.add_widget(BoxLayout(size_hint_y=None, height=dp(20)))  # spacer

        # Username
        username_lbl = Label(text=t("username"), font_size=sp(13), color=(0.4, 0.4, 0.4, 1),
                               size_hint_y=None, height=dp(22), halign="left")
        root.add_widget(username_lbl)
        self.username_input = TextInput(
            hint_text=t("username_hint"), multiline=False, font_size=sp(14),
            size_hint_y=None, height=dp(42), padding=[dp(10), dp(8)],
        )
        root.add_widget(self.username_input)

        # Password
        password_lbl = Label(text=t("password"), font_size=sp(13), color=(0.4, 0.4, 0.4, 1),
                               size_hint_y=None, height=dp(22), halign="left")
        root.add_widget(password_lbl)
        self.password_input = TextInput(
            hint_text=t("password_hint"), multiline=False, password=True, font_size=sp(14),
            size_hint_y=None, height=dp(42), padding=[dp(10), dp(8)],
        )
        root.add_widget(self.password_input)
        root.add_widget(BoxLayout(size_hint_y=None, height=dp(12)))

        # Login button
        login_btn = Button(
            text=t("login"), font_size=sp(16), size_hint_y=None, height=dp(46),
            background_color=(0.094, 0.565, 1, 1), color=(1, 1, 1, 1),
        )
        login_btn.bind(on_release=lambda _: self._on_login())
        root.add_widget(login_btn)

        # Hint
        hint = Label(text=t("default_admin"), font_size=sp(12),
                  color=(0.6, 0.6, 0.6, 1), size_hint_y=None, height=dp(30))
        root.add_widget(hint)

        root.add_widget(BoxLayout())  # bottom spacer

        self.add_widget(root)

    def _on_login(self):
        username = self.username_input.text.strip()
        password = self.password_input.text.strip()

        if not username or not password:
            self._show_msg(t("enter_credentials"))
            return

        try:
            api.login(username, password)
            self.manager.current = "main"
        except Exception as e:
            err = str(e)
            if "401" in err:
                err = t("login_failed")
            elif "Connection" in err:
                err = t("cannot_connect")
            self._show_msg(err)

    def _show_msg(self, msg):
        popup = Popup(
            title=t("tip"),
            content=Label(text=msg, font_size=sp(14), color=(0.2, 0.2, 0.2, 1)),
            size_hint=(0.8, 0.3),
        )
        popup.open()
