/* global fbClient, api, __core */
'use strict';

const empState = {
  employees: [],
  stats: null,
  ui: { search: '', role: '', status: '' },
};

(async function boot() {
  const { loader, requireSession, hydrateUser, initShell } = window.__core;

  loader.show('جارٍ الاتصال...', 5);

  try {
    const session = await requireSession();
    if (!session) return;

    // للمدير فقط
    if (session.profile.role !== 'admin') {
      loader.error('هذه الصفحة للمدير فقط');
      setTimeout(() => location.href = '/dashboard.html', 2000);
      return;
    }

    hydrateUser(session.profile);
    initShell();
    document.getElementById('app').hidden = false;

    loader.progress(50, 'جارٍ تحميل الموظفين...');
    await loadData();

    loader.progress(90, 'جارٍ التجهيز...');
    renderAll();

    loader.progress(100, 'اكتمل ✓');
    setTimeout(() => loader.hide(), 300);
  } catch (err) {
    loader.error(err.message || 'حدث خطأ');
  }
})();

async function loadData() {
  const { apiGet } = window.__core;
  const [empRes, statsRes, studentsRes, roomsRes, workersRes, permitsRes, paymentsRes] = await Promise.all([
    apiGet('/api/employees?limit=500').catch(() => ({ data: [] })),
    apiGet('/api/employees/stats').catch(() => ({ data: null })),
    apiGet('/api/students?limit=1').catch(() => ({ data: [] })),
    apiGet('/api/rooms/rooms').catch(() => ({ data: [] })),
    apiGet('/api/workers?limit=1').catch(() => ({ data: [] })),
    apiGet('/api/permits?limit=1').catch(() => ({ data: [] })),
    apiGet('/api/payments?limit=1').catch(() => ({ data: [] })),
  ]);
  empState.employees = empRes.data || [];
  empState.stats = statsRes.data;
  window.__badges = {
    students: (studentsRes.data || []).length,
    rooms: (roomsRes.data || []).length,
    workers: (workersRes.data || []).length,
    permits: (permitsRes.data || []).length,
    payments: (paymentsRes.data || []).length,
  };
}

function renderAll() {
  renderStats();
  renderNavBadges();
  renderTable();
}

function renderNavBadges() {
  const { $ } = window.__core;
  $('navStudentsBadge').textContent = window.__badges?.students ?? 0;
  $('navRoomsBadge').textContent = window.__badges?.rooms ?? 0;
  $('navWorkersBadge').textContent = window.__badges?.workers ?? 0;
  $('navPermitsBadge').textContent = window.__badges?.permits ?? 0;
  $('navPaymentsBadge').textContent = window.__badges?.payments ?? 0;
}

function renderStats() {
  const { $ } = window.__core;
  const s = empState.stats || {};
  $('statTotal').textContent = s.total || 0;
  $('statAdmins').textContent = s.admins || 0;
  $('statActive').textContent = s.active || 0;
  $('statDisabled').textContent = s.disabled || 0;
}

