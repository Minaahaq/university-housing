/* global firebase, fbClient, api, __core */
'use strict';

const workersState = {
  workers: [],
  students: [],
  permits: [],
  payments: [],
  rooms: [],
  ui: {
    search: '',
    filterStatus: '',
    sort: { field: 'name', dir: 1 },
    page: 1,
    perPage: 25,
  },
};

/* ==========================================
   Boot
   ========================================== */
(async function boot() {
  const { loader, requireSession, hydrateUser, initShell, apiGet } = window.__core;

  loader.show('جارٍ الاتصال...', 5);

  try {
    loader.progress(15, 'جارٍ التحقق من الجلسة...');
    const session = await requireSession();
    if (!session) return;

    hydrateUser(session.profile);
    initShell();
    document.getElementById('app').hidden = false;

    loader.progress(40, 'جارٍ تحميل البيانات...');
    await loadAll();

    loader.progress(85, 'جارٍ تجهيز الجدول...');
    renderAll();

    loader.progress(100, 'اكتمل ✓');
    setTimeout(() => loader.hide(), 300);
  } catch (err) {
    console.error(err);
    loader.error(err.message || 'حدث خطأ');
  }
})();

async function loadAll() {
  const { apiGet } = window.__core;
  const [workersRes, studentsRes, permitsRes, paymentsRes, roomsRes] = await Promise.all([
    apiGet('/api/workers?limit=1000').catch(() => ({ data: [] })),
    apiGet('/api/students?limit=1').catch(() => ({ data: [] })),
    apiGet('/api/permits?limit=1').catch(() => ({ data: [] })),
    apiGet('/api/payments?limit=1').catch(() => ({ data: [] })),
    apiGet('/api/rooms/rooms').catch(() => ({ data: [] })),
  ]);
  workersState.workers = workersRes.data || [];
  workersState.students = studentsRes.data || [];
  workersState.permits = permitsRes.data || [];
  workersState.payments = paymentsRes.data || [];
  workersState.rooms = roomsRes.data || [];
}

/* ==========================================
   Render
   ========================================== */
function renderAll() {
  renderNavBadges();
  renderStatsBar();
  renderTable();
  renderPagination();
}

function renderNavBadges() {
  const { $ } = window.__core;
  const map = {
    navStudentsBadge: workersState.students.length,
    navRoomsBadge: workersState.rooms.length,
    navWorkersBadge: workersState.workers.length,
    navPermitsBadge: workersState.permits.length,
    navPaymentsBadge: workersState.payments.length,
  };
  Object.entries(map).forEach(([id, val]) => {
    const el = $(id); if (el) el.textContent = val;
  });
}

function renderStatsBar() {
  const { $ } = window.__core;
  const w = workersState.workers;
  const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  set('statsTotal', w.length);
  set('statsPaid', w.filter(x => workerStatus(x) === 'paid').length);
  set('statsPartial', w.filter(x => workerStatus(x) === 'partial').length);
  set('statsUnpaid', w.filter(x => workerStatus(x) === 'unpaid').length);
}

function workerStatus(w) {
  const due = Number(w.due || 0);
  const paid = Number(w.paid || 0);
  if (paid >= due) return 'paid';
  if (paid > 0) return 'partial';
  return 'unpaid';
}

function statusChip(s) {
  const map = {
    paid: { cls: 'green', label: 'مسدد' },
    partial: { cls: 'amber', label: 'جزئي' },
    unpaid: { cls: 'red', label: 'غير مدفوع' },
  };
  const x = map[s] || map.unpaid;
  return `<span class="chip ${x.cls}">${x.label}</span>`;
}

