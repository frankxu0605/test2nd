import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, like, or, sql, desc, asc, inArray } from 'drizzle-orm';
import { repaymentPlans, orders, customers, warehouseEntries } from '../db/schema';
import { authMiddleware, activeUserMiddleware, writeProtectMiddleware } from '../middleware/auth';
import type { Env } from '../lib/types';

const repaymentsRoute = new Hono<Env>();
repaymentsRoute.use('*', authMiddleware, activeUserMiddleware, writeProtectMiddleware);

const PAID_STATUSES = new Set(['已还', '逾期还款']);

function todayStr() { return new Date().toISOString().slice(0, 10); }

export async function autoSyncOverdue(db: ReturnType<typeof drizzle>, tenantId: number) {
  const today = todayStr();
  // Bulk update all overdue plans in one query
  const result = await db.update(repaymentPlans)
    .set({ status: '逾期未还' })
    .where(and(
      eq(repaymentPlans.tenantId, tenantId),
      sql`${repaymentPlans.dueDate} < ${today}`,
      eq(repaymentPlans.status, '待还'),
    ))
    .returning({ orderId: repaymentPlans.orderId });

  if (!result.length) return;

  const affectedOrderIds = [...new Set(result.map(r => r.orderId))];
  await batchSyncOrderStatus(db, affectedOrderIds);
}

async function syncOrderStatus(db: ReturnType<typeof drizzle>, orderId: number) {
  const orderIds = [orderId];
  await batchSyncOrderStatus(db, orderIds);
}

async function batchSyncOrderStatus(db: ReturnType<typeof drizzle>, orderIds: number[]) {
  if (!orderIds.length) return;

  const orderList = await db.select().from(orders).where(inArray(orders.id, orderIds));
  if (!orderList.length) return;

  const allPlans = await db.select({
    orderId: repaymentPlans.orderId,
    status: repaymentPlans.status,
  }).from(repaymentPlans).where(inArray(repaymentPlans.orderId, orderIds));

  // Group plans by order
  const plansByOrder: Record<number, string[]> = {};
  for (const p of allPlans) {
    if (!plansByOrder[p.orderId]) plansByOrder[p.orderId] = [];
    plansByOrder[p.orderId].push(p.status || '');
  }

  for (const order of orderList) {
    const statuses = plansByOrder[order.id];
    if (!statuses || !statuses.length) continue;

    const allPaid = statuses.every(s => PAID_STATUSES.has(s));
    if (allPaid) {
      if (order.status !== '已结清') await db.update(orders).set({ status: '已结清' }).where(eq(orders.id, order.id));
      continue;
    }

    if (order.status === '已结清') {
      await db.update(orders).set({ status: '已通过' }).where(eq(orders.id, order.id));
    }

    const hasOverdue = statuses.some(s => s === '逾期未还');
    if (hasOverdue && order.status !== '逾期') {
      await db.update(orders).set({ status: '逾期' }).where(eq(orders.id, order.id));
    } else if (!hasOverdue && order.status === '逾期') {
      await db.update(orders).set({ status: '已通过' }).where(eq(orders.id, order.id));
    }
  }
}

function planOut(p: any, order: any = null, customerName = '') {
  return {
    id: p.id, tenant_id: p.tenantId, order_id: p.orderId,
    period_no: p.periodNo, due_date: p.dueDate,
    principal: p.principal || '0.00', interest: p.interest || '0.00',
    total_amount: p.totalAmount || '0.00', paid_amount: p.paidAmount || '0.00',
    paid_date: p.paidDate || null, payment_account: p.paymentAccount || '',
    status: p.status || '待还',
    order_no: order?.orderNo || '',
    customer_name: customerName,
    order_total_price: order ? (parseFloat(order.unitPrice || '0') + parseFloat(order.processingFee || '0')) * parseFloat(order.weight || '0') : 0,
    order_down_payment: order ? parseFloat(order.downPayment || '0') : 0,
    credit_reported: order?.creditReported || false,
    credit_reported_at: order?.creditReportedAt || null,
    lawsuit_filed: order?.lawsuitFiled || false,
    lawsuit_filed_at: order?.lawsuitFiledAt || null,
  };
}

