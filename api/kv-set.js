import { requireAuth, sameOrigin, KEY_RE } from '../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Forbidden' });
  if (!requireAuth(req, res)) return;

  const { key, value } = req.body || {};
  if (!key) return res.status(400).json({ error: 'Missing key' });
  if (!KEY_RE.test(key)) return res.status(400).json({ error: 'Invalid key' });

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return res.status(500).json({ error: 'KV not configured' });

  try {
    // Send the whole command as a JSON array so Upstash stores exactly this string.
    // (The old version posted "value=<url-encoded>" as the body, which Upstash
    // stores literally — so saved data could never be read back as JSON.)
    const stored = typeof value === 'string' ? value : JSON.stringify(value);
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SET', key, stored])
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.error || data.result !== 'OK') {
      return res.status(502).json({ error: data.error || `Upstash returned ${r.status}` });
    }
    return res.status(200).json({ ok: true, bytes: stored.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
