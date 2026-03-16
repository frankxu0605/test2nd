import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc } from 'drizzle-orm';
import { payments, subscriptions, tenants } from '../db/schema';
import { authMiddleware, adminMiddleware, superadminMiddleware } from '../middleware/auth';
import type { Env } from '../lib/types';

const paymentsRoute = new Hono<Env>();

function todayStr() { return new Date().toISOString().slice(0, 10); }
function nowStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function randomHex(len: number) {
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map(b => b.toString(16).padStart(2, '0')).join('').slice(0, len);
}

const PLAN_PRICES: Record<string, string> = { monthly: '99.00', yearly: '999.00' };
const PLAN_LABELS: Record<string, string> = { monthly: '月付套餐', yearly: '年付套餐' };
const PLAN_DURATION: Record<string, number> = { monthly: 30, yearly: 365 };

// ── Activate subscription after payment confirmed ────────
async function activateSubscription(
  db: ReturnType<typeof drizzle>,
  paymentRow: any,
  tradeNo: string,
) {
  if (paymentRow.status === 'success') return;

  await db.update(payments).set({ status: 'success', tradeNo })
    .where(eq(payments.id, paymentRow.id));

  const tenant = await db.select().from(tenants).where(eq(tenants.id, paymentRow.tenantId)).get();
  if (!tenant) return;

  const planType = paymentRow.amount === PLAN_PRICES.yearly ? 'yearly' : 'monthly';
  const duration = PLAN_DURATION[planType] || 30;

  const today = todayStr();
  let baseDate = today;
  if (tenant.subscriptionEndDate && tenant.subscriptionEndDate > today) {
    baseDate = tenant.subscriptionEndDate;
  }
  const endDate = addDays(baseDate, duration);

  const subResult = await db.insert(subscriptions).values({
    tenantId: tenant.id,
    plan: planType,
    amount: paymentRow.amount,
    status: 'active',
    startDate: today,
    endDate,
    createdAt: nowStr(),
  }).returning();

  await db.update(payments).set({ subscriptionId: subResult[0].id })
    .where(eq(payments.id, paymentRow.id));

  await db.update(tenants).set({
    plan: planType,
    subscriptionEndDate: endDate,
    status: 'active',
  }).where(eq(tenants.id, tenant.id));
}

// ══════════════════════════════════════════════════════════
// WeChat Pay v3 helpers
// ══════════════════════════════════════════════════════════
async function importRsaKey(pem: string): Promise<CryptoKey> {
  const b64 = pem.replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/g, '')
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', bin, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

async function wechatSign(method: string, url: string, timestamp: string, nonce: string, body: string, privateKey: CryptoKey): Promise<string> {
  const msg = `${method}\n${url}\n${timestamp}\n${nonce}\n${body}\n`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function wechatNativeOrder(env: Env['Bindings'], amount: string, orderId: number, description: string): Promise<string | null> {
  if (!env.WECHAT_MCH_ID || !env.WECHAT_APP_ID || !env.WECHAT_PRIVATE_KEY || !env.WECHAT_SERIAL_NO) return null;

  const key = await importRsaKey(env.WECHAT_PRIVATE_KEY);
  const amountCents = Math.round(parseFloat(amount) * 100);
  const outTradeNo = `LM${orderId}_${Date.now()}`;
  const apiUrl = '/v3/pay/transactions/native';
  const bodyObj = {
    appid: env.WECHAT_APP_ID,
    mchid: env.WECHAT_MCH_ID,
    description,
    out_trade_no: outTradeNo,
    notify_url: 'https://api.hjfq.club/api/payments/callback/wechat',
    amount: { total: amountCents, currency: 'CNY' },
  };
  const bodyStr = JSON.stringify(bodyObj);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomHex(32);
  const signature = await wechatSign('POST', apiUrl, timestamp, nonce, bodyStr, key);
  const authHeader = `WECHATPAY2-SHA256-RSA2048 mchid="${env.WECHAT_MCH_ID}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${env.WECHAT_SERIAL_NO}",signature="${signature}"`;

  const resp = await fetch('https://api.mch.weixin.qq.com' + apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
    body: bodyStr,
  });
  if (!resp.ok) {
    console.error('WeChat order failed:', await resp.text());
    return null;
  }
  const data: any = await resp.json();
  return data.code_url || null;
}

