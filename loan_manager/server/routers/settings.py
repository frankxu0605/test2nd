from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import SystemSetting, User
from ..auth_deps import get_active_user

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/{key}")
def get_setting(key: str, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    s = db.query(SystemSetting).filter(
        SystemSetting.key == key,
        SystemSetting.tenant_id == user.tenant_id,
    ).first()
    return {"key": key, "value": s.value if s else ""}


@router.put("/{key}")
def set_setting(key: str, body: dict, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    value = str(body.get("value", ""))
    s = db.query(SystemSetting).filter(
        SystemSetting.key == key,
        SystemSetting.tenant_id == user.tenant_id,
    ).first()
    if s:
        s.value = value
    else:
        s = SystemSetting(key=key, value=value, tenant_id=user.tenant_id)
        db.add(s)
    db.commit()
    return {"key": key, "value": value}
