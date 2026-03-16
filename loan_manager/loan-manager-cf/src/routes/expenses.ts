import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, like, or, sql, desc } from 'drizzle-orm';
import { expenses } from '../db/schema';
import { authMiddleware, activeUserMiddleware, writeProtectMiddleware } from '../middleware/auth';
import type { Env } from '../lib/types';

const expensesRoute = new Hono<Env>();
expensesRoute.use('*', authMiddleware, activeUserMiddleware, writeProtectMiddleware);

function todayStr() { return new Date().toISOString().slice(0, 10); }

function expenseOut(e: any) {
  return {
    id: e.id, tenant_id: e.tenantId, expense_date: e.expenseDate,
    purchase_order_no: e.purchaseOrderNo || '', supplier_name: e.supplierName || '',
    supplier_phone: e.supplierPhone || '', supplier_address: e.supplierAddress || '',
    product_name: e.productName || '', category: e.category || '', unit: e.unit || '',
    quantity: e.quantity || 0, unit_price: e.unitPrice || '0.00', total_price: e.totalPrice || '0.00',
    receiver: e.receiver || '', receiver_phone: e.receiverPhone || '',
    receiver_address: e.receiverAddress || '', notes: e.notes || '',
    payment_account: e.paymentAccount || '', created_at: e.createdAt || '',
  };
}

async function generateOrderNo(db: ReturnType<typeof drizzle>, tenantId: number): Promise<string> {
  const today = todayStr().replace(/-/g, '');
  const prefix = `CG${today}`;
  const last = await db.select().from(expenses)
    .where(and(eq(expenses.tenantId, tenantId), like(expenses.purchaseOrderNo, `${prefix}%`)))
    .orderBy(desc(expenses.purchaseOrderNo)).get();
  let seq = 1;
  if (last?.purchaseOrderNo) {
    seq = parseInt(last.purchaseOrderNo.slice(-3)) + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

expensesRoute.get('/', async (c) => {
  const user = c.get('user');
  const keyword = c.req.query('keyword') || '';
  const category = c.req.query('category') || '';
  const skip = parseInt(c.req.query('skip') || '0');
  const limit = parseInt(c.req.query('limit') || '100');
  const db = drizzle(c.env.DB);

  const conditions: any[] = [eq(expenses.tenantId, user.tenantId!)];
  if (keyword) {
    conditions.push(or(
      like(expenses.supplierName, `%${keyword}%`),
      like(expenses.productName, `%${keyword}%`),
      like(expenses.purchaseOrderNo, `%${keyword}%`),
      like(expenses.notes, `%${keyword}%`),
    ));
  }
  if (category) conditions.push(eq(expenses.category, category));

  const rows = await db.select().from(expenses).where(and(...conditions))
    .orderBy(desc(expenses.id)).offset(skip).limit(limit);
  return c.json(rows.map(expenseOut));
});

expensesRoute.get('/count', async (c) => {
  const user = c.get('user');
  const keyword = c.req.query('keyword') || '';
  const category = c.req.query('category') || '';
  const db = drizzle(c.env.DB);

  const conditions: any[] = [eq(expenses.tenantId, user.tenantId!)];
  if (keyword) {
    conditions.push(or(
      like(expenses.supplierName, `%${keyword}%`),
      like(expenses.productName, `%${keyword}%`),
      like(expenses.purchaseOrderNo, `%${keyword}%`),
    ));
  }
  if (category) conditions.push(eq(expenses.category, category));

  const result = await db.select({ count: sql<number>`count(*)` }).from(expenses).where(and(...conditions));
  return c.json({ count: result[0]?.count || 0 });
});

expensesRoute.get('/suppliers', async (c) => {
  const user = c.get('user');
  const keyword = c.req.query('keyword') || '';
  const db = drizzle(c.env.DB);

  const conditions: any[] = [eq(expenses.tenantId, user.tenantId!), sql`${expenses.supplierName} != ''`];
  if (keyword) conditions.push(like(expenses.supplierName, `%${keyword}%`));

  const rows = await db.select({
    name: expenses.supplierName,
    phone: expenses.supplierPhone,
    address: expenses.supplierAddress,
  }).from(expenses).where(and(...conditions)).groupBy(expenses.supplierName);

  return c.json(rows.map(r => ({ name: r.name, phone: r.phone, address: r.address })));
});

expensesRoute.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const db = drizzle(c.env.DB);
  const tid = user.tenantId!;

  const expenseDate = body.expense_date || todayStr();
  const purchaseOrderNo = body.purchase_order_no || await generateOrderNo(db, tid);

  const result = await db.insert(expenses).values({
    tenantId: tid,
    expenseDate,
    purchaseOrderNo,
    supplierName: body.supplier_name || '',
    supplierPhone: body.supplier_phone || '',
    supplierAddress: body.supplier_address || '',
    productName: body.product_name || '',
    category: body.category || '',
    unit: body.unit || '',
    quantity: body.quantity || 0,
    unitPrice: body.unit_price || '0.00',
    totalPrice: body.total_price || '0.00',
    receiver: body.receiver || '',
    receiverPhone: body.receiver_phone || '',
    receiverAddress: body.receiver_address || '',
    notes: body.notes || '',
    paymentAccount: body.payment_account || '',
  }).returning();
  return c.json(expenseOut(result[0]));
});

expensesRoute.put('/:id', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));
  const body = await c.req.json();
  const db = drizzle(c.env.DB);

  const exp = await db.select().from(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.tenantId, user.tenantId!))).get();
  if (!exp) return c.json({ detail: '支出记录不存在' }, 404);

  const updates: Record<string, any> = {};
  const fieldMap: Record<string, string> = {
    expense_date: 'expenseDate', purchase_order_no: 'purchaseOrderNo',
    supplier_name: 'supplierName', supplier_phone: 'supplierPhone', supplier_address: 'supplierAddress',
    product_name: 'productName', category: 'category', unit: 'unit', quantity: 'quantity',
    unit_price: 'unitPrice', total_price: 'totalPrice', receiver: 'receiver',
    receiver_phone: 'receiverPhone', receiver_address: 'receiverAddress',
    notes: 'notes', payment_account: 'paymentAccount',
  };
  for (const [k, v] of Object.entries(fieldMap)) {
    if (body[k] !== undefined) updates[v] = body[k];
  }

  await db.update(expenses).set(updates).where(eq(expenses.id, id));
  const updated = await db.select().from(expenses).where(eq(expenses.id, id)).get();
  return c.json(expenseOut(updated));
});

expensesRoute.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));
  const db = drizzle(c.env.DB);

  const exp = await db.select().from(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.tenantId, user.tenantId!))).get();
  if (!exp) return c.json({ detail: '支出记录不存在' }, 404);

  await db.delete(expenses).where(eq(expenses.id, id));
  return c.json({ message: '删除成功' });
});

export default expensesRoute;
