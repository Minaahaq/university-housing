/* global firebase, fbClient, api, __core */
'use strict';

const permitsState = {
  permits: [],
  students: [],
  workers: [],
  payments: [],
  ui: {
    search: '',
    filterType: '',
    filterStatus: '',
    sort: { field: 'date', dir: -1 },
    page: 1,
    perPage: 25,
  },
};

/* ==========================================
   Boot
   ========================================== */
(async function boot() {
  const { loader, requireSession, hydrateUser, initShell, apiGet } = window.__core;

  document.getElementById('permitDrawer')?.classList.remove('open');
  document.getElementById('permitDrawerBackdrop')?.classList.remove('open');
  document.body.classList.remove('drawer-open');

  loader.show('جارٍ الاتصال...', 5);

  try {
    loader.progress(15, 'جارٍ التحقق من الجلسة...');
    const session = await requireSession();
    if (!session) return;

    hydrateUser(session.profile);
    initShell();
    document.getElementById('app').hidden = false;

    loader.progress(50, 'جارٍ تحميل البيانات...');
    const [permitsRes, studentsRes, workersRes, paymentsRes] = await Promise.all([
      apiGet('/api/permits?limit=500').catch(() => ({ data: [] })),
      apiGet('/api/students?limit=500').catch(() => ({ data: [] })),
      apiGet('/api/workers?limit=500').catch(() => ({ data: [] })),
      apiGet('/api/payments?limit=500').catch(() => ({ data: [] })),
    ]);

    permitsState.permits = permitsRes.data || [];
    permitsState.students = studentsRes.data || [];
    permitsState.workers = workersRes.data || [];
    permitsState.payments = paymentsRes.data || [];

    loader.progress(85, 'جارٍ تجهيز الجدول...');
    renderAll();

    loader.progress(100, 'اكتمل ✓');
    setTimeout(() => loader.hide(), 300);
  } catch (err) {
    console.error(err);
    loader.error(err.message || 'حدث خطأ');
  }
})();

/* ==========================================
   Helpers
   ========================================== */
function studentName(id) {
  const s = permitsState.students.find(x => x.id === id);
  return s ? s.name : 'طالب محذوف';
}

function typeBadge(type) {
  const map = {
    'تصريح مبيت': 'mabeet',
    'تصريح سفر': 'safar',
    'تصريح عيادة': 'eiada',
    'تصريح العيادة': 'eiada',
  };
  const cls = map[type] || '';
  return `<span class="ptype ${cls}">${window.__core.esc(type || '-')}</span>`;
}

/* ==========================================
   Render
   ========================================== */
function renderAll() {
  renderNavBadges();
  renderTable();
  renderPagination();
  populateStudentSelect();
}

function renderNavBadges() {
  const { $ } = window.__core;
  const s = $('navStudentsBadge'); if (s) s.textContent = permitsState.students.length;
  const w = $('navWorkersBadge'); if (w) w.textContent = permitsState.workers.length;
  const p = $('navPermitsBadge'); if (p) p.textContent = permitsState.permits.length;
  const pay = $('navPaymentsBadge'); if (pay) pay.textContent = permitsState.payments.length;
}

function populateStudentSelect() {
  const { $, esc } = window.__core;
  const sel = $('pStudent');
  if (!sel) return;
  if (permitsState.students.length === 0) {
    sel.innerHTML = '<option value="">— لا يوجد طلاب —</option>';
    return;
  }
  sel.innerHTML = permitsState.students
    .map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`)
    .join('');
}

function getFilteredRows() {
  const { search, filterType, filterStatus, sort } = permitsState.ui;
  const q = search.toLowerCase();
  let rows = permitsState.permits.filter(p => {
    if (filterType && p.type !== filterType) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    if (q) {
      const hay = [
        studentName(p.studentId),
        p.type, p.date, p.details, p.clinic,
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  rows.sort((a, b) => String(a[sort.field] ?? '').localeCompare(String(b[sort.field] ?? '')) * sort.dir);
  return rows;
}

function renderTable() {
  const { $, esc, statusChip } = window.__core;
  const tbody = $('permitRows');
  if (!tbody) return;

  const rows = getFilteredRows();
  const { page, perPage } = permitsState.ui;
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  if (page > totalPages) permitsState.ui.page = totalPages;

  const start = (permitsState.ui.page - 1) * perPage;
  const paged = rows.slice(start, start + perPage);

  if (paged.length === 0) {
    const hasFilters = permitsState.ui.search || permitsState.ui.filterType || permitsState.ui.filterStatus;
    tbody.innerHTML = `<tr><td colspan="8">
      <div class="empty">
        <div class="ico">📋</div>
        <h4>${hasFilters ? 'لا توجد نتائج' : 'لا توجد تصاريح بعد'}</h4>
        <p>${hasFilters ? 'جرّب تعديل البحث أو الفلاتر' : 'اضغط "إضافة تصريح" للبدء'}</p>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = paged.map(p => {
    const status = p.status || 'قيد المراجعة';
    const canApprove = status === 'قيد المراجعة';
    return `
      <tr>
        <td><strong>${esc(studentName(p.studentId))}</strong></td>
        <td>${typeBadge(p.type)}</td>
        <td dir="ltr">${esc(p.date || '-')}</td>
        <td dir="ltr">${esc(p.time || '-')}</td>
        <td>${esc(p.clinic || '-')}</td>
        <td>${statusChip(status)}</td>
        <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(p.details || '')}">
          ${esc(p.details || '-')}
        </td>
        <td class="actions">
          ${canApprove ? `
            <button class="btn sm success" data-action="approve" data-id="${p.id}" title="موافقة">✓</button>
            <button class="btn sm danger" data-action="reject" data-id="${p.id}" title="رفض">✗</button>
          ` : ''}
          <button class="btn sm danger" data-action="delete" data-id="${p.id}" title="حذف">🗑️</button>
        </td>
      </tr>`;
  }).join('');
}

