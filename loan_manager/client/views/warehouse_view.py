from ..api_client import api
from .base_table_view import BaseTableView


class WarehouseView(BaseTableView):
    page_title = "入库管理"
    columns = [
        ("ID", "id", 60),
        ("关联订单", "order_no", 130),
        ("物品名称", "item_name", 120),
        ("物品类型", "item_type", 100),
        ("数量", "quantity", 60),
        ("单位价值", "unit_value", 100),
        ("总价值", "total_value", 100),
        ("存放位置", "location", 100),
        ("入库日期", "entry_date", 100),
        ("操作人", "operator", 80),
    ]

    def get_form_fields(self):
        return [
            {"key": "order_id", "label": "关联订单ID", "type": "int"},
            {"key": "item_name", "label": "物品名称", "type": "text"},
            {"key": "item_type", "label": "物品类型", "type": "combo", "options": ["房产", "车辆", "珠宝", "设备", "其他"]},
            {"key": "quantity", "label": "数量", "type": "int"},
            {"key": "unit_value", "label": "单位价值", "type": "number"},
            {"key": "total_value", "label": "总价值", "type": "number"},
            {"key": "location", "label": "存放位置", "type": "text"},
            {"key": "entry_date", "label": "入库日期", "type": "date"},
            {"key": "operator", "label": "操作人", "type": "text"},
        ]

    def fetch_data(self, keyword: str):
        return api.list_warehouse(keyword=keyword)

    def create_item(self, data: dict):
        return api.create_warehouse_entry(data)

    def update_item(self, item_id: int, data: dict):
        return api.update_warehouse_entry(item_id, data)

    def delete_item(self, item_id: int):
        return api.delete_warehouse_entry(item_id)
