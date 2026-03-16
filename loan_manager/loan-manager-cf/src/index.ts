import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { users, tenants } from './db/schema';
import { hashPassword } from './lib/password';
import { updateGoldPriceInDb } from './lib/gold-fetcher';
import { autoSyncOverdue } from './routes/repayments';
import type { Env } from './lib/types';

// Route imports
import auth from './routes/auth';
import settings from './routes/settings';
import customersRoute from './routes/customers';
import ordersRoute from './routes/orders';
import repaymentsRoute from './routes/repayments';
import dashboard from './routes/dashboard';
import warehouse from './routes/warehouse';
import inventoryRoute from './routes/inventory';
import appointmentsRoute from './routes/appointments';
import expensesRoute from './routes/expenses';
import companyInfo from './routes/company-info';
import goldPrice from './routes/gold-price';
import importExcel from './routes/import-excel';
import paymentsRoute from './routes/payments';
import transfersRoute from './routes/transfers';
import overduePoolRoute from './routes/overdue-pool';

const app = new Hono<Env>();

// CORS with preflight cache (86400s = 24h, reduces OPTIONS requests)
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// Strip trailing slashes: /api/customers/ → /api/customers
app.use('*', async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (path !== '/' && path.endsWith('/')) {
    const newUrl = new URL(c.req.url);
    newUrl.pathname = path.replace(/\/+$/, '');
    return c.redirect(newUrl.toString(), 301);
  }
  await next();
});

// Mount routes
app.route('/api/auth', auth);
app.route('/api/settings', settings);
app.route('/api/customers', customersRoute);
app.route('/api/orders', ordersRoute);
app.route('/api/repayments', repaymentsRoute);
app.route('/api/dashboard', dashboard);
app.route('/api/warehouse', warehouse);
app.route('/api/inventory', inventoryRoute);
app.route('/api/appointments', appointmentsRoute);
app.route('/api/expenses', expensesRoute);
app.route('/api/company-info', companyInfo);
app.route('/api/gold-price', goldPrice);
app.route('/api/import', importExcel);
app.route('/api/payments', paymentsRoute);
app.route('/api/transfers', transfersRoute);
app.route('/api/overdue-pool', overduePoolRoute);

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', version: '2.0.0' }));

export default {
  async fetch(request: Request, env: Env['Bindings'], ctx: ExecutionContext) {
    // Ensure default admin exists on first request
    ctx.waitUntil(ensureDefaultAdmin(env.DB));
    return app.fetch(request, env, ctx);
  },

  async scheduled(event: ScheduledEvent, env: Env['Bindings'], ctx: ExecutionContext) {
    ctx.waitUntil(updateGoldPriceInDb(env.DB));
    // Sync overdue repayment plans for all tenants
    ctx.waitUntil((async () => {
      const orm = drizzle(env.DB);
      const allTenants = await orm.select({ id: tenants.id }).from(tenants);
      for (const t of allTenants) {
        await autoSyncOverdue(orm, t.id);
      }
    })());
  },
};

// Create default tenant + admin user if none exists
let _adminChecked = false;
async function ensureDefaultAdmin(db: D1Database) {
  if (_adminChecked) return;
  _adminChecked = true;

  try {
    const orm = drizzle(db);
    // Check if any tenant exists — if so, skip default admin creation
    const anyTenant = await orm.select().from(tenants).get();
    if (!anyTenant) {
      const today = new Date().toISOString().slice(0, 10);
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7);
      const trialEndStr = trialEnd.toISOString().slice(0, 10);

      const tenantResult = await orm.insert(tenants).values({
        name: '默认公司',
        status: 'active',
        plan: 'free_trial',
        trialEndDate: trialEndStr,
        maxUsers: 5,
      }).returning();

      await orm.insert(users).values({
        tenantId: tenantResult[0].id,
        username: 'admin',
        passwordHash: hashPassword('admin123'),
        realName: '管理员',
        role: 'admin',
        isActive: true,
      });

      console.log('Default admin user created');
    }
  } catch (e) {
    console.error('Error creating default admin:', e);
  }
}
