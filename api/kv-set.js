import { requireAuth, sameOrigin, KEY_RE } from '../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Forbidden (request came from another site)' });
  if (!requireAuth(req, res)) return;

  const { key, value } = req.body || {};
  if (!key) return res.status(400).json({ error: 'Missing key' });
  if (!KEY_RE.test(key)) return res.status(400).json({ error: 'Invalid key' });

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return res.status(500).json({ error: 'KV not configured' });

  try {
    // Upstash REST: POST /set/<key> with the value as the raw request body.
    // This is the format that made cross-device sync work in May.
    const stored = typeof value === 'string' ? value : JSON.stringify(value);
    const r = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: stored
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.error) {
      return res.status(502).json({ error: 'Upstash: ' + (data.error || `HTTP ${r.status}`) });
    }
    return res.status(200).json({ ok: true, result: data.result, bytes: stored.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
