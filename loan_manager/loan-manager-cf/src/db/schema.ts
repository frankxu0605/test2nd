import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── Tenant ─────────────────────────────────────────────
export const tenants = sqliteTable('tenants', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  contactPhone: text('contact_phone').default(''),
  status: text('status').default('active'),           // active, suspended, trial_expired
  plan: text('plan').default('free_trial'),            // free_trial, monthly, yearly
  trialEndDate: text('trial_end_date'),                // YYYY-MM-DD
  subscriptionEndDate: text('subscription_end_date'),  // YYYY-MM-DD
  maxUsers: integer('max_users').default(5),
  createdAt: text('created_at').default(sql`(datetime('now','localtime'))`),
});

// ─── User ───────────────────────────────────────────────
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tenantId: integer('tenant_id').references(() => tenants.id),
  username: text('username').notNull(),                  // unique per tenant, not globally
  passwordHash: text('password_hash').notNull(),
  realName: text('real_name').notNull(),
  email: text('email').default(''),
  phone: text('phone').default(''),
  role: text('role').default('member'),                // superadmin, admin, member
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  tokenVersion: integer('token_version').default(0),   // incremented on each login for single-device enforcement
  createdAt: text('created_at').default(sql`(datetime('now','localtime'))`),
});

// ─── Customer ───────────────────────────────────────────
export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tenantId: integer('tenant_id').references(() => tenants.id),
  customerNo: integer('customer_no').default(0),
  name: text('name').notNull(),
  phone: text('phone').default(''),
  idCard: text('id_card').default(''),
  address: text('address').default(''),
  email: text('email').default(''),
  accountManager: text('account_manager').default(''),
  emergencyContact: text('emergency_contact').default(''),
  hasOverdue: text('has_overdue').default('否'),
  hasProperty: text('has_property').default('否'),
  createdAt: text('created_at').default(sql`(datetime('now','localtime'))`),
});

// ─── Order ──────────────────────────────────────────────
export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tenantId: integer('tenant_id').references(() => tenants.id),
  orderDate: text('order_date').notNull(),             // YYYY-MM-DD
  orderNo: text('order_no').notNull().unique(),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  phone: text('phone').default(''),
  idCard: text('id_card').default(''),
  address: text('address').default(''),
  email: text('email').default(''),
  accountManager: text('account_manager').default(''),
  operator: text('operator').default(''),
  emergencyContact: text('emergency_contact').default(''),
  hasOverdue: text('has_overdue').default('否'),
  hasProperty: text('has_property').default('否'),
  weight: text('weight').default('0.00'),              // DECIMAL as TEXT
  unitPrice: text('unit_price').default('0.00'),
  processingFee: text('processing_fee').default('0.00'),
  notaryFee: text('notary_fee').default('0.00'),
  downPaymentRatio: text('down_payment_ratio').default('0.00'),
  downPayment: text('down_payment').default('0.00'),
  paymentAccount: text('payment_account').default(''),
  installmentPeriods: integer('installment_periods').default(0),
  installmentAmount: text('installment_amount').default('0.00'),
  status: text('status').default('待审核'),
  creditReported: integer('credit_reported', { mode: 'boolean' }).default(false),
  creditReportFee: text('credit_report_fee').default('0.00'),
  creditReportedAt: text('credit_reported_at'),        // datetime
  lawsuitFiled: integer('lawsuit_filed', { mode: 'boolean' }).default(false),
  lawsuitFee: text('lawsuit_fee').default('0.00'),
  lawsuitFiledAt: text('lawsuit_filed_at'),            // datetime
  managerCommissionPaid: integer('manager_commission_paid', { mode: 'boolean' }).default(false),
  operatorCommissionPaid: integer('operator_commission_paid', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`(datetime('now','localtime'))`),
});

// ─── RepaymentPlan ──────────────────────────────────────
export const repaymentPlans = sqliteTable('repayment_plans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tenantId: integer('tenant_id').references(() => tenants.id),
  orderId: integer('order_id').notNull().references(() => orders.id),
  periodNo: integer('period_no').notNull(),
  dueDate: text('due_date').notNull(),                 // YYYY-MM-DD
  principal: text('principal').notNull(),               // DECIMAL as TEXT
  interest: text('interest').notNull(),
  totalAmount: text('total_amount').notNull(),
  paidAmount: text('paid_amount').default('0.00'),
  paidDate: text('paid_date'),                         // YYYY-MM-DD
  paymentAccount: text('payment_account').default(''),
  status: text('status').default('待还'),
});

// ─── WarehouseEntry ─────────────────────────────────────
export const warehouseEntries = sqliteTable('warehouse_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tenantId: integer('tenant_id').references(() => tenants.id),
  itemNo: text('item_no').default(''),
  barcode: text('barcode').default(''),
  weight: text('weight').default('0.00'),
  unitPrice: text('unit_price').default('0.00'),
  totalPrice: text('total_price').default('0.00'),
  entryDate: text('entry_date'),                       // YYYY-MM-DD
  entryOperator: text('entry_operator').default(''),
  exitDate: text('exit_date'),                         // YYYY-MM-DD
  exitOperator: text('exit_operator').default(''),
  buyer: text('buyer').default(''),
  salesperson: text('salesperson').default(''),
  notes: text('notes').default(''),
});

// ─── Inventory ──────────────────────────────────────────
export const inventory = sqliteTable('inventory', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tenantId: integer('tenant_id').references(() => tenants.id),
  itemName: text('item_name').notNull(),
  itemType: text('item_type').default(''),
  quantity: integer('quantity').default(0),
  unitValue: text('unit_value').default('0.00'),
  totalValue: text('total_value').default('0.00'),
  location: text('location').default(''),
  status: text('status').default('在库'),
  lastUpdated: text('last_updated').default(sql`(datetime('now','localtime'))`),
});

