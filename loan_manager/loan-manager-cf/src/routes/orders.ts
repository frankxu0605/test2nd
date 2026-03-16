import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, like, or, sql, asc, desc, inArray } from 'drizzle-orm';
import { orders, customers, repaymentPlans, warehouseEntries } from '../db/schema';
import { authMiddleware, writeProtectMiddleware } from '../middleware/auth';
import { autoSyncOverdue } from './repayments';
import type { Env } from '../lib/types';

const ordersRoute = new Hono<Env>();
ordersRoute.use('*', authMiddleware, writeProtectMiddleware);

function todayStr() { return new Date().toISOString().slice(0, 10); }
function nowStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

function orderOut(o: any, customerName = '') {
  return {
    id: o.id, tenant_id: o.tenantId, order_date: o.orderDate, order_no: o.orderNo,
    customer_id: o.customerId, phone: o.phone || '', id_card: o.idCard || '',
    address: o.address || '', email: o.email || '', account_manager: o.accountManager || '',
    operator: o.operator || '', emergency_contact: o.emergencyContact || '',
    has_overdue: o.hasOverdue || '否', has_property: o.hasProperty || '否',
    weight: o.weight || '0.00', unit_price: o.unitPrice || '0.00',
    processing_fee: o.processingFee || '0.00', notary_fee: o.notaryFee || '0.00',
    down_payment_ratio: o.downPaymentRatio || '0.00', down_payment: o.downPayment || '0.00',
    payment_account: o.paymentAccount || '', installment_periods: o.installmentPeriods || 0,
    installment_amount: o.installmentAmount || '0.00', status: o.status || '待审核',
    credit_reported: o.creditReported || false, credit_report_fee: o.creditReportFee || '0.00',
    credit_reported_at: o.creditReportedAt || null, lawsuit_filed: o.lawsuitFiled || false,
    lawsuit_fee: o.lawsuitFee || '0.00', lawsuit_filed_at: o.lawsuitFiledAt || null,
    manager_commission_paid: o.managerCommissionPaid || false,
    operator_commission_paid: o.operatorCommissionPaid || false,
    created_at: o.createdAt || '', customer_name: customerName,
  };
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function autoGeneratePlans(db: ReturnType<typeof drizzle>, order: any) {
  const periods = order.installmentPeriods || 0;
  const amount = parseFloat(order.installmentAmount || '0');
  if (periods <= 0 || amount <= 0) return;

  const existing = await db.select().from(repaymentPlans)
    .where(eq(repaymentPlans.orderId, order.id)).get();
  if (existing) return;

  for (let i = 1; i <= periods; i++) {
    const dueDate = addDays(order.orderDate, i);
    await db.insert(repaymentPlans).values({
      tenantId: order.tenantId,
      orderId: order.id,
      periodNo: i,
      dueDate,
      principal: order.installmentAmount || '0.00',
      interest: '0.00',
      totalAmount: order.installmentAmount || '0.00',
      paidAmount: '0.00',
      status: '待还',
    });
  }
}

/** Reverse auto-link: when order is created/updated, find matching warehouse entries and set their notes */
async function autoLinkWarehouse(db: ReturnType<typeof drizzle>, tid: number, orderDate: string, customerId: number, orderNo: string) {
  const cust = await db.select({ name: customers.name }).from(customers)
    .where(eq(customers.id, customerId)).get();
  if (!cust) return;
  await db.update(warehouseEntries).set({ notes: orderNo })
    .where(and(
      eq(warehouseEntries.tenantId, tid),
      eq(warehouseEntries.exitDate, orderDate),
      eq(warehouseEntries.buyer, cust.name),
      sql`(${warehouseEntries.notes} IS NULL OR ${warehouseEntries.notes} = '')`,
    ));
}

// ── List ─────────────────────────────────────────────────
ordersRoute.get('/', async (c) => {
  const user = c.get('user');
  const keyword = c.req.query('keyword') || '';
  const customerId = c.req.query('customer_id');
  const status = c.req.query('status') || '';
  const skip = parseInt(c.req.query('skip') || '0');
  const limit = parseInt(c.req.query('limit') || '100');
  const db = drizzle(c.env.DB);
  const tid = user.tenantId!;

  await autoSyncOverdue(db, tid);

  const conditions: any[] = [eq(orders.tenantId, tid)];
  if (customerId) conditions.push(eq(orders.customerId, parseInt(customerId)));
  if (status) conditions.push(eq(orders.status, status));
  if (keyword) {
    // Search by order_no, phone, id_card, account_manager, or customer name
    const custRows = await db.select({ id: customers.id }).from(customers)
      .where(and(eq(customers.tenantId, tid), like(customers.name, `%${keyword}%`)));
    const cids = custRows.map(r => r.id);
    if (cids.length > 0) {
      conditions.push(or(
        like(orders.orderNo, `%${keyword}%`),
        like(orders.phone, `%${keyword}%`),
        like(orders.idCard, `%${keyword}%`),
        like(orders.accountManager, `%${keyword}%`),
        inArray(orders.customerId, cids),
      ));
    } else {
      conditions.push(or(
        like(orders.orderNo, `%${keyword}%`),
        like(orders.phone, `%${keyword}%`),
        like(orders.idCard, `%${keyword}%`),
        like(orders.accountManager, `%${keyword}%`),
      ));
    }
  }

  const rows = await db.select().from(orders).where(and(...conditions))
    .orderBy(asc(orders.orderDate), asc(orders.id)).offset(skip).limit(limit);

  // Batch load customer names
  const cids = [...new Set(rows.map(o => o.customerId).filter(Boolean))];
  const cmap: Record<number, string> = {};
  if (cids.length > 0) {
    const custs = await db.select().from(customers).where(inArray(customers.id, cids));
    custs.forEach(c => { cmap[c.id] = c.name; });
  }

  return c.json(rows.map(o => orderOut(o, cmap[o.customerId] || '')));
});

// ── Count ────────────────────────────────────────────────
ordersRoute.get('/count', async (c) => {
  const user = c.get('user');
  const keyword = c.req.query('keyword') || '';
  const status = c.req.query('status') || '';
  const db = drizzle(c.env.DB);

  const conditions: any[] = [eq(orders.tenantId, user.tenantId!)];
  if (keyword) conditions.push(like(orders.orderNo, `%${keyword}%`));
  if (status) conditions.push(eq(orders.status, status));

  const result = await db.select({ count: sql<number>`count(*)` }).from(orders).where(and(...conditions));
  return c.json({ count: result[0]?.count || 0 });
});

// ── Order numbers (lightweight list for datalist) ────────
ordersRoute.get('/numbers', async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);
  const rows = await db.select({ orderNo: orders.orderNo })
    .from(orders)
    .where(eq(orders.tenantId, user.tenantId!))
    .orderBy(asc(orders.orderDate), asc(orders.id));
  return c.json(rows.map(r => r.orderNo));
});

