export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  try {
    const normalized = decodeURIComponent(url).replace(/^webcal:\/\//i, 'https://');
    const response = await fetch(normalized, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/calendar, */*' }
    });
    if (!response.ok) return res.status(response.status).json({ error: 'Remote returned '+response.status });
    const text = await response.text();
    res.setHeader('Content-Type', 'text/calendar');
    return res.status(200).send(text);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
