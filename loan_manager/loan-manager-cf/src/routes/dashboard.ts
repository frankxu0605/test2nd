import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, sql, inArray, desc, lte } from 'drizzle-orm';
import { customers, orders, repaymentPlans, warehouseEntries, appointments, expenses, goldPrices, systemSettings, accountTransfers } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { autoSyncOverdue } from './repayments';
import type { Env } from '../lib/types';

const dashboard = new Hono<Env>();
dashboard.use('*', authMiddleware);

function todayStr() { return new Date().toISOString().slice(0, 10); }

dashboard.get('/', async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);
  const tid = user.tenantId!;

  await autoSyncOverdue(db, tid);

  // Stat counts
  const [customerCount] = await db.select({ count: sql<number>`count(*)` }).from(customers).where(eq(customers.tenantId, tid));
  const [orderCount] = await db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.tenantId, tid));
  const [activeOrders] = await db.select({ count: sql<number>`count(*)` }).from(orders)
    .where(and(eq(orders.tenantId, tid), inArray(orders.status, ['已通过', '逾期'])));
  const [overdueCount] = await db.select({ count: sql<number>`count(*)` }).from(orders)
    .where(and(eq(orders.tenantId, tid), eq(orders.status, '逾期')));
  const [inventoryCount] = await db.select({ count: sql<number>`count(*)` }).from(warehouseEntries)
    .where(and(eq(warehouseEntries.tenantId, tid), sql`${warehouseEntries.exitDate} IS NULL`));
  const [pendingAppts] = await db.select({ count: sql<number>`count(*)` }).from(appointments)
    .where(and(eq(appointments.tenantId, tid), inArray(appointments.status, ['待确认', '已确认'])));

  // Income breakdown
  const investSetting = await db.select().from(systemSettings)
    .where(and(eq(systemSettings.tenantId, tid), eq(systemSettings.key, 'initial_investment'))).get();
  const initialInvestment = investSetting?.value ? parseFloat(investSetting.value) : 0;
  const investAccountSetting = await db.select().from(systemSettings)
    .where(and(eq(systemSettings.tenantId, tid), eq(systemSettings.key, 'initial_investment_account'))).get();
  const initialInvestmentAccount = investAccountSetting?.value || '';

  const [downPaymentSum] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(${orders.downPayment} AS REAL)), 0)` })
    .from(orders).where(eq(orders.tenantId, tid));
  const [repaidSum] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(${repaymentPlans.paidAmount} AS REAL)), 0)` })
    .from(repaymentPlans).where(eq(repaymentPlans.tenantId, tid));
  const paymentTotal = (downPaymentSum?.total || 0) + (repaidSum?.total || 0);

  const [orderTotalSum] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(${orders.downPayment} AS REAL) + CAST(${orders.installmentAmount} AS REAL) * ${orders.installmentPeriods}), 0)` })
    .from(orders).where(eq(orders.tenantId, tid));
  const orderTotal = orderTotalSum?.total || 0;

  const [notarySum] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(${orders.notaryFee} AS REAL)), 0)` })
    .from(orders).where(eq(orders.tenantId, tid));
  const [creditFeeSum] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(${orders.creditReportFee} AS REAL)), 0)` })
    .from(orders).where(eq(orders.tenantId, tid));
  const [lawsuitFeeSum] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(${orders.lawsuitFee} AS REAL)), 0)` })
    .from(orders).where(eq(orders.tenantId, tid));

  const notaryFeeTotal = notarySum?.total || 0;
  const creditReportFeeTotal = creditFeeSum?.total || 0;
  const lawsuitFeeTotal = lawsuitFeeSum?.total || 0;
  const totalIncome = initialInvestment + paymentTotal + notaryFeeTotal + creditReportFeeTotal + lawsuitFeeTotal;

  // Expense breakdown by category
  const expenseByCat = await db.select({
    category: expenses.category,
    total: sql<number>`SUM(CAST(${expenses.totalPrice} AS REAL))`,
  }).from(expenses).where(eq(expenses.tenantId, tid)).groupBy(expenses.category);

  const expenseCategories: Record<string, number> = {};
  for (const row of expenseByCat) {
    if (row.category) expenseCategories[row.category] = row.total || 0;
  }

  const [warehouseSum] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(${warehouseEntries.totalPrice} AS REAL)), 0)` })
    .from(warehouseEntries).where(eq(warehouseEntries.tenantId, tid));
  const warehouseTotal = warehouseSum?.total || 0;
  const totalExpense = Object.values(expenseCategories).reduce((a, b) => a + b, 0) + warehouseTotal;

  // Account summary: aggregate by payment_account from orders (down_payment) + repayment_plans (paid_amount)
  const ordersByAccount = await db.select({
    account: orders.paymentAccount,
    total: sql<number>`COALESCE(SUM(CAST(${orders.downPayment} AS REAL) + CAST(${orders.notaryFee} AS REAL)), 0)`,
  }).from(orders)
    .where(and(eq(orders.tenantId, tid), sql`${orders.paymentAccount} IS NOT NULL AND ${orders.paymentAccount} != ''`))
    .groupBy(orders.paymentAccount);

  const repayByAccount = await db.select({
    account: repaymentPlans.paymentAccount,
    total: sql<number>`COALESCE(SUM(CAST(${repaymentPlans.paidAmount} AS REAL)), 0)`,
  }).from(repaymentPlans)
    .where(and(eq(repaymentPlans.tenantId, tid), sql`${repaymentPlans.paymentAccount} IS NOT NULL AND ${repaymentPlans.paymentAccount} != ''`))
    .groupBy(repaymentPlans.paymentAccount);

  // Transfers: aggregate out/in per account
  const transferOut = await db.select({
    account: accountTransfers.fromAccount,
    total: sql<number>`COALESCE(SUM(CAST(${accountTransfers.amount} AS REAL)), 0)`,
  }).from(accountTransfers)
    .where(eq(accountTransfers.tenantId, tid))
    .groupBy(accountTransfers.fromAccount);

  const transferIn = await db.select({
    account: accountTransfers.toAccount,
    total: sql<number>`COALESCE(SUM(CAST(${accountTransfers.amount} AS REAL)), 0)`,
  }).from(accountTransfers)
    .where(eq(accountTransfers.tenantId, tid))
    .groupBy(accountTransfers.toAccount);

  // Expenses by payment_account
  const expenseByAccount = await db.select({
    account: expenses.paymentAccount,
    total: sql<number>`COALESCE(SUM(CAST(${expenses.totalPrice} AS REAL)), 0)`,
  }).from(expenses)
    .where(eq(expenses.tenantId, tid))
    .groupBy(expenses.paymentAccount);

  const accountMap: Record<string, number> = {};
  // Add initial investment to its account
  if (initialInvestment && initialInvestmentAccount) {
    accountMap[initialInvestmentAccount] = (accountMap[initialInvestmentAccount] || 0) + initialInvestment;
  }
  for (const r of ordersByAccount) {
    if (r.account) accountMap[r.account] = (accountMap[r.account] || 0) + (r.total || 0);
  }
  for (const r of repayByAccount) {
    if (r.account) accountMap[r.account] = (accountMap[r.account] || 0) + (r.total || 0);
  }
  for (const r of transferOut) {
    if (r.account) accountMap[r.account] = (accountMap[r.account] || 0) - (r.total || 0);
  }
  for (const r of transferIn) {
    if (r.account) accountMap[r.account] = (accountMap[r.account] || 0) + (r.total || 0);
  }
  // Add notary/credit/lawsuit fees to 建行 公账
  accountMap['建行 公账'] = (accountMap['建行 公账'] || 0) + creditReportFeeTotal + lawsuitFeeTotal;
  // Deduct expenses by their payment_account (default to 建行 公账 if not set)
  for (const r of expenseByAccount) {
    const acct = r.account || '建行 公账';
    accountMap[acct] = (accountMap[acct] || 0) - (r.total || 0);
  }
  // Deduct warehouse total from 建行 公账
  accountMap['建行 公账'] = (accountMap['建行 公账'] || 0) - warehouseTotal;
  const accountSummary = Object.entries(accountMap)
    .map(([account, total]) => ({ account, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total);

  // Gold price (global)
  const today = todayStr();
  let gold = await db.select().from(goldPrices).where(eq(goldPrices.priceDate, today)).get();
  if (!gold) {
    gold = await db.select().from(goldPrices).orderBy(desc(goldPrices.priceDate)).get();
  }

  let goldInfo = null;
  if (gold) {
    goldInfo = {
      price_date: gold.priceDate,
      buy_price: parseFloat(gold.buyPrice),
      sell_price: parseFloat(gold.sellPrice || '0'),
      updated_by: gold.updatedBy || '',
      updated_at: gold.updatedAt || '',
    };
  }

  // Daily pending collections: unpaid plans where due_date <= today
  const pendingPlans = await db.select({
    id: repaymentPlans.id,
    orderId: repaymentPlans.orderId,
    periodNo: repaymentPlans.periodNo,
    dueDate: repaymentPlans.dueDate,
    totalAmount: repaymentPlans.totalAmount,
    paidAmount: repaymentPlans.paidAmount,
    status: repaymentPlans.status,
    orderNo: orders.orderNo,
    customerId: orders.customerId,
    phone: orders.phone,
    paymentAccount: orders.paymentAccount,
  }).from(repaymentPlans)
    .innerJoin(orders, eq(repaymentPlans.orderId, orders.id))
    .where(and(
      eq(repaymentPlans.tenantId, tid),
      lte(repaymentPlans.dueDate, today),
      sql`${repaymentPlans.status} NOT IN ('已还', '逾期还款')`,
    ))
    .orderBy(repaymentPlans.dueDate, repaymentPlans.orderId, repaymentPlans.periodNo);

  // Batch load customer names for pending plans
  const pendingCids = [...new Set(pendingPlans.map(p => p.customerId).filter(Boolean))];
  const pendingCmap: Record<number, string> = {};
  if (pendingCids.length > 0) {
    const pCusts = await db.select().from(customers).where(inArray(customers.id, pendingCids));
    pCusts.forEach(c2 => { pendingCmap[c2.id] = c2.name; });
  }

  const dailyTodos = pendingPlans.map(p => ({
    id: p.id,
    order_no: p.orderNo,
    customer_name: pendingCmap[p.customerId] || '',
    phone: p.phone || '',
    period_no: p.periodNo,
    due_date: p.dueDate,
    total_amount: parseFloat(p.totalAmount),
    paid_amount: parseFloat(p.paidAmount || '0'),
    status: p.status,
  }));

  return c.json({
    customer_count: customerCount?.count || 0,
    order_count: orderCount?.count || 0,
    active_orders: activeOrders?.count || 0,
    overdue_count: overdueCount?.count || 0,
    inventory_count: inventoryCount?.count || 0,
    pending_appointments: pendingAppts?.count || 0,
    income: {
      initial_investment: initialInvestment,
      initial_investment_account: initialInvestmentAccount,
      payment_total: paymentTotal,
      notary_fee_total: notaryFeeTotal,
      credit_report_fee_total: creditReportFeeTotal,
      lawsuit_fee_total: lawsuitFeeTotal,
      total: totalIncome,
    },
    expense: {
      categories: expenseCategories,
      warehouse_total: warehouseTotal,
      total: totalExpense,
    },
    repayment: {
      received: paymentTotal,
      order_total: orderTotal,
      rate: orderTotal > 0 ? Math.round(paymentTotal / orderTotal * 10000) / 100 : 0,
    },
    gold_price: goldInfo,
    account_summary: accountSummary,
    daily_todos: dailyTodos,
  });
});

export default dashboard;
