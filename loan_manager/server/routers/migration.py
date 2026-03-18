from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..database import get_db
from ..auth_deps import get_superadmin_user
from ..models import User

router = APIRouter(prefix="/api/migration", tags=["migration"])

@router.post("/update-overdue-reporter")
def update_overdue_reporter(user: User = Depends(get_superadmin_user), db: Session = Depends(get_db)):
    """Update existing overdue pool records from '管理员' to company name"""
    try:
        # Update records for tenant_id = 1 (苍南县艺朵珠宝)
        result = db.execute(
            text("UPDATE overdue_pool SET reported_by = '苍南县艺朵珠宝' WHERE reported_by = '管理员' AND tenant_id = 1")
        )
        db.commit()

        # Get count of updated records
        count_result = db.execute(
            text("SELECT COUNT(*) FROM overdue_pool WHERE reported_by = '苍南县艺朵珠宝' AND tenant_id = 1")
        )
        updated_count = count_result.scalar()

        return {
            "message": "Successfully updated overdue pool reporter names",
            "updated_records": updated_count,
            "details": "Changed '管理员' to '苍南县艺朵珠宝' for tenant_id = 1"
        }
    except Exception as e:
        db.rollback()
        return {"error": f"Failed to update records: {str(e)}"}