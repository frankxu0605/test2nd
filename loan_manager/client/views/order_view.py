from datetime import date

from ..api_client import api
from .base_table_view import BaseTableView


class OrderView(BaseTableView):
    page_title = "订单管理"
    columns = [
        ("ID", "id", 50),
        ("日期", "order_date", 90),
        ("订单编号", "order_no", 120),
        ("客户", "customer_name", 70),
        ("电话", "phone", 110),
        ("身份证", "id_card", 140),
        ("地址", "address", 120),
        ("邮箱", "email", 120),
        ("客户经理", "account_manager", 80),
        ("紧急联系人", "emergency_contact", 80),
        ("当前逾期", "has_overdue", 65),
        ("有房产", "has_property", 65),
        ("克重", "weight", 70),
        ("单价", "unit_price", 80),
        ("加工费", "processing_fee", 80),
        ("公证费", "notary_fee", 80),
        ("首付比例%", "down_payment_ratio", 75),
        ("首付金额", "down_payment", 90),
        ("分期期数", "installment_periods", 65),
        ("每期金额", "installment_amount", 90),
        ("状态", "status", 70),
    ]

    def get_form_fields(self):
        return [
            {"key": "order_date", "label": "日期", "type": "date", "default": str(date.today())},
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

    def fetch_data(self, keyword: str):
        return api.list_orders(keyword=keyword)

    def create_item(self, data: dict):
        return api.create_order(data)

    def update_item(self, item_id: int, data: dict):
        return api.update_order(item_id, data)

    def delete_item(self, item_id: int):
        return api.delete_order(item_id)