// ── Summary (one row per order) ──────────────────────────
repaymentsRoute.get('/summary', async (c) => {
  const user = c.get('user');
  const keyword = c.req.query('keyword') || '';
  const db = drizzle(c.env.DB);
  const tid = user.tenantId!;

  // autoSyncOverdue moved to cron job for performance
  const conditions: any[] = [eq(orders.tenantId, tid), sql`${orders.installmentPeriods} > 0`];
  if (keyword) {
    const custRows = await db.select({ id: customers.id }).from(customers)
      .where(and(eq(customers.tenantId, tid), like(customers.name, `%${keyword}%`)));
    const cids = custRows.map(r => r.id);
    if (cids.length > 0) {
      conditions.push(or(like(orders.orderNo, `%${keyword}%`), inArray(orders.customerId, cids)));
    } else {
      conditions.push(like(orders.orderNo, `%${keyword}%`));
    }
  }

  const orderList = await db.select().from(orders).where(and(...conditions)).orderBy(asc(orders.orderDate), asc(orders.id));
  if (!orderList.length) return c.json([]);

  // Batch load customer info
  const cids = [...new Set(orderList.map(o => o.customerId))];
  const cmap: Record<number, { name: string; phone: string; idCard: string; address: string }> = {};
  if (cids.length > 0) {
    const custs = await db.select().from(customers).where(inArray(customers.id, cids));
    custs.forEach(c => { cmap[c.id] = { name: c.name, phone: c.phone || '', idCard: c.idCard || '', address: c.address || '' }; });
  }

  // Aggregate per order using SQL (much faster than loading all rows)
  const orderIds = orderList.map(o => o.id);
  const stats = await db.select({
    orderId: repaymentPlans.orderId,
    totalPeriods: sql<number>`count(*)`,
    installmentTotal: sql<number>`ROUND(SUM(CAST(${repaymentPlans.totalAmount} AS REAL)), 2)`,
    paidTotal: sql<number>`ROUND(SUM(CAST(${repaymentPlans.paidAmount} AS REAL)), 2)`,
    paidCount: sql<number>`SUM(CASE WHEN ${repaymentPlans.status} IN ('已还','逾期还款') THEN 1 ELSE 0 END)`,
  }).from(repaymentPlans)
    .where(and(eq(repaymentPlans.tenantId, tid), inArray(repaymentPlans.orderId, orderIds)))
    .groupBy(repaymentPlans.orderId);

  const statsMap: Record<number, typeof stats[0]> = {};
  for (const s of stats) statsMap[s.orderId] = s;

  // Batch load warehouse costs by order_no (stored in notes field)
  const orderNos = orderList.map(o => o.orderNo).filter(Boolean);
  const costMap: Record<string, number> = {};
  if (orderNos.length > 0) {
    const whCosts = await db.select({
      orderNo: warehouseEntries.notes,
      totalCost: sql<number>`ROUND(SUM(CAST(${warehouseEntries.totalPrice} AS REAL)), 2)`,
    }).from(warehouseEntries)
      .where(and(eq(warehouseEntries.tenantId, tid), inArray(warehouseEntries.notes, orderNos)))
      .groupBy(warehouseEntries.notes);
    for (const wh of whCosts) {
      if (wh.orderNo) costMap[wh.orderNo] = wh.totalCost || 0;
    }
  }

  const result = orderList.filter(o => statsMap[o.id]).map(o => {
    const s = statsMap[o.id];
    const orderTotal = (parseFloat(o.unitPrice || '0') + parseFloat(o.processingFee || '0')) * parseFloat(o.weight || '0');
    const downPayment = parseFloat(o.downPayment || '0');
    const installTotal = s.installmentTotal || 0;
    const cost = costMap[o.orderNo] || 0;
    const managerComm = Math.round(orderTotal * 0.02 * 100) / 100;
    const operatorComm = Math.round(orderTotal * 0.01 * 100) / 100;
    const paidTotal = downPayment + (s.paidTotal || 0);
    const profit = Math.round((paidTotal - cost - managerComm - operatorComm) * 100) / 100;
    const cust = cmap[o.customerId] || { name: '', phone: '', idCard: '', address: '' };
    return {
      order_id: o.id, order_no: o.orderNo, order_date: o.orderDate || '',
      customer_name: cust.name,
      customer_phone: cust.phone,
      customer_id_card: cust.idCard,
      customer_address: cust.address,
      order_total_price: orderTotal,
      down_payment: downPayment,
      cost,
      manager_commission: managerComm,
      operator_commission: operatorComm,
      profit,
      profit_rate: orderTotal > 0 ? Math.round(profit / orderTotal * 10000) / 100 : 0,
      credit_reported: o.creditReported || false,
      credit_reported_at: o.creditReportedAt || null,
      lawsuit_filed: o.lawsuitFiled || false,
      lawsuit_filed_at: o.lawsuitFiledAt || null,
      total_periods: s.totalPeriods,
      installment_total: installTotal,
      paid_total: s.paidTotal || 0,
      paid_count: s.paidCount || 0,
    };
  });
  return c.json(result);
});

