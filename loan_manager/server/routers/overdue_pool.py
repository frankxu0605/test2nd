from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import OverduePool
from ..auth_deps import get_active_user
from ..models import User

router = APIRouter(prefix="/api/overdue-pool", tags=["overdue-pool"])

@router.post("/")
def create_overdue_pool(data: dict, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    entry = OverduePool(
        tenant_id=user.tenant_id,
        customer_name=data.get("customer_name", ""),
        id_card=data.get("id_card", ""),
        phone=data.get("phone", ""),
        address=data.get("address", ""),
        overdue_amount=float(data.get("overdue_amount", 0)),
        overdue_periods=int(data.get("overdue_periods", 0)),
        overdue_date=data.get("overdue_date", ""),
        notes=data.get("notes", ""),
        reported_by=data.get("reported_by", ""),
    )
    db.add(entry)
    db.commit()
    return {"message": "已上报至逾期公共池"}

@router.get("/")
def list_overdue_pool(user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    return db.query(OverduePool).filter(OverduePool.tenant_id == user.tenant_id).all()