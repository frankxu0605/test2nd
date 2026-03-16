"""Customer management screen."""
from kivy.uix.screenmanager import Screen
from kivy.uix.boxlayout import BoxLayout
from kivy.metrics import dp

from utils.common_widgets import SearchBar, CardList, FormPopup, ConfirmPopup
from api_client import api

DISPLAY_FIELDS = [
    ("姓名", "name"),
    ("电话", "phone"),
    ("身份证", "id_card"),
    ("地址", "address"),
    ("邮箱", "email"),
    ("客户经理", "account_manager"),
    ("紧急联系人", "emergency_contact"),
    ("当前逾期", "has_overdue"),
    ("有房产", "has_property"),
]

FORM_FIELDS = [
    {"key": "name", "label": "客户姓名", "type": "text"},
    {"key": "phone", "label": "联系电话", "type": "text"},
    {"key": "id_card", "label": "身份证号", "type": "text"},
    {"key": "address", "label": "地址", "type": "text"},
    {"key": "email", "label": "邮箱", "type": "text"},
    {"key": "account_manager", "label": "客户经理", "type": "text"},
    {"key": "emergency_contact", "label": "紧急联系人", "type": "text"},
    {"key": "has_overdue", "label": "是否有当前逾期", "type": "combo", "options": ["否", "是"]},
    {"key": "has_property", "label": "是否有房产", "type": "combo", "options": ["否", "是"]},
]


class CustomerScreen(Screen):
    def __init__(self, **kwargs):
        super().__init__(name="customer", **kwargs)
        root = BoxLayout(orientation="vertical")
        self.search_bar = SearchBar(on_search=self._on_search, on_add=self._on_add)
        root.add_widget(self.search_bar)
        self.card_list = CardList()
        root.add_widget(self.card_list)
        self.add_widget(root)

    def load_data(self, keyword=""):
        self.card_list.clear_cards()
        try:
            items = api.list_customers(keyword=keyword)
            for item in items:
                self.card_list.add_card(item, DISPLAY_FIELDS, on_edit=self._on_edit, on_delete=self._on_delete)
        except Exception:
            pass

    def _on_search(self, keyword):
        self.load_data(keyword)

    def _on_add(self):
        FormPopup("新增客户", FORM_FIELDS, on_submit=self._do_create).open()

    def _on_edit(self, data):
        FormPopup("编辑客户", FORM_FIELDS, data=data, on_submit=lambda d: self._do_update(data["id"], d)).open()

    def _on_delete(self, data):
        ConfirmPopup(f"确定删除客户 {data.get('name', '')} ?", on_confirm=lambda: self._do_delete(data["id"])).open()

    def _do_create(self, data):
        try:
            api.create_customer(data)
            self.load_data()
        except Exception:
            pass

    def _do_update(self, cid, data):
        try:
            api.update_customer(cid, data)
            self.load_data()
        except Exception:
            pass

    def _do_delete(self, cid):
        try:
            api.delete_customer(cid)
            self.load_data()
        except Exception:
            pass
