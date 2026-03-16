"""
Payment router: WeChat Pay + Alipay integration for subscription purchases.
"""
import json
import logging
import os
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from glob import glob

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import PlainTextResponse, RedirectResponse
from sqlalchemy.orm import Session

from ..config import (
    PAYMENT_SANDBOX, PLAN_PRICES, PLAN_DURATION_DAYS,
    WECHAT_APPID, WECHAT_MCH_ID, WECHAT_API_V3_KEY,
    WECHAT_CERT_SERIAL, WECHAT_PRIVATE_KEY, WECHAT_NOTIFY_URL,
    ALIPAY_APP_ID, ALIPAY_PRIVATE_KEY, ALIPAY_PUBLIC_KEY,
    ALIPAY_NOTIFY_URL, ALIPAY_RETURN_URL, ALIPAY_SANDBOX,
)
from ..database import get_db
from ..models import Payment, Subscription, Tenant, User
from ..schemas import (
    CreatePaymentOrder, PaymentOrderResponse, PaymentStatusResponse,
    SubscriptionOut,
)
from ..auth_deps import get_current_user, require_admin, require_superadmin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/payments", tags=["payments"])


# Upload directory for QR code images
_UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "web_client", "uploads")


def _find_qr_image(method: str) -> str | None:
    """Find uploaded QR image for a payment method. Returns URL path or None."""
    for ext in ("png", "jpg", "jpeg", "gif", "webp"):
        path = os.path.join(_UPLOADS_DIR, f"{method}_qr.{ext}")
        if os.path.isfile(path):
            return f"/static/uploads/{method}_qr.{ext}"
    return None


# ============================================================
# Helper: activate subscription after successful payment
# ============================================================

def activate_subscription(db: Session, payment: Payment, trade_no: str = ""):
    """Mark payment as success, create Subscription, update Tenant."""
    if payment.status == "success":
        return  # already processed (idempotent)

    payment.status = "success"
    payment.trade_no = trade_no

    tenant = db.query(Tenant).filter(Tenant.id == payment.tenant_id).first()
    if not tenant:
        logger.error(f"Tenant {payment.tenant_id} not found for payment {payment.id}")
        return

    plan = payment.payment_method  # we store plan in a separate way, let's get from amount
    # Determine plan from amount
    amount_str = str(payment.amount)
    if amount_str == PLAN_PRICES.get("yearly"):
        plan_type = "yearly"
    else:
        plan_type = "monthly"

    duration = PLAN_DURATION_DAYS.get(plan_type, 30)

    # If tenant has existing unexpired subscription, stack on top
    today = date.today()
    base_date = today
    if tenant.subscription_end_date and tenant.subscription_end_date > today:
        base_date = tenant.subscription_end_date

    start = today
    end = base_date + timedelta(days=duration)

    subscription = Subscription(
        tenant_id=tenant.id,
        plan=plan_type,
        amount=payment.amount,
        status="active",
        start_date=start,
        end_date=end,
    )
    db.add(subscription)
    db.flush()

    payment.subscription_id = subscription.id

    # Update tenant
    tenant.plan = plan_type
    tenant.subscription_end_date = end
    tenant.status = "active"

    db.commit()
    logger.info(f"Subscription activated: tenant={tenant.id}, plan={plan_type}, end={end}")


# ============================================================
# WeChat Pay helpers
# ============================================================

def _get_wechat_client():
    """Lazy-init WeChatPay client."""
    try:
        from wechatpayv3 import WeChatPay, WeChatPayType
    except ImportError:
        raise HTTPException(status_code=500, detail="微信支付SDK未安装，请安装 wechatpayv3")

    if not WECHAT_MCH_ID or not WECHAT_API_V3_KEY:
        raise HTTPException(status_code=500, detail="微信支付未配置")

    private_key = WECHAT_PRIVATE_KEY
    # If it looks like a file path, read it
    if private_key and not private_key.startswith("-----"):
        try:
            with open(private_key, "r") as f:
                private_key = f.read()
        except FileNotFoundError:
            raise HTTPException(status_code=500, detail="微信商户私钥文件不存在")

    return WeChatPay(
        wechatpay_type=WeChatPayType.NATIVE,
        mchid=WECHAT_MCH_ID,
        private_key=private_key,
        cert_serial_no=WECHAT_CERT_SERIAL,
        appid=WECHAT_APPID,
        apiv3_key=WECHAT_API_V3_KEY,
        notify_url=WECHAT_NOTIFY_URL,
    )


