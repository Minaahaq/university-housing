/* global fbClient, api */
'use strict';

/* ==========================================
   Helpers
   ========================================== */
const $ = (id) => document.getElementById(id);

function showAlert(message, type = 'error') {
  const el = $('loginAlert');
  if (!el) return;
  el.className = 'login-alert show ' + type;
  el.textContent = message;
  // Scroll to alert on mobile
  if (window.innerWidth < 860) {
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function clearAlert() {
  const el = $('loginAlert');
  if (el) el.className = 'login-alert';
}

function setLoading(loading) {
  const btn = $('loginBtn');
  if (!btn) return;
  btn.disabled = loading;
  btn.classList.toggle('loading', loading);
}

function translateAuthError(err) {
  const code = err?.code || '';
  const map = {
    'auth/invalid-email': 'البريد الإلكتروني غير صالح',
    'auth/user-disabled': 'تم إيقاف هذا الحساب. راجع الإدارة',
    'auth/user-not-found': 'لا يوجد حساب بهذا البريد الإلكتروني',
    'auth/wrong-password': 'كلمة المرور غير صحيحة',
    'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة',
    'auth/invalid-login-credentials': 'البريد أو كلمة المرور غير صحيحة',
    'auth/too-many-requests': 'محاولات كثيرة. حاول لاحقًا',
    'auth/network-request-failed': 'تعذّر الاتصال بالإنترنت. تحقق من الشبكة',
    'auth/api-key-not-valid': 'إعدادات Firebase غير صحيحة. راجع الإدارة',
    'auth/invalid-api-key': 'إعدادات Firebase غير صحيحة. راجع الإدارة',
    'auth/operation-not-allowed': 'تسجيل الدخول بالبريد غير مفعّل. راجع الإدارة',
  };
  return map[code] || err?.message || 'فشل تسجيل الدخول';
}

/* ==========================================
   Validation
   ========================================== */
function validateEmail() {
  const input = $('email');
  const group = $('emailGroup');
  const value = input.value.trim();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  group.classList.toggle('invalid', !valid && value.length > 0);
  return valid;
}

function validatePassword() {
  const input = $('password');
  const group = $('passwordGroup');
  const value = input.value;
  const valid = value.length >= 8;
  group.classList.toggle('invalid', !valid && value.length > 0);
  return valid;
}

/* ==========================================
   Init
   ========================================== */
document.addEventListener('DOMContentLoaded', () => {
  // === Theme ===
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const themeBtn = $('themeToggle');
  if (themeBtn) {
    themeBtn.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
    themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      themeBtn.textContent = next === 'dark' ? '🌙' : '☀️';
      localStorage.setItem('theme', next);
    });
  }

  // === Toggle password ===
  const toggleBtn = $('togglePassword');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const input = $('password');
      if (input.type === 'password') {
        input.type = 'text';
        toggleBtn.textContent = '🙈';
        toggleBtn.setAttribute('aria-label', 'إخفاء كلمة المرور');
      } else {
        input.type = 'password';
        toggleBtn.textContent = '👁';
        toggleBtn.setAttribute('aria-label', 'إظهار كلمة المرور');
      }
    });
  }

  // === Live validation ===
  $('email')?.addEventListener('blur', validateEmail);
  $('email')?.addEventListener('input', () => {
    clearAlert();
    if ($('emailGroup').classList.contains('invalid')) validateEmail();
  });
  $('password')?.addEventListener('blur', validatePassword);
  $('password')?.addEventListener('input', () => {
    clearAlert();
    if ($('passwordGroup').classList.contains('invalid')) validatePassword();
  });

  // === Remember me ===
  const rememberEl = $('rememberMe');
  if (rememberEl) {
    rememberEl.checked = localStorage.getItem('rememberMe') === '1';
    rememberEl.addEventListener('change', () => {
      localStorage.setItem('rememberMe', rememberEl.checked ? '1' : '0');
    });
  }

  // === Forgot password ===
  $('forgotPasswordLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    const email = $('email')?.value.trim();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAlert('سيتم إرسال رابط إعادة التعيين إذا كان البريد مسجلًا. راجع بريدك.', 'success');
    } else {
      showAlert('أدخل بريدك الإلكتروني أولًا لإعادة تعيين كلمة المرور.', 'error');
      $('email')?.focus();
    }
  });

  // === Submit ===
  $('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();

    const email = $('email').value.trim();
    const password = $('password').value;

    // Validation
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const passwordValid = password.length >= 8;

    $('emailGroup').classList.toggle('invalid', !emailValid);
    $('passwordGroup').classList.toggle('invalid', !passwordValid);

    if (!emailValid || !passwordValid) {
      showAlert('الرجاء تصحيح البيانات المدخلة', 'error');
      return;
    }

    setLoading(true);
    try {
      // 1) Firebase sign-in
      await fbClient.signIn(email, password);

      // 2) Get token
      const token = await fbClient.getIdToken();
      if (!token) throw new Error('تعذّر الحصول على جلسة صالحة');

      // 3) Verify with server
      const res = await api.get('/api/auth/me', token);
      const body = await res.json();

      if (!res.ok) {
        await fbClient.signOut();
        throw new Error(body.message || 'تعذّر التحقق من الحساب');
      }

      showAlert('تم تسجيل الدخول بنجاح. جارٍ التحويل...', 'success');

      // 4) Redirect
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 500);

    } catch (err) {
      console.error('Login error:', err);
      const msg = translateAuthError(err);
      showAlert(msg, 'error');
      setLoading(false);
      $('password')?.focus();
    }
  });

  // === Auto-focus ===
  setTimeout(() => {
    const emailInput = $('email');
    if (emailInput && !emailInput.value) {
      emailInput.focus();
    }
  }, 300);
});
