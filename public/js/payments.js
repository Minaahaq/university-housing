/* global firebase, fbClient, api, __core */
'use strict';

const paymentsState = {
  payments: [],
  students: [],
  workers: [],
  permits: [],
  ui: {
    search: '',
    filterMonth: '',
    filterStatus: '',
    sort: { field: 'date', dir: -1 },
    page: 1,
    perPage: 25,
  },
};

const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

/* ==========================================
   Boot
   ========================================== */
(async function boot() {
  const { loader, requireSession, hydrateUser, initShell, apiGet } = window.__core;

  document.getElementById('paymentDrawer')?.classList.remove('open');
  document.getElementById('paymentDrawerBackdrop')?.classList.remove('open');
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
    const [paymentsRes, studentsRes, workersRes, permitsRes] = await Promise.all([
      apiGet('/api/payments?limit=500').catch(() => ({ data: [] })),
      apiGet('/api/students?limit=500').catch(() => ({ data: [] })),
      apiGet('/api/workers?limit=500').catch(() => ({ data: [] })),
      apiGet('/api/permits?limit=500').catch(() => ({ data: [] })),
    ]);

    paymentsState.payments = paymentsRes.data || [];
    paymentsState.students = studentsRes.data || [];
    paymentsState.workers = workersRes.data || [];
    paymentsState.permits = permitsRes.data || [];

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
  const s = paymentsState.students.find(x => x.id === id);
  return s ? s.name : 'طالب محذوف';
}

function paymentStatus(p) {
  const due = Number(p.due || 0);
  const paid = Number(p.paid || 0);
  if (paid >= due) return 'paid';
  if (paid > 0) return 'partial';
  return 'unpaid';
}

function statusLabel(status) {
  if (status === 'paid') return 'مدفوع';
  if (status === 'partial') return 'جزئي';
  return 'غير مدفوع';
}

function statusChip(status) {
  const map = { paid: 'green', partial: 'amber', unpaid: 'red' };
  return `<span class="chip ${map[status] || ''}">${statusLabel(status)}</span>`;
}

/* ==========================================
   Render
   ========================================== */
function renderAll() {
  renderNavBadges();
  renderSummary();
  renderTable();
  renderPagination();
  populateStudentSelect();
  populateMonthSelect();
}

function renderNavBadges() {
  const { $ } = window.__core;
  const s = $('navStudentsBadge'); if (s) s.textContent = paymentsState.students.length;
  const w = $('navWorkersBadge'); if (w) w.textContent = paymentsState.workers.length;
  const p = $('navPermitsBadge'); if (p) p.textContent = paymentsState.permits.length;
  const pay = $('navPaymentsBadge'); if (pay) pay.textContent = paymentsState.payments.length;
}

function renderSummary() {
  const { $, money } = window.__core;
  const totalDue = paymentsState.payments.reduce((a, p) => a + Number(p.due || 0), 0);
  const totalPaid = paymentsState.payments.reduce((a, p) => a + Number(p.paid || 0), 0);
  const overdue = paymentsState.payments.reduce((a, p) =>
    a + Math.max(0, Number(p.due || 0) - Number(p.paid || 0)), 0);

  const t = $('sumTotalDue'); if (t) t.innerHTML = `${money(totalDue)} <small>ج</small>`;
  const pd = $('sumTotalPaid'); if (pd) pd.innerHTML = `${money(totalPaid)} <small>ج</small>`;
  const od = $('sumOverdue'); if (od) od.innerHTML = `${money(overdue)} <small>ج</small>`;
}

function populateStudentSelect() {
  const { $, esc } = window.__core;
  const sel = $('payStudent');
  if (!sel) return;
  if (paymentsState.students.length === 0) {
    sel.innerHTML = '<option value="">— لا يوجد طلاب —</option>';
    return;
  }
  sel.innerHTML = paymentsState.students
    .map(s => `<option value="${esc(s.id)}" data-monthly="${s.monthly || 0}">${esc(s.name)}</option>`)
    .join('');
}

function populateMonthSelect() {
  const { $ } = window.__core;
  const sel = $('payMonth');
  if (!sel) return;
  sel.innerHTML = MONTHS.map(m => `<option>${m}</option>`).join('');
  // افتراضيًا: الشهر الحالي
  const currentMonth = MONTHS[new Date().getMonth()];
  if (currentMonth) sel.value = currentMonth;
}

function getFilteredRows() {
  const { search, filterMonth, filterStatus, sort } = paymentsState.ui;
  const q = search.toLowerCase();
  let rows = paymentsState.payments.filter(p => {
    if (filterMonth && p.month !== filterMonth) return false;
    if (filterStatus && paymentStatus(p) !== filterStatus) return false;
    if (q) {
      const hay = [studentName(p.studentId), p.month, p.notes].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  rows.sort((a, b) => {
    const av = a[sort.field] ?? '';
    const bv = b[sort.field] ?? '';
    return String(av).localeCompare(String(bv)) * sort.dir;
  });
  return rows;
}

function renderTable() {
  const { $, esc, money } = window.__core;
  const tbody = $('paymentRows');
  if (!tbody) return;

  const rows = getFilteredRows();
  const { page, perPage } = paymentsState.ui;
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  if (page > totalPages) paymentsState.ui.page = totalPages;

  const start = (paymentsState.ui.page - 1) * perPage;
  const paged = rows.slice(start, start + perPage);

  if (paged.length === 0) {
    const hasFilters = paymentsState.ui.search || paymentsState.ui.filterMonth || paymentsState.ui.filterStatus;
    tbody.innerHTML = `<tr><td colspan="8">
      <div class="empty">
        <div class="ico">💵</div>
        <h4>${hasFilters ? 'لا توجد نتائج' : 'لا توجد مدفوعات بعد'}</h4>
        <p>${hasFilters ? 'جرّب تعديل البحث أو الفلاتر' : 'اضغط "تسجيل دفعة" للبدء'}</p>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = paged.map(p => {
    const status = paymentStatus(p);
    const remaining = Math.max(0, Number(p.due || 0) - Number(p.paid || 0));
    return `
      <tr>
        <td><strong>${esc(studentName(p.studentId))}</strong></td>
        <td>${esc(p.month || '-')}</td>
        <td>${money(p.due)} <small style="color:var(--muted)">ج</small></td>
        <td>${money(p.paid)} <small style="color:var(--muted)">ج</small></td>
        <td>${remaining > 0 ? `<span class="chip red">${money(remaining)} ج</span>` : `<span class="chip green">0 ج</span>`}</td>
        <td>${statusChip(status)}</td>
        <td dir="ltr">${esc(p.date || '-')}</td>
        <td class="actions">
          <button class="btn sm" data-action="receipt" data-id="${p.id}" title="إيصال">🧾</button>
          <button class="btn sm danger" data-action="delete" data-id="${p.id}" title="حذف">🗑️</button>
        </td>
      </tr>`;
  }).join('');
}

function renderPagination() {
  const { $ } = window.__core;
  const el = $('paymentsPagination');
  if (!el) return;

  const rows = getFilteredRows();
  const total = rows.length;
  const { perPage } = paymentsState.ui;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(paymentsState.ui.page, totalPages);
  paymentsState.ui.page = page;

  const start = total === 0 ? 0 : (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  const pages = [];
  const maxBtns = 5;
  let from = Math.max(1, page - Math.floor(maxBtns / 2));
  let to = Math.min(totalPages, from + maxBtns - 1);
  if (to - from < maxBtns - 1) from = Math.max(1, to - maxBtns + 1);
  for (let i = from; i <= to; i++) pages.push(i);

  el.innerHTML = `
    <div class="info">عرض ${start}–${end} من ${total} دفعة</div>
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
      if (p === 'prev') paymentsState.ui.page = Math.max(1, paymentsState.ui.page - 1);
      else if (p === 'next') paymentsState.ui.page = Math.min(totalPages, paymentsState.ui.page + 1);
      else paymentsState.ui.page = Number(p);
      renderTable();
      renderPagination();
    });
  });

  const sel = el.querySelector('#perPageSelect');
  if (sel) sel.addEventListener('change', () => {
    paymentsState.ui.perPage = Number(sel.value);
    paymentsState.ui.page = 1;
    renderTable();
    renderPagination();
  });
}

/* ==========================================
   Drawer
   ========================================== */
function openDrawer() {
  const { $ } = window.__core;
  const drawer = $('paymentDrawer');
  const backdrop = $('paymentDrawerBackdrop');
  if (!drawer || !backdrop) return;

  $('paymentForm').reset();
  $('paymentId').value = '';
  $('payPaid').value = 0;

  // تاريخ اليوم
  $('payDate').value = new Date().toISOString().slice(0, 10);

  // الشهر الحالي
  const currentMonth = MONTHS[new Date().getMonth()];
  if (currentMonth) $('payMonth').value = currentMonth;

  drawer.classList.add('open');
  backdrop.classList.add('open');
  document.body.classList.add('drawer-open');
  setTimeout(() => $('payStudent')?.focus(), 300);
}

function closeDrawer() {
  const { $ } = window.__core;
  $('paymentDrawer')?.classList.remove('open');
  $('paymentDrawerBackdrop')?.classList.remove('open');
  document.body.classList.remove('drawer-open');
}

/* ==========================================
   Save
   ========================================== */
async function savePayment() {
  const { $, val, num, actionOverlay, toast, apiPost } = window.__core;
  const payload = {
    studentId: val('payStudent'),
    month: val('payMonth'),
    due: num('payDue'),
    paid: num('payPaid'),
    date: val('payDate') || null,
    notes: val('payNotes') || null,
  };

  if (!payload.studentId) {
    toast('الرجاء اختيار الطالب', 'error');
    return;
  }
  if (!payload.month) {
    toast('الرجاء اختيار الشهر', 'error');
    return;
  }
  if (payload.paid <= 0) {
    toast('المبلغ المدفوع يجب أن يكون أكبر من صفر', 'error');
    return;
  }

  actionOverlay.show('جارٍ تسجيل الدفعة...');
  try {
    const body = await apiPost('/api/payments', payload);
    paymentsState.payments.push(body.data);
    renderAll();
    closeDrawer();
    toast('تم تسجيل الدفعة', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    actionOverlay.hide();
  }
}

/* ==========================================
   Delete
   ========================================== */
async function deletePayment(id) {
  const { confirmModal, actionOverlay, toast, apiDel } = window.__core;
  const p = paymentsState.payments.find(x => x.id === id);
  if (!p) return;

  const ok = await confirmModal(
    'تأكيد الحذف',
    `حذف دفعة "${p.month}" للطالب "${studentName(p.studentId)}"؟ لا يمكن التراجع.`
  );
  if (!ok) return;

  actionOverlay.show('جارٍ الحذف...');
  try {
    await apiDel(`/api/payments/${id}`);
    paymentsState.payments = paymentsState.payments.filter(x => x.id !== id);
    renderAll();
    toast('تم حذف الدفعة', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    actionOverlay.hide();
  }
}

/* ==========================================
   Receipt
   ========================================== */
function openReceipt(id) {
  const { $, esc, money } = window.__core;
  const p = paymentsState.payments.find(x => x.id === id);
  if (!p) return;

  const status = paymentStatus(p);
  const remaining = Math.max(0, Number(p.due || 0) - Number(p.paid || 0));
  const receiptNumber = p.receiptNumber || ('RCP-' + (p.id || '').slice(-8).toUpperCase());
  const receiptDate = p.date || new Date().toISOString().slice(0, 10);

  // تعبئة الـ modal
  $('rcpNumber').textContent = receiptNumber;
  $('rcpDate').textContent = receiptDate;
  $('rcpStudent').textContent = studentName(p.studentId);
  $('rcpMonth').textContent = p.month || '-';
  $('rcpDue').textContent = money(p.due) + ' ج';
  $('rcpPaid').textContent = money(p.paid) + ' ج';
  $('rcpRemaining').textContent = money(remaining) + ' ج';
  $('rcpNotes').textContent = p.notes || '—';

  const statusBadge = $('rcpStatus');
  statusBadge.className = 'status-badge ' + status;
  statusBadge.textContent = statusLabel(status);

  const bd = $('receiptBd');
  bd.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeReceipt() {
  const { $ } = window.__core;
  $('receiptBd')?.classList.remove('open');
  document.body.style.overflow = '';
}

function printReceipt() {
  window.print();
}

/* ==========================================
   Events
   ========================================== */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === 'receipt') openReceipt(id);
  if (action === 'delete') deletePayment(id);
});

document.addEventListener('DOMContentLoaded', () => {
  const { $ } = window.__core;

  $('addPaymentBtn')?.addEventListener('click', (e) => { e.preventDefault(); openDrawer(); });
  $('closePaymentDrawer')?.addEventListener('click', (e) => { e.preventDefault(); closeDrawer(); });
  $('cancelPaymentDrawer')?.addEventListener('click', (e) => { e.preventDefault(); closeDrawer(); });
  $('paymentDrawerBackdrop')?.addEventListener('click', closeDrawer);

  // Receipt close
  $('closeReceipt')?.addEventListener('click', closeReceipt);
  $('printReceipt')?.addEventListener('click', printReceipt);
  $('receiptBd')?.addEventListener('click', (e) => {
    if (e.target.id === 'receiptBd') closeReceipt();
  });

  // Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDrawer();
      closeReceipt();
    }
  });

  // Save
  $('savePaymentBtn')?.addEventListener('click', (e) => { e.preventDefault(); savePayment(); });
  $('paymentForm')?.addEventListener('submit', (e) => { e.preventDefault(); savePayment(); });

  // Auto-fill due amount when student selected
  $('payStudent')?.addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    if (opt) {
      const monthly = Number(opt.dataset.monthly || 0);
      const dueInput = $('payDue');
      if (dueInput && !dueInput.value) dueInput.value = monthly;
    }
  });

  // Search
  $('paymentSearch')?.addEventListener('input', (e) => {
    paymentsState.ui.search = e.target.value;
    paymentsState.ui.page = 1;
    renderTable();
    renderPagination();
  });

  // Filters
  $('filterMonth')?.addEventListener('change', (e) => {
    paymentsState.ui.filterMonth = e.target.value;
    paymentsState.ui.page = 1;
    renderTable();
    renderPagination();
  });
  $('filterStatus')?.addEventListener('change', (e) => {
    paymentsState.ui.filterStatus = e.target.value;
    paymentsState.ui.page = 1;
    renderTable();
    renderPagination();
  });

  // Sort
  document.querySelectorAll('#paymentsTable th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      const ui = paymentsState.ui;
      if (ui.sort.field === field) ui.sort.dir = -ui.sort.dir;
      else { ui.sort.field = field; ui.sort.dir = 1; }
      document.querySelectorAll('#paymentsTable th[data-sort]').forEach(t => {
        t.classList.remove('asc', 'desc');
      });
      th.classList.add(ui.sort.dir === 1 ? 'asc' : 'desc');
      renderTable();
    });
  });
});
