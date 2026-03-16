import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, like, or, sql, desc } from 'drizzle-orm';
import { overdueReports } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import type { Env } from '../lib/types';

const route = new Hono<Env>();

// Global access: only need auth (no subscription check, no write-protect — all users can report)
route.use('*', authMiddleware);

function entityOut(e: any) {
  return {
    id: e.id,
    customer_name: e.customerName || '',
    id_card: e.idCard || '',
    phone: e.phone || '',
    address: e.address || '',
    overdue_amount: e.overdueAmount || '0',
    overdue_periods: e.overduePeriods || 0,
    overdue_date: e.overdueDate || '',
    notes: e.notes || '',
    reported_by: e.reportedBy || '',
    tenant_id: e.tenantId,
    created_at: e.createdAt || '',
  };
}

// GET list — global, no tenant filter
route.get('/', async (c) => {
  const keyword = c.req.query('keyword') || '';
  const skip = parseInt(c.req.query('skip') || '0');
  const limit = parseInt(c.req.query('limit') || '100');
  const db = drizzle(c.env.DB);

  const conditions: any[] = [];
  if (keyword) {
    conditions.push(or(
      like(overdueReports.customerName, `%${keyword}%`),
      like(overdueReports.idCard, `%${keyword}%`),
      like(overdueReports.phone, `%${keyword}%`),
    ));
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const rows = await db.select().from(overdueReports)
    .where(where)
    .orderBy(desc(overdueReports.id)).offset(skip).limit(limit);
  return c.json(rows.map(entityOut));
});

// GET count
route.get('/count', async (c) => {
  const keyword = c.req.query('keyword') || '';
  const db = drizzle(c.env.DB);

  const conditions: any[] = [];
  if (keyword) {
    conditions.push(or(
      like(overdueReports.customerName, `%${keyword}%`),
      like(overdueReports.idCard, `%${keyword}%`),
      like(overdueReports.phone, `%${keyword}%`),
    ));
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(overdueReports).where(where);
  return c.json({ count: result[0]?.count || 0 });
});

// POST create
route.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const db = drizzle(c.env.DB);

  const result = await db.insert(overdueReports).values({
    customerName: body.customer_name || '',
    idCard: body.id_card || '',
    phone: body.phone || '',
    address: body.address || '',
    overdueAmount: String(body.overdue_amount || '0'),
    overduePeriods: parseInt(body.overdue_periods) || 0,
    overdueDate: body.overdue_date || '',
    notes: body.notes || '',
    reportedBy: user.realName || user.username,
    tenantId: user.tenantId,
  }).returning();
  return c.json(entityOut(result[0]));
});

// PUT update — only reporter or admin
route.put('/:id', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));
  const body = await c.req.json();
  const db = drizzle(c.env.DB);

  const entity = await db.select().from(overdueReports).where(eq(overdueReports.id, id)).get();
  if (!entity) return c.json({ detail: '记录不存在' }, 404);

  // Only the reporter (same tenant) or admin can edit
  if (entity.tenantId !== user.tenantId && user.role !== 'superadmin') {
    return c.json({ detail: '无权修改他人上报的记录' }, 403);
  }

  const updates: Record<string, any> = {};
  const fieldMap: Record<string, string> = {
    customer_name: 'customerName',
    id_card: 'idCard',
    phone: 'phone',
    address: 'address',
    overdue_amount: 'overdueAmount',
    overdue_periods: 'overduePeriods',
    overdue_date: 'overdueDate',
    notes: 'notes',
  };
  for (const [k, v] of Object.entries(fieldMap)) {
    if (body[k] !== undefined) updates[v] = k === 'overdue_periods' ? (parseInt(body[k]) || 0) : String(body[k]);
  }

  await db.update(overdueReports).set(updates).where(eq(overdueReports.id, id));
  const updated = await db.select().from(overdueReports).where(eq(overdueReports.id, id)).get();
  return c.json(entityOut(updated));
});

// DELETE — only reporter (same tenant) or superadmin
route.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));
  const db = drizzle(c.env.DB);

  const entity = await db.select().from(overdueReports).where(eq(overdueReports.id, id)).get();
  if (!entity) return c.json({ detail: '记录不存在' }, 404);

  if (entity.tenantId !== user.tenantId && user.role !== 'superadmin') {
    return c.json({ detail: '无权删除他人上报的记录' }, 403);
  }

  await db.delete(overdueReports).where(eq(overdueReports.id, id));
  return c.json({ message: '删除成功' });
});

export default route;