function renderPagination() {
  const { $ } = window.__core;
  const el = $('permitsPagination');
  if (!el) return;

  const rows = getFilteredRows();
  const total = rows.length;
  const { perPage } = permitsState.ui;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(permitsState.ui.page, totalPages);
  permitsState.ui.page = page;

  const start = total === 0 ? 0 : (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  const pages = [];
  const maxBtns = 5;
  let from = Math.max(1, page - Math.floor(maxBtns / 2));
  let to = Math.min(totalPages, from + maxBtns - 1);
  if (to - from < maxBtns - 1) from = Math.max(1, to - maxBtns + 1);
  for (let i = from; i <= to; i++) pages.push(i);

  el.innerHTML = `
    <div class="info">عرض ${start}–${end} من ${total} تصريح</div>
    <div class="controls">
      <select id="perPageSelect">
        ${[10,25,50,100].map(n => `<option value="${n}" ${n===perPage?'selected':''}>${n} / صفحة</option>`).join('')}
      </select>
      <button data-page="prev" ${page<=1?'disabled':''}>‹</button>
      ${pages.map(p => `<button data-page="${p}" class="${p===page?'active':''}">${p}</button>`).join('')}
      <button data-page="next" ${page>=totalPages?'disabled':''}>›</button>
    </div>`;

  el.querySelectorAll('button[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.page;
      if (p === 'prev') permitsState.ui.page = Math.max(1, permitsState.ui.page - 1);
      else if (p === 'next') permitsState.ui.page = Math.min(totalPages, permitsState.ui.page + 1);
      else permitsState.ui.page = Number(p);
      renderTable();
      renderPagination();
    });
  });

  const sel = el.querySelector('#perPageSelect');
  if (sel) sel.addEventListener('change', () => {
    permitsState.ui.perPage = Number(sel.value);
    permitsState.ui.page = 1;
    renderTable();
    renderPagination();
  });
}

/* ==========================================
   Drawer
   ========================================== */
function openDrawer(mode = 'add', permit = null) {
  const { $ } = window.__core;
  const drawer = $('permitDrawer');
  const backdrop = $('permitDrawerBackdrop');
  if (!drawer || !backdrop) return;

  $('permitForm').reset();
  $('permitId').value = '';
  $('permitDrawerTitle').textContent = mode === 'edit' ? 'تعديل تصريح' : 'إضافة تصريح';

  if (mode === 'edit' && permit) {
    const map = {
      permitId:'id', pStudent:'studentId', pType:'type', pDate:'date',
      pTime:'time', pClinic:'clinic', pReturn:'returnAt', pDetails:'details',
    };
    Object.entries(map).forEach(([a, b]) => {
      const el = $(a);
      if (el) el.value = permit[b] ?? '';
    });
  } else {
    // افتراضيًا: اليوم
    const today = new Date().toISOString().slice(0, 10);
    $('pDate').value = today;
  }

  drawer.classList.add('open');
  backdrop.classList.add('open');
  document.body.classList.add('drawer-open');
  setTimeout(() => $('pStudent')?.focus(), 300);
}

function closeDrawer() {
  const { $ } = window.__core;
  $('permitDrawer')?.classList.remove('open');
  $('permitDrawerBackdrop')?.classList.remove('open');
  document.body.classList.remove('drawer-open');
}

/* ==========================================
   Save
   ========================================== */
