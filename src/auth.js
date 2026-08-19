// Auth utilities: PBKDF2 password hashing + HS256 JWT — WebCrypto only, no deps.

const enc = new TextEncoder();

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

export function randomHex(bytes = 16) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password, saltHex) {
  const salt = Uint8Array.from(saltHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256
  );
  return b64url(bits);
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signJWT(payload, secret, expiresInSec = 60 * 60 * 24 * 30) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSec };
  const p1 = b64url(enc.encode(JSON.stringify(header)));
  const p2 = b64url(enc.encode(JSON.stringify(body)));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${p1}.${p2}`));
  return `${p1}.${p2}.${b64url(sig)}`;
}

export async function verifyJWT(token, secret) {
  try {
    const [p1, p2, p3] = token.split('.');
    if (!p1 || !p2 || !p3) return null;
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify('HMAC', key, b64urlDecode(p3), enc.encode(`${p1}.${p2}`));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p2)));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// Hono middleware: attaches c.get('user') = {id, email, name} or 401s.
// `getSecret` is an async (c) => string resolver.
export function requireAuth(getSecret) {
  return async (c, next) => {
    const h = c.req.header('Authorization') || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    const payload = token ? await verifyJWT(token, await getSecret(c)) : null;
    if (!payload) return c.json({ error: 'Non connecté' }, 401);
    c.set('user', payload);
    await next();
  };
}
