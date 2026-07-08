# Read-receipt tracking + access log

Know when the letter is opened and unlocked — get a Discord ping in the moment,
**and** keep a permanent, browsable history.

## How it works

`index.html` fires a beacon to `/seen` at these moments:

- `e=load` — the page is **visited** (lock screen appears)
- `e=login` — the visitor **starts entering the passcode** (first keystroke;
  fires once per tab session). This is the "reached the login and is trying"
  signal — distinct from just landing (`load`) and from a successful open.
- `e=unlock` — the correct code is entered and the letter opens (**logged in**)
- `e=close` — the visitor leaves or closes the page (fires once, on the first
  `pagehide` / tab-hidden signal — reliable on desktop and mobile)

Together these form a funnel: **visited → entering code → unlocked → left.**

When the site is switched **off**, a visit to the burned page is logged and
pinged to Discord as `e=offline` (handled by `functions/_middleware.js`).

`functions/seen.js` (a Cloudflare Pages Function) then:

1. **Saves a record** to KV storage (binding `SEEN_LOG`) — permanent history.
2. **Sends a Discord notification** (secret `DISCORD_WEBHOOK`).

`functions/log.js` serves a private page at **`/log`** that lists every visit,
showing each one in **the visitor's local time** and **your local time**
side by side, plus where, IP, and device.

Link-preview bots don't run JavaScript, so they won't create false "opened"
events — only a real browser does.

## Setup (all in the Cloudflare dashboard — no terminal)

Everything is under **Workers & Pages → monlilcuz**.

1. **Discord webhook** (notifications) — *Settings → Variables and secrets →
   Add* → Type **Secret**, name `DISCORD_WEBHOOK`, value = your Discord webhook URL.

2. **KV storage** (permanent history):
   - Left sidebar → **Storage & Databases → KV → Create namespace** (name it
     anything, e.g. `monlilcuz_log`).
   - Back in **monlilcuz → Settings → Bindings** (a.k.a. *Functions → KV
     namespace bindings*) → **Add → KV namespace**:
     - Variable name: `SEEN_LOG`  ← must match exactly
     - Namespace: the one you just created

3. **Viewer password** — *Settings → Variables and secrets → Add* → name
   `LOG_KEY`, value = any password you choose. You'll visit
   `https://monlilcuz.pages.dev/log?key=YOURPASSWORD` to read the log.

4. *(Optional)* **Your timezone in Discord** — add a plain variable `OWNER_TZ`
   set to your IANA zone (e.g. `Asia/Kuala_Lumpur`, `Europe/London`,
   `America/New_York`). Discord pings will then also show *your* local time.
   (The `/log` page shows your local time automatically regardless.)

5. **Redeploy** so the new bindings/variables take effect — push any commit, or
   hit **Retry deployment** on the latest deployment in the dashboard.

> Bindings and variables only apply from the *next* deployment onward, so add
> them first, then redeploy.

## Notes

- History starts from when KV is connected — it can't recover past visits.
- The `/log` page is protected by `LOG_KEY` and marked noindex. It contains IPs
  and locations, so keep the password private.
- **Silence your own visits**: on the live site, open the browser console and
  run `localStorage.__muteSeen = '1'`.
- KV free tier is ample for a personal site (100k reads + 1k writes/day).
