from datetime import datetime, timedelta, date

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_HOURS
from ..database import get_db
from ..models import User, Tenant
from ..schemas import (
    LoginRequest, CompanyRegisterRequest, TokenResponse, UserOut, TenantOut,
    TeamMemberCreate, TeamMemberOut,
)
from ..auth_deps import get_current_user, require_admin, get_current_tenant

router = APIRouter(prefix="/api/auth", tags=["auth"])


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id: int, username: str, role: str, tenant_id: int | None = None) -> str:
    payload = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "tenant_id": tenant_id,
        "exp": datetime.now() + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# ---------- Login ----------

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="账户已被禁用")

    token = create_token(user.id, user.username, user.role, user.tenant_id)

    tenant_out = None
    if user.tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
        if tenant:
            tenant_out = TenantOut.model_validate(tenant)

    return TokenResponse(
        access_token=token,
        user=UserOut.model_validate(user),
        tenant=tenant_out,
    )


# ---------- Register Company ----------

@router.post("/register-company", response_model=TokenResponse)
def register_company(req: CompanyRegisterRequest, db: Session = Depends(get_db)):
    """Register a new company + admin user. 7-day free trial."""
    # Check username uniqueness
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=400, detail="用户名已存在")

    # Create tenant
    tenant = Tenant(
        name=req.company_name,
        contact_phone=req.phone,
        status="active",
        plan="free_trial",
        trial_end_date=date.today() + timedelta(days=7),
        max_users=5,
    )
    db.add(tenant)
    db.flush()  # get tenant.id

    # Create admin user
    user = User(
        tenant_id=tenant.id,
        username=req.username,
        password_hash=hash_password(req.password),
        real_name=req.real_name,
        email=req.email,
        phone=req.phone,
        role="admin",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.refresh(tenant)

    token = create_token(user.id, user.username, user.role, tenant.id)
    return TokenResponse(
        access_token=token,
        user=UserOut.model_validate(user),
        tenant=TenantOut.model_validate(tenant),
    )


# ---------- Team Management (admin only) ----------

@router.get("/team", response_model=list[TeamMemberOut])
def list_team(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all members in the same tenant."""
    members = db.query(User).filter(User.tenant_id == user.tenant_id).all()
    return [TeamMemberOut.model_validate(m) for m in members]


@router.post("/team", response_model=TeamMemberOut)
def add_team_member(
    req: TeamMemberCreate,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin adds a new team member."""
    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=400, detail="公司不存在")

    # Check max_users
    count = db.query(User).filter(User.tenant_id == tenant.id, User.is_active == True).count()
    if count >= tenant.max_users:
        raise HTTPException(status_code=400, detail=f"团队成员已达上限（{tenant.max_users}人）")

    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=400, detail="用户名已存在")

    member = User(
        tenant_id=tenant.id,
        username=req.username,
        password_hash=hash_password(req.password),
        real_name=req.real_name,
        email=req.email,
        phone=req.phone,
        role=req.role if req.role in ("admin", "member") else "member",
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return TeamMemberOut.model_validate(member)


@router.put("/team/{member_id}")
def update_team_member(
    member_id: int,
    req: TeamMemberCreate,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin updates a team member."""
    member = db.query(User).filter(User.id == member_id, User.tenant_id == user.tenant_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="成员不存在")

    if req.username != member.username:
        if db.query(User).filter(User.username == req.username).first():
            raise HTTPException(status_code=400, detail="用户名已存在")
        member.username = req.username

    member.real_name = req.real_name
    member.email = req.email
    member.phone = req.phone
    member.role = req.role if req.role in ("admin", "member") else "member"
    if req.password:
        member.password_hash = hash_password(req.password)
    db.commit()
    return {"ok": True}


@router.delete("/team/{member_id}")
def remove_team_member(
    member_id: int,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin deactivates a team member."""
    if member_id == user.id:
        raise HTTPException(status_code=400, detail="不能删除自己")
    member = db.query(User).filter(User.id == member_id, User.tenant_id == user.tenant_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="成员不存在")
    member.is_active = False
    db.commit()
    return {"ok": True}


# ---------- Current user info ----------

@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)


@router.get("/tenant", response_model=TenantOut)
def get_tenant_info(
    tenant: Tenant = Depends(get_current_tenant),
):
    return TenantOut.model_validate(tenant)
