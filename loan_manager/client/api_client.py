import requests


class ApiClient:
    """HTTP client wrapper for communicating with the FastAPI server."""

    def __init__(self, base_url: str = "http://127.0.0.1:8000"):
        self.base_url = base_url.rstrip("/")
        self.token: str = ""
        self.user_info: dict = {}

    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    def _url(self, path: str) -> str:
        return f"{self.base_url}{path}"

    # ---- Auth ----
    def login(self, username: str, password: str) -> dict:
        resp = requests.post(
            self._url("/api/auth/login"),
            json={"username": username, "password": password},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        self.token = data["access_token"]
        self.user_info = data["user"]
        return data

    def register(self, username: str, password: str, real_name: str, role: str = "operator") -> dict:
        resp = requests.post(
            self._url("/api/auth/register"),
            json={"username": username, "password": password, "real_name": real_name, "role": role},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()

    # ---- Generic CRUD ----
    def get(self, path: str, params: dict | None = None) -> list | dict:
        resp = requests.get(self._url(path), headers=self._headers(), params=params, timeout=15)
        resp.raise_for_status()
        return resp.json()

    def post(self, path: str, data: dict) -> dict:
        resp = requests.post(self._url(path), headers=self._headers(), json=data, timeout=15)
        resp.raise_for_status()
        return resp.json()

    def put(self, path: str, data: dict) -> dict:
        resp = requests.put(self._url(path), headers=self._headers(), json=data, timeout=15)
        resp.raise_for_status()
        return resp.json()

    def delete(self, path: str) -> dict:
        resp = requests.delete(self._url(path), headers=self._headers(), timeout=15)
        resp.raise_for_status()
        return resp.json()

    # ---- Convenience methods ----
    def dashboard(self) -> dict:
        return self.get("/api/dashboard")

    # Customers
    def list_customers(self, keyword: str = "", skip: int = 0, limit: int = 100) -> list:
        return self.get("/api/customers/", {"keyword": keyword, "skip": skip, "limit": limit})

    def create_customer(self, data: dict) -> dict:
        return self.post("/api/customers/", data)

    def update_customer(self, cid: int, data: dict) -> dict:
        return self.put(f"/api/customers/{cid}", data)

    def delete_customer(self, cid: int) -> dict:
        return self.delete(f"/api/customers/{cid}")

    # Orders
    def list_orders(self, keyword: str = "", status: str = "", skip: int = 0, limit: int = 100) -> list:
        return self.get("/api/orders/", {"keyword": keyword, "status": status, "skip": skip, "limit": limit})

    def create_order(self, data: dict) -> dict:
        return self.post("/api/orders/", data)

    def update_order(self, oid: int, data: dict) -> dict:
        return self.put(f"/api/orders/{oid}", data)

    def delete_order(self, oid: int) -> dict:
        return self.delete(f"/api/orders/{oid}")

    # Repayments
    def list_repayments(self, order_id: int | None = None, status: str = "") -> list:
        params = {"status": status}
        if order_id is not None:
            params["order_id"] = order_id
        return self.get("/api/repayments/", params)

    def create_repayment(self, data: dict) -> dict:
        return self.post("/api/repayments/", data)

    def batch_create_repayments(self, items: list[dict]) -> list:
        return self.post("/api/repayments/batch", items)

    def update_repayment(self, rid: int, data: dict) -> dict:
        return self.put(f"/api/repayments/{rid}", data)

    def delete_repayment(self, rid: int) -> dict:
        return self.delete(f"/api/repayments/{rid}")

    # Warehouse
    def list_warehouse(self, keyword: str = "") -> list:
        return self.get("/api/warehouse/", {"keyword": keyword})

    def create_warehouse_entry(self, data: dict) -> dict:
        return self.post("/api/warehouse/", data)

    def update_warehouse_entry(self, eid: int, data: dict) -> dict:
        return self.put(f"/api/warehouse/{eid}", data)

    def delete_warehouse_entry(self, eid: int) -> dict:
        return self.delete(f"/api/warehouse/{eid}")

    # Inventory
    def list_inventory(self, keyword: str = "", status: str = "") -> list:
        return self.get("/api/inventory/", {"keyword": keyword, "status": status})

    def create_inventory(self, data: dict) -> dict:
        return self.post("/api/inventory/", data)

    def update_inventory(self, iid: int, data: dict) -> dict:
        return self.put(f"/api/inventory/{iid}", data)

    def delete_inventory(self, iid: int) -> dict:
        return self.delete(f"/api/inventory/{iid}")

    # Appointments
    def list_appointments(self, status: str = "") -> list:
        return self.get("/api/appointments/", {"status": status})

    def create_appointment(self, data: dict) -> dict:
        return self.post("/api/appointments/", data)

    def update_appointment(self, aid: int, data: dict) -> dict:
        return self.put(f"/api/appointments/{aid}", data)

    def delete_appointment(self, aid: int) -> dict:
        return self.delete(f"/api/appointments/{aid}")

    # Expenses
    def list_expenses(self, keyword: str = "", category: str = "") -> list:
        return self.get("/api/expenses/", {"keyword": keyword, "category": category})

    def create_expense(self, data: dict) -> dict:
        return self.post("/api/expenses/", data)

    def update_expense(self, eid: int, data: dict) -> dict:
        return self.put(f"/api/expenses/{eid}", data)

    def delete_expense(self, eid: int) -> dict:
        return self.delete(f"/api/expenses/{eid}")


# Global singleton
api = ApiClient()
