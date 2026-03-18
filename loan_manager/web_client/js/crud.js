/**
 * Generic CRUD page factory + all page configurations.
 */
const CrudPage = {
    currentModule: null,
    currentData: [],

    _isMember() {
        return API.userInfo && API.userInfo.role === 'member';
    },

    render(container, config) {
        this.currentModule = config;
        const ro = config.readOnly || this._isMember();
        container.innerHTML = `
            <div class="crud-toolbar">
                <input type="text" class="search-input" id="crud-search" placeholder="搜索...">
                ${config.extraFilter ? `<select class="search-input" id="crud-filter" style="max-width:160px;flex:0 0 auto;">
                    <option value="">全部${config.extraFilterLabel || ''}</option>
                    ${config.extraFilter.map(o => `<option value="${o}">${o}</option>`).join('')}
                </select>` : ''}
                ${ro ? '' : '<button class="btn btn-primary" id="crud-add">+ 新增</button>'}
                ${ro ? '' : '<button class="btn btn-success" id="crud-import">导入</button>'}
                ${ro ? '' : '<button class="btn btn-secondary" id="crud-template">下载模板</button>'}
                ${(config.toolbarActions || []).map((a, i) => `<button class="btn ${a.cls}" id="crud-toolbar-action-${i}">${a.label}</button>`).join('')}
            </div>
            <div class="table-wrap">
                <div class="table-scroll">
                    <table class="data-table">
                        <thead><tr id="crud-thead"></tr></thead>
                        <tbody id="crud-tbody"></tbody>
                    </table>
                </div>
                ${config.paginate ? `
                <div class="pagination" style="margin-top:10px;">
                    <button class="btn btn-sm" id="crud-page-prev" disabled>上一页</button>
                    <span id="crud-page-info">第 1 页，共 0 页</span>
                    <button class="btn btn-sm" id="crud-page-next" disabled>下一页</button>
                    <select id="crud-page-size" style="margin-left:10px;">
                        <option value="30" selected>30条/页</option>
                        <option value="100">100条/页</option>
                        <option value="-1">全部</option>
                    </select>
                </div>
                ` : ''}
            </div>
        `;

        // Header
        const thead = document.getElementById('crud-thead');
        thead.innerHTML = config.columns.map(c => `<th>${c.label}</th>`).join('') + (config.readOnly && !(config.extraActions||[]).length ? '' : '<th>操作</th>');

        // Events
        document.getElementById('crud-search').addEventListener('input', debounce(() => this.loadData(), 400));
        if (config.extraFilter) {
            document.getElementById('crud-filter').addEventListener('change', () => this.loadData());
        }
        const addBtn = document.getElementById('crud-add');
        if (addBtn) addBtn.onclick = () => this.openForm(null);
        const importBtn = document.getElementById('crud-import');
        if (importBtn) importBtn.onclick = () => this.openImport();
        const templateBtn = document.getElementById('crud-template');
        if (templateBtn) templateBtn.onclick = () => this.downloadTemplate();
        (config.toolbarActions || []).forEach((a, i) => {
            const btn = document.getElementById(`crud-toolbar-action-${i}`);
            if (btn) btn.onclick = () => { const fn = eval(a.handler); if (fn) fn(); };
        });

        // Pagination events
        if (config.paginate) {
            document.getElementById('crud-page-prev').addEventListener('click', () => this.changePage(this.currentPage - 1));
            document.getElementById('crud-page-next').addEventListener('click', () => this.changePage(this.currentPage + 1));
            document.getElementById('crud-page-size').addEventListener('change', () => this.loadData());
        }

        this.currentPage = 1;
        this.currentPageSize = 100;
        this.totalItems = 0;

        this.loadData();
    },

    async loadData() {
        const config = this.currentModule;
        const keyword = document.getElementById('crud-search')?.value || '';
        const params = { keyword, ...(config.defaultParams || {}) };
        if (config.searchKey) params[config.searchKey] = keyword;
        if (config.extraFilter) {
            const filterVal = document.getElementById('crud-filter')?.value || '';
            if (config.extraFilterKey) params[config.extraFilterKey] = filterVal;
        }

        // Add pagination params
        if (config.paginate) {
            this.currentPageSize = parseInt(document.getElementById('crud-page-size')?.value || '30');
            if (this.currentPageSize === -1) {
                params.skip = 0;
                params.limit = -1;
            } else {
                params.skip = (this.currentPage - 1) * this.currentPageSize;
                params.limit = this.currentPageSize;
            }
        }

        try {
            let items = config.customLoad
                ? await config.customLoad(params)
                : await API.list(config.apiModule, params);
            if (config.transformData) items = config.transformData(items);
            this.currentData = items;
            this.totalItems = items.length < this.currentPageSize && this.currentPage === 1
                ? items.length
                : items.length + (this.currentPage - 1) * this.currentPageSize + (items.length === this.currentPageSize ? this.currentPageSize : 0);
            this.renderTable(items);
            
            // Update pagination UI
            if (config.paginate) {
                this.updatePagination();
            }
        } catch (e) {
            Toast.show('加载失败: ' + e.message, 'error');
        }
    },

    renderTable(items) {
        const config = this.currentModule;
        if (config.customRenderTable) return config.customRenderTable(items, this);
        const tbody = document.getElementById('crud-tbody');
        const isMember = this._isMember();
        const hasActionsCol = !(config.readOnly && !(config.extraActions||[]).length);
        if (!items.length) {
            tbody.innerHTML = `<tr><td colspan="${config.columns.length + (hasActionsCol ? 1 : 0)}" class="table-empty">暂无数据</td></tr>`;
            return;
        }
        items.forEach((item, i) => { item._rowNum = i + 1; });
        tbody.innerHTML = items.map(item => {
            const cells = config.columns.map((col, ci) => {
                let val = item[col.key] ?? '';
                if (col.format) val = col.format(val, item);
                else if (col.inlineEdit && !isMember) val = `<span class="inline-editable" data-id="${item.id}" data-col="${ci}" title="点击编辑">${escapeHtml(String(val))}</span>`;
                else if (col.key === 'status') val = statusBadge(val);
                else val = escapeHtml(String(val));
                return `<td>${val}</td>`;
            }).join('');
            const extraBtns = isMember ? '' : (config.extraActions || []).map(a => {
                const label = a.render ? a.render(item) : a.label;
                return `<button class="btn btn-sm ${a.cls}" onclick="${a.handler}(${item.id})">${label}</button>`;
            }).join('');
            const crudBtns = (config.readOnly || isMember) ? '' :
                `<button class="btn btn-sm btn-primary" onclick="CrudPage.openForm(${item.id})">编辑</button>
                <button class="btn btn-sm btn-danger" onclick="CrudPage.confirmDelete(${item.id})">删除</button>`;
            const actionsCell = (config.readOnly && !extraBtns) ? '' : `<td class="actions">${extraBtns}${crudBtns}</td>`;
            return `<tr>${cells}${actionsCell}</tr>`;
        }).join('');
    },

    changePage(page) {
        if (page < 1) return;
        this.currentPage = page;
        this.loadData();
    },

    updatePagination() {
        const config = this.currentModule;
        if (!config.paginate) return;
        
        const prevBtn = document.getElementById('crud-page-prev');
        const nextBtn = document.getElementById('crud-page-next');
        const pageInfo = document.getElementById('crud-page-info');
        
        // Calculate total pages (simplified, since we don't have total count from API)
        const totalPages = this.currentPageSize === -1 ? 1 : Math.ceil(this.totalItems / this.currentPageSize) || 1;
        
        prevBtn.disabled = this.currentPage <= 1;
        nextBtn.disabled = this.currentPage >= totalPages;
        pageInfo.textContent = `第 ${this.currentPage} 页，共 ${totalPages} 页`;
    },

    // Bind inline edit clicks via delegation
    bindInlineEditEvents() {
        const isMember = this._isMember();
        if (!isMember) {
            const tbody = document.getElementById('crud-tbody');
            tbody.addEventListener('click', (e) => {
                const span = e.target.closest('.inline-editable');
                if (span) {
                    this.startInlineEdit(span);
                }
            });
        }
    },

    openForm(itemId) {
        const config = this.currentModule;
        if (config.customOpenForm) return config.customOpenForm(itemId, this);
        const item = itemId ? this.currentData.find(d => d.id === itemId) : null;
        const title = item ? `编辑${config.title}` : `新增${config.title}`;

        // Build form HTML
        let formHtml = '<div class="form-row">';
        config.formFields.forEach((f, i) => {
            let inputHtml;
            const val = item ? (item[f.key] ?? f.default ?? '') : (f.default ?? '');
            if (f.type === 'datalist') {
                const opts = typeof f.options === 'function' ? f.options() : (f.options || []);
                inputHtml = `<select id="field-${f.key}">
                    <option value="">--</option>
                    ${opts.map(o => `<option value="${escapeHtml(String(o))}" ${String(val) === String(o) ? 'selected' : ''}>${escapeHtml(String(o))}</option>`).join('')}
                </select>`;
            } else if (f.type === 'combo' || f.type === 'select') {
                inputHtml = `<select id="field-${f.key}">
                    ${(f.options || []).map(o => `<option value="${o}" ${String(val) === o ? 'selected' : ''}>${o}</option>`).join('')}
                </select>`;
            } else if (f.type === 'textarea') {
                inputHtml = `<textarea id="field-${f.key}" rows="3">${escapeHtml(String(val))}</textarea>`;
            } else if (f.type === 'date') {
                inputHtml = `<input type="text" id="field-${f.key}" value="${val}" maxlength="10" placeholder="YYYY-MM-DD">`;
            } else if (f.type === 'time') {
                inputHtml = `<input type="time" id="field-${f.key}" value="${val}">`;
            } else if (f.type === 'number' || f.type === 'float') {
                inputHtml = `<input type="number" step="0.01" id="field-${f.key}" value="${val}" ${f.readonly ? 'readonly style="background:#f0f0f0;"' : ''}>`;
            } else if (f.type === 'int') {
                const intVal = (val === 0 || val === '0') && f.placeholder ? '' : val;
                inputHtml = `<input type="number" step="1" id="field-${f.key}" value="${intVal}" ${f.placeholder ? `placeholder="${escapeHtml(f.placeholder)}"` : ''}>`;
            } else if (f.type === 'customer_search') {
                const displayVal = item ? (item[f.displayKey] || val) : '';
                inputHtml = `<div class="autocomplete-wrap">
                    <input type="text" id="field-${f.key}-search" value="${escapeHtml(String(displayVal))}" autocomplete="off" placeholder="输入客户姓名搜索...">
                    <input type="hidden" id="field-${f.key}" value="${val}">
                    <div class="autocomplete-dropdown" id="dropdown-${f.key}"></div>
                </div>`;
            } else {
                inputHtml = `<input type="text" id="field-${f.key}" value="${escapeHtml(String(val))}" ${f.readonly ? 'readonly style="background:#f0f0f0;"' : ''} ${f.placeholder ? `placeholder="${escapeHtml(f.placeholder)}"` : ''}>`;
            }
            formHtml += `<div class="form-group">
                <label>${f.label}</label>
                ${inputHtml}
            </div>`;
        });
        formHtml += '</div>';

        Modal.open(title, formHtml, async () => {
            const data = {};
            config.formFields.forEach(f => {
                const el = document.getElementById(`field-${f.key}`);
                let v = el ? el.value : '';
                if (f.type === 'number' || f.type === 'float') v = v ? parseFloat(v) : 0;
                else if (f.type === 'int' || f.type === 'customer_search') v = v ? parseInt(v) : 0;
                data[f.key] = v;
            });

            // Auto-create customer if user typed a name but didn't select from dropdown
            for (const f of config.formFields) {
                if (f.type !== 'customer_search') continue;
                if (data[f.key]) continue; // already has a valid selection
                const searchInput = document.getElementById(`field-${f.key}-search`);
                const name = searchInput ? searchInput.value.trim() : '';
                if (!name) { Toast.show('请输入或选择客户', 'error'); return; }
                try {
                    const custData = { name };
                    if (f.autofill) {
                        f.autofill.forEach(mapping => {
                            const k = typeof mapping === 'string' ? mapping : mapping.from;
                            if (data[k]) custData[k] = data[k];
                        });
                    }
                    const newCust = await API.create('customers', custData);
                    data[f.key] = newCust.id;
                    document.getElementById(`field-${f.key}`).value = newCust.id;
                } catch (e) {
                    Toast.show('自动创建客户失败: ' + e.message, 'error');
                    return;
                }
            }

            try {
                if (item) {
                    if (config.omitOnUpdate) config.omitOnUpdate.forEach(k => delete data[k]);
                    // Remove empty date/time fields so server uses existing values
                    config.formFields.forEach(f => {
                        if ((f.type === 'date' || f.type === 'time') && !data[f.key]) delete data[f.key];
                    });
                    await API.update(config.apiModule, item.id, data);
                    Toast.show('更新成功', 'success');
                } else {
                    await API.create(config.apiModule, data);
                    Toast.show('创建成功', 'success');
                }
                Modal.close();
                this.loadData();
            } catch (e) {
                Toast.show('操作失败: ' + e.message, 'error');
            }
        });

        // Invoke onFormReady callback if defined
        if (config.onFormReady) config.onFormReady();

        // Init date inputs with auto-formatting
        config.formFields.filter(f => f.type === 'date').forEach(f => {
            const el = document.getElementById(`field-${f.key}`);
            if (el) setupDateInput(el);
        });

        // Init customer search autocomplete
        config.formFields.filter(f => f.type === 'customer_search').forEach(f => {
            const searchInput = document.getElementById(`field-${f.key}-search`);
            const hiddenInput = document.getElementById(`field-${f.key}`);
            const dropdown = document.getElementById(`dropdown-${f.key}`);
            if (!searchInput) return;
            let _results = [];

            searchInput.addEventListener('input', debounce(async () => {
                // Clear hidden ID when user modifies text, so save will re-match or auto-create
                hiddenInput.value = '';
                const kw = searchInput.value.trim();
                if (!kw) { dropdown.style.display = 'none'; return; }
                try {
                    const customers = await API.list('customers', { keyword: kw });
                    _results = customers;
                    if (!customers.length) {
                        dropdown.innerHTML = '<div class="autocomplete-item empty">无匹配客户（保存时将自动创建）</div>';
                    } else {
                        dropdown.innerHTML = customers.map((c, i) =>
                            `<div class="autocomplete-item" data-idx="${i}">
                                <div class="ac-name">${escapeHtml(c.name)}</div>
                                <div class="ac-detail">${escapeHtml(c.phone || '')} · ${escapeHtml(c.id_card || '')}</div>
                            </div>`
                        ).join('');
                    }
                    dropdown.style.display = 'block';
                    dropdown.querySelectorAll('.autocomplete-item:not(.empty)').forEach(el => {
                        el.onclick = () => {
                            const c = _results[parseInt(el.dataset.idx)];
                            hiddenInput.value = c.id;
                            searchInput.value = c.name;
                            dropdown.style.display = 'none';
                            if (f.autofill) {
                                f.autofill.forEach(mapping => {
                                    const srcKey = typeof mapping === 'string' ? mapping : mapping.from;
                                    const tgtKey = typeof mapping === 'string' ? mapping : mapping.to;
                                    const target = document.getElementById(`field-${tgtKey}`);
                                    if (target) target.value = c[srcKey] || '';
                                });
                            }
                        };
                    });
                } catch (e) { dropdown.style.display = 'none'; }
            }, 300));

            document.addEventListener('click', (e) => {
                if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.style.display = 'none';
                }
            });
        });
    },

    confirmDelete(itemId) {
        const config = this.currentModule;
        Confirm.open(`确定删除此${config.title}吗？此操作不可撤销。`, async () => {
            try {
                await API.remove(config.apiModule, itemId);
                Toast.show('删除成功', 'success');
                Confirm.close();
                this.loadData();
            } catch (e) {
                Toast.show('删除失败: ' + e.message, 'error');
            }
        });
    },

    openImport() {
        const config = this.currentModule;
        const html = `
            <div style="padding:10px 0;">
                <p style="margin-bottom:12px;color:#666;font-size:14px;">请选择Excel文件（.xlsx格式），第一行必须是中文列标题。</p>
                <p style="margin-bottom:12px;color:#999;font-size:13px;">可先点击"下载模板"获取正确格式的模板文件。</p>
                <input type="file" id="import-file-input" accept=".xlsx,.xls"
                       style="margin:12px 0;padding:10px;border:2px dashed #ccc;border-radius:8px;width:100%;box-sizing:border-box;cursor:pointer;">
                <div id="import-result" style="margin-top:12px;display:none;"></div>
            </div>
        `;
        Modal.open(`导入${config.title}`, html, async () => {
            const fileInput = document.getElementById('import-file-input');
            const resultDiv = document.getElementById('import-result');
            if (!fileInput.files.length) {
                Toast.show('请选择文件', 'error');
                return;
            }
            const confirmBtn = document.getElementById('modal-confirm');
            if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '导入中...'; }
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = '<p style="color:#409eff;">正在导入，请稍候...</p>';
            try {
                const result = await API.importExcel(config.apiModule, fileInput.files[0]);
                let h = `<p style="color:#67c23a;font-weight:600;font-size:15px;">导入完成！成功 ${result.success} 条，共 ${result.total} 条</p>`;
                if (result.errors && result.errors.length > 0) {
                    h += '<div style="margin-top:8px;max-height:200px;overflow-y:auto;font-size:13px;">';
                    h += '<p style="color:#e6a23c;font-weight:600;">以下行导入失败:</p>';
                    result.errors.forEach(err => {
                        h += `<p style="color:#e53935;margin:2px 0;">第 ${err.row} 行: ${escapeHtml(err.error)}</p>`;
                    });
                    h += '</div>';
                }
                resultDiv.innerHTML = h;
                if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = '确定'; }
                this.loadData();
            } catch (e) {
                resultDiv.innerHTML = `<p style="color:#e53935;">导入失败: ${escapeHtml(e.message)}</p>`;
                if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = '确定'; }
            }
        });
    },

    startInlineEdit(span) {
        if (span.querySelector('input') || span.querySelector('select')) return;
        const config = this.currentModule;
        const itemId = parseInt(span.dataset.id);
        const colIdx = parseInt(span.dataset.col);
        const col = config.columns[colIdx];
        const ie = col.inlineEdit;
        const item = this.currentData.find(d => d.id === itemId);
        if (!item || !ie) return;
        const currentVal = item[col.key] ?? '';
        const td = span.closest('td');
        const originalHtml = td.innerHTML;

        // Build input element
        let inputHtml;
        const inputStyle = 'padding:2px 6px;font-size:13px;border:1px solid #409eff;border-radius:4px;outline:none;';
        if (ie.type === 'select') {
            inputHtml = `<select class="inline-edit-input" style="${inputStyle}width:80px;">
                ${(ie.options||[]).map(o => `<option value="${o}" ${String(currentVal)===o?'selected':''}>${o}</option>`).join('')}
            </select>`;
        } else if (ie.type === 'datalist') {
            const opts = typeof ie.options === 'function' ? ie.options() : (ie.options || []);
            inputHtml = `<select class="inline-edit-input" style="${inputStyle}width:130px;">
                <option value="">--</option>
                ${opts.map(o => `<option value="${escapeHtml(String(o))}" ${String(currentVal)===String(o)?'selected':''}>${escapeHtml(String(o))}</option>`).join('')}
            </select>`;
        } else if (ie.type === 'number') {
            inputHtml = `<input type="number" step="0.01" class="inline-edit-input" value="${currentVal}" style="${inputStyle}width:90px;">`;
        } else if (ie.type === 'date') {
            inputHtml = `<input type="text" class="inline-edit-input" value="${currentVal}" style="${inputStyle}width:110px;" maxlength="10" placeholder="YYYY-MM-DD">`;
        } else {
            inputHtml = `<input type="text" class="inline-edit-input" value="${escapeHtml(String(currentVal))}" style="${inputStyle}width:120px;">`;
        }
        td.innerHTML = `<div style="display:flex;align-items:center;gap:4px;">
            ${inputHtml}
            <button class="btn btn-sm btn-primary inline-edit-save" style="padding:2px 8px;font-size:12px;">✓</button>
            <button class="btn btn-sm btn-secondary inline-edit-cancel" style="padding:2px 8px;font-size:12px;">✗</button>
        </div>`;
        const input = td.querySelector('.inline-edit-input');
        if (ie.type === 'date') setupDateInput(input);
        input.focus();
        if (input.select) input.select();

        const save = async () => {
            let newVal = input.value;
            if (ie.type === 'number') newVal = parseFloat(newVal) || 0;
            if (String(newVal) === String(currentVal)) { cancel(); return; }
            try {
                await API.update(config.apiModule, itemId, { [col.key]: newVal });
                Toast.show('更新成功', 'success');
                this.loadData();
            } catch (e) {
                Toast.show(e.message || '更新失败', 'error');
                cancel();
            }
        };
        const cancel = () => { td.innerHTML = originalHtml; };

        td.querySelector('.inline-edit-save').onclick = save;
        td.querySelector('.inline-edit-cancel').onclick = cancel;
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); save(); }
            else if (e.key === 'Escape') { cancel(); }
        });
    },

    downloadTemplate() {
        const config = this.currentModule;
        const a = document.createElement('a');
        a.href = `${API.baseUrl}/api/import/${config.apiModule}/template`;
        a.download = '';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
};

