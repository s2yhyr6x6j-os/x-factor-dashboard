import { authConfigured, isSignedIn } from '../lib/auth.js';

// Tells the page whether this browser is signed in.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!authConfigured()) return res.status(500).json({ signedIn: false, error: 'Sign-in is not configured (set AUTH_SECRET and SITE_PASSWORD_HASH in Vercel).' });
  return res.status(200).json({ signedIn: isSignedIn(req) });
}