async function wechatDecryptResource(apiV3Key: string, nonce: string, ciphertext: string, associatedData: string): Promise<any> {
  const keyBytes = new TextEncoder().encode(apiV3Key);
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
  const nonceBytes = new TextEncoder().encode(nonce);
  const cipherBytes = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const adBytes = new TextEncoder().encode(associatedData);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonceBytes, additionalData: adBytes }, cryptoKey, cipherBytes);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

// ══════════════════════════════════════════════════════════
// Alipay helpers
// ══════════════════════════════════════════════════════════
async function importAlipayKey(pem: string): Promise<CryptoKey> {
  const b64 = pem.replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/g, '')
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', bin, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

async function importAlipayPublicKey(pem: string): Promise<CryptoKey> {
  const b64 = pem.replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '');
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return crypto.subtle.importKey('spki', bin, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}

function alipaySignContent(params: Record<string, string>): string {
  return Object.keys(params).sort().filter(k => params[k] !== '' && params[k] !== undefined)
    .map(k => `${k}=${params[k]}`).join('&');
}

async function alipaySign(content: string, privateKey: CryptoKey): Promise<string> {
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(content));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function alipayVerify(content: string, signature: string, publicKey: CryptoKey): Promise<boolean> {
  const sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, sigBytes, new TextEncoder().encode(content));
}

function alipayTimestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

async function alipayPrecreate(env: Env['Bindings'], amount: string, orderId: number, subject: string): Promise<string | null> {
  if (!env.ALIPAY_APP_ID || !env.ALIPAY_PRIVATE_KEY) return null;

  const key = await importAlipayKey(env.ALIPAY_PRIVATE_KEY);
  const outTradeNo = `LM${orderId}_${Date.now()}`;
  const bizContent = JSON.stringify({
    out_trade_no: outTradeNo,
    total_amount: amount,
    subject,
  });

  const params: Record<string, string> = {
    app_id: env.ALIPAY_APP_ID,
    method: 'alipay.trade.precreate',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: alipayTimestamp(),
    version: '1.0',
    notify_url: 'https://api.hjfq.club/api/payments/callback/alipay',
    biz_content: bizContent,
  };

  const signContent = alipaySignContent(params);
  params.sign = await alipaySign(signContent, key);

  const body = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  const resp = await fetch('https://openapi.alipay.com/gateway.do', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
  });
  const data: any = await resp.json();
  const result = data?.alipay_trade_precreate_response;
  if (result?.code === '10000' && result?.qr_code) {
    return result.qr_code;
  }
  console.error('Alipay precreate failed:', JSON.stringify(data));
  return null;
}

// ══════════════════════════════════════════════════════════
// Routes
// ══════════════════════════════════════════════════════════

// ── Create payment order ─────────────────────────────────
paymentsRoute.post('/create-order', authMiddleware, adminMiddleware, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const plan = body.plan;
  const method = body.method;

  if (!PLAN_PRICES[plan]) return c.json({ detail: '无效的套餐类型，可选: monthly, yearly' }, 400);
  if (method !== 'wechat' && method !== 'alipay') {
    return c.json({ detail: '无效的支付方式，可选: wechat, alipay' }, 400);
  }

  const db = drizzle(c.env.DB);
  const amount = PLAN_PRICES[plan];
  const description = `黄金分期管理系统 - ${PLAN_LABELS[plan]}`;

  const result = await db.insert(payments).values({
    tenantId: user.tenantId!,
    amount,
    paymentMethod: method,
    status: 'pending',
    createdAt: nowStr(),
  }).returning();

  const paymentId = result[0].id;

  // Try real payment gateway
  if (method === 'wechat') {
    const codeUrl = await wechatNativeOrder(c.env, amount, paymentId, description);
    if (codeUrl) {
      return c.json({ payment_id: paymentId, amount, code_url: codeUrl });
    }
  } else if (method === 'alipay') {
    const qrCode = await alipayPrecreate(c.env, amount, paymentId, description);
    if (qrCode) {
      return c.json({ payment_id: paymentId, amount, qr_code: qrCode });
    }
  }

  // Fallback to sandbox mode when keys not configured
  return c.json({ payment_id: paymentId, amount, sandbox: true });
});