// ===== Page Configurations =====

const PAGE_CONFIGS = {
    customers: {
        title: '客户',
        apiModule: 'customers',
        toolbarActions: [
            { label: '合并重复客户', cls: 'btn-warning', handler: 'PAGE_CONFIGS.customers.mergeDuplicates' },
        ],
        async mergeDuplicates() {
            Confirm.open('将自动合并身份证号相同的客户，订单将归并到最早建档记录。确定执行？', async () => {
                try {
                    const r = await API.post('/api/customers/merge-duplicates', {});
                    Confirm.close();
                    if (r.merged_groups === 0) {
                        Toast.show('没有发现重复客户', 'info');
                    } else {
                        Toast.show(`合并完成：${r.merged_groups} 组重复，删除 ${r.removed_duplicates} 条多余记录`, 'success');
                        CrudPage.loadData();
                    }
                } catch (e) {
                    Toast.show('合并失败: ' + e.message, 'error');
                }
            });
        },
        columns: [
            { label: '编号', key: '_rowNum', format: (v) => v },
            { label: '姓名', key: 'name', inlineEdit: { type: 'text' } },
            { label: '电话', key: 'phone', inlineEdit: { type: 'text' } },
            { label: '身份证', key: 'id_card', inlineEdit: { type: 'text' } },
            { label: '地址', key: 'address', inlineEdit: { type: 'text' } },
            { label: '邮箱', key: 'email', inlineEdit: { type: 'text' } },
            { label: '客户经理', key: 'account_manager', inlineEdit: { type: 'datalist', options: () => CompanyInfo._cache.staff.map(s => s.name) } },
            { label: '紧急联系人', key: 'emergency_contact', inlineEdit: { type: 'text' } },
            { label: '当前逾期', key: 'has_overdue', inlineEdit: { type: 'select', options: ['否', '是'] } },
            { label: '有房产', key: 'has_property', inlineEdit: { type: 'select', options: ['否', '是'] } },
        ],
        formFields: [
            { key: 'customer_no', label: '客户编号', type: 'int', placeholder: '留空自动编号' },
            { key: 'name', label: '姓名', type: 'text' },
            { key: 'phone', label: '电话', type: 'text' },
            { key: 'id_card', label: '身份证', type: 'text' },
            { key: 'address', label: '地址', type: 'text' },
            { key: 'email', label: '邮箱', type: 'text' },
            { key: 'account_manager', label: '客户经理', type: 'datalist', options: () => CompanyInfo._cache.staff.map(s => s.name) },
            { key: 'emergency_contact', label: '紧急联系人', type: 'text' },
            { key: 'has_overdue', label: '是否有当前逾期', type: 'combo', options: ['否', '是'] },
            { key: 'has_property', label: '是否有房产', type: 'combo', options: ['否', '是'] },
        ],
    },

    orders: {
        title: '订单',
        apiModule: 'orders',
        paginate: true,
        extraFilter: ['待审核', '已通过', '已结清', '逾期'],
        extraFilterLabel: '状态',
        extraFilterKey: 'status',
        omitOnUpdate: [],
        extraActions: [
            { label: '打印', cls: 'btn-success', handler: 'PAGE_CONFIGS.orders.printOrder' },
        ],
        printOrder(itemId) {
            const item = CrudPage.currentData.find(d => d.id === itemId);
            if (!item) return;
            const weight = parseFloat(item.weight) || 0;
            const downPayment = Math.round(parseFloat(item.down_payment) || 0);
            const notaryFee = Math.round(parseFloat(item.notary_fee) || 0);
            const firstPay = downPayment + notaryFee;
            const totalPrice = Math.round(((parseFloat(item.unit_price)||0) + (parseFloat(item.processing_fee)||0)) * weight);
            const remaining = totalPrice - downPayment;
            const periods = parseInt(item.installment_periods) || 1;
            const perPeriod = Math.round(remaining / periods);
            const rowStyle = 'display:flex;padding:10px 0;border-top:1px dashed #eee;';
            const lcol = 'flex:0 0 40%;';
            const rcol = 'flex:0 0 60%;text-align:left;';

            const bodyRows = `
                <div style="${rowStyle}border-top:none;">
                    <div style="${lcol}"><span class="label">姓名：</span><span class="value">${escapeHtml(item.customer_name || '')}</span></div>
                    <div style="${rcol}"><span class="label">电话：</span><span class="value">${escapeHtml(item.phone || '')}</span></div>
                </div>
                <div style="${rowStyle}">
                    <div style="${lcol}"><span class="label">克重：</span><span class="value">${weight}g</span></div>
                    <div style="${rcol}"><span class="label">总金额：</span><span class="value">${totalPrice}元</span></div>
                </div>
                <div style="${rowStyle}"><span class="label">首付：</span><span class="value">${downPayment}元</span> <span style="color:#999;margin:0 6px;">+</span> <span class="label">公证费：</span><span class="value">${notaryFee}元</span> <span style="color:#999;margin:0 6px;">=</span> <span class="value">${firstPay}元</span></div>
                <div style="${rowStyle}"><span class="label">日付：</span>余款<span class="value">${remaining}元</span> <span style="color:#999;margin:0 4px;">÷</span> <span class="value">${periods}期</span> = <span class="value">${perPeriod}元</span></div>`;

            const previewHtml = `
                <div style="font-family:'Microsoft YaHei','PingFang SC',sans-serif;color:#222;">
                    <div style="border:1px solid #e6e6e6;border-radius:8px;padding:18px 24px;max-width:480px;">
                        <div style="text-align:center;margin-bottom:8px;font-size:18px;font-weight:700;color:#0a3066;">订单还款计划表</div>
                        ${bodyRows}
                    </div>
                </div>`;

            const printHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>打印预览</title>
                <style>
                    body { font-family: "Microsoft YaHei","PingFang SC",sans-serif; padding: 40px; font-size: 16px; color: #222; }
                    .label { color:#666; }
                    .value { font-weight:700; }
                    @media print { body { padding: 20px; } }
                </style></head><body>
                <div style="text-align:center;margin-bottom:8px;font-size:18px;font-weight:700;">订单还款计划表</div>
                ${bodyRows}
                </body></html>`;

            // Open modal with preview and use modal confirm to trigger printing via hidden iframe
            Modal.open('打印预览', previewHtml, () => {
                try {
                    const iframe = document.createElement('iframe');
                    iframe.style.position = 'fixed';
                    iframe.style.right = '9999px';
                    iframe.style.width = '1px';
                    iframe.style.height = '1px';
                    iframe.style.border = '0';
                    document.body.appendChild(iframe);
                    const doc = iframe.contentWindow.document;
                    doc.open();
                    doc.write(printHtml);
                    doc.close();
                    // Wait a tick then call print
                    setTimeout(() => {
                        try {
                            iframe.contentWindow.focus();
                            iframe.contentWindow.print();
                        } catch (e) { console.error('Print error', e); alert('打印失败: ' + (e && e.message)); }
                        // remove iframe after a short delay
                        setTimeout(() => { iframe.remove(); }, 500);
                    }, 300);
                } catch (e) { console.error(e); alert('无法启动打印: ' + e.message); }
            });
        },
        columns: [
            { label: '序号', key: '_rowNum', format: (v) => v },
            { label: '日期', key: 'order_date', inlineEdit: { type: 'date' } },
            { label: '订单编号', key: 'order_no', inlineEdit: { type: 'text' } },
            { label: '客户', key: 'customer_name' },
            { label: '电话', key: 'phone', inlineEdit: { type: 'text' } },
            { label: '客户经理', key: 'account_manager', inlineEdit: { type: 'datalist', options: () => CompanyInfo._cache.staff.map(s => s.name) } },
            { label: '操作员', key: 'operator', inlineEdit: { type: 'datalist', options: () => CompanyInfo._cache.staff.map(s => s.name) } },
            { label: '克重(g)', key: 'weight', inlineEdit: { type: 'number' } },
            { label: '单价', key: 'unit_price', inlineEdit: { type: 'number' } },
            { label: '总金额', key: 'total_price', format: (v, row) => { const t = ((parseFloat(row.unit_price)||0) + (parseFloat(row.processing_fee)||0)) * (parseFloat(row.weight)||0); return t ? Math.round(t) : ''; } },
            { label: '首付', key: 'down_payment', inlineEdit: { type: 'number' } },
            { label: '公证费', key: 'notary_fee', inlineEdit: { type: 'number' } },
            { label: '收款账户', key: 'payment_account', inlineEdit: { type: 'datalist', options: () => CompanyInfo.paymentOptions() } },
            { label: '期数', key: 'installment_periods', inlineEdit: { type: 'number' } },
            { label: '每期', key: 'installment_amount', inlineEdit: { type: 'number' } },
            { label: '状态', key: 'status', inlineEdit: { type: 'select', options: ['待审核', '已通过', '已结清', '逾期'] } },
        ],
        formFields: [
            { key: 'order_date', label: '日期', type: 'date', default: new Date().toISOString().slice(0, 10) },
            { key: 'order_no', label: '订单编号', type: 'text', placeholder: '留空自动生成' },
            { key: 'customer_id', label: '客户姓名', type: 'customer_search', displayKey: 'customer_name', autofill: ['phone', 'id_card', 'address', 'email', 'account_manager', 'emergency_contact', 'has_overdue', 'has_property'] },
            { key: 'phone', label: '电话', type: 'text' },
            { key: 'id_card', label: '身份证', type: 'text' },
            { key: 'address', label: '地址', type: 'text' },
            { key: 'email', label: '邮箱', type: 'text' },
            { key: 'account_manager', label: '客户经理', type: 'datalist', options: () => CompanyInfo._cache.staff.map(s => s.name) },
            { key: 'operator', label: '操作员', type: 'datalist', options: () => CompanyInfo._cache.staff.map(s => s.name), default: '林' },
            { key: 'emergency_contact', label: '紧急联系人', type: 'text' },
            { key: 'has_overdue', label: '是否有当前逾期', type: 'combo', options: ['否', '是'] },
            { key: 'has_property', label: '是否有房产', type: 'combo', options: ['否', '是'] },
            { key: 'weight', label: '克重(g)', type: 'number' },
            { key: 'unit_price', label: '单价(元/g)', type: 'number' },
            { key: 'processing_fee', label: '加工费', type: 'number' },
            { key: 'total_price', label: '总金额', type: 'number', readonly: true },
            { key: 'down_payment_ratio', label: '首付比例(%)', type: 'number' },
            { key: 'down_payment', label: '首付金额', type: 'number' },
            { key: 'notary_fee', label: '公证费', type: 'number' },
            { key: 'payment_account', label: '收款账户', type: 'datalist', options: () => CompanyInfo.paymentOptions() },
            { key: 'installment_periods', label: '分期期数', type: 'int' },
            { key: 'installment_amount', label: '每期金额', type: 'number' },
            { key: 'status', label: '状态', type: 'combo', options: ['待审核', '已通过', '已结清', '逾期'] },
            { key: 'credit_report_fee', label: '征信费', type: 'number' },
            { key: 'lawsuit_fee', label: '诉讼费', type: 'number' },
        ],
        onFormReady() {
            function getVal(id) { return parseFloat(document.getElementById(id)?.value) || 0; }

            function updateTotalPrice() {
                const unitPrice = getVal('field-unit_price');
                const processingFee = getVal('field-processing_fee');
                const weight = getVal('field-weight');
                const totalPrice = (unitPrice + processingFee) * weight;
                const tpEl = document.getElementById('field-total_price');
                if (tpEl) tpEl.value = totalPrice ? Math.round(totalPrice) : '';
                return totalPrice;
            }

            function calcDownAndInstallment() {
                const totalPrice = updateTotalPrice();
                const ratio = getVal('field-down_payment_ratio');
                const periods = getVal('field-installment_periods');
                // Only auto-fill down_payment and installment_amount when ratio is set
                if (ratio > 0) {
                    const downPayment = totalPrice * ratio / 100;
                    const dpEl = document.getElementById('field-down_payment');
                    if (dpEl) dpEl.value = downPayment ? Math.round(downPayment) : '';
                    if (periods > 0) {
                        const installment = (totalPrice - downPayment) / periods;
                        const iaEl = document.getElementById('field-installment_amount');
                        if (iaEl) iaEl.value = installment ? Math.round(installment) : '';
                    }
                }
            }

            // Price/weight changes only update the readonly total_price field
            ['field-unit_price', 'field-processing_fee', 'field-weight'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('input', updateTotalPrice);
            });
            // Ratio/periods changes recalculate down_payment and installment_amount (only when ratio > 0)
            ['field-down_payment_ratio', 'field-installment_periods'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('input', calcDownAndInstallment);
            });
        },
    },

    repayments: {
        title: '还款计划',
        apiModule: 'repayments',
        columns: [
            { label: '序号', key: '_rowNum' },
            { label: '客户', key: 'customer_name' },
            { label: '订单号', key: 'order_no' },
            { label: '总额', key: 'order_total_price' },
            { label: '已还', key: 'paid_total' },
            { label: '进度', key: 'progress' },
            { label: '回款率', key: 'repayment_rate' },
            { label: '利润', key: 'profit' },
            { label: '利润率', key: 'profit_rate' },
        ],
        formFields: [],

        customLoad(params) {
            // Use the summary endpoint: one row per order, much faster than loading all periods
            return API.repaymentsSummary(params).then(async data => {
                // Get overdue pool data to check which orders are already reported
                try {
                    const poolData = await API.list('overdue-pool');
                    const reportedOrderNos = new Set(poolData.map(item => item.notes?.match(/订单号:\s*(\S+)/)?.[1]).filter(Boolean));

                    // Mark orders as reported if they exist in overdue pool
                    data.forEach(item => {
                        if (reportedOrderNos.has(item.order_no)) {
                            item.overdue_reported = true;
                            item.overdue_reported_at = '已上报';
                        }
                    });
                } catch (e) {
                    console.warn('Failed to load overdue pool data:', e);
                }
                return data;
            });
        },

        transformData(items) {
            return items.map(item => {
                const downPayment = item.down_payment || 0;
                const installTotal = item.installment_total || 0;
                const paidTotal = item.paid_total || 0;
                const totalExpected = downPayment + installTotal;
                const totalReceived = downPayment + paidTotal;
                const repayRate = totalExpected > 0 ? (totalReceived / totalExpected * 100) : 0;
                return {
                    ...item,
                    id: item.order_id,
                    order_total_price: Math.round(item.order_total_price || 0),
                    paid_total: Math.round(totalReceived),
                    progress: `${item.paid_count}/${item.total_periods} 期`,
                    repayment_rate: repayRate.toFixed(1) + '%',
                    profit: Math.round(item.profit || 0),
                    profit_rate: (item.profit_rate || 0).toFixed(1) + '%',
                };
            });
        },

        customRenderTable(items, crud) {
            const config = crud.currentModule;
            const tbody = document.getElementById('crud-tbody');
            const isMember = CrudPage._isMember();
            if (!items.length) {
                tbody.innerHTML = `<tr><td colspan="${config.columns.length + 1}" class="table-empty">暂无数据</td></tr>`;
                return;
            }
            items.forEach((item, i) => { item._rowNum = i + 1; });
            tbody.innerHTML = items.map(item => {
                const cells = config.columns.map(col => `<td>${escapeHtml(String(item[col.key] ?? ''))}</td>`).join('');
                if (isMember) {
                    return `<tr>${cells}<td class="actions">
                        <button class="btn btn-sm btn-primary" onclick="PAGE_CONFIGS.repayments.openDetail(${item.order_id})">还款明细</button>
                    </td></tr>`;
                }
                const creditBtn = item.credit_reported
                    ? `<span class="status-badge orange" style="cursor:pointer;font-size:12px;" title="${item.credit_reported_at ? '上报时间: ' + item.credit_reported_at : ''}" onclick="PAGE_CONFIGS.repayments.reportCredit(${item.order_id})">已上报征信${item.credit_reported_at ? '<br><span style="font-size:10px;opacity:0.8;">' + item.credit_reported_at + '</span>' : ''}</span>`
                    : `<button class="btn btn-sm" style="background:#ff9800;color:#fff;" onclick="PAGE_CONFIGS.repayments.reportCredit(${item.order_id})">上报征信</button>`;
                const lawsuitBtn = item.lawsuit_filed
                    ? `<span class="status-badge red" style="cursor:pointer;font-size:12px;" title="${item.lawsuit_filed_at ? '起诉时间: ' + item.lawsuit_filed_at : ''}" onclick="PAGE_CONFIGS.repayments.lawsuit(${item.order_id})">已起诉${item.lawsuit_filed_at ? '<br><span style="font-size:10px;opacity:0.8;">' + item.lawsuit_filed_at + '</span>' : ''}</span>`
                    : `<button class="btn btn-sm" style="background:#e53935;color:#fff;" onclick="PAGE_CONFIGS.repayments.lawsuit(${item.order_id})">起诉</button>`;
                const overdueBtn = item.overdue_reported
                    ? `<span class="status-badge purple" style="font-size:12px;" title="${item.overdue_reported_at ? '上报时间: ' + item.overdue_reported_at : ''}">已上报公共池${item.overdue_reported_at ? '<br><span style="font-size:10px;opacity:0.8;">' + item.overdue_reported_at + '</span>' : ''}</span>`
                    : `<button class="btn btn-sm" style="background:#6a1b9a;color:#fff;" onclick="PAGE_CONFIGS.repayments.reportOverdue(${item.order_id})">上报公共池</button>`;
                return `<tr>${cells}<td class="actions">
                    <button class="btn btn-sm btn-primary" onclick="PAGE_CONFIGS.repayments.openDetail(${item.order_id})">还款明细</button>
                    ${creditBtn} ${lawsuitBtn} ${overdueBtn}
                    <button class="btn btn-sm btn-danger" onclick="PAGE_CONFIGS.repayments.deleteAll(${item.order_id})">删除</button>
                </td></tr>`;
            }).join('');
        },

        _autoStatus(tr) {
            const dueDate = tr.querySelector('.rp-due-date-text').textContent;
            const totalAmount = parseFloat(tr.querySelector('.rp-total-text').textContent) || 0;
            const paidAmount = parseFloat(tr.querySelector('.rp-paid').value) || 0;
            const paidDate = tr.querySelector('.rp-paid-date').value;
            const statusEl = tr.querySelector('.rp-status');
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

            let status;
            if (paidAmount >= totalAmount && paidDate) {
                status = paidDate <= dueDate ? '已还' : '逾期还款';
            } else if (paidAmount > 0 && paidDate) {
                status = paidDate > dueDate ? '逾期未还' : '待还';
            } else {
                if (today < dueDate) status = '待还';
                else if (today === dueDate) status = '未还';
                else status = '逾期未还';
            }
            statusEl.value = status;
        },

        async openDetail(orderId) {
            const cfg = PAGE_CONFIGS.repayments;
            let periods;
            try {
                const raw = await API.list('repayments', { order_id: orderId });
                periods = raw.sort((a, b) => a.period_no - b.period_no);
            } catch (e) {
                Toast.show('加载还款明细失败: ' + e.message, 'error');
                return;
            }
            if (!periods.length) return;
            const _isMember = CrudPage._isMember();
            const statuses = ['待还', '未还', '已还', '逾期还款', '逾期未还'];
            const _today = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; })();
            let html = `<div id="rp-periods-wrap">
                ${_isMember ? '' : `<div style="margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-primary" id="rp-batch-fill">未还期数一键还清</button>
                    <button class="btn btn-sm btn-secondary" id="rp-batch-today">未还期数填入按时</button>
                    <button class="btn btn-sm btn-secondary" id="rp-batch-amount">未还期数填入应还</button>
                    <select id="rp-batch-account-input" style="width:140px;padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px;"><option value="">选择账户</option>${CompanyInfo.paymentOptions().map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('')}</select>
                    <button class="btn btn-sm btn-secondary" id="rp-batch-account">批量填入账户</button>
                </div>`}
                <table class="data-table" id="rp-periods-table" style="font-size:13px;">
                <thead><tr><th>期次</th><th>到期日</th><th>应还</th><th>已还金额</th><th>还款日期</th><th>收款账户</th><th>状态</th></tr></thead><tbody>`;
            periods.forEach(p => {
                html += `<tr data-id="${p.id}">
                    <td>${p.period_no}</td>
                    <td class="rp-due-date-text">${p.due_date}</td>
                    <td class="rp-total-text">${p.total_amount}</td>
                    <td>${_isMember ? (p.paid_amount || '') : `<div style="display:flex;align-items:center;gap:4px;"><input type="number" step="0.01" class="rp-paid" value="${p.paid_amount || ''}" style="width:80px;"><button class="rp-quick-btn rp-fill-amount" title="填入应还金额">&#8592;</button></div>`}</td>
                    <td>${_isMember ? (p.paid_date || '') : `<div style="display:flex;align-items:center;gap:4px;"><input type="text" class="rp-paid-date" value="${p.paid_date || ''}" style="width:110px;" maxlength="10" placeholder="YYYY-MM-DD"><button class="rp-quick-btn rp-date-dec" title="日期-1" style="font-size:10px;padding:0 3px;">&#9660;</button><button class="rp-quick-btn rp-date-inc" title="日期+1" style="font-size:10px;padding:0 3px;">&#9650;</button><button class="rp-quick-btn rp-fill-today" title="填入到期日">期</button></div>`}</td>
                    <td>${_isMember ? escapeHtml(p.payment_account || '') : `<select class="rp-account" style="width:130px;"><option value="">--</option>${CompanyInfo.paymentOptions().map(o => `<option value="${escapeHtml(o)}" ${p.payment_account === o ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}</select>`}</td>
                    <td>${_isMember ? escapeHtml(p.status || '') : `<select class="rp-status" style="width:90px;">
                        ${statuses.map(s => `<option value="${s}" ${p.status === s ? 'selected' : ''}>${s}</option>`).join('')}`}
                    </select></td>
                </tr>`;
            });
            html += '</tbody></table>';
            html += `<datalist id="rp-account-list">${CompanyInfo.paymentOptions().map(o => `<option value="${escapeHtml(o)}">`).join('')}</datalist>`;
            html += '</div>';

            const _saveCallback = _isMember ? null : async () => {
                const rows = document.querySelectorAll('#rp-periods-table tbody tr');
                try {
                    const updates = [];
                    for (const tr of rows) {
                        updates.push({
                            id: parseInt(tr.dataset.id),
                            paid_amount: parseFloat(tr.querySelector('.rp-paid').value) || 0,
                            paid_date: tr.querySelector('.rp-paid-date').value || null,
                            payment_account: tr.querySelector('.rp-account').value || '',
                            status: tr.querySelector('.rp-status').value,
                        });
                    }
                    await API.put('/api/repayments/batch', updates);
                    Toast.show('保存成功', 'success');
                    Modal.close();
                    CrudPage.loadData();
                } catch (e) { Toast.show('保存失败: ' + e.message, 'error'); }
            };
            Modal.open(`还款明细 - ${periods[0].order_no}`, html, _saveCallback);

            if (_isMember) return; // Member: read-only, no event bindings needed

            // Init date inputs in repayment detail
            document.querySelectorAll('#rp-periods-table .rp-paid-date').forEach(el => setupDateInput(el));

            // Bind auto-status on paid_amount / paid_date change
            const allRows = document.querySelectorAll('#rp-periods-table tbody tr');
            allRows.forEach(tr => {
                const calc = () => cfg._autoStatus(tr);
                tr.querySelector('.rp-paid').addEventListener('input', calc);
                tr.querySelector('.rp-paid-date').addEventListener('input', calc);
                // Per-row quick buttons
                tr.querySelector('.rp-fill-amount').onclick = () => {
                    const total = tr.querySelector('.rp-total-text').textContent;
                    tr.querySelector('.rp-paid').value = total;
                    calc();
                };
                tr.querySelector('.rp-fill-today').onclick = () => {
                    tr.querySelector('.rp-paid-date').value = tr.querySelector('.rp-due-date-text').textContent;
                    calc();
                };
                // Date +1 / -1 buttons
                const _adjustDate = (input, delta) => {
                    const v = input.value;
                    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
                        const d = new Date(v + 'T12:00:00');
                        d.setDate(d.getDate() + delta);
                        input.value = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
                    }
                    calc();
                };
                tr.querySelector('.rp-date-dec').onclick = () => _adjustDate(tr.querySelector('.rp-paid-date'), -1);
                tr.querySelector('.rp-date-inc').onclick = () => _adjustDate(tr.querySelector('.rp-paid-date'), 1);
                cfg._autoStatus(tr);
            });

            // Batch buttons
            const _isUnpaid = (tr) => {
                const s = tr.querySelector('.rp-status').value;
                return s !== '已还' && s !== '逾期还款';
            };
            document.getElementById('rp-batch-fill').onclick = () => {
                allRows.forEach(tr => {
                    if (!_isUnpaid(tr)) return;
                    tr.querySelector('.rp-paid').value = tr.querySelector('.rp-total-text').textContent;
                    tr.querySelector('.rp-paid-date').value = tr.querySelector('.rp-due-date-text').textContent;
                    cfg._autoStatus(tr);
                });
            };
            document.getElementById('rp-batch-today').onclick = () => {
                allRows.forEach(tr => {
                    if (!_isUnpaid(tr)) return;
                    tr.querySelector('.rp-paid-date').value = tr.querySelector('.rp-due-date-text').textContent;
                    cfg._autoStatus(tr);
                });
            };
            document.getElementById('rp-batch-amount').onclick = () => {
                allRows.forEach(tr => {
                    if (!_isUnpaid(tr)) return;
                    tr.querySelector('.rp-paid').value = tr.querySelector('.rp-total-text').textContent;
                    cfg._autoStatus(tr);
                });
            };
            document.getElementById('rp-batch-account').onclick = () => {
                const val = document.getElementById('rp-batch-account-input').value;
                if (!val) return;
                allRows.forEach(tr => {
                    tr.querySelector('.rp-account').value = val;
                });
            };
        },

        deleteAll(orderId) {
            Confirm.open('确定删除此订单的所有还款计划吗？', async () => {
                try {
                    await API.deleteRepaymentsByOrder(orderId);
                    Toast.show('删除成功', 'success');
                    Confirm.close();
                    CrudPage.loadData();
                } catch (e) { Toast.show('删除失败: ' + e.message, 'error'); }
            });
        },

        _nowDatetimeLocal() {
            const now = new Date();
            const p = n => String(n).padStart(2, '0');
            return `${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}`;
        },

        reportCredit(orderId) {
            const item = CrudPage.currentData.find(d => d.order_id === orderId);
            if (!item) return;
            const isSet = item.credit_reported;
            const dtVal = isSet && item.credit_reported_at ? item.credit_reported_at : this._nowDatetimeLocal().replace('T', ' ');
            const html = `<div style="margin-bottom:12px;">
                <p style="margin-bottom:8px;">客户：<b>${escapeHtml(item.customer_name)}</b></p>
                <label>上报征信时间：</label>
                <input type="text" id="credit-date-input" value="${dtVal}" placeholder="YYYY-MM-DD HH:mm" maxlength="16" style="width:180px;">
            </div>
            ${isSet ? '<div><a href="#" id="cancel-credit-link" style="color:#e53935;font-size:13px;">撤销征信上报</a></div>' : ''}`;

            Modal.open(isSet ? '修改征信上报' : '上报征信', html, async () => {
                const dateVal = document.getElementById('credit-date-input').value;
                if (!dateVal || dateVal.length < 16) { Toast.show('请输入完整日期时间', 'error'); return; }
                try {
                    await API.update('orders', orderId, { credit_reported: true, credit_reported_at: dateVal });
                    Toast.show('已更新征信上报', 'success');
                    Modal.close();
                    CrudPage.loadData();
                } catch (e) { Toast.show('操作失败: ' + e.message, 'error'); }
            });

            // Auto-format: digits → YYYY-MM-DD HH:mm
            document.getElementById('credit-date-input').addEventListener('input', function() {
                const pos = this.selectionStart;
                const before = this.value;
                const d = before.replace(/[^\d]/g, '').slice(0, 12);
                let f = '';
                if (d.length > 10) f = d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8)+' '+d.slice(8,10)+':'+d.slice(10);
                else if (d.length > 8) f = d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8)+' '+d.slice(8);
                else if (d.length > 6) f = d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6);
                else if (d.length > 4) f = d.slice(0,4)+'-'+d.slice(4);
                else f = d;
                this.value = f;
                const np = pos + (f.length - before.length);
                this.setSelectionRange(Math.max(0, np), Math.max(0, np));
            });

            if (isSet) {
                document.getElementById('cancel-credit-link')?.addEventListener('click', async (e) => {
                    e.preventDefault();
                    try {
                        await API.update('orders', orderId, { credit_reported: false });
                        Toast.show('已撤销征信上报', 'success');
                        Modal.close();
                        CrudPage.loadData();
                    } catch (e2) { Toast.show('操作失败: ' + e2.message, 'error'); }
                });
            }
        },

        lawsuit(orderId) {
            const item = CrudPage.currentData.find(d => d.order_id === orderId);
            if (!item) return;
            const isSet = item.lawsuit_filed;
            const dtVal = isSet && item.lawsuit_filed_at ? item.lawsuit_filed_at.replace(' ', 'T') : this._nowDatetimeLocal();
            const html = `<div style="margin-bottom:12px;">
                <p style="margin-bottom:8px;">客户：<b>${escapeHtml(item.customer_name)}</b></p>
                <label>起诉时间：</label>
                <input type="datetime-local" id="lawsuit-date-input" value="${dtVal}" style="width:220px;">
            </div>
            ${isSet ? '<div><a href="#" id="cancel-lawsuit-link" style="color:#e53935;font-size:13px;">撤销起诉</a></div>' : ''}`;

            Modal.open(isSet ? '修改起诉时间' : '发起起诉', html, async () => {
                const dateVal = document.getElementById('lawsuit-date-input').value;
                if (!dateVal) { Toast.show('请选择日期', 'error'); return; }
                try {
                    await API.update('orders', orderId, { lawsuit_filed: true, lawsuit_filed_at: dateVal.replace('T', ' ') });
                    Toast.show('已更新起诉信息', 'success');
                    Modal.close();
                    CrudPage.loadData();
                } catch (e) { Toast.show('操作失败: ' + e.message, 'error'); }
            });

            if (isSet) {
                document.getElementById('cancel-lawsuit-link')?.addEventListener('click', async (e) => {
                    e.preventDefault();
                    try {
                        await API.update('orders', orderId, { lawsuit_filed: false });
                        Toast.show('已撤销起诉', 'success');
                        Modal.close();
                        CrudPage.loadData();
                    } catch (e2) { Toast.show('操作失败: ' + e2.message, 'error'); }
                });
            }
        },

        reportOverdue(orderId) {
            const item = CrudPage.currentData.find(d => d.order_id === orderId);
            if (!item) return;
            if (item.overdue_reported) {
                Toast.show('该订单已上报过公共池', 'warning');
                return;
            }
            const unpaidAmount = Math.max(0, Math.round((item.installment_total || 0) - (item.paid_total || 0)));
            const totalPeriods = item.total_periods || 0;
            const paidCount = item.paid_count || 0;
            const unpaidPeriods = Math.max(0, totalPeriods - paidCount);
            const html = `<div style="display:flex;flex-direction:column;gap:10px;">
                <div><label>客户姓名：</label><input type="text" id="rp-od-name" value="${escapeHtml(item.customer_name || '')}" style="width:200px;"></div>
                <div><label>身份证号：</label><input type="text" id="rp-od-idcard" value="${escapeHtml(item.customer_id_card || '')}" style="width:200px;"></div>
                <div><label>手机号：</label><input type="text" id="rp-od-phone" value="${escapeHtml(item.customer_phone || '')}" style="width:200px;"></div>
                <div><label>地址：</label><input type="text" id="rp-od-address" value="${escapeHtml(item.customer_address || '')}" style="width:300px;"></div>
                <div><label>逾期金额：</label><input type="number" id="rp-od-amount" value="${unpaidAmount}" style="width:200px;"></div>
                <div><label>逾期期数：</label><input type="number" id="rp-od-periods" value="${unpaidPeriods}" style="width:200px;"></div>
                <div><label>订单日期：</label><input type="text" id="rp-od-date" value="${escapeHtml(item.order_date || '')}" style="width:200px;" placeholder="YYYY-MM-DD" maxlength="10"></div>
                <div><label>备注：</label><textarea id="rp-od-notes" style="width:300px;height:60px;" placeholder="订单号: ${escapeHtml(item.order_no || '')}">订单号: ${escapeHtml(item.order_no || '')}</textarea></div>
            </div>`;

            Modal.open('上报逾期公共池', html, async () => {
                const data = {
                    customer_name: document.getElementById('rp-od-name').value,
                    id_card: document.getElementById('rp-od-idcard').value,
                    phone: document.getElementById('rp-od-phone').value,
                    address: document.getElementById('rp-od-address').value,
                    overdue_amount: document.getElementById('rp-od-amount').value,
                    overdue_periods: document.getElementById('rp-od-periods').value,
                    overdue_date: document.getElementById('rp-od-date').value,
                    notes: document.getElementById('rp-od-notes').value,
                    reported_by: API.tenantInfo?.name || API.userInfo?.real_name || '',
                };
                if (!data.customer_name) { Toast.show('请填写客户姓名', 'error'); return; }
                try {
                    await API.create('overdue-pool', data);
                    await API.update('orders', orderId, { overdue_reported: true, overdue_reported_at: new Date().toISOString().slice(0, 19).replace('T', ' ') });
                    Toast.show('已上报至逾期公共池', 'success');
                    Modal.close();
                    CrudPage.loadData();
                } catch (e) { Toast.show('上报失败: ' + e.message, 'error'); }
            });
        },

        customOpenForm(itemId, crud) {
            let _orderCache = {};
            const pad = n => String(n).padStart(2, '0');

            function generatePreview(order) {
                const periods = order.installment_periods || 0;
                const amount = parseFloat(order.installment_amount) || 0;
                if (!periods) return '';
                const [by, bm, bd] = order.order_date.split('-').map(Number);
                let html = `<table class="data-table" id="rp-preview-table" style="font-size:13px;margin-top:8px;">
                    <thead><tr><th>期次</th><th>到期日</th><th>每期金额</th></tr></thead><tbody>`;
                for (let i = 1; i <= periods; i++) {
                    const dueDate = new Date(by, bm - 1, bd + i);
                    const dueDateStr = `${dueDate.getFullYear()}-${pad(dueDate.getMonth() + 1)}-${pad(dueDate.getDate())}`;
                    html += `<tr>
                        <td>${i}</td>
                        <td><input type="text" class="rp-gen-date" value="${dueDateStr}" style="width:110px;" maxlength="10" placeholder="YYYY-MM-DD"></td>
                        <td><input type="number" step="1" class="rp-gen-amount" value="${Math.round(amount)}" style="width:100px;"></td>
                    </tr>`;
                }
                html += '</tbody></table>';
                return html;
            }

            const formHtml = `<div class="form-row">
                <div class="form-group">
                    <label>客户</label>
                    <div class="autocomplete-wrap">
                        <input type="text" id="rp-customer-search" autocomplete="off" placeholder="输入客户姓名搜索...">
                        <div class="autocomplete-dropdown" id="rp-customer-dropdown"></div>
                    </div>
                </div>
                <div class="form-group">
                    <label>订单</label>
                    <select id="rp-order-select" disabled><option value="">请先选择客户</option></select>
                </div>
            </div>
            <div id="rp-order-info" style="margin-bottom:8px;color:#666;font-size:13px;"></div>
            <div id="rp-preview-wrap"></div>`;

            Modal.open('新增还款计划', formHtml, async () => {
                const orderId = parseInt(document.getElementById('rp-order-select').value);
                if (!orderId) { Toast.show('请选择订单', 'error'); return; }
                const rows = document.querySelectorAll('#rp-preview-table tbody tr');
                if (!rows.length) { Toast.show('请先选择订单以生成还款计划', 'error'); return; }
                const items = [];
                rows.forEach((tr, i) => {
                    const dueDate = tr.querySelector('.rp-gen-date').value;
                    const amount = parseFloat(tr.querySelector('.rp-gen-amount').value) || 0;
                    items.push({
                        order_id: orderId,
                        period_no: i + 1,
                        due_date: dueDate,
                        principal: Math.round(amount),
                        interest: 0,
                        total_amount: Math.round(amount),
                    });
                });
                try {
                    await API.batchCreate('repayments', items);
                    Toast.show(`已生成 ${items.length} 期还款计划`, 'success');
                    Modal.close();
                    crud.loadData();
                } catch (e) { Toast.show('操作失败: ' + e.message, 'error'); }
            });

            // Customer search
            const searchInput = document.getElementById('rp-customer-search');
            const dropdown = document.getElementById('rp-customer-dropdown');
            const orderSelect = document.getElementById('rp-order-select');
            let _customers = [];

            searchInput.addEventListener('input', debounce(async () => {
                const kw = searchInput.value.trim();
                if (!kw) { dropdown.style.display = 'none'; return; }
                try {
                    const customers = await API.list('customers', { keyword: kw });
                    _customers = customers;
                    if (!customers.length) {
                        dropdown.innerHTML = '<div class="autocomplete-item empty">无匹配客户</div>';
                    } else {
                        dropdown.innerHTML = customers.map((c, i) =>
                            `<div class="autocomplete-item" data-idx="${i}">
                                <div class="ac-name">${escapeHtml(c.name)}</div>
                                <div class="ac-detail">${escapeHtml(c.phone || '')} · ${escapeHtml(c.id_card || '')}</div>
                            </div>`
                        ).join('');
                    }
                    dropdown.style.display = 'block';
                    dropdown.querySelectorAll('.autocomplete-item:not(.empty)').forEach(el => {
                        el.onclick = async () => {
                            const c = _customers[parseInt(el.dataset.idx)];
                            searchInput.value = c.name;
                            dropdown.style.display = 'none';
                            const customerOrders = await API.list('orders', { customer_id: c.id });
                            if (!customerOrders.length) {
                                orderSelect.innerHTML = '<option value="">该客户暂无订单</option>';
                                orderSelect.disabled = true;
                                document.getElementById('rp-order-info').innerHTML = '';
                                document.getElementById('rp-preview-wrap').innerHTML = '';
                                return;
                            }
                            customerOrders.forEach(o => { _orderCache[o.id] = o; });
                            orderSelect.disabled = false;
                            orderSelect.innerHTML = '<option value="">请选择订单</option>' +
                                customerOrders.map(o => `<option value="${o.id}">${escapeHtml(o.order_no)} (${o.installment_periods}期 · 每期${o.installment_amount}元)</option>`).join('');
                            document.getElementById('rp-preview-wrap').innerHTML = '';
                        };
                    });
                } catch (e) { dropdown.style.display = 'none'; }
            }, 300));

            document.addEventListener('click', (e) => {
                if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) dropdown.style.display = 'none';
            });

            orderSelect.addEventListener('change', () => {
                const orderId = parseInt(orderSelect.value);
                const infoEl = document.getElementById('rp-order-info');
                const previewWrap = document.getElementById('rp-preview-wrap');
                if (!orderId) { infoEl.innerHTML = ''; previewWrap.innerHTML = ''; return; }
                const order = _orderCache[orderId];
                if (order) {
                    infoEl.innerHTML = `分期期数: <b>${order.installment_periods}</b> 期 &nbsp;|&nbsp; 每期金额: <b>${order.installment_amount}</b> 元 &nbsp;|&nbsp; 首付: <b>${order.down_payment}</b> 元`;
                    previewWrap.innerHTML = generatePreview(order);
                    previewWrap.querySelectorAll('.rp-gen-date').forEach(el => setupDateInput(el));
                }
            });
        },
    },

    warehouse: {
        title: '入库记录',
        apiModule: 'warehouse',
        columns: [
            { label: 'ID', key: 'id' },
            { label: '编号', key: 'item_no', inlineEdit: { type: 'text' } },
            { label: '条码', key: 'barcode', inlineEdit: { type: 'text' } },
            { label: '克重', key: 'weight', inlineEdit: { type: 'number' } },
            { label: '单价', key: 'unit_price', inlineEdit: { type: 'number' } },
            { label: '总价', key: 'total_price', inlineEdit: { type: 'number' } },
            { label: '入库时间', key: 'entry_date', inlineEdit: { type: 'date' } },
            { label: '入库员', key: 'entry_operator', inlineEdit: { type: 'datalist', options: () => CompanyInfo._cache.staff.map(s => s.name) } },
            { label: '出库时间', key: 'exit_date', inlineEdit: { type: 'date' } },
            { label: '出库员', key: 'exit_operator', inlineEdit: { type: 'datalist', options: () => CompanyInfo._cache.staff.map(s => s.name) } },
            { label: '买家', key: 'buyer', inlineEdit: { type: 'text' } },
            { label: '销售', key: 'salesperson', inlineEdit: { type: 'datalist', options: () => CompanyInfo._cache.staff.map(s => s.name) } },
            { label: '关联订单', key: 'notes', inlineEdit: { type: 'datalist', options: () => CompanyInfo._cache.orderNos } },
        ],
        formFields: [
            { key: 'item_no', label: '编号', type: 'text' },
            { key: 'barcode', label: '条码', type: 'text' },
            { key: 'weight', label: '克重(g)', type: 'number' },
            { key: 'unit_price', label: '单价', type: 'number' },
            { key: 'total_price', label: '总价', type: 'number', readonly: true },
            { key: 'entry_date', label: '入库时间', type: 'date' },
            { key: 'entry_operator', label: '入库员', type: 'datalist', options: () => CompanyInfo._cache.staff.map(s => s.name), default: '林' },
            { key: 'exit_date', label: '出库时间', type: 'date' },
            { key: 'exit_operator', label: '出库员', type: 'datalist', options: () => CompanyInfo._cache.staff.map(s => s.name), default: '林' },
            { key: 'buyer', label: '买家', type: 'text' },
            { key: 'salesperson', label: '销售', type: 'datalist', options: () => CompanyInfo._cache.staff.map(s => s.name), default: '林' },
            { key: 'notes', label: '关联订单', type: 'datalist', options: () => CompanyInfo._cache.orderNos },
        ],
        onFormReady() {
            function getVal(id) { return parseFloat(document.getElementById(id)?.value) || 0; }
            function calc() {
                const weight = getVal('field-weight');
                const unitPrice = getVal('field-unit_price');
                const total = weight * unitPrice;
                const el = document.getElementById('field-total_price');
                if (el) el.value = total ? total.toFixed(2) : '';
            }
            ['field-weight', 'field-unit_price'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('input', calc);
            });
        },
    },

    inventory: {
        title: '库存',
        apiModule: 'inventory',
        readOnly: true,
        columns: [
            { label: 'ID', key: 'id' },
            { label: '编号', key: 'item_no' },
            { label: '条码', key: 'barcode' },
            { label: '克重', key: 'weight' },
            { label: '入库时间', key: 'entry_date' },
            { label: '入库员', key: 'entry_operator' },
            { label: '关联订单', key: 'notes' },
        ],
        formFields: [],
    },

    appointments: {
        title: '预约',
        apiModule: 'appointments',
        extraFilter: ['待确认', '已确认', '已完成', '已取消'],
        extraFilterLabel: '状态',
        extraFilterKey: 'status',
        extraActions: [
            { label: '打印', cls: 'btn-success', handler: 'PAGE_CONFIGS.appointments.printAppt' },
        ],
        printAppt(itemId) {
            const item = CrudPage.currentData.find(d => d.id === itemId);
            if (!item) return;
            const statusColor = {'待确认':'#e6a23c','已确认':'#409eff','已完成':'#67c23a','已取消':'#999'}[item.status] || '#666';
            const bodyHtml = `
                <div style="font-family:'Microsoft YaHei','PingFang SC',sans-serif;color:#333;max-width:420px;margin:0 auto;">
                    <div style="text-align:center;margin-bottom:16px;">
                        <div style="font-size:20px;font-weight:700;color:#0a3066;letter-spacing:2px;">预约确认单</div>
                        <div style="font-size:12px;color:#999;margin-top:4px;">Appointment Confirmation</div>
                    </div>
                    <div style="border-top:2px solid #0a3066;border-bottom:2px solid #0a3066;padding:16px 0;">
                        <table style="width:100%;border-collapse:collapse;font-size:15px;">
                            <tr>
                                <td style="padding:8px 0;color:#888;width:80px;">客户姓名</td>
                                <td style="padding:8px 0;font-weight:600;">${escapeHtml(item.customer_name || '')}</td>
                                <td style="padding:8px 0;color:#888;width:80px;text-align:right;padding-right:8px;">联系电话</td>
                                <td style="padding:8px 0;font-weight:600;">${escapeHtml(item.phone || '')}</td>
                            </tr>
                            <tr style="border-top:1px dashed #e0e0e0;">
                                <td style="padding:8px 0;color:#888;">预约日期</td>
                                <td style="padding:8px 0;font-weight:600;">${escapeHtml(item.appointment_date || '')}</td>
                                <td style="padding:8px 0;color:#888;text-align:right;padding-right:8px;">预约时间</td>
                                <td style="padding:8px 0;font-weight:600;">${escapeHtml(item.appointment_time || '')}</td>
                            </tr>
                            <tr style="border-top:1px dashed #e0e0e0;">
                                <td style="padding:8px 0;color:#888;">预约事由</td>
                                <td colspan="3" style="padding:8px 0;font-weight:600;">${escapeHtml(item.purpose || '')}</td>
                            </tr>
                            <tr style="border-top:1px dashed #e0e0e0;">
                                <td style="padding:8px 0;color:#888;">当前状态</td>
                                <td colspan="3" style="padding:8px 0;"><span style="display:inline-block;padding:2px 12px;border-radius:10px;font-size:13px;font-weight:600;color:#fff;background:${statusColor};">${escapeHtml(item.status || '')}</span></td>
                            </tr>
                            ${item.notes ? `<tr style="border-top:1px dashed #e0e0e0;">
                                <td style="padding:8px 0;color:#888;vertical-align:top;">备注</td>
                                <td colspan="3" style="padding:8px 0;color:#555;">${escapeHtml(item.notes)}</td>
                            </tr>` : ''}
                        </table>
                    </div>
                    <div style="margin-top:12px;display:flex;justify-content:space-between;font-size:13px;color:#aaa;">
                        <span>打印时间：${new Date().toLocaleString('zh-CN')}</span>
                        <span>编号：${item.id}</span>
                    </div>
                </div>`;
            const previewHtml = `<div style="border:1px solid #e6e6e6;border-radius:8px;padding:20px 24px;">${bodyHtml}</div>`;
            const printHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>预约确认单</title>
                <style>body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;padding:40px;color:#333;}@media print{body{padding:20px;}}</style>
                </head><body>${bodyHtml}</body></html>`;
            Modal.open('打印预览', previewHtml, () => {
                try {
                    const iframe = document.createElement('iframe');
                    iframe.style.cssText = 'position:fixed;right:9999px;width:1px;height:1px;border:0';
                    document.body.appendChild(iframe);
                    const doc = iframe.contentWindow.document;
                    doc.open(); doc.write(printHtml); doc.close();
                    setTimeout(() => {
                        try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { alert('打印失败: ' + e.message); }
                        setTimeout(() => iframe.remove(), 500);
                    }, 300);
                } catch (e) { alert('无法启动打印: ' + e.message); }
            });
        },
        columns: [
            { label: 'ID', key: 'id' },
            { label: '客户', key: 'customer_name' },
            { label: '电话', key: 'phone' },
            { label: '预约日期', key: 'appointment_date' },
            { label: '预约时间', key: 'appointment_time' },
            { label: '事由', key: 'purpose' },
            { label: '状态', key: 'status' },
            { label: '备注', key: 'notes' },
        ],
        formFields: [
            { key: 'customer_id', label: '客户姓名', type: 'customer_search', displayKey: 'customer_name', autofill: ['phone'] },
            { key: 'phone', label: '电话', type: 'text' },
            { key: 'appointment_date', label: '预约日期', type: 'date' },
            { key: 'appointment_time', label: '预约时间', type: 'time' },
            { key: 'purpose', label: '事由', type: 'text' },
            { key: 'status', label: '状态', type: 'combo', options: ['待确认', '已确认', '已完成', '已取消'] },
            { key: 'notes', label: '备注', type: 'textarea' },
        ],
    },

    expenses: {
        title: '支出',
        apiModule: 'expenses',
        extraFilter: ['办公类', '成本类', '借支类', '工资类', '分红类', '投资类'],
        extraFilterLabel: '类别',
        extraFilterKey: 'category',
        extraActions: [
            { label: '打印', cls: 'btn-success', handler: 'PAGE_CONFIGS.expenses.printExpense' },
        ],
        printExpense(itemId) {
            const item = CrudPage.currentData.find(d => d.id === itemId);
            if (!item) return;
            const qty = parseInt(item.quantity) || 0;
            const up = parseFloat(item.unit_price) || 0;
            const tp = parseFloat(item.total_price) || 0;
            const rowStyle = 'display:flex;padding:8px 0;border-top:1px dashed #eee;';
            const lcol = 'flex:0 0 50%;';
            const rcol = 'flex:0 0 50%;';
            const bodyRows = `
                <div style="${rowStyle}border-top:none;">
                    <div style="${lcol}"><span class="label">采购单号：</span><span class="value">${escapeHtml(item.purchase_order_no || '')}</span></div>
                    <div style="${rcol}"><span class="label">日期：</span><span class="value">${escapeHtml(item.expense_date || '')}</span></div>
                </div>
                <div style="${rowStyle}">
                    <div style="${lcol}"><span class="label">供应商：</span><span class="value">${escapeHtml(item.supplier_name || '')}</span></div>
                    <div style="${rcol}"><span class="label">电话：</span><span class="value">${escapeHtml(item.supplier_phone || '')}</span></div>
                </div>
                <div style="${rowStyle}">
                    <div style="width:100%"><span class="label">地址：</span><span class="value">${escapeHtml(item.supplier_address || '')}</span></div>
                </div>
                <div style="${rowStyle}">
                    <div style="${lcol}"><span class="label">产品：</span><span class="value">${escapeHtml(item.product_name || '')}</span></div>
                    <div style="${rcol}"><span class="label">类别：</span><span class="value">${escapeHtml(item.category || '')}</span></div>
                </div>
                <div style="${rowStyle}">
                    <div style="flex:0 0 33%"><span class="label">数量：</span><span class="value">${qty}${escapeHtml(item.unit || '')}</span></div>
                    <div style="flex:0 0 33%"><span class="label">单价：</span><span class="value">${up}元</span></div>
                    <div style="flex:0 0 34%"><span class="label">总价：</span><span class="value">${tp}元</span></div>
                </div>
                <div style="${rowStyle}">
                    <div style="${lcol}"><span class="label">收货人：</span><span class="value">${escapeHtml(item.receiver || '')}</span></div>
                    <div style="${rcol}"><span class="label">电话：</span><span class="value">${escapeHtml(item.receiver_phone || '')}</span></div>
                </div>
                <div style="${rowStyle}">
                    <div style="width:100%"><span class="label">收货地址：</span><span class="value">${escapeHtml(item.receiver_address || '')}</span></div>
                </div>
                ${item.notes ? `<div style="${rowStyle}"><div style="width:100%"><span class="label">备注：</span><span class="value">${escapeHtml(item.notes)}</span></div></div>` : ''}`;
            const previewHtml = `
                <div style="font-family:'Microsoft YaHei','PingFang SC',sans-serif;color:#222;">
                    <div style="border:1px solid #e6e6e6;border-radius:8px;padding:18px 24px;max-width:520px;">
                        <div style="text-align:center;margin-bottom:8px;font-size:18px;font-weight:700;color:#0a3066;">采购单据</div>
                        ${bodyRows}
                    </div>
                </div>`;
            const printHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>采购单据</title>
                <style>
                    body { font-family: "Microsoft YaHei","PingFang SC",sans-serif; padding: 40px; font-size: 16px; color: #222; }
                    .label { color:#666; }
                    .value { font-weight:700; }
                    @media print { body { padding: 20px; } }
                </style></head><body>
                <h2 style="text-align:center;">采购单据</h2>
                ${bodyRows}
                </body></html>`;
            Modal.open('打印预览', previewHtml, () => {
                try {
                    const iframe = document.createElement('iframe');
                    iframe.style.cssText = 'position:fixed;right:9999px;width:1px;height:1px;border:0';
                    document.body.appendChild(iframe);
                    const doc = iframe.contentWindow.document;
                    doc.open(); doc.write(printHtml); doc.close();
                    setTimeout(() => {
                        try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { alert('打印失败: ' + e.message); }
                        setTimeout(() => iframe.remove(), 500);
                    }, 300);
                } catch (e) { alert('无法启动打印: ' + e.message); }
            });
        },
        columns: [
            { label: '序号', key: 'id' },
            { label: '日期', key: 'expense_date', inlineEdit: { type: 'date' } },
            { label: '采购单号', key: 'purchase_order_no', inlineEdit: { type: 'text' } },
            { label: '供应商', key: 'supplier_name', inlineEdit: { type: 'datalist', options: () => CompanyInfo._cache.suppliers.map(s => s.name) } },
            { label: '电话', key: 'supplier_phone', inlineEdit: { type: 'text' } },
            { label: '地址', key: 'supplier_address', inlineEdit: { type: 'text' } },
            { label: '产品名称', key: 'product_name', inlineEdit: { type: 'text' } },
            { label: '支出类别', key: 'category', inlineEdit: { type: 'select', options: ['办公类', '成本类', '借支类', '工资类', '分红类', '投资类'] } },
            { label: '单位', key: 'unit', inlineEdit: { type: 'text' } },
            { label: '数量', key: 'quantity', inlineEdit: { type: 'number' } },
            { label: '单价', key: 'unit_price', inlineEdit: { type: 'number' } },
            { label: '总价', key: 'total_price', inlineEdit: { type: 'number' } },
            { label: '收货人', key: 'receiver', inlineEdit: { type: 'datalist', options: () => CompanyInfo._cache.staff.map(s => s.name) } },
            { label: '电话', key: 'receiver_phone', inlineEdit: { type: 'text' } },
            { label: '收货地址', key: 'receiver_address', inlineEdit: { type: 'datalist', options: () => CompanyInfo._cache.addresses.map(a => a.address) } },
            { label: '备注', key: 'notes', inlineEdit: { type: 'text' } },
            { label: '支出账户', key: 'payment_account', inlineEdit: { type: 'datalist', options: () => CompanyInfo.paymentOptions() } },
        ],
        formFields: [
            { key: 'expense_date', label: '日期', type: 'date', default: new Date().toISOString().slice(0, 10) },
            { key: 'purchase_order_no', label: '采购单号', type: 'text', placeholder: '留空自动生成', readonly: false },
            { key: 'supplier_name', label: '供应商名称', type: 'datalist', options: () => CompanyInfo._cache.suppliers.map(s => s.name) },
            { key: 'supplier_phone', label: '供应商电话', type: 'text' },
            { key: 'supplier_address', label: '供应商地址', type: 'text' },
            { key: 'product_name', label: '产品名称', type: 'text' },
            { key: 'category', label: '支出类别', type: 'combo', options: ['办公类', '成本类', '借支类', '工资类', '分红类', '投资类'] },
            { key: 'unit', label: '单位', type: 'text' },
            { key: 'quantity', label: '数量', type: 'int' },
            { key: 'unit_price', label: '单价', type: 'number' },
            { key: 'total_price', label: '总价', type: 'number', readonly: true },
            { key: 'receiver', label: '收货人', type: 'datalist', options: () => CompanyInfo._cache.staff.map(s => s.name) },
            { key: 'receiver_phone', label: '收货电话', type: 'text' },
            { key: 'receiver_address', label: '收货地址', type: 'datalist', options: () => CompanyInfo._cache.addresses.map(a => a.address) },
            { key: 'notes', label: '备注', type: 'textarea' },
            { key: 'payment_account', label: '支出账户', type: 'datalist', options: () => CompanyInfo.paymentOptions() },
        ],
        onFormReady() {
            // Auto-calculate total_price = quantity * unit_price
            function getVal(id) { return parseFloat(document.getElementById(id)?.value) || 0; }
            function calc() {
                const qty = getVal('field-quantity');
                const price = getVal('field-unit_price');
                const total = qty * price;
                const el = document.getElementById('field-total_price');
                if (el) el.value = total ? total.toFixed(2) : '';
            }
            ['field-quantity', 'field-unit_price'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('input', calc);
            });

            // Supplier name: auto-fill phone/address from cached CompanyInfo when a known supplier is selected
            const nameEl = document.getElementById('field-supplier_name');
            if (!nameEl) return;
            nameEl.addEventListener('change', () => {
                const match = CompanyInfo._cache.suppliers.find(s => s.name === nameEl.value);
                if (!match) return;
                const phoneEl = document.getElementById('field-supplier_phone');
                const addrEl = document.getElementById('field-supplier_address');
                if (phoneEl && !phoneEl.value) phoneEl.value = match.phone || '';
                if (addrEl && !addrEl.value) addrEl.value = match.address || '';
            });
        },
    },

    overduePool: {
        title: '逾期公共池',
        apiModule: 'overdue-pool',
        columns: [
            { label: '姓名', key: 'customer_name' },
            { label: '身份证号', key: 'id_card' },
            { label: '手机号', key: 'phone' },
            { label: '地址', key: 'address' },
            { label: '逾期金额', key: 'overdue_amount' },
            { label: '逾期期数', key: 'overdue_periods' },
            { label: '订单日期', key: 'overdue_date' },
            { label: '备注', key: 'notes' },
            { label: '上报人', key: 'reported_by' },
            { label: '上报时间', key: 'created_at', format: v => v ? v.substring(0, 10) : '' },
        ],
        formFields: [
            { key: 'customer_name', label: '客户姓名', type: 'text' },
            { key: 'id_card', label: '身份证号', type: 'text' },
            { key: 'phone', label: '手机号', type: 'text' },
            { key: 'address', label: '地址', type: 'text' },
            { key: 'overdue_amount', label: '逾期金额', type: 'number' },
            { key: 'overdue_periods', label: '逾期期数', type: 'int' },
            { key: 'overdue_date', label: '订单日期', type: 'date' },
            { key: 'notes', label: '备注', type: 'textarea' },
        ],
    },
};