// ── Commission ───────────────────────────────────────────
ordersRoute.get('/commission', async (c) => {
  const user = c.get('user');
  const name = c.req.query('name') || '';
  const dateFrom = c.req.query('date_from') || '';
  const dateTo = c.req.query('date_to') || '';
  const db = drizzle(c.env.DB);
  const tid = user.tenantId!;

  if (!name) return c.json({ detail: 'name参数必填' }, 400);

  const conditions: any[] = [eq(orders.tenantId, tid), eq(orders.status, '已结清')];
  if (dateFrom) conditions.push(sql`${orders.orderDate} >= ${dateFrom}`);
  if (dateTo) conditions.push(sql`${orders.orderDate} <= ${dateTo}`);

  const managerOrders = await db.select().from(orders)
    .where(and(...conditions, eq(orders.accountManager, name)));
  const operatorOrders = await db.select().from(orders)
    .where(and(...conditions, eq(orders.operator, name)));

  // Batch load customer names
  const allCids = [...new Set([...managerOrders, ...operatorOrders].map(o => o.customerId))];
  const cmap: Record<number, string> = {};
  if (allCids.length > 0) {
    const custs = await db.select().from(customers).where(inArray(customers.id, allCids));
    custs.forEach(c => { cmap[c.id] = c.name; });
  }

  function summarize(ordersList: any[], rate: number, paidField: 'managerCommissionPaid' | 'operatorCommissionPaid') {
    let totalAmount = 0, unpaidAmount = 0;
    const rows = ordersList.map(o => {
      const amt = (parseFloat(o.unitPrice || '0') + parseFloat(o.processingFee || '0')) * parseFloat(o.weight || '0');
      const paid = !!o[paidField];
      totalAmount += amt;
      if (!paid) unpaidAmount += amt;
      return {
        order_id: o.id, order_no: o.orderNo, order_date: o.orderDate,
        customer_name: cmap[o.customerId] || '', total_amount: Math.round(amt * 100) / 100,
        commission: Math.round(amt * rate * 100) / 100, commission_paid: paid,
      };
    });
    return {
      count: rows.length,
      total_amount: Math.round(totalAmount * 100) / 100,
      commission: Math.round(totalAmount * rate * 100) / 100,
      unpaid_commission: Math.round(unpaidAmount * rate * 100) / 100,
      orders: rows,
    };
  }

  return c.json({
    name,
    as_manager: summarize(managerOrders, 0.02, 'managerCommissionPaid'),
    as_operator: summarize(operatorOrders, 0.01, 'operatorCommissionPaid'),
  });
});

