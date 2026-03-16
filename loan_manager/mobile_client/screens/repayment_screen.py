"""Repayment plan management screen."""
from kivy.uix.screenmanager import Screen
from kivy.uix.boxlayout import BoxLayout

from utils.common_widgets import SearchBar, CardList, FormPopup, ConfirmPopup
from api_client import api

DISPLAY_FIELDS = [
    ("订单编号", "order_no"),
    ("期数", "period_no"),
    ("应还日期", "due_date"),
    ("应还总额", "total_amount"),
    ("实还金额", "paid_amount"),
    ("状态", "status"),
]

FORM_FIELDS = [
    {"key": "order_id", "label": "订单ID", "type": "int"},
    {"key": "period_no", "label": "期数", "type": "int"},
    {"key": "due_date", "label": "应还日期", "type": "text"},
    {"key": "principal", "label": "应还本金", "type": "number"},
    {"key": "interest", "label": "应还利息", "type": "number"},
    {"key": "total_amount", "label": "应还总额", "type": "number"},
    {"key": "paid_amount", "label": "实还金额", "type": "number"},
    {"key": "paid_date", "label": "实还日期", "type": "text"},
    {"key": "status", "label": "状态", "type": "combo", "options": ["待还", "已还", "逾期"]},
]


class RepaymentScreen(Screen):
    def __init__(self, **kwargs):
        super().__init__(name="repayment", **kwargs)
        root = BoxLayout(orientation="vertical")
        self.search_bar = SearchBar(on_search=self._on_search, on_add=self._on_add)
        root.add_widget(self.search_bar)
        self.card_list = CardList()
        root.add_widget(self.card_list)
        self.add_widget(root)

    def load_data(self, keyword=""):
        self.card_list.clear_cards()
        try:
            items = api.list_repayments()
            for item in items:
                self.card_list.add_card(item, DISPLAY_FIELDS, on_edit=self._on_edit, on_delete=self._on_delete)
        except Exception:
            pass

    def _on_search(self, keyword):
        self.load_data(keyword)

    def _on_add(self):
        FormPopup("新增还款计划", FORM_FIELDS, on_submit=self._do_create).open()

    def _on_edit(self, data):
        FormPopup("编辑还款计划", FORM_FIELDS, data=data, on_submit=lambda d: self._do_update(data["id"], d)).open()

    def _on_delete(self, data):
        ConfirmPopup("确定删除此还款记录?", on_confirm=lambda: self._do_delete(data["id"])).open()

    def _do_create(self, data):
        try:
            api.create_repayment(data)
            self.load_data()
        except Exception:
            pass

    def _do_update(self, rid, data):
        try:
            update = {k: data[k] for k in ("paid_amount", "paid_date", "status") if k in data}
            api.update_repayment(rid, update)
            self.load_data()
        except Exception:
            pass

    def _do_delete(self, rid):
        try:
            api.delete_repayment(rid)
            self.load_data()
        except Exception:
            pass
