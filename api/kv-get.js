import { requireAuth, KEY_RE } from '../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).end();
  if (!requireAuth(req, res)) return;

  const { key } = req.query;
  if (!key) return res.status(400).json({ error: 'Missing key' });
  if (!KEY_RE.test(key)) return res.status(400).json({ error: 'Invalid key' });

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return res.status(500).json({ error: 'KV not configured' });

  try {
    const r = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-store'
      },
      cache: 'no-store'
    });
    const data = await r.json();
    let value = data.result;

    // Recover values saved by the old kv-set, which stored "value=<url-encoded JSON>" literally
    if (typeof value === 'string' && value.startsWith('value=')) {
      try { value = decodeURIComponent(value.slice(6)); } catch (e) {}
    }

    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch(e) {}
      if (typeof value === 'string') {
        try { value = JSON.parse(value); } catch(e) {}
      }
    }

    return res.status(200).json({ value });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