// ── List (per-order detail) ──────────────────────────────
repaymentsRoute.get('/', async (c) => {
  const user = c.get('user');
  const orderId = c.req.query('order_id');
  const keyword = c.req.query('keyword') || '';
  const status = c.req.query('status') || '';
  const skip = parseInt(c.req.query('skip') || '0');
  const db = drizzle(c.env.DB);
  const tid = user.tenantId!;

  const conditions: any[] = [eq(repaymentPlans.tenantId, tid)];
  if (orderId) conditions.push(eq(repaymentPlans.orderId, parseInt(orderId)));
  if (status) conditions.push(eq(repaymentPlans.status, status));
  if (keyword) {
    // Search by order_no or customer name
    const matchOrders = await db.select({ id: orders.id }).from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .where(and(
        eq(orders.tenantId, tid),
        or(like(orders.orderNo, `%${keyword}%`), like(customers.name, `%${keyword}%`), like(customers.phone, `%${keyword}%`)),
      ));
    const oids = matchOrders.map(r => r.id);
    if (oids.length > 0) {
      conditions.push(inArray(repaymentPlans.orderId, oids));
    } else {
      return c.json([]);
    }
  }

  const plans = await db.select().from(repaymentPlans).where(and(...conditions))
    .orderBy(asc(repaymentPlans.orderId), asc(repaymentPlans.periodNo)).offset(skip);

  // Batch load orders and customers
  const oids = [...new Set(plans.map(p => p.orderId))];
  const orderMap: Record<number, any> = {};
  const cmap: Record<number, string> = {};
  if (oids.length > 0) {
    const orderList = await db.select().from(orders).where(inArray(orders.id, oids));
    orderList.forEach(o => { orderMap[o.id] = o; });
    const cids = [...new Set(orderList.map(o => o.customerId))];
    if (cids.length > 0) {
      const custs = await db.select().from(customers).where(inArray(customers.id, cids));
      custs.forEach(c => { cmap[c.id] = c.name; });
    }
  }

  return c.json(plans.map(p => {
    const order = orderMap[p.orderId];
    return planOut(p, order, cmap[order?.customerId] || '');
  }));
});

// ── Count ────────────────────────────────────────────────
repaymentsRoute.get('/count', async (c) => {
  const user = c.get('user');
  const orderId = c.req.query('order_id');
  const status = c.req.query('status') || '';
  const db = drizzle(c.env.DB);

  const conditions: any[] = [eq(repaymentPlans.tenantId, user.tenantId!)];
  if (orderId) conditions.push(eq(repaymentPlans.orderId, parseInt(orderId)));
  if (status) conditions.push(eq(repaymentPlans.status, status));

  const result = await db.select({ count: sql<number>`count(*)` }).from(repaymentPlans).where(and(...conditions));
  return c.json({ count: result[0]?.count || 0 });
});

// ── Create ───────────────────────────────────────────────
repaymentsRoute.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const db = drizzle(c.env.DB);

  const result = await db.insert(repaymentPlans).values({
    tenantId: user.tenantId,
    orderId: body.order_id,
    periodNo: body.period_no,
    dueDate: body.due_date,
    principal: body.principal || '0.00',
    interest: body.interest || '0.00',
    totalAmount: body.total_amount || '0.00',
    paidAmount: body.paid_amount || '0.00',
    paidDate: body.paid_date || null,
    paymentAccount: body.payment_account || '',
    status: body.status || '待还',
  }).returning();
  const rp = result[0];

  await syncOrderStatus(db, rp.orderId);

  const order = await db.select().from(orders).where(eq(orders.id, rp.orderId)).get();
  let customerName = '';
  if (order) {
    const cust = await db.select().from(customers).where(eq(customers.id, order.customerId)).get();
    customerName = cust?.name || '';
  }
  return c.json(planOut(rp, order, customerName));
});

// ── Batch create ─────────────────────────────────────────
repaymentsRoute.post('/batch', async (c) => {
  const user = c.get('user');
  const items: any[] = await c.req.json();
  const db = drizzle(c.env.DB);
  const results: any[] = [];
  const orderIds = new Set<number>();

  for (const body of items) {
    const result = await db.insert(repaymentPlans).values({
      tenantId: user.tenantId,
      orderId: body.order_id,
      periodNo: body.period_no,
      dueDate: body.due_date,
      principal: body.principal || '0.00',
      interest: body.interest || '0.00',
      totalAmount: body.total_amount || '0.00',
      paidAmount: body.paid_amount || '0.00',
      paidDate: body.paid_date || null,
      paymentAccount: body.payment_account || '',
      status: body.status || '待还',
    }).returning();
    results.push(result[0]);
    orderIds.add(body.order_id);
  }

  for (const oid of orderIds) {
    await syncOrderStatus(db, oid);
  }

  // Batch load for response
  const oids = [...orderIds];
  const orderMap: Record<number, any> = {};
  const cmap: Record<number, string> = {};
  if (oids.length > 0) {
    const orderList = await db.select().from(orders).where(inArray(orders.id, oids));
    orderList.forEach(o => { orderMap[o.id] = o; });
    const cids = [...new Set(orderList.map(o => o.customerId))];
    if (cids.length > 0) {
      const custs = await db.select().from(customers).where(inArray(customers.id, cids));
      custs.forEach(c => { cmap[c.id] = c.name; });
    }
  }

  return c.json(results.map(rp => {
    const order = orderMap[rp.orderId];
    return planOut(rp, order, cmap[order?.customerId] || '');
  }));
});

