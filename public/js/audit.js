/* global fbClient, api, __core */
'use strict';

const auditState = {
  logs: [],
  stats: null,
  distinct: { actions: [], targetTypes: [], userIds: [] },
  usersMap: {},   // uid -> fullName
  ui: {
    search: '',
    action: '',
    targetType: '',
    fromDate: '',
    toDate: '',
    page: 1,
    perPage: 50,
  },
  total: 0,
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

    // سجل النشاط للمدير فقط
    if (session.profile.role !== 'admin') {
      loader.error('ليس لديك صلاحية لعرض سجل النشاط. هذه الصفحة للمدير فقط.');
      setTimeout(() => location.href = '/dashboard.html', 2000);
      return;
    }

    hydrateUser(session.profile);
    initShell();
    document.getElementById('app').hidden = false;

    loader.progress(40, 'جارٍ تحميل البيانات...');
    await loadAll();

    loader.progress(90, 'جارٍ تجهيز الواجهة...');
    renderAll();

    loader.progress(100, 'اكتمل ✓');
    setTimeout(() => loader.hide(), 300);
  } catch (err) {
    console.error(err);
    loader.error(err.message || 'حدث خطأ');
  }
})();

/* ==========================================
   Load data
   ========================================== */
async function loadAll() {
  const { apiGet, $ } = window.__core;
  const ui = auditState.ui;

  // 1) بيانات الفلاتر والإحصاءات
  const [statsRes, distinctRes, studentsRes, workersRes, permitsRes, paymentsRes] = await Promise.all([
    apiGet('/api/audit-logs/stats').catch(() => ({ data: { total: 0, today: 0, byUser: {} } })),
    apiGet('/api/audit-logs/distinct').catch(() => ({ data: { actions: [], targetTypes: [], userIds: [] } })),
    apiGet('/api/students?limit=1').catch(() => ({ data: [] })),
    apiGet('/api/workers?limit=1').catch(() => ({ data: [] })),
    apiGet('/api/permits?limit=1').catch(() => ({ data: [] })),
    apiGet('/api/payments?limit=1').catch(() => ({ data: [] })),
  ]);

  auditState.stats = statsRes.data;
  auditState.distinct = distinctRes.data;

  // Nav badges
  $('navStudentsBadge').textContent = (studentsRes.data || []).length ? '...' : '0';
  $('navWorkersBadge').textContent = '...';
  $('navPermitsBadge').textContent = '...';
  $('navPaymentsBadge').textContent = '...';
  $('navRoomsBadge').textContent = '...';

  // 2) قائمة السجلات (بالفلاتر)
  const params = new URLSearchParams();
  if (ui.search) params.set('search', ui.search);
  if (ui.action) params.set('action', ui.action);
  if (ui.targetType) params.set('targetType', ui.targetType);
  if (ui.fromDate) params.set('fromDate', ui.fromDate);
  if (ui.toDate) params.set('toDate', ui.toDate);
  params.set('page', ui.page);
  params.set('limit', ui.perPage);

  const logsRes = await apiGet('/api/audit-logs?' + params.toString())
    .catch(() => ({ data: [], meta: { total: 0 } }));

  auditState.logs = logsRes.data || [];
  auditState.total = logsRes.meta?.total || 0;

  // 3) جلب أسماء المستخدمين
  const uids = [...new Set(auditState.logs.map(l => l.userId).filter(Boolean))];
  const names = await Promise.all(
    uids.map(uid =>
      apiGet(`/api/audit-logs?userId=${uid}&limit=1`)
        .then(r => ({ uid, name: r.data?.[0]?.details?.fullName || null }))
        .catch(() => ({ uid, name: null }))
    )
  );
  // اسم بديل: من userId أو من profile الحالي
  uids.forEach(uid => {
    if (uid === window.currentUser?.uid) {
      auditState.usersMap[uid] = window.currentUser.fullName || 'أنت';
    } else {
      auditState.usersMap[uid] = uid.slice(0, 8);
    }
  });
}

/* ==========================================
   Render
   ========================================== */
function renderAll() {
  renderStats();
  renderFilters();
  renderTimeline();
  renderPagination();
}

function renderStats() {
  const { $ } = window.__core;
  const s = auditState.stats || {};
  $('statTotal').textContent = s.total || 0;
  $('statToday').textContent = s.today || 0;
  $('statUsers').textContent = Object.keys(s.byUser || {}).length;
}

function renderFilters() {
  const { $, esc } = window.__core;
  const aSel = $('filterAction');
  const tSel = $('filterTargetType');

  aSel.innerHTML = '<option value="">كل العمليات</option>' +
    (auditState.distinct.actions || []).map(a =>
      `<option value="${esc(a)}">${esc(a)}</option>`).join('');

  tSel.innerHTML = '<option value="">كل العناصر</option>' +
    (auditState.distinct.targetTypes || []).map(t =>
      `<option value="${esc(t)}">${esc(t)}</option>`).join('');
}

