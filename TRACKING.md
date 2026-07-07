# Read-receipt tracking

Know when the receiver opens the letter — and when they actually unlock it.

## How it works

`index.html` fires a tiny beacon to `/seen` at two moments:

- `e=load` — the page is opened (the lock screen appears)
- `e=unlock` — the correct code is entered and the letter opens

`functions/seen.js` is a Cloudflare **Pages Function** that receives those
beacons and posts a notification to your Discord (or Telegram). The webhook URL
is stored as an encrypted Pages **secret**, so it never appears in the public
HTML or in git.

Link-preview bots (iMessage, WhatsApp, Discord unfurls) don't run JavaScript,
so they **won't** trigger a false "opened" — only a real browser does.

## Turning it on (all in the Cloudflare dashboard — no terminal)

The site (`monlilcuz.pages.dev`) auto-deploys from the GitHub repo, so the code
ships as soon as this branch is merged into `main`. Two steps:

1. **Add the webhook secret** — Cloudflare dashboard → Workers & Pages →
   **monlilcuz** → **Settings** → **Variables and secrets** → **Add**:
   - Type: **Secret** (encrypted)
   - Name: `DISCORD_WEBHOOK`
   - Value: your Discord webhook URL
   - Save it for the **Production** environment.

2. **Publish** — merge this branch into `main`. Cloudflare rebuilds
   automatically and the tracking (plus the secret) goes live.

   > Secrets only take effect on the *next* deploy, so add the secret first,
   > then merge (or hit **Retry deployment** if you merged first).

## Notes

- **Silence your own visits**: on the live site, open the browser console and
  run `localStorage.__muteSeen = '1'` — that device stops sending beacons.
- **Prefer Telegram?** Skip the Discord secret and instead add
  `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` secrets. `functions/seen.js`
  already handles that path.
- Each notification includes the time (UTC), rough location (city/country from
  Cloudflare), and the device/browser.
