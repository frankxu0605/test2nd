import os

# Database configuration
# Set DB_TYPE=mysql to use MySQL, otherwise defaults to SQLite for easy local testing
DB_TYPE = os.getenv("DB_TYPE", "sqlite")

# ======== WeChat Pay (微信支付) Configuration ========
# Apply at: https://pay.weixin.qq.com/
WECHAT_APPID          = os.getenv("WECHAT_APPID", "")         # 公众号/小程序 AppID
WECHAT_MCH_ID         = os.getenv("WECHAT_MCH_ID", "")        # 商户号
WECHAT_API_V3_KEY     = os.getenv("WECHAT_API_V3_KEY", "")    # APIv3密钥（32字节）
WECHAT_CERT_SERIAL    = os.getenv("WECHAT_CERT_SERIAL", "")   # 证书序列号
WECHAT_PRIVATE_KEY    = os.getenv("WECHAT_PRIVATE_KEY", "")   # 商户私钥内容或文件路径
WECHAT_NOTIFY_URL     = os.getenv("WECHAT_NOTIFY_URL", "")    # 回调地址 (HTTPS)

# ======== Alipay (支付宝) Configuration ========
# Apply at: https://open.alipay.com/
ALIPAY_APP_ID         = os.getenv("ALIPAY_APP_ID", "")        # 支付宝 AppID
ALIPAY_PRIVATE_KEY    = os.getenv("ALIPAY_PRIVATE_KEY", "")   # 应用私钥内容
ALIPAY_PUBLIC_KEY     = os.getenv("ALIPAY_PUBLIC_KEY", "")    # 支付宝公钥内容
ALIPAY_NOTIFY_URL     = os.getenv("ALIPAY_NOTIFY_URL", "")    # 异步通知URL
ALIPAY_RETURN_URL     = os.getenv("ALIPAY_RETURN_URL", "")    # 同步跳转URL
ALIPAY_SANDBOX        = os.getenv("ALIPAY_SANDBOX", "false").lower() == "true"

# ======== General Payment Config ========
# Set PAYMENT_SANDBOX=true to simulate payments without real credentials (for testing)
PAYMENT_SANDBOX       = os.getenv("PAYMENT_SANDBOX", "false").lower() == "true"

# Subscription plan pricing (CNY)
PLAN_PRICES = {
    "monthly": "99.00",
    "yearly":  "999.00",
}
PLAN_DURATION_DAYS = {
    "monthly": 30,
    "yearly":  365,
}

if DB_TYPE == "mysql":
    DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
    DB_PORT = int(os.getenv("DB_PORT", "3306"))
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "123456")
    DB_NAME = os.getenv("DB_NAME", "loan_manager")
    DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
else:
    _db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "loan_manager.db")
    DATABASE_URL = f"sqlite:///{_db_path}"

# JWT configuration
JWT_SECRET = os.getenv("JWT_SECRET", "loan-manager-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24

# Server configuration
SERVER_HOST = os.getenv("SERVER_HOST", "0.0.0.0")
SERVER_PORT = int(os.getenv("SERVER_PORT", "5040"))
