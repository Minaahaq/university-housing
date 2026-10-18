/* global firebase, fbClient, api */
'use strict';

/* ================== أدوات ================== */
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const val = id => ($(id)?.value ?? '').trim();
const num = id => Number($(id)?.value || 0);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
));
const money = n => (Number(n) || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 });
const fmtDate = s => s ? new Date(s).toLocaleDateString('ar-EG') : '-';

/* ================== Toast ================== */
function toast(message, type = 'info') {
  let host = $('toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toasts';
    host.className = 'toasts';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .2s'; setTimeout(() => el.remove(), 220); }, 3000);
}

/* ================== Loader ================== */
const loader = {
  el: () => $('loader'),
  bar: () => $('loaderBar'),
  status: () => $('loaderStatus'),
  show(text, pct) {
    const el = this.el(); if (!el) return;
    el.classList.remove('fade-out','error');
    el.style.display = 'flex';
    if (text && this.status()) this.status().textContent = text;
    if (typeof pct === 'number' && this.bar()) this.bar().style.width = Math.min(100, Math.max(0, pct)) + '%';
  },
  progress(pct, text) {
    if (typeof pct === 'number' && this.bar()) this.bar().style.width = Math.min(100, Math.max(0, pct)) + '%';
    if (text && this.status()) this.status().textContent = text;
  },
  hide() {
    const el = this.el(); if (!el) return;
    if (this.bar()) this.bar().style.width = '100%';
    setTimeout(() => el.classList.add('fade-out'), 250);
    setTimeout(() => { el.style.display = 'none'; }, 650);
  },
  error(msg) {
    const el = this.el(); if (!el) return;
    el.classList.add('error'); el.classList.remove('fade-out');
    el.style.display = 'flex';
    const m = $('loaderErrorMsg'); if (m) m.textContent = msg || 'حدث خطأ';
  },
};

/* ================== Action Overlay ================== */
const actionOverlay = {
  show(msg = 'جارٍ التنفيذ...') {
    const el = $('actionOverlay'); if (!el) return;
    const m = $('actionMsg'); if (m) m.textContent = msg;
    el.classList.add('open');
  },
  hide() { $('actionOverlay')?.classList.remove('open'); },
};

/* ================== Confirm Modal ================== */
function confirmModal(title, message) {
  return new Promise((resolve) => {
    const bd = $('modalBd'); if (!bd) return resolve(confirm(message));
    $('modalTitle').textContent = title;
    $('modalMessage').textContent = message;
    bd.classList.add('open');
    const ok = $('modalOk'), cancel = $('modalCancel');
    function cleanup(r) {
      bd.classList.remove('open');
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      resolve(r);
    }
    function onOk(){ cleanup(true); }
    function onCancel(){ cleanup(false); }
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
  });
}

/* ================== Session ================== */
async function requireSession() {
  const user = await new Promise((resolve) => {
    const unsub = fbClient.onAuthStateChanged(u => { unsub(); resolve(u); });
  });
  if (!user) { location.href = '/login.html'; return null; }

  const token = await fbClient.getIdToken();
  if (!token) { location.href = '/login.html'; return null; }

  const res = await api.get('/api/auth/me', token);
  const body = await res.json();
  if (!res.ok) {
    toast(body.message || 'تعذّر التحقق', 'error');
    setTimeout(() => fbClient.signOut().then(() => location.href = '/login.html'), 1500);
    return null;
  }
  return { user, token, profile: body.data };
}

/* ================== Hydrate user UI ================== */
function hydrateUser(profile) {
  const initials = (profile.fullName || '؟').trim().split(/\s+/).map(w => w[0]).slice(0,2).join('');
  const n = $('userName'); if (n) n.textContent = profile.fullName || 'مستخدم';
  const r = $('userRole'); if (r) r.textContent = profile.role === 'admin' ? 'مدير' : 'موظف';
  const a = $('userAvatar'); if (a) a.textContent = initials || '؟';
}

/* ================== Sidebar / Topbar مشتركة ================== */
function initShell() {
  // Sidebar toggle
  $('menuBtn')?.addEventListener('click', () => $('sidebar')?.classList.toggle('open'));

  // Theme toggle
  const themeBtn = $('themeBtn');
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  if (themeBtn) {
    themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    themeBtn.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      themeBtn.textContent = next === 'dark' ? '☀️' : '🌙';
      localStorage.setItem('theme', next);
    });
  }

  // Logout
  $('logoutBtn')?.addEventListener('click', async () => {
    await fbClient.signOut();
    location.href = '/login.html';
  });
}

/* ================== API helpers ================== */
async function apiGet(path) {
  const token = await fbClient.getIdToken();
  const res = await api.get(path, token);
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || 'فشل الاتصال');
  return body;
}
async function apiPost(path, payload) {
  const token = await fbClient.getIdToken();
  const res = await api.post(path, payload, token);
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || 'فشل الحفظ');
  return body;
}
async function apiPut(path, payload) {
  const token = await fbClient.getIdToken();
  const res = await api.put(path, payload, token);
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || 'فشل التحديث');
  return body;
}
async function apiDel(path) {
  const token = await fbClient.getIdToken();
  const res = await api.del(path, token);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || 'فشل الحذف');
  }
  return true;
}

/* ================== Status Chips ================== */
function statusChip(status) {
  const map = {
    'مقيم':'green','مسافر':'amber','إجازة':'gray','منسحب':'red',
    'قيد المراجعة':'amber','معتمد':'green','مرفوض':'red','مكتمل':'',
  };
  return `<span class="chip ${map[status] || ''}">${esc(status || '-')}</span>`;
}

window.__core = {
  $, $$, val, num, esc, money, fmtDate,
  toast, loader, actionOverlay, confirmModal,
  requireSession, hydrateUser, initShell,
  apiGet, apiPost, apiPut, apiDel,
  statusChip,
};