// ── Mark commission paid ─────────────────────────────────
ordersRoute.post('/commission/mark-paid', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const orderIds: number[] = body.order_ids || [];
  const role = body.role || 'manager';
  if (!orderIds.length) return c.json({ message: '无操作' });

  const db = drizzle(c.env.DB);
  const field = role === 'manager' ? 'managerCommissionPaid' : 'operatorCommissionPaid';
  await db.update(orders).set({ [field]: true })
    .where(and(inArray(orders.id, orderIds), eq(orders.tenantId, user.tenantId!)));
  return c.json({ message: '已标记' });
});

// ── Get by ID ────────────────────────────────────────────
ordersRoute.get('/:id', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));
  const db = drizzle(c.env.DB);

  const o = await db.select().from(orders)
    .where(and(eq(orders.id, id), eq(orders.tenantId, user.tenantId!))).get();
  if (!o) return c.json({ detail: '订单不存在' }, 404);

  const cust = await db.select().from(customers).where(eq(customers.id, o.customerId)).get();
  return c.json(orderOut(o, cust?.name || ''));
});

// ── Create ───────────────────────────────────────────────
ordersRoute.post('/', async (c) => {
  const user = c.get('user');
  let body: any;
  try { body = await c.req.json(); } catch (e: any) {
    return c.json({ detail: '请求体解析失败: ' + e?.message }, 400);
  }
  const db = drizzle(c.env.DB);

  const orderDate = body.order_date || todayStr();
  const orderNo = body.order_no || ('ORD' + new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 20));

  let newOrder: any;
  try {
    const result = await db.insert(orders).values({
      tenantId: user.tenantId,
      orderDate,
      orderNo,
      customerId: body.customer_id,
      phone: body.phone || '',
      idCard: body.id_card || '',
      address: body.address || '',
      email: body.email || '',
      accountManager: body.account_manager || '',
      operator: body.operator || '',
      emergencyContact: body.emergency_contact || '',
      hasOverdue: body.has_overdue || '否',
      hasProperty: body.has_property || '否',
      weight: body.weight || '0.00',
      unitPrice: body.unit_price || '0.00',
      processingFee: body.processing_fee || '0.00',
      notaryFee: body.notary_fee || '0.00',
      downPaymentRatio: body.down_payment_ratio || '0.00',
      downPayment: body.down_payment || '0.00',
      paymentAccount: body.payment_account || '',
      installmentPeriods: body.installment_periods || 0,
      installmentAmount: body.installment_amount || '0.00',
      status: body.status || '待审核',
      creditReported: body.credit_reported || false,
      creditReportFee: body.credit_report_fee || '0.00',
      lawsuitFiled: body.lawsuit_filed || false,
      lawsuitFee: body.lawsuit_fee || '0.00',
    }).returning();
    newOrder = result[0];
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('UNIQUE') || msg.includes('unique') || msg.includes('constraint')) {
      return c.json({ detail: '已存在相同信息，请勿重复添加' }, 400);
    }
    return c.json({ detail: '创建订单失败: ' + msg }, 500);
  }

  try {
    await autoGeneratePlans(db, newOrder);
  } catch (err: any) {
    return c.json({ detail: '生成还款计划失败: ' + (err?.message || String(err)) }, 500);
  }

  // Reverse auto-link: match warehouse entries by order_date + customer_name
  await autoLinkWarehouse(db, user.tenantId!, newOrder.orderDate, newOrder.customerId, newOrder.orderNo);

  const cust = await db.select().from(customers).where(eq(customers.id, newOrder.customerId)).get();
  return c.json(orderOut(newOrder, cust?.name || ''));
});

