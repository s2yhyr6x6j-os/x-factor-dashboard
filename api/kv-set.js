export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'Missing key' });

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return res.status(500).json({ error: 'KV not configured' });

  try {
    // Upstash REST API: POST /set/key with value as raw body
    const val = typeof value === 'string' ? value : JSON.stringify(value);
    const r = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(val)
    });
    const data = await r.json();
    return res.status(200).json({ ok: true, result: data.result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
