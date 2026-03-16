export type Env = {
  Bindings: {
    DB: D1Database;
    JWT_SECRET: string;
    // WeChat Pay
    WECHAT_MCH_ID?: string;
    WECHAT_APP_ID?: string;
    WECHAT_API_V3_KEY?: string;
    WECHAT_SERIAL_NO?: string;
    WECHAT_PRIVATE_KEY?: string;
    // Alipay
    ALIPAY_APP_ID?: string;
    ALIPAY_PRIVATE_KEY?: string;
    ALIPAY_PUBLIC_KEY?: string;
  };
  Variables: {
    user: {
      id: number;
      tenantId: number | null;
      username: string;
      realName: string;
      role: string;
      isActive: boolean;
    };
  };
};
