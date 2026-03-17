/**
 * Dashboard page renderer.
 */
const DashboardPage = {
    render(container) {
        container.innerHTML = `
            <div class="gold-banner" id="gold-banner">
                <div class="gold-banner-top">
                    <span class="gold-banner-title">Au · 今日黄金价格</span>
                    <span class="gold-banner-date" id="gold-date">--</span>
                    <span class="gold-banner-date" id="gold-source" style="margin-left:8px;"></span>
                </div>
                <div class="gold-banner-prices">
                    <div class="gold-left-wrap">
                        <div>
                            <span class="gold-buy-price" id="gold-buy">¥--</span>
                            <span class="gold-buy-unit">/g</span>
                        </div>
                        <div class="gold-sell-inline">
                            <span class="gold-sell-label">回收价</span>
                            <span class="gold-sell-price" id="gold-sell">¥--/g</span>
                        </div>
                    </div>
                    <div style="margin-left:auto;" class="gold-sell-wrap">
                        <div class="gold-retail-label">建议售价</div>
                        <div class="gold-retail-price" id="gold-retail">¥-- /g</div>
                    </div>
                </div>
                ${this._isMember() ? '' : `<div class="gold-update-row">
                    <input type="number" step="0.01" placeholder="买入价" id="gold-buy-input">
                    <input type="number" step="0.01" placeholder="回收价" id="gold-sell-input">
                    <button class="btn-gold-update" id="btn-gold-update">更新金价</button>
                </div>`}
            </div>

            <div class="section-title">业务概览</div>
            <div class="stat-grid" id="stat-grid"></div>

            <div class="section-title">财务汇总</div>
            <div id="finance-section"></div>
        `;

        const btnGold = document.getElementById('btn-gold-update');
        if (btnGold) btnGold.onclick = () => this.updateGoldPrice();
        this.loadData();

        // Auto-refresh every 60 seconds
        if (this._refreshTimer) clearInterval(this._refreshTimer);
        this._refreshTimer = setInterval(() => this.loadData(), 60000);
    },

    stop() {
        if (this._refreshTimer) {
            clearInterval(this._refreshTimer);
            this._refreshTimer = null;
        }
    },

    _fmt(n) {
        return Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 });
    },

    _isMember() {
        return API.userInfo && API.userInfo.role === 'member';
    },

    _escHtml(s) {
        const d = document.createElement('div');
        d.textContent = s || '';
        return d.innerHTML;
    },

    async loadData() {
        // Skip if dashboard DOM elements no longer exist
        if (!document.getElementById('stat-grid')) return;
        try {
            const data = await API.dashboard();
            // Gold price
            const gp = data.gold_price;
            if (gp) {
                const buyPrice = Number(gp.buy_price);
                const sellPrice = Number(gp.sell_price);
                const retailPrice = (buyPrice * 1.03 * 1.2).toFixed(2);
                document.getElementById('gold-buy').textContent = `¥${buyPrice.toFixed(2)}`;
                document.getElementById('gold-sell').textContent = `¥${sellPrice.toFixed(2)}/g`;
                document.getElementById('gold-retail').textContent = `¥${retailPrice} /g`;
                document.getElementById('gold-date').textContent = `更新: ${gp.price_date}`;
                const src = gp.updated_by === '自动获取' ? '🔄 实时自动' : (gp.updated_by ? `✏️ ${gp.updated_by}` : '');
                document.getElementById('gold-source').textContent = src;
            } else {
                document.getElementById('gold-buy').textContent = '暂无报价';
                document.getElementById('gold-sell').textContent = '--';
                document.getElementById('gold-retail').textContent = '--';
                document.getElementById('gold-date').textContent = '请设置今日金价';
                document.getElementById('gold-source').textContent = '';
            }

            // Stat cards
            const stats = [
                { title: '客户总数', value: data.customer_count, unit: '人', bg: 'linear-gradient(135deg, #4e6aff, #7b8cff)' },
                { title: '订单总数', value: data.order_count, unit: '笔', bg: 'linear-gradient(135deg, #00c48c, #4dd9a8)' },
                { title: '在贷订单', value: data.active_orders, unit: '笔', bg: 'linear-gradient(135deg, #ff9f43, #ffb976)' },
                { title: '逾期笔数', value: data.overdue_count, unit: '笔', bg: 'linear-gradient(135deg, #ff6b6b, #ff9292)' },
                { title: '在库物品', value: data.inventory_count, unit: '件', bg: 'linear-gradient(135deg, #6c5ce7, #a29bfe)' },
                { title: '待处理预约', value: data.pending_appointments, unit: '个', bg: 'linear-gradient(135deg, #00b4d8, #48cae4)' },
            ];
            const grid = document.getElementById('stat-grid');
            grid.innerHTML = stats.map(s => `
                <div class="stat-card" style="background:${s.bg}">
                    <div class="stat-card-title">${s.title}</div>
                    <div><span class="stat-card-value">${s.value}</span><span class="stat-card-unit">${s.unit}</span></div>
                </div>
            `).join('');

            // Daily todos - add as 7th stat card
            const todos = data.daily_todos || [];
            this._dailyTodos = todos;
            const todoCount = todos.length;
            grid.innerHTML += `
                <div class="stat-card" id="stat-daily-todo" style="background:linear-gradient(135deg, #e53935, #ff6b6b);cursor:pointer;">
                    <div class="stat-card-title">今日待办</div>
                    <div><span class="stat-card-value">${todoCount}</span><span class="stat-card-unit">笔</span></div>
                </div>
            `;
            document.getElementById('stat-daily-todo').onclick = () => this.showDailyTodoModal();

            // Finance detail section
            const inc = data.income || {};
            const exp = data.expense || {};
            const totalIncome = Number(inc.total || 0);
            const totalExpense = Number(exp.total || 0);
            const netProfit = totalIncome - totalExpense;

            const cats = exp.categories || {};
            const catLabels = {
                '办公类': '办公类支出', '成本类': '成本类支出', '借支类': '借支类支出',
                '工资类': '工资类支出', '分红类': '分红类支出', '投资类': '投资类支出',
            };
            const catOrder = ['办公类', '工资类', '成本类', '借支类', '分红类', '投资类'];
            const expenseRows = catOrder
                .map(c => `<div class="fd-row"><span class="fd-row-label">${catLabels[c]}</span><span class="fd-row-value">¥${this._fmt(cats[c])}</span></div>`)
                .join('');

            const acctRows = data.account_summary || [];

            const rp = data.repayment || {};
            const rpRate = rp.rate || 0;
            const rpColor = rpRate >= 80 ? '#67c23a' : rpRate >= 50 ? '#e6a23c' : '#ff4757';

            const fin = document.getElementById('finance-section');
            fin.innerHTML = `
                <div class="finance-net-row" style="display:flex;gap:16px;">
                    <div class="finance-net-card" style="flex:1;">
                        <div class="fd-title">净利润</div>
                        <div class="fd-total" style="color:${netProfit >= 0 ? '#67c23a' : '#ff4757'}">¥${this._fmt(netProfit)}</div>
                    </div>
                    <div class="finance-net-card" style="flex:1;">
                        <div class="fd-title">回款率</div>
                        <div class="fd-total" style="color:${rpColor}">${rpRate}%</div>
                        <div style="font-size:12px;color:#999;margin-top:4px;">¥${this._fmt(rp.received)} / ¥${this._fmt(rp.order_total)}</div>
                    </div>
                </div>
                <div class="finance-detail-grid" style="margin-bottom:16px;">
                    <div class="finance-detail-card" style="grid-column:1/-1;">
                        <div class="fd-header">
                            <span class="fd-title">账户余额</span>
                            <span class="fd-total" style="color:#67c23a">¥${this._fmt(acctRows.reduce((s, a) => s + a.total, 0))}</span>
                        </div>
                        ${acctRows.map(a => `<div class="fd-row"><span class="fd-row-label">${this._escHtml(a.account)}</span><span class="fd-row-value" style="color:${a.total >= 0 ? '#67c23a' : '#ff4757'}">¥${this._fmt(a.total)}</span></div>`).join('')}
                        ${acctRows.length === 0 ? '<div class="fd-row"><span class="fd-row-label" style="color:#999">暂无收款记录</span></div>' : ''}
                        ${this._isMember() ? '' : `<div style="margin-top:10px;text-align:center;">
                            <button id="btn-transfer" style="padding:6px 18px;border:none;border-radius:6px;background:#409eff;color:#fff;font-size:13px;cursor:pointer;">记录转账</button>
                            <button id="btn-transfer-history" style="padding:6px 18px;border:none;border-radius:6px;background:#e6e6e6;color:#333;font-size:13px;cursor:pointer;margin-left:8px;">转账记录</button>
                        </div>`}
                    </div>
                </div>
                <div class="finance-detail-grid">
                    <div class="finance-detail-card">
                        <div class="fd-header">
                            <span class="fd-title">收入明细</span>
                            <span class="fd-total" style="color:#67c23a">¥${this._fmt(totalIncome)}</span>
                        </div>
                        <div class="fd-row">
                            <span class="fd-row-label">期初投资款</span>
                            <span class="fd-row-value">
                                <span id="invest-display">¥${this._fmt(inc.initial_investment)}</span>
                                ${this._isMember() ? '' : `<span class="initial-invest-row" id="invest-edit" style="display:none;">
                                    <input type="number" step="0.01" id="invest-input" value="${Number(inc.initial_investment || 0)}">
                                    <select id="invest-account-input" style="font-size:12px;padding:2px 4px;border:1px solid #ddd;border-radius:4px;">
                                        <option value="">选择账户</option>
                                        ${CompanyInfo.paymentOptions().map(o => `<option value="${this._escHtml(o)}" ${inc.initial_investment_account === o ? 'selected' : ''}>${this._escHtml(o)}</option>`).join('')}
                                    </select>
                                    <button id="invest-save">保存</button>
                                </span>
                                <span id="invest-edit-btn" style="cursor:pointer;margin-left:6px;color:#409eff;font-size:12px;">编辑</span>`}
                                ${inc.initial_investment_account ? `<span style="color:#999;font-size:12px;margin-left:6px;">(${this._escHtml(inc.initial_investment_account)})</span>` : ''}
                            </span>
                        </div>
                        <div class="fd-row"><span class="fd-row-label">首付与分期款总额</span><span class="fd-row-value">¥${this._fmt(inc.payment_total)}</span></div>
                        <div class="fd-row"><span class="fd-row-label">公证费总额</span><span class="fd-row-value">¥${this._fmt(inc.notary_fee_total)}</span></div>
                        <div class="fd-row"><span class="fd-row-label">征信费收入</span><span class="fd-row-value">¥${this._fmt(inc.credit_report_fee_total)}</span></div>
                        <div class="fd-row"><span class="fd-row-label">诉讼费收入</span><span class="fd-row-value">¥${this._fmt(inc.lawsuit_fee_total)}</span></div>
                    </div>
                    <div class="finance-detail-card">
                        <div class="fd-header">
                            <span class="fd-title">支出明细</span>
                            <span class="fd-total" style="color:#ff4757">¥${this._fmt(totalExpense)}</span>
                        </div>
                        ${expenseRows}
                        <div class="fd-row"><span class="fd-row-label">入库总价</span><span class="fd-row-value">¥${this._fmt(exp.warehouse_total)}</span></div>
                    </div>
                </div>
            `;

            // Invest edit toggle
            const editBtn = document.getElementById('invest-edit-btn');
            const editRow = document.getElementById('invest-edit');
            const displayEl = document.getElementById('invest-display');
            if (editBtn) {
                editBtn.onclick = () => {
                    editRow.style.display = '';
                    displayEl.style.display = 'none';
                    editBtn.style.display = 'none';
                };
            }
            const saveBtn = document.getElementById('invest-save');
            if (saveBtn) {
                saveBtn.onclick = async () => {
                    const val = document.getElementById('invest-input').value.trim();
                    const acc = document.getElementById('invest-account-input').value;
                    try {
                        await API._request('PUT', '/api/settings/initial_investment', { value: val || '0' });
                        await API._request('PUT', '/api/settings/initial_investment_account', { value: acc || '' });
                        Toast.show('期初投资款已更新', 'success');
                        this.loadData();
                    } catch (e) {
                        Toast.show('保存失败: ' + e.message, 'error');
                    }
                };
            }
            // Transfer buttons
            const btnTransfer = document.getElementById('btn-transfer');
            if (btnTransfer) btnTransfer.onclick = () => this.showTransferModal(acctRows);
            const btnHistory = document.getElementById('btn-transfer-history');
            if (btnHistory) btnHistory.onclick = () => this.showTransferHistory();
        } catch (e) {
            Toast.show('加载仪表盘失败: ' + e.message, 'error');
        }
    },

    showDailyTodoModal() {
        const allTodos = (this._dailyTodos || []).slice().sort((a, b) => a.customer_name.localeCompare(b.customer_name, 'zh') || a.due_date.localeCompare(b.due_date));
        if (!allTodos.length) {
            Toast.show('今日无待收款项', 'info');
            return;
        }
        const isMember = this._isMember();
        const todayStr = new Date().toISOString().slice(0, 10);
        const accountOpts = CompanyInfo.paymentOptions().map(o => `<option value="${this._escHtml(o)}">`).join('');
        const self = this;

        const renderRows = (items) => {
            const tbody = document.getElementById('todo-tbody');
            if (!tbody) return;
            const totalDue = items.reduce((s, t) => s + t.total_amount, 0);
            document.getElementById('todo-summary').textContent = `待收 ${items.length} 笔 · 应收合计 ¥${self._fmt(totalDue)}`;
            tbody.innerHTML = items.map(t => {
                const isOverdue = t.due_date < todayStr;
                const rowStyle = isOverdue ? 'background:#fff5f5;' : '';
                if (isMember) {
                    return `<tr style="${rowStyle}">
                        <td>${self._escHtml(t.customer_name)}</td>
                        <td>${t.period_no}</td>
                        <td style="${isOverdue ? 'color:#ff4757;font-weight:600;' : ''}">${t.due_date}</td>
                        <td>${t.total_amount}</td>
                        <td>${t.paid_amount || ''}</td>
                        <td></td><td></td>
                    </tr>`;
                }
                return `<tr data-id="${t.id}" style="${rowStyle}">
                    <td>${self._escHtml(t.customer_name)}</td>
                    <td>${t.period_no}</td>
                    <td class="todo-due-date" style="${isOverdue ? 'color:#ff4757;font-weight:600;' : ''}">${t.due_date}</td>
                    <td class="todo-total">${t.total_amount}</td>
                    <td><input type="number" step="0.01" class="todo-paid" value="${t.paid_amount || ''}" style="width:80px;"></td>
                    <td><input type="text" class="todo-paid-date" value="" style="width:110px;" maxlength="10" placeholder="YYYY-MM-DD"></td>
                    <td><select class="todo-account" style="width:120px;"><option value="">--</option>${CompanyInfo.paymentOptions().map(o => `<option value="${self._escHtml(o)}">${self._escHtml(o)}</option>`).join('')}</select></td>
                </tr>`;
            }).join('');
            if (!isMember) {
                tbody.querySelectorAll('.todo-paid-date').forEach(el => {
                    el.addEventListener('input', function () {
                        const pos = this.selectionStart;
                        const before = this.value;
                        const digits = before.replace(/[^\d]/g, '').slice(0, 8);
                        let f = '';
                        if (digits.length > 6) f = digits.slice(0, 4) + '-' + digits.slice(4, 6) + '-' + digits.slice(6);
                        else if (digits.length > 4) f = digits.slice(0, 4) + '-' + digits.slice(4);
                        else f = digits;
                        this.value = f;
                        const np = pos + (f.length - before.length);
                        this.setSelectionRange(Math.max(0, np), Math.max(0, np));
                    });
                });
            }
        };

        let html = `<div id="todo-wrap">
            <div style="margin-bottom:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                <input type="text" id="todo-search" placeholder="搜索姓名..." style="padding:6px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;width:180px;">
                <span id="todo-summary" style="color:#666;font-size:13px;"></span>
            </div>
            ${isMember ? '' : `<div style="margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn btn-sm btn-primary" id="todo-batch-fill">全部一键还清</button>
                <button class="btn btn-sm btn-secondary" id="todo-batch-due">全部填入到期日</button>
                <button class="btn btn-sm btn-secondary" id="todo-batch-amount">全部填入应还</button>
                <select id="todo-batch-account-input" style="width:140px;padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px;"><option value="">选择账户</option>${CompanyInfo.paymentOptions().map(o => `<option value="${self._escHtml(o)}">${self._escHtml(o)}</option>`).join('')}</select>
                <button class="btn btn-sm btn-secondary" id="todo-batch-account">批量填入账户</button>
            </div>`}
            <table class="data-table" id="todo-table" style="font-size:13px;">
            <thead><tr><th>姓名</th><th>期数</th><th>到期日</th><th>应还</th><th>已还金额</th><th>还款日期</th><th>收款账户</th></tr></thead>
            <tbody id="todo-tbody"></tbody></table>
            <datalist id="todo-account-list">${accountOpts}</datalist>
        </div>`;

        const saveCallback = isMember ? null : async () => {
            const rows = document.querySelectorAll('#todo-table tbody tr');
            try {
                const updates = [];
                for (const tr of rows) {
                    const paid = tr.querySelector('.todo-paid')?.value;
                    const paidDate = tr.querySelector('.todo-paid-date')?.value;
                    const account = tr.querySelector('.todo-account')?.value;
                    if (!paid && !paidDate && !account) continue;
                    const dueDate = tr.querySelector('.todo-due-date').textContent;
                    const paidNum = parseFloat(paid) || 0;
                    let status = '待还';
                    if (paidNum > 0 && paidDate) {
                        status = (paidDate > dueDate) ? '逾期还款' : '已还';
                    } else if (dueDate < todayStr) {
                        status = '逾期未还';
                    }
                    updates.push({
                        id: parseInt(tr.dataset.id),
                        paid_amount: paidNum,
                        paid_date: paidDate || null,
                        payment_account: account || '',
                        status: status,
                    });
                }
                if (updates.length === 0) {
                    Toast.show('没有需要保存的数据', 'info');
                    return;
                }
                await API.put('/api/repayments/batch', updates);
                Toast.show('保存成功，已同步到还款明细', 'success');
                Modal.close();
                this.loadData();
            } catch (e) { Toast.show('保存失败: ' + e.message, 'error'); }
        };

        Modal.open('今日待办 - 待收款项', html, saveCallback);
        renderRows(allTodos);

        // Search filter
        document.getElementById('todo-search').addEventListener('input', function () {
            const kw = this.value.trim().toLowerCase();
            const filtered = kw ? allTodos.filter(t => t.customer_name.toLowerCase().includes(kw)) : allTodos;
            renderRows(filtered);
        });

        if (!isMember) {
            const getVisibleRows = () => document.querySelectorAll('#todo-table tbody tr');
            document.getElementById('todo-batch-fill').onclick = () => {
                getVisibleRows().forEach(tr => {
                    tr.querySelector('.todo-paid').value = tr.querySelector('.todo-total').textContent;
                    tr.querySelector('.todo-paid-date').value = tr.querySelector('.todo-due-date').textContent;
                });
            };
            document.getElementById('todo-batch-due').onclick = () => {
                getVisibleRows().forEach(tr => {
                    tr.querySelector('.todo-paid-date').value = tr.querySelector('.todo-due-date').textContent;
                });
            };
            document.getElementById('todo-batch-amount').onclick = () => {
                getVisibleRows().forEach(tr => {
                    tr.querySelector('.todo-paid').value = tr.querySelector('.todo-total').textContent;
                });
            };
            document.getElementById('todo-batch-account').onclick = () => {
                const val = document.getElementById('todo-batch-account-input').value;
                if (!val) return;
                getVisibleRows().forEach(tr => {
                    tr.querySelector('.todo-account').value = val;
                });
            };
        }
    },

    showTransferModal(acctRows) {
        const allAccounts = CompanyInfo.paymentOptions();
        const options = allAccounts.map(a => `<option value="${this._escHtml(a)}">`).join('');
        const now = new Date();
        const nowStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0') + 'T' + String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal" style="max-width:400px;">
                <div class="modal-header">记录转账<span class="modal-close">&times;</span></div>
                <div style="padding:16px;display:flex;flex-direction:column;gap:12px;">
                    <div><label style="font-size:13px;color:#666;">转出账户</label>
                        <input type="text" id="tf-from" list="tf-acct-list" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;margin-top:4px;" placeholder="选择或输入账户">
                    </div>
                    <div><label style="font-size:13px;color:#666;">转入账户</label>
                        <input type="text" id="tf-to" list="tf-acct-list" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;margin-top:4px;" placeholder="选择或输入账户">
                    </div>
                    <div><label style="font-size:13px;color:#666;">金额</label>
                        <input type="number" step="0.01" id="tf-amount" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;margin-top:4px;" placeholder="转账金额">
                    </div>
                    <div><label style="font-size:13px;color:#666;">时间</label>
                        <input type="datetime-local" id="tf-date" value="${nowStr}" max="9999-12-31T23:59" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;margin-top:4px;">
                    </div>
                    <div><label style="font-size:13px;color:#666;">备注</label>
                        <input type="text" id="tf-notes" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;margin-top:4px;" placeholder="可选">
                    </div>
                    <button id="tf-save" style="padding:10px;border:none;border-radius:6px;background:#409eff;color:#fff;font-size:14px;cursor:pointer;">确认转账</button>
                </div>
                <datalist id="tf-acct-list">${options}</datalist>
            </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('.modal-close').onclick = () => overlay.remove();
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        document.getElementById('tf-save').onclick = async () => {
            const from = document.getElementById('tf-from').value.trim();
            const to = document.getElementById('tf-to').value.trim();
            const amount = document.getElementById('tf-amount').value.trim();
            const date = document.getElementById('tf-date').value;
            const notes = document.getElementById('tf-notes').value.trim();
            if (!from || !to || !amount) { Toast.show('请填写转出/转入账户和金额', 'error'); return; }
            if (from === to) { Toast.show('转出和转入账户不能相同', 'error'); return; }
            try {
                const dt = date.includes('T') ? date.replace('T', ' ') : date;
                await API.transfersCreate({ from_account: from, to_account: to, amount: parseFloat(amount), transfer_date: dt, notes });
                Toast.show('转账记录已保存', 'success');
                overlay.remove();
                this.loadData();
            } catch (e) {
                Toast.show('保存失败: ' + e.message, 'error');
            }
        };
    },

    async showTransferHistory() {
        try {
            const list = await API.transfersList();
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            const totalAmt = list.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
            const tbody = list.length === 0
                ? '<tr><td colspan="6" style="text-align:center;color:#999;padding:24px;">暂无转账记录</td></tr>'
                : list.map((t, i) => `<tr style="background:${i % 2 === 0 ? '#fff' : '#fafbfc'};">
                    <td style="padding:10px 8px;white-space:nowrap;color:#666;">${this._escHtml(t.transferDate || t.transfer_date)}</td>
                    <td style="padding:10px 8px;"><span style="background:#fff1f0;color:#ff4757;padding:2px 8px;border-radius:4px;font-size:12px;">${this._escHtml(t.fromAccount || t.from_account)}</span></td>
                    <td style="padding:10px 8px;"><span style="background:#f0f9eb;color:#67c23a;padding:2px 8px;border-radius:4px;font-size:12px;">${this._escHtml(t.toAccount || t.to_account)}</span></td>
                    <td style="padding:10px 8px;text-align:right;font-weight:600;color:#409eff;font-size:14px;">¥${this._fmt(t.amount)}</td>
                    <td style="padding:10px 8px;color:#999;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this._escHtml(t.notes || '-')}</td>
                    <td style="padding:10px 4px;text-align:center;"><span class="tf-del" data-id="${t.id}" style="cursor:pointer;color:#ccc;font-size:18px;transition:color .2s;" onmouseover="this.style.color='#ff4757'" onmouseout="this.style.color='#ccc'">&times;</span></td>
                </tr>`).join('');
            overlay.innerHTML = `
                <div class="modal" style="max-width:720px;max-height:85vh;">
                    <div class="modal-header" style="padding:16px 20px;">
                        <span style="font-size:16px;font-weight:600;">转账记录</span>
                        <span style="font-size:13px;color:#999;margin-left:12px;">共 ${list.length} 笔，合计 ¥${this._fmt(totalAmt)}</span>
                        <span class="modal-close">&times;</span>
                    </div>
                    <div style="padding:0 12px 12px;overflow-y:auto;max-height:65vh;">
                        <table style="width:100%;border-collapse:collapse;font-size:13px;">
                            <thead><tr style="background:#f5f7fa;position:sticky;top:0;">
                                <th style="padding:10px 8px;text-align:left;font-weight:500;color:#666;">时间</th>
                                <th style="padding:10px 8px;text-align:left;font-weight:500;color:#666;">转出账户</th>
                                <th style="padding:10px 8px;text-align:left;font-weight:500;color:#666;">转入账户</th>
                                <th style="padding:10px 8px;text-align:right;font-weight:500;color:#666;">金额</th>
                                <th style="padding:10px 8px;text-align:left;font-weight:500;color:#666;">备注</th>
                                <th style="padding:10px 4px;width:32px;"></th>
                            </tr></thead>
                            <tbody>${tbody}</tbody>
                        </table>
                    </div>
                </div>`;
            document.body.appendChild(overlay);
            overlay.querySelector('.modal-close').onclick = () => overlay.remove();
            overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
            overlay.querySelectorAll('.tf-del').forEach(btn => {
                btn.onclick = async () => {
                    if (!confirm('确认删除此转账记录？')) return;
                    try {
                        await API.transfersDelete(btn.dataset.id);
                        Toast.show('已删除', 'success');
                        overlay.remove();
                        this.loadData();
                    } catch (e) {
                        Toast.show('删除失败: ' + e.message, 'error');
                    }
                };
            });
        } catch (e) {
            Toast.show('加载转账记录失败: ' + e.message, 'error');
        }
    },

    async updateGoldPrice() {
        const buy = document.getElementById('gold-buy-input').value.trim();
        const sell = document.getElementById('gold-sell-input').value.trim();
        if (!buy) { Toast.show('请输入买入价', 'error'); return; }
        try {
            const today = new Date().toISOString().slice(0, 10);
            await API.setGoldPrice({
                price_date: today,
                buy_price: parseFloat(buy),
                sell_price: sell ? parseFloat(sell) : 0,
                updated_by: API.userInfo.real_name || '',
            });
            document.getElementById('gold-buy-input').value = '';
            document.getElementById('gold-sell-input').value = '';
            Toast.show('金价更新成功', 'success');
            this.loadData();
        } catch (e) {
            Toast.show('更新失败: ' + e.message, 'error');
        }
    }
};
