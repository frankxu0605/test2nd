import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, like, or, sql, max, desc, asc, inArray } from 'drizzle-orm';
import { customers, orders, repaymentPlans, appointments } from '../db/schema';
import { authMiddleware, writeProtectMiddleware } from '../middleware/auth';
import type { Env } from '../lib/types';

const customersRoute = new Hono<Env>();
customersRoute.use('*', authMiddleware, writeProtectMiddleware);

function customerOut(c: any) {
  return {
    id: c.id,
    tenant_id: c.tenantId,
    customer_no: c.customerNo,
    name: c.name,
    phone: c.phone || '',
    id_card: c.idCard || '',
    address: c.address || '',
    email: c.email || '',
    account_manager: c.accountManager || '',
    emergency_contact: c.emergencyContact || '',
    has_overdue: c.hasOverdue || '否',
    has_property: c.hasProperty || '否',
    created_at: c.createdAt || '',
  };
}

// ── List ─────────────────────────────────────────────────
customersRoute.get('/', async (c) => {
  const user = c.get('user');
  const keyword = c.req.query('keyword') || '';
  const skip = parseInt(c.req.query('skip') || '0');
  const limit = parseInt(c.req.query('limit') || '100');
  const db = drizzle(c.env.DB);

  let q = db.select().from(customers).where(eq(customers.tenantId, user.tenantId!));
  if (keyword) {
    q = db.select().from(customers).where(and(
      eq(customers.tenantId, user.tenantId!),
      or(
        like(customers.name, `%${keyword}%`),
        like(customers.phone, `%${keyword}%`),
        like(customers.idCard, `%${keyword}%`),
      ),
    ));
  }
  const rows = await q.orderBy(asc(customers.customerNo)).offset(skip).limit(limit);
  return c.json(rows.map(customerOut));
});

// ── Count ────────────────────────────────────────────────
customersRoute.get('/count', async (c) => {
  const user = c.get('user');
  const keyword = c.req.query('keyword') || '';
  const db = drizzle(c.env.DB);

  let where = eq(customers.tenantId, user.tenantId!);
  if (keyword) {
    where = and(where, or(
      like(customers.name, `%${keyword}%`),
      like(customers.phone, `%${keyword}%`),
      like(customers.idCard, `%${keyword}%`),
    ))!;
  }
  const result = await db.select({ count: sql<number>`count(*)` }).from(customers).where(where);
  return c.json({ count: result[0]?.count || 0 });
});

// ── Merge duplicates ─────────────────────────────────────
customersRoute.post('/merge-duplicates', async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);
  const tid = user.tenantId!;

  // Find id_cards with duplicates
  const dups = await db.select({
    idCard: customers.idCard,
    cnt: sql<number>`count(*)`,
  }).from(customers)
    .where(and(eq(customers.tenantId, tid), sql`${customers.idCard} != ''`))
    .groupBy(customers.idCard)
    .having(sql`count(*) > 1`);

  let mergedGroups = 0;
  let removedDuplicates = 0;

  for (const dup of dups) {
    const group = await db.select().from(customers)
      .where(and(eq(customers.tenantId, tid), eq(customers.idCard, dup.idCard!)))
      .orderBy(asc(customers.id));
    if (group.length < 2) continue;

    const primary = group[0];
    for (let i = 1; i < group.length; i++) {
      const d = group[i];
      // Fill empty fields from duplicate into primary
      const updates: Record<string, any> = {};
      for (const col of ['name', 'phone', 'address', 'email', 'accountManager', 'emergencyContact'] as const) {
        if (!primary[col] && d[col]) updates[col] = d[col];
      }
      if (Object.keys(updates).length > 0) {
        await db.update(customers).set(updates).where(eq(customers.id, primary.id));
      }
      // Reassign orders and appointments
      await db.update(orders).set({ customerId: primary.id }).where(eq(orders.customerId, d.id));
      await db.update(appointments).set({ customerId: primary.id }).where(eq(appointments.customerId, d.id));
      // Delete duplicate
      await db.delete(customers).where(eq(customers.id, d.id));
      removedDuplicates++;
    }
    mergedGroups++;
  }
  return c.json({ merged_groups: mergedGroups, removed_duplicates: removedDuplicates });
});

