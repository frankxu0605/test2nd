from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Expense, User
from ..schemas import ExpenseCreate, ExpenseUpdate, ExpenseOut
from ..auth_deps import get_active_user

router = APIRouter(prefix="/api/expenses", tags=["expenses"])


def _generate_order_no(db: Session, tenant_id: int) -> str:
    today = date.today().strftime("%Y%m%d")
    prefix = f"CG{today}"
    last = (
        db.query(Expense)
        .filter(Expense.tenant_id == tenant_id, Expense.purchase_order_no.like(f"{prefix}%"))
        .order_by(Expense.purchase_order_no.desc())
        .first()
    )
    if last and last.purchase_order_no:
        seq = int(last.purchase_order_no[-3:]) + 1
    else:
        seq = 1
    return f"{prefix}{seq:03d}"


@router.get("/", response_model=list[ExpenseOut])
def list_expenses(
    keyword: str = Query(""),
    category: str = Query(""),
    skip: int = 0,
    limit: int = 100,
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    q = db.query(Expense).filter(Expense.tenant_id == user.tenant_id)
    if keyword:
        q = q.filter(
            Expense.supplier_name.contains(keyword)
            | Expense.product_name.contains(keyword)
            | Expense.purchase_order_no.contains(keyword)
            | Expense.notes.contains(keyword)
        )
    if category:
        q = q.filter(Expense.category == category)
    return q.order_by(Expense.id.desc()).offset(skip).limit(limit).all()


@router.get("/count")
def count_expenses(keyword: str = "", category: str = "", user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    q = db.query(Expense).filter(Expense.tenant_id == user.tenant_id)
    if keyword:
        q = q.filter(
            Expense.supplier_name.contains(keyword)
            | Expense.product_name.contains(keyword)
            | Expense.purchase_order_no.contains(keyword)
        )
    if category:
        q = q.filter(Expense.category == category)
    return {"count": q.count()}


@router.get("/suppliers")
def search_suppliers(keyword: str = Query(""), user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    """Search distinct suppliers from previous expense records."""
    q = db.query(
        Expense.supplier_name,
        Expense.supplier_phone,
        Expense.supplier_address,
    ).filter(Expense.tenant_id == user.tenant_id, Expense.supplier_name != "")
    if keyword:
        q = q.filter(Expense.supplier_name.contains(keyword))
    rows = q.group_by(Expense.supplier_name).all()
    return [
        {"name": r.supplier_name, "phone": r.supplier_phone, "address": r.supplier_address}
        for r in rows
    ]


@router.post("/", response_model=ExpenseOut)
def create_expense(data: ExpenseCreate, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    d = data.model_dump()
    if not d.get("expense_date"):
        d["expense_date"] = date.today()
    if not d.get("purchase_order_no"):
        d["purchase_order_no"] = _generate_order_no(db, user.tenant_id)
    d["tenant_id"] = user.tenant_id
    exp = Expense(**d)
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return exp


@router.put("/{expense_id}", response_model=ExpenseOut)
def update_expense(expense_id: int, data: ExpenseUpdate, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    exp = db.query(Expense).filter(Expense.id == expense_id, Expense.tenant_id == user.tenant_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="支出记录不存在")
    updates = data.model_dump(exclude_unset=True)
    for k, v in updates.items():
        setattr(exp, k, v)
    db.commit()
    db.refresh(exp)
    return exp


@router.delete("/{expense_id}")
def delete_expense(expense_id: int, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    exp = db.query(Expense).filter(Expense.id == expense_id, Expense.tenant_id == user.tenant_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="支出记录不存在")
    db.delete(exp)
    db.commit()
    return {"message": "删除成功"}
