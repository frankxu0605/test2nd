from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import WarehouseEntry, User
from ..schemas import WarehouseEntryOut
from ..auth_deps import get_active_user

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.get("/", response_model=list[WarehouseEntryOut])
def list_inventory(
    keyword: str = Query(""),
    skip: int = 0,
    limit: int = 100,
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    q = db.query(WarehouseEntry).filter(
        WarehouseEntry.tenant_id == user.tenant_id,
        WarehouseEntry.exit_date.is_(None),
    )
    if keyword:
        q = q.filter(
            WarehouseEntry.item_no.contains(keyword)
            | WarehouseEntry.barcode.contains(keyword)
            | WarehouseEntry.entry_operator.contains(keyword)
            | WarehouseEntry.notes.contains(keyword)
        )
    return q.order_by(WarehouseEntry.id.desc()).offset(skip).limit(limit).all()


@router.get("/count")
def count_inventory(keyword: str = "", user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    q = db.query(WarehouseEntry).filter(
        WarehouseEntry.tenant_id == user.tenant_id,
        WarehouseEntry.exit_date.is_(None),
    )
    if keyword:
        q = q.filter(
            WarehouseEntry.item_no.contains(keyword)
            | WarehouseEntry.barcode.contains(keyword)
        )
    return {"count": q.count()}
