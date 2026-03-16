from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Supplier, StaffMember, PaymentAccount, DeliveryAddress, User
from ..schemas import (
    SupplierIn, SupplierOut,
    StaffMemberIn, StaffMemberOut,
    PaymentAccountIn, PaymentAccountOut,
    DeliveryAddressIn, DeliveryAddressOut,
)
from ..auth_deps import get_active_user

router = APIRouter(prefix="/api/company-info", tags=["company-info"])


def _make_crud(Model, InSchema, OutSchema, resource_name: str):
    """Return (list_fn, create_fn, update_fn, delete_fn) for a model."""

    def list_items(user: User = Depends(get_active_user), db: Session = Depends(get_db)):
        return db.query(Model).filter(Model.tenant_id == user.tenant_id).all()

    def create_item(data: InSchema, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
        obj = Model(**data.model_dump(), tenant_id=user.tenant_id)
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    def update_item(item_id: int, data: InSchema, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
        obj = db.query(Model).filter(Model.id == item_id, Model.tenant_id == user.tenant_id).first()
        if not obj:
            raise HTTPException(status_code=404, detail=f"{resource_name}不存在")
        for k, v in data.model_dump().items():
            setattr(obj, k, v)
        db.commit()
        db.refresh(obj)
        return obj

    def delete_item(item_id: int, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
        obj = db.query(Model).filter(Model.id == item_id, Model.tenant_id == user.tenant_id).first()
        if not obj:
            raise HTTPException(status_code=404, detail=f"{resource_name}不存在")
        db.delete(obj)
        db.commit()
        return {"message": "删除成功"}

    return list_items, create_item, update_item, delete_item


_sl, _sc, _su, _sd = _make_crud(Supplier, SupplierIn, SupplierOut, "供应商")
router.get("/suppliers", response_model=list[SupplierOut])(_sl)
router.post("/suppliers", response_model=SupplierOut)(_sc)
router.put("/suppliers/{item_id}", response_model=SupplierOut)(_su)
router.delete("/suppliers/{item_id}")(_sd)

_stl, _stc, _stu, _std = _make_crud(StaffMember, StaffMemberIn, StaffMemberOut, "花名册成员")
router.get("/staff", response_model=list[StaffMemberOut])(_stl)
router.post("/staff", response_model=StaffMemberOut)(_stc)
router.put("/staff/{item_id}", response_model=StaffMemberOut)(_stu)
router.delete("/staff/{item_id}")(_std)

_pl, _pc, _pu, _pd = _make_crud(PaymentAccount, PaymentAccountIn, PaymentAccountOut, "收款账户")
router.get("/payments", response_model=list[PaymentAccountOut])(_pl)
router.post("/payments", response_model=PaymentAccountOut)(_pc)
router.put("/payments/{item_id}", response_model=PaymentAccountOut)(_pu)
router.delete("/payments/{item_id}")(_pd)

_al, _ac, _au, _ad = _make_crud(DeliveryAddress, DeliveryAddressIn, DeliveryAddressOut, "收货地址")
router.get("/addresses", response_model=list[DeliveryAddressOut])(_al)
router.post("/addresses", response_model=DeliveryAddressOut)(_ac)
router.put("/addresses/{item_id}", response_model=DeliveryAddressOut)(_au)
router.delete("/addresses/{item_id}")(_ad)