// ── WeChat callback ──────────────────────────────────────
paymentsRoute.post('/callback/wechat', async (c) => {
  try {
    const body: any = await c.req.json();
    const resource = body?.resource;
    if (!resource || !c.env.WECHAT_API_V3_KEY) {
      return c.json({ code: 'FAIL', message: 'missing resource or key' }, 400);
    }

    const decrypted = await wechatDecryptResource(
      c.env.WECHAT_API_V3_KEY,
      resource.nonce,
      resource.ciphertext,
      resource.associated_data || '',
    );

    if (decrypted.trade_state !== 'SUCCESS') {
      return c.json({ code: 'SUCCESS', message: 'ignored non-success' });
    }

    const outTradeNo = decrypted.out_trade_no as string; // LM{paymentId}_{timestamp}
    const paymentId = parseInt(outTradeNo.split('_')[0].replace('LM', ''));
    const tradeNo = decrypted.transaction_id || outTradeNo;

    const db = drizzle(c.env.DB);
    const payment = await db.select().from(payments)
      .where(and(eq(payments.id, paymentId), eq(payments.status, 'pending'))).get();

    if (payment) {
      await activateSubscription(db, payment, tradeNo);
    }

    return c.json({ code: 'SUCCESS', message: 'ok' });
  } catch (e: any) {
    console.error('WeChat callback error:', e);
    return c.json({ code: 'FAIL', message: e.message }, 500);
  }
});

// ── Alipay callback ──────────────────────────────────────
paymentsRoute.post('/callback/alipay', async (c) => {
  try {
    const formData = await c.req.parseBody();
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(formData)) {
      if (typeof v === 'string') params[k] = v;
    }

    // Verify signature
    if (c.env.ALIPAY_PUBLIC_KEY && params.sign) {
      const sign = params.sign;
      const signType = params.sign_type;
      const { sign: _, sign_type: __, ...rest } = params;
      const content = alipaySignContent(rest);
      const pubKey = await importAlipayPublicKey(c.env.ALIPAY_PUBLIC_KEY);
      const valid = await alipayVerify(content, sign, pubKey);
      if (!valid) {
        return c.text('fail', 400);
      }
    }

    if (params.trade_status !== 'TRADE_SUCCESS' && params.trade_status !== 'TRADE_FINISHED') {
      return c.text('success');
    }

    const outTradeNo = params.out_trade_no; // LM{paymentId}_{timestamp}
    const paymentId = parseInt(outTradeNo.split('_')[0].replace('LM', ''));
    const tradeNo = params.trade_no || outTradeNo;

    const db = drizzle(c.env.DB);
    const payment = await db.select().from(payments)
      .where(and(eq(payments.id, paymentId), eq(payments.status, 'pending'))).get();

    if (payment) {
      await activateSubscription(db, payment, tradeNo);
    }

    return c.text('success');
  } catch (e: any) {
    console.error('Alipay callback error:', e);
    return c.text('fail', 500);
  }
});

// ── Payment status polling ───────────────────────────────
paymentsRoute.get('/status/:paymentId', authMiddleware, async (c) => {
  const user = c.get('user');
  const paymentId = parseInt(c.req.param('paymentId'));
  const db = drizzle(c.env.DB);

  const payment = await db.select().from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.tenantId, user.tenantId!))).get();
  if (!payment) return c.json({ detail: '支付记录不存在' }, 404);

  let subscription = null;
  if (payment.status === 'success' && payment.subscriptionId) {
    const sub = await db.select().from(subscriptions).where(eq(subscriptions.id, payment.subscriptionId)).get();
    if (sub) {
      subscription = {
        id: sub.id, plan: sub.plan, amount: sub.amount,
        status: sub.status, start_date: sub.startDate, end_date: sub.endDate,
      };
    }
  }

  return c.json({ status: payment.status, payment_id: payment.id, subscription });
});

// ── Invoices (billing history) ───────────────────────────
paymentsRoute.get('/invoices', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);

  const rows = await db.select().from(payments)
    .where(eq(payments.tenantId, user.tenantId!))
    .orderBy(desc(payments.id));

  const result = [];
  for (const p of rows) {
    let sub = null;
    if (p.subscriptionId) {
      sub = await db.select().from(subscriptions).where(eq(subscriptions.id, p.subscriptionId)).get();
    }
    const planType = p.amount === PLAN_PRICES.yearly ? 'yearly' : 'monthly';
    result.push({
      id: p.id,
      invoice_no: `INV-${String(p.id).padStart(6, '0')}`,
      plan: planType,
      plan_label: PLAN_LABELS[planType],
      amount: p.amount,
      payment_method: p.paymentMethod,
      trade_no: p.tradeNo || '',
      status: p.status,
      created_at: p.createdAt || '',
      subscription_start: sub?.startDate || '',
      subscription_end: sub?.endDate || '',
    });
  }
  return c.json(result);
});