// ── Get by ID ────────────────────────────────────────────
customersRoute.get('/:id', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) return c.json({ detail: '无效的ID' }, 400);

  // Check if this is the overview endpoint
  const db = drizzle(c.env.DB);
  const cust = await db.select().from(customers)
    .where(and(eq(customers.id, id), eq(customers.tenantId, user.tenantId!))).get();
  if (!cust) return c.json({ detail: '客户不存在' }, 404);
  return c.json(customerOut(cust));
});

// ── Customer Overview ────────────────────────────────────
customersRoute.get('/:id/overview', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));
  const db = drizzle(c.env.DB);

  const cust = await db.select().from(customers)
    .where(and(eq(customers.id, id), eq(customers.tenantId, user.tenantId!))).get();
  if (!cust) return c.json({ detail: '客户不存在' }, 404);

  const orderList = await db.select().from(orders)
    .where(and(eq(orders.customerId, id), eq(orders.tenantId, user.tenantId!)))
    .orderBy(asc(orders.id));

  const orderResults = [];
  for (const o of orderList) {
    const totalPrice = (parseFloat(o.unitPrice || '0') + parseFloat(o.processingFee || '0')) * parseFloat(o.weight || '0');
    const downPayment = parseFloat(o.downPayment || '0');

    const plans = await db.select().from(repaymentPlans)
      .where(eq(repaymentPlans.orderId, o.id))
      .orderBy(asc(repaymentPlans.periodNo));

    const totalPaid = plans.reduce((s, p) => s + parseFloat(p.paidAmount || '0'), 0);
    const balance = totalPrice - downPayment - totalPaid;

    const hasOverdue = plans.some(p => (p.status || '').includes('逾期'));
    const allPaid = plans.length > 0 && plans.every(p =>
      parseFloat(p.paidAmount || '0') >= parseFloat(p.totalAmount || '0') && p.paidDate
    );

    let displayStatus = '正常';
    let settlementDate: string | null = null;
    let settlementDays: number | null = null;

    if (allPaid || o.status === '已结清') {
      displayStatus = '已结清';
      const paidDates = plans.filter(p => p.paidDate).map(p => p.paidDate!);
      if (paidDates.length > 0) {
        const lastPaid = paidDates.sort().reverse()[0];
        settlementDate = lastPaid;
        const orderDt = new Date(o.orderDate);
        const lastDt = new Date(lastPaid);
        settlementDays = Math.round((lastDt.getTime() - orderDt.getTime()) / 86400000);
      }
    } else if (hasOverdue) {
      displayStatus = '已逾期';
    }

    orderResults.push({
      order_no: o.orderNo,
      weight: parseFloat(o.weight || '0'),
      total_price: Math.round(totalPrice),
      down_payment: Math.round(downPayment),
      notary_fee: Math.round(parseFloat(o.notaryFee || '0')),
      installment_amount: parseFloat(o.installmentAmount || '0'),
      installment_periods: o.installmentPeriods || 0,
      order_date: o.orderDate,
      status: displayStatus,
      settlement_date: settlementDate,
      settlement_days: settlementDays,
      balance: Math.round(balance * 100) / 100,
    });
  }

  return c.json({
    customer: {
      id: cust.id,
      customer_no: cust.customerNo,
      name: cust.name,
      phone: cust.phone || '',
      id_card: cust.idCard || '',
      address: cust.address || '',
      email: cust.email || '',
      account_manager: cust.accountManager || '',
      emergency_contact: cust.emergencyContact || '',
      has_overdue: cust.hasOverdue || '否',
      has_property: cust.hasProperty || '否',
    },
    orders: orderResults,
  });
});

