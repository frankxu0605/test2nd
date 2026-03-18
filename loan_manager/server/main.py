import os
from datetime import date, timedelta

import uvicorn
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from .config import SERVER_HOST, SERVER_PORT
from .database import Base, engine, get_db
from .models import (
    Customer, Order, RepaymentPlan, Appointment, Expense,
    GoldPrice, WarehouseEntry, SystemSetting, Tenant, User, OverduePool,
)
from .routers import auth, customers, orders, repayments, warehouse, inventory, appointments, expenses, gold_price, settings, import_excel, payments, company_info, overdue_pool, migration
from .routers.auth import hash_password
from .routers.repayments import auto_sync_overdue
from .auth_deps import get_active_user
from .gold_fetcher import GoldPriceScheduler

# Create all tables
Base.metadata.create_all(bind=engine)

# Hot-migrate: add new columns to existing databases without data loss
def _add_column_if_missing(table: str, column: str, col_def: str):
    with engine.connect() as conn:
        try:
            conn.execute(__import__('sqlalchemy').text(f"ALTER TABLE {table} ADD COLUMN {column} {col_def}"))
            conn.commit()
        except Exception:
            pass  # Column already exists

_add_column_if_missing("orders", "operator", "VARCHAR(50) NOT NULL DEFAULT ''")
_add_column_if_missing("orders", "manager_commission_paid", "BOOLEAN NOT NULL DEFAULT 0")
_add_column_if_missing("orders", "operator_commission_paid", "BOOLEAN NOT NULL DEFAULT 0")
_add_column_if_missing("orders", "overdue_reported", "BOOLEAN NOT NULL DEFAULT 0")
_add_column_if_missing("orders", "overdue_reported_at", "VARCHAR(20) DEFAULT NULL")

app = FastAPI(title="黄金分期管理系统", version="2.0.0")

# CORS middleware for mobile client access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(customers.router)
app.include_router(orders.router)
app.include_router(repayments.router)
app.include_router(warehouse.router)
app.include_router(inventory.router)
app.include_router(appointments.router)
app.include_router(expenses.router)
app.include_router(gold_price.router)
app.include_router(settings.router)
app.include_router(import_excel.router)
app.include_router(payments.router)
app.include_router(company_info.router)
app.include_router(overdue_pool.router)
app.include_router(migration.router)


# Auto gold price fetcher (every 10 minutes)
_gold_scheduler = GoldPriceScheduler(interval=600)


@app.on_event("startup")
def start_gold_scheduler():
    _gold_scheduler.start()


@app.on_event("shutdown")
def stop_gold_scheduler():
    _gold_scheduler.stop()


@app.on_event("startup")
def create_default_admin():
    """Create a default tenant + admin user if none exists."""
    from .database import SessionLocal
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            # Create default tenant
            tenant = Tenant(
                name="默认公司",
                status="active",
                plan="free_trial",
                trial_end_date=date.today() + timedelta(days=7),
                max_users=5,
            )
            db.add(tenant)
            db.flush()

            admin = User(
                tenant_id=tenant.id,
                username="admin",
                password_hash=hash_password("admin123"),
                real_name="管理员",
                role="admin",
            )
            db.add(admin)
            db.commit()
        else:
            # Ensure existing admin has a tenant
            if not admin.tenant_id:
                tenant = db.query(Tenant).first()
                if not tenant:
                    tenant = Tenant(
                        name="默认公司",
                        status="active",
                        plan="free_trial",
                        trial_end_date=date.today() + timedelta(days=7),
                        max_users=5,
                    )
                    db.add(tenant)
                    db.flush()
                admin.tenant_id = tenant.id
                db.commit()
    finally:
        db.close()


