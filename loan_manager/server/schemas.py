from datetime import datetime, date, time
from decimal import Decimal
from pydantic import BaseModel, field_validator


# ---- Auth ----
class LoginRequest(BaseModel):
    username: str
    password: str

class CompanyRegisterRequest(BaseModel):
    company_name: str
    username: str
    password: str
    real_name: str
    phone: str = ""
    email: str = ""

class RegisterRequest(BaseModel):
    username: str
    password: str
    real_name: str
    role: str = "member"

class UserOut(BaseModel):
    id: int
    tenant_id: int | None = None
    username: str
    real_name: str
    email: str = ""
    phone: str = ""
    role: str
    is_active: bool = True
    created_at: datetime
    model_config = {"from_attributes": True}

class TenantOut(BaseModel):
    id: int
    name: str
    contact_phone: str = ""
    status: str
    plan: str
    trial_end_date: date | None = None
    subscription_end_date: date | None = None
    max_users: int = 5
    created_at: datetime
    model_config = {"from_attributes": True}

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    tenant: TenantOut | None = None

class TeamMemberCreate(BaseModel):
    username: str
    password: str
    real_name: str
    email: str = ""
    phone: str = ""
    role: str = "member"

class TeamMemberOut(BaseModel):
    id: int
    username: str
    real_name: str
    email: str = ""
    phone: str = ""
    role: str
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}

class SubscriptionOut(BaseModel):
    id: int
    tenant_id: int
    plan: str
    amount: Decimal
    status: str
    start_date: date
    end_date: date
    created_at: datetime
    model_config = {"from_attributes": True}


# ---- Payment ----
class CreatePaymentOrder(BaseModel):
    plan: str      # "monthly" or "yearly"
    method: str    # "wechat" or "alipay"

class PaymentOrderResponse(BaseModel):
    payment_id: int
    amount: str
    code_url: str | None = None    # 微信Native二维码URL
    pay_url: str | None = None     # 支付宝/微信H5跳转URL
    qr_image_url: str | None = None  # 上传的收款二维码图片URL
    sandbox: bool = False

class PaymentStatusResponse(BaseModel):
    status: str
    payment_id: int
    subscription: SubscriptionOut | None = None


# ---- Customer ----
class CustomerCreate(BaseModel):
    customer_no: int | None = None  # per-tenant sequential number, auto-assigned if empty
    name: str
    phone: str = ""
    id_card: str = ""
    address: str = ""
    email: str = ""
    account_manager: str = ""
    emergency_contact: str = ""
    has_overdue: str = "否"
    has_property: str = "否"

class CustomerUpdate(BaseModel):
    customer_no: int | None = None
    name: str | None = None
    phone: str | None = None
    id_card: str | None = None
    address: str | None = None
    email: str | None = None
    account_manager: str | None = None
    emergency_contact: str | None = None
    has_overdue: str | None = None
    has_property: str | None = None

class CustomerOut(CustomerCreate):
    id: int
    customer_no: int = 0
    created_at: datetime
    model_config = {"from_attributes": True}


# ---- Order ----
class OrderCreate(BaseModel):
    order_date: date | None = None
    order_no: str = ""
    customer_id: int
    phone: str = ""
    id_card: str = ""
    address: str = ""
    email: str = ""
    account_manager: str = ""
    operator: str = ""
    emergency_contact: str = ""
    has_overdue: str = "否"
    has_property: str = "否"
    weight: Decimal = Decimal("0.00")
    unit_price: Decimal = Decimal("0.00")
    processing_fee: Decimal = Decimal("0.00")
    notary_fee: Decimal = Decimal("0.00")
    down_payment_ratio: Decimal = Decimal("0.00")
    down_payment: Decimal = Decimal("0.00")
    payment_account: str = ""
    installment_periods: int = 0
    installment_amount: Decimal = Decimal("0.00")
    status: str = "待审核"
    credit_reported: bool = False
    credit_report_fee: Decimal = Decimal("0.00")
    lawsuit_filed: bool = False
    lawsuit_fee: Decimal = Decimal("0.00")

