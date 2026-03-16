"""HTTP API client for communicating with the FastAPI server."""
import requests


class ApiClient:
    def __init__(self, base_url="http://127.0.0.1:8000"):
        self.base_url = base_url.rstrip("/")
        self.token = ""
        self.user_info = {}

    def _headers(self):
        h = {"Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    def _url(self, path):
        return f"{self.base_url}{path}"

    # Auth
    def login(self, username, password):
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

    # Generic
    def get(self, path, params=None):
        resp = requests.get(self._url(path), headers=self._headers(), params=params, timeout=15)
        resp.raise_for_status()
        return resp.json()

    def post(self, path, data):
        resp = requests.post(self._url(path), headers=self._headers(), json=data, timeout=15)
        resp.raise_for_status()
        return resp.json()

    def put(self, path, data):
        resp = requests.put(self._url(path), headers=self._headers(), json=data, timeout=15)
        resp.raise_for_status()
        return resp.json()

    def delete(self, path):
        resp = requests.delete(self._url(path), headers=self._headers(), timeout=15)
        resp.raise_for_status()
        return resp.json()

    # Convenience
    def dashboard(self):
        return self.get("/api/dashboard")

    def list_customers(self, keyword=""):
        return self.get("/api/customers/", {"keyword": keyword})

    def create_customer(self, data):
        return self.post("/api/customers/", data)

    def update_customer(self, cid, data):
        return self.put(f"/api/customers/{cid}", data)

    def delete_customer(self, cid):
        return self.delete(f"/api/customers/{cid}")

    def list_orders(self, keyword="", status=""):
        return self.get("/api/orders/", {"keyword": keyword, "status": status})

    def create_order(self, data):
        return self.post("/api/orders/", data)

    def update_order(self, oid, data):
        return self.put(f"/api/orders/{oid}", data)

    def delete_order(self, oid):
        return self.delete(f"/api/orders/{oid}")

    def list_repayments(self, order_id=None, status=""):
        params = {"status": status}
        if order_id is not None:
            params["order_id"] = order_id
        return self.get("/api/repayments/", params)

    def create_repayment(self, data):
        return self.post("/api/repayments/", data)

    def update_repayment(self, rid, data):
        return self.put(f"/api/repayments/{rid}", data)

    def delete_repayment(self, rid):
        return self.delete(f"/api/repayments/{rid}")

    def list_warehouse(self, keyword=""):
        return self.get("/api/warehouse/", {"keyword": keyword})

    def create_warehouse_entry(self, data):
        return self.post("/api/warehouse/", data)

    def update_warehouse_entry(self, eid, data):
        return self.put(f"/api/warehouse/{eid}", data)

    def delete_warehouse_entry(self, eid):
        return self.delete(f"/api/warehouse/{eid}")

    def list_inventory(self, keyword="", status=""):
        return self.get("/api/inventory/", {"keyword": keyword, "status": status})

    def create_inventory(self, data):
        return self.post("/api/inventory/", data)

    def update_inventory(self, iid, data):
        return self.put(f"/api/inventory/{iid}", data)

    def delete_inventory(self, iid):
        return self.delete(f"/api/inventory/{iid}")

    def list_appointments(self, status=""):
        return self.get("/api/appointments/", {"status": status})

    def create_appointment(self, data):
        return self.post("/api/appointments/", data)

    def update_appointment(self, aid, data):
        return self.put(f"/api/appointments/{aid}", data)

    def delete_appointment(self, aid):
        return self.delete(f"/api/appointments/{aid}")

    def list_expenses(self, keyword="", category=""):
        return self.get("/api/expenses/", {"keyword": keyword, "category": category})

    def create_expense(self, data):
        return self.post("/api/expenses/", data)

    def update_expense(self, eid, data):
        return self.put(f"/api/expenses/{eid}", data)

    def delete_expense(self, eid):
        return self.delete(f"/api/expenses/{eid}")


# Global singleton
api = ApiClient()
