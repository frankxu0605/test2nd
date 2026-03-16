from datetime import date, datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Order, Customer, User, RepaymentPlan
from ..schemas import OrderCreate, OrderUpdate, OrderOut
from ..auth_deps import get_active_user
from .repayments import auto_sync_overdue

router = APIRouter(prefix="/api/orders", tags=["orders"])


def auto_generate_plans(db: Session, order: Order):
    """Auto-generate daily repayment plans for an order.
    Only generates if installment_periods > 0 and no plans exist yet.
    """
    if not order.installment_periods or int(order.installment_periods) <= 0:
        return
    if not order.installment_amount or Decimal(str(order.installment_amount)) <= 0:
        return
    # Skip if plans already exist
    existing = db.query(RepaymentPlan).filter(RepaymentPlan.order_id == order.id).first()
    if existing:
        return
    for i in range(1, int(order.installment_periods) + 1):
        due = order.order_date + timedelta(days=i)
        plan = RepaymentPlan(
            tenant_id=order.tenant_id,
            order_id=order.id,
            period_no=i,
            due_date=due,
            principal=order.installment_amount,
            interest=Decimal("0.00"),
            total_amount=order.installment_amount,
            paid_amount=Decimal("0.00"),
            status="待还",
        )
        db.add(plan)


def _to_out(order: Order, db: Session) -> dict:
    d = OrderOut.model_validate(order).model_dump()
    customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
    d["customer_name"] = customer.name if customer else ""
    return d


