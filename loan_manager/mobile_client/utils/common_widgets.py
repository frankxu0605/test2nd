"""Reusable Kivy widgets for mobile UI: data cards, form popups, toolbar."""
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.gridlayout import GridLayout
from kivy.uix.scrollview import ScrollView
from kivy.uix.label import Label
from kivy.uix.button import Button
from kivy.uix.textinput import TextInput
from kivy.uix.popup import Popup
from kivy.uix.spinner import Spinner
from kivy.uix.dropdown import DropDown
from kivy.metrics import dp, sp
from kivy.graphics import Color, RoundedRectangle
from kivy.clock import Clock


class TopBar(BoxLayout):
    """Top navigation bar with title and optional right widget."""

    def __init__(self, title="", right_widget=None, **kwargs):
        super().__init__(orientation="horizontal", size_hint_y=None, height=dp(50), padding=[dp(12), 0], **kwargs)
        with self.canvas.before:
            Color(0.094, 0.082, 0.161, 1)  # #18152A
            self._bg = RoundedRectangle(pos=self.pos, size=self.size)
        self.bind(pos=self._update_bg, size=self._update_bg)

        self.title_label = Label(text=title, font_size=sp(18), color=(1, 1, 1, 1), halign="left", valign="middle")
        self.title_label.bind(size=self.title_label.setter("text_size"))
        self.add_widget(self.title_label)
        if right_widget:
            right_widget.size_hint_x = None
            right_widget.width = dp(100)
            self.add_widget(right_widget)

    def _update_bg(self, *_):
        self._bg.pos = self.pos
        self._bg.size = self.size

    def set_title(self, title):
        self.title_label.text = title


class SearchBar(BoxLayout):
    """Search input + add button toolbar."""

    def __init__(self, on_search=None, on_add=None, **kwargs):
        super().__init__(orientation="horizontal", size_hint_y=None, height=dp(48), spacing=dp(8), padding=[dp(8), dp(6)], **kwargs)
        self.search_input = TextInput(
            hint_text="搜索...", multiline=False, size_hint_x=0.7,
            font_size=sp(14), padding=[dp(10), dp(8)],
        )
        if on_search:
            self.search_input.bind(on_text_validate=lambda _: on_search(self.search_input.text))
        self.add_widget(self.search_input)

        search_btn = Button(text="搜索", size_hint_x=0.15, background_color=(0.094, 0.565, 1, 1), color=(1, 1, 1, 1), font_size=sp(14))
        if on_search:
            search_btn.bind(on_release=lambda _: on_search(self.search_input.text))
        self.add_widget(search_btn)

        add_btn = Button(text="+ 新增", size_hint_x=0.15, background_color=(0.322, 0.769, 0.102, 1), color=(1, 1, 1, 1), font_size=sp(14))
        if on_add:
            add_btn.bind(on_release=lambda _: on_add())
        self.add_widget(add_btn)


class DataCard(BoxLayout):
    """A card displaying key-value pairs with edit/delete buttons."""

    def __init__(self, data, display_fields, on_edit=None, on_delete=None, **kwargs):
        super().__init__(orientation="vertical", size_hint_y=None, padding=[dp(12), dp(8)], spacing=dp(4), **kwargs)
        self.data = data
        self.height = dp(40 + len(display_fields) * 28)

        with self.canvas.before:
            Color(1, 1, 1, 1)
            self._bg = RoundedRectangle(pos=self.pos, size=self.size, radius=[dp(8)])
        self.bind(pos=self._update_bg, size=self._update_bg)

        # Data fields
        for label_text, key in display_fields:
            val = data.get(key, "")
            if val is None:
                val = ""
            row = BoxLayout(orientation="horizontal", size_hint_y=None, height=dp(24))
            lbl = Label(text=f"{label_text}: ", font_size=sp(13), color=(0.5, 0.5, 0.5, 1),
                        size_hint_x=0.35, halign="right", valign="middle")
            lbl.bind(size=lbl.setter("text_size"))
            row.add_widget(lbl)
            val_lbl = Label(text=str(val), font_size=sp(13), color=(0.1, 0.1, 0.1, 1),
                            size_hint_x=0.65, halign="left", valign="middle")
            val_lbl.bind(size=val_lbl.setter("text_size"))
            row.add_widget(val_lbl)
            self.add_widget(row)

        # Buttons
        btn_row = BoxLayout(orientation="horizontal", size_hint_y=None, height=dp(34), spacing=dp(8))
        btn_row.add_widget(BoxLayout())  # spacer

        if on_edit:
            edit_btn = Button(text="编辑", size_hint_x=None, width=dp(60), font_size=sp(13),
                              background_color=(0.094, 0.565, 1, 1), color=(1, 1, 1, 1))
            edit_btn.bind(on_release=lambda _: on_edit(data))
            btn_row.add_widget(edit_btn)

        if on_delete:
            del_btn = Button(text="删除", size_hint_x=None, width=dp(60), font_size=sp(13),
                             background_color=(1, 0.3, 0.31, 1), color=(1, 1, 1, 1))
            del_btn.bind(on_release=lambda _: on_delete(data))
            btn_row.add_widget(del_btn)

        self.add_widget(btn_row)

    def _update_bg(self, *_):
        self._bg.pos = self.pos
        self._bg.size = self.size


