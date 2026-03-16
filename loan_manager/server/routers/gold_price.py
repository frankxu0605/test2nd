"""Gold price management API — global (shared across all tenants)."""
from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import GoldPrice, User
from ..auth_deps import get_current_user

router = APIRouter(prefix="/api/gold-price", tags=["gold_price"])


class GoldPriceSet(BaseModel):
    price_date: date
    buy_price: Decimal
    sell_price: Decimal = Decimal("0.00")
    updated_by: str = ""


class GoldPriceOut(BaseModel):
    id: int
    price_date: date
    buy_price: Decimal
    sell_price: Decimal
    updated_by: str
    updated_at: datetime
    model_config = {"from_attributes": True}


@router.get("/today", response_model=GoldPriceOut | None)
def get_today_price(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get today's gold price."""
    record = db.query(GoldPrice).filter(GoldPrice.price_date == date.today()).first()
    if not record:
        record = db.query(GoldPrice).order_by(GoldPrice.price_date.desc()).first()
    return record


@router.get("/history", response_model=list[GoldPriceOut])
def get_price_history(limit: int = 30, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get recent gold price history."""
    return db.query(GoldPrice).order_by(GoldPrice.price_date.desc()).limit(limit).all()


@router.post("/", response_model=GoldPriceOut)
def set_gold_price(data: GoldPriceSet, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Set or update gold price for a date."""
    record = db.query(GoldPrice).filter(GoldPrice.price_date == data.price_date).first()
    if record:
        record.buy_price = data.buy_price
        record.sell_price = data.sell_price
        record.updated_by = data.updated_by
    else:
        record = GoldPrice(**data.model_dump())
        db.add(record)
    db.commit()
    db.refresh(record)
    return record
