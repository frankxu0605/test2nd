"""Warehouse entry management screen."""
from kivy.uix.screenmanager import Screen
from kivy.uix.boxlayout import BoxLayout

from utils.common_widgets import SearchBar, CardList, FormPopup, ConfirmPopup
from api_client import api

DISPLAY_FIELDS = [
    ("物品名称", "item_name"),
    ("类型", "item_type"),
    ("数量", "quantity"),
    ("总价值", "total_value"),
    ("位置", "location"),
    ("入库日期", "entry_date"),
    ("操作人", "operator"),
]

FORM_FIELDS = [
    {"key": "order_id", "label": "关联订单ID", "type": "int"},
    {"key": "item_name", "label": "物品名称", "type": "text"},
    {"key": "item_type", "label": "物品类型", "type": "combo", "options": ["房产", "车辆", "珠宝", "设备", "其他"]},
    {"key": "quantity", "label": "数量", "type": "int"},
    {"key": "unit_value", "label": "单位价值", "type": "number"},
    {"key": "total_value", "label": "总价值", "type": "number"},
    {"key": "location", "label": "存放位置", "type": "text"},
    {"key": "entry_date", "label": "入库日期 (YYYY-MM-DD)", "type": "text"},
    {"key": "operator", "label": "操作人", "type": "text"},
]


class WarehouseScreen(Screen):
    def __init__(self, **kwargs):
        super().__init__(name="warehouse", **kwargs)
        root = BoxLayout(orientation="vertical")
        self.search_bar = SearchBar(on_search=self._on_search, on_add=self._on_add)
        root.add_widget(self.search_bar)
        self.card_list = CardList()
        root.add_widget(self.card_list)
        self.add_widget(root)

    def load_data(self, keyword=""):
        self.card_list.clear_cards()
        try:
            items = api.list_warehouse(keyword=keyword)
            for item in items:
                self.card_list.add_card(item, DISPLAY_FIELDS, on_edit=self._on_edit, on_delete=self._on_delete)
        except Exception:
            pass

    def _on_search(self, keyword):
        self.load_data(keyword)

    def _on_add(self):
        FormPopup("新增入库", FORM_FIELDS, on_submit=self._do_create).open()

    def _on_edit(self, data):
        FormPopup("编辑入库", FORM_FIELDS, data=data, on_submit=lambda d: self._do_update(data["id"], d)).open()

    def _on_delete(self, data):
        ConfirmPopup(f"确定删除 {data.get('item_name', '')} ?", on_confirm=lambda: self._do_delete(data["id"])).open()

    def _do_create(self, data):
        try:
            api.create_warehouse_entry(data)
            self.load_data()
        except Exception:
            pass

    def _do_update(self, eid, data):
        try:
            api.update_warehouse_entry(eid, data)
            self.load_data()
        except Exception:
            pass

    def _do_delete(self, eid):
        try:
            api.delete_warehouse_entry(eid)
            self.load_data()
        except Exception:
            pass