class CardList(ScrollView):
    """Scrollable list of DataCards."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.container = GridLayout(cols=1, spacing=dp(8), padding=[dp(8), dp(8)], size_hint_y=None)
        self.container.bind(minimum_height=self.container.setter("height"))
        self.add_widget(self.container)

    def clear_cards(self):
        self.container.clear_widgets()

    def add_card(self, data, display_fields, on_edit=None, on_delete=None):
        card = DataCard(data, display_fields, on_edit=on_edit, on_delete=on_delete)
        self.container.add_widget(card)


class FormPopup(Popup):
    """Dynamic form popup for create/edit operations."""

    def __init__(self, title, fields, data=None, on_submit=None, **kwargs):
        self.fields = fields
        self.widgets = {}
        self.on_submit = on_submit

        content = BoxLayout(orientation="vertical", spacing=dp(8), padding=[dp(12), dp(8)])

        scroll = ScrollView(size_hint_y=1)
        form = GridLayout(cols=1, spacing=dp(6), size_hint_y=None, padding=[0, dp(4)])
        form.bind(minimum_height=form.setter("height"))

        for field in fields:
            key = field["key"]
            label = field["label"]
            ftype = field.get("type", "text")
            options = field.get("options", [])

            row = BoxLayout(orientation="vertical", size_hint_y=None, height=dp(64), padding=[0, dp(2)])
            lbl = Label(text=label, font_size=sp(13), color=(0.3, 0.3, 0.3, 1),
                        size_hint_y=None, height=dp(22), halign="left", valign="middle")
            lbl.bind(size=lbl.setter("text_size"))
            row.add_widget(lbl)

            if ftype == "combo":
                w = Spinner(
                    text=str(data.get(key, options[0] if options else "")) if data else (options[0] if options else ""),
                    values=options, font_size=sp(14), size_hint_y=None, height=dp(38),
                )
            elif ftype == "textarea":
                w = TextInput(
                    text=str(data.get(key, "") or "") if data else "",
                    multiline=True, font_size=sp(14), size_hint_y=None, height=dp(60),
                )
                row.height = dp(86)
            elif ftype == "customer_search":
                display_key = field.get("display_key", "customer_name")
                default_display = str(data.get(display_key, "") or "") if data else ""
                default_id = str(data.get(key, "") or "") if data else ""
                w = TextInput(
                    text=default_display, multiline=False, font_size=sp(14),
                    size_hint_y=None, height=dp(38), padding=[dp(8), dp(6)],
                    hint_text="输入客户姓名搜索...",
                )
                w._customer_id = default_id
                w._autofill = field.get("autofill", [])
                w._search_event = None
                w._dropdown = None

                def _make_search_cb(ti):
                    def _on_text(instance, text):
                        if ti._search_event:
                            ti._search_event.cancel()
                        ti._search_event = Clock.schedule_once(
                            lambda dt: self._do_customer_search(ti, text), 0.5
                        )
                    return _on_text

                w.bind(text=_make_search_cb(w))
            else:
                default_val = ""
                if data and key in data and data[key] is not None:
                    default_val = str(data[key])
                w = TextInput(
                    text=default_val, multiline=False, font_size=sp(14),
                    size_hint_y=None, height=dp(38), padding=[dp(8), dp(6)],
                )
                if ftype in ("number", "rate", "int"):
                    w.input_filter = "float" if ftype in ("number", "rate") else "int"
            self.widgets[key] = (w, ftype)
            row.add_widget(w)
            form.add_widget(row)

        scroll.add_widget(form)
        content.add_widget(scroll)

        # Buttons
        btn_row = BoxLayout(orientation="horizontal", size_hint_y=None, height=dp(44), spacing=dp(12))
        cancel_btn = Button(text="取消", font_size=sp(14), background_color=(0.7, 0.7, 0.7, 1))
        cancel_btn.bind(on_release=lambda _: self.dismiss())
        btn_row.add_widget(cancel_btn)

        ok_btn = Button(text="确定", font_size=sp(14), background_color=(0.094, 0.565, 1, 1), color=(1, 1, 1, 1))
        ok_btn.bind(on_release=lambda _: self._on_ok())
        btn_row.add_widget(ok_btn)
        content.add_widget(btn_row)

        super().__init__(title=title, content=content, size_hint=(0.9, 0.85), **kwargs)

    def _do_customer_search(self, text_input, keyword):
        keyword = keyword.strip()
        if not keyword:
            return
        try:
            from api_client import api
            customers = api.list_customers(keyword=keyword)
        except Exception:
            return

        if hasattr(text_input, '_dropdown') and text_input._dropdown:
            text_input._dropdown.dismiss()

        dropdown = DropDown()
        text_input._dropdown = dropdown

        if not customers:
            btn = Button(text="  无匹配客户", size_hint_y=None, height=dp(40),
                         background_color=(0.95, 0.95, 0.95, 1), color=(0.5, 0.5, 0.5, 1),
                         font_size=sp(13))
            dropdown.add_widget(btn)
        else:
            for c in customers[:10]:
                display = f"  {c['name']}   {c.get('phone', '')}"
                btn = Button(text=display, size_hint_y=None, height=dp(44),
                             background_color=(1, 1, 1, 1), color=(0.1, 0.1, 0.1, 1),
                             font_size=sp(14), halign="left")

                def _on_select(inst, customer=c):
                    text_input.text = customer['name']
                    text_input._customer_id = str(customer['id'])
                    dropdown.dismiss()
                    for fill_key in text_input._autofill:
                        if fill_key in self.widgets:
                            target_w, _ = self.widgets[fill_key]
                            target_w.text = str(customer.get(fill_key, "") or "")

                btn.bind(on_release=_on_select)
                dropdown.add_widget(btn)

        dropdown.open(text_input)

    def _on_ok(self):
        result = {}
        for key, (widget, ftype) in self.widgets.items():
            if ftype == "combo":
                result[key] = widget.text
            elif ftype == "textarea":
                result[key] = widget.text
            elif ftype == "int":
                try:
                    result[key] = int(widget.text) if widget.text else 0
                except ValueError:
                    result[key] = 0
            elif ftype == "customer_search":
                try:
                    result[key] = int(widget._customer_id) if widget._customer_id else 0
                except ValueError:
                    result[key] = 0
            elif ftype in ("number", "rate"):
                try:
                    result[key] = float(widget.text) if widget.text else 0.0
                except ValueError:
                    result[key] = 0.0
            else:
                result[key] = widget.text
        self.dismiss()
        if self.on_submit:
            self.on_submit(result)


class ConfirmPopup(Popup):
    """Confirm action popup."""

    def __init__(self, message, on_confirm=None, **kwargs):
        content = BoxLayout(orientation="vertical", spacing=dp(12), padding=[dp(16), dp(12)])
        content.add_widget(Label(text=message, font_size=sp(15), color=(0.2, 0.2, 0.2, 1)))

        btn_row = BoxLayout(orientation="horizontal", size_hint_y=None, height=dp(42), spacing=dp(12))
        cancel_btn = Button(text="取消", font_size=sp(14), background_color=(0.7, 0.7, 0.7, 1))
        cancel_btn.bind(on_release=lambda _: self.dismiss())
        btn_row.add_widget(cancel_btn)

        ok_btn = Button(text="确定", font_size=sp(14), background_color=(1, 0.3, 0.31, 1), color=(1, 1, 1, 1))
        ok_btn.bind(on_release=lambda _: self._confirm(on_confirm))
        btn_row.add_widget(ok_btn)
        content.add_widget(btn_row)

        super().__init__(title="确认操作", content=content, size_hint=(0.8, 0.35), **kwargs)

    def _confirm(self, callback):
        self.dismiss()
        if callback:
            callback()


class StatCard(BoxLayout):
    """Dashboard stat card."""

    def __init__(self, title="", value="0", color_rgb=(0.094, 0.565, 1), **kwargs):
        super().__init__(orientation="vertical", size_hint_y=None, height=dp(80), padding=[dp(12), dp(8)], **kwargs)
        with self.canvas.before:
            Color(*color_rgb, 0.1)
            self._bg = RoundedRectangle(pos=self.pos, size=self.size, radius=[dp(8)])
        self.bind(pos=self._update_bg, size=self._update_bg)

        self.title_label = Label(text=title, font_size=sp(12), color=(0.5, 0.5, 0.5, 1),
                                 halign="left", valign="middle", size_hint_y=0.4)
        self.title_label.bind(size=self.title_label.setter("text_size"))
        self.add_widget(self.title_label)

        self.value_label = Label(text=str(value), font_size=sp(22), bold=True,
                                 color=(*color_rgb, 1), halign="left", valign="middle", size_hint_y=0.6)
        self.value_label.bind(size=self.value_label.setter("text_size"))
        self.add_widget(self.value_label)

    def set_value(self, value):
        self.value_label.text = str(value)

    def _update_bg(self, *_):
        self._bg.pos = self.pos
        self._bg.size = self.size