@app.get("/api/dashboard")
def dashboard_stats(user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    tid = user.tenant_id
    auto_sync_overdue(db, tid)

    customer_count = db.query(func.count(Customer.id)).filter(Customer.tenant_id == tid).scalar() or 0
    order_count = db.query(func.count(Order.id)).filter(Order.tenant_id == tid).scalar() or 0
    active_orders = db.query(func.count(Order.id)).filter(Order.tenant_id == tid, Order.status.in_(["已通过", "逾期"])).scalar() or 0
    overdue_count = db.query(func.count(Order.id)).filter(Order.tenant_id == tid, Order.status == "逾期").scalar() or 0
    inventory_count = db.query(func.count(WarehouseEntry.id)).filter(
        WarehouseEntry.tenant_id == tid, WarehouseEntry.exit_date.is_(None)
    ).scalar() or 0
    pending_appts = db.query(func.count(Appointment.id)).filter(
        Appointment.tenant_id == tid, Appointment.status.in_(["待确认", "已确认"])
    ).scalar() or 0

    # ---- Income breakdown ----
    initial_investment_setting = db.query(SystemSetting).filter(
        SystemSetting.tenant_id == tid, SystemSetting.key == "initial_investment"
    ).first()
    initial_investment = float(initial_investment_setting.value) if initial_investment_setting and initial_investment_setting.value else 0
    initial_investment_account_setting = db.query(SystemSetting).filter(
        SystemSetting.tenant_id == tid, SystemSetting.key == "initial_investment_account"
    ).first()
    initial_investment_account = initial_investment_account_setting.value if initial_investment_account_setting else ""

    total_down_payment = float(db.query(func.sum(Order.down_payment)).filter(Order.tenant_id == tid).scalar() or 0)
    total_repaid = float(db.query(func.sum(RepaymentPlan.paid_amount)).filter(RepaymentPlan.tenant_id == tid).scalar() or 0)
    payment_total = total_down_payment + total_repaid

    notary_fee_total = float(db.query(func.sum(Order.notary_fee)).filter(Order.tenant_id == tid).scalar() or 0)
    credit_report_fee_total = float(db.query(func.sum(Order.credit_report_fee)).filter(Order.tenant_id == tid).scalar() or 0)
    lawsuit_fee_total = float(db.query(func.sum(Order.lawsuit_fee)).filter(Order.tenant_id == tid).scalar() or 0)

    total_income = initial_investment + payment_total + notary_fee_total + credit_report_fee_total + lawsuit_fee_total

    # ---- Account summary (grouped by payment_account) ----
    from collections import defaultdict
    acct_totals: dict = defaultdict(float)

    if initial_investment and initial_investment_account:
        acct_totals[initial_investment_account] += initial_investment

    # down_payment + notary_fee share the same payment_account on the order
    order_accts = db.query(
        Order.payment_account,
        func.sum(Order.down_payment + Order.notary_fee),
    ).filter(Order.tenant_id == tid, Order.payment_account != "").group_by(Order.payment_account).all()
    for acct, total in order_accts:
        if acct:
            acct_totals[acct] += float(total or 0)

    rp_accts = db.query(
        RepaymentPlan.payment_account,
        func.sum(RepaymentPlan.paid_amount),
    ).filter(RepaymentPlan.tenant_id == tid, RepaymentPlan.payment_account != "").group_by(RepaymentPlan.payment_account).all()
    for acct, total in rp_accts:
        if acct:
            acct_totals[acct] += float(total or 0)

    account_summary = [{"account": k, "total": v} for k, v in sorted(acct_totals.items())]

    # ---- Expense breakdown by category ----
    expense_by_cat = db.query(
        Expense.category, func.sum(Expense.total_price)
    ).filter(Expense.tenant_id == tid).group_by(Expense.category).all()
    expense_categories = {cat: float(amt) for cat, amt in expense_by_cat if cat}

    warehouse_total = float(db.query(func.sum(WarehouseEntry.total_price)).filter(WarehouseEntry.tenant_id == tid).scalar() or 0)

    total_expense = sum(expense_categories.values()) + warehouse_total

    # Gold price (global — not filtered by tenant)
    gold = db.query(GoldPrice).filter(GoldPrice.price_date == date.today()).first()
    if not gold:
        gold = db.query(GoldPrice).order_by(GoldPrice.price_date.desc()).first()

    gold_info = None
    if gold:
        gold_info = {
            "price_date": str(gold.price_date),
            "buy_price": float(gold.buy_price),
            "sell_price": float(gold.sell_price),
            "updated_by": gold.updated_by or "",
            "updated_at": str(gold.updated_at) if gold.updated_at else "",
        }

    return {
        "customer_count": customer_count,
        "order_count": order_count,
        "active_orders": active_orders,
        "overdue_count": overdue_count,
        "inventory_count": inventory_count,
        "pending_appointments": pending_appts,
        "income": {
            "initial_investment": initial_investment,
            "initial_investment_account": initial_investment_account,
            "payment_total": payment_total,
            "notary_fee_total": notary_fee_total,
            "credit_report_fee_total": credit_report_fee_total,
            "lawsuit_fee_total": lawsuit_fee_total,
            "total": total_income,
        },
        "expense": {
            "categories": expense_categories,
            "warehouse_total": warehouse_total,
            "total": total_expense,
        },
        "gold_price": gold_info,
        "account_summary": account_summary,
    }


# Serve web client static files
_web_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "web_client")
if os.path.isdir(_web_dir):
    app.mount("/static", StaticFiles(directory=_web_dir), name="web_static")

    @app.get("/")
    def serve_web_index():
        return FileResponse(os.path.join(_web_dir, "index.html"))


if __name__ == "__main__":
    uvicorn.run("server.main:app", host=SERVER_HOST, port=SERVER_PORT, reload=True)