function renderTimeline() {
  const { $, esc, fmtDate } = window.__core;
  const el = $('auditTimeline');

  if (!auditState.logs.length) {
    el.innerHTML = `<div class="audit-empty">
      <div class="ico">📋</div>
      <h4>لا توجد سجلات</h4>
      <p>لم تُنفّذ أي عمليات بعد، أو لا توجد نتائج تطابق الفلاتر</p>
    </div>`;
    return;
  }

  el.innerHTML = auditState.logs.map(log => {
    const actionClass = actionToClass(log.action);
    const time = log.createdAt
      ? new Date(log.createdAt).toLocaleString('ar-EG', {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      : '—';
    const userName = auditState.usersMap[log.userId] || log.userId?.slice(0, 8) || '—';
    const detailsStr = log.details
      ? JSON.stringify(log.details, null, 2).slice(0, 200)
      : '';

    return `
      <div class="audit-item ${actionClass}">
        <div class="head">
          <div class="left">
            <span class="action-badge ${actionClass}">${esc(log.action || '—')}</span>
            <span class="target">
              ${log.targetType ? `<strong>${esc(log.targetType)}</strong>` : ''}
              ${log.targetId ? ` · ${esc(log.targetId.slice(0, 12))}` : ''}
            </span>
          </div>
          <span class="time">🕐 ${esc(time)}</span>
        </div>
        <div class="meta">
          <div class="item">👤 <strong>${esc(userName)}</strong></div>
          ${log.ip ? `<div class="item">🌐 <strong>${esc(log.ip)}</strong></div>` : ''}
        </div>
        ${detailsStr ? `<div class="details">${esc(detailsStr)}</div>` : ''}
      </div>`;
  }).join('');
}

function actionToClass(action) {
  if (!action) return '';
  if (action.includes('.create') || action.includes('.add')) return 'success';
  if (action.includes('.delete') || action.includes('.remove')) return 'danger';
  if (action.includes('.update') || action.includes('.edit')) return 'warning';
  return '';
}

function renderPagination() {
  const { $ } = window.__core;
  const el = $('auditPagination');
  const total = auditState.total;
  const perPage = auditState.ui.perPage;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(auditState.ui.page, totalPages);
  auditState.ui.page = page;

  const start = total === 0 ? 0 : (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  const pages = [];
  const maxBtns = 5;
  let from = Math.max(1, page - Math.floor(maxBtns / 2));
  let to = Math.min(totalPages, from + maxBtns - 1);
  if (to - from < maxBtns - 1) from = Math.max(1, to - maxBtns + 1);
  for (let i = from; i <= to; i++) pages.push(i);

  el.innerHTML = `
    <div class="info">عرض ${start}–${end} من ${total}</div>
    <div class="controls">
      <button data-page="prev" ${page<=1?'disabled':''}>‹</button>
      ${pages.map(p => `<button data-page="${p}" class="${p===page?'active':''}">${p}</button>`).join('')}
      <button data-page="next" ${page>=totalPages?'disabled':''}>›</button>
    </div>`;

  el.querySelectorAll('button[data-page]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const p = btn.dataset.page;
      if (p === 'prev') auditState.ui.page = Math.max(1, auditState.ui.page - 1);
      else if (p === 'next') auditState.ui.page = Math.min(totalPages, auditState.ui.page + 1);
      else auditState.ui.page = Number(p);
      await loadAll();
      renderAll();
    });
  });
}

/* ==========================================
   Events
   ========================================== */
let searchTimeout;
document.addEventListener('DOMContentLoaded', () => {
  const { $ } = window.__core;

  $('auditSearch')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      auditState.ui.search = e.target.value;
      auditState.ui.page = 1;
      await loadAll();
      renderAll();
    }, 400);
  });

  $('filterAction')?.addEventListener('change', async (e) => {
    auditState.ui.action = e.target.value;
    auditState.ui.page = 1;
    await loadAll();
    renderAll();
  });

  $('filterTargetType')?.addEventListener('change', async (e) => {
    auditState.ui.targetType = e.target.value;
    auditState.ui.page = 1;
    await loadAll();
    renderAll();
  });

  $('filterFrom')?.addEventListener('change', async (e) => {
    auditState.ui.fromDate = e.target.value;
    auditState.ui.page = 1;
    await loadAll();
    renderAll();
  });

  $('filterTo')?.addEventListener('change', async (e) => {
    auditState.ui.toDate = e.target.value;
    auditState.ui.page = 1;
    await loadAll();
    renderAll();
  });
});
