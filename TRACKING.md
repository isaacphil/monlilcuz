# Read-receipt tracking

Know when the receiver opens the letter — and when they actually unlock it.

## How it works

`index.html` fires a tiny beacon to `/__seen` at two moments:

- `e=load` — the page is opened (the lock screen appears)
- `e=unlock` — the correct code is entered and the letter opens

`worker.js` receives those beacons and posts a notification to your Discord
(or Telegram). The webhook URL is stored as a **Cloudflare secret**, so it
never appears in the public HTML or in git.

Link-preview bots (iMessage, WhatsApp, Discord unfurls) don't run JavaScript,
so they **won't** trigger a false "opened" — only a real browser does.

## Setup (one time, ~2 minutes)

1. **Create a Discord webhook**: Discord → your server → a channel →
   Edit Channel → Integrations → Webhooks → New Webhook → Copy Webhook URL.

2. **Wire the Worker into your `wrangler.jsonc`** so it runs alongside the
   static assets. It needs a `main` and an `ASSETS` binding:

   ```jsonc
   {
     "name": "monlilcuz",
     "compatibility_date": "2024-09-01",
     "main": "worker.js",
     "assets": {
       "directory": ".",
       "binding": "ASSETS"
     }
   }
   ```

   (Keep whatever other fields you already have — just add `main` and the
   `assets.binding`.)

3. **Store the webhook as a secret** (not in any file):

   ```bash
   npx wrangler secret put DISCORD_WEBHOOK
   # paste the webhook URL when prompted
   ```

4. **Deploy**:

   ```bash
   npx wrangler deploy
   ```

That's it. Open the site yourself to test — you should get a Discord ping.

## Notes

- **Silence your own visits**: in the browser console on the live site, run
  `localStorage.__muteSeen = '1'` and that device will stop sending beacons.
- **Prefer Telegram?** Skip the Discord secret and instead set
  `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` (both via `wrangler secret put`).
  `worker.js` already handles that path.
- Each notification includes the time (UTC), rough location (city/country from
  Cloudflare), and the device/browser user-agent.
