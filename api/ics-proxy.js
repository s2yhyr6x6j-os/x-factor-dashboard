import { requireAuth } from '../lib/auth.js';

// Only GameChanger calendar hosts (gc.com and its subdomains, e.g. api.team-manager.gc.com)
function allowedUrl(raw) {
  let u;
  try {
    u = new URL(String(raw).trim().replace(/^webcal:\/\//i, 'https://'));
  } catch (e) {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== 'https:') return null;
  if (host !== 'gc.com' && !host.endsWith('.gc.com')) return null;
  if (u.username || u.password || (u.port && u.port !== '443')) return null;
  return u;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).end();
  if (!requireAuth(req, res)) return;

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  let target = allowedUrl(url);
  if (!target) {
    return res.status(403).json({ error: 'Only GameChanger URLs allowed' });
  }

  try {
    // Follow redirects ourselves (max 3) so a redirect can't lead off GameChanger
    let response;
    for (let hop = 0; ; hop++) {
      response = await fetch(target.toString(), {
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SBA-Dashboard/1.0)',
          'Accept': 'text/calendar, */*'
        }
      });
      if (response.status < 300 || response.status >= 400) break;
      const next = allowedUrl(new URL(response.headers.get('location') || '', target).toString());
      if (!next || hop >= 3) return res.status(502).json({ error: 'GameChanger redirected somewhere unexpected' });
      target = next;
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: `GameChanger returned ${response.status}`
      });
    }

    const text = await response.text();
    if (text.length > 5 * 1024 * 1024) return res.status(502).json({ error: 'Calendar too large' });
    res.setHeader('Content-Type', 'text/calendar');
    return res.status(200).send(text);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
