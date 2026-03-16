import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc } from 'drizzle-orm';
import { goldPrices } from '../db/schema';
import { authMiddleware, writeProtectMiddleware } from '../middleware/auth';
import type { Env } from '../lib/types';

const goldPrice = new Hono<Env>();
// Gold price uses authMiddleware only (no subscription check - global data)
goldPrice.use('*', authMiddleware, writeProtectMiddleware);

function todayStr() { return new Date().toISOString().slice(0, 10); }
function nowStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

function priceOut(g: any) {
  return {
    id: g.id,
    price_date: g.priceDate,
    buy_price: g.buyPrice,
    sell_price: g.sellPrice || '0.00',
    updated_by: g.updatedBy || '',
    updated_at: g.updatedAt || '',
  };
}

goldPrice.get('/today', async (c) => {
  const db = drizzle(c.env.DB);
  let record = await db.select().from(goldPrices).where(eq(goldPrices.priceDate, todayStr())).get();
  if (!record) {
    record = await db.select().from(goldPrices).orderBy(desc(goldPrices.priceDate)).get();
  }
  return c.json(record ? priceOut(record) : null);
});

goldPrice.get('/history', async (c) => {
  const limit = parseInt(c.req.query('limit') || '30');
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(goldPrices).orderBy(desc(goldPrices.priceDate)).limit(limit);
  return c.json(rows.map(priceOut));
});

goldPrice.post('/', async (c) => {
  const body = await c.req.json();
  const db = drizzle(c.env.DB);

  const record = await db.select().from(goldPrices).where(eq(goldPrices.priceDate, body.price_date)).get();
  if (record) {
    await db.update(goldPrices).set({
      buyPrice: String(body.buy_price),
      sellPrice: String(body.sell_price || '0.00'),
      updatedBy: body.updated_by || '',
      updatedAt: nowStr(),
    }).where(eq(goldPrices.id, record.id));
    const updated = await db.select().from(goldPrices).where(eq(goldPrices.id, record.id)).get();
    return c.json(priceOut(updated));
  } else {
    const result = await db.insert(goldPrices).values({
      priceDate: body.price_date,
      buyPrice: String(body.buy_price),
      sellPrice: String(body.sell_price || '0.00'),
      updatedBy: body.updated_by || '',
      updatedAt: nowStr(),
    }).returning();
    return c.json(priceOut(result[0]));
  }
});

export default goldPrice;
