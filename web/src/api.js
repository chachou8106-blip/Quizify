const TOKEN_KEY = 'qzf-token';

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t) { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); }

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `Erreur ${res.status}`);
    err.status = res.status;
    err.code = data?.error;
    err.data = data;          // charge utile complete (ex. suggestion d'orthographe)
    throw err;
  }
  return data;
}

export function wsUrl(pin, params) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const q = new URLSearchParams(params).toString();
  return `${proto}://${location.host}/api/rooms/${pin}/ws?${q}`;
}

// Gumroad checkout links — replace with your own Gumroad account links.
export const GUMROAD_LINKS = {
  premium: 'https://gumroad.com/l/quizzalo-premium',
  event: 'https://gumroad.com/l/quizzalo-event',
};
