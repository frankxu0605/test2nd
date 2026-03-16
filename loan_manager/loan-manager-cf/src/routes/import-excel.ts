import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, like, max, desc, sql } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import { customers, orders, repaymentPlans, warehouseEntries, appointments, expenses } from '../db/schema';
import { authMiddleware, activeUserMiddleware, writeProtectMiddleware } from '../middleware/auth';
import type { Env } from '../lib/types';

const importExcel = new Hono<Env>();
importExcel.use('*', authMiddleware, activeUserMiddleware, writeProtectMiddleware);

function todayStr() { return new Date().toISOString().slice(0, 10); }

const COLUMN_MAPPINGS: Record<string, Record<string, string>> = {
  customers: {
    '客户编号': 'customer_no', '姓名': 'name', '电话': 'phone', '身份证': 'id_card',
    '地址': 'address', '邮箱': 'email', '客户经理': 'account_manager',
    '紧急联系人': 'emergency_contact', '当前逾期': 'has_overdue', '有房产': 'has_property',
  },
  orders: {
    '日期': 'order_date', '订单编号': 'order_no', '客户姓名': 'customer_name_import',
    '电话': 'phone', '身份证': 'id_card', '地址': 'address', '邮箱': 'email',
    '客户经理': 'account_manager', '操作员': 'operator', '紧急联系人': 'emergency_contact',
    '克重': 'weight', '单价': 'unit_price', '加工费': 'processing_fee', '公证费': 'notary_fee',
    '首付比例': 'down_payment_ratio', '首付金额': 'down_payment', '收款账户': 'payment_account',
    '分期期数': 'installment_periods', '每期金额': 'installment_amount', '状态': 'status',
  },
  repayments: {
    '订单ID': 'order_id', '期数': 'period_no', '到期日': 'due_date', '本金': 'principal',
    '利息': 'interest', '应还金额': 'total_amount', '已还金额': 'paid_amount',
    '还款日期': 'paid_date', '收款账户': 'payment_account', '状态': 'status',
  },
  warehouse: {
    '编号': 'item_no', '条码': 'barcode', '克重': 'weight', '单价': 'unit_price',
    '总价': 'total_price', '入库时间': 'entry_date', '入库员': 'entry_operator',
    '出库时间': 'exit_date', '出库员': 'exit_operator', '买家': 'buyer',
    '销售': 'salesperson', '备注': 'notes',
  },
  appointments: {
    '客户ID': 'customer_id', '电话': 'phone', '预约日期': 'appointment_date',
    '预约时间': 'appointment_time', '事由': 'purpose', '状态': 'status', '备注': 'notes',
  },
  expenses: {
    '日期': 'expense_date', '采购单号': 'purchase_order_no', '供应商名称': 'supplier_name',
    '供应商电话': 'supplier_phone', '供应商地址': 'supplier_address', '产品名称': 'product_name',
    '支出类别': 'category', '单位': 'unit', '数量': 'quantity', '单价': 'unit_price',
    '总价': 'total_price', '收货人': 'receiver', '收货电话': 'receiver_phone',
    '收货地址': 'receiver_address', '备注': 'notes', '支出账户': 'payment_account',
  },
};

const REQUIRED_FIELDS: Record<string, string[]> = {
  customers: ['name'],
  orders: ['customer_name_import'],
  repayments: ['order_id', 'period_no', 'due_date', 'principal', 'interest', 'total_amount'],
  warehouse: [],
  appointments: ['customer_id', 'appointment_date', 'appointment_time'],
  expenses: ['expense_date'],
};

const MODULE_TITLES: Record<string, string> = {
  customers: '客户', orders: '订单', repayments: '还款计划',
  warehouse: '入库记录', appointments: '预约', expenses: '支出',
};

const INT_FIELDS = new Set(['customer_id', 'order_id', 'period_no', 'installment_periods', 'quantity', 'customer_no']);
const STR_FIELDS = new Set(['phone', 'id_card', 'barcode', 'item_no', 'order_no', 'purchase_order_no', 'supplier_phone', 'receiver_phone']);

