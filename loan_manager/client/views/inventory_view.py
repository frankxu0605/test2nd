from ..api_client import api
from .base_table_view import BaseTableView


class InventoryView(BaseTableView):
    page_title = "库存管理"
    columns = [
        ("ID", "id", 60),
        ("物品名称", "item_name", 120),
        ("物品类型", "item_type", 100),
        ("当前数量", "quantity", 80),
        ("单位价值", "unit_value", 100),
        ("总价值", "total_value", 100),
        ("存放位置", "location", 100),
        ("状态", "status", 80),
        ("最后更新", "last_updated", 160),
    ]

    def get_form_fields(self):
        return [
            {"key": "item_name", "label": "物品名称", "type": "text"},
            {"key": "item_type", "label": "物品类型", "type": "combo", "options": ["房产", "车辆", "珠宝", "设备", "其他"]},
            {"key": "quantity", "label": "当前数量", "type": "int"},
            {"key": "unit_value", "label": "单位价值", "type": "number"},
            {"key": "total_value", "label": "总价值", "type": "number"},
            {"key": "location", "label": "存放位置", "type": "text"},
            {"key": "status", "label": "状态", "type": "combo", "options": ["在库", "已出库", "已处置"]},
        ]

    def fetch_data(self, keyword: str):
        return api.list_inventory(keyword=keyword)

    def create_item(self, data: dict):
        return api.create_inventory(data)

    def update_item(self, item_id: int, data: dict):
        return api.update_inventory(item_id, data)

    def delete_item(self, item_id: int):
        return api.delete_inventory(item_id)
