from ..api_client import api
from .base_table_view import BaseTableView


class CustomerView(BaseTableView):
    page_title = "客户信息"
    columns = [
        ("ID", "id", 60),
        ("客户姓名", "name", 100),
        ("联系电话", "phone", 120),
        ("身份证号", "id_card", 160),
        ("地址", "address", 150),
        ("邮箱", "email", 120),
        ("客户经理", "account_manager", 80),
        ("紧急联系人", "emergency_contact", 80),
        ("当前逾期", "has_overdue", 65),
        ("有房产", "has_property", 65),
        ("创建时间", "created_at", 160),
    ]

    def get_form_fields(self):
        return [
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

    def fetch_data(self, keyword: str):
        return api.list_customers(keyword=keyword)

    def create_item(self, data: dict):
        return api.create_customer(data)

    def update_item(self, item_id: int, data: dict):
        return api.update_customer(item_id, data)

    def delete_item(self, item_id: int):
        return api.delete_customer(item_id)
