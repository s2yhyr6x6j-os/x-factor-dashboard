// Shared sign-in helpers for the /api routes.
//
// Required Vercel environment variables:
//   SITE_PASSWORD_HASH  SHA-256 hex of the site password (lowercase)
//   AUTH_SECRET         long random string used to sign session cookies
//   KV_REST_API_URL / KV_REST_API_TOKEN  (already set for Upstash)
//
// Changing SITE_PASSWORD_HASH or AUTH_SECRET signs everyone out.
import crypto from 'crypto';

const COOKIE = 'xf_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const MAX_FAILS = 10;              // failed logins allowed per IP...
const FAIL_WINDOW = 15 * 60;       // ...per 15 minutes

// Only these KV keys can be read or written from the browser:
// sba_* data keys and the team list, optionally prefixed with a team id.
export const KEY_RE = /^(t:[a-z0-9-]{1,64}:)?(sba_[a-z0-9_]{1,40}|xf_teams_v1)$/;

function signingKey() {
  const s = process.env.AUTH_SECRET;
  const h = process.env.SITE_PASSWORD_HASH;
  if (!s || s.length < 32 || !h) return null;
  return s + '|' + h.trim().toLowerCase(); // a new password ends existing sessions
}

export function authConfigured() {
  return !!signingKey();
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function checkPassword(password) {
  const want = (process.env.SITE_PASSWORD_HASH || '').trim().toLowerCase();
  if (!want || typeof password !== 'string' || !password) return false;
  const got = crypto.createHash('sha256').update(password, 'utf8').digest('hex');
  return safeEqual(got, want);
}

export function makeToken() {
  const key = signingKey();
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ v: 1, iat: now, exp: now + MAX_AGE })).toString('base64url');
  const sig = crypto.createHmac('sha256', key).update(payload).digest('base64url');
  return payload + '.' + sig;
}

export function verifyToken(token) {
  const key = signingKey();
  if (!key || typeof token !== 'string') return false;
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const want = crypto.createHmac('sha256', key).update(payload).digest('base64url');
  if (!safeEqual(sig, want)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.v === 1 && data.exp > Math.floor(Date.now() / 1000);
  } catch (e) {
    return false;
  }
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export function sessionCookie(token) {
  return `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Strict`;
}
export function clearedCookie() {
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export function isSignedIn(req) {
  return verifyToken(readCookie(req, COOKIE));
}

// Use at the top of any /api route:  if (!requireAuth(req, res)) return;
export function requireAuth(req, res) {
  if (!authConfigured()) {
    res.status(500).json({ error: 'Sign-in is not configured (set AUTH_SECRET and SITE_PASSWORD_HASH in Vercel).' });
    return false;
  }
  if (isSignedIn(req)) return true;
  res.status(401).json({ error: 'Not signed in' });
  return false;
}

// Reject POSTs sent from another website's page
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // same-origin GETs and some browsers omit it; the SameSite cookie still applies
  try {
    return new URL(origin).host === req.headers['x-forwarded-host'] || new URL(origin).host === req.headers.host;
  } catch (e) {
    return false;
  }
}

// ── Failed-login limit (stored in Upstash, not reachable from the browser) ──
function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (req.headers['x-real-ip'] || (fwd ? String(fwd).split(',')[0] : '') || 'unknown').trim();
}
function failKey(req) {
  return 'auth_fail:' + crypto.createHash('sha256').update(clientIp(req)).digest('hex').slice(0, 32);
}
async function upstash(cmd) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const r = await fetch(`${url}/${cmd}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    const d = await r.json();
    return d.result;
  } catch (e) {
    return null;
  }
}
export async function tooManyFails(req) {
  const n = parseInt(await upstash(`get/${failKey(req)}`), 10) || 0;
  return n >= MAX_FAILS;
}
export async function recordFail(req) {
  const key = failKey(req);
  const n = await upstash(`incr/${key}`);
  if (n === 1) await upstash(`expire/${key}/${FAIL_WINDOW}`);
}
export async function clearFails(req) {
  await upstash(`del/${failKey(req)}`);
}
