export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { key } = req.query;
  if (!key) return res.status(400).json({ error: 'Missing key' });

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return res.status(500).json({ error: 'KV not configured' });

  try {
    const r = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await r.json();
    // Upstash returns { result: value } — value may be a JSON string
    let value = data.result;
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch(e) {}
    }
    return res.status(200).json({ value });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