function formatDate(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === 'number') {
    // Excel serial date number
    const d = new Date((val - 25569) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  return String(val);
}

// ── Import endpoint ──────────────────────────────────────
importExcel.post('/:module', async (c) => {
  const module = c.req.param('module');
  if (!COLUMN_MAPPINGS[module]) return c.json({ detail: `不支持的模块: ${module}` }, 400);

  const user = c.get('user');
  const db = drizzle(c.env.DB);
  const tid = user.tenantId!;

  const formData = await c.req.formData();
  const file = formData.get('file') as unknown as File;
  if (!file) return c.json({ detail: '请上传Excel文件' }, 400);
  if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
    return c.json({ detail: '请上传Excel文件(.xlsx)' }, 400);
  }

  const buffer = await file.arrayBuffer();
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  } catch {
    return c.json({ detail: '无法读取Excel文件，请确认格式正确' }, 400);
  }

  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (!rows.length) return c.json({ detail: 'Excel文件为空' }, 400);

  // Build column mapping
  const headers = rows[0];
  const colMap = COLUMN_MAPPINGS[module];
  const reverseMap: Record<number, string> = {};
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || '').trim();
    if (colMap[h]) reverseMap[i] = colMap[h];
  }
  if (!Object.keys(reverseMap).length) {
    return c.json({ detail: '未识别到有效的列标题，请使用正确的模板' }, 400);
  }

  const required = REQUIRED_FIELDS[module];
  const results = { success: 0, total: 0, errors: [] as any[] };

  // Pre-calculate next customer_no
  let nextCno = 1;
  if (module === 'customers') {
    const maxResult = await db.select({ maxNo: max(customers.customerNo) }).from(customers)
      .where(eq(customers.tenantId, tid));
    nextCno = (maxResult[0]?.maxNo || 0) + 1;
  }

  for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    if (!row || row.every((cell: any) => cell === '' || cell === null || cell === undefined)) continue;

    results.total++;
    const rowData: Record<string, any> = {};
    for (const [colIdx, fieldName] of Object.entries(reverseMap)) {
      const val = row[parseInt(colIdx)];
      rowData[fieldName] = val !== undefined && val !== null ? val : '';
    }

    // Check required fields
    const missing = required.filter(f => !rowData[f] && rowData[f] !== 0);
    if (missing.length) {
      const cnNames: Record<string, string> = {};
      for (const [cn, en] of Object.entries(colMap)) cnNames[en] = cn;
      results.errors.push({ row: rowIdx + 1, error: `缺少必填字段: ${missing.map(f => cnNames[f] || f).join(', ')}` });
      continue;
    }

    // Preprocess values
    for (const key of Object.keys(rowData)) {
      if (INT_FIELDS.has(key) && typeof rowData[key] === 'number') rowData[key] = Math.round(rowData[key]);
      if (STR_FIELDS.has(key) && typeof rowData[key] === 'number') rowData[key] = String(Math.round(rowData[key]));
    }

    try {
      if (module === 'customers') {
        if (!rowData.customer_no || rowData.customer_no === 0) {
          rowData.customer_no = nextCno++;
        } else {
          nextCno = Math.max(nextCno, Number(rowData.customer_no) + 1);
        }

        // Upsert by id_card
        if (rowData.id_card) {
          const existing = await db.select().from(customers)
            .where(and(eq(customers.tenantId, tid), eq(customers.idCard, String(rowData.id_card)))).get();
          if (existing) {
            const updates: Record<string, any> = {};
            if (rowData.name) updates.name = String(rowData.name);
            if (rowData.phone) updates.phone = String(rowData.phone);
            if (rowData.address) updates.address = String(rowData.address);
            if (rowData.email) updates.email = String(rowData.email);
            if (rowData.account_manager) updates.accountManager = String(rowData.account_manager);
            if (Object.keys(updates).length > 0) {
              await db.update(customers).set(updates).where(eq(customers.id, existing.id));
            }
            results.success++;
            continue;
          }
        }

        await db.insert(customers).values({
          tenantId: tid, customerNo: rowData.customer_no, name: String(rowData.name || ''),
          phone: String(rowData.phone || ''), idCard: String(rowData.id_card || ''),
          address: String(rowData.address || ''), email: String(rowData.email || ''),
          accountManager: String(rowData.account_manager || ''),
          emergencyContact: String(rowData.emergency_contact || ''),
          hasOverdue: String(rowData.has_overdue || '否'),
          hasProperty: String(rowData.has_property || '否'),
        });
        results.success++;
      } else if (module === 'orders') {
        // Resolve customer name
        const customerName = String(rowData.customer_name_import || '').trim();
        let customerId: number;
        const existingCust = await db.select().from(customers)
          .where(and(eq(customers.tenantId, tid), eq(customers.name, customerName))).get();
        if (existingCust) {
          customerId = existingCust.id;
        } else {
          const newCust = await db.insert(customers).values({
            tenantId: tid, name: customerName, customerNo: nextCno++,
          }).returning();
          customerId = newCust[0].id;
        }

        const orderNo = rowData.order_no || ('ORD' + Date.now() + rowIdx);
        const orderDate = formatDate(rowData.order_date) || todayStr();

        const newOrder = await db.insert(orders).values({
          tenantId: tid, orderDate, orderNo: String(orderNo), customerId,
          phone: String(rowData.phone || ''), idCard: String(rowData.id_card || ''),
          address: String(rowData.address || ''), email: String(rowData.email || ''),
          accountManager: String(rowData.account_manager || ''), operator: String(rowData.operator || ''),
          emergencyContact: String(rowData.emergency_contact || ''),
          weight: String(rowData.weight || '0'), unitPrice: String(rowData.unit_price || '0'),
          processingFee: String(rowData.processing_fee || '0'), notaryFee: String(rowData.notary_fee || '0'),
          downPaymentRatio: String(rowData.down_payment_ratio || '0'), downPayment: String(rowData.down_payment || '0'),
          paymentAccount: String(rowData.payment_account || ''),
          installmentPeriods: Number(rowData.installment_periods) || 0,
          installmentAmount: String(rowData.installment_amount || '0'),
          status: String(rowData.status || '待审核'),
        }).returning();

        // Auto-generate repayment plans
        const order = newOrder[0];
        const periods = order.installmentPeriods || 0;
        const amount = parseFloat(order.installmentAmount || '0');
        if (periods > 0 && amount > 0) {
          for (let i = 1; i <= periods; i++) {
            const d = new Date(order.orderDate);
            d.setDate(d.getDate() + i);
            await db.insert(repaymentPlans).values({
              tenantId: tid, orderId: order.id, periodNo: i,
              dueDate: d.toISOString().slice(0, 10),
              principal: order.installmentAmount || '0.00', interest: '0.00',
              totalAmount: order.installmentAmount || '0.00', paidAmount: '0.00', status: '待还',
            });
          }
        }
        results.success++;
      } else if (module === 'repayments') {
        await db.insert(repaymentPlans).values({
          tenantId: tid, orderId: Number(rowData.order_id), periodNo: Number(rowData.period_no),
          dueDate: formatDate(rowData.due_date) || '', principal: String(rowData.principal || '0'),
          interest: String(rowData.interest || '0'), totalAmount: String(rowData.total_amount || '0'),
          paidAmount: String(rowData.paid_amount || '0'), paidDate: formatDate(rowData.paid_date),
          paymentAccount: String(rowData.payment_account || ''), status: String(rowData.status || '待还'),
        });
        results.success++;
      } else if (module === 'warehouse') {
        await db.insert(warehouseEntries).values({
          tenantId: tid, itemNo: String(rowData.item_no || ''), barcode: String(rowData.barcode || ''),
          weight: String(rowData.weight || '0'), unitPrice: String(rowData.unit_price || '0'),
          totalPrice: String(rowData.total_price || '0'),
          entryDate: formatDate(rowData.entry_date), entryOperator: String(rowData.entry_operator || ''),
          exitDate: formatDate(rowData.exit_date), exitOperator: String(rowData.exit_operator || ''),
          buyer: String(rowData.buyer || ''), salesperson: String(rowData.salesperson || ''),
          notes: String(rowData.notes || ''),
        });
        results.success++;
      } else if (module === 'appointments') {
        await db.insert(appointments).values({
          tenantId: tid, customerId: Number(rowData.customer_id),
          phone: String(rowData.phone || ''),
          appointmentDate: formatDate(rowData.appointment_date) || '',
          appointmentTime: String(rowData.appointment_time || ''),
          purpose: String(rowData.purpose || ''), status: String(rowData.status || '待确认'),
          notes: String(rowData.notes || ''),
        });
        results.success++;
      } else if (module === 'expenses') {
        // Auto-generate purchase_order_no
        let poNo = String(rowData.purchase_order_no || '');
        if (!poNo) {
          const today = todayStr().replace(/-/g, '');
          const prefix = `CG${today}`;
          const last = await db.select().from(expenses)
            .where(and(eq(expenses.tenantId, tid), like(expenses.purchaseOrderNo, `${prefix}%`)))
            .orderBy(desc(expenses.purchaseOrderNo)).get();
          let seq = 1;
          if (last?.purchaseOrderNo) seq = parseInt(last.purchaseOrderNo.slice(-3)) + 1;
          poNo = `${prefix}${String(seq).padStart(3, '0')}`;
        }

        await db.insert(expenses).values({
          tenantId: tid, expenseDate: formatDate(rowData.expense_date) || todayStr(),
          purchaseOrderNo: poNo, supplierName: String(rowData.supplier_name || ''),
          supplierPhone: String(rowData.supplier_phone || ''), supplierAddress: String(rowData.supplier_address || ''),
          productName: String(rowData.product_name || ''), category: String(rowData.category || ''),
          unit: String(rowData.unit || ''), quantity: Number(rowData.quantity) || 0,
          unitPrice: String(rowData.unit_price || '0'), totalPrice: String(rowData.total_price || '0'),
          receiver: String(rowData.receiver || ''), receiverPhone: String(rowData.receiver_phone || ''),
          receiverAddress: String(rowData.receiver_address || ''), notes: String(rowData.notes || ''),
          paymentAccount: String(rowData.payment_account || ''),
        });
        results.success++;
      }
    } catch (e: any) {
      results.errors.push({ row: rowIdx + 1, error: e.message || String(e) });
    }
  }

  return c.json(results);
});

// ── Template download ────────────────────────────────────
importExcel.get('/:module/template', (c) => {
  const module = c.req.param('module');
  if (!COLUMN_MAPPINGS[module]) return c.json({ detail: `不支持的模块: ${module}` }, 400);

  const colMap = COLUMN_MAPPINGS[module];
  const headers = Object.keys(colMap);
  const title = MODULE_TITLES[module] || module;

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  XLSX.utils.book_append_sheet(wb, ws, title);

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const filename = encodeURIComponent(`${title}导入模板.xlsx`);

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
    },
  });
});

export default importExcel;
