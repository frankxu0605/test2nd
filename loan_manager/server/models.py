from datetime import datetime, date, time
from decimal import Decimal

from sqlalchemy import String, Integer, Text, Date, Time, DateTime, ForeignKey, DECIMAL, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    contact_phone: Mapped[str] = mapped_column(String(20), default="")
    status: Mapped[str] = mapped_column(String(20), default="active")  # active, suspended, trial_expired
    plan: Mapped[str] = mapped_column(String(20), default="free_trial")  # free_trial, monthly, yearly
    trial_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    subscription_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    max_users: Mapped[int] = mapped_column(Integer, default=5)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    users: Mapped[list["User"]] = relationship(back_populates="tenant")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tenants.id"), nullable=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    real_name: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[str] = mapped_column(String(100), default="")
    phone: Mapped[str] = mapped_column(String(20), default="")
    role: Mapped[str] = mapped_column(String(20), default="member")  # superadmin, admin, member
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    tenant: Mapped["Tenant | None"] = relationship(back_populates="users")


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tenants.id"), nullable=True)
    customer_no: Mapped[int] = mapped_column(Integer, default=0)  # per-tenant sequential number
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), default="")
    id_card: Mapped[str] = mapped_column(String(20), default="")
    address: Mapped[str] = mapped_column(String(200), default="")
    email: Mapped[str] = mapped_column(String(100), default="")
    account_manager: Mapped[str] = mapped_column(String(50), default="")
    emergency_contact: Mapped[str] = mapped_column(String(50), default="")
    has_overdue: Mapped[str] = mapped_column(String(10), default="否")
    has_property: Mapped[str] = mapped_column(String(10), default="否")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    orders: Mapped[list["Order"]] = relationship(back_populates="customer")
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="customer")


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tenants.id"), nullable=True)
    order_date: Mapped[date] = mapped_column(Date, nullable=False)
    order_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    customer_id: Mapped[int] = mapped_column(Integer, ForeignKey("customers.id"), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), default="")
    id_card: Mapped[str] = mapped_column(String(20), default="")
    address: Mapped[str] = mapped_column(String(200), default="")
    email: Mapped[str] = mapped_column(String(100), default="")
    account_manager: Mapped[str] = mapped_column(String(50), default="")
    operator: Mapped[str] = mapped_column(String(50), default="")
    emergency_contact: Mapped[str] = mapped_column(String(50), default="")
    has_overdue: Mapped[str] = mapped_column(String(10), default="否")
    has_property: Mapped[str] = mapped_column(String(10), default="否")
    weight: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), default=Decimal("0.00"))
    unit_price: Mapped[Decimal] = mapped_column(DECIMAL(12, 2), default=Decimal("0.00"))
    processing_fee: Mapped[Decimal] = mapped_column(DECIMAL(12, 2), default=Decimal("0.00"))
    notary_fee: Mapped[Decimal] = mapped_column(DECIMAL(12, 2), default=Decimal("0.00"))
    down_payment_ratio: Mapped[Decimal] = mapped_column(DECIMAL(5, 2), default=Decimal("0.00"))
    down_payment: Mapped[Decimal] = mapped_column(DECIMAL(12, 2), default=Decimal("0.00"))
    payment_account: Mapped[str] = mapped_column(String(100), default="")
    installment_periods: Mapped[int] = mapped_column(Integer, default=0)
    installment_amount: Mapped[Decimal] = mapped_column(DECIMAL(12, 2), default=Decimal("0.00"))
    status: Mapped[str] = mapped_column(String(20), default="待审核")
    credit_reported: Mapped[bool] = mapped_column(default=False)
    credit_report_fee: Mapped[Decimal] = mapped_column(DECIMAL(12, 2), default=Decimal("0.00"))
    credit_reported_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    lawsuit_filed: Mapped[bool] = mapped_column(default=False)
    lawsuit_fee: Mapped[Decimal] = mapped_column(DECIMAL(12, 2), default=Decimal("0.00"))
    lawsuit_filed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    manager_commission_paid: Mapped[bool] = mapped_column(Boolean, default=False)
    operator_commission_paid: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    customer: Mapped["Customer"] = relationship(back_populates="orders")
    repayment_plans: Mapped[list["RepaymentPlan"]] = relationship(back_populates="order")