// ─── Appointment ────────────────────────────────────────
export const appointments = sqliteTable('appointments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tenantId: integer('tenant_id').references(() => tenants.id),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  phone: text('phone').default(''),
  appointmentDate: text('appointment_date').notNull(),  // YYYY-MM-DD
  appointmentTime: text('appointment_time').notNull(),  // HH:MM:SS
  purpose: text('purpose').default(''),
  status: text('status').default('待确认'),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(datetime('now','localtime'))`),
});

// ─── Expense ────────────────────────────────────────────
export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tenantId: integer('tenant_id').references(() => tenants.id),
  expenseDate: text('expense_date').notNull(),          // YYYY-MM-DD
  purchaseOrderNo: text('purchase_order_no').default(''),
  supplierName: text('supplier_name').default(''),
  supplierPhone: text('supplier_phone').default(''),
  supplierAddress: text('supplier_address').default(''),
  productName: text('product_name').default(''),
  category: text('category').default(''),
  unit: text('unit').default(''),
  quantity: integer('quantity').default(0),
  unitPrice: text('unit_price').default('0.00'),
  totalPrice: text('total_price').default('0.00'),
  receiver: text('receiver').default(''),
  receiverPhone: text('receiver_phone').default(''),
  receiverAddress: text('receiver_address').default(''),
  notes: text('notes').default(''),
  paymentAccount: text('payment_account').default(''),
  createdAt: text('created_at').default(sql`(datetime('now','localtime'))`),
});

// ─── SystemSetting ──────────────────────────────────────
export const systemSettings = sqliteTable('system_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tenantId: integer('tenant_id').references(() => tenants.id),
  key: text('key').notNull(),
  value: text('value').default(''),
});

// ─── GoldPrice (global, no tenant_id) ───────────────────
export const goldPrices = sqliteTable('gold_prices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  priceDate: text('price_date').notNull().unique(),     // YYYY-MM-DD
  buyPrice: text('buy_price').notNull(),                // DECIMAL as TEXT
  sellPrice: text('sell_price').default('0.00'),
  updatedBy: text('updated_by').default(''),
  updatedAt: text('updated_at').default(sql`(datetime('now','localtime'))`),
});

// ─── Subscription ───────────────────────────────────────
export const subscriptions = sqliteTable('subscriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id),
  plan: text('plan').notNull(),                         // monthly, yearly
  amount: text('amount').notNull(),                     // DECIMAL as TEXT
  status: text('status').default('active'),             // active, expired, cancelled
  startDate: text('start_date').notNull(),              // YYYY-MM-DD
  endDate: text('end_date').notNull(),                  // YYYY-MM-DD
  createdAt: text('created_at').default(sql`(datetime('now','localtime'))`),
});

// ─── Payment ────────────────────────────────────────────
export const payments = sqliteTable('payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id),
  subscriptionId: integer('subscription_id').references(() => subscriptions.id),
  amount: text('amount').notNull(),                     // DECIMAL as TEXT
  paymentMethod: text('payment_method').default(''),    // wechat, alipay, manual
  tradeNo: text('trade_no').default(''),
  status: text('status').default('pending'),            // pending, success, failed
  createdAt: text('created_at').default(sql`(datetime('now','localtime'))`),
});

// ─── Supplier ───────────────────────────────────────────
export const suppliers = sqliteTable('suppliers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tenantId: integer('tenant_id').references(() => tenants.id),
  name: text('name').default(''),
  contactPerson: text('contact_person').default(''),
  phone: text('phone').default(''),
  address: text('address').default(''),
});

// ─── StaffMember ────────────────────────────────────────
export const staffMembers = sqliteTable('staff_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tenantId: integer('tenant_id').references(() => tenants.id),
  name: text('name').default(''),
  phone: text('phone').default(''),
});

// ─── PaymentAccount ─────────────────────────────────────
export const paymentAccounts = sqliteTable('payment_accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tenantId: integer('tenant_id').references(() => tenants.id),
  account: text('account').default(''),
  payee: text('payee').default(''),
});

// ─── AccountTransfer ──────────────────────────────────
export const accountTransfers = sqliteTable('account_transfers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tenantId: integer('tenant_id').references(() => tenants.id),
  fromAccount: text('from_account').notNull(),
  toAccount: text('to_account').notNull(),
  amount: text('amount').notNull(),                     // DECIMAL as TEXT
  transferDate: text('transfer_date').notNull(),        // YYYY-MM-DD
  notes: text('notes').default(''),
  createdAt: text('created_at').default(sql`(datetime('now','localtime'))`),
});

// ─── OverdueReports (global pool) ──────────────────────
export const overdueReports = sqliteTable('overdue_reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customerName: text('customer_name').notNull().default(''),
  idCard: text('id_card').default(''),
  phone: text('phone').default(''),
  address: text('address').default(''),
  overdueAmount: text('overdue_amount').default('0'),
  overduePeriods: integer('overdue_periods').default(0),
  overdueDate: text('overdue_date').default(''),
  notes: text('notes').default(''),
  reportedBy: text('reported_by').default(''),
  tenantId: integer('tenant_id').references(() => tenants.id),
  createdAt: text('created_at').default(sql`(datetime('now','localtime'))`),
});

// ─── DeliveryAddress ────────────────────────────────────
export const deliveryAddresses = sqliteTable('delivery_addresses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tenantId: integer('tenant_id').references(() => tenants.id),
  label: text('label').default(''),
  address: text('address').default(''),
});
