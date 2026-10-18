'use strict';

/**
 * غلاف بسيط لطلبات API مع إرسال Firebase ID Token.
 */
async function request(method, url, body = null, token = null) {
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

  return res;
}

window.api = {
  get: (url, token) => request('GET', url, null, token),
  post: (url, body, token) => request('POST', url, body, token),
  put: (url, body, token) => request('PUT', url, body, token),
  patch: (url, body, token) => request('PATCH', url, body, token),
  del: (url, token) => request('DELETE', url, null, token),
};
