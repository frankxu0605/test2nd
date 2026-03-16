import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, sql } from 'drizzle-orm';
import { users, tenants } from '../db/schema';
import { hashPassword, verifyPassword } from '../lib/password';
import { createToken } from '../lib/jwt';
import { authMiddleware, activeUserMiddleware, adminMiddleware } from '../middleware/auth';
import type { Env } from '../lib/types';

const auth = new Hono<Env>();

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(d: string, n: number): string {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
}

function nowStr(): string {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0') + ' ' +
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0') + ':' +
    String(d.getSeconds()).padStart(2, '0');
}

function userOut(u: any) {
  return {
    id: u.id,
    tenant_id: u.tenantId,
    username: u.username,
    real_name: u.realName,
    email: u.email || '',
    phone: u.phone || '',
    role: u.role || 'member',
    is_active: u.isActive ?? true,
    created_at: u.createdAt || '',
  };
}

function tenantOut(t: any) {
  return {
    id: t.id,
    name: t.name,
    contact_phone: t.contactPhone || '',
    status: t.status || 'active',
    plan: t.plan || 'free_trial',
    trial_end_date: t.trialEndDate || null,
    subscription_end_date: t.subscriptionEndDate || null,
    max_users: t.maxUsers ?? 5,
    created_at: t.createdAt || '',
  };
}

// ── Login ───────────────────────────────────────────────
auth.post('/login', async (c) => {
  const body = await c.req.json();
  const { username, password, company_name } = body;
  if (!username || !password) {
    return c.json({ detail: '请输入用户名和密码' }, 400);
  }

  const db = drizzle(c.env.DB);

  let user;
  if (company_name) {
    // Find tenant by company name, then find user within that tenant
    const tenant = await db.select().from(tenants).where(eq(tenants.name, company_name)).get();
    if (!tenant) {
      return c.json({ detail: '公司名称不存在' }, 401);
    }
    user = await db.select().from(users)
      .where(and(eq(users.tenantId, tenant.id), eq(users.username, username))).get();
  } else {
    // Fallback: superadmin login (no company needed, tenant_id is null)
    user = await db.select().from(users)
      .where(and(eq(users.username, username), sql`${users.tenantId} IS NULL`)).get();
  }

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return c.json({ detail: '用户名或密码错误' }, 401);
  }
  if (!user.isActive) {
    return c.json({ detail: '账户已被禁用' }, 403);
  }

  // Increment token_version for single-device enforcement
  const newTokenVersion = (user.tokenVersion || 0) + 1;
  await db.update(users).set({ tokenVersion: newTokenVersion }).where(eq(users.id, user.id));

  const token = await createToken(
    { user_id: user.id, username: user.username, role: user.role || 'member', tenant_id: user.tenantId, token_version: newTokenVersion },
    c.env.JWT_SECRET,
  );

  let tenant_info = null;
  if (user.tenantId) {
    const t = await db.select().from(tenants).where(eq(tenants.id, user.tenantId)).get();
    if (t) tenant_info = tenantOut(t);
  }

  return c.json({
    access_token: token,
    user: userOut(user),
    tenant: tenant_info,
  });
});

// ── Register Company ────────────────────────────────────
auth.post('/register-company', async (c) => {
  const body = await c.req.json();
  const { company_name, username, password, real_name, email, phone } = body;
  if (!company_name || !username || !password || !real_name) {
    return c.json({ detail: '请填写必要信息' }, 400);
  }

  const db = drizzle(c.env.DB);

  // Username uniqueness will be enforced by the unique index (tenant_id, username)
  // after tenant is created — no pre-check needed here since it's a new tenant

  // Create tenant
  const today = todayStr();
  const trialEnd = addDays(today, 7);
  const tenantResult = await db.insert(tenants).values({
    name: company_name,
    contactPhone: phone || '',
    status: 'active',
    plan: 'free_trial',
    trialEndDate: trialEnd,
    maxUsers: 5,
    createdAt: nowStr(),
  }).returning();
  const tenant = tenantResult[0];

  // Create admin user
  const userResult = await db.insert(users).values({
    tenantId: tenant.id,
    username,
    passwordHash: hashPassword(password),
    realName: real_name,
    email: email || '',
    phone: phone || '',
    role: 'admin',
    isActive: true,
    createdAt: nowStr(),
  }).returning();
  const user = userResult[0];

  const token = await createToken(
    { user_id: user.id, username: user.username, role: user.role || 'admin', tenant_id: tenant.id, token_version: 0 },
    c.env.JWT_SECRET,
  );

  return c.json({
    access_token: token,
    user: userOut(user),
    tenant: tenantOut(tenant),
  });
});

