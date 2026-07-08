// Cloudflare Pages middleware — the site's master on/off switch.
//
// Runs before every request. It reads admin/site-status.md (a normal file in
// the repo, served as a static asset) and, if the last line says
// "Status: off", shows a gentle "resting" page to visitors instead of the
// letter. Flip the switch by editing that one word on GitHub and committing —
// Cloudflare redeploys automatically (~1 min).
//
// Fail-open by design: if the status file can't be read for any reason, the
// site stays ON. The owner's /log viewer is always reachable, even when paused.
//
// When paused, a visit to the burned page is still logged to KV and sent to
// Discord (event "offline") — so you're notified even though the letter's own
// beacons never run.

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);

  // Never block the owner's tools.
  if (url.pathname === "/log" || url.pathname.startsWith("/log/")) {
    return next();
  }

  let paused = false;
  try {
    const res = await env.ASSETS.fetch(
      new URL("/admin/site-status.md", url).toString()
    );
    if (res.ok) {
      const txt = await res.text();
      paused = /status:\s*off/i.test(txt);
    }
  } catch (_) {
    paused = false; // fail open — keep the site up
  }

  if (paused) {
    // Still notify + log when someone lands on the burned page. Only count real
    // page views (HTML navigations), not favicons or other sub-resources.
    const accept = request.headers.get("accept") || "";
    if (request.method === "GET" && accept.includes("text/html")) {
      context.waitUntil(recordOffline(request, env));
    }
    return new Response(OFFLINE_HTML, {
      status: 503,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "retry-after": "3600",
      },
    });
  }

  return next();
}

// --- offline-visit tracking (self-contained; mirrors functions/seen.js) -----
async function recordOffline(request, env) {
  const cf = request.cf || {};
  const rec = {
    ev: "offline",
    ts: Date.now(),
    tz: cf.timezone || null,
    ip: request.headers.get("CF-Connecting-IP") || null,
    city: cf.city || null,
    region: cf.region || null,
    country: cf.country || null,
    colo: cf.colo || null,
    ua: (request.headers.get("user-agent") || "").slice(0, 400) || null,
    ref: request.headers.get("referer") || null,
  };
  await Promise.allSettled([persist(env, rec), notify(env, rec)]);
}

async function persist(env, rec) {
  if (!env.SEEN_LOG) return;
  const key = `evt:${String(rec.ts).padStart(15, "0")}:${crypto.randomUUID().slice(0, 8)}`;
  const meta = {
    ev: rec.ev, ts: rec.ts, tz: rec.tz, ip: rec.ip,
    city: rec.city, region: rec.region, country: rec.country,
    ua: (rec.ua || "").slice(0, 220),
  };
  await env.SEEN_LOG.put(key, JSON.stringify(rec), { metadata: meta });
}

function fmt(ts, tz) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium", timeStyle: "medium", timeZone: tz || "UTC",
    }).format(new Date(ts));
  } catch (_) {
    return new Date(ts).toISOString();
  }
}

async function notify(env, rec) {
  const hook = env.DISCORD_WEBHOOK;
  if (!hook) return;
  const where = [rec.city, rec.region, rec.country].filter(Boolean).join(", ") || "unknown";
  const theirWhen = fmt(rec.ts, rec.tz) + (rec.tz ? ` (${rec.tz})` : " (UTC*)");
  const utcWhen = new Date(rec.ts).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const yourWhen = env.OWNER_TZ ? `${fmt(rec.ts, env.OWNER_TZ)} (${env.OWNER_TZ})` : null;

  const fields = [
    { name: "🕒 Their local time", value: theirWhen, inline: false },
    ...(yourWhen ? [{ name: "🏠 Your local time", value: yourWhen, inline: false }] : []),
    { name: "UTC", value: utcWhen, inline: true },
    { name: "📍 Where", value: where, inline: true },
    { name: "🌐 IP", value: rec.ip || "unknown", inline: true },
    { name: "💻 Device", value: (rec.ua || "unknown").slice(0, 300), inline: false },
  ];

  await fetch(hook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      embeds: [{ title: "🔥 Someone hit the burned page (site is off)", color: 0xd9534f, fields }],
    }),
  });
}

const OFFLINE_HTML = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>A letter for you</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center;
    background:#faf9f5; color:#3a372f; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    padding:48px 24px 72px; }
  .card { max-width:540px; text-align:center; }
  .mark { font-size:48px; margin-bottom:24px; }
  .lead { font-size:18px; font-weight:600; line-height:1.62; margin-bottom:16px; color:#33302a; }
  .card p { font-size:16px; line-height:1.65; color:#6f6a5e; }
  .sig { margin-top:22px; font-size:16px; font-style:italic; color:#4a463d; }
  footer { position:fixed; bottom:0; left:0; right:0; text-align:center; padding:14px 12px;
    font-size:11px; font-weight:500; letter-spacing:1.4px; text-transform:uppercase; color:#b3ab98; }
  @media (prefers-color-scheme: dark) {
    body { background:#16150f; color:#e9e5d8; }
    .lead { color:#efeadd; }
    .card p { color:#a49d8c; }
    .sig { color:#d8d2c2; }
    footer { color:#6a6350; }
  }
</style>
<div class="card">
  <div class="mark">\u{1F525}</div>
  <p class="lead">This letter contained a deeply personal sharing and a rare window of raw honesty meant only for my closest cousin. Because real vulnerability belongs strictly to the moment, the letter has now been burned.</p>
  <p>If you missed the window, it is what it is. Thanks for checking in anyway.</p>
  <p class="sig">~ Zac</p>
</div>
<footer>\u00A9 2026 \u00B7 Website by Isaac Philip</footer>`;
