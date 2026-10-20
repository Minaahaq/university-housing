/* ==========================================
   PWA Registration & Update Manager — v3
   ========================================== */

(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) {
    console.log('[PWA] Service Worker غير مدعوم');
    return;
  }

  // ==========================================
  // 0) متغيرات عامة
  // ==========================================
  let currentRegistration = null;
  let updateBarShown = false; // 👈 عشان نمنع تكرار الشريط
  let deferredPrompt = null;
  let refreshing = false;
  let pendingReload = false;  // 👈 لو الـ UI مفتوح وما قدرناش نعمل reload

  // ==========================================
  // 1) تسجيل Service Worker
  // ==========================================
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none' // 👈 مهم جداً
      });

      currentRegistration = registration;
      console.log('[PWA] ✅ Service Worker مسجل:', registration.scope);

      // فحص التحديث فوراً
      safeUpdate(registration);

      // اكتشاف تحديث عبر updatefound
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateToast(registration);
          }
        });
      });

      // fallback: راقب الـ waiting مباشرةً (لو updatefound فشل)
      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdateToast(registration);
      }

      // فحص التحديث كل 60 ثانية
      setInterval(() => safeUpdate(registration), 60 * 1000);

      // فحص التحديث عند رجوع المستخدم للصفحة
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          safeUpdate(registration);
          maybeReloadPending();
        }
      });

      // فحص التحديث عند عودة الإنترنت
      window.addEventListener('online', () => safeUpdate(registration));

    } catch (err) {
      console.error('[PWA] ❌ فشل التسجيل:', err);
    }
  });

  // helper: فحص تحديث بأمان
  function safeUpdate(registration) {
    if (!registration) return;
    registration.update().catch(() => {});
  }

  // ==========================================
  // 2) عند التحكم بعد التحديث
  // ==========================================
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;

    const hasOpenUI = document.querySelector(
      '.drawer.open, .drawer[aria-hidden="false"], .modal-bd.open, .overlay.open, .overlay[style*="display: block"]'
    );

    if (hasOpenUI) {
      // خزّن إننا محتاجين reload، وننفذه لما الـ UI يتقفل
      pendingReload = true;
      if (window.__core?.toast) {
        window.__core.toast('تحديث جاهز. أغلق النوافذ ثم أعد التحميل.', 'info');
      }
      return;
    }

    window.location.reload();
  });

  // retry الـ reload لما الـ UI يتقفل
  function maybeReloadPending() {
    if (!pendingReload) return;
    const hasOpenUI = document.querySelector(
      '.drawer.open, .drawer[aria-hidden="false"], .modal-bd.open, .overlay.open'
    );
    if (!hasOpenUI) {
      window.location.reload();
    }
  }

  // راقب إغلاق أي drawer/modal
  document.addEventListener('click', (e) => {
    // بعد أي click، افحص لو الـ UI اتقفل
    setTimeout(maybeReloadPending, 300);
  }, true);

  // ==========================================
  // 3) إشعار التحديث
  // ==========================================
  function showUpdateToast(registration) {
    if (updateBarShown) return;
    updateBarShown = true;

    if (window.__core?.toast) {
      window.__core.toast('تحديث جديد متاح', 'info');
    }

    const bar = document.createElement('div');
    bar.id = 'pwa-update-bar';
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
      animation: pwaSlideUp .3s ease;
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

    // style animation
    if (!document.getElementById('pwa-styles')) {
      const style = document.createElement('style');
      style.id = 'pwa-styles';
      style.textContent = `@keyframes pwaSlideUp { from { transform: translateX(-50%) translateY(100%); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }`;
      document.head.appendChild(style);
    }

    // زر التحديث
    document.getElementById('pwa-update-btn').addEventListener('click', () => {
      // 👈 الأهم: ابعت للـ waiting worker مش installing
      const waiting = registration.waiting;
      if (waiting) {
        waiting.postMessage('SKIP_WAITING');
      } else if (registration.active) {
        registration.active.postMessage('SKIP_WAITING');
      }
      bar.remove();
      updateBarShown = false;
    });

    // زر الإغلاق
    document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
      bar.remove();
      updateBarShown = false;
    });
  }

  // ==========================================
  // 4) إشعار "قابل للتثبيت"
  // ==========================================
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    setTimeout(() => showInstallBanner(), 5000);
  });

  function showInstallBanner() {
    if (!deferredPrompt || sessionStorage.getItem('pwa-install-dismissed')) return;
    if (document.getElementById('pwa-install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
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
      animation: pwaSlideUp .3s ease;
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
  // 5) مراقبة حالة الاتصال
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

  // ==========================================
  // 6) API يدوي للتحديث (اختياري للاستخدام من console)
  // ==========================================
  window.__pwa = {
    checkForUpdate() {
      if (currentRegistration) {
        currentRegistration.update().catch(() => {});
        console.log('[PWA] فحص التحديث يدوياً...');
      }
    },
    async clearCaches() {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      console.log('[PWA] تم مسح كل الكاش. أعد تحميل الصفحة.');
    },
    async unregister() {
      if (currentRegistration) {
        await currentRegistration.unregister();
        console.log('[PWA] تم إلغاء التسجيل. أعد تحميل الصفحة.');
      }
    }
  };

  console.log('[PWA] ✅ جاهز');
})();
