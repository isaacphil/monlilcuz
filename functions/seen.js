// Cloudflare Pages Function — handles the read-receipt beacons at /seen.
// (Deployed with KV storage + /log viewer enabled.)
//
// The letter page (index.html) pings this at two moments:
//   /seen?e=load    -> the page was opened (lock screen shown)
//   /seen?e=unlock  -> the correct code was entered and the letter opened
//
// For each ping we do two things:
//   1. Store a durable record in KV (binding: SEEN_LOG) so there's a
//      permanent, browsable history — see /log.
//   2. Send a Discord notification (secret: DISCORD_WEBHOOK).
//
// Both are best-effort and run in the background so the beacon returns fast
// and a failure here never affects the letter.

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const ev = url.searchParams.get("e") || "visit";
  const cf = request.cf || {};

  const rec = {
    ev,
    ts: Date.now(),                                   // epoch ms (UTC)
    tz: cf.timezone || null,                          // visitor's IANA timezone, e.g. "Europe/London"
    ip: request.headers.get("CF-Connecting-IP") || null,
    city: cf.city || null,
    region: cf.region || null,
    country: cf.country || null,
    colo: cf.colo || null,
    ua: (request.headers.get("user-agent") || "").slice(0, 400) || null,
    ref: request.headers.get("referer") || null,
  };

  context.waitUntil(persist(env, rec));
  context.waitUntil(notify(env, rec));
  return new Response(null, { status: 204 });
}

// --- durable storage in KV -------------------------------------------------
async function persist(env, rec) {
  if (!env.SEEN_LOG) return; // storage not configured yet — Discord still works
  // Fixed-width epoch prefix => keys list in chronological order.
  const key = `evt:${String(rec.ts).padStart(15, "0")}:${crypto.randomUUID().slice(0, 8)}`;
  // Store a compact copy in metadata so the viewer can list without N reads.
  const meta = {
    ev: rec.ev, ts: rec.ts, tz: rec.tz, ip: rec.ip,
    city: rec.city, region: rec.region, country: rec.country,
    ua: (rec.ua || "").slice(0, 220),
  };
  await env.SEEN_LOG.put(key, JSON.stringify(rec), { metadata: meta });
}

// --- Discord notification --------------------------------------------------
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

  const title =
    rec.ev === "unlock" ? "🔓 Letter UNLOCKED — they read it"
    : rec.ev === "load" ? "👀 Letter opened (lock screen shown)"
    : rec.ev === "close" ? "🚪 They closed / left the letter"
    : "📩 " + rec.ev;

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
      embeds: [{
        title,
        color: rec.ev === "unlock" ? 0x39b37a : rec.ev === "close" ? 0x7a8290 : 0xc9a53f,
        fields,
      }],
    }),
  });
}