// ── Update ───────────────────────────────────────────────
ordersRoute.put('/:id', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));
  const body = await c.req.json();
  const db = drizzle(c.env.DB);

  const o = await db.select().from(orders)
    .where(and(eq(orders.id, id), eq(orders.tenantId, user.tenantId!))).get();
  if (!o) return c.json({ detail: '订单不存在' }, 404);

  const updates: Record<string, any> = {};
  const fieldMap: Record<string, string> = {
    order_date: 'orderDate', order_no: 'orderNo', customer_id: 'customerId',
    phone: 'phone', id_card: 'idCard', address: 'address', email: 'email',
    account_manager: 'accountManager', operator: 'operator', emergency_contact: 'emergencyContact',
    has_overdue: 'hasOverdue', has_property: 'hasProperty', weight: 'weight',
    unit_price: 'unitPrice', processing_fee: 'processingFee', notary_fee: 'notaryFee',
    down_payment_ratio: 'downPaymentRatio', down_payment: 'downPayment',
    payment_account: 'paymentAccount', installment_periods: 'installmentPeriods',
    installment_amount: 'installmentAmount', status: 'status',
    credit_reported: 'creditReported', credit_report_fee: 'creditReportFee',
    credit_reported_at: 'creditReportedAt', lawsuit_filed: 'lawsuitFiled',
    lawsuit_fee: 'lawsuitFee', lawsuit_filed_at: 'lawsuitFiledAt',
    manager_commission_paid: 'managerCommissionPaid', operator_commission_paid: 'operatorCommissionPaid',
  };

  for (const [pyKey, tsKey] of Object.entries(fieldMap)) {
    if (body[pyKey] !== undefined) updates[tsKey] = body[pyKey];
  }

  // Auto-set timestamps for credit_reported and lawsuit_filed
  if (body.credit_reported !== undefined) {
    if (body.credit_reported && !o.creditReported) {
      if (!body.credit_reported_at) updates.creditReportedAt = nowStr();
    } else if (!body.credit_reported) {
      updates.creditReportedAt = null;
    }
  }
  if (body.lawsuit_filed !== undefined) {
    if (body.lawsuit_filed && !o.lawsuitFiled) {
      if (!body.lawsuit_filed_at) updates.lawsuitFiledAt = nowStr();
    } else if (!body.lawsuit_filed) {
      updates.lawsuitFiledAt = null;
    }
  }

  if (Object.keys(updates).length > 0) {
    await db.update(orders).set(updates).where(eq(orders.id, id));
  }

  // When order_date changes, recalculate due dates for unpaid repayment plans
  if (body.order_date !== undefined && body.order_date !== o.orderDate) {
    const plans = await db.select().from(repaymentPlans)
      .where(eq(repaymentPlans.orderId, id));
    for (const p of plans) {
      if (p.status === '已还' || p.status === '逾期还款') continue;
      const newDue = addDays(body.order_date, p.periodNo);
      await db.update(repaymentPlans).set({ dueDate: newDue })
        .where(eq(repaymentPlans.id, p.id));
    }
  }

  const updated = await db.select().from(orders).where(eq(orders.id, id)).get();

  // Reverse auto-link: when order_date or customer_id changes, re-match warehouse entries
  if (body.order_date !== undefined || body.customer_id !== undefined) {
    await autoLinkWarehouse(db, user.tenantId!, updated!.orderDate, updated!.customerId, updated!.orderNo);
  }

  const cust = await db.select().from(customers).where(eq(customers.id, updated!.customerId)).get();
  return c.json(orderOut(updated, cust?.name || ''));
});

// ── Delete ───────────────────────────────────────────────
ordersRoute.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));
  const db = drizzle(c.env.DB);

  const o = await db.select().from(orders)
    .where(and(eq(orders.id, id), eq(orders.tenantId, user.tenantId!))).get();
  if (!o) return c.json({ detail: '订单不存在' }, 404);

  await db.delete(orders).where(eq(orders.id, id));
  return c.json({ message: '删除成功' });
});

export default ordersRoute;
