from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import RepaymentPlan, Order, Customer, User
from ..schemas import RepaymentPlanCreate, RepaymentPlanUpdate, RepaymentPlanOut
from ..auth_deps import get_active_user

router = APIRouter(prefix="/api/repayments", tags=["repayments"])

# Throttle: only run overdue sync once per minute per tenant
_last_sync: dict[int, datetime] = {}
_SYNC_INTERVAL_SECONDS = 60


def auto_sync_overdue(db: Session, tenant_id: int):
    """Mark all past-due unpaid plans as '逾期未还' and sync order statuses.
    Throttled to at most once per minute per tenant to avoid repeated full scans.
    """
    now = datetime.now()
    last = _last_sync.get(tenant_id)
    if last and (now - last).total_seconds() < _SYNC_INTERVAL_SECONDS:
        return
    _last_sync[tenant_id] = now

    today = date.today()
    overdue_plans = db.query(RepaymentPlan).filter(
        RepaymentPlan.tenant_id == tenant_id,
        RepaymentPlan.due_date < today,
        RepaymentPlan.status == "待还",
    ).all()
    if not overdue_plans:
        return
    affected_order_ids = set()
    for rp in overdue_plans:
        rp.status = "逾期未还"
        affected_order_ids.add(rp.order_id)
    db.flush()
    for oid in affected_order_ids:
        _sync_order_status(db, oid)
    db.commit()


_PAID_STATUSES = {"已还", "逾期还款"}


def _sync_order_status(db: Session, order_id: int):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return

    plans = db.query(RepaymentPlan).filter(RepaymentPlan.order_id == order_id).all()
    if not plans:
        return

    # All periods paid → mark order as fully settled
    if all(p.status in _PAID_STATUSES for p in plans):
        order.status = "已结清"
        return

    # If order was previously settled but a payment was undone, revert to active
    if order.status == "已结清":
        order.status = "已通过"

    # Overdue logic
    has_overdue = any(p.status == "逾期未还" for p in plans)
    if has_overdue and order.status != "逾期":
        order.status = "逾期"
    elif not has_overdue and order.status == "逾期":
        order.status = "已通过"


def _plan_to_dict(rp: RepaymentPlan, order: Order | None = None, customer_name: str = "") -> dict:
    """Convert a single RepaymentPlan ORM object to response dict."""
    d = RepaymentPlanOut.model_validate(rp).model_dump()
    d["order_no"] = order.order_no if order else ""
    d["customer_name"] = customer_name
    d["order_total_price"] = float((order.unit_price + order.processing_fee) * order.weight) if order else 0
    d["order_down_payment"] = float(order.down_payment) if order else 0
    d["credit_reported"] = order.credit_reported if order else False
    d["credit_reported_at"] = order.credit_reported_at.strftime("%Y-%m-%d %H:%M") if order and order.credit_reported_at else None
    d["lawsuit_filed"] = order.lawsuit_filed if order else False
    d["lawsuit_filed_at"] = order.lawsuit_filed_at.strftime("%Y-%m-%d %H:%M") if order and order.lawsuit_filed_at else None
    return d


# ── Summary endpoint (one row per order, used by the list view) ──────────────

