/* global firebase, fbClient, api, __core */
'use strict';

/* ==========================================
   State
   ========================================== */
const studentsState = {
  students: [],
  workers: [],
  permits: [],
  payments: [],
  rooms: [],
  ui: {
    search: '',
    filterCollege: '',
    filterYear: '',
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
  const [studentsRes, workersRes, permitsRes, paymentsRes, roomsRes] = await Promise.all([
    apiGet('/api/students?limit=1000').catch(() => ({ data: [] })),
    apiGet('/api/workers?limit=1').catch(() => ({ data: [] })),
    apiGet('/api/permits?limit=1').catch(() => ({ data: [] })),
    apiGet('/api/payments?limit=1').catch(() => ({ data: [] })),
    apiGet('/api/rooms/rooms').catch(() => ({ data: [] })),
  ]);
  studentsState.students = studentsRes.data || [];
  studentsState.workers = workersRes.data || [];
  studentsState.permits = permitsRes.data || [];
  studentsState.payments = paymentsRes.data || [];
  studentsState.rooms = roomsRes.data || [];
}

/* ==========================================
   Render All
   ========================================== */
function renderAll() {
  renderNavBadges();
  renderStatsBar();
  renderCollegeFilter();
  renderTable();
  renderPagination();
}

function renderNavBadges() {
  const { $ } = window.__core;
  const map = {
    navStudentsBadge: studentsState.students.length,
    navRoomsBadge: studentsState.rooms.length,
    navWorkersBadge: studentsState.workers.length,
    navPermitsBadge: studentsState.permits.length,
    navPaymentsBadge: studentsState.payments.length,
  };
  Object.entries(map).forEach(([id, val]) => {
    const el = $(id);
    if (el) el.textContent = val;
  });
}

function renderStatsBar() {
  const { $ } = window.__core;
  const s = studentsState.students;
  const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  set('statsTotal', s.length);
  set('statsResidents', s.filter(x => x.status === 'مقيم').length);
  set('statsTravelers', s.filter(x => x.status === 'مسافر').length);
  set('statsVacation', s.filter(x => x.status === 'إجازة').length);
  set('statsWithdrawn', s.filter(x => x.status === 'منسحب').length);
}

function renderCollegeFilter() {
  const { $, esc } = window.__core;
  const sel = $('filterCollege');
  if (!sel) return;
  const colleges = [...new Set(studentsState.students.map(s => s.college).filter(Boolean))].sort();
  const current = sel.value;
  sel.innerHTML = '<option value="">كل الكليات</option>' +
    colleges.map(c => `<option>${esc(c)}</option>`).join('');
  if (current && colleges.includes(current)) sel.value = current;
}

function getFiltered() {
  const { search, filterCollege, filterYear, filterStatus, sort } = studentsState.ui;
  const q = search.toLowerCase();

  let rows = studentsState.students.filter(s => {
    if (filterCollege && s.college !== filterCollege) return false;
    if (filterYear && s.year !== filterYear) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    if (q) {
      const hay = [s.name, s.phone, s.room, s.college, s.national].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  rows.sort((a, b) => {
    const va = String(a[sort.field] ?? '');
    const vb = String(b[sort.field] ?? '');
    return va.localeCompare(vb) * sort.dir;
  });

  return rows;
}

function statusChip(status) {
  const map = {
    'مقيم': 'green',
    'مسافر': 'amber',
    'إجازة': 'blue',
    'منسحب': 'red',
  };
  return `<span class="chip ${map[status] || 'gray'}">${status || '-'}</span>`;
}

function renderTable() {
  const { $, esc, money } = window.__core;
  const tbody = $('studentRows');
  if (!tbody) return;

  const rows = getFiltered();
  const { page, perPage } = studentsState.ui;
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  if (page > totalPages) studentsState.ui.page = totalPages;

  const start = (studentsState.ui.page - 1) * perPage;
  const paged = rows.slice(start, start + perPage);

  if (paged.length === 0) {
    const hasFilters = studentsState.ui.search || studentsState.ui.filterCollege ||
      studentsState.ui.filterYear || studentsState.ui.filterStatus;
    tbody.innerHTML = `<tr><td colspan="8">
      <div class="empty-state">
        <div class="icon">👥</div>
        <h4>${hasFilters ? 'لا توجد نتائج' : 'لا يوجد طلاب بعد'}</h4>
        <p>${hasFilters ? 'جرّب تعديل البحث أو الفلاتر' : 'اضغط "إضافة طالب" للبدء'}</p>
        ${!hasFilters ? '<button class="btn primary" data-action="add">➕ إضافة طالب</button>' : ''}
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = paged.map(s => `
    <tr>
      <td><strong>${esc(s.name)}</strong></td>
      <td dir="ltr">${esc(s.phone || '-')}</td>
      <td>${esc(s.college || '-')}</td>
      <td>${esc(s.year || '-')}</td>
      <td>${esc(s.room || '-')}</td>
      <td>${statusChip(s.status)}</td>
      <td>${money(s.monthly)} <small style="color:var(--muted)">ج</small></td>
      <td class="actions no-print">
        <button class="btn sm" data-action="edit" data-id="${s.id}" title="تعديل">✏️</button>
        <button class="btn sm danger" data-action="delete" data-id="${s.id}" title="حذف">🗑️</button>
      </td>
    </tr>`).join('');
}

function renderPagination() {
  const { $ } = window.__core;
  const el = $('studentsPagination');
  if (!el) return;

  const rows = getFiltered();
  const total = rows.length;
  const { perPage } = studentsState.ui;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(studentsState.ui.page, totalPages);
  studentsState.ui.page = page;

  const start = total === 0 ? 0 : (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  // Page numbers
  const pages = [];
  const maxBtns = 5;
  let from = Math.max(1, page - Math.floor(maxBtns / 2));
  let to = Math.min(totalPages, from + maxBtns - 1);
  if (to - from < maxBtns - 1) from = Math.max(1, to - maxBtns + 1);
  for (let i = from; i <= to; i++) pages.push(i);

  el.innerHTML = `
    <div class="info">عرض ${start}–${end} من ${total} طالب</div>
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
      if (p === 'prev') studentsState.ui.page = Math.max(1, studentsState.ui.page - 1);
      else if (p === 'next') studentsState.ui.page = Math.min(totalPages, studentsState.ui.page + 1);
      else studentsState.ui.page = Number(p);
      renderTable();
      renderPagination();
    });
  });

  const sel = el.querySelector('#perPageSelect');
  if (sel) sel.addEventListener('change', () => {
    studentsState.ui.perPage = Number(sel.value);
    studentsState.ui.page = 1;
    renderTable();
    renderPagination();
  });
}

/* ==========================================
   Drawer
   ========================================== */
function openDrawer(mode = 'add', student = null) {
  const { $ } = window.__core;
  const drawer = $('studentDrawer');
  const backdrop = $('studentDrawerBackdrop');
  const title = $('studentDrawerTitle');
  if (!drawer || !backdrop) return;

  $('studentForm').reset();
  $('studentId').value = '';
  $('sMonthly').value = 0;

  if (mode === 'edit' && student) {
    title.textContent = 'تعديل بيانات طالب';
    const map = {
      studentId: 'id', sName: 'name', sNational: 'national', sPhone: 'phone',
      sEmail: 'email', sCollege: 'college', sYear: 'year', sWing: 'wing',
      sFloor: 'floor', sRoom: 'room', sRoomType: 'roomType', sStatus: 'status',
      sMonthly: 'monthly', sNotes: 'notes',
    };
    Object.entries(map).forEach(([elId, key]) => {
      const el = $(elId);
      if (el) el.value = student[key] ?? '';
    });
  } else {
    title.textContent = 'إضافة طالب';
  }

  drawer.classList.add('open');
  backdrop.classList.add('open');
  document.body.classList.add('drawer-open');
  setTimeout(() => $('sName')?.focus(), 300);
}

function closeDrawer() {
  const { $ } = window.__core;
  $('studentDrawer')?.classList.remove('open');
  $('studentDrawerBackdrop')?.classList.remove('open');
  document.body.classList.remove('drawer-open');
}

/* ==========================================
   Save
   ========================================== */
async function saveStudent() {
  const { $, val, num, actionOverlay, toast, apiPost, apiPut, loader } = window.__core;
  const id = val('studentId');

  const payload = {
    name: val('sName'),
    national: val('sNational') || null,
    phone: val('sPhone') || null,
    email: val('sEmail') || null,
    college: val('sCollege'),
    year: val('sYear'),
    wing: val('sWing'),
    floor: val('sFloor'),
    room: val('sRoom') || null,
    roomType: val('sRoomType'),
    status: val('sStatus'),
    monthly: num('sMonthly'),
    notes: val('sNotes') || null,
  };

  if (!payload.name || payload.name.length < 3) {
    toast('اسم الطالب مطلوب (3 أحرف على الأقل)', 'error');
    $('sName')?.focus();
    return;
  }

  actionOverlay.show(id ? 'جارٍ التحديث...' : 'جارٍ الحفظ...');
  try {
    const isNew = !id;
    const body = isNew
      ? await apiPost('/api/students', payload)
      : await apiPut(`/api/students/${id}`, payload);

    // ✅ تأخير نص ثانية عشان نضمن إن Firebase حفظ البيانات فعلاً
    await new Promise(r => setTimeout(r, 500));

    // ✅ إعادة تحميل البيانات من السيرفر
    loader.show('جارٍ تحديث البيانات...', 50);
    await loadAll();
    renderAll();
    loader.hide();

    closeDrawer();
    toast(isNew ? 'تم إضافة الطالب بنجاح' : 'تم تحديث البيانات', 'success');
    
    // ✅ نطبع في الكونسول عشان نتأكد
    console.log('عدد الطلاب بعد التحديث:', studentsState.students.length);

  } catch (err) {
    toast(err.message, 'error');
  } finally {
    actionOverlay.hide();
  }
}

/* ==========================================
   Delete
   ========================================== */
async function deleteStudent(id) {
  const { confirmModal, actionOverlay, toast, apiDel, loader } = window.__core;
  const s = studentsState.students.find(x => x.id === id);
  if (!s) return;

  const ok = await confirmModal('تأكيد الحذف', `هل تريد حذف "${s.name}"؟ لا يمكن التراجع.`);
  if (!ok) return;

  actionOverlay.show('جارٍ الحذف...');
  try {
    await apiDel(`/api/students/${id}`);
    
    // ✅ تأخير نص ثانية عشان نضمن إن Firebase مسح البيانات فعلاً
    await new Promise(r => setTimeout(r, 500));

    // ✅ إعادة تحميل البيانات من السيرفر
    loader.show('جارٍ تحديث البيانات...', 50);
    await loadAll();
    renderAll();
    loader.hide();
    
    toast('تم حذف الطالب', 'success');
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
  if (studentsState.students.length === 0) {
    toast('لا يوجد طلاب لتصديرهم', 'error');
    return;
  }
  const rows = [
    ['الاسم', 'الرقم القومي', 'الهاتف', 'البريد', 'الكلية', 'الفرقة', 'الجناح', 'الدور', 'الغرفة', 'نوع الغرفة', 'الحالة', 'الرسوم الشهرية', 'ملاحظات'],
    ...studentsState.students.map(s => [
      s.name, s.national, s.phone, s.email, s.college, s.year, s.wing,
      s.floor, s.room, s.roomType, s.status, s.monthly, s.notes,
    ]),
  ];
  const csv = '\ufeff' + rows.map(r =>
    r.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\r\n');

  const a = document.createElement('a');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.href = url;
  a.download = `بيانات-الطلاب-${new Date().toISOString().slice(0, 10)}.csv`;
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
    const s = studentsState.students.find(x => x.id === id);
    if (s) openDrawer('edit', s);
  }
  if (action === 'delete') deleteStudent(id);
});

document.addEventListener('DOMContentLoaded', () => {
  const { $ } = window.__core;

  // Open/Close
  $('addStudentBtn')?.addEventListener('click', () => openDrawer('add'));
  $('closeStudentDrawer')?.addEventListener('click', closeDrawer);
  $('cancelStudentDrawer')?.addEventListener('click', closeDrawer);
  $('studentDrawerBackdrop')?.addEventListener('click', closeDrawer);
  $('saveStudentBtn')?.addEventListener('click', saveStudent);
  $('studentForm')?.addEventListener('submit', (e) => { e.preventDefault(); saveStudent(); });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });

  // Search
  let searchTimeout;
  $('studentSearch')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      studentsState.ui.search = e.target.value;
      studentsState.ui.page = 1;
      renderTable();
      renderPagination();
    }, 200);
  });

  // Filters
  const onFilter = (id, key) => {
    $(id)?.addEventListener('change', (e) => {
      studentsState.ui[key] = e.target.value;
      studentsState.ui.page = 1;
      renderTable();
      renderPagination();
    });
  };
  onFilter('filterCollege', 'filterCollege');
  onFilter('filterYear', 'filterYear');
  onFilter('filterStatus', 'filterStatus');

  // Clear filters
  $('clearFiltersBtn')?.addEventListener('click', () => {
    studentsState.ui.search = '';
    studentsState.ui.filterCollege = '';
    studentsState.ui.filterYear = '';
    studentsState.ui.filterStatus = '';
    studentsState.ui.page = 1;
    if ($('studentSearch')) $('studentSearch').value = '';
    if ($('filterCollege')) $('filterCollege').value = '';
    if ($('filterYear')) $('filterYear').value = '';
    if ($('filterStatus')) $('filterStatus').value = '';
    renderTable();
    renderPagination();
  });

  // Sort
  document.querySelectorAll('#studentsTable th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      const ui = studentsState.ui;
      if (ui.sort.field === field) ui.sort.dir = -ui.sort.dir;
      else { ui.sort.field = field; ui.sort.dir = 1; }
      document.querySelectorAll('#studentsTable th[data-sort]').forEach(t => {
        t.classList.remove('asc', 'desc');
      });
      th.classList.add(ui.sort.dir === 1 ? 'asc' : 'desc');
      renderTable();
    });
  });

  // Export
  $('exportBtn')?.addEventListener('click', exportCSV);
});
