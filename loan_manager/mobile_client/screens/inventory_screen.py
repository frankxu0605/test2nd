"""Inventory management screen."""
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
    ("状态", "status"),
]

FORM_FIELDS = [
    {"key": "item_name", "label": "物品名称", "type": "text"},
    {"key": "item_type", "label": "物品类型", "type": "combo", "options": ["房产", "车辆", "珠宝", "设备", "其他"]},
    {"key": "quantity", "label": "当前数量", "type": "int"},
    {"key": "unit_value", "label": "单位价值", "type": "number"},
    {"key": "total_value", "label": "总价值", "type": "number"},
    {"key": "location", "label": "存放位置", "type": "text"},
    {"key": "status", "label": "状态", "type": "combo", "options": ["在库", "已出库", "已处置"]},
]


class InventoryScreen(Screen):
    def __init__(self, **kwargs):
        super().__init__(name="inventory", **kwargs)
        root = BoxLayout(orientation="vertical")
        self.search_bar = SearchBar(on_search=self._on_search, on_add=self._on_add)
        root.add_widget(self.search_bar)
        self.card_list = CardList()
        root.add_widget(self.card_list)
        self.add_widget(root)

    def load_data(self, keyword=""):
        self.card_list.clear_cards()
        try:
            items = api.list_inventory(keyword=keyword)
            for item in items:
                self.card_list.add_card(item, DISPLAY_FIELDS, on_edit=self._on_edit, on_delete=self._on_delete)
        except Exception:
            pass

    def _on_search(self, keyword):
        self.load_data(keyword)

    def _on_add(self):
        FormPopup("新增库存", FORM_FIELDS, on_submit=self._do_create).open()

    def _on_edit(self, data):
        FormPopup("编辑库存", FORM_FIELDS, data=data, on_submit=lambda d: self._do_update(data["id"], d)).open()

    def _on_delete(self, data):
        ConfirmPopup(f"确定删除 {data.get('item_name', '')} ?", on_confirm=lambda: self._do_delete(data["id"])).open()

    def _do_create(self, data):
        try:
            api.create_inventory(data)
            self.load_data()
        except Exception:
            pass

    def _do_update(self, iid, data):
        try:
            api.update_inventory(iid, data)
            self.load_data()
        except Exception:
            pass

    def _do_delete(self, iid):
        try:
            api.delete_inventory(iid)
            self.load_data()
        except Exception:
            pass
