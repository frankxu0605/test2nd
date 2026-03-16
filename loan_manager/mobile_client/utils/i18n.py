"""Simple i18n helper for mobile client (zh/en)."""
_LANG = "zh"

_STRINGS = {
    "title": {"zh": "黄金分期管理系统", "en": "Gold Loan Manager"},
    "username": {"zh": "用户名", "en": "Username"},
    "username_hint": {"zh": "请输入用户名", "en": "Enter username"},
    "password": {"zh": "密码", "en": "Password"},
    "password_hint": {"zh": "请输入密码", "en": "Enter password"},
    "login": {"zh": "登 录", "en": "Log In"},
    "default_admin": {"zh": "默认管理员: admin / admin123", "en": "Default admin: admin / admin123"},
    "enter_credentials": {"zh": "请输入用户名和密码", "en": "Please enter username and password"},
    "login_failed": {"zh": "用户名或密码错误", "en": "Invalid username or password"},
    "cannot_connect": {"zh": "无法连接服务器", "en": "Cannot connect to server"},
    "tip": {"zh": "提示", "en": "Notice"},
}


def set_language(lang: str):
    """Set active language. Expect 'zh' or 'en'."""
    global _LANG
    if lang not in ("zh", "en"):
        return
    _LANG = lang


def get_language() -> str:
    return _LANG


def t(key: str) -> str:
    """Translate a key to the active language, fallback to key if missing."""
    entry = _STRINGS.get(key)
    if not entry:
        return key
    return entry.get(_LANG, entry.get("zh", key))
