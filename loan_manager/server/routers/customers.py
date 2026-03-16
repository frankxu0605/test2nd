from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Customer, Order, RepaymentPlan, User
from ..schemas import CustomerCreate, CustomerUpdate, CustomerOut
from ..auth_deps import get_active_user

router = APIRouter(prefix="/api/customers", tags=["customers"])


def _next_customer_no(db: Session, tenant_id: int) -> int:
    """Get the next sequential customer_no for a tenant."""
    max_no = db.query(func.max(Customer.customer_no)).filter(
        Customer.tenant_id == tenant_id
    ).scalar()
    return (max_no or 0) + 1


@router.get("/", response_model=list[CustomerOut])
def list_customers(
    keyword: str = Query("", description="搜索关键词"),
    skip: int = 0,
    limit: int = 100,
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    q = db.query(Customer).filter(Customer.tenant_id == user.tenant_id)
    if keyword:
        q = q.filter(
            Customer.name.contains(keyword)
            | Customer.phone.contains(keyword)
            | Customer.id_card.contains(keyword)
        )
    return q.order_by(Customer.customer_no.asc()).offset(skip).limit(limit).all()


@router.get("/count")
def count_customers(keyword: str = "", user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    q = db.query(Customer).filter(Customer.tenant_id == user.tenant_id)
    if keyword:
        q = q.filter(
            Customer.name.contains(keyword)
            | Customer.phone.contains(keyword)
            | Customer.id_card.contains(keyword)
        )
    return {"count": q.count()}


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: int, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    c = db.query(Customer).filter(Customer.id == customer_id, Customer.tenant_id == user.tenant_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="客户不存在")
    return c


@router.post("/", response_model=CustomerOut)
def create_customer(data: CustomerCreate, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    d = data.model_dump()
    # If id_card provided, check for existing customer with same id_card (auto-merge)
    if d.get("id_card"):
        existing_by_id_card = db.query(Customer).filter(
            Customer.tenant_id == user.tenant_id,
            Customer.id_card == d["id_card"],
        ).first()
        if existing_by_id_card:
            # Update non-empty fields and return existing record
            for k, v in d.items():
                if k not in ("customer_no",) and v not in (None, "", 0):
                    setattr(existing_by_id_card, k, v)
            db.commit()
            db.refresh(existing_by_id_card)
            return existing_by_id_card
    # Auto-assign customer_no if not provided or zero
    if not d.get("customer_no"):
        d["customer_no"] = _next_customer_no(db, user.tenant_id)
    else:
        existing = db.query(Customer).filter(
            Customer.tenant_id == user.tenant_id,
            Customer.customer_no == d["customer_no"],
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"编号 {d['customer_no']} 已被使用")
    c = Customer(**d, tenant_id=user.tenant_id)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.post("/merge-duplicates")
def merge_duplicate_customers(user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    """Find all customers with same id_card in the tenant, merge duplicates into the oldest record."""
    from ..models import Appointment
    # Find id_cards that appear more than once
    dup_query = (
        db.query(Customer.id_card, func.count(Customer.id).label("cnt"))
        .filter(Customer.tenant_id == user.tenant_id, Customer.id_card != "")
        .group_by(Customer.id_card)
        .having(func.count(Customer.id) > 1)
        .all()
    )
    merged_groups = 0
    merged_customers = 0
    for id_card, _ in dup_query:
        group = (
            db.query(Customer)
            .filter(Customer.tenant_id == user.tenant_id, Customer.id_card == id_card)
            .order_by(Customer.id.asc())
            .all()
        )
        if len(group) < 2:
            continue
        primary = group[0]
        # Merge info from duplicates into primary (fill empty fields)
        for dup in group[1:]:
            for col in ("name", "phone", "address", "email", "account_manager", "emergency_contact"):
                if not getattr(primary, col) and getattr(dup, col):
                    setattr(primary, col, getattr(dup, col))
            # Reassign orders and appointments to primary
            db.query(Order).filter(Order.customer_id == dup.id).update({"customer_id": primary.id})
            db.query(Appointment).filter(Appointment.customer_id == dup.id).update({"customer_id": primary.id})
            db.flush()
            db.delete(dup)
            merged_customers += 1
        merged_groups += 1
    db.commit()
    return {"merged_groups": merged_groups, "removed_duplicates": merged_customers}


@router.put("/{customer_id}", response_model=CustomerOut)
def update_customer(customer_id: int, data: CustomerUpdate, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    c = db.query(Customer).filter(Customer.id == customer_id, Customer.tenant_id == user.tenant_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="客户不存在")
    updates = data.model_dump(exclude_unset=True)
    if "customer_no" in updates and updates["customer_no"]:
        existing = db.query(Customer).filter(
            Customer.tenant_id == user.tenant_id,
            Customer.customer_no == updates["customer_no"],
            Customer.id != customer_id,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"编号 {updates['customer_no']} 已被使用")
    for k, v in updates.items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{customer_id}")
def delete_customer(customer_id: int, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    c = db.query(Customer).filter(Customer.id == customer_id, Customer.tenant_id == user.tenant_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="客户不存在")
    db.delete(c)
    db.commit()
    return {"message": "删除成功"}


@router.get("/{customer_id}/overview")
def customer_overview(customer_id: int, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    """Return customer info + order history with repayment summary."""
    c = db.query(Customer).filter(Customer.id == customer_id, Customer.tenant_id == user.tenant_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="客户不存在")

    orders = db.query(Order).filter(Order.customer_id == customer_id, Order.tenant_id == user.tenant_id).order_by(Order.id).all()
    order_list = []
    for o in orders:
        total_price = float((o.unit_price + o.processing_fee) * o.weight)
        down_payment = float(o.down_payment)
        notary_fee = float(o.notary_fee)

        plans = db.query(RepaymentPlan).filter(
            RepaymentPlan.order_id == o.id
        ).order_by(RepaymentPlan.period_no).all()

        total_paid = sum(float(p.paid_amount) for p in plans)
        balance = total_price - down_payment - total_paid

        settlement_date = None
        settlement_days = None
        has_overdue = any("逾期" in (p.status or "") for p in plans)
        # Check if all periods are fully paid (actual settlement)
        all_paid = plans and all(
            float(p.paid_amount) >= float(p.total_amount) and p.paid_date
            for p in plans
        )
        if all_paid or o.status == "已结清":
            display_status = "已结清"
            paid_dates = [p.paid_date for p in plans if p.paid_date]
            if paid_dates:
                last_paid = max(paid_dates)
                settlement_date = str(last_paid)
                settlement_days = (last_paid - o.order_date).days
        elif has_overdue:
            display_status = "已逾期"
        else:
            display_status = "正常"

        order_list.append({
            "order_no": o.order_no,
            "weight": float(o.weight),
            "total_price": round(total_price),
            "down_payment": round(down_payment),
            "notary_fee": round(notary_fee),
            "installment_amount": float(o.installment_amount),
            "installment_periods": o.installment_periods,
            "order_date": str(o.order_date),
            "status": display_status,
            "settlement_date": settlement_date,
            "settlement_days": settlement_days,
            "balance": round(balance, 2),
        })

    return {
        "customer": {
            "id": c.id,
            "customer_no": c.customer_no,
            "name": c.name,
            "phone": c.phone,
            "id_card": c.id_card,
            "address": c.address,
            "email": c.email,
            "account_manager": c.account_manager,
            "emergency_contact": c.emergency_contact,
            "has_overdue": c.has_overdue,
            "has_property": c.has_property,
        },
        "orders": order_list,
    }