@router.get("/", response_model=list[OrderOut])
def list_orders(
    keyword: str = Query("", description="搜索关键词"),
    customer_id: int | None = Query(None, description="客户ID筛选"),
    status: str = Query("", description="状态筛选"),
    skip: int = 0,
    limit: int = 100,
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    auto_sync_overdue(db, user.tenant_id)
    q = db.query(Order).filter(Order.tenant_id == user.tenant_id)
    if customer_id is not None:
        q = q.filter(Order.customer_id == customer_id)
    if keyword:
        customer_ids = (
            db.query(Customer.id).filter(
                Customer.name.contains(keyword),
                Customer.tenant_id == user.tenant_id,
            ).all()
        )
        cids = [cid for (cid,) in customer_ids]
        q = q.filter(
            Order.order_no.contains(keyword)
            | Order.phone.contains(keyword)
            | Order.id_card.contains(keyword)
            | Order.account_manager.contains(keyword)
            | Order.customer_id.in_(cids)
        )
    if status:
        q = q.filter(Order.status == status)
    
    # If limit is -1, return all orders
    if limit == -1:
        orders = q.order_by(Order.id.desc()).offset(skip).all()
    else:
        orders = q.order_by(Order.id.desc()).offset(skip).limit(limit).all()
    # Batch-load customer names to avoid N+1 queries
    cids = {o.customer_id for o in orders if o.customer_id}
    cmap = {}
    if cids:
        cmap = {c.id: c.name for c in db.query(Customer).filter(Customer.id.in_(cids)).all()}
    result = []
    for o in orders:
        d = OrderOut.model_validate(o).model_dump()
        d["customer_name"] = cmap.get(o.customer_id, "")
        result.append(d)
    return result


@router.get("/count")
def count_orders(keyword: str = "", status: str = "", user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    q = db.query(Order).filter(Order.tenant_id == user.tenant_id)
    if keyword:
        q = q.filter(Order.order_no.contains(keyword))
    if status:
        q = q.filter(Order.status == status)
    return {"count": q.count()}


@router.get("/commission")
def get_commission(
    name: str = Query(..., description="客户经理或操作员姓名"),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    """Calculate commission for an account manager (2%) or operator (1%) over a date range."""
    base_q = db.query(Order).filter(
        Order.tenant_id == user.tenant_id,
        Order.status == "已结清",
    )
    if date_from:
        base_q = base_q.filter(Order.order_date >= date_from)
    if date_to:
        base_q = base_q.filter(Order.order_date <= date_to)

    def _summarize(orders_list, rate: Decimal, customer_map: dict, paid_field: str):
        rows = []
        total_amount = Decimal("0")
        unpaid_amount = Decimal("0")
        for o in orders_list:
            amt = (o.unit_price + o.processing_fee) * o.weight
            paid = bool(getattr(o, paid_field, False))
            rows.append({
                "order_id": o.id,
                "order_no": o.order_no,
                "order_date": str(o.order_date),
                "customer_name": customer_map.get(o.customer_id, ""),
                "total_amount": float(round(amt, 2)),
                "commission": float(round(amt * rate, 2)),
                "commission_paid": paid,
            })
            total_amount += amt
            if not paid:
                unpaid_amount += amt
        total_comm = total_amount * rate
        unpaid_comm = unpaid_amount * rate
        return {
            "count": len(rows),
            "total_amount": float(round(total_amount, 2)),
            "commission": float(round(total_comm, 2)),
            "unpaid_commission": float(round(unpaid_comm, 2)),
            "orders": rows,
        }

    manager_orders = base_q.filter(Order.account_manager == name).all()
    operator_orders = base_q.filter(Order.operator == name).all()

    # Batch load customer names
    all_cids = {o.customer_id for o in manager_orders + operator_orders}
    customers = db.query(Customer).filter(Customer.id.in_(all_cids)).all()
    customer_map = {c.id: c.name for c in customers}

    return {
        "name": name,
        "as_manager": _summarize(manager_orders, Decimal("0.02"), customer_map, "manager_commission_paid"),
        "as_operator": _summarize(operator_orders, Decimal("0.01"), customer_map, "operator_commission_paid"),
    }


@router.post("/commission/mark-paid")
def mark_commission_paid(
    data: dict,
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    """Bulk-mark commission as paid for a list of orders."""
    order_ids = data.get("order_ids", [])
    role = data.get("role", "manager")
    if not order_ids:
        return {"message": "无操作"}
    field = "manager_commission_paid" if role == "manager" else "operator_commission_paid"
    db.query(Order).filter(
        Order.id.in_(order_ids),
        Order.tenant_id == user.tenant_id,
    ).update({field: True}, synchronize_session=False)
    db.commit()
    return {"message": "已标记"}


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    o = db.query(Order).filter(Order.id == order_id, Order.tenant_id == user.tenant_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="订单不存在")
    return _to_out(o, db)


@router.post("/", response_model=OrderOut)
def create_order(data: OrderCreate, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    d = data.model_dump()
    if not d.get("order_date"):
        d["order_date"] = date.today()
    if not d.get("order_no"):
        d["order_no"] = "ORD" + datetime.now().strftime("%Y%m%d%H%M%S%f")
    d["tenant_id"] = user.tenant_id
    o = Order(**d)
    db.add(o)
    db.flush()
    auto_generate_plans(db, o)
    db.commit()
    db.refresh(o)
    return _to_out(o, db)


@router.put("/{order_id}", response_model=OrderOut)
def update_order(order_id: int, data: OrderUpdate, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    o = db.query(Order).filter(Order.id == order_id, Order.tenant_id == user.tenant_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="订单不存在")
    updates = data.model_dump(exclude_unset=True)
    if "credit_reported" in updates:
        if updates["credit_reported"] and not o.credit_reported:
            if "credit_reported_at" not in updates:
                updates["credit_reported_at"] = datetime.now()
        elif not updates["credit_reported"]:
            updates["credit_reported_at"] = None
    if "lawsuit_filed" in updates:
        if updates["lawsuit_filed"] and not o.lawsuit_filed:
            if "lawsuit_filed_at" not in updates:
                updates["lawsuit_filed_at"] = datetime.now()
        elif not updates["lawsuit_filed"]:
            updates["lawsuit_filed_at"] = None
    for k, v in updates.items():
        setattr(o, k, v)
    db.commit()
    db.refresh(o)
    return _to_out(o, db)


@router.delete("/{order_id}")
def delete_order(order_id: int, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    o = db.query(Order).filter(Order.id == order_id, Order.tenant_id == user.tenant_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="订单不存在")
    db.delete(o)
    db.commit()
    return {"message": "删除成功"}


