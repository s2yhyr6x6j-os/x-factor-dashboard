import { clearedCookie } from '../lib/auth.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  res.setHeader('Set-Cookie', clearedCookie());
  return res.status(200).json({ ok: true });
}
