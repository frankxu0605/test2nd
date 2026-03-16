"""
Authentication & authorization dependencies for FastAPI.
All routers should use these to enforce login + tenant isolation.
"""
from datetime import date

import jwt
from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session

from .config import JWT_SECRET, JWT_ALGORITHM
from .database import get_db
from .models import User, Tenant


def get_current_user(
    authorization: str = Header(default=""),
    db: Session = Depends(get_db),
) -> User:
    """Extract JWT from Authorization header, return active User or 401."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未登录或token缺失")
    token = authorization[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="无效的token")

    user_id = payload.get("user_id")
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="用户不存在或已被禁用")
    return user


def get_current_tenant(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Tenant:
    """Return the user's tenant. Superadmin may not have a tenant."""
    if user.role == "superadmin":
        # Superadmin doesn't belong to a tenant — handled separately
        raise HTTPException(status_code=400, detail="超级管理员请使用管理后台")
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail="用户未关联公司")
    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=403, detail="公司不存在")
    return tenant


def require_active_subscription(
    tenant: Tenant = Depends(get_current_tenant),
) -> Tenant:
    """Check that the tenant has an active trial or subscription."""
    today = date.today()
    if tenant.status == "suspended":
        raise HTTPException(status_code=402, detail="账户已被暂停，请联系管理员")

    if tenant.plan == "free_trial":
        if tenant.trial_end_date and tenant.trial_end_date < today:
            raise HTTPException(status_code=402, detail="免费试用已到期，请订阅以继续使用")
    else:
        if tenant.subscription_end_date and tenant.subscription_end_date < today:
            raise HTTPException(status_code=402, detail="订阅已到期，请续费以继续使用")

    return tenant


def require_admin(
    user: User = Depends(get_current_user),
) -> User:
    """Only admin or superadmin can proceed."""
    if user.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="仅管理员可执行此操作")
    return user


def require_superadmin(
    user: User = Depends(get_current_user),
) -> User:
    """Only superadmin can proceed."""
    if user.role != "superadmin":
        raise HTTPException(status_code=403, detail="仅超级管理员可执行此操作")
    return user


def get_active_user(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Combined dependency: authenticate user + verify tenant subscription.
    Returns the User object (use user.tenant_id for data filtering).
    """
    if user.role == "superadmin":
        return user  # superadmin bypasses tenant/subscription checks
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail="用户未关联公司")
    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=403, detail="公司不存在")

    today = date.today()
    if tenant.status == "suspended":
        raise HTTPException(status_code=402, detail="账户已被暂停，请联系管理员")
    if tenant.plan == "free_trial":
        if tenant.trial_end_date and tenant.trial_end_date < today:
            raise HTTPException(status_code=402, detail="免费试用已到期，请订阅以继续使用")
    else:
        if tenant.subscription_end_date and tenant.subscription_end_date < today:
            raise HTTPException(status_code=402, detail="订阅已到期，请续费以继续使用")

    return user
