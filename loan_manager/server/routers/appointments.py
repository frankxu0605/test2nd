from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Appointment, Customer, User
from ..schemas import AppointmentCreate, AppointmentUpdate, AppointmentOut
from ..auth_deps import get_active_user

router = APIRouter(prefix="/api/appointments", tags=["appointments"])


def _to_out(appt: Appointment, db: Session) -> dict:
    d = AppointmentOut.model_validate(appt).model_dump()
    customer = db.query(Customer).filter(Customer.id == appt.customer_id).first()
    d["customer_name"] = customer.name if customer else ""
    return d


@router.get("/", response_model=list[AppointmentOut])
def list_appointments(
    status: str = Query(""),
    skip: int = 0,
    limit: int = 100,
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    q = db.query(Appointment).filter(Appointment.tenant_id == user.tenant_id)
    if status:
        q = q.filter(Appointment.status == status)
    appts = q.order_by(Appointment.appointment_date.desc()).offset(skip).limit(limit).all()
    return [_to_out(a, db) for a in appts]


@router.get("/count")
def count_appointments(status: str = "", user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    q = db.query(Appointment).filter(Appointment.tenant_id == user.tenant_id)
    if status:
        q = q.filter(Appointment.status == status)
    return {"count": q.count()}


@router.post("/", response_model=AppointmentOut)
def create_appointment(data: AppointmentCreate, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    appt = Appointment(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(appt)
    db.commit()
    db.refresh(appt)
    return _to_out(appt, db)


@router.put("/{appt_id}", response_model=AppointmentOut)
def update_appointment(appt_id: int, data: AppointmentUpdate, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    appt = db.query(Appointment).filter(Appointment.id == appt_id, Appointment.tenant_id == user.tenant_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="预约记录不存在")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(appt, k, v)
    db.commit()
    db.refresh(appt)
    return _to_out(appt, db)


@router.delete("/{appt_id}")
def delete_appointment(appt_id: int, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    appt = db.query(Appointment).filter(Appointment.id == appt_id, Appointment.tenant_id == user.tenant_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="预约记录不存在")
    db.delete(appt)
    db.commit()
    return {"message": "删除成功"}
