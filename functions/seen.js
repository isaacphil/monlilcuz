// Cloudflare Pages Function — handles the read-receipt beacons at /seen.
//
// The letter page (index.html) pings this at two moments:
//   /seen?e=load    -> the page was opened (lock screen shown)
//   /seen?e=unlock  -> the correct code was entered and the letter opened
//
// This forwards a notification to your Discord (or Telegram). The webhook
// lives in an encrypted Pages *secret* named DISCORD_WEBHOOK, set in the
// Cloudflare dashboard — it never appears in this file, the site, or git.

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  // Notify in the background so the beacon returns immediately.
  context.waitUntil(notify(request, env, url));
  return new Response(null, { status: 204 });
}

async function notify(request, env, url) {
  const ev = url.searchParams.get("e") || "visit";
  const cf = request.cf || {};
  const ua = request.headers.get("user-agent") || "unknown";
  const where =
    [cf.city, cf.region, cf.country].filter(Boolean).join(", ") || "unknown";
  const when = new Date().toISOString();

  const label =
    ev === "unlock"
      ? "🔓 Letter UNLOCKED — they read it"
      : ev === "load"
      ? "👀 Letter opened (lock screen shown)"
      : "📩 " + ev;

  // --- Discord (default) ---
  if (env.DISCORD_WEBHOOK) {
    await fetch(env.DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: label,
            color: ev === "unlock" ? 0x39b37a : 0xc9a53f,
            fields: [
              { name: "When (UTC)", value: when, inline: false },
              { name: "Where", value: where, inline: true },
              { name: "Device", value: ua.slice(0, 300), inline: false },
            ],
          },
        ],
      }),
    });
    return;
  }

  // --- Telegram (alternative) ---
  // Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID instead of DISCORD_WEBHOOK.
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    const text = `${label}\nWhen (UTC): ${when}\nWhere: ${where}\nDevice: ${ua.slice(0, 300)}`;
    await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
      }
    );
  }
}