// ── Batch update ────────────────────────────────────────
repaymentsRoute.put('/batch', async (c) => {
  const user = c.get('user');
  const items: any[] = await c.req.json();
  const db = drizzle(c.env.DB);
  const tid = user.tenantId!;

  // Load all plans in one query instead of N individual SELECTs
  const ids = items.map(i => i.id).filter(Boolean);
  const existing = await db.select({ id: repaymentPlans.id, orderId: repaymentPlans.orderId })
    .from(repaymentPlans)
    .where(and(eq(repaymentPlans.tenantId, tid), inArray(repaymentPlans.id, ids)));
  const existMap = new Map(existing.map(r => [r.id, r.orderId]));

  const orderIds = new Set<number>();
  for (const item of items) {
    const orderId = existMap.get(item.id);
    if (orderId === undefined) continue;
    await db.update(repaymentPlans).set({
      paidAmount: String(item.paid_amount ?? '0.00'),
      paidDate: item.paid_date || null,
      paymentAccount: item.payment_account || '',
      status: item.status || '待还',
    }).where(and(eq(repaymentPlans.id, item.id), eq(repaymentPlans.tenantId, tid)));
    orderIds.add(orderId);
  }

  await batchSyncOrderStatus(db, [...orderIds]);
  return c.json({ message: '保存成功', count: items.length });
});

// ── Update ───────────────────────────────────────────────
repaymentsRoute.put('/:id', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));
  const body = await c.req.json();
  const db = drizzle(c.env.DB);

  const rp = await db.select().from(repaymentPlans)
    .where(and(eq(repaymentPlans.id, id), eq(repaymentPlans.tenantId, user.tenantId!))).get();
  if (!rp) return c.json({ detail: '还款记录不存在' }, 404);

  const updates: Record<string, any> = {};
  if (body.period_no !== undefined) updates.periodNo = body.period_no;
  if (body.due_date !== undefined) updates.dueDate = body.due_date;
  if (body.principal !== undefined) updates.principal = body.principal;
  if (body.interest !== undefined) updates.interest = body.interest;
  if (body.total_amount !== undefined) updates.totalAmount = body.total_amount;
  if (body.paid_amount !== undefined) updates.paidAmount = body.paid_amount;
  if (body.paid_date !== undefined) updates.paidDate = body.paid_date;
  if (body.payment_account !== undefined) updates.paymentAccount = body.payment_account;
  if (body.status !== undefined) updates.status = body.status;

  await db.update(repaymentPlans).set(updates).where(eq(repaymentPlans.id, id));
  await syncOrderStatus(db, rp.orderId);

  const updated = await db.select().from(repaymentPlans).where(eq(repaymentPlans.id, id)).get();
  const order = await db.select().from(orders).where(eq(orders.id, rp.orderId)).get();
  let customerName = '';
  if (order) {
    const cust = await db.select().from(customers).where(eq(customers.id, order.customerId)).get();
    customerName = cust?.name || '';
  }
  return c.json(planOut(updated, order, customerName));
});

// ── Delete by order ──────────────────────────────────────
repaymentsRoute.delete('/by-order/:orderId', async (c) => {
  const user = c.get('user');
  const orderId = parseInt(c.req.param('orderId'));
  const db = drizzle(c.env.DB);

  await db.delete(repaymentPlans).where(and(
    eq(repaymentPlans.orderId, orderId),
    eq(repaymentPlans.tenantId, user.tenantId!),
  ));
  return c.json({ message: '删除成功' });
});

// ── Delete single ────────────────────────────────────────
repaymentsRoute.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));
  const db = drizzle(c.env.DB);

  const rp = await db.select().from(repaymentPlans)
    .where(and(eq(repaymentPlans.id, id), eq(repaymentPlans.tenantId, user.tenantId!))).get();
  if (!rp) return c.json({ detail: '还款记录不存在' }, 404);

  await db.delete(repaymentPlans).where(eq(repaymentPlans.id, id));
  return c.json({ message: '删除成功' });
});

export default repaymentsRoute;
