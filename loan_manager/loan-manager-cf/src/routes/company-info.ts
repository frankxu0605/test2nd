import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { suppliers, staffMembers, paymentAccounts, deliveryAddresses } from '../db/schema';
import { authMiddleware, activeUserMiddleware, writeProtectMiddleware } from '../middleware/auth';
import type { Env } from '../lib/types';

const companyInfo = new Hono<Env>();
companyInfo.use('*', authMiddleware, activeUserMiddleware, writeProtectMiddleware);

// Generic CRUD factory for simple tenant-scoped tables
function makeCrud(
  table: any,
  outFn: (row: any) => any,
  inFn: (body: any, tenantId: number) => any,
  updateFn: (body: any) => Record<string, any>,
  resourceName: string,
) {
  const sub = new Hono<Env>();

  sub.get('/', async (c) => {
    const user = c.get('user');
    const db = drizzle(c.env.DB);
    const rows = await db.select().from(table).where(eq(table.tenantId, user.tenantId!));
    return c.json(rows.map(outFn));
  });

  sub.post('/', async (c) => {
    const user = c.get('user');
    const body = await c.req.json();
    const db = drizzle(c.env.DB);
    const result = await db.insert(table).values(inFn(body, user.tenantId!)).returning() as any[];
    return c.json(outFn(result[0]));
  });

  sub.put('/:id', async (c) => {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();
    const db = drizzle(c.env.DB);

    const item = await db.select().from(table)
      .where(and(eq(table.id, id), eq(table.tenantId, user.tenantId!))).get();
    if (!item) return c.json({ detail: `${resourceName}不存在` }, 404);

    await db.update(table).set(updateFn(body)).where(eq(table.id, id));
    const updated = await db.select().from(table).where(eq(table.id, id)).get();
    return c.json(outFn(updated));
  });

  sub.delete('/:id', async (c) => {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));
    const db = drizzle(c.env.DB);

    const item = await db.select().from(table)
      .where(and(eq(table.id, id), eq(table.tenantId, user.tenantId!))).get();
    if (!item) return c.json({ detail: `${resourceName}不存在` }, 404);

    await db.delete(table).where(eq(table.id, id));
    return c.json({ message: '删除成功' });
  });

  return sub;
}

// ── Suppliers ────────────────────────────────────────────
const suppliersRoute = makeCrud(
  suppliers,
  (r) => ({ id: r.id, tenant_id: r.tenantId, name: r.name || '', contact_person: r.contactPerson || '', phone: r.phone || '', address: r.address || '' }),
  (b, tid) => ({ tenantId: tid, name: b.name || '', contactPerson: b.contact_person || '', phone: b.phone || '', address: b.address || '' }),
  (b) => ({ name: b.name, contactPerson: b.contact_person, phone: b.phone, address: b.address }),
  '供应商',
);
companyInfo.route('/suppliers', suppliersRoute);

// ── Staff Members ────────────────────────────────────────
const staffRoute = makeCrud(
  staffMembers,
  (r) => ({ id: r.id, tenant_id: r.tenantId, name: r.name || '', phone: r.phone || '' }),
  (b, tid) => ({ tenantId: tid, name: b.name || '', phone: b.phone || '' }),
  (b) => ({ name: b.name, phone: b.phone }),
  '花名册成员',
);
companyInfo.route('/staff', staffRoute);

// ── Payment Accounts ─────────────────────────────────────
const paymentAccountsRoute = makeCrud(
  paymentAccounts,
  (r) => ({ id: r.id, tenant_id: r.tenantId, account: r.account || '', payee: r.payee || '' }),
  (b, tid) => ({ tenantId: tid, account: b.account || '', payee: b.payee || '' }),
  (b) => ({ account: b.account, payee: b.payee }),
  '收款账户',
);
companyInfo.route('/payments', paymentAccountsRoute);

// ── Delivery Addresses ───────────────────────────────────
const addressesRoute = makeCrud(
  deliveryAddresses,
  (r) => ({ id: r.id, tenant_id: r.tenantId, label: r.label || '', address: r.address || '' }),
  (b, tid) => ({ tenantId: tid, label: b.label || '', address: b.address || '' }),
  (b) => ({ label: b.label, address: b.address }),
  '收货地址',
);
companyInfo.route('/addresses', addressesRoute);

export default companyInfo;
