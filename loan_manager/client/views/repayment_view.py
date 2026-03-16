from ..api_client import api
from .base_table_view import BaseTableView


class RepaymentView(BaseTableView):
    page_title = "还款计划"
    columns = [
        ("ID", "id", 60),
        ("订单编号", "order_no", 130),
        ("期数", "period_no", 60),
        ("应还日期", "due_date", 100),
        ("应还本金", "principal", 100),
        ("应还利息", "interest", 100),
        ("应还总额", "total_amount", 100),
        ("实还金额", "paid_amount", 100),
        ("实还日期", "paid_date", 100),
        ("状态", "status", 80),
    ]

    def get_form_fields(self):
        return [
            {"key": "order_id", "label": "订单ID", "type": "int"},
            {"key": "period_no", "label": "期数", "type": "int"},
            {"key": "due_date", "label": "应还日期", "type": "date"},
            {"key": "principal", "label": "应还本金", "type": "number"},
            {"key": "interest", "label": "应还利息", "type": "number"},
            {"key": "total_amount", "label": "应还总额", "type": "number"},
            {"key": "paid_amount", "label": "实还金额", "type": "number"},
            {"key": "paid_date", "label": "实还日期", "type": "date"},
            {"key": "status", "label": "状态", "type": "combo", "options": ["待还", "已还", "逾期"]},
        ]

    def fetch_data(self, keyword: str):
        return api.list_repayments()

    def create_item(self, data: dict):
        return api.create_repayment(data)

    def update_item(self, item_id: int, data: dict):
        update_data = {}
        for k in ("paid_amount", "paid_date", "status"):
            if k in data:
                update_data[k] = data[k]
        return api.update_repayment(item_id, update_data)

    def delete_item(self, item_id: int):
        return api.delete_repayment(item_id)
