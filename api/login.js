import { authConfigured, checkPassword, makeToken, sessionCookie, sameOrigin, tooManyFails, recordFail, clearFails } from '../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Forbidden' });
  if (!authConfigured()) {
    return res.status(500).json({ error: 'Sign-in is not configured (set AUTH_SECRET and SITE_PASSWORD_HASH in Vercel).' });
  }
  if (await tooManyFails(req)) {
    return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  }
  const password = req.body && req.body.password;
  if (!checkPassword(password)) {
    await recordFail(req);
    return res.status(401).json({ error: 'Incorrect password' });
  }
  await clearFails(req);
  res.setHeader('Set-Cookie', sessionCookie(makeToken()));
  return res.status(200).json({ ok: true });
}
