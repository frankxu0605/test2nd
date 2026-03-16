from ..api_client import api
from .base_table_view import BaseTableView


class AppointmentView(BaseTableView):
    page_title = "预约管理"
    columns = [
        ("ID", "id", 60),
        ("客户姓名", "customer_name", 100),
        ("预约日期", "appointment_date", 100),
        ("预约时间", "appointment_time", 80),
        ("预约事由", "purpose", 150),
        ("状态", "status", 80),
        ("备注", "notes", 150),
        ("创建时间", "created_at", 160),
    ]

    def get_form_fields(self):
        return [
            {"key": "customer_id", "label": "客户姓名", "type": "customer_search", "display_key": "customer_name", "autofill": []},
            {"key": "appointment_date", "label": "预约日期", "type": "date"},
            {"key": "appointment_time", "label": "预约时间", "type": "time"},
            {"key": "purpose", "label": "预约事由", "type": "text"},
            {"key": "status", "label": "状态", "type": "combo", "options": ["待确认", "已确认", "已完成", "已取消"]},
            {"key": "notes", "label": "备注", "type": "textarea"},
        ]

    def fetch_data(self, keyword: str):
        return api.list_appointments()

    def create_item(self, data: dict):
        return api.create_appointment(data)

    def update_item(self, item_id: int, data: dict):
        update_data = {}
        for k in ("appointment_date", "appointment_time", "purpose", "status", "notes"):
            if k in data:
                update_data[k] = data[k]
        return api.update_appointment(item_id, update_data)

    def delete_item(self, item_id: int):
        return api.delete_appointment(item_id)
