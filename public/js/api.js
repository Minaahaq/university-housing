'use strict';

const CACHE_DURATION = 60 * 1000; // دقيقة واحدة
const cache = new Map();

async function request(method, url, body = null, token = null) {
  // 1. لو الطلب GET، نشوف الكاش
  if (method === 'GET') {
    const cached = cache.get(url);
    if (cached && (Date.now() - cached.time < CACHE_DURATION)) {
      console.log('⚡ من الكاش:', url);
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

  if (res.status === 401 && token) {
    const fresh = await window.fbClient.getIdToken(true);
    if (fresh && fresh !== token) {
      return request(method, url, body, fresh);
    }
  }

  // 2. لو GET ونجح، خزنه
  if (method === 'GET' && res.ok) {
    const clonedRes = res.clone();
    const data = await clonedRes.json();
    cache.set(url, { data, time: Date.now() });
  }

  // 3. لو POST/PUT/DELETE، امسح الكاش
  if (method !== 'GET') {
    cache.clear();
    console.log('🗑️ تم مسح الكاش بعد عملية:', method);
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
