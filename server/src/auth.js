import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const LINK_MINUTES = 15;
const SESSION_DAYS = 30;
export const COOKIE = 'tm_session';

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

export function normaliseEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254 ? e : null;
}

/** Creates a one-time sign-in link. Only a hash of the token is stored. */
export function createLoginLink(db, email, baseUrl, now) {
  const token = randomBytes(32).toString('base64url');
  db.saveToken(sha256(token), email, now + LINK_MINUTES * 60_000);
  return `${baseUrl}/auth/verify?token=${encodeURIComponent(token)}`;
}

export function verifyLoginToken(db, token, now) {
  if (!token || typeof token !== 'string') return null;
  return db.consumeToken(sha256(token), now);
}

/** A signed session value: user id and expiry, with an HMAC so it cannot be forged. */
export function makeSession(userId, secret, now) {
  const body = `${userId}.${now + SESSION_DAYS * 86_400_000}`;
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function readSession(value, secret, now) {
  if (!value) return null;
  const parts = String(value).split('.');
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts;
  const expect = createHmac('sha256', secret).update(`${id}.${exp}`).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(exp) < now) return null;
  return Number(id);
}

export function sessionCookie(value, secure) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86_400}${secure ? '; Secure' : ''}`;
}

export function clearCookie(secure) {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}

export function cookieValue(header, name = COOKIE) {
  for (const part of String(header || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}
