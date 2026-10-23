'use strict';

/**
 * غلاف بسيط لطلبات API مع إرسال Firebase ID Token.
 * + إضافة Cache لمدة دقيقتين لتقليل استهلاك Firebase.
 */

const CACHE_DURATION = 2 * 60 * 1000; // دقيقتين
const cache = new Map();

async function request(method, url, body = null, token = null) {
  // 1) لو الطلب GET، نشوف لو في نسخة مخزنة
  if (method === 'GET') {
    const cached = cache.get(url);
    if (cached && (Date.now() - cached.time < CACHE_DURATION)) {
      console.log('⚡ من الكاش:', url);
      // نرجع رد وهمي شبه الـ fetch عشان الكود التاني ميبوظش
      return {
        ok: true,
        status: 200,
        json: async () => cached.data,
      };
    }
  }

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);

  // معالجة 401: محاولة تجديد التوكن مرة واحدة
  if (res.status === 401 && token) {
    const fresh = await window.fbClient.getIdToken(true);
    if (fresh && fresh !== token) {
      return request(method, url, body, fresh);
    }
  }

  // 2) لو الطلب GET ونجح، نخزن الرد في الكاش
  if (method === 'GET' && res.ok) {
    const clonedRes = res.clone();
    const data = await clonedRes.json();
    cache.set(url, { data, time: Date.now() });
  }

  // 3) لو الطلب POST/PUT/DELETE، نمسح الكاش عشان البيانات تتحدث
  if (method !== 'GET') {
    const baseUrl = url.split('?')[0]; // نشيل أي query params
    for (const key of cache.keys()) {
      if (key.startsWith(baseUrl)) {
        cache.delete(key);
      }
    }
  }

  return res;
}

window.api = {
  get: (url, token) => request('GET', url, null, token),
  post: (url, body, token) => request('POST', url, body, token),
  put: (url, body, token) => request('PUT', url, body, token),
  patch: (url, body, token) => request('PATCH', url, body, token),
  del: (url, token) => request('DELETE', url, null, token),
};
