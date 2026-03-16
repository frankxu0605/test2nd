import { createMiddleware } from 'hono/factory';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { users, tenants } from '../db/schema';
import { verifyToken } from '../lib/jwt';
import type { Env } from '../lib/types';

/**
 * authMiddleware: Verify JWT, load user into context.
 * Returns 401 for invalid/expired tokens.
 */
export const authMiddleware = createMiddleware<Env>(async (c, next) => {
  const authorization = c.req.header('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    return c.json({ detail: '未登录或token缺失' }, 401);
  }
  const token = authorization.slice(7);
  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    const db = drizzle(c.env.DB);
    const user = await db.select().from(users).where(eq(users.id, payload.user_id)).get();
    if (!user || !user.isActive) {
      return c.json({ detail: '用户不存在或已被禁用' }, 401);
    }
    // Single-device login enforcement
    if (payload.token_version !== undefined && user.tokenVersion !== undefined
        && payload.token_version !== user.tokenVersion) {
      return c.json({ detail: '账号已在其他设备登录，请重新登录' }, 401);
    }
    c.set('user', {
      id: user.id,
      tenantId: user.tenantId,
      username: user.username,
      realName: user.realName,
      role: user.role || 'member',
      isActive: user.isActive ?? true,
    });
    await next();
  } catch (e: any) {
    if (e?.code === 'ERR_JWT_EXPIRED') {
      return c.json({ detail: '登录已过期，请重新登录' }, 401);
    }
    return c.json({ detail: '无效的token' }, 401);
  }
});

/**
 * activeUserMiddleware: Check tenant subscription status.
 * Must run after authMiddleware. Returns 402 for expired subscriptions.
 */
export const activeUserMiddleware = createMiddleware<Env>(async (c, next) => {
  const user = c.get('user');
  // Superadmin bypasses tenant/subscription checks
  if (user.role === 'superadmin') {
    await next();
    return;
  }
  if (!user.tenantId) {
    return c.json({ detail: '用户未关联公司' }, 403);
  }
  const db = drizzle(c.env.DB);
  const tenant = await db.select().from(tenants).where(eq(tenants.id, user.tenantId)).get();
  if (!tenant) {
    return c.json({ detail: '公司不存在' }, 403);
  }

  const today = new Date().toISOString().slice(0, 10);
  if (tenant.status === 'suspended') {
    return c.json({ detail: '账户已被暂停，请联系管理员' }, 402);
  }
  if (tenant.plan === 'free_trial') {
    if (tenant.trialEndDate && tenant.trialEndDate < today) {
      return c.json({ detail: '免费试用已到期，请订阅以继续使用' }, 402);
    }
  } else {
    if (tenant.subscriptionEndDate && tenant.subscriptionEndDate < today) {
      return c.json({ detail: '订阅已到期，请续费以继续使用' }, 402);
    }
  }
  await next();
});

/**
 * writeProtectMiddleware: Members can only read (GET), not write.
 */
export const writeProtectMiddleware = createMiddleware<Env>(async (c, next) => {
  const user = c.get('user');
  if (user.role === 'member' && c.req.method !== 'GET') {
    return c.json({ detail: '成员仅有查看权限' }, 403);
  }
  await next();
});

/**
 * adminMiddleware: Only admin or superadmin can proceed.
 */
export const adminMiddleware = createMiddleware<Env>(async (c, next) => {
  const user = c.get('user');
  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return c.json({ detail: '仅管理员可执行此操作' }, 403);
  }
  await next();
});

/**
 * superadminMiddleware: Only superadmin can proceed.
 */
export const superadminMiddleware = createMiddleware<Env>(async (c, next) => {
  const user = c.get('user');
  if (user.role !== 'superadmin') {
    return c.json({ detail: '仅超级管理员可执行此操作' }, 403);
  }
  await next();
});
