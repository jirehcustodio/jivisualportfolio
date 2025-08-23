Netlify backend options

- Use Netlify Functions for simple HTTP endpoints (short-lived). Example: `/api/hello`.
- Scheduled Functions (cron) for periodic tasks.
- Background Functions for up to 15 minutes of work.
- For long-lived services like WebSocket servers or MQTT subscribers, host separately (Render, Railway, Fly.io, or a tiny VPS) and call from the frontend or Netlify Functions.

Local testing

1) Install Netlify CLI (optional): `npm i -g netlify-cli`
2) From repo root: `netlify dev` (proxies functions to /.netlify/functions/* and serves `portfolio/`)
3) Visit http://localhost:8888/api/hello

Deploy

- Push to GitHub; connect the repo in app.netlify.com.
- Build settings: `Base directory` empty, `Publish directory` = `portfolio`, `Functions directory` = `netlify/functions` or let netlify.toml drive it.
