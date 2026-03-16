"""Expense management screen."""
from kivy.uix.screenmanager import Screen
from kivy.uix.boxlayout import BoxLayout

from utils.common_widgets import SearchBar, CardList, FormPopup, ConfirmPopup
from api_client import api

DISPLAY_FIELDS = [
    ("日期", "expense_date"),
    ("类别", "category"),
    ("金额", "amount"),
    ("描述", "description"),
    ("经手人", "operator"),
]

FORM_FIELDS = [
    {"key": "expense_date", "label": "支出日期 (YYYY-MM-DD)", "type": "text"},
    {"key": "category", "label": "支出类别", "type": "combo", "options": ["办公费用", "人工成本", "房租水电", "交通费", "招待费", "税费", "其他"]},
    {"key": "amount", "label": "金额", "type": "number"},
    {"key": "description", "label": "描述", "type": "text"},
    {"key": "operator", "label": "经手人", "type": "text"},
]


class ExpenseScreen(Screen):
    def __init__(self, **kwargs):
        super().__init__(name="expense", **kwargs)
        root = BoxLayout(orientation="vertical")
        self.search_bar = SearchBar(on_search=self._on_search, on_add=self._on_add)
        root.add_widget(self.search_bar)
        self.card_list = CardList()
        root.add_widget(self.card_list)
        self.add_widget(root)

    def load_data(self, keyword=""):
        self.card_list.clear_cards()
        try:
            items = api.list_expenses(keyword=keyword)
            for item in items:
                self.card_list.add_card(item, DISPLAY_FIELDS, on_edit=self._on_edit, on_delete=self._on_delete)
        except Exception:
            pass

    def _on_search(self, keyword):
        self.load_data(keyword)

    def _on_add(self):
        FormPopup("新增支出", FORM_FIELDS, on_submit=self._do_create).open()

    def _on_edit(self, data):
        FormPopup("编辑支出", FORM_FIELDS, data=data, on_submit=lambda d: self._do_update(data["id"], d)).open()

    def _on_delete(self, data):
        ConfirmPopup("确定删除此支出记录?", on_confirm=lambda: self._do_delete(data["id"])).open()

    def _do_create(self, data):
        try:
            api.create_expense(data)
            self.load_data()
        except Exception:
            pass

    def _do_update(self, eid, data):
        try:
            api.update_expense(eid, data)
            self.load_data()
        except Exception:
            pass

    def _do_delete(self, eid):
        try:
            api.delete_expense(eid)
            self.load_data()
        except Exception:
            pass
