import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, like, or, sql, desc } from 'drizzle-orm';
import { warehouseEntries, orders, customers } from '../db/schema';
import { authMiddleware, activeUserMiddleware, writeProtectMiddleware } from '../middleware/auth';
import type { Env } from '../lib/types';

const warehouse = new Hono<Env>();
warehouse.use('*', authMiddleware, activeUserMiddleware, writeProtectMiddleware);

/** Auto-link: match exit_date+buyer → order_date+customer_name → order_no */
async function autoLinkOrder(db: ReturnType<typeof drizzle>, tid: number, entryId: number, exitDate: string | null, buyer: string) {
  if (!exitDate || !buyer) return;
  // Find customer by name
  const cust = await db.select({ id: customers.id }).from(customers)
    .where(and(eq(customers.tenantId, tid), eq(customers.name, buyer))).get();
  if (!cust) return;
  // Find order with matching date and customer
  const order = await db.select({ orderNo: orders.orderNo }).from(orders)
    .where(and(eq(orders.tenantId, tid), eq(orders.customerId, cust.id), eq(orders.orderDate, exitDate))).get();
  if (order) {
    await db.update(warehouseEntries).set({ notes: order.orderNo }).where(eq(warehouseEntries.id, entryId));
  }
}

function entryOut(e: any) {
  return {
    id: e.id, tenant_id: e.tenantId, item_no: e.itemNo || '', barcode: e.barcode || '',
    weight: e.weight || '0.00', unit_price: e.unitPrice || '0.00', total_price: e.totalPrice || '0.00',
    entry_date: e.entryDate || null, entry_operator: e.entryOperator || '',
    exit_date: e.exitDate || null, exit_operator: e.exitOperator || '',
    buyer: e.buyer || '', salesperson: e.salesperson || '', notes: e.notes || '',
  };
}

warehouse.get('/', async (c) => {
  const user = c.get('user');
  const keyword = c.req.query('keyword') || '';
  const skip = parseInt(c.req.query('skip') || '0');
  const limit = parseInt(c.req.query('limit') || '100');
  const db = drizzle(c.env.DB);

  const conditions: any[] = [eq(warehouseEntries.tenantId, user.tenantId!)];
  if (keyword) {
    conditions.push(or(
      like(warehouseEntries.itemNo, `%${keyword}%`),
      like(warehouseEntries.barcode, `%${keyword}%`),
      like(warehouseEntries.buyer, `%${keyword}%`),
      like(warehouseEntries.salesperson, `%${keyword}%`),
      like(warehouseEntries.entryOperator, `%${keyword}%`),
      like(warehouseEntries.notes, `%${keyword}%`),
    ));
  }

  const rows = await db.select().from(warehouseEntries).where(and(...conditions))
    .orderBy(desc(warehouseEntries.id)).offset(skip).limit(limit);
  return c.json(rows.map(entryOut));
});

warehouse.get('/count', async (c) => {
  const user = c.get('user');
  const keyword = c.req.query('keyword') || '';
  const db = drizzle(c.env.DB);

  const conditions: any[] = [eq(warehouseEntries.tenantId, user.tenantId!)];
  if (keyword) {
    conditions.push(or(
      like(warehouseEntries.itemNo, `%${keyword}%`),
      like(warehouseEntries.barcode, `%${keyword}%`),
    ));
  }
  const result = await db.select({ count: sql<number>`count(*)` }).from(warehouseEntries).where(and(...conditions));
  return c.json({ count: result[0]?.count || 0 });
});

warehouse.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const db = drizzle(c.env.DB);

  const result = await db.insert(warehouseEntries).values({
    tenantId: user.tenantId,
    itemNo: body.item_no || '', barcode: body.barcode || '',
    weight: body.weight || '0.00', unitPrice: body.unit_price || '0.00', totalPrice: body.total_price || '0.00',
    entryDate: body.entry_date || null, entryOperator: body.entry_operator || '',
    exitDate: body.exit_date || null, exitOperator: body.exit_operator || '',
    buyer: body.buyer || '', salesperson: body.salesperson || '', notes: body.notes || '',
  }).returning();
  const newEntry = result[0];

  // Auto-link order if notes is empty and exit_date+buyer are set
  if (!newEntry.notes && newEntry.exitDate && newEntry.buyer) {
    await autoLinkOrder(db, user.tenantId!, newEntry.id, newEntry.exitDate, newEntry.buyer);
    const linked = await db.select().from(warehouseEntries).where(eq(warehouseEntries.id, newEntry.id)).get();
    return c.json(entryOut(linked));
  }
  return c.json(entryOut(newEntry));
});

warehouse.put('/:id', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));
  const body = await c.req.json();
  const db = drizzle(c.env.DB);

  const entry = await db.select().from(warehouseEntries)
    .where(and(eq(warehouseEntries.id, id), eq(warehouseEntries.tenantId, user.tenantId!))).get();
  if (!entry) return c.json({ detail: '入库记录不存在' }, 404);

  const updates: Record<string, any> = {};
  const fieldMap: Record<string, string> = {
    item_no: 'itemNo', barcode: 'barcode', weight: 'weight', unit_price: 'unitPrice',
    total_price: 'totalPrice', entry_date: 'entryDate', entry_operator: 'entryOperator',
    exit_date: 'exitDate', exit_operator: 'exitOperator', buyer: 'buyer',
    salesperson: 'salesperson', notes: 'notes',
  };
  for (const [k, v] of Object.entries(fieldMap)) {
    if (body[k] !== undefined) updates[v] = body[k];
  }

  await db.update(warehouseEntries).set(updates).where(eq(warehouseEntries.id, id));

  // Auto-link order when exit_date or buyer changes and notes is not manually set
  if ((body.exit_date !== undefined || body.buyer !== undefined) && !body.notes) {
    const current = await db.select().from(warehouseEntries).where(eq(warehouseEntries.id, id)).get();
    if (current && current.exitDate && current.buyer) {
      await autoLinkOrder(db, user.tenantId!, id, current.exitDate, current.buyer);
    }
  }

  const updated = await db.select().from(warehouseEntries).where(eq(warehouseEntries.id, id)).get();
  return c.json(entryOut(updated));
});

warehouse.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));
  const db = drizzle(c.env.DB);

  const entry = await db.select().from(warehouseEntries)
    .where(and(eq(warehouseEntries.id, id), eq(warehouseEntries.tenantId, user.tenantId!))).get();
  if (!entry) return c.json({ detail: '入库记录不存在' }, 404);

  await db.delete(warehouseEntries).where(eq(warehouseEntries.id, id));
  return c.json({ message: '删除成功' });
});

export default warehouse;
