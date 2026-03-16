"""Appointment management screen."""
from kivy.uix.screenmanager import Screen
from kivy.uix.boxlayout import BoxLayout

from utils.common_widgets import SearchBar, CardList, FormPopup, ConfirmPopup
from api_client import api

DISPLAY_FIELDS = [
    ("客户", "customer_name"),
    ("日期", "appointment_date"),
    ("时间", "appointment_time"),
    ("事由", "purpose"),
    ("状态", "status"),
]

FORM_FIELDS = [
    {"key": "customer_id", "label": "客户姓名", "type": "customer_search", "display_key": "customer_name", "autofill": []},
    {"key": "appointment_date", "label": "预约日期 (YYYY-MM-DD)", "type": "text"},
    {"key": "appointment_time", "label": "预约时间 (HH:MM:SS)", "type": "text"},
    {"key": "purpose", "label": "预约事由", "type": "text"},
    {"key": "status", "label": "状态", "type": "combo", "options": ["待确认", "已确认", "已完成", "已取消"]},
    {"key": "notes", "label": "备注", "type": "textarea"},
]


class AppointmentScreen(Screen):
    def __init__(self, **kwargs):
        super().__init__(name="appointment", **kwargs)
        root = BoxLayout(orientation="vertical")
        self.search_bar = SearchBar(on_search=self._on_search, on_add=self._on_add)
        root.add_widget(self.search_bar)
        self.card_list = CardList()
        root.add_widget(self.card_list)
        self.add_widget(root)

    def load_data(self, keyword=""):
        self.card_list.clear_cards()
        try:
            items = api.list_appointments()
            for item in items:
                self.card_list.add_card(item, DISPLAY_FIELDS, on_edit=self._on_edit, on_delete=self._on_delete)
        except Exception:
            pass

    def _on_search(self, keyword):
        self.load_data(keyword)

    def _on_add(self):
        FormPopup("新增预约", FORM_FIELDS, on_submit=self._do_create).open()

    def _on_edit(self, data):
        FormPopup("编辑预约", FORM_FIELDS, data=data, on_submit=lambda d: self._do_update(data["id"], d)).open()

    def _on_delete(self, data):
        ConfirmPopup("确定删除此预约?", on_confirm=lambda: self._do_delete(data["id"])).open()

    def _do_create(self, data):
        try:
            api.create_appointment(data)
            self.load_data()
        except Exception:
            pass

    def _do_update(self, aid, data):
        try:
            update = {k: data[k] for k in ("appointment_date", "appointment_time", "purpose", "status", "notes") if k in data}
            api.update_appointment(aid, update)
            self.load_data()
        except Exception:
            pass

    def _do_delete(self, aid):
        try:
            api.delete_appointment(aid)
            self.load_data()
        except Exception:
            pass