// ===== Utility functions =====

function setupDateInput(input) {
    input.setAttribute('maxlength', '10');
    input.setAttribute('placeholder', 'YYYY-MM-DD');
    input.addEventListener('input', function () {
        const pos = this.selectionStart;
        const before = this.value;
        // Strip non-digits, keep only first 8 digits
        const digits = before.replace(/[^\d]/g, '').slice(0, 8);
        let formatted = '';
        if (digits.length > 6) {
            formatted = digits.slice(0, 4) + '-' + digits.slice(4, 6) + '-' + digits.slice(6);
        } else if (digits.length > 4) {
            formatted = digits.slice(0, 4) + '-' + digits.slice(4);
        } else {
            formatted = digits;
        }
        this.value = formatted;
        // Adjust cursor: if a dash was auto-inserted right before cursor, move past it
        const newPos = pos + (formatted.length - before.length);
        this.setSelectionRange(Math.max(0, newPos), Math.max(0, newPos));
    });
    // Allow arrow keys and tab but block non-digit typing beyond limits
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Tab' || e.key === 'Enter' || e.key === 'Escape' ||
            e.key === 'Backspace' || e.key === 'Delete' ||
            e.key.startsWith('Arrow') || e.ctrlKey || e.metaKey) return;
        if (!/^\d$/.test(e.key)) e.preventDefault();
    });
}

