export default async function handler(req, res) {
  // Allow CORS from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // Only allow GameChanger ICS URLs for security
  const decoded = decodeURIComponent(url);
  if (!decoded.includes('gc.com') && !decoded.includes('team-manager')) {
    return res.status(403).json({ error: 'Only GameChanger URLs allowed' });
  }

  try {
    const normalized = decoded.replace(/^webcal:\/\//i, 'https://');
    const response = await fetch(normalized, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SBA-Dashboard/1.0)',
        'Accept': 'text/calendar, */*'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `GameChanger returned ${response.status}` 
      });
    }

    const text = await response.text();
    res.setHeader('Content-Type', 'text/calendar');
    return res.status(200).send(text);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
