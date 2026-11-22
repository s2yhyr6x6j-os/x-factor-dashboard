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
    // Store as plain string — value is already JSON stringified by client
    const r = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'value=' + encodeURIComponent(typeof value === 'string' ? value : JSON.stringify(value))
    });
    const data = await r.json();
    return res.status(200).json({ ok: true, result: data.result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