function getFiltered() {
  const { search, filterStatus, sort } = workersState.ui;
  const q = search.toLowerCase();

  let rows = workersState.workers.filter(w => {
    if (filterStatus && workerStatus(w) !== filterStatus) return false;
    if (q) {
      const hay = [w.name, w.job, w.phone].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  rows.sort((a, b) => {
    let va = a[sort.field] ?? '';
    let vb = b[sort.field] ?? '';
    if (sort.field === 'due' || sort.field === 'paid') {
      return (Number(va) - Number(vb)) * sort.dir;
    }
    return String(va).localeCompare(String(vb)) * sort.dir;
  });

  return rows;
}

function renderTable() {
  const { $, esc, money } = window.__core;
  const tbody = $('workerRows');
  if (!tbody) return;

  const rows = getFiltered();
  const { page, perPage } = workersState.ui;
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  if (page > totalPages) workersState.ui.page = totalPages;

  const start = (workersState.ui.page - 1) * perPage;
  const paged = rows.slice(start, start + perPage);

  if (paged.length === 0) {
    const hasFilters = workersState.ui.search || workersState.ui.filterStatus;
    tbody.innerHTML = `<tr><td colspan="9">
      <div class="empty-state">
        <div class="icon">🧹</div>
        <h4>${hasFilters ? 'لا توجد نتائج' : 'لا يوجد عمال بعد'}</h4>
        <p>${hasFilters ? 'جرّب تعديل البحث أو الفلاتر' : 'اضغط "إضافة عامل" للبدء'}</p>
        ${!hasFilters ? '<button class="btn primary" data-action="add">➕ إضافة عامل</button>' : ''}
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = paged.map(w => {
    const due = Number(w.due || 0);
    const paid = Number(w.paid || 0);
    const rem = Math.max(0, due - paid);
    const status = workerStatus(w);
    const period = (w.from || w.to) ? `${w.from || '—'} → ${w.to || '—'}` : '—';

    return `
      <tr>
        <td><strong>${esc(w.name)}</strong></td>
        <td>${esc(w.job || '—')}</td>
        <td dir="ltr">${esc(w.phone || '—')}</td>
        <td dir="ltr" style="font-size:12px">${esc(period)}</td>
        <td class="amount">${money(due)} <small style="color:var(--muted)">ج</small></td>
        <td class="amount">${money(paid)} <small style="color:var(--muted)">ج</small></td>
        <td class="amount remaining ${rem <= 0 ? 'zero' : ''}">${money(rem)} <small style="color:var(--muted)">ج</small></td>
        <td>${statusChip(status)}</td>
        <td class="actions no-print">
          <button class="btn sm" data-action="edit" data-id="${w.id}" title="تعديل">✏️</button>
          <button class="btn sm danger" data-action="delete" data-id="${w.id}" title="حذف">🗑️</button>
        </td>
      </tr>`;
  }).join('');
}

function renderPagination() {
  const { $ } = window.__core;
  const el = $('workersPagination');
  if (!el) return;

  const rows = getFiltered();
  const total = rows.length;
  const { perPage } = workersState.ui;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(workersState.ui.page, totalPages);
  workersState.ui.page = page;

  const start = total === 0 ? 0 : (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  const pages = [];
  const maxBtns = 5;
  let from = Math.max(1, page - Math.floor(maxBtns / 2));
  let to = Math.min(totalPages, from + maxBtns - 1);
  if (to - from < maxBtns - 1) from = Math.max(1, to - maxBtns + 1);
  for (let i = from; i <= to; i++) pages.push(i);

  el.innerHTML = `
    <div class="info">عرض ${start}–${end} من ${total} عامل</div>
    <div class="controls">
      <select id="perPageSelect">
        ${[10, 25, 50, 100].map(n => `<option value="${n}" ${n === perPage ? 'selected' : ''}>${n} / صفحة</option>`).join('')}
      </select>
      <button data-page="prev" ${page <= 1 ? 'disabled' : ''}>‹</button>
      ${pages.map(p => `<button data-page="${p}" class="${p === page ? 'active' : ''}">${p}</button>`).join('')}
      <button data-page="next" ${page >= totalPages ? 'disabled' : ''}>›</button>
    </div>`;

  el.querySelectorAll('button[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.page;
      if (p === 'prev') workersState.ui.page = Math.max(1, workersState.ui.page - 1);
      else if (p === 'next') workersState.ui.page = Math.min(totalPages, workersState.ui.page + 1);
      else workersState.ui.page = Number(p);
      renderTable();
      renderPagination();
    });
  });

  const sel = el.querySelector('#perPageSelect');
  if (sel) sel.addEventListener('change', () => {
    workersState.ui.perPage = Number(sel.value);
    workersState.ui.page = 1;
    renderTable();
    renderPagination();
  });
}

/* ==========================================
   Drawer
   ========================================== */
function openDrawer(mode = 'add', worker = null) {
  const { $ } = window.__core;
  const drawer = $('workerDrawer');
  const backdrop = $('workerDrawerBackdrop');
  const title = $('workerDrawerTitle');
  if (!drawer || !backdrop) return;

  $('workerForm').reset();
  $('workerId').value = '';
  $('wDue').value = 0;
  $('wPaid').value = 0;

  if (mode === 'edit' && worker) {
    title.textContent = 'تعديل بيانات عامل';
    const map = {
      workerId: 'id', wName: 'name', wJob: 'job', wPhone: 'phone',
      wFrom: 'from', wTo: 'to', wDue: 'due', wPaid: 'paid', wNotes: 'notes',
    };
    Object.entries(map).forEach(([elId, key]) => {
      const el = $(elId); if (el) el.value = worker[key] ?? '';
    });
  } else {
    title.textContent = 'إضافة عامل';
  }

  drawer.classList.add('open');
  backdrop.classList.add('open');
  document.body.classList.add('drawer-open');
  setTimeout(() => $('wName')?.focus(), 300);
}

function closeDrawer() {
  const { $ } = window.__core;
  $('workerDrawer')?.classList.remove('open');
  $('workerDrawerBackdrop')?.classList.remove('open');
  document.body.classList.remove('drawer-open');
}

/* ==========================================
   Save
   ========================================== */
async function saveWorker() {
  const { $, val, num, actionOverlay, toast, apiPost, apiPut } = window.__core;
  const id = val('workerId');

  const payload = {
    name: val('wName'),
    job: val('wJob') || null,
    phone: val('wPhone') || null,
    from: val('wFrom') || null,
    to: val('wTo') || null,
    due: num('wDue'),
    paid: num('wPaid'),
    notes: val('wNotes') || null,
  };

  if (!payload.name || payload.name.length < 3) {
    toast('اسم العامل مطلوب (3 أحرف على الأقل)', 'error');
    $('wName')?.focus();
    return;
  }

  actionOverlay.show(id ? 'جارٍ التحديث...' : 'جارٍ الحفظ...');
  try {
    const isNew = !id;
    const body = isNew
      ? await apiPost('/api/workers', payload)
      : await apiPut(`/api/workers/${id}`, payload);

    if (isNew) workersState.workers.push(body.data);
    else {
      const i = workersState.workers.findIndex(x => x.id === body.data.id);
      if (i >= 0) workersState.workers[i] = body.data;
    }

    renderAll();
    closeDrawer();
    toast(isNew ? 'تم إضافة العامل بنجاح' : 'تم تحديث البيانات', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    actionOverlay.hide();
  }
}

/* ==========================================
   Delete
   ========================================== */
async function deleteWorker(id) {
  const { confirmModal, actionOverlay, toast, apiDel } = window.__core;
  const w = workersState.workers.find(x => x.id === id);
  if (!w) return;

  const ok = await confirmModal('تأكيد الحذف', `حذف "${w.name}"؟ لا يمكن التراجع.`);
  if (!ok) return;

  actionOverlay.show('جارٍ الحذف...');
  try {
    await apiDel(`/api/workers/${id}`);
    workersState.workers = workersState.workers.filter(x => x.id !== id);
    renderAll();
    toast('تم حذف العامل', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    actionOverlay.hide();
  }
}

/* ==========================================
   CSV Export
   ========================================== */
function exportCSV() {
  const { toast } = window.__core;
  if (!workersState.workers.length) {
    toast('لا يوجد عمال لتصديرهم', 'error');
    return;
  }
  const rows = [
    ['الاسم', 'المهمة', 'الهاتف', 'من', 'إلى', 'المستحق', 'المدفوع', 'المتبقي', 'ملاحظات'],
    ...workersState.workers.map(w => [
      w.name, w.job, w.phone, w.from, w.to,
      w.due, w.paid, (Number(w.due || 0) - Number(w.paid || 0)), w.notes,
    ]),
  ];
  const csv = '\ufeff' + rows.map(r =>
    r.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\r\n');

  const a = document.createElement('a');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.href = url;
  a.download = `عمال-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('تم تصدير البيانات', 'success');
}

/* ==========================================
   Events
   ========================================== */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;

  if (action === 'add') openDrawer('add');
  if (action === 'edit') {
    const w = workersState.workers.find(x => x.id === id);
    if (w) openDrawer('edit', w);
  }
  if (action === 'delete') deleteWorker(id);
});

document.addEventListener('DOMContentLoaded', () => {
  const { $ } = window.__core;

  $('addWorkerBtn')?.addEventListener('click', () => openDrawer('add'));
  $('closeWorkerDrawer')?.addEventListener('click', closeDrawer);
  $('cancelWorkerDrawer')?.addEventListener('click', closeDrawer);
  $('workerDrawerBackdrop')?.addEventListener('click', closeDrawer);
  $('saveWorkerBtn')?.addEventListener('click', saveWorker);
  $('workerForm')?.addEventListener('submit', (e) => { e.preventDefault(); saveWorker(); });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });

  let searchTimeout;
  $('workerSearch')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      workersState.ui.search = e.target.value;
      workersState.ui.page = 1;
      renderTable();
      renderPagination();
    }, 200);
  });

  $('filterStatus')?.addEventListener('change', (e) => {
    workersState.ui.filterStatus = e.target.value;
    workersState.ui.page = 1;
    renderTable();
    renderPagination();
  });

  $('clearFiltersBtn')?.addEventListener('click', () => {
    workersState.ui.search = '';
    workersState.ui.filterStatus = '';
    workersState.ui.page = 1;
    if ($('workerSearch')) $('workerSearch').value = '';
    if ($('filterStatus')) $('filterStatus').value = '';
    renderTable();
    renderPagination();
  });

  document.querySelectorAll('#workersTable th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      const ui = workersState.ui;
      if (ui.sort.field === field) ui.sort.dir = -ui.sort.dir;
      else { ui.sort.field = field; ui.sort.dir = 1; }
      document.querySelectorAll('#workersTable th[data-sort]').forEach(t => {
        t.classList.remove('asc', 'desc');
      });
      th.classList.add(ui.sort.dir === 1 ? 'asc' : 'desc');
      renderTable();
    });
  });

  $('exportBtn')?.addEventListener('click', exportCSV);
});