// ── Team Management ─────────────────────────────────────
auth.get('/team', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);
  const members = await db.select().from(users).where(eq(users.tenantId, user.tenantId!));
  return c.json(members.map(m => ({
    ...userOut(m),
    // TeamMemberOut fields
  })));
});

auth.post('/team', authMiddleware, adminMiddleware, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { username, password, real_name, email, phone, role } = body;

  const db = drizzle(c.env.DB);

  // Check max_users
  const tenant = await db.select().from(tenants).where(eq(tenants.id, user.tenantId!)).get();
  if (!tenant) return c.json({ detail: '公司不存在' }, 400);

  const activeMembers = await db.select().from(users)
    .where(and(eq(users.tenantId, tenant.id), eq(users.isActive, true)));
  if (activeMembers.length >= (tenant.maxUsers ?? 5)) {
    return c.json({ detail: `团队成员已达上限（${tenant.maxUsers}人）` }, 400);
  }

  const existing = await db.select().from(users)
    .where(and(eq(users.tenantId, tenant.id), eq(users.username, username))).get();
  if (existing) return c.json({ detail: '用户名已存在' }, 400);

  const memberResult = await db.insert(users).values({
    tenantId: tenant.id,
    username,
    passwordHash: hashPassword(password),
    realName: real_name,
    email: email || '',
    phone: phone || '',
    role: (role === 'admin' || role === 'member') ? role : 'member',
    isActive: true,
    createdAt: nowStr(),
  }).returning();

  return c.json(userOut(memberResult[0]));
});

auth.put('/team/:memberId', authMiddleware, adminMiddleware, async (c) => {
  const user = c.get('user');
  const memberId = parseInt(c.req.param('memberId'));
  const body = await c.req.json();
  const db = drizzle(c.env.DB);

  const member = await db.select().from(users)
    .where(and(eq(users.id, memberId), eq(users.tenantId, user.tenantId!))).get();
  if (!member) return c.json({ detail: '成员不存在' }, 404);

  const updates: Record<string, any> = {
    realName: body.real_name ?? member.realName,
    email: body.email ?? member.email,
    phone: body.phone ?? member.phone,
    role: (body.role === 'admin' || body.role === 'member') ? body.role : member.role,
  };

  if (body.username && body.username !== member.username) {
    const existing = await db.select().from(users)
      .where(and(eq(users.tenantId, user.tenantId!), eq(users.username, body.username))).get();
    if (existing) return c.json({ detail: '用户名已存在' }, 400);
    updates.username = body.username;
  }
  if (body.password) {
    updates.passwordHash = hashPassword(body.password);
  }

  await db.update(users).set(updates).where(eq(users.id, memberId));
  return c.json({ ok: true });
});

auth.delete('/team/:memberId', authMiddleware, adminMiddleware, async (c) => {
  const user = c.get('user');
  const memberId = parseInt(c.req.param('memberId'));
  if (memberId === user.id) {
    return c.json({ detail: '不能删除自己' }, 400);
  }
  const db = drizzle(c.env.DB);
  const member = await db.select().from(users)
    .where(and(eq(users.id, memberId), eq(users.tenantId, user.tenantId!))).get();
  if (!member) return c.json({ detail: '成员不存在' }, 404);

  await db.update(users).set({ isActive: false }).where(eq(users.id, memberId));
  return c.json({ ok: true });
});

// ── Current user info ───────────────────────────────────
auth.get('/me', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.json({
    id: user.id,
    tenant_id: user.tenantId,
    username: user.username,
    real_name: user.realName,
    email: '',
    phone: '',
    role: user.role,
    is_active: user.isActive,
  });
});

auth.get('/tenant', authMiddleware, async (c) => {
  const user = c.get('user');
  if (user.role === 'superadmin') {
    return c.json({ detail: '超级管理员请使用管理后台' }, 400);
  }
  if (!user.tenantId) {
    return c.json({ detail: '用户未关联公司' }, 403);
  }
  const db = drizzle(c.env.DB);
  const tenant = await db.select().from(tenants).where(eq(tenants.id, user.tenantId)).get();
  if (!tenant) return c.json({ detail: '公司不存在' }, 403);
  return c.json(tenantOut(tenant));
});

export default auth;