// ── Create ───────────────────────────────────────────────
customersRoute.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const db = drizzle(c.env.DB);
  const tid = user.tenantId!;

  // Auto-merge by id_card
  if (body.id_card) {
    const existing = await db.select().from(customers)
      .where(and(eq(customers.tenantId, tid), eq(customers.idCard, body.id_card))).get();
    if (existing) {
      const updates: Record<string, any> = {};
      if (body.name) updates.name = body.name;
      if (body.phone) updates.phone = body.phone;
      if (body.address) updates.address = body.address;
      if (body.email) updates.email = body.email;
      if (body.account_manager) updates.accountManager = body.account_manager;
      if (body.emergency_contact) updates.emergencyContact = body.emergency_contact;
      if (body.has_overdue) updates.hasOverdue = body.has_overdue;
      if (body.has_property) updates.hasProperty = body.has_property;
      if (Object.keys(updates).length > 0) {
        await db.update(customers).set(updates).where(eq(customers.id, existing.id));
      }
      const updated = await db.select().from(customers).where(eq(customers.id, existing.id)).get();
      return c.json(customerOut(updated));
    }
  }

  // Auto-assign customer_no
  let customerNo = body.customer_no || 0;
  if (!customerNo) {
    const maxResult = await db.select({ maxNo: max(customers.customerNo) }).from(customers)
      .where(eq(customers.tenantId, tid));
    customerNo = (maxResult[0]?.maxNo || 0) + 1;
  } else {
    const existing = await db.select().from(customers)
      .where(and(eq(customers.tenantId, tid), eq(customers.customerNo, customerNo))).get();
    if (existing) return c.json({ detail: `编号 ${customerNo} 已被使用` }, 400);
  }

  const result = await db.insert(customers).values({
    tenantId: tid,
    customerNo,
    name: body.name,
    phone: body.phone || '',
    idCard: body.id_card || '',
    address: body.address || '',
    email: body.email || '',
    accountManager: body.account_manager || '',
    emergencyContact: body.emergency_contact || '',
    hasOverdue: body.has_overdue || '否',
    hasProperty: body.has_property || '否',
  }).returning();
  return c.json(customerOut(result[0]));
});

// ── Update ───────────────────────────────────────────────
customersRoute.put('/:id', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));
  const body = await c.req.json();
  const db = drizzle(c.env.DB);

  const cust = await db.select().from(customers)
    .where(and(eq(customers.id, id), eq(customers.tenantId, user.tenantId!))).get();
  if (!cust) return c.json({ detail: '客户不存在' }, 404);

  if (body.customer_no && body.customer_no !== cust.customerNo) {
    const dup = await db.select().from(customers)
      .where(and(
        eq(customers.tenantId, user.tenantId!),
        eq(customers.customerNo, body.customer_no),
        sql`${customers.id} != ${id}`,
      )).get();
    if (dup) return c.json({ detail: `编号 ${body.customer_no} 已被使用` }, 400);
  }

  const updates: Record<string, any> = {};
  if (body.customer_no !== undefined) updates.customerNo = body.customer_no;
  if (body.name !== undefined) updates.name = body.name;
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.id_card !== undefined) updates.idCard = body.id_card;
  if (body.address !== undefined) updates.address = body.address;
  if (body.email !== undefined) updates.email = body.email;
  if (body.account_manager !== undefined) updates.accountManager = body.account_manager;
  if (body.emergency_contact !== undefined) updates.emergencyContact = body.emergency_contact;
  if (body.has_overdue !== undefined) updates.hasOverdue = body.has_overdue;
  if (body.has_property !== undefined) updates.hasProperty = body.has_property;

  await db.update(customers).set(updates).where(eq(customers.id, id));
  const updated = await db.select().from(customers).where(eq(customers.id, id)).get();
  return c.json(customerOut(updated));
});

// ── Delete ───────────────────────────────────────────────
customersRoute.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));
  const db = drizzle(c.env.DB);

  const cust = await db.select().from(customers)
    .where(and(eq(customers.id, id), eq(customers.tenantId, user.tenantId!))).get();
  if (!cust) return c.json({ detail: '客户不存在' }, 404);

  await db.delete(customers).where(eq(customers.id, id));
  return c.json({ message: '删除成功' });
});

export default customersRoute;
