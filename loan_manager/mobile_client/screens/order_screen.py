"""Order management screen."""
from datetime import date

from kivy.uix.screenmanager import Screen
from kivy.uix.boxlayout import BoxLayout

from utils.common_widgets import SearchBar, CardList, FormPopup, ConfirmPopup
from api_client import api

DISPLAY_FIELDS = [
    ("日期", "order_date"),
    ("订单编号", "order_no"),
    ("电话", "phone"),
    ("客户经理", "account_manager"),
    ("克重", "weight"),
    ("单价", "unit_price"),
    ("首付金额", "down_payment"),
    ("分期期数", "installment_periods"),
    ("每期金额", "installment_amount"),
    ("状态", "status"),
]

FORM_FIELDS = [
    {"key": "order_date", "label": "日期 (YYYY-MM-DD)", "type": "text", "default": str(date.today())},
    {"key": "order_no", "label": "订单编号(留空自动生成)", "type": "text"},
    {"key": "customer_id", "label": "客户姓名", "type": "customer_search", "display_key": "customer_name", "autofill": ["phone", "id_card", "address", "email", "account_manager", "emergency_contact", "has_overdue", "has_property"]},
    {"key": "phone", "label": "电话", "type": "text"},
    {"key": "id_card", "label": "身份证", "type": "text"},
    {"key": "address", "label": "地址", "type": "text"},
    {"key": "email", "label": "邮箱", "type": "text"},
    {"key": "account_manager", "label": "客户经理", "type": "text"},
    {"key": "emergency_contact", "label": "紧急联系人", "type": "text"},
    {"key": "has_overdue", "label": "是否有当前逾期", "type": "combo", "options": ["否", "是"]},
    {"key": "has_property", "label": "是否有房产", "type": "combo", "options": ["否", "是"]},
    {"key": "weight", "label": "克重(g)", "type": "number"},
    {"key": "unit_price", "label": "单价(元/g)", "type": "number"},
    {"key": "processing_fee", "label": "加工费", "type": "number"},
    {"key": "notary_fee", "label": "公证费", "type": "number"},
    {"key": "down_payment_ratio", "label": "首付比例(%)", "type": "number"},
    {"key": "down_payment", "label": "首付金额", "type": "number"},
    {"key": "installment_periods", "label": "分期期数", "type": "int"},
    {"key": "installment_amount", "label": "每期金额", "type": "number"},
    {"key": "status", "label": "状态", "type": "combo", "options": ["待审核", "已通过", "已放款", "已结清", "逾期"]},
]


class OrderScreen(Screen):
    def __init__(self, **kwargs):
        super().__init__(name="order", **kwargs)
        root = BoxLayout(orientation="vertical")
        self.search_bar = SearchBar(on_search=self._on_search, on_add=self._on_add)
        root.add_widget(self.search_bar)
        self.card_list = CardList()
        root.add_widget(self.card_list)
        self.add_widget(root)

    def load_data(self, keyword=""):
        self.card_list.clear_cards()
        try:
            items = api.list_orders(keyword=keyword)
            for item in items:
                self.card_list.add_card(item, DISPLAY_FIELDS, on_edit=self._on_edit, on_delete=self._on_delete)
        except Exception:
            pass

    def _on_search(self, keyword):
        self.load_data(keyword)

    def _on_add(self):
        FormPopup("新增订单", FORM_FIELDS, on_submit=self._do_create).open()

    def _on_edit(self, data):
        FormPopup("编辑订单", FORM_FIELDS, data=data, on_submit=lambda d: self._do_update(data["id"], d)).open()

    def _on_delete(self, data):
        ConfirmPopup(f"确定删除订单 {data.get('order_no', '')} ?", on_confirm=lambda: self._do_delete(data["id"])).open()

    def _do_create(self, data):
        try:
            api.create_order(data)
            self.load_data()
        except Exception:
            pass

    def _do_update(self, oid, data):
        try:
            api.update_order(oid, data)
            self.load_data()
        except Exception:
            pass

    def _do_delete(self, oid):
        try:
            api.delete_order(oid)
            self.load_data()
        except Exception:
            pass
