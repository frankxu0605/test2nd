/**
 * Auto-fetch real-time gold price from Eastmoney (东方财富).
 * Used by Cloudflare Cron Trigger.
 */

interface GoldPriceData {
  buyPrice: number;
  sellPrice: number;
  latest: number;
  source: string;
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

async function fetchEastmoneyAU9999(): Promise<GoldPriceData | null> {
  const url =
    'https://push2.eastmoney.com/api/qt/clist/get?' +
    'pn=1&pz=30&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:118' +
    '&fields=f2,f12,f14,f15,f16,f17,f18';

  const resp = await fetch(url, { headers: HEADERS });
  const data = await resp.json() as any;

  const items = data?.data?.diff || [];
  for (const target of ['AU9999', 'AUTD']) {
    for (const item of items) {
      if (item.f12 === target) {
        const latest = item.f2;
        if (latest && latest !== '-' && parseFloat(latest) > 0) {
          const price = parseFloat(latest);
          const name = item.f14 || target;
          return {
            buyPrice: price,
            sellPrice: Math.round(price * 0.98 * 100) / 100,
            latest: price,
            source: `上海金交所${name}`,
          };
        }
      }
    }
  }
  return null;
}

async function fetchSinaGold(): Promise<GoldPriceData | null> {
  const url = `https://hq.sinajs.cn/rn=${Date.now()}&list=au_td`;
  const resp = await fetch(url, {
    headers: { ...HEADERS, Referer: 'https://finance.sina.com.cn' },
  });
  const text = await resp.text();

  const match = text.match(/hq_str_au_td="(.+?)"/);
  if (!match) return null;

  const parts = match[1].split(',');
  if (parts.length >= 8) {
    const buyPrice = parseFloat(parts[5]);
    const sellPrice = parseFloat(parts[6]);
    const latest = parseFloat(parts[7]);
    if (buyPrice > 0) {
      return { buyPrice, sellPrice, latest, source: '新浪Au(T+D)' };
    }
  }
  return null;
}

export async function fetchGoldPrice(): Promise<GoldPriceData | null> {
  try {
    const data = await fetchEastmoneyAU9999();
    if (data) return data;
  } catch (e) {
    console.warn('Eastmoney fetch failed:', e);
  }

  try {
    const data = await fetchSinaGold();
    if (data) return data;
  } catch (e) {
    console.warn('Sina fetch failed:', e);
  }

  return null;
}

export async function updateGoldPriceInDb(db: D1Database): Promise<void> {
  const { drizzle } = await import('drizzle-orm/d1');
  const { goldPrices } = await import('../db/schema');
  const { eq } = await import('drizzle-orm');

  try {
    const data = await fetchGoldPrice();
    if (!data) {
      console.warn('All gold price sources failed, skipping update');
      return;
    }

    const orm = drizzle(db);
    const today = new Date().toISOString().slice(0, 10);
    const record = await orm.select().from(goldPrices).where(eq(goldPrices.priceDate, today)).get();

    // Only auto-update if not manually set today
    if (record && record.updatedBy && record.updatedBy !== '自动获取') {
      console.log("Today's price was manually set, skipping auto-update");
      return;
    }

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    if (record) {
      await orm.update(goldPrices).set({
        buyPrice: String(data.buyPrice),
        sellPrice: String(data.sellPrice),
        updatedBy: '自动获取',
        updatedAt: now,
      }).where(eq(goldPrices.id, record.id));
    } else {
      await orm.insert(goldPrices).values({
        priceDate: today,
        buyPrice: String(data.buyPrice),
        sellPrice: String(data.sellPrice),
        updatedBy: '自动获取',
        updatedAt: now,
      });
    }
    console.log(`Gold price auto-updated: buy=${data.buyPrice}, sell=${data.sellPrice} (${data.source})`);
  } catch (e) {
    console.error('Error in auto gold price update:', e);
  }
}