@router.get("/summary")
def list_repayments_summary(
    keyword: str = Query(""),
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    """Return one aggregated row per order instead of all individual plans.
    Much faster for the list view — detail plans are loaded on demand.
    """
    auto_sync_overdue(db, user.tenant_id)

    order_q = db.query(Order).filter(
        Order.tenant_id == user.tenant_id,
        Order.installment_periods > 0,
    )
    if keyword:
        cids = [cid for (cid,) in db.query(Customer.id).filter(
            Customer.tenant_id == user.tenant_id,
            Customer.name.contains(keyword),
        ).all()]
        order_q = order_q.filter(
            Order.order_no.contains(keyword) | Order.customer_id.in_(cids)
        )
    orders = order_q.order_by(Order.id.desc()).all()
    if not orders:
        return []

    # Batch-load customers
    cids_set = {o.customer_id for o in orders if o.customer_id}
    cmap = {c.id: c.name for c in db.query(Customer).filter(Customer.id.in_(cids_set)).all()} if cids_set else {}

    # Aggregate stats per order in one SQL query
    order_ids = [o.id for o in orders]
    stats_rows = db.query(
        RepaymentPlan.order_id,
        func.count(RepaymentPlan.id).label("total_periods"),
        func.sum(RepaymentPlan.total_amount).label("installment_total"),
        func.sum(RepaymentPlan.paid_amount).label("paid_total"),
        func.sum(case((RepaymentPlan.status.in_(["已还", "逾期还款"]), 1), else_=0)).label("paid_count"),
    ).filter(
        RepaymentPlan.tenant_id == user.tenant_id,
        RepaymentPlan.order_id.in_(order_ids),
    ).group_by(RepaymentPlan.order_id).all()

    stats_map = {s.order_id: s for s in stats_rows}

    result = []
    for o in orders:
        s = stats_map.get(o.id)
        if not s:
            continue
        result.append({
            "order_id": o.id,
            "order_no": o.order_no,
            "customer_name": cmap.get(o.customer_id, ""),
            "order_total_price": float((o.unit_price + o.processing_fee) * o.weight),
            "credit_reported": o.credit_reported,
            "credit_reported_at": o.credit_reported_at.strftime("%Y-%m-%d %H:%M") if o.credit_reported_at else None,
            "lawsuit_filed": o.lawsuit_filed,
            "lawsuit_filed_at": o.lawsuit_filed_at.strftime("%Y-%m-%d %H:%M") if o.lawsuit_filed_at else None,
            "total_periods": s.total_periods,
            "installment_total": round(float(s.installment_total or 0), 2),
            "paid_total": round(float(s.paid_total or 0), 2),
            "paid_count": s.paid_count or 0,
        })
    return result


# ── Per-order detail (loaded on demand when user clicks 还款明细) ─────────────

@router.get("/")
def list_repayments(
    order_id: int | None = Query(None),
    keyword: str = Query(""),
    status: str = Query(""),
    skip: int = 0,
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    q = db.query(RepaymentPlan).filter(RepaymentPlan.tenant_id == user.tenant_id)
    if order_id is not None:
        q = q.filter(RepaymentPlan.order_id == order_id)
    if keyword:
        order_ids = (
            db.query(Order.id)
            .outerjoin(Customer, Order.customer_id == Customer.id)
            .filter(
                Order.tenant_id == user.tenant_id,
                Order.order_no.contains(keyword)
                | Customer.name.contains(keyword)
                | Customer.phone.contains(keyword)
            )
            .all()
        )
        ids = [oid for (oid,) in order_ids]
        q = q.filter(RepaymentPlan.order_id.in_(ids)) if ids else q.filter(False)
    if status:
        q = q.filter(RepaymentPlan.status == status)
    plans = q.order_by(RepaymentPlan.order_id, RepaymentPlan.period_no).offset(skip).all()

    # Batch-load orders and customers
    oids = {p.order_id for p in plans}
    order_map: dict[int, Order] = {}
    cmap: dict[int, str] = {}
    if oids:
        orders_list = db.query(Order).filter(Order.id.in_(oids)).all()
        order_map = {o.id: o for o in orders_list}
        cids = {o.customer_id for o in orders_list if o.customer_id}
        if cids:
            cmap = {c.id: c.name for c in db.query(Customer).filter(Customer.id.in_(cids)).all()}

    return [_plan_to_dict(p, order_map.get(p.order_id), cmap.get(order_map.get(p.order_id, None) and order_map[p.order_id].customer_id, "")) for p in plans]


@router.get("/count")
def count_repayments(order_id: int | None = None, status: str = "", user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    q = db.query(RepaymentPlan).filter(RepaymentPlan.tenant_id == user.tenant_id)
    if order_id is not None:
        q = q.filter(RepaymentPlan.order_id == order_id)
    if status:
        q = q.filter(RepaymentPlan.status == status)
    return {"count": q.count()}


@router.post("/", response_model=RepaymentPlanOut)
def create_repayment(data: RepaymentPlanCreate, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    rp = RepaymentPlan(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(rp)
    db.flush()
    _sync_order_status(db, rp.order_id)
    db.commit()
    db.refresh(rp)
    order = db.query(Order).filter(Order.id == rp.order_id).first()
    customer_name = ""
    if order:
        c = db.query(Customer).filter(Customer.id == order.customer_id).first()
        customer_name = c.name if c else ""
    return _plan_to_dict(rp, order, customer_name)


@router.post("/batch", response_model=list[RepaymentPlanOut])
def batch_create_repayments(items: list[RepaymentPlanCreate], user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    results = []
    order_ids = set()
    for data in items:
        rp = RepaymentPlan(**data.model_dump(), tenant_id=user.tenant_id)
        db.add(rp)
        db.flush()
        results.append(rp)
        order_ids.add(rp.order_id)
    for oid in order_ids:
        _sync_order_status(db, oid)
    db.commit()
    for rp in results:
        db.refresh(rp)
    # Batch-load for response
    oids = {rp.order_id for rp in results}
    order_map = {o.id: o for o in db.query(Order).filter(Order.id.in_(oids)).all()}
    cids = {o.customer_id for o in order_map.values() if o.customer_id}
    cmap = {c.id: c.name for c in db.query(Customer).filter(Customer.id.in_(cids)).all()} if cids else {}
    return [_plan_to_dict(rp, order_map.get(rp.order_id), cmap.get(getattr(order_map.get(rp.order_id), 'customer_id', None), "")) for rp in results]


@router.put("/{plan_id}", response_model=RepaymentPlanOut)
def update_repayment(plan_id: int, data: RepaymentPlanUpdate, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    rp = db.query(RepaymentPlan).filter(RepaymentPlan.id == plan_id, RepaymentPlan.tenant_id == user.tenant_id).first()
    if not rp:
        raise HTTPException(status_code=404, detail="还款记录不存在")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(rp, k, v)
    db.flush()
    _sync_order_status(db, rp.order_id)
    db.commit()
    db.refresh(rp)
    order = db.query(Order).filter(Order.id == rp.order_id).first()
    customer_name = ""
    if order:
        c = db.query(Customer).filter(Customer.id == order.customer_id).first()
        customer_name = c.name if c else ""
    return _plan_to_dict(rp, order, customer_name)


@router.delete("/by-order/{order_id}")
def delete_repayments_by_order(order_id: int, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    """Delete all repayment plans for a given order (bulk delete)."""
    db.query(RepaymentPlan).filter(
        RepaymentPlan.order_id == order_id,
        RepaymentPlan.tenant_id == user.tenant_id,
    ).delete(synchronize_session=False)
    db.commit()
    return {"message": "删除成功"}


@router.delete("/{plan_id}")
def delete_repayment(plan_id: int, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    rp = db.query(RepaymentPlan).filter(RepaymentPlan.id == plan_id, RepaymentPlan.tenant_id == user.tenant_id).first()
    if not rp:
        raise HTTPException(status_code=404, detail="还款记录不存在")
    db.delete(rp)
    db.commit()
    return {"message": "删除成功"}
