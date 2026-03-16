from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import WarehouseEntry, User
from ..schemas import WarehouseEntryCreate, WarehouseEntryUpdate, WarehouseEntryOut
from ..auth_deps import get_active_user

router = APIRouter(prefix="/api/warehouse", tags=["warehouse"])


@router.get("/", response_model=list[WarehouseEntryOut])
def list_entries(
    keyword: str = Query(""),
    skip: int = 0,
    limit: int = 100,
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    q = db.query(WarehouseEntry).filter(WarehouseEntry.tenant_id == user.tenant_id)
    if keyword:
        q = q.filter(
            WarehouseEntry.item_no.contains(keyword)
            | WarehouseEntry.barcode.contains(keyword)
            | WarehouseEntry.buyer.contains(keyword)
            | WarehouseEntry.salesperson.contains(keyword)
            | WarehouseEntry.entry_operator.contains(keyword)
            | WarehouseEntry.notes.contains(keyword)
        )
    return q.order_by(WarehouseEntry.id.desc()).offset(skip).limit(limit).all()


@router.get("/count")
def count_entries(keyword: str = "", user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    q = db.query(WarehouseEntry).filter(WarehouseEntry.tenant_id == user.tenant_id)
    if keyword:
        q = q.filter(
            WarehouseEntry.item_no.contains(keyword)
            | WarehouseEntry.barcode.contains(keyword)
        )
    return {"count": q.count()}


@router.post("/", response_model=WarehouseEntryOut)
def create_entry(data: WarehouseEntryCreate, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    entry = WarehouseEntry(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.put("/{entry_id}", response_model=WarehouseEntryOut)
def update_entry(entry_id: int, data: WarehouseEntryUpdate, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    entry = db.query(WarehouseEntry).filter(WarehouseEntry.id == entry_id, WarehouseEntry.tenant_id == user.tenant_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="入库记录不存在")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(entry, k, v)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}")
def delete_entry(entry_id: int, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    entry = db.query(WarehouseEntry).filter(WarehouseEntry.id == entry_id, WarehouseEntry.tenant_id == user.tenant_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="入库记录不存在")
    db.delete(entry)
    db.commit()
    return {"message": "删除成功"}