function getFiltered() {
  const { search, role, status } = empState.ui;
  const q = search.toLowerCase();
  return empState.employees.filter(e => {
    if (role && e.role !== role) return false;
    if (status && (e.status || 'active') !== status) return false;
    if (q) {
      const hay = [e.fullName, e.email, e.phone].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderTable() {
  const { $, esc } = window.__core;
  const tbody = $('empRows');
  if (!tbody) return;
  const rows = getFiltered();

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty">
      <div class="ico">👤</div>
      <h4>لا يوجد موظفون</h4>
      <p>اضغط "إضافة موظف" للبدء</p>
    </div></td></tr>`;
    return;
  }

  const currentUid = window.currentUser?.uid;

  tbody.innerHTML = rows.map(e => {
    const perms = Array.isArray(e.permissions) ? e.permissions : [];
    const status = e.status || 'active';
    return `
      <tr>
        <td><strong>${esc(e.fullName || '—')}</strong></td>
        <td dir="ltr">${esc(e.email || '—')}</td>
        <td dir="ltr">${esc(e.phone || '—')}</td>
        <td>
          <span class="emp-badge ${e.role === 'admin' ? 'admin' : ''}">
            ${e.role === 'admin' ? '👑 مدير' : 'موظف'}
          </span>
        </td>
        <td>
          <span class="emp-badge ${status === 'active' ? 'active' : 'disabled'}">
            ${status === 'active' ? '✅ نشط' : '🚫 معطل'}
          </span>
        </td>
        <td>
          ${e.role === 'admin'
            ? '<span class="emp-badge admin">كل الصلاحيات</span>'
            : `<span style="font-size:12px;color:var(--muted)">${perms.length} صلاحية</span>`}
        </td>
        <td style="white-space:nowrap">
          <button class="btn sm" data-action="edit" data-uid="${e.uid}">✏️</button>
          ${e.role !== 'admin' && e.uid !== currentUid ? `
            <button class="btn sm ${status === 'active' ? 'danger' : 'success'}" data-action="toggle" data-uid="${e.uid}" data-status="${status}">
              ${status === 'active' ? '🚫' : '✅'}
            </button>
            <button class="btn sm danger" data-action="delete" data-uid="${e.uid}">🗑️</button>
          ` : ''}
        </td>
      </tr>`;
  }).join('');
}

/* ==========================================
   Drawer
   ========================================== */
function openDrawer(mode = 'add', emp = null) {
  const { $ } = window.__core;
  $('empForm').reset();
  $('empUid').value = '';
  document.querySelectorAll('.perm-check input').forEach(cb => cb.checked = false);
  document.querySelectorAll('.perm-check').forEach(el => el.classList.remove('checked'));

  const emailInput = $('efEmail');
  const pwdInput = $('efPassword');

  if (mode === 'edit' && emp) {
    $('empDrawerTitle').textContent = 'تعديل موظف';
    $('empUid').value = emp.uid;
    $('efFullName').value = emp.fullName || '';
    $('efEmail').value = emp.email || '';
    $('efEmail').disabled = true;
    $('efPhone').value = emp.phone || '';
    $('efStatus').value = emp.status || 'active';
    pwdInput.value = '';
    pwdInput.disabled = true;
    pwdInput.placeholder = 'غير قابل للتعديل — استخدم إعادة تعيين كلمة المرور';
    (emp.permissions || []).forEach(p => {
      const cb = document.querySelector(`.perm-check input[value="${p}"]`);
      if (cb) { cb.checked = true; cb.closest('.perm-check').classList.add('checked'); }
    });
  } else {
    $('empDrawerTitle').textContent = 'إضافة موظف';
    emailInput.disabled = false;
    pwdInput.disabled = false;
    pwdInput.placeholder = '8 أحرف على الأقل';
  }

  $('empDrawer').classList.add('open');
  $('empDrawerBackdrop').classList.add('open');
}

function closeDrawer() {
  const { $ } = window.__core;
  $('empDrawer')?.classList.remove('open');
  $('empDrawerBackdrop')?.classList.remove('open');
}

/* ==========================================
   Save
   ========================================== */
async function saveEmployee() {
  const { $, val, toast, actionOverlay, apiPost, apiPut } = window.__core;
  const uid = val('empUid');
  const permissions = [...document.querySelectorAll('.perm-check input:checked')]
    .map(cb => cb.value);

  const payload = {
    fullName: val('efFullName'),
    phone: val('efPhone') || null,
    permissions,
    status: val('efStatus'),
  };

  if (!payload.fullName || payload.fullName.length < 3) {
    toast('الاسم مطلوب (3 أحرف على الأقل)', 'error');
    return;
  }

  actionOverlay.show(uid ? 'جارٍ التحديث...' : 'جارٍ الإنشاء...');
  try {
    if (uid) {
      await apiPut(`/api/employees/${uid}`, payload);
      toast('تم تحديث بيانات الموظف', 'success');
    } else {
      const newPayload = {
        ...payload,
        email: val('efEmail'),
        password: val('efPassword'),
      };
      if (!newPayload.email) throw new Error('البريد مطلوب');
      if (!newPayload.password || newPayload.password.length < 8) {
        throw new Error('كلمة المرور 8 أحرف على الأقل');
      }
      await apiPost('/api/employees', newPayload);
      toast('تم إنشاء الموظف. يمكنه تسجيل الدخول الآن.', 'success');
    }
    await loadData();
    renderAll();
    closeDrawer();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    actionOverlay.hide();
  }
}

/* ==========================================
   Toggle / Delete
   ========================================== */
async function toggleEmployee(uid, currentStatus) {
  const { toast, actionOverlay, apiPost } = window.__core;
  actionOverlay.show(currentStatus === 'active' ? 'جارٍ التعطيل...' : 'جارٍ التفعيل...');
  try {
    await apiPost(`/api/employees/${uid}/toggle`, {});
    await loadData();
    renderAll();
    toast(currentStatus === 'active' ? 'تم تعطيل الحساب' : 'تم تفعيل الحساب', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    actionOverlay.hide();
  }
}

async function deleteEmployee(uid) {
  const { confirmModal, toast, actionOverlay, apiDel } = window.__core;
  const ok = await confirmModal('تأكيد الحذف', 'سيتم حذف الحساب نهائيًا. لا يمكن التراجع.');
  if (!ok) return;

  actionOverlay.show('جارٍ الحذف...');
  try {
    await apiDel(`/api/employees/${uid}`);
    await loadData();
    renderAll();
    toast('تم حذف الموظف', 'success');
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
  const { action, uid, status } = btn.dataset;
  if (action === 'edit') {
    const emp = empState.employees.find(x => x.uid === uid);
    if (emp) openDrawer('edit', emp);
  }
  if (action === 'toggle') toggleEmployee(uid, status);
  if (action === 'delete') deleteEmployee(uid);
});

document.addEventListener('DOMContentLoaded', () => {
  const { $ } = window.__core;

  $('addEmployeeBtn')?.addEventListener('click', () => openDrawer('add'));
  $('closeEmpDrawer')?.addEventListener('click', closeDrawer);
  $('cancelEmpDrawer')?.addEventListener('click', closeDrawer);
  $('empDrawerBackdrop')?.addEventListener('click', closeDrawer);
  $('saveEmpBtn')?.addEventListener('click', saveEmployee);
  $('empForm')?.addEventListener('submit', (e) => { e.preventDefault(); saveEmployee(); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDrawer();
  });

  $('empSearch')?.addEventListener('input', (e) => {
    empState.ui.search = e.target.value;
    renderTable();
  });
  $('filterRole')?.addEventListener('change', (e) => {
    empState.ui.role = e.target.value;
    renderTable();
  });
  $('filterStatus')?.addEventListener('change', (e) => {
    empState.ui.status = e.target.value;
    renderTable();
  });

  // toggle perm-check styling
  document.querySelectorAll('.perm-check input').forEach(cb => {
    cb.addEventListener('change', () => {
      cb.closest('.perm-check').classList.toggle('checked', cb.checked);
    });
  });
});
