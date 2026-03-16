/**
 * API client for communicating with the FastAPI server.
 */
const API = {
    baseUrl: 'https://api.hjfq.club',
    token: '',
    userInfo: {},
    tenantInfo: null,

    _headers() {
        const h = { 'Content-Type': 'application/json' };
        if (this.token) h['Authorization'] = `Bearer ${this.token}`;
        return h;
    },

    async _request(method, path, body, params) {
        let url = `${this.baseUrl}${path}`;
        if (params) {
            const qs = new URLSearchParams();
            for (const [k, v] of Object.entries(params)) {
                if (v !== '' && v !== null && v !== undefined) qs.append(k, v);
            }
            const s = qs.toString();
            if (s) url += `?${s}`;
        }
        const opts = { method, headers: this._headers() };
        if (body) opts.body = JSON.stringify(body);
        let resp;
        try {
            resp = await fetch(url, opts);
        } catch (e) {
            throw new Error('网络连接失败，请检查网络后重试');
        }
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            if (resp.status === 402 && typeof App !== 'undefined' && App.showSubscriptionExpired) {
                App.showSubscriptionExpired(err.detail || '订阅已到期');
            }
            if (resp.status === 401 && typeof App !== 'undefined' && App.handleUnauthorized) {
                App.handleUnauthorized();
            }
            const detail = Array.isArray(err.detail) ? err.detail.map(e => e.msg || e.message || JSON.stringify(e)).join('; ') : err.detail;
            throw new Error(detail || `HTTP ${resp.status}`);
        }
        return resp.json();
    },

    get(path, params) { return this._request('GET', path, null, params); },
    post(path, data) { return this._request('POST', path, data); },
    put(path, data) { return this._request('PUT', path, data); },
    del(path) { return this._request('DELETE', path); },

    // Auth
    async login(server, username, password, companyName) {
        this.baseUrl = server.replace(/\/+$/, '');
        const data = await this.post('/api/auth/login', { username, password, company_name: companyName });
        this.token = data.access_token;
        this.userInfo = data.user;
        this.tenantInfo = data.tenant;
        localStorage.setItem('auth_token', this.token);
        localStorage.setItem('auth_user', JSON.stringify(this.userInfo));
        localStorage.setItem('auth_tenant', JSON.stringify(this.tenantInfo));
        return data;
    },

    async registerCompany(data) {
        const result = await this.post('/api/auth/register-company', data);
        this.token = result.access_token;
        this.userInfo = result.user;
        this.tenantInfo = result.tenant;
        localStorage.setItem('auth_token', this.token);
        localStorage.setItem('auth_user', JSON.stringify(this.userInfo));
        localStorage.setItem('auth_tenant', JSON.stringify(this.tenantInfo));
        return result;
    },

    restoreSession() {
        const token = localStorage.getItem('auth_token');
        const user = localStorage.getItem('auth_user');
        if (!token || !user) return false;
        try {
            this.token = token;
            this.userInfo = JSON.parse(user);
            this.tenantInfo = JSON.parse(localStorage.getItem('auth_tenant') || 'null');
            return true;
        } catch {
            return false;
        }
    },

    clearSession() {
        this.token = '';
        this.userInfo = {};
        this.tenantInfo = null;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        localStorage.removeItem('auth_tenant');
    },

    // Team management
    getTeam() { return this.get('/api/auth/team'); },
    addTeamMember(data) { return this.post('/api/auth/team', data); },
    updateTeamMember(id, data) { return this.put(`/api/auth/team/${id}`, data); },
    removeTeamMember(id) { return this.del(`/api/auth/team/${id}`); },

    // Tenant info
    getTenantInfo() { return this.get('/api/auth/tenant'); },

    // Payments
    createPaymentOrder(data) { return this.post('/api/payments/create-order', data); },
    getPaymentStatus(id) { return this.get(`/api/payments/status/${id}`); },
    getInvoices() { return this.get('/api/payments/invoices'); },
    getInvoice(id) { return this.get(`/api/payments/invoices/${id}`); },
    sandboxConfirm(id) { return this.post(`/api/payments/sandbox-confirm/${id}`); },
    getPaymentQRConfig() { return this.get('/api/payments/config/qr'); },
    getPendingPayments() { return this.get('/api/payments/pending'); },
    manualConfirmPayment(id) { return this.post(`/api/payments/manual-confirm/${id}`); },
    selfConfirmPayment(id) { return this.post(`/api/payments/self-confirm/${id}`); },
    async uploadPaymentQR(method, file) {
        const formData = new FormData();
        formData.append('file', file);
        const url = `${this.baseUrl}/api/payments/config/upload-qr?method=${method}`;
        const headers = {};
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        const resp = await fetch(url, { method: 'POST', headers, body: formData });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.detail || `HTTP ${resp.status}`);
        }
        return resp.json();
    },

    // Company Info
    ciList(resource) { return this.get(`/api/company-info/${resource}`); },
    ciCreate(resource, data) { return this.post(`/api/company-info/${resource}`, data); },
    ciUpdate(resource, id, data) { return this.put(`/api/company-info/${resource}/${id}`, data); },
    ciDelete(resource, id) { return this.del(`/api/company-info/${resource}/${id}`); },

    // Dashboard
    dashboard() { return this.get('/api/dashboard'); },
    commission(name, dateFrom, dateTo) {
        const params = { name };
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;
        return this.get('/api/orders/commission', params);
    },

    // Gold price
    getGoldPrice() { return this.get('/api/gold-price/today'); },
    setGoldPrice(data) { return this.post('/api/gold-price', data); },

    // Generic CRUD
    list(module, params) { return this.get(`/api/${module}`, params); },
    create(module, data) { return this.post(`/api/${module}`, data); },
    batchCreate(module, dataList) { return this.post(`/api/${module}/batch`, dataList); },
    update(module, id, data) { return this.put(`/api/${module}/${id}`, data); },
    remove(module, id) { return this.del(`/api/${module}/${id}`); },

    // Order numbers (for datalist)
    orderNumbers() { return this.get('/api/orders/numbers'); },

    // Transfers
    transfersList() { return this.get('/api/transfers'); },
    transfersCreate(data) { return this.post('/api/transfers', data); },
    transfersDelete(id) { return this.del(`/api/transfers/${id}`); },

    // Repayments helpers
    repaymentsSummary(params) { return this.get('/api/repayments/summary', params); },
    deleteRepaymentsByOrder(orderId) { return this.del(`/api/repayments/by-order/${orderId}`); },

    // Commission
    markCommissionPaid(orderIds, role) { return this.post('/api/orders/commission/mark-paid', { order_ids: orderIds, role }); },

    async importExcel(module, file) {
        const formData = new FormData();
        formData.append('file', file);
        const url = `${this.baseUrl}/api/import/${module}`;
        const headers = {};
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        const resp = await fetch(url, { method: 'POST', headers, body: formData });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            if (resp.status === 402 && typeof App !== 'undefined' && App.showSubscriptionExpired) {
                App.showSubscriptionExpired(err.detail || '订阅已到期');
            }
            const detail = Array.isArray(err.detail) ? err.detail.map(e => e.msg || e.message || JSON.stringify(e)).join('; ') : err.detail;
            throw new Error(detail || `HTTP ${resp.status}`);
        }
        return resp.json();
    },
};