def _create_wechat_order(payment: Payment, description: str, is_mobile: bool = False):
    """Call WeChat Pay API to create a payment order."""
    wxpay = _get_wechat_client()
    out_trade_no = f"PAY{payment.id}_{uuid.uuid4().hex[:8]}"
    amount_fen = int(payment.amount * 100)  # convert yuan to fen

    if is_mobile:
        # H5 payment
        from wechatpayv3 import WeChatPayType
        code, result = wxpay.pay(
            description=description,
            out_trade_no=out_trade_no,
            amount={"total": amount_fen, "currency": "CNY"},
            pay_type=WeChatPayType.H5,
            scene_info={"payer_client_ip": "127.0.0.1", "h5_info": {"type": "Wap"}},
        )
    else:
        # Native payment (QR code)
        code, result = wxpay.pay(
            description=description,
            out_trade_no=out_trade_no,
            amount={"total": amount_fen, "currency": "CNY"},
        )

    if code != 200:
        logger.error(f"WeChat Pay error: code={code}, result={result}")
        raise HTTPException(status_code=500, detail=f"微信支付下单失败: {result}")

    data = json.loads(result) if isinstance(result, str) else result

    if is_mobile:
        return None, data.get("h5_url", "")
    else:
        return data.get("code_url", ""), None


# ============================================================
# Alipay helpers
# ============================================================

def _get_alipay_client():
    """Lazy-init Alipay client."""
    try:
        from alipay import AliPay
    except ImportError:
        raise HTTPException(status_code=500, detail="支付宝SDK未安装，请安装 python-alipay-sdk")

    if not ALIPAY_APP_ID or not ALIPAY_PRIVATE_KEY:
        raise HTTPException(status_code=500, detail="支付宝未配置")

    private_key = ALIPAY_PRIVATE_KEY
    public_key = ALIPAY_PUBLIC_KEY
    # If they look like file paths, read them
    for key_name, key_val in [("private", private_key), ("public", public_key)]:
        if key_val and not key_val.startswith("-----") and not key_val.startswith("MII"):
            try:
                with open(key_val, "r") as f:
                    if key_name == "private":
                        private_key = f.read()
                    else:
                        public_key = f.read()
            except FileNotFoundError:
                raise HTTPException(status_code=500, detail=f"支付宝{key_name}密钥文件不存在")

    return AliPay(
        appid=ALIPAY_APP_ID,
        app_notify_url=ALIPAY_NOTIFY_URL,
        app_private_key_string=private_key,
        alipay_public_key_string=public_key,
        sign_type="RSA2",
        debug=ALIPAY_SANDBOX,
    )


def _create_alipay_order(payment: Payment, subject: str, is_mobile: bool = False):
    """Call Alipay API to create a payment order. Returns pay_url."""
    alipay = _get_alipay_client()
    out_trade_no = f"PAY{payment.id}_{uuid.uuid4().hex[:8]}"
    total_amount = str(payment.amount)

    if is_mobile:
        order_string = alipay.api_alipay_trade_wap_pay(
            out_trade_no=out_trade_no,
            total_amount=total_amount,
            subject=subject,
            return_url=ALIPAY_RETURN_URL,
        )
    else:
        order_string = alipay.api_alipay_trade_page_pay(
            out_trade_no=out_trade_no,
            total_amount=total_amount,
            subject=subject,
            return_url=ALIPAY_RETURN_URL,
        )

    base_url = "https://openapi.alipaydev.com/gateway.do" if ALIPAY_SANDBOX else "https://openapi.alipay.com/gateway.do"
    pay_url = f"{base_url}?{order_string}"
    return pay_url


# ============================================================
# API Endpoints
# ============================================================

