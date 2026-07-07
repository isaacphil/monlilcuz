// Cloudflare Worker for the letter site.
//
// Two jobs:
//   1. Serve the static site (index.html) via the ASSETS binding.
//   2. Answer the read-receipt beacons the page fires at /__seen and forward
//      a notification to your chat (Discord by default, Telegram optional).
//
// The webhook/token lives in a Worker *secret*, never in the published HTML or
// in git. Set it once with:
//   npx wrangler secret put DISCORD_WEBHOOK
// (or TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID for Telegram — see notify() below).

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/__seen") {
      // Do the notify work in the background so the beacon returns instantly.
      ctx.waitUntil(notify(request, env, url));
      return new Response(null, { status: 204 });
    }

    // Everything else: serve the static site.
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not found", { status: 404 });
  },
};

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
