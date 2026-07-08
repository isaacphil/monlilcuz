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

const OFFLINE_HTML = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>A letter for you</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:#faf9f5; color:#4a463d; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    padding:24px; }
  .card { max-width:480px; text-align:center; }
  .mark { font-size:44px; margin-bottom:20px; }
  .lead { font-size:17px; font-weight:600; line-height:1.55; margin-bottom:14px; color:#4a463d; }
  p { font-size:15px; line-height:1.6; color:#7a756a; }
  @media (prefers-color-scheme: dark) {
    body { background:#16150f; color:#e9e5d8; }
    p { color:#a49d8c; }
  }
</style>
<div class="card">
  <div class="mark">🔥</div>
  <p class="lead">This letter contained a deeply personal sharing and a rare window of raw honesty. Because real vulnerability belongs strictly to the moment, the letter has now been burned.</p>
  <p>If you missed the window, it is what it is. Thanks for checking in anyway.</p>
</div>`;
