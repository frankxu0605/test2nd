import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { appointments, customers } from '../db/schema';
import { authMiddleware, activeUserMiddleware, writeProtectMiddleware } from '../middleware/auth';
import type { Env } from '../lib/types';

const appointmentsRoute = new Hono<Env>();
appointmentsRoute.use('*', authMiddleware, activeUserMiddleware, writeProtectMiddleware);

function apptOut(a: any, customerName = '') {
  return {
    id: a.id, tenant_id: a.tenantId, customer_id: a.customerId,
    phone: a.phone || '', appointment_date: a.appointmentDate,
    appointment_time: a.appointmentTime, purpose: a.purpose || '',
    status: a.status || '待确认', notes: a.notes || '',
    created_at: a.createdAt || '', customer_name: customerName,
  };
}

appointmentsRoute.get('/', async (c) => {
  const user = c.get('user');
  const status = c.req.query('status') || '';
  const skip = parseInt(c.req.query('skip') || '0');
  const limit = parseInt(c.req.query('limit') || '100');
  const db = drizzle(c.env.DB);

  const conditions: any[] = [eq(appointments.tenantId, user.tenantId!)];
  if (status) conditions.push(eq(appointments.status, status));

  const rows = await db.select().from(appointments).where(and(...conditions))
    .orderBy(desc(appointments.appointmentDate)).offset(skip).limit(limit);

  // Batch load customer names
  const cids = [...new Set(rows.map(r => r.customerId))];
  const cmap: Record<number, string> = {};
  if (cids.length > 0) {
    const custs = await db.select().from(customers).where(inArray(customers.id, cids));
    custs.forEach(c => { cmap[c.id] = c.name; });
  }

  return c.json(rows.map(a => apptOut(a, cmap[a.customerId] || '')));
});

appointmentsRoute.get('/count', async (c) => {
  const user = c.get('user');
  const status = c.req.query('status') || '';
  const db = drizzle(c.env.DB);

  const conditions: any[] = [eq(appointments.tenantId, user.tenantId!)];
  if (status) conditions.push(eq(appointments.status, status));

  const result = await db.select({ count: sql<number>`count(*)` }).from(appointments).where(and(...conditions));
  return c.json({ count: result[0]?.count || 0 });
});

appointmentsRoute.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const db = drizzle(c.env.DB);

  const result = await db.insert(appointments).values({
    tenantId: user.tenantId,
    customerId: body.customer_id,
    phone: body.phone || '',
    appointmentDate: body.appointment_date,
    appointmentTime: body.appointment_time,
    purpose: body.purpose || '',
    status: body.status || '待确认',
    notes: body.notes || '',
  }).returning();

  const cust = await db.select().from(customers).where(eq(customers.id, result[0].customerId)).get();
  return c.json(apptOut(result[0], cust?.name || ''));
});

appointmentsRoute.put('/:id', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));
  const body = await c.req.json();
  const db = drizzle(c.env.DB);

  const appt = await db.select().from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.tenantId, user.tenantId!))).get();
  if (!appt) return c.json({ detail: '预约记录不存在' }, 404);

  const updates: Record<string, any> = {};
  if (body.customer_id !== undefined) updates.customerId = body.customer_id;
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.appointment_date !== undefined) updates.appointmentDate = body.appointment_date;
  if (body.appointment_time !== undefined) updates.appointmentTime = body.appointment_time;
  if (body.purpose !== undefined) updates.purpose = body.purpose;
  if (body.status !== undefined) updates.status = body.status;
  if (body.notes !== undefined) updates.notes = body.notes;

  await db.update(appointments).set(updates).where(eq(appointments.id, id));
  const updated = await db.select().from(appointments).where(eq(appointments.id, id)).get();
  const cust = await db.select().from(customers).where(eq(customers.id, updated!.customerId)).get();
  return c.json(apptOut(updated, cust?.name || ''));
});

appointmentsRoute.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));
  const db = drizzle(c.env.DB);

  const appt = await db.select().from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.tenantId, user.tenantId!))).get();
  if (!appt) return c.json({ detail: '预约记录不存在' }, 404);

  await db.delete(appointments).where(eq(appointments.id, id));
  return c.json({ message: '删除成功' });
});

export default appointmentsRoute;