@router.post("/create-order", response_model=PaymentOrderResponse)
def create_payment_order(
    req: CreatePaymentOrder,
    request: Request,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a payment order for subscription purchase."""
    if req.plan not in PLAN_PRICES:
        raise HTTPException(status_code=400, detail="无效的套餐类型，可选: monthly, yearly")
    if req.method not in ("wechat", "alipay"):
        raise HTTPException(status_code=400, detail="无效的支付方式，可选: wechat, alipay")

    amount = Decimal(PLAN_PRICES[req.plan])
    plan_label = "月付套餐" if req.plan == "monthly" else "年付套餐"
    description = f"黄金分期管理系统 - {plan_label}"

    # Create payment record
    payment = Payment(
        tenant_id=user.tenant_id,
        amount=amount,
        payment_method=req.method,
        status="pending",
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    # Detect mobile vs PC from User-Agent
    ua = (request.headers.get("user-agent") or "").lower()
    is_mobile = any(kw in ua for kw in ["mobile", "android", "iphone", "ipad"])

    # Check for uploaded QR code image
    qr_image = _find_qr_image(req.method)

    # If QR image is uploaded, use it (manual payment mode)
    if qr_image:
        return PaymentOrderResponse(
            payment_id=payment.id,
            amount=str(amount),
            qr_image_url=qr_image,
            sandbox=False,
        )

    # Sandbox mode — skip real payment APIs
    if PAYMENT_SANDBOX:
        return PaymentOrderResponse(
            payment_id=payment.id,
            amount=str(amount),
            sandbox=True,
        )

    code_url = None
    pay_url = None

    if req.method == "wechat":
        code_url, pay_url = _create_wechat_order(payment, description, is_mobile)
    elif req.method == "alipay":
        pay_url = _create_alipay_order(payment, description, is_mobile)

    return PaymentOrderResponse(
        payment_id=payment.id,
        amount=str(amount),
        code_url=code_url,
        pay_url=pay_url,
        sandbox=False,
    )


@router.get("/status/{payment_id}", response_model=PaymentStatusResponse)
def get_payment_status(
    payment_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Poll payment status (used by frontend after showing QR code)."""
    payment = db.query(Payment).filter(
        Payment.id == payment_id,
        Payment.tenant_id == user.tenant_id,
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="支付记录不存在")

    sub_out = None
    if payment.status == "success" and payment.subscription_id:
        sub = db.query(Subscription).filter(Subscription.id == payment.subscription_id).first()
        if sub:
            sub_out = SubscriptionOut.model_validate(sub)

    return PaymentStatusResponse(
        status=payment.status,
        payment_id=payment.id,
        subscription=sub_out,
    )


@router.post("/sandbox-confirm/{payment_id}")
def sandbox_confirm_payment(
    payment_id: int,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Simulate payment success in sandbox mode. Only available when PAYMENT_SANDBOX=true."""
    if not PAYMENT_SANDBOX:
        raise HTTPException(status_code=403, detail="此接口仅在沙盒模式下可用")

    payment = db.query(Payment).filter(
        Payment.id == payment_id,
        Payment.tenant_id == user.tenant_id,
        Payment.status == "pending",
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="支付记录不存在或已处理")

    activate_subscription(db, payment, trade_no=f"SANDBOX_{uuid.uuid4().hex[:12]}")
    return {"ok": True, "message": "沙盒模式：支付模拟成功"}


# ============================================================
# WeChat Pay Callback
# ============================================================

@router.post("/callback/wechat")
async def wechat_callback(request: Request, db: Session = Depends(get_db)):
    """WeChat Pay async notification callback."""
    try:
        body = await request.body()
        headers = dict(request.headers)

        wxpay = _get_wechat_client()
        result = wxpay.callback(headers=headers, body=body.decode("utf-8"))

        if not result:
            logger.warning("WeChat callback: verification failed")
            return PlainTextResponse(
                content=json.dumps({"code": "FAIL", "message": "验签失败"}),
                status_code=400,
                media_type="application/json",
            )

        event_type = result.get("event_type", "")
        if event_type == "TRANSACTION.SUCCESS":
            resource = result.get("resource", {})
            out_trade_no = resource.get("out_trade_no", "")
            transaction_id = resource.get("transaction_id", "")

            # Extract payment_id from out_trade_no (format: PAY{id}_{random})
            if out_trade_no.startswith("PAY"):
                try:
                    payment_id = int(out_trade_no.split("_")[0][3:])
                except (ValueError, IndexError):
                    payment_id = None
            else:
                payment_id = None

            if payment_id:
                payment = db.query(Payment).filter(Payment.id == payment_id).first()
                if payment and payment.status == "pending":
                    activate_subscription(db, payment, trade_no=transaction_id)

        return PlainTextResponse(
            content=json.dumps({"code": "SUCCESS", "message": "OK"}),
            media_type="application/json",
        )

    except Exception as e:
        logger.error(f"WeChat callback error: {e}")
        return PlainTextResponse(
            content=json.dumps({"code": "FAIL", "message": str(e)}),
            status_code=500,
            media_type="application/json",
        )


# ============================================================
# Alipay Callback
# ============================================================

@router.post("/callback/alipay")
async def alipay_callback(request: Request, db: Session = Depends(get_db)):
    """Alipay async notification callback."""
    try:
        form_data = await request.form()
        data = dict(form_data)

        alipay = _get_alipay_client()

        # Extract signature and verify
        signature = data.pop("sign", "")
        data.pop("sign_type", None)

        if not alipay.verify(data, signature):
            logger.warning("Alipay callback: signature verification failed")
            return PlainTextResponse("fail")

        trade_status = data.get("trade_status", "")
        if trade_status in ("TRADE_SUCCESS", "TRADE_FINISHED"):
            out_trade_no = data.get("out_trade_no", "")
            trade_no = data.get("trade_no", "")

            if out_trade_no.startswith("PAY"):
                try:
                    payment_id = int(out_trade_no.split("_")[0][3:])
                except (ValueError, IndexError):
                    payment_id = None
            else:
                payment_id = None

            if payment_id:
                payment = db.query(Payment).filter(Payment.id == payment_id).first()
                if payment and payment.status == "pending":
                    activate_subscription(db, payment, trade_no=trade_no)

        return PlainTextResponse("success")

    except Exception as e:
        logger.error(f"Alipay callback error: {e}")
        return PlainTextResponse("fail")


@router.get("/return/alipay")
def alipay_return(request: Request):
    """Alipay synchronous return — redirect user back to frontend."""
    # Just redirect back to the main page; the frontend polls for payment status
    return RedirectResponse(url="/#subscription")


# ============================================================
# QR Code Image Management (superadmin)
# ============================================================

@router.post("/config/upload-qr")
async def upload_payment_qr(
    method: str,
    file: UploadFile = File(...),
    user: User = Depends(require_superadmin),
):
    """Upload a payment QR code image (WeChat or Alipay)."""
    if method not in ("wechat", "alipay"):
        raise HTTPException(status_code=400, detail="method 必须为 wechat 或 alipay")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="请上传图片文件")

    # Determine extension from content type
    ext_map = {"image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp"}
    ext = ext_map.get(file.content_type, "png")

    # Remove any existing QR image for this method
    for old_ext in ("png", "jpg", "jpeg", "gif", "webp"):
        old_path = os.path.join(_UPLOADS_DIR, f"{method}_qr.{old_ext}")
        if os.path.isfile(old_path):
            os.remove(old_path)

    # Save new file
    os.makedirs(_UPLOADS_DIR, exist_ok=True)
    filename = f"{method}_qr.{ext}"
    filepath = os.path.join(_UPLOADS_DIR, filename)
    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    url = f"/static/uploads/{filename}"
    return {"ok": True, "url": url}


@router.get("/config/qr")
def get_payment_qr_config(user: User = Depends(get_current_user)):
    """Get uploaded payment QR code image URLs."""
    return {
        "wechat_qr": _find_qr_image("wechat"),
        "alipay_qr": _find_qr_image("alipay"),
    }


# ============================================================
# Manual Payment Management (superadmin)
# ============================================================

@router.get("/pending")
def list_pending_payments(
    user: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """List all pending payments for manual confirmation."""
    payments = (
        db.query(Payment)
        .filter(Payment.status == "pending")
        .order_by(Payment.created_at.desc())
        .all()
    )
    results = []
    for p in payments:
        tenant = db.query(Tenant).filter(Tenant.id == p.tenant_id).first()
        results.append({
            "id": p.id,
            "tenant_name": tenant.name if tenant else "未知",
            "amount": str(p.amount),
            "payment_method": p.payment_method,
            "created_at": p.created_at.strftime("%Y-%m-%d %H:%M") if p.created_at else "",
        })
    return results


@router.post("/manual-confirm/{payment_id}")
def manual_confirm_payment(
    payment_id: int,
    user: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """Manually confirm a pending payment (superadmin only)."""
    payment = db.query(Payment).filter(
        Payment.id == payment_id,
        Payment.status == "pending",
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="支付记录不存在或已处理")

    activate_subscription(db, payment, trade_no=f"MANUAL_{uuid.uuid4().hex[:12]}")
    return {"ok": True, "message": "支付已确认，订阅已激活"}


@router.post("/self-confirm/{payment_id}")
def self_confirm_payment(
    payment_id: int,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Self-confirm a pending payment for own tenant (admin only).
    Used when QR code payment is shown — clicking '我已支付' immediately activates subscription.
    """
    payment = db.query(Payment).filter(
        Payment.id == payment_id,
        Payment.tenant_id == user.tenant_id,
        Payment.status == "pending",
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="支付记录不存在或已处理")

    activate_subscription(db, payment, trade_no=f"SELF_{uuid.uuid4().hex[:12]}")
    return {"ok": True, "message": "支付已确认，订阅已激活"}
