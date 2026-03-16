"""Auto-fetch real-time gold price from public financial data sources."""
import json
import threading
import time
import re
import ssl
import urllib.request
import logging
from datetime import date, datetime
from decimal import Decimal

logger = logging.getLogger(__name__)

# SSL context - handle macOS Python cert issues gracefully
_ssl_ctx = ssl.create_default_context()
try:
    import certifi
    _ssl_ctx.load_verify_locations(certifi.where())
except Exception:
    _ssl_ctx.check_hostname = False
    _ssl_ctx.verify_mode = ssl.CERT_NONE

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
}


def _fetch_eastmoney_au9999():
    """Fetch AU9999 price from Eastmoney (东方财富) - Shanghai Gold Exchange."""
    url = (
        "https://push2.eastmoney.com/api/qt/clist/get?"
        "pn=1&pz=30&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:118"
        "&fields=f2,f12,f14,f15,f16,f17,f18"
    )
    req = urllib.request.Request(url, headers=_HEADERS)
    with urllib.request.urlopen(req, timeout=15, context=_ssl_ctx) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    items = data.get("data", {}).get("diff", [])
    # Look for AU9999 (黄金9999) first, then AUTD (黄金T+D) as fallback
    for target in ("AU9999", "AUTD"):
        for item in items:
            if item.get("f12") == target:
                latest = item.get("f2")
                if latest and latest != "-" and float(latest) > 0:
                    price = float(latest)
                    name = item.get("f14", target)
                    return {
                        "buy_price": price,
                        "sell_price": round(price * 0.98, 2),  # ~2% buyback spread
                        "latest": price,
                        "source": f"上海金交所{name}",
                    }
    return None


def _fetch_sina_gold():
    """Fallback: fetch Au(T+D) price from Sina Finance."""
    url = f"https://hq.sinajs.cn/rn={int(time.time())}&list=au_td"
    req = urllib.request.Request(url, headers={
        "Referer": "https://finance.sina.com.cn",
        **_HEADERS,
    })
    with urllib.request.urlopen(req, timeout=10, context=_ssl_ctx) as resp:
        text = resp.read().decode("gbk")

    m = re.search(r'hq_str_au_td="(.+?)"', text)
    if not m:
        return None

    parts = m.group(1).split(",")
    # Format: 名称, 开盘价, 最高价, 最低价, 昨收价, 买入价, 卖出价, 最新价, 结算价, ...
    if len(parts) >= 8:
        buy_price = float(parts[5])   # 买入价
        sell_price = float(parts[6])  # 卖出价
        latest = float(parts[7])      # 最新价
        if buy_price > 0:
            return {
                "buy_price": buy_price,
                "sell_price": sell_price,
                "latest": latest,
                "source": "新浪Au(T+D)",
            }
    return None


def fetch_gold_price():
    """Try multiple sources to get current gold price."""
    # Source 1: Eastmoney AU9999 (东方财富 - 上海金交所黄金9999)
    try:
        data = _fetch_eastmoney_au9999()
        if data:
            return data
    except Exception as e:
        logger.warning(f"Eastmoney AU9999 fetch failed: {e}")

    # Source 2: Sina Finance Au(T+D) (fallback)
    try:
        data = _fetch_sina_gold()
        if data:
            return data
    except Exception as e:
        logger.warning(f"Sina Au(T+D) fetch failed: {e}")

    return None


def update_gold_price_in_db():
    """Fetch gold price and save to database."""
    from .database import SessionLocal
    from .models import GoldPrice

    try:
        data = fetch_gold_price()
        if not data:
            logger.warning("All gold price sources failed, skipping update")
            return

        db = SessionLocal()
        try:
            today = date.today()
            record = db.query(GoldPrice).filter(GoldPrice.price_date == today).first()

            # Only auto-update if not manually set today, or if source is auto
            if record and record.updated_by and record.updated_by != "自动获取":
                logger.info("Today's price was manually set, skipping auto-update")
                return

            if record:
                record.buy_price = Decimal(str(data["buy_price"]))
                record.sell_price = Decimal(str(data["sell_price"]))
                record.updated_by = "自动获取"
                record.updated_at = datetime.now()
            else:
                record = GoldPrice(
                    price_date=today,
                    buy_price=Decimal(str(data["buy_price"])),
                    sell_price=Decimal(str(data["sell_price"])),
                    updated_by="自动获取",
                )
                db.add(record)

            db.commit()
            logger.info(
                f"Gold price auto-updated: buy={data['buy_price']}, "
                f"sell={data['sell_price']} ({data['source']})"
            )
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error in auto gold price update: {e}")


class GoldPriceScheduler:
    """Background scheduler that fetches gold price periodically."""

    def __init__(self, interval=600):
        self.interval = interval  # seconds (default 10 min)
        self._timer = None
        self._running = False

    def start(self):
        self._running = True
        logger.info(f"Gold price scheduler started (interval={self.interval}s)")
        # Run first fetch after a short delay to let the server fully start
        self._timer = threading.Timer(5, self._run)
        self._timer.daemon = True
        self._timer.start()

    def stop(self):
        self._running = False
        if self._timer:
            self._timer.cancel()
        logger.info("Gold price scheduler stopped")

    def _run(self):
        if not self._running:
            return
        update_gold_price_in_db()
        # Schedule next run
        self._timer = threading.Timer(self.interval, self._run)
        self._timer.daemon = True
        self._timer.start()