paymentsRoute.get('/invoices/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));
  const db = drizzle(c.env.DB);

  const p = await db.select().from(payments)
    .where(and(eq(payments.id, id), eq(payments.tenantId, user.tenantId!))).get();
  if (!p) return c.json({ detail: '账单不存在' }, 404);

  let sub = null;
  if (p.subscriptionId) {
    sub = await db.select().from(subscriptions).where(eq(subscriptions.id, p.subscriptionId)).get();
  }
  const tenant = await db.select().from(tenants).where(eq(tenants.id, p.tenantId)).get();
  const planType = p.amount === PLAN_PRICES.yearly ? 'yearly' : 'monthly';

  return c.json({
    id: p.id,
    invoice_no: `INV-${String(p.id).padStart(6, '0')}`,
    tenant_name: tenant?.name || '',
    plan: planType,
    plan_label: PLAN_LABELS[planType],
    amount: p.amount,
    payment_method: p.paymentMethod,
    trade_no: p.tradeNo || '',
    status: p.status,
    created_at: p.createdAt || '',
    subscription_start: sub?.startDate || '',
    subscription_end: sub?.endDate || '',
  });
});

// ── Sandbox confirm ──────────────────────────────────────
paymentsRoute.post('/sandbox-confirm/:paymentId', authMiddleware, adminMiddleware, async (c) => {
  const user = c.get('user');
  const paymentId = parseInt(c.req.param('paymentId'));
  const db = drizzle(c.env.DB);

  const payment = await db.select().from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.tenantId, user.tenantId!), eq(payments.status, 'pending'))).get();
  if (!payment) return c.json({ detail: '支付记录不存在或已处理' }, 404);

  await activateSubscription(db, payment, `SANDBOX_${randomHex(12)}`);
  return c.json({ ok: true, message: '沙盒模式：支付模拟成功' });
});

// ── Self confirm (admin) ─────────────────────────────────
paymentsRoute.post('/self-confirm/:paymentId', authMiddleware, adminMiddleware, async (c) => {
  const user = c.get('user');
  const paymentId = parseInt(c.req.param('paymentId'));
  const db = drizzle(c.env.DB);

  const payment = await db.select().from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.tenantId, user.tenantId!), eq(payments.status, 'pending'))).get();
  if (!payment) return c.json({ detail: '支付记录不存在或已处理' }, 404);

  await activateSubscription(db, payment, `SELF_${randomHex(12)}`);
  return c.json({ ok: true, message: '支付已确认，订阅已激活' });
});

// ── Manual confirm (superadmin) ──────────────────────────
paymentsRoute.post('/manual-confirm/:paymentId', authMiddleware, superadminMiddleware, async (c) => {
  const paymentId = parseInt(c.req.param('paymentId'));
  const db = drizzle(c.env.DB);

  const payment = await db.select().from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.status, 'pending'))).get();
  if (!payment) return c.json({ detail: '支付记录不存在或已处理' }, 404);

  await activateSubscription(db, payment, `MANUAL_${randomHex(12)}`);
  return c.json({ ok: true, message: '支付已确认，订阅已激活' });
});

// ── List pending payments (superadmin) ───────────────────
paymentsRoute.get('/pending', authMiddleware, superadminMiddleware, async (c) => {
  const db = drizzle(c.env.DB);
  const pendingPayments = await db.select().from(payments)
    .where(eq(payments.status, 'pending'))
    .orderBy(desc(payments.createdAt));

  const result = [];
  for (const p of pendingPayments) {
    const tenant = await db.select().from(tenants).where(eq(tenants.id, p.tenantId)).get();
    result.push({
      id: p.id,
      tenant_name: tenant?.name || '未知',
      amount: p.amount,
      payment_method: p.paymentMethod,
      created_at: p.createdAt || '',
    });
  }
  return c.json(result);
});

// ── QR config (placeholder) ──────────────────────────────
paymentsRoute.get('/config/qr', authMiddleware, async (c) => {
  return c.json({ wechat_qr: null, alipay_qr: null });
});

export default paymentsRoute;