class OrderUpdate(BaseModel):
    order_date: date | None = None
    order_no: str | None = None
    customer_id: int | None = None
    phone: str | None = None
    id_card: str | None = None

    @field_validator("order_date", mode="before")
    @classmethod
    def empty_date_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v
    address: str | None = None
    email: str | None = None
    account_manager: str | None = None
    operator: str | None = None
    emergency_contact: str | None = None
    has_overdue: str | None = None
    has_property: str | None = None
    weight: Decimal | None = None
    unit_price: Decimal | None = None
    processing_fee: Decimal | None = None
    notary_fee: Decimal | None = None
    down_payment_ratio: Decimal | None = None
    down_payment: Decimal | None = None
    payment_account: str | None = None
    installment_periods: int | None = None
    installment_amount: Decimal | None = None
    status: str | None = None
    credit_reported: bool | None = None
    credit_report_fee: Decimal | None = None
    credit_reported_at: datetime | None = None
    lawsuit_filed: bool | None = None
    lawsuit_fee: Decimal | None = None
    lawsuit_filed_at: datetime | None = None
    manager_commission_paid: bool | None = None
    operator_commission_paid: bool | None = None

    @field_validator("credit_reported_at", "lawsuit_filed_at", mode="before")
    @classmethod
    def empty_datetime_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v

class OrderOut(BaseModel):
    id: int
    order_date: date
    order_no: str
    customer_id: int
    customer_name: str = ""
    phone: str
    id_card: str
    address: str
    email: str
    account_manager: str
    operator: str = ""
    emergency_contact: str
    has_overdue: str
    has_property: str
    weight: Decimal
    unit_price: Decimal
    processing_fee: Decimal
    notary_fee: Decimal
    down_payment_ratio: Decimal
    down_payment: Decimal
    payment_account: str = ""
    installment_periods: int
    installment_amount: Decimal
    status: str
    credit_reported: bool = False
    credit_report_fee: Decimal = Decimal("0.00")
    credit_reported_at: datetime | None = None
    lawsuit_filed: bool = False
    lawsuit_fee: Decimal = Decimal("0.00")
    lawsuit_filed_at: datetime | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


# ---- RepaymentPlan ----
class RepaymentPlanCreate(BaseModel):
    order_id: int
    period_no: int
    due_date: date
    principal: Decimal
    interest: Decimal
    total_amount: Decimal
    paid_amount: Decimal = Decimal("0.00")
    paid_date: date | None = None
    payment_account: str = ""
    status: str = "待还"

class RepaymentPlanUpdate(BaseModel):
    paid_amount: Decimal | None = None
    paid_date: date | None = None
    payment_account: str | None = None
    status: str | None = None

    @field_validator("paid_date", mode="before")
    @classmethod
    def empty_date_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v

class RepaymentPlanOut(RepaymentPlanCreate):
    id: int
    order_no: str = ""
    customer_name: str = ""
    order_total_price: float = 0
    order_down_payment: float = 0
    credit_reported: bool = False
    credit_reported_at: str | None = None
    lawsuit_filed: bool = False
    lawsuit_filed_at: str | None = None
    model_config = {"from_attributes": True}


# ---- WarehouseEntry ----
class WarehouseEntryCreate(BaseModel):
    item_no: str = ""
    barcode: str = ""
    weight: Decimal = Decimal("0.00")
    unit_price: Decimal = Decimal("0.00")
    total_price: Decimal = Decimal("0.00")
    entry_date: date | None = None
    entry_operator: str = ""
    exit_date: date | None = None
    exit_operator: str = ""
    buyer: str = ""
    salesperson: str = ""
    notes: str = ""

    @field_validator("entry_date", "exit_date", mode="before")
    @classmethod
    def empty_date_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v

