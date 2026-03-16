/**
 * Main application: login, registration, routing, sidebar, team management, subscription.
 */
const App = {
    currentPage: 'dashboard',

    init() {
        this.bindLogin();
        this.bindRegister();
        this.bindSidebar();
        this.bindModal();
        this.bindLogout();
        this.bindCustomerOverview();
        this.bindSidebarCommission();
        this.bindOnlineService();
        this.setDate();
        // Restore previous session if token still valid
        if (API.restoreSession()) {
            this.enterApp();
        }
    },

    setDate() {
        const d = new Date();
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        document.getElementById('date-display').textContent = ds;
    },

    // ===== Login =====
    bindLogin() {
        document.getElementById('login-form').onsubmit = (e) => {
            e.preventDefault();
            this.doLogin();
        };
        document.getElementById('login-btn').onclick = () => this.doLogin();
    },

    async doLogin() {
        const server = 'https://api.hjfq.club';
        const companyName = document.getElementById('login-company').value.trim();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const errEl = document.getElementById('login-error');
        errEl.textContent = '';

        if (!companyName || !username || !password) {
            errEl.textContent = '请填写公司名称、用户名和密码';
            return;
        }

        try {
            await API.login(server, username, password, companyName);
            this.enterApp();
        } catch (e) {
            errEl.textContent = '登录失败: ' + e.message;
        }
    },

    // ===== Register =====
    bindRegister() {
        const showReg = document.getElementById('show-register');
        const showLog = document.getElementById('show-login');
        if (showReg) {
            showReg.onclick = (e) => {
                e.preventDefault();
                document.getElementById('login-form').style.display = 'none';
                document.getElementById('register-form').style.display = 'block';
                document.getElementById('login-subtitle').textContent = '注册新公司账号';
            };
        }
        if (showLog) {
            showLog.onclick = (e) => {
                e.preventDefault();
                document.getElementById('register-form').style.display = 'none';
                document.getElementById('login-form').style.display = 'block';
                document.getElementById('login-subtitle').textContent = '请登录您的账户';
            };
        }

        const regForm = document.getElementById('register-form');
        const regBtn = document.getElementById('register-btn');
        if (regForm) {
            regForm.onsubmit = (e) => { e.preventDefault(); this.doRegister(); };
        }
        if (regBtn) {
            regBtn.onclick = () => this.doRegister();
        }
    },

    async doRegister() {
        const errEl = document.getElementById('register-error');
        errEl.textContent = '';

        const company = document.getElementById('reg-company').value.trim();
        const realname = document.getElementById('reg-realname').value.trim();
        const phone = document.getElementById('reg-phone').value.trim();
        const username = document.getElementById('reg-username').value.trim();
        const password = document.getElementById('reg-password').value;

        if (!company || !realname || !username || !password) {
            errEl.textContent = '请填写公司名称、姓名、用户名和密码';
            return;
        }

        try {
            API.baseUrl = 'https://api.hjfq.club';
            await API.registerCompany({
                company_name: company,
                username: username,
                password: password,
                real_name: realname,
                phone: phone,
            });
            Toast.show('注册成功！', 'success');
            this.enterApp();
        } catch (e) {
            errEl.textContent = '注册失败: ' + e.message;
        }
    },

    // ===== Enter App After Login/Register =====
    enterApp() {
        const name = API.userInfo.real_name || API.userInfo.username;
        document.getElementById('user-name').textContent = name;
        document.getElementById('user-avatar').textContent = name.charAt(0);

        // Show tenant name in topbar (clickable to open company info)
        if (API.tenantInfo) {
            const el = document.getElementById('topbar-tenant');
            el.textContent = API.tenantInfo.name;
            el.classList.add('topbar-tenant-btn');
            el.onclick = () => CompanyInfo.open();
        }

        // Show admin-only nav items
        const isAdmin = API.userInfo.role === 'admin' || API.userInfo.role === 'superadmin';
        const teamNav = document.getElementById('nav-team');
        const subNav = document.getElementById('nav-subscription');
        if (teamNav) teamNav.style.display = isAdmin ? 'flex' : 'none';
        if (subNav) subNav.style.display = isAdmin ? 'flex' : 'none';

        // Show trial banner if applicable
        this.updateTrialBanner();

        // Show main app
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';
        // Preload company reference data into cache (non-blocking)
        CompanyInfo.preload();
        this.navigateTo('dashboard');
    },

    updateTrialBanner() {
        const banner = document.getElementById('trial-banner');
        const text = document.getElementById('trial-banner-text');
        if (!banner || !API.tenantInfo) { if (banner) banner.style.display = 'none'; return; }

        const t = API.tenantInfo;
        if (t.plan === 'free_trial' && t.trial_end_date) {
            const endDate = new Date(t.trial_end_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
            if (daysLeft > 0) {
                text.textContent = `免费试用中，剩余 ${daysLeft} 天（到期日：${t.trial_end_date}）`;
                banner.style.display = 'block';
                banner.className = 'trial-banner trial';
            } else {
                text.textContent = '免费试用已到期，请订阅以继续使用';
                banner.style.display = 'block';
                banner.className = 'trial-banner expired';
            }
        } else if (t.plan !== 'free_trial' && t.subscription_end_date) {
            const endDate = new Date(t.subscription_end_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
            if (daysLeft <= 7 && daysLeft > 0) {
                text.textContent = `订阅即将到期，剩余 ${daysLeft} 天`;
                banner.style.display = 'block';
                banner.className = 'trial-banner warning';
            } else {
                banner.style.display = 'none';
            }
        } else {
            banner.style.display = 'none';
        }
    },

    // ===== 402 Handler =====
    showSubscriptionExpired(msg) {
        Toast.show(msg || '订阅已到期，请续费', 'error');
    },

    // ===== 401 Handler =====
    handleUnauthorized() {
        API.clearSession();
        document.getElementById('main-app').style.display = 'none';
        document.getElementById('login-page').style.display = 'flex';
        document.getElementById('login-error').textContent = '登录已过期，请重新登录';
    },

    // ===== Sidebar =====
    bindSidebar() {
        document.querySelectorAll('.nav-item').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                const page = el.dataset.page;
                if (page) {
                    this.navigateTo(page);
                    document.getElementById('sidebar').classList.remove('open');
                }
            });
        });
        document.getElementById('menu-toggle').onclick = () => {
            document.getElementById('sidebar').classList.toggle('open');
        };
    },

    navigateTo(page) {
        this.currentPage = page;
        // Update active nav
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.page === page);
        });

        // Page titles
        const titles = {
            dashboard: '首页',
            customers: '客户管理',
            orders: '订单管理',
            repayments: '还款计划',
            warehouse: '入库管理',
            inventory: '库存管理',
            appointments: '预约管理',
            expenses: '支出明细',
            overduePool: '逾期公共池',
            team: '团队管理',
            subscription: '订阅管理',
        };
        document.getElementById('page-title').textContent = titles[page] || page;

        // Stop dashboard timer when leaving
        DashboardPage.stop();

        const container = document.getElementById('page-content');
        if (page === 'dashboard') {
            DashboardPage.render(container);
        } else if (page === 'team') {
            this.renderTeamPage(container);
        } else if (page === 'subscription') {
            this.renderSubscriptionPage(container);
        } else if (PAGE_CONFIGS[page]) {
            CrudPage.render(container, PAGE_CONFIGS[page]);
        }
    },

    // ===== Team Management Page =====
    async renderTeamPage(container) {
        container.innerHTML = `
            <div class="team-page">
                <div class="team-header">
                    <h3>团队成员</h3>
                    <button class="btn btn-primary" id="btn-add-member">+ 添加成员</button>
                </div>
                <div class="table-wrap">
                    <table class="data-table" id="team-table">
                        <thead>
                            <tr>
                                <th>用户名</th><th>姓名</th><th>手机号</th><th>邮箱</th><th>角色</th><th>状态</th><th>操作</th>
                            </tr>
                        </thead>
                        <tbody id="team-tbody"></tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('btn-add-member').onclick = () => this.openTeamMemberModal();
        this.loadTeamMembers();
    },

    async loadTeamMembers() {
        try {
            const members = await API.getTeam();
            const tbody = document.getElementById('team-tbody');
            if (!tbody) return;
            const roleLabels = { admin: '管理员', member: '成员' };
            tbody.innerHTML = members.map(m => `
                <tr>
                    <td>${m.username}</td>
                    <td>${m.real_name}</td>
                    <td>${m.phone || '-'}</td>
                    <td>${m.email || '-'}</td>
                    <td><span class="status-badge ${m.role === 'admin' ? 'blue' : 'gray'}">${roleLabels[m.role] || m.role}</span></td>
                    <td><span class="status-badge ${m.is_active ? 'green' : 'red'}">${m.is_active ? '正常' : '已禁用'}</span></td>
                    <td class="actions">
                        ${m.id !== API.userInfo.id ? `<button class="btn btn-sm btn-danger" onclick="App.removeTeamMember(${m.id}, '${m.real_name}')">移除</button>` : '<span style="color:#999">自己</span>'}
                    </td>
                </tr>
            `).join('');
        } catch (e) {
            Toast.show('加载团队失败: ' + e.message, 'error');
        }
    },

    openTeamMemberModal() {
        const html = `
            <div class="form-row">
                <div class="form-group">
                    <label>用户名</label>
                    <input type="text" id="tm-username" placeholder="登录用户名">
                </div>
                <div class="form-group">
                    <label>密码</label>
                    <input type="password" id="tm-password" placeholder="登录密码">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>姓名</label>
                    <input type="text" id="tm-realname" placeholder="真实姓名">
                </div>
                <div class="form-group">
                    <label>手机号</label>
                    <input type="text" id="tm-phone" placeholder="手机号">
                </div>
            </div>
            <div class="form-group">
                <label>角色</label>
                <select id="tm-role">
                    <option value="member">成员</option>
                    <option value="admin">管理员</option>
                </select>
            </div>
        `;
        Modal.open('添加团队成员', html, async () => {
            const data = {
                username: document.getElementById('tm-username').value.trim(),
                password: document.getElementById('tm-password').value,
                real_name: document.getElementById('tm-realname').value.trim(),
                phone: document.getElementById('tm-phone').value.trim(),
                role: document.getElementById('tm-role').value,
            };
            if (!data.username || !data.password || !data.real_name) {
                Toast.show('请填写用户名、密码和姓名', 'error');
                return;
            }
            try {
                await API.addTeamMember(data);
                Toast.show('添加成功', 'success');
                Modal.close();
                this.loadTeamMembers();
            } catch (e) {
                Toast.show('添加失败: ' + e.message, 'error');
            }
        });
    },

    async removeTeamMember(id, name) {
        Confirm.show(`确定移除成员「${name}」吗？`, async () => {
            try {
                await API.removeTeamMember(id);
                Toast.show('已移除', 'success');
                Confirm.close();
                this.loadTeamMembers();
            } catch (e) {
                Toast.show('移除失败: ' + e.message, 'error');
            }
        });
    },

    // ===== Subscription Page =====
    _paymentPollTimer: null,

    async renderSubscriptionPage(container) {
        container.innerHTML = '<div class="subscription-page"><p style="color:#888;">加载中...</p></div>';
        if (this._paymentPollTimer) { clearInterval(this._paymentPollTimer); this._paymentPollTimer = null; }

        // Superadmin: show admin panel only
        if (API.userInfo.role === 'superadmin') {
            container.innerHTML = `
                <div class="subscription-page">
                    <div class="sub-card">
                        <h3>收款配置</h3>
                        <p style="color:#888;font-size:13px;margin-bottom:16px;">上传微信和支付宝的收款二维码，用户订阅时将展示此二维码</p>
                        <div class="qr-config-grid">
                            <div class="qr-config-item">
                                <div class="qr-config-label" style="color:#07c160;font-weight:600;">微信收款码</div>
                                <div class="qr-config-preview" id="qr-preview-wechat"></div>
                                <label class="btn btn-secondary qr-upload-btn">选择图片 <input type="file" accept="image/*" id="qr-upload-wechat" style="display:none;"></label>
                            </div>
                            <div class="qr-config-item">
                                <div class="qr-config-label" style="color:#1677ff;font-weight:600;">支付宝收款码</div>
                                <div class="qr-config-preview" id="qr-preview-alipay"></div>
                                <label class="btn btn-secondary qr-upload-btn">选择图片 <input type="file" accept="image/*" id="qr-upload-alipay" style="display:none;"></label>
                            </div>
                        </div>
                    </div>
                    <div class="sub-card" style="margin-top:24px;">
                        <h3>待确认支付</h3>
                        <div id="pending-payments-list"><p style="color:#888;">加载中...</p></div>
                    </div>
                </div>`;
            this._loadQRConfig();
            this._loadPendingPayments();
            document.getElementById('qr-upload-wechat')?.addEventListener('change', (e) => this._handleQRUpload('wechat', e));
            document.getElementById('qr-upload-alipay')?.addEventListener('change', (e) => this._handleQRUpload('alipay', e));
            return;
        }

        try {
            const tenant = await API.getTenantInfo();
            let invoices = [];
            try { invoices = await API.getInvoices(); } catch(e) { /* ignore */ }

            const planLabels = { free_trial: '免费试用', monthly: '月付套餐', yearly: '年付套餐' };
            const statusLabels = { active: '正常', suspended: '已暂停', trial_expired: '试用到期' };
            const methodLabels = { wechat: '微信支付', alipay: '支付宝' };
            const statusColors = { pending: '#e6a23c', success: '#67c23a', failed: '#f56c6c' };
            const statusTexts = { pending: '待支付', success: '已支付', failed: '已失效' };

            let endDateStr = '-', daysLeft = '-';
            if (tenant.plan === 'free_trial' && tenant.trial_end_date) {
                endDateStr = tenant.trial_end_date;
                const end = new Date(tenant.trial_end_date);
                const today = new Date(); today.setHours(0,0,0,0);
                const d = Math.ceil((end - today) / (1000*60*60*24));
                daysLeft = d < 0 ? '已过期' : d + '天';
            } else if (tenant.subscription_end_date) {
                endDateStr = tenant.subscription_end_date;
                const end = new Date(tenant.subscription_end_date);
                const today = new Date(); today.setHours(0,0,0,0);
                const d = Math.ceil((end - today) / (1000*60*60*24));
                daysLeft = d < 0 ? '已过期' : d + '天';
            }

            const invoiceRows = invoices.map(inv => `
                <tr class="invoice-row" data-id="${inv.id}">
                    <td>${inv.invoice_no}</td>
                    <td>${inv.plan_label}</td>
                    <td style="font-weight:600;">¥${inv.amount}</td>
                    <td>${methodLabels[inv.payment_method] || inv.payment_method || '-'}</td>
                    <td><span class="inv-status" style="color:${statusColors[inv.status] || '#999'};font-weight:600;">${statusTexts[inv.status] || inv.status}</span></td>
                    <td>${inv.created_at}</td>
                </tr>
                <tr class="invoice-detail" id="inv-detail-${inv.id}" style="display:none;">
                    <td colspan="6">
                        <div class="inv-detail-wrap">
                            <div class="inv-detail-row"><span class="inv-dl">账单编号</span><span>${inv.invoice_no}</span></div>
                            <div class="inv-detail-row"><span class="inv-dl">套餐类型</span><span>${inv.plan_label}</span></div>
                            <div class="inv-detail-row"><span class="inv-dl">金额</span><span style="font-weight:700;color:#3366ff;">¥${inv.amount}</span></div>
                            <div class="inv-detail-row"><span class="inv-dl">支付方式</span><span>${methodLabels[inv.payment_method] || inv.payment_method || '-'}</span></div>
                            <div class="inv-detail-row"><span class="inv-dl">交易号</span><span>${inv.trade_no || '-'}</span></div>
                            <div class="inv-detail-row"><span class="inv-dl">状态</span><span style="color:${statusColors[inv.status]};font-weight:600;">${statusTexts[inv.status] || inv.status}</span></div>
                            <div class="inv-detail-row"><span class="inv-dl">创建时间</span><span>${inv.created_at}</span></div>
                            ${inv.subscription_start ? `<div class="inv-detail-row"><span class="inv-dl">订阅周期</span><span>${inv.subscription_start} ~ ${inv.subscription_end}</span></div>` : ''}
                        </div>
                    </td>
                </tr>
            `).join('');

            container.innerHTML = `
                <div class="subscription-page">
                    <div class="sub-card">
                        <h3>当前套餐</h3>
                        <div class="sub-info-grid">
                            <div class="sub-row"><span class="sub-label">公司名称</span><span class="sub-value">${tenant.name}</span></div>
                            <div class="sub-row"><span class="sub-label">当前套餐</span><span class="sub-value">${planLabels[tenant.plan] || tenant.plan}</span></div>
                            <div class="sub-row"><span class="sub-label">账户状态</span><span class="sub-value">${statusLabels[tenant.status] || tenant.status}</span></div>
                            <div class="sub-row"><span class="sub-label">到期日期</span><span class="sub-value">${endDateStr}</span></div>
                            <div class="sub-row"><span class="sub-label">剩余时间</span><span class="sub-value">${daysLeft}</span></div>
                            <div class="sub-row"><span class="sub-label">最大成员数</span><span class="sub-value">${tenant.max_users}人</span></div>
                        </div>
                    </div>
                    <div class="sub-plans">
                        <h3>升级 / 续费</h3>
                        <div class="sub-plans-grid">
                            <div class="sub-plan-card">
                                <div class="sub-plan-name">月付套餐</div>
                                <div class="sub-plan-price">¥99<span>/月</span></div>
                                <ul class="sub-plan-features">
                                    <li>全部功能</li>
                                    <li>最多5个成员</li>
                                    <li>数据云端存储</li>
                                </ul>
                                <button class="btn btn-primary btn-subscribe" data-plan="monthly">立即订阅</button>
                            </div>
                            <div class="sub-plan-card recommended">
                                <div class="sub-plan-badge">推荐</div>
                                <div class="sub-plan-name">年付套餐</div>
                                <div class="sub-plan-price">¥999<span>/年</span></div>
                                <ul class="sub-plan-features">
                                    <li>全部功能</li>
                                    <li>最多5个成员</li>
                                    <li>数据云端存储</li>
                                    <li>节省 ¥189</li>
                                </ul>
                                <button class="btn btn-primary btn-subscribe" data-plan="yearly">立即订阅</button>
                            </div>
                        </div>
                    </div>
                    <div class="sub-card" style="margin-top:24px;">
                        <h3>账单记录</h3>
                        ${invoices.length ? `
                        <div class="table-scroll">
                            <table class="data-table invoice-table">
                                <thead><tr><th>账单编号</th><th>套餐</th><th>金额</th><th>支付方式</th><th>状态</th><th>时间</th></tr></thead>
                                <tbody>${invoiceRows}</tbody>
                            </table>
                        </div>` : '<p style="color:#888;text-align:center;padding:20px 0;">暂无账单记录</p>'}
                    </div>
                </div>`;

            // Bind subscribe buttons
            container.querySelectorAll('.btn-subscribe').forEach(btn => {
                btn.onclick = () => this.showPaymentMethodModal(btn.dataset.plan);
            });
            // Bind invoice row toggle
            container.querySelectorAll('.invoice-row').forEach(row => {
                row.style.cursor = 'pointer';
                row.onclick = () => {
                    const detail = document.getElementById('inv-detail-' + row.dataset.id);
                    if (detail) detail.style.display = detail.style.display === 'none' ? '' : 'none';
                };
            });
        } catch (e) {
            container.innerHTML = `<div class="subscription-page"><p style="color:red;">加载失败: ${e.message}</p></div>`;
        }
    },

    async _loadQRConfig() {
        try {
            const config = await API.getPaymentQRConfig();
            const wechatEl = document.getElementById('qr-preview-wechat');
            const alipayEl = document.getElementById('qr-preview-alipay');
            if (wechatEl) {
                wechatEl.innerHTML = config.wechat_qr
                    ? `<img src="${config.wechat_qr}" alt="微信收款码">`
                    : '<span style="color:#ccc;">未上传</span>';
            }
            if (alipayEl) {
                alipayEl.innerHTML = config.alipay_qr
                    ? `<img src="${config.alipay_qr}" alt="支付宝收款码">`
                    : '<span style="color:#ccc;">未上传</span>';
            }
        } catch (e) { /* ignore */ }
    },

    async _handleQRUpload(method, event) {
        const file = event.target.files[0];
        if (!file) return;
        try {
            await API.uploadPaymentQR(method, file);
            Toast.show(`${method === 'wechat' ? '微信' : '支付宝'}收款码上传成功`, 'success');
            this._loadQRConfig();
        } catch (e) {
            Toast.show('上传失败: ' + e.message, 'error');
        }
    },

    async _loadPendingPayments() {
        const el = document.getElementById('pending-payments-list');
        if (!el) return;
        try {
            const payments = await API.getPendingPayments();
            if (!payments.length) {
                el.innerHTML = '<p style="color:#888;">暂无待确认的支付</p>';
                return;
            }
            const methodLabels = { wechat: '微信', alipay: '支付宝' };
            el.innerHTML = `
                <table class="crud-table" style="width:100%;">
                    <thead><tr>
                        <th>租户</th><th>金额</th><th>支付方式</th><th>时间</th><th>操作</th>
                    </tr></thead>
                    <tbody>
                        ${payments.map(p => `
                            <tr>
                                <td>${p.tenant_name}</td>
                                <td>¥${p.amount}</td>
                                <td>${methodLabels[p.payment_method] || p.payment_method}</td>
                                <td>${p.created_at}</td>
                                <td><button class="btn btn-primary btn-sm btn-confirm-pay" data-id="${p.id}">确认收款</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            el.querySelectorAll('.btn-confirm-pay').forEach(btn => {
                btn.onclick = () => {
                    Confirm.open('确定已收到该笔款项？', async () => {
                        try {
                            await API.manualConfirmPayment(btn.dataset.id);
                            Toast.show('已确认收款，订阅已激活', 'success');
                            Confirm.close();
                            this._loadPendingPayments();
                        } catch (e) {
                            Toast.show('确认失败: ' + e.message, 'error');
                        }
                    });
                };
            });
        } catch (e) {
            el.innerHTML = `<p style="color:red;">加载失败: ${e.message}</p>`;
        }
    },

    // ===== Payment Method Selection =====
    showPaymentMethodModal(plan) {
        const planLabel = plan === 'monthly' ? '月付套餐 (¥99)' : '年付套餐 (¥999)';
        const html = `
            <div class="pay-method-select">
                <p class="pay-plan-label">您选择了：<strong>${planLabel}</strong></p>
                <p style="margin-bottom:16px;color:#666;">请选择支付方式：</p>
                <div class="pay-method-grid">
                    <button class="pay-method-btn" id="pay-wechat">
                        <span class="pay-icon pay-icon-wechat">微</span>
                        <span>微信支付</span>
                    </button>
                    <button class="pay-method-btn" id="pay-alipay">
                        <span class="pay-icon pay-icon-alipay">支</span>
                        <span>支付宝</span>
                    </button>
                </div>
            </div>
        `;
        Modal.open('选择支付方式', html, null);
        // Hide default confirm button
        const confirmBtn = document.getElementById('modal-confirm');
        if (confirmBtn) confirmBtn.style.display = 'none';

        document.getElementById('pay-wechat').onclick = () => {
            Modal.close();
            this.startPayment(plan, 'wechat');
        };
        document.getElementById('pay-alipay').onclick = () => {
            Modal.close();
            this.startPayment(plan, 'alipay');
        };
    },

    async startPayment(plan, method) {
        try {
            const result = await API.createPaymentOrder({ plan, method });

            if (result.qr_image_url) {
                // Manual QR image mode — show uploaded QR code
                this.showQRImagePayment(result, method);
            } else if (result.code_url) {
                // WeChat Native — show QR code
                this.showQRCodePayment(result, '微信');
            } else if (result.qr_code) {
                // Alipay precreate — show QR code
                this.showQRCodePayment({ ...result, code_url: result.qr_code }, '支付宝');
            } else if (result.sandbox) {
                // Sandbox mode — show confirm button
                this.showSandboxPayment(result);
            } else if (result.pay_url) {
                // Redirect payment
                this.showRedirectPayment(result, method);
            } else {
                Toast.show('支付信息异常', 'error');
            }
        } catch (e) {
            Toast.show('创建支付订单失败: ' + e.message, 'error');
        }
    },

    // ===== QR Image Payment (manual) =====
    showQRImagePayment(result, method) {
        const methodLabel = method === 'wechat' ? '微信' : '支付宝';
        const html = `
            <div class="pay-qrimage-wrap">
                <p style="margin-bottom:8px;color:#555;">请使用${methodLabel}扫描下方二维码付款</p>
                <p style="font-size:22px;font-weight:700;color:#e6a23c;margin-bottom:16px;">¥${result.amount}</p>
                <img src="${result.qr_image_url}" alt="${methodLabel}收款码" class="pay-qr-img">
                <p style="margin-top:14px;font-size:13px;color:#888;">付款完成后，点击下方"我已支付"按钮，等待管理员确认</p>
                <p id="pay-submit-status" style="display:none;color:#67c23a;margin-top:8px;font-weight:600;">✓ 已提交，请等待管理员确认到账后订阅将自动激活</p>
            </div>
        `;
        Modal.open(`${methodLabel}扫码付款`, html, null);
        const confirmBtn = document.getElementById('modal-confirm');
        if (confirmBtn) {
            confirmBtn.textContent = '我已支付';
            confirmBtn.style.display = '';
            confirmBtn.onclick = () => {
                confirmBtn.style.display = 'none';
                const statusEl = document.getElementById('pay-submit-status');
                if (statusEl) statusEl.style.display = 'block';
                const cancelBtn = document.getElementById('modal-cancel');
                if (cancelBtn) cancelBtn.textContent = '关闭';
                Toast.show('已提交，请等待管理员确认收款', 'info');
            };
        }
    },

    // ===== Sandbox Payment =====
    showSandboxPayment(result) {
        const html = `
            <div class="pay-sandbox">
                <p style="color:#e6a23c;font-weight:600;margin-bottom:12px;">沙盒测试模式</p>
                <p>支付金额：<strong>¥${result.amount}</strong></p>
                <p>订单编号：${result.payment_id}</p>
                <p style="margin-top:16px;color:#666;font-size:13px;">点击下方按钮模拟支付成功</p>
            </div>
        `;
        Modal.open('模拟支付', html, async () => {
            try {
                await API.sandboxConfirm(result.payment_id);
                Toast.show('支付成功！订阅已激活', 'success');
                Modal.close();
                this.refreshAfterPayment();
            } catch (e) {
                Toast.show('模拟支付失败: ' + e.message, 'error');
            }
        });
        const confirmBtn = document.getElementById('modal-confirm');
        if (confirmBtn) {
            confirmBtn.textContent = '确认支付（模拟）';
            confirmBtn.style.display = '';
        }
    },

    // ===== QR Code Payment (WeChat Native / Alipay) =====
    showQRCodePayment(result, label) {
        label = label || '微信';
        const html = `
            <div class="pay-qrcode-wrap">
                <p style="margin-bottom:12px;">请使用${label}扫描二维码完成支付</p>
                <p style="margin-bottom:16px;font-size:20px;font-weight:600;color:#e6a23c;">¥${result.amount}</p>
                <canvas id="qr-canvas" width="256" height="256"></canvas>
                <p class="pay-status-text" id="pay-status-text">等待支付中...</p>
            </div>
        `;
        Modal.open(`${label}扫码支付`, html, null);
        const confirmBtn = document.getElementById('modal-confirm');
        if (confirmBtn) confirmBtn.style.display = 'none';

        // Generate QR code on canvas
        this._drawQRCode('qr-canvas', result.code_url);

        // Start polling payment status
        this._startPaymentPoll(result.payment_id);
    },

    // ===== Redirect Payment (Alipay / WeChat H5) =====
    showRedirectPayment(result, method) {
        const methodLabel = method === 'wechat' ? '微信' : '支付宝';
        const html = `
            <div class="pay-redirect-wrap">
                <p>即将跳转到${methodLabel}支付页面</p>
                <p style="margin:12px 0;font-size:20px;font-weight:600;color:#e6a23c;">¥${result.amount}</p>
                <p style="color:#999;font-size:13px;">支付完成后请返回此页面</p>
                <p class="pay-status-text" id="pay-status-text">等待支付中...</p>
            </div>
        `;
        Modal.open(`${methodLabel}支付`, html, null);
        const confirmBtn = document.getElementById('modal-confirm');
        if (confirmBtn) confirmBtn.style.display = 'none';

        // Open payment URL
        window.open(result.pay_url, '_blank');

        // Start polling
        this._startPaymentPoll(result.payment_id);
    },

    _startPaymentPoll(paymentId) {
        if (this._paymentPollTimer) clearInterval(this._paymentPollTimer);
        let attempts = 0;
        const maxAttempts = 120; // 10 minutes at 5s intervals

        this._paymentPollTimer = setInterval(async () => {
            attempts++;
            if (attempts > maxAttempts) {
                clearInterval(this._paymentPollTimer);
                this._paymentPollTimer = null;
                const statusEl = document.getElementById('pay-status-text');
                if (statusEl) statusEl.textContent = '支付超时，请重试';
                return;
            }
            try {
                const status = await API.getPaymentStatus(paymentId);
                if (status.status === 'success') {
                    clearInterval(this._paymentPollTimer);
                    this._paymentPollTimer = null;
                    Toast.show('支付成功！订阅已激活', 'success');
                    Modal.close();
                    this.refreshAfterPayment();
                } else if (status.status === 'failed') {
                    clearInterval(this._paymentPollTimer);
                    this._paymentPollTimer = null;
                    const statusEl = document.getElementById('pay-status-text');
                    if (statusEl) statusEl.textContent = '支付失败，请重试';
                }
            } catch (e) {
                // Ignore polling errors
            }
        }, 5000);
    },

    async refreshAfterPayment() {
        // Refresh tenant info
        try {
            API.tenantInfo = await API.getTenantInfo();
            this.updateTrialBanner();
            // If on subscription page, re-render it
            if (this.currentPage === 'subscription') {
                this.renderSubscriptionPage(document.getElementById('page-content'));
            }
        } catch (e) { /* ignore */ }
    },

    // ===== Minimal QR Code Generator (canvas-based) =====
    _drawQRCode(canvasId, text) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !text) return;
        const ctx = canvas.getContext('2d');
        // Use a minimal QR encoding — for production, we generate via a small inline lib
        // For now, use the QR code API as image fallback
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            ctx.clearRect(0, 0, 256, 256);
            ctx.drawImage(img, 0, 0, 256, 256);
        };
        img.onerror = () => {
            // Fallback: display the URL as text
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, 256, 256);
            ctx.fillStyle = '#333';
            ctx.font = '12px monospace';
            ctx.fillText('QR码加载失败', 60, 120);
            ctx.fillText('请手动复制链接', 60, 140);
        };
        // Use a free QR code API to render
        img.src = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(text)}`;
    },

    // ===== Modal bindings =====
    bindModal() {
        document.getElementById('modal-close').onclick = () => Modal.close();
        document.getElementById('modal-cancel').onclick = () => Modal.close();
        document.getElementById('modal-confirm').onclick = () => {
            if (Modal._onConfirm) Modal._onConfirm();
        };
        document.getElementById('modal-overlay').onclick = (e) => {
            if (e.target === document.getElementById('modal-overlay')) Modal.close();
        };

        document.getElementById('confirm-cancel').onclick = () => Confirm.close();
        document.getElementById('confirm-ok').onclick = () => {
            if (Confirm._onConfirm) Confirm._onConfirm();
        };
        document.getElementById('confirm-overlay').onclick = (e) => {
            if (e.target === document.getElementById('confirm-overlay')) Confirm.close();
        };
    },

    // ===== Customer Overview (sidebar widget) =====
    bindCustomerOverview() {
        const input = document.getElementById('overview-customer-input');
        const hidden = document.getElementById('overview-customer-id');
        const dropdown = document.getElementById('overview-customer-dropdown');
        const btn = document.getElementById('btn-customer-overview');
        if (!input || !btn) return;

        let _results = [];
        const _debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

        input.addEventListener('input', _debounce(async () => {
            hidden.value = '';
            const kw = input.value.trim();
            if (!kw) { dropdown.style.display = 'none'; return; }
            try {
                const customers = await API.list('customers', { keyword: kw });
                _results = customers;
                if (!customers.length) {
                    dropdown.innerHTML = '<div class="autocomplete-item empty">无匹配客户</div>';
                } else {
                    dropdown.innerHTML = customers.map((c, i) =>
                        `<div class="autocomplete-item" data-idx="${i}"><div class="ac-name">${c.name}</div><div class="ac-detail">${c.phone || ''}</div></div>`
                    ).join('');
                }
                dropdown.style.display = 'block';
                dropdown.querySelectorAll('.autocomplete-item:not(.empty)').forEach(el => {
                    el.onclick = () => {
                        const c = _results[parseInt(el.dataset.idx)];
                        hidden.value = c.id;
                        input.value = c.name;
                        dropdown.style.display = 'none';
                    };
                });
            } catch (e) { dropdown.style.display = 'none'; }
        }, 300));

        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.style.display = 'none';
        });

        btn.onclick = async () => {
            const customerId = hidden.value;
            const customerName = input.value.trim();
            if (!customerId && !customerName) { Toast.show('请输入或选择客户', 'error'); return; }
            try {
                let cid = customerId;
                if (!cid) {
                    const customers = await API.list('customers', { keyword: customerName });
                    if (!customers.length) { Toast.show('未找到该客户', 'error'); return; }
                    cid = customers[0].id;
                }
                const data = await API.get(`/api/customers/${cid}/overview`);
                const c = data.customer;
                const orders = data.orders || [];

                const esc = (s) => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
                const today = new Date();
                const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

                const statusClass = (s) => s === '已结清' ? 'settled' : (s === '已逾期' ? 'overdue' : 'active');
                const statusLabel = (s) => s || '正常';

                const orderRows = orders.map((o, idx) => `
                    <tr>
                        <td>${idx + 1}</td>
                        <td>${esc(o.order_no)}</td>
                        <td>${o.weight}g</td>
                        <td>${Number(o.total_price).toLocaleString()}</td>
                        <td>${Number(o.down_payment).toLocaleString()}</td>
                        <td>${Number(o.notary_fee).toLocaleString()}</td>
                        <td>${o.installment_amount}</td>
                        <td>${o.installment_periods}</td>
                        <td>${o.order_date}</td>
                        <td><span class="co-status ${statusClass(o.status)}">${esc(statusLabel(o.status))}</span></td>
                        <td>${o.settlement_date || '-'}</td>
                        <td>${o.settlement_days != null ? o.settlement_days + '天' : '-'}</td>
                        <td>${Number(o.balance).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                    </tr>
                `).join('');

                const html = `
                    <div class="customer-overview-modal">
                        <div class="co-header">
                            <h2>客户信息一览表</h2>
                            <div class="co-subtitle">生成日期：${dateStr}</div>
                        </div>
                        <div class="co-toolbar">
                            <button class="co-print-btn" id="co-print-btn">🖨 打印</button>
                        </div>
                        <div class="co-info-grid">
                            <div class="co-info-row"><span class="co-label">姓名</span><span class="co-value">${esc(c.name)}</span></div>
                            <div class="co-info-row"><span class="co-label">电话</span><span class="co-value">${esc(c.phone || '-')}</span></div>
                            <div class="co-info-row"><span class="co-label">身份证</span><span class="co-value">${esc(c.id_card || '-')}</span></div>
                            <div class="co-info-row"><span class="co-label">地址</span><span class="co-value">${esc(c.address || '-')}</span></div>
                            <div class="co-info-row"><span class="co-label">客户经理</span><span class="co-value">${esc(c.account_manager || '-')}</span></div>
                            <div class="co-info-row"><span class="co-label">紧急联系人</span><span class="co-value">${esc(c.emergency_contact || '-')}</span></div>
                            <div class="co-info-row"><span class="co-label">当前逾期</span><span class="co-value">${esc(c.has_overdue)}</span></div>
                            <div class="co-info-row"><span class="co-label">有房产</span><span class="co-value">${esc(c.has_property)}</span></div>
                        </div>
                        <div class="co-orders-title">历史订单 (${orders.length}笔)</div>
                        <div class="co-table-wrap">
                            <table class="co-table">
                                <thead>
                                    <tr>
                                        <th>序号</th><th>订单编号</th><th>克重</th><th>总金额</th><th>首付</th><th>公证费</th>
                                        <th>日付</th><th>期数</th><th>订单日期</th><th>状态</th><th>结清日期</th><th>结清天数</th><th>余额</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${orderRows || '<tr><td colspan="13" style="text-align:center;color:#999;padding:16px;">暂无订单</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;

                Modal.open(`客户一览 - ${esc(c.name)}`, html, null);
                const confirmBtn = document.getElementById('modal-confirm');
                if (confirmBtn) confirmBtn.style.display = 'none';
                const cancelBtn = document.getElementById('modal-cancel');
                if (cancelBtn) cancelBtn.textContent = '关闭';
                // Print button
                const printBtn = document.getElementById('co-print-btn');
                if (printBtn) printBtn.onclick = () => window.print();
            } catch (e) {
                Toast.show('生成失败: ' + e.message, 'error');
            }
        };
    },

    // ===== Sidebar Commission Calculator =====
    bindSidebarCommission() {
        const btn = document.getElementById('btn-sc-query');
        if (!btn) return;
        // Auto-format date inputs
        ['sc-date-from', 'sc-date-to'].forEach(id => {
            const el = document.getElementById(id);
            if (el) setupDateInput(el);
        });
        // Quick date presets
        const _pad = n => String(n).padStart(2, '0');
        const _fmt = d => `${d.getFullYear()}-${_pad(d.getMonth()+1)}-${_pad(d.getDate())}`;
        document.querySelectorAll('.sc-preset-btn').forEach(presetBtn => {
            presetBtn.onclick = () => {
                const now = new Date();
                const y = now.getFullYear(), m = now.getMonth();
                let from = '', to = '';
                switch (presetBtn.dataset.preset) {
                    case 'month':
                        from = _fmt(new Date(y, m, 1));
                        to   = _fmt(new Date(y, m + 1, 0));
                        break;
                    case 'last-month':
                        from = _fmt(new Date(y, m - 1, 1));
                        to   = _fmt(new Date(y, m, 0));
                        break;
                    case 'quarter': {
                        const qStart = Math.floor(m / 3) * 3;
                        from = _fmt(new Date(y, qStart, 1));
                        to   = _fmt(new Date(y, qStart + 3, 0));
                        break;
                    }
                    case 'year':
                        from = `${y}-01-01`;
                        to   = `${y}-12-31`;
                        break;
                    case 'all':
                        from = ''; to = '';
                        break;
                }
                document.getElementById('sc-date-from').value = from;
                document.getElementById('sc-date-to').value = to;
                // Highlight active preset
                document.querySelectorAll('.sc-preset-btn').forEach(b => b.classList.remove('active'));
                presetBtn.classList.add('active');
            };
        });
        btn.onclick = async () => {
            const name = document.getElementById('sc-name').value.trim();
            const dateFrom = document.getElementById('sc-date-from').value.trim();
            const dateTo = document.getElementById('sc-date-to').value.trim();
            if (!name) { Toast.show('请输入姓名', 'error'); return; }
            btn.disabled = true;
            btn.textContent = '查询中...';
            const resultEl = document.getElementById('sc-result');
            try {
                const data = await API.commission(name, dateFrom, dateTo);
                const mgr = data.as_manager;
                const opr = data.as_operator;
                const fmt = n => Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2 });
                const total = mgr.commission + opr.commission;

                const renderDetailTable = (rows, blockId) => {
                    if (!rows.length) return '<p style="color:#bbb;font-size:12px;margin:6px 0;">无结清订单</p>';
                    const unpaidIds = rows.filter(r => !r.commission_paid).map(r => r.order_id);
                    const markBtn = unpaidIds.length
                        ? `<button class="btn btn-sm btn-primary" id="mark-paid-${blockId}" style="margin-bottom:8px;font-size:12px;">一键标记已支付（${unpaidIds.length} 笔）</button>`
                        : `<span style="font-size:12px;color:#67c23a;display:inline-block;margin-bottom:8px;">✓ 全部已支付</span>`;
                    const tableHtml = `<table class="sc-detail-table">
                        <thead><tr><th>订单编号</th><th>日期</th><th>客户</th><th>金额</th><th>提成</th><th>状态</th></tr></thead>
                        <tbody>${rows.map(r => `<tr>
                            <td>${escapeHtml(r.order_no)}</td>
                            <td>${r.order_date}</td>
                            <td>${escapeHtml(r.customer_name)}</td>
                            <td>¥${fmt(r.total_amount)}</td>
                            <td style="color:#67c23a;font-weight:600;">¥${fmt(r.commission)}</td>
                            <td>${r.commission_paid
                                ? '<span style="color:#67c23a;font-size:12px;">✓ 已支付</span>'
                                : `<span style="color:#ff9800;font-size:12px;">待支付</span>
                                   <button class="btn btn-sm comm-mark-single" data-id="${r.order_id}" data-block="${blockId}" style="margin-left:4px;font-size:11px;padding:1px 6px;">标记</button>`}</td>
                        </tr>`).join('')}</tbody>
                    </table>`;
                    return markBtn + tableHtml;
                };

                // Sidebar summary: show unpaid commission prominently
                const unpaidTotal = mgr.unpaid_commission + opr.unpaid_commission;
                resultEl.style.display = '';
                resultEl.innerHTML = `
                    <div class="sc-summary">
                        <div class="sc-summary-row"><span class="sc-role">客户经理(2%)</span><span class="sc-val">¥${fmt(mgr.commission)}</span></div>
                        <div class="sc-summary-row"><span class="sc-role">操作员(1%)</span><span class="sc-val">¥${fmt(opr.commission)}</span></div>
                        <div class="sc-summary-total">合计 ¥${fmt(total)}</div>
                        ${unpaidTotal > 0 ? `<div class="sc-summary-row" style="margin-top:4px;"><span class="sc-role" style="color:#ff9800;">待支付</span><span class="sc-val" style="color:#ff9800;">¥${fmt(unpaidTotal)}</span></div>` : '<div style="font-size:11px;color:#67c23a;margin-top:4px;text-align:right;">全部已支付 ✓</div>'}
                        <button class="sc-detail-btn" id="sc-detail-btn">查看明细</button>
                    </div>`;

                document.getElementById('sc-detail-btn').onclick = () => {
                    const html = `
                        <div style="margin-bottom:16px;">
                            <div style="font-size:15px;font-weight:700;margin-bottom:4px;">${escapeHtml(name)}</div>
                            ${dateFrom || dateTo ? `<div style="font-size:12px;color:#888;">${dateFrom || '不限'} ~ ${dateTo || '不限'}</div>` : ''}
                        </div>
                        <div class="comm-result-grid">
                            <div class="comm-result-block">
                                <div class="comm-result-header">
                                    <span class="comm-role-tag manager-tag">客户经理 · 2%</span>
                                    <span class="comm-summary">${mgr.count} 笔 &nbsp;|&nbsp; <span class="comm-amount">¥${fmt(mgr.commission)}</span>${mgr.unpaid_commission > 0 ? ` &nbsp;<span style="color:#ff9800;font-size:12px;">待付 ¥${fmt(mgr.unpaid_commission)}</span>` : ''}</span>
                                </div>
                                ${renderDetailTable(mgr.orders, 'mgr')}
                            </div>
                            <div class="comm-result-block">
                                <div class="comm-result-header">
                                    <span class="comm-role-tag operator-tag">操作员 · 1%</span>
                                    <span class="comm-summary">${opr.count} 笔 &nbsp;|&nbsp; <span class="comm-amount">¥${fmt(opr.commission)}</span>${opr.unpaid_commission > 0 ? ` &nbsp;<span style="color:#ff9800;font-size:12px;">待付 ¥${fmt(opr.unpaid_commission)}</span>` : ''}</span>
                                </div>
                                ${renderDetailTable(opr.orders, 'opr')}
                            </div>
                        </div>
                        <div class="comm-total-row">合计提成：<span class="comm-total-amount">¥${fmt(total)}</span></div>`;
                    Modal.open(`提成明细 - ${escapeHtml(name)}`, html, null);
                    const confirmBtn = document.getElementById('modal-confirm');
                    if (confirmBtn) confirmBtn.style.display = 'none';
                    const cancelBtn = document.getElementById('modal-cancel');
                    if (cancelBtn) cancelBtn.textContent = '关闭';

                    // Bind mark-paid buttons
                    const bindMarkPaid = (btnId, orders, role) => {
                        const btn = document.getElementById(btnId);
                        if (!btn) return;
                        btn.onclick = async () => {
                            const unpaidIds = orders.filter(r => !r.commission_paid).map(r => r.order_id);
                            if (!unpaidIds.length) return;
                            btn.disabled = true;
                            btn.textContent = '标记中...';
                            try {
                                await API.markCommissionPaid(unpaidIds, role);
                                Toast.show('已标记为已支付', 'success');
                                Modal.close();
                                // Re-query to refresh
                                document.getElementById('btn-sc-query').click();
                            } catch (e) {
                                Toast.show('操作失败: ' + e.message, 'error');
                                btn.disabled = false;
                                btn.textContent = '一键标记已支付';
                            }
                        };
                    };
                    bindMarkPaid('mark-paid-mgr', mgr.orders, 'manager');
                    bindMarkPaid('mark-paid-opr', opr.orders, 'operator');

                    // Per-row single-order mark-paid buttons
                    document.querySelectorAll('.comm-mark-single').forEach(singleBtn => {
                        singleBtn.onclick = async () => {
                            const orderId = parseInt(singleBtn.dataset.id);
                            const role = singleBtn.dataset.block === 'mgr' ? 'manager' : 'operator';
                            singleBtn.disabled = true;
                            singleBtn.textContent = '…';
                            try {
                                await API.markCommissionPaid([orderId], role);
                                Toast.show('已标记为已支付', 'success');
                                Modal.close();
                                document.getElementById('btn-sc-query').click();
                            } catch (e) {
                                Toast.show('操作失败: ' + e.message, 'error');
                                singleBtn.disabled = false;
                                singleBtn.textContent = '标记';
                            }
                        };
                    });
                };
            } catch (e) {
                Toast.show('查询失败: ' + e.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = '查询提成';
            }
        };
    },

    // ===== Online Service =====
    bindOnlineService() {
        const btn = document.getElementById('btn-online-service');
        if (!btn) return;
        btn.onclick = (e) => {
            e.preventDefault();
            const html = `
                <div style="padding:20px;">
                    <div style="text-align:center;font-size:48px;margin-bottom:16px;">💬</div>
                    <p style="text-align:center;font-size:15px;color:#333;margin-bottom:16px;">如需帮助，请通过以下方式联系我们</p>
                    <div style="display:flex;flex-direction:column;gap:12px;max-width:340px;margin:0 auto;">
                        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#f0f9eb;border-radius:8px;">
                            <span style="font-size:20px;">📱</span>
                            <div><div style="font-size:12px;color:#888;">微信</div><div style="font-size:14px;font-weight:600;color:#333;">569515875<span style="font-size:11px;color:#999;margin-left:4px;">（请备注公司名称）</span></div></div>
                        </div>
                        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#ecf5ff;border-radius:8px;">
                            <span style="font-size:20px;">🐧</span>
                            <div><div style="font-size:12px;color:#888;">QQ</div><div style="font-size:14px;font-weight:600;color:#333;">569515875<span style="font-size:11px;color:#999;margin-left:4px;">（请备注公司名称）</span></div></div>
                        </div>
                        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#fdf6ec;border-radius:8px;">
                            <span style="font-size:20px;">📧</span>
                            <div><div style="font-size:12px;color:#888;">邮箱</div><div style="font-size:14px;font-weight:600;color:#333;">569515875@qq.com</div></div>
                        </div>
                        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#fef0f0;border-radius:8px;">
                            <span style="font-size:20px;">📞</span>
                            <div><div style="font-size:12px;color:#888;">电话</div><div style="font-size:14px;font-weight:600;color:#333;">19016538803</div></div>
                        </div>
                    </div>
                    <p style="text-align:center;font-size:13px;color:#888;margin-top:16px;">工作时间：周一至周六 9:00-18:00</p>
                </div>`;
            Modal.open('在线客服', html, null);
            const confirmBtn = document.getElementById('modal-confirm');
            if (confirmBtn) confirmBtn.style.display = 'none';
            const cancelBtn = document.getElementById('modal-cancel');
            if (cancelBtn) cancelBtn.textContent = '关闭';
        };
    },

    // ===== Logout =====
    bindLogout() {
        document.getElementById('btn-logout').onclick = () => {
            API.clearSession();
            document.getElementById('main-app').style.display = 'none';
            document.getElementById('login-page').style.display = 'flex';
            document.getElementById('login-password').value = '';
            document.getElementById('login-error').textContent = '';
            // Reset to login form
            document.getElementById('login-form').style.display = 'block';
            document.getElementById('register-form').style.display = 'none';
            document.getElementById('login-subtitle').textContent = '请登录您的账户';
            // Hide trial banner
            const banner = document.getElementById('trial-banner');
            if (banner) banner.style.display = 'none';
        };
    }
};

// ===== Company Info Panel =====
const CompanyInfo = {
    _activeTab: 'suppliers',

    // In-memory cache: loaded once on startup, refreshed on save/delete
    _cache: { suppliers: [], staff: [], payments: [], addresses: [], orderNos: [] },

    async preload() {
        try {
            const [suppliers, staff, payments, addresses, orderNos] = await Promise.all([
                API.ciList('suppliers'),
                API.ciList('staff'),
                API.ciList('payments'),
                API.ciList('addresses'),
                API.orderNumbers(),
            ]);
            this._cache.suppliers = suppliers || [];
            this._cache.staff = staff || [];
            this._cache.payments = payments || [];
            this._cache.addresses = addresses || [];
            this._cache.orderNos = orderNos || [];
        } catch (_) { /* non-critical – forms still work as plain text */ }
    },

    paymentOptions() {
        return this._cache.payments.map(p => [p.account, p.payee].filter(Boolean).join(' '));
    },

    _tabConfig: {
        suppliers: {
            resource: 'suppliers',
            fields: [
                { key: 'name', label: '名称' },
                { key: 'contact_person', label: '联系人' },
                { key: 'phone', label: '电话' },
                { key: 'address', label: '地址', full: true },
            ],
        },
        staff: {
            resource: 'staff',
            fields: [
                { key: 'name', label: '姓名' },
                { key: 'phone', label: '电话' },
            ],
        },
        payments: {
            resource: 'payments',
            fields: [
                { key: 'account', label: '账户', full: true },
                { key: 'payee', label: '收款人' },
            ],
        },
        addresses: {
            resource: 'addresses',
            fields: [
                { key: 'label', label: '标签' },
                { key: 'address', label: '地址', full: true },
            ],
        },
    },

    open() {
        const overlay = document.getElementById('company-info-overlay');
        overlay.classList.add('open');
        overlay.onclick = (e) => { if (e.target === overlay) this.close(); };
        document.getElementById('ci-close-btn').onclick = () => this.close();
        document.getElementById('ci-tabs').querySelectorAll('.ci-tab-btn').forEach(btn => {
            btn.onclick = () => this.switchTab(btn.dataset.tab);
        });
        this.switchTab(this._activeTab);
    },

    close() {
        document.getElementById('company-info-overlay').classList.remove('open');
    },

    switchTab(tab) {
        this._activeTab = tab;
        document.getElementById('ci-tabs').querySelectorAll('.ci-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        this.loadTab(tab);
    },

    async loadTab(tab) {
        const body = document.getElementById('ci-body');
        body.innerHTML = '<div style="padding:30px;text-align:center;color:#bbb;">加载中...</div>';
        try {
            const cfg = this._tabConfig[tab];
            const items = await API.ciList(cfg.resource);
            // Refresh cache for this resource type
            if (tab in this._cache) this._cache[tab] = items || [];
            this.renderTab(tab, items, null);
        } catch (e) {
            body.innerHTML = `<div style="padding:20px;color:#e53935;">加载失败：${escapeHtml(e.message)}</div>`;
        }
    },

    renderTab(tab, items, editingId) {
        const cfg = this._tabConfig[tab];
        const body = document.getElementById('ci-body');
        const esc = escapeHtml;

        // Form (shown when editingId !== undefined, i.e., new or editing)
        const showForm = editingId !== undefined;
        const editItem = editingId ? items.find(i => i.id === editingId) : null;
        const formFields = cfg.fields.map(f => `
            <div class="ci-form-field" style="${f.full ? 'grid-column:span 2;' : ''}">
                <label>${f.label}</label>
                <input id="ci-f-${f.key}" type="text" value="${esc(String(editItem ? (editItem[f.key] || '') : ''))}">
            </div>`).join('');

        const formHtml = showForm ? `
            <div class="ci-inline-form" id="ci-form">
                ${formFields}
                <div class="ci-form-actions" style="grid-column:span 2;">
                    <button class="btn btn-secondary" onclick="CompanyInfo.renderTab('${tab}', CompanyInfo._cache['${tab}'], undefined)">取消</button>
                    <button class="btn btn-primary" onclick="CompanyInfo.saveItem('${tab}', ${editingId || 'null'})">
                        ${editingId ? '保存' : '确认新增'}
                    </button>
                </div>
            </div>` : '';

        // Table
        const cols = cfg.fields.map(f => `<th>${f.label}</th>`).join('');
        const rows = items.length ? items.map(item => {
            const cells = cfg.fields.map(f => `<td>${esc(String(item[f.key] || ''))}</td>`).join('');
            return `<tr>${cells}<td style="white-space:nowrap;">
                <button class="btn btn-sm btn-primary" onclick="CompanyInfo.startEdit('${tab}', ${item.id})">编辑</button>
                <button class="btn btn-sm btn-danger" style="margin-left:6px;" onclick="CompanyInfo.deleteItem('${tab}', ${item.id})">删除</button>
            </td></tr>`;
        }).join('') : `<tr><td colspan="${cfg.fields.length + 1}" class="ci-empty">暂无数据</td></tr>`;

        body.innerHTML = `
            <div class="ci-toolbar">
                ${!showForm ? `<button class="btn btn-primary" onclick="CompanyInfo.startAdd('${tab}')">+ 新增</button>` : ''}
            </div>
            ${formHtml}
            <table class="ci-table">
                <thead><tr>${cols}<th style="width:120px;">操作</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>`;

        // Cache items for re-render without re-fetching
        if (!this._cache) this._cache = {};
        this._cache[tab] = items;
    },

    startAdd(tab) {
        this.renderTab(tab, this._cache[tab] || [], null);
    },

    startEdit(tab, id) {
        this.renderTab(tab, this._cache[tab] || [], id);
    },

    async saveItem(tab, editingId) {
        const cfg = this._tabConfig[tab];
        const data = {};
        for (const f of cfg.fields) {
            const el = document.getElementById(`ci-f-${f.key}`);
            data[f.key] = el ? el.value.trim() : '';
        }
        try {
            if (editingId) {
                await API.ciUpdate(cfg.resource, editingId, data);
                Toast.show('更新成功', 'success');
            } else {
                await API.ciCreate(cfg.resource, data);
                Toast.show('新增成功', 'success');
            }
            this.loadTab(tab);
        } catch (e) {
            Toast.show('保存失败：' + e.message, 'error');
        }
    },

    async deleteItem(tab, id) {
        const cfg = this._tabConfig[tab];
        Confirm.open('确定删除此记录吗？', async () => {
            try {
                await API.ciDelete(cfg.resource, id);
                Toast.show('删除成功', 'success');
                Confirm.close();
                this.loadTab(tab);
            } catch (e) {
                Toast.show('删除失败：' + e.message, 'error');
            }
        });
    },
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
