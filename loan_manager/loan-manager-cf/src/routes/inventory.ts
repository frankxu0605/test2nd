import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, like, or, sql, desc } from 'drizzle-orm';
import { warehouseEntries } from '../db/schema';
import { authMiddleware, activeUserMiddleware } from '../middleware/auth';
import type { Env } from '../lib/types';

const inventoryRoute = new Hono<Env>();
inventoryRoute.use('*', authMiddleware, activeUserMiddleware);

function entryOut(e: any) {
  return {
    id: e.id, tenant_id: e.tenantId, item_no: e.itemNo || '', barcode: e.barcode || '',
    weight: e.weight || '0.00', unit_price: e.unitPrice || '0.00', total_price: e.totalPrice || '0.00',
    entry_date: e.entryDate || null, entry_operator: e.entryOperator || '',
    exit_date: e.exitDate || null, exit_operator: e.exitOperator || '',
    buyer: e.buyer || '', salesperson: e.salesperson || '', notes: e.notes || '',
  };
}

inventoryRoute.get('/', async (c) => {
  const user = c.get('user');
  const keyword = c.req.query('keyword') || '';
  const skip = parseInt(c.req.query('skip') || '0');
  const limit = parseInt(c.req.query('limit') || '100');
  const db = drizzle(c.env.DB);

  const conditions: any[] = [
    eq(warehouseEntries.tenantId, user.tenantId!),
    sql`${warehouseEntries.exitDate} IS NULL`,
  ];
  if (keyword) {
    conditions.push(or(
      like(warehouseEntries.itemNo, `%${keyword}%`),
      like(warehouseEntries.barcode, `%${keyword}%`),
      like(warehouseEntries.entryOperator, `%${keyword}%`),
      like(warehouseEntries.notes, `%${keyword}%`),
    ));
  }

  const rows = await db.select().from(warehouseEntries).where(and(...conditions))
    .orderBy(desc(warehouseEntries.id)).offset(skip).limit(limit);
  return c.json(rows.map(entryOut));
});

inventoryRoute.get('/count', async (c) => {
  const user = c.get('user');
  const keyword = c.req.query('keyword') || '';
  const db = drizzle(c.env.DB);

  const conditions: any[] = [
    eq(warehouseEntries.tenantId, user.tenantId!),
    sql`${warehouseEntries.exitDate} IS NULL`,
  ];
  if (keyword) {
    conditions.push(or(
      like(warehouseEntries.itemNo, `%${keyword}%`),
      like(warehouseEntries.barcode, `%${keyword}%`),
    ));
  }
  const result = await db.select({ count: sql<number>`count(*)` }).from(warehouseEntries).where(and(...conditions));
  return c.json({ count: result[0]?.count || 0 });
});

export default inventoryRoute;