async function savePermit() {
  const { $, val, actionOverlay, toast, apiPost } = window.__core;
  const payload = {
    studentId: val('pStudent'),
    type: val('pType'),
    date: val('pDate'),
    time: val('pTime') || null,
    clinic: val('pClinic') || null,
    returnAt: val('pReturn') || null,
    details: val('pDetails') || null,
  };

  if (!payload.studentId) {
    toast('الرجاء اختيار الطالب', 'error');
    return;
  }
  if (!payload.date) {
    toast('الرجاء تحديد التاريخ', 'error');
    return;
  }

  actionOverlay.show('جارٍ حفظ التصريح...');
  try {
    const body = await apiPost('/api/permits', payload);
    permitsState.permits.push(body.data);
    renderAll();
    closeDrawer();
    toast('تم حفظ التصريح', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    actionOverlay.hide();
  }
}

/* ==========================================
   Approve / Reject
   ========================================== */
async function approvePermit(id) {
  const { confirmModal, actionOverlay, toast, apiPost } = window.__core;
  const p = permitsState.permits.find(x => x.id === id);
  if (!p) return;

  const ok = await confirmModal(
    'تأكيد الموافقة',
    `الموافقة على تصريح "${p.type}" للطالب "${studentName(p.studentId)}"؟`
  );
  if (!ok) return;

  actionOverlay.show('جارٍ الموافقة...');
  try {
    const body = await apiPost(`/api/permits/${id}/approve`, {});
    const i = permitsState.permits.findIndex(x => x.id === id);
    if (i >= 0) permitsState.permits[i] = body.data;
    renderAll();
    toast('تم اعتماد التصريح', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    actionOverlay.hide();
  }
}

async function rejectPermit(id) {
  const { confirmModal, actionOverlay, toast, apiPost } = window.__core;
  const p = permitsState.permits.find(x => x.id === id);
  if (!p) return;

  const ok = await confirmModal(
    'تأكيد الرفض',
    `رفض تصريح "${p.type}" للطالب "${studentName(p.studentId)}"؟`
  );
  if (!ok) return;

  actionOverlay.show('جارٍ الرفض...');
  try {
    const body = await apiPost(`/api/permits/${id}/reject`, {});
    const i = permitsState.permits.findIndex(x => x.id === id);
    if (i >= 0) permitsState.permits[i] = body.data;
    renderAll();
    toast('تم رفض التصريح', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    actionOverlay.hide();
  }
}

/* ==========================================
   Delete
   ========================================== */
async function deletePermit(id) {
  const { confirmModal, actionOverlay, toast, apiDel } = window.__core;
  const p = permitsState.permits.find(x => x.id === id);
  if (!p) return;

  const ok = await confirmModal(
    'تأكيد الحذف',
    `حذف التصريح "${p.type}" للطالب "${studentName(p.studentId)}"؟ لا يمكن التراجع.`
  );
  if (!ok) return;

  actionOverlay.show('جارٍ الحذف...');
  try {
    await apiDel(`/api/permits/${id}`);
    permitsState.permits = permitsState.permits.filter(x => x.id !== id);
    renderAll();
    toast('تم حذف التصريح', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    actionOverlay.hide();
  }
}

/* ==========================================
   Events
   ========================================== */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === 'approve') approvePermit(id);
  if (action === 'reject') rejectPermit(id);
  if (action === 'delete') deletePermit(id);
});

document.addEventListener('DOMContentLoaded', () => {
  const { $ } = window.__core;

  $('addPermitBtn')?.addEventListener('click', (e) => { e.preventDefault(); openDrawer('add'); });
  $('closePermitDrawer')?.addEventListener('click', (e) => { e.preventDefault(); closeDrawer(); });
  $('cancelPermitDrawer')?.addEventListener('click', (e) => { e.preventDefault(); closeDrawer(); });
  $('permitDrawerBackdrop')?.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });

  $('savePermitBtn')?.addEventListener('click', (e) => { e.preventDefault(); savePermit(); });
  $('permitForm')?.addEventListener('submit', (e) => { e.preventDefault(); savePermit(); });

  $('permitSearch')?.addEventListener('input', (e) => {
    permitsState.ui.search = e.target.value;
    permitsState.ui.page = 1;
    renderTable();
    renderPagination();
  });

  $('filterType')?.addEventListener('change', (e) => {
    permitsState.ui.filterType = e.target.value;
    permitsState.ui.page = 1;
    renderTable();
    renderPagination();
  });

  $('filterStatus')?.addEventListener('change', (e) => {
    permitsState.ui.filterStatus = e.target.value;
    permitsState.ui.page = 1;
    renderTable();
    renderPagination();
  });

  document.querySelectorAll('#permitsTable th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      const ui = permitsState.ui;
      if (ui.sort.field === field) ui.sort.dir = -ui.sort.dir;
      else { ui.sort.field = field; ui.sort.dir = 1; }
      document.querySelectorAll('#permitsTable th[data-sort]').forEach(t => {
        t.classList.remove('asc', 'desc');
      });
      th.classList.add(ui.sort.dir === 1 ? 'asc' : 'desc');
      renderTable();
    });
  });
});
