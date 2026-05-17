# SBA Red 12U Dashboard

A coaching dashboard for SBA Red 12U baseball.

## Structure

```
/public/index.html   — the dashboard
/api/ics-proxy.js    — serverless proxy for GameChanger calendar sync
/vercel.json         — Vercel routing config
```

## Deploy

1. Push this repo to GitHub
2. Import into Vercel (vercel.com/new)
3. Deploy — no build step needed

## Environment Variables

None required. The Anthropic API key is entered by the user in the dashboard UI and stored in their browser's localStorage.
