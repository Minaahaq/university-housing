/* global firebase, fbClient, api, __core */
'use strict';

const settingsState = {
  profile: null,
  user: null,
};

/* ==========================================
   Boot
   ========================================== */
(async function boot() {
  const { loader, requireSession, hydrateUser, initShell, apiGet } = window.__core;

  loader.show('جارٍ الاتصال...', 5);

  try {
    loader.progress(20, 'جارٍ التحقق من الجلسة...');
    const session = await requireSession();
    if (!session) return;

    settingsState.profile = session.profile;
    settingsState.user = session.user;

    hydrateUser(session.profile);
    initShell();
    document.getElementById('app').hidden = false;

    loader.progress(60, 'جارٍ تحميل البيانات...');
    const [studentsRes, workersRes, permitsRes, paymentsRes] = await Promise.all([
      apiGet('/api/students?limit=500').catch(() => ({ data: [] })),
      apiGet('/api/workers?limit=500').catch(() => ({ data: [] })),
      apiGet('/api/permits?limit=500').catch(() => ({ data: [] })),
      apiGet('/api/payments?limit=500').catch(() => ({ data: [] })),
    ]);

    // Nav badges
    const $ = window.__core.$;
    $('navStudentsBadge').textContent = (studentsRes.data || []).length;
    $('navWorkersBadge').textContent = (workersRes.data || []).length;
    $('navPermitsBadge').textContent = (permitsRes.data || []).length;
    $('navPaymentsBadge').textContent = (paymentsRes.data || []).length;

    loader.progress(90, 'جارٍ تجهيز الصفحة...');
    renderProfile(session.profile);

    loader.progress(100, 'اكتمل ✓');
    setTimeout(() => loader.hide(), 300);
  } catch (err) {
    console.error(err);
    loader.error(err.message || 'حدث خطأ');
  }
})();

/* ==========================================
   Render profile
   ========================================== */
function renderProfile(profile) {
  const { $, esc } = window.__core;

  // Account info
  $('infoFullName').textContent = profile.fullName || '—';
  $('infoEmail').textContent = profile.email || '—';
  $('infoRole').textContent = profile.role === 'admin' ? 'مدير النظام' : 'موظف';
  $('infoUid').textContent = profile.uid || '—';
  $('infoCreatedAt').textContent = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  // Permissions
  const permsEl = $('infoPermissions');
  if (profile.role === 'admin') {
    permsEl.innerHTML = '<div class="perm-badge admin">👑 مدير — جميع الصلاحيات</div>';
  } else if (Array.isArray(profile.permissions) && profile.permissions.length > 0) {
    permsEl.innerHTML = profile.permissions
      .map(p => `<div class="perm-badge">${esc(p)}</div>`)
      .join('');
  } else {
    permsEl.innerHTML = '<div class="perm-badge">لا توجد صلاحيات مخصصة</div>';
  }

  // Prefill profile form
  $('profileFullName').value = profile.fullName || '';
  $('profilePhone').value = profile.phone || '';
  $('profileEmail').value = profile.email || '';
}

/* ==========================================
   Tabs (nav)
   ========================================== */
document.addEventListener('DOMContentLoaded', () => {
  const { $ } = window.__core;

  document.querySelectorAll('.settings-nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.settings-nav button').forEach(b =>
        b.classList.toggle('active', b === btn));
      document.querySelectorAll('.settings-panel').forEach(p =>
        p.classList.toggle('active', p.id === target));
    });
  });

  // ============ Profile form ============
  $('saveProfileBtn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const { $, val, actionOverlay, toast, apiPut } = window.__core;

    const fullName = val('profileFullName');
    const phone = val('profilePhone');

    if (!fullName || fullName.length < 3) {
      toast('الاسم الكامل مطلوب (3 أحرف على الأقل)', 'error');
      return;
    }

    actionOverlay.show('جارٍ حفظ البيانات...');
    try {
      const body = await apiPut('/api/auth/profile', { fullName, phone });
      settingsState.profile = { ...settingsState.profile, ...body.data };
      window.__core.hydrateUser(settingsState.profile);
      renderProfile(settingsState.profile);
      toast('تم حفظ بيانات الملف الشخصي', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      actionOverlay.hide();
    }
  });

  // ============ Change password form ============
  $('changePasswordBtn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const { $, val, actionOverlay, toast } = window.__core;

    const currentPwd = val('currentPassword');
    const newPwd = val('newPassword');
    const confirmPwd = val('confirmPassword');

    if (!currentPwd) { toast('كلمة المرور الحالية مطلوبة', 'error'); return; }
    if (!newPwd || newPwd.length < 8) { toast('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل', 'error'); return; }
    if (newPwd !== confirmPwd) { toast('كلمتا المرور غير متطابقتين', 'error'); return; }
    if (newPwd === currentPwd) { toast('كلمة المرور الجديدة يجب أن تختلف عن الحالية', 'error'); return; }

    actionOverlay.show('جارٍ تغيير كلمة المرور...');
    try {
      const user = fbClient.auth.currentUser;
      if (!user) throw new Error('لا توجد جلسة نشطة');

      // Reauthenticate with current password
      const credential = firebase.auth.EmailAuthProvider.credential(
        user.email, currentPwd
      );
      await user.reauthenticateWithCredential(credential);

      // Update password
      await user.updatePassword(newPwd);

      // Clear form
      $('currentPassword').value = '';
      $('newPassword').value = '';
      $('confirmPassword').value = '';

      toast('تم تغيير كلمة المرور بنجاح', 'success');
    } catch (err) {
      console.error(err);
      let msg = 'فشل تغيير كلمة المرور';
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'كلمة المرور الحالية غير صحيحة';
      } else if (err.code === 'auth/weak-password') {
        msg = 'كلمة المرور الجديدة ضعيفة جدًا';
      } else if (err.code === 'auth/requires-recent-login') {
        msg = 'يرجى إعادة تسجيل الدخول أولًا';
      } else if (err.message) {
        msg = err.message;
      }
      toast(msg, 'error');
    } finally {
      actionOverlay.hide();
    }
  });

  // ============ Sign out all devices ============
  $('signOutAllBtn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const { confirmModal, toast } = window.__core;

    const ok = await confirmModal(
      'تسجيل الخروج من جميع الأجهزة',
      'هل تريد تسجيل الخروج من جميع الأجهزة؟ ستحتاج لتسجيل الدخول مجددًا هنا.'
    );
    if (!ok) return;

    try {
      const token = await fbClient.getIdToken();
      // This endpoint will revoke refresh tokens server-side
      await window.__core.apiDel('/api/auth/sessions', token).catch(async () => {
        // Fallback: just sign out locally
        await fbClient.signOut();
      });
      await fbClient.signOut();
      toast('تم تسجيل الخروج من جميع الأجهزة', 'success');
      setTimeout(() => location.href = '/login.html', 800);
    } catch (err) {
      toast(err.message || 'فشل تسجيل الخروج', 'error');
    }
  });
});
