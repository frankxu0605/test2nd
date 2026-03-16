import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc } from 'drizzle-orm';
import { accountTransfers } from '../db/schema';
import { authMiddleware, activeUserMiddleware, writeProtectMiddleware } from '../middleware/auth';
import type { Env } from '../lib/types';

const transfersRoute = new Hono<Env>();
transfersRoute.use('*', authMiddleware, activeUserMiddleware, writeProtectMiddleware);

// List transfers
transfersRoute.get('/', async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(accountTransfers)
    .where(eq(accountTransfers.tenantId, user.tenantId!))
    .orderBy(desc(accountTransfers.transferDate), desc(accountTransfers.id));
  return c.json(rows);
});

// Create transfer
transfersRoute.post('/', async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);
  const body = await c.req.json();
  const row = await db.insert(accountTransfers).values({
    tenantId: user.tenantId!,
    fromAccount: body.from_account,
    toAccount: body.to_account,
    amount: String(body.amount),
    transferDate: body.transfer_date,
    notes: body.notes || '',
  }).returning();
  return c.json(row[0], 201);
});

// Delete transfer
transfersRoute.delete('/:id', async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);
  const id = parseInt(c.req.param('id'));
  await db.delete(accountTransfers)
    .where(and(eq(accountTransfers.id, id), eq(accountTransfers.tenantId, user.tenantId!)));
  return c.json({ ok: true });
});

export default transfersRoute;
