from ..api_client import api
from .base_table_view import BaseTableView


class ExpenseView(BaseTableView):
    page_title = "支出明细"
    columns = [
        ("ID", "id", 60),
        ("支出日期", "expense_date", 100),
        ("支出类别", "category", 100),
        ("金额", "amount", 100),
        ("描述", "description", 200),
        ("经手人", "operator", 80),
        ("创建时间", "created_at", 160),
    ]

    def get_form_fields(self):
        return [
            {"key": "expense_date", "label": "支出日期", "type": "date"},
            {"key": "category", "label": "支出类别", "type": "combo", "options": ["办公费用", "人工成本", "房租水电", "交通费", "招待费", "税费", "其他"]},
            {"key": "amount", "label": "金额", "type": "number"},
            {"key": "description", "label": "描述", "type": "text"},
            {"key": "operator", "label": "经手人", "type": "text"},
        ]

    def fetch_data(self, keyword: str):
        return api.list_expenses(keyword=keyword)

    def create_item(self, data: dict):
        return api.create_expense(data)

    def update_item(self, item_id: int, data: dict):
        return api.update_expense(item_id, data)

    def delete_item(self, item_id: int):
        return api.delete_expense(item_id)
