import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { systemSettings } from '../db/schema';
import { authMiddleware, activeUserMiddleware, writeProtectMiddleware } from '../middleware/auth';
import type { Env } from '../lib/types';

const settings = new Hono<Env>();
settings.use('*', authMiddleware, activeUserMiddleware, writeProtectMiddleware);

settings.get('/:key', async (c) => {
  const user = c.get('user');
  const key = c.req.param('key');
  const db = drizzle(c.env.DB);
  const s = await db.select().from(systemSettings)
    .where(and(eq(systemSettings.key, key), eq(systemSettings.tenantId, user.tenantId!))).get();
  return c.json({ key, value: s ? s.value : '' });
});

settings.put('/:key', async (c) => {
  const user = c.get('user');
  const key = c.req.param('key');
  const body = await c.req.json();
  const value = String(body.value ?? '');
  const db = drizzle(c.env.DB);

  const s = await db.select().from(systemSettings)
    .where(and(eq(systemSettings.key, key), eq(systemSettings.tenantId, user.tenantId!))).get();
  if (s) {
    await db.update(systemSettings).set({ value }).where(eq(systemSettings.id, s.id));
  } else {
    await db.insert(systemSettings).values({ key, value, tenantId: user.tenantId });
  }
  return c.json({ key, value });
});

export default settings;