class RepaymentPlan(Base):
    __tablename__ = "repayment_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tenants.id"), nullable=True)
    order_id: Mapped[int] = mapped_column(Integer, ForeignKey("orders.id"), nullable=False)
    period_no: Mapped[int] = mapped_column(Integer, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    principal: Mapped[Decimal] = mapped_column(DECIMAL(12, 2), nullable=False)
    interest: Mapped[Decimal] = mapped_column(DECIMAL(12, 2), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(DECIMAL(12, 2), nullable=False)
    paid_amount: Mapped[Decimal] = mapped_column(DECIMAL(12, 2), default=Decimal("0.00"))
    paid_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    payment_account: Mapped[str] = mapped_column(String(100), default="")
    status: Mapped[str] = mapped_column(String(20), default="待还")

    order: Mapped["Order"] = relationship(back_populates="repayment_plans")


class WarehouseEntry(Base):
    __tablename__ = "warehouse_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tenants.id"), nullable=True)
    item_no: Mapped[str] = mapped_column(String(50), default="")
    barcode: Mapped[str] = mapped_column(String(100), default="")
    weight: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), default=Decimal("0.00"))
    unit_price: Mapped[Decimal] = mapped_column(DECIMAL(12, 2), default=Decimal("0.00"))
    total_price: Mapped[Decimal] = mapped_column(DECIMAL(12, 2), default=Decimal("0.00"))
    entry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    entry_operator: Mapped[str] = mapped_column(String(50), default="")
    exit_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    exit_operator: Mapped[str] = mapped_column(String(50), default="")
    buyer: Mapped[str] = mapped_column(String(50), default="")
    salesperson: Mapped[str] = mapped_column(String(50), default="")
    notes: Mapped[str] = mapped_column(String(200), default="")


class Inventory(Base):
    __tablename__ = "inventory"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tenants.id"), nullable=True)
    item_name: Mapped[str] = mapped_column(String(100), nullable=False)
    item_type: Mapped[str] = mapped_column(String(50), default="")
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    unit_value: Mapped[Decimal] = mapped_column(DECIMAL(12, 2), default=Decimal("0.00"))
    total_value: Mapped[Decimal] = mapped_column(DECIMAL(12, 2), default=Decimal("0.00"))
    location: Mapped[str] = mapped_column(String(100), default="")
    status: Mapped[str] = mapped_column(String(20), default="在库")
    last_updated: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tenants.id"), nullable=True)
    customer_id: Mapped[int] = mapped_column(Integer, ForeignKey("customers.id"), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), default="")
    appointment_date: Mapped[date] = mapped_column(Date, nullable=False)
    appointment_time: Mapped[time] = mapped_column(Time, nullable=False)
    purpose: Mapped[str] = mapped_column(String(100), default="")
    status: Mapped[str] = mapped_column(String(20), default="待确认")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    customer: Mapped["Customer"] = relationship(back_populates="appointments")


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tenants.id"), nullable=True)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)
    purchase_order_no: Mapped[str] = mapped_column(String(30), default="")
    supplier_name: Mapped[str] = mapped_column(String(100), default="")
    supplier_phone: Mapped[str] = mapped_column(String(20), default="")
    supplier_address: Mapped[str] = mapped_column(String(200), default="")
    product_name: Mapped[str] = mapped_column(String(100), default="")
    category: Mapped[str] = mapped_column(String(50), default="")
    unit: Mapped[str] = mapped_column(String(20), default="")
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    unit_price: Mapped[Decimal] = mapped_column(DECIMAL(12, 2), default=Decimal("0.00"))
    total_price: Mapped[Decimal] = mapped_column(DECIMAL(12, 2), default=Decimal("0.00"))
    receiver: Mapped[str] = mapped_column(String(50), default="")
    receiver_phone: Mapped[str] = mapped_column(String(20), default="")
    receiver_address: Mapped[str] = mapped_column(String(200), default="")
    notes: Mapped[str] = mapped_column(String(200), default="")
    payment_account: Mapped[str] = mapped_column(String(100), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tenants.id"), nullable=True)
    key: Mapped[str] = mapped_column(String(50), nullable=False)
    value: Mapped[str] = mapped_column(String(200), default="")


class GoldPrice(Base):
    """Global gold price - shared across all tenants."""
    __tablename__ = "gold_prices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    price_date: Mapped[date] = mapped_column(Date, unique=True, nullable=False)
    buy_price: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)
    sell_price: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), default=Decimal("0.00"))
    updated_by: Mapped[str] = mapped_column(String(50), default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"), nullable=False)
    plan: Mapped[str] = mapped_column(String(20), nullable=False)  # monthly, yearly
    amount: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active, expired, cancelled
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"), nullable=False)
    subscription_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("subscriptions.id"), nullable=True)
    amount: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(20), default="")  # wechat, alipay, manual
    trade_no: Mapped[str] = mapped_column(String(100), default="")
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, success, failed
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class Supplier(Base):
    __tablename__ = "suppliers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tenants.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(100), default="")
    contact_person: Mapped[str] = mapped_column(String(50), default="")
    phone: Mapped[str] = mapped_column(String(30), default="")
    address: Mapped[str] = mapped_column(String(200), default="")


class StaffMember(Base):
    __tablename__ = "staff_members"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tenants.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(50), default="")
    phone: Mapped[str] = mapped_column(String(30), default="")


class PaymentAccount(Base):
    __tablename__ = "payment_accounts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tenants.id"), nullable=True)
    account: Mapped[str] = mapped_column(String(100), default="")
    payee: Mapped[str] = mapped_column(String(50), default="")


class DeliveryAddress(Base):
    __tablename__ = "delivery_addresses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tenants.id"), nullable=True)
    label: Mapped[str] = mapped_column(String(50), default="")
    address: Mapped[str] = mapped_column(String(200), default="")