class WarehouseEntryUpdate(BaseModel):
    item_no: str | None = None
    barcode: str | None = None
    weight: Decimal | None = None
    unit_price: Decimal | None = None
    total_price: Decimal | None = None
    entry_date: date | None = None
    entry_operator: str | None = None
    exit_date: date | None = None
    exit_operator: str | None = None
    buyer: str | None = None
    salesperson: str | None = None
    notes: str | None = None

    @field_validator("entry_date", "exit_date", mode="before")
    @classmethod
    def empty_date_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v

class WarehouseEntryOut(WarehouseEntryCreate):
    id: int
    model_config = {"from_attributes": True}


# ---- Inventory ----
class InventoryCreate(BaseModel):
    item_name: str
    item_type: str = ""
    quantity: int = 0
    unit_value: Decimal = Decimal("0.00")
    total_value: Decimal = Decimal("0.00")
    location: str = ""
    status: str = "在库"

class InventoryUpdate(InventoryCreate):
    pass

class InventoryOut(InventoryCreate):
    id: int
    last_updated: datetime
    model_config = {"from_attributes": True}


# ---- Appointment ----
class AppointmentCreate(BaseModel):
    customer_id: int
    phone: str = ""
    appointment_date: date
    appointment_time: time
    purpose: str = ""
    status: str = "待确认"
    notes: str | None = None

class AppointmentUpdate(BaseModel):
    customer_id: int | None = None
    phone: str | None = None
    appointment_date: date | None = None
    appointment_time: time | None = None
    purpose: str | None = None
    status: str | None = None
    notes: str | None = None

    @field_validator("appointment_date", mode="before")
    @classmethod
    def empty_date_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v

    @field_validator("appointment_time", mode="before")
    @classmethod
    def empty_time_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v

class AppointmentOut(AppointmentCreate):
    id: int
    customer_name: str = ""
    created_at: datetime
    model_config = {"from_attributes": True}


# ---- Expense ----
class ExpenseCreate(BaseModel):
    expense_date: date
    purchase_order_no: str = ""
    supplier_name: str = ""
    supplier_phone: str = ""
    supplier_address: str = ""
    product_name: str = ""
    category: str = ""
    unit: str = ""
    quantity: int = 0
    unit_price: Decimal = Decimal("0.00")
    total_price: Decimal = Decimal("0.00")
    receiver: str = ""
    receiver_phone: str = ""
    receiver_address: str = ""
    notes: str = ""
    payment_account: str = ""

class ExpenseUpdate(BaseModel):
    expense_date: date | None = None
    purchase_order_no: str | None = None
    supplier_name: str | None = None
    supplier_phone: str | None = None
    supplier_address: str | None = None
    product_name: str | None = None
    category: str | None = None
    unit: str | None = None
    quantity: int | None = None
    unit_price: Decimal | None = None
    total_price: Decimal | None = None
    receiver: str | None = None
    receiver_phone: str | None = None
    receiver_address: str | None = None
    notes: str | None = None
    payment_account: str | None = None

    @field_validator("expense_date", mode="before")
    @classmethod
    def empty_date_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v

class ExpenseOut(ExpenseCreate):
    id: int
    created_at: datetime
    model_config = {"from_attributes": True}


# ---- Company Info ----
class SupplierIn(BaseModel):
    name: str = ""
    contact_person: str = ""
    phone: str = ""
    address: str = ""

class SupplierOut(SupplierIn):
    id: int
    model_config = {"from_attributes": True}


class StaffMemberIn(BaseModel):
    name: str = ""
    phone: str = ""

class StaffMemberOut(StaffMemberIn):
    id: int
    model_config = {"from_attributes": True}


class PaymentAccountIn(BaseModel):
    account: str = ""
    payee: str = ""

class PaymentAccountOut(PaymentAccountIn):
    id: int
    model_config = {"from_attributes": True}


class DeliveryAddressIn(BaseModel):
    label: str = ""
    address: str = ""

class DeliveryAddressOut(DeliveryAddressIn):
    id: int
    model_config = {"from_attributes": True}
