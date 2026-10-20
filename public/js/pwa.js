/* ==========================================
   PWA Registration & Update Manager — v2
   ========================================== */

(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) {
    console.log('[PWA] Service Worker غير مدعوم');
    return;
  }

  // ==========================================
  // 1) تسجيل Service Worker (بدون HTTP cache)
  // ==========================================
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none' // 👈 مهم جداً: لا تخزّن sw.js في HTTP cache
      });

      console.log('[PWA] ✅ Service Worker مسجل:', registration.scope);

      // فحص التحديث فوراً
      registration.update().catch(() => {});

      // 2) اكتشاف تحديث
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateToast(newWorker);
          }
        });
      });

      // فحص التحديث كل 60 ثانية (لو الصفحة مفتوحة)
      setInterval(() => registration.update().catch(() => {}), 60 * 1000);

      // فحص التحديث عند رجوع المستخدم للصفحة
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => {});
        }
      });

    } catch (err) {
      console.error('[PWA] ❌ فشل التسجيل:', err);
    }
  });

  // ==========================================
  // 3) عند التحكم بعد التحديث — أعد التحميل مرة واحدة
  // ==========================================
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    // لو فيه drawer/modal مفتوح، متعملش reload فجائي
    const hasOpenUI = document.querySelector('.drawer.open, .modal-bd.open, .overlay.open');
    if (hasOpenUI) {
      if (window.__core?.toast) {
        window.__core.toast('تحديث جاهز. أغلق النوافذ ثم أعد التحميل.', 'info');
      }
      return;
    }
    window.location.reload();
  });

  // ==========================================
  // 4) إشعار التحديث
  // ==========================================
  function showUpdateToast(worker) {
    if (window.__core?.toast) {
      window.__core.toast('تحديث جديد متاح. جارٍ التطبيق...', 'info');
    }

    const bar = document.createElement('div');
    bar.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #1a1a1a;
      color: #fff;
      padding: 14px 20px;
      border-radius: 10px;
      border: 1px solid #333;
      box-shadow: 0 10px 30px rgba(0,0,0,.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: 'Cairo', Tahoma, sans-serif;
      font-size: 14px;
      font-weight: 600;
      max-width: 92vw;
    `;
    bar.innerHTML = `
      <span>🎉 تحديث جديد متاح</span>
      <button id="pwa-update-btn" style="
        background: #635bff;
        color: #fff;
        border: 0;
        padding: 8px 16px;
        border-radius: 8px;
        font-family: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      ">تحديث الآن</button>
      <button id="pwa-dismiss-btn" style="
        background: transparent;
        color: #a1a1aa;
        border: 0;
        padding: 4px;
        cursor: pointer;
        font-size: 18px;
      ">✕</button>
    `;
    document.body.appendChild(bar);

    document.getElementById('pwa-update-btn').addEventListener('click', () => {
      worker.postMessage('SKIP_WAITING');
      bar.remove();
    });

    document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
      bar.remove();
    });
  }

  // ==========================================
  // 5) إشعار "قابل للتثبيت"
  // ==========================================
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    setTimeout(() => {
      showInstallBanner();
    }, 5000);
  });

  function showInstallBanner() {
    if (!deferredPrompt || sessionStorage.getItem('pwa-install-dismissed')) return;

    const banner = document.createElement('div');
    banner.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      right: 20px;
      max-width: 420px;
      margin: auto;
      background: linear-gradient(135deg, #1a1a1a 0%, #222 100%);
      border: 1px solid #333;
      border-radius: 14px;
      padding: 16px 18px;
      box-shadow: 0 10px 30px rgba(0,0,0,.5);
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: 'Cairo', Tahoma, sans-serif;
      color: #fff;
      animation: slideUp .3s ease;
    `;
    banner.innerHTML = `
      <div style="font-size: 28px;">📱</div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 700; font-size: 14px; margin-bottom: 2px;">ثبّت التطبيق</div>
        <div style="font-size: 12px; color: #a1a1aa;">استخدم النظام كتطبيق على جهازك</div>
      </div>
      <button id="pwa-install-btn" style="
        background: #635bff;
        color: #fff;
        border: 0;
        padding: 8px 16px;
        border-radius: 8px;
        font-family: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
      ">تثبيت</button>
      <button id="pwa-close-install" style="
        background: transparent;
        color: #71717a;
        border: 0;
        padding: 4px;
        cursor: pointer;
        font-size: 18px;
      ">✕</button>
    `;
    document.body.appendChild(banner);

    const style = document.createElement('style');
    style.textContent = `@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`;
    document.head.appendChild(style);

    document.getElementById('pwa-install-btn').addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[PWA] نتيجة التثبيت:', outcome);
      deferredPrompt = null;
      banner.remove();
    });

    document.getElementById('pwa-close-install').addEventListener('click', () => {
      sessionStorage.setItem('pwa-install-dismissed', '1');
      banner.remove();
    });
  }

  // ==========================================
  // 6) مراقبة حالة الاتصال
  // ==========================================
  window.addEventListener('offline', () => {
    if (window.__core?.toast) {
      window.__core.toast('انقطع الاتصال بالإنترنت', 'error');
    }
  });
  window.addEventListener('online', () => {
    if (window.__core?.toast) {
      window.__core.toast('عاد الاتصال بالإنترنت', 'success');
    }
  });

  console.log('[PWA] ✅ جاهز');
})();