function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

function statusBadge(val) {
    const map = {
        '已还': 'green', '已结清': 'green', '已通过': 'green', '已完成': 'green', '在库': 'green',
        '逾期': 'red', '已报废': 'red', '逾期未还': 'red',
        '逾期还款': 'orange', '未还': 'orange',
        '待审核': 'orange', '待还': 'orange', '待确认': 'orange', '部分还款': 'orange',
        '已确认': 'blue',
        '已出库': 'gray', '已取消': 'gray',
    };
    const cls = map[val] || 'gray';
    return `<span class="status-badge ${cls}">${escapeHtml(val)}</span>`;
}

function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// ===== Modal =====
const Modal = {
    _onConfirm: null,
    open(title, bodyHtml, onConfirm) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = bodyHtml;
        document.getElementById('modal-overlay').style.display = 'flex';
        // Reset button states
        const confirmBtn = document.getElementById('modal-confirm');
        if (confirmBtn) { confirmBtn.style.display = ''; confirmBtn.textContent = '确定'; }
        const cancelBtn = document.getElementById('modal-cancel');
        if (cancelBtn) { cancelBtn.style.display = ''; cancelBtn.textContent = '取消'; }
        this._onConfirm = onConfirm;
    },
    close() {
        document.getElementById('modal-overlay').style.display = 'none';
    }
};

const Confirm = {
    _onConfirm: null,
    open(msg, onConfirm) {
        document.getElementById('confirm-message').textContent = msg;
        document.getElementById('confirm-overlay').style.display = 'flex';
        this._onConfirm = onConfirm;
    },
    close() {
        document.getElementById('confirm-overlay').style.display = 'none';
    }
};

const Toast = {
    show(msg, type = 'info') {
        const container = document.getElementById('toast-container');
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.textContent = msg;
        container.appendChild(el);
        setTimeout(() => { el.remove(); }, 3000);
    }
};
