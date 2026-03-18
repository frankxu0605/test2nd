from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..database import get_db
from ..auth_deps import get_active_user
from ..models import User

router = APIRouter(prefix="/api/migration", tags=["migration"])

@router.post("/update-overdue-reporter")
def update_overdue_reporter(user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    """Update existing overdue pool records from '管理员' to company name"""
    try:
        # Get tenant name for the current user
        from ..models import Tenant
        tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
        if not tenant:
            return {"error": "Tenant not found"}

        # Update records for current tenant
        result = db.execute(
            text(f"UPDATE overdue_pool SET reported_by = :tenant_name WHERE reported_by = '管理员' AND tenant_id = :tenant_id"),
            {"tenant_name": tenant.name, "tenant_id": user.tenant_id}
        )
        db.commit()

        # Get count of updated records
        count_result = db.execute(
            text("SELECT COUNT(*) FROM overdue_pool WHERE reported_by = :tenant_name AND tenant_id = :tenant_id"),
            {"tenant_name": tenant.name, "tenant_id": user.tenant_id}
        )
        updated_count = count_result.scalar()

        return {
            "message": "Successfully updated overdue pool reporter names",
            "updated_records": updated_count,
            "details": f"Changed '管理员' to '{tenant.name}' for tenant_id = {user.tenant_id}"
        }
    except Exception as e:
        db.rollback()
        return {"error": f"Failed to update records: {str(e)}"}