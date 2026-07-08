// Cloudflare Pages Function — private access-log viewer at /log
//
// Protected by a secret: set env var LOG_KEY to any password you choose, then
// visit /log?key=YOURPASSWORD . A cookie keeps you signed in afterward.
//
// Reads the records written by functions/seen.js from KV (binding: SEEN_LOG)
// and renders a table. Times are formatted in the browser so it can show BOTH
// the visitor's local time (from their timezone) AND your local time (from the
// browser you're viewing on) with no configuration.

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!env.LOG_KEY) {
    return html(503, page(`<div class="empty">The viewer isn't enabled yet.<br>
      Add an environment variable named <code>LOG_KEY</code> (a password of your
      choice) to this Pages project, then reload.</div>`));
  }

  const provided = url.searchParams.get("key") || cookie(request, "logkey");
  if (provided !== env.LOG_KEY) {
    return html(401, loginPage(), { "cache-control": "no-store" });
  }

  // Gather records from KV via list() metadata (no per-key reads needed).
  const items = [];
  if (env.SEEN_LOG) {
    let cursor;
    do {
      const res = await env.SEEN_LOG.list({ prefix: "evt:", limit: 1000, cursor });
      for (const k of res.keys) if (k.metadata) items.push(k.metadata);
      cursor = res.list_complete ? null : res.cursor;
    } while (cursor);
  }
  items.sort((a, b) => b.ts - a.ts); // newest first

  const headers = {
    "cache-control": "no-store",
    "x-robots-tag": "noindex",
    // Remember the key so plain refreshes work; scoped to /log only.
    "set-cookie": `logkey=${encodeURIComponent(provided)}; Path=/log; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`,
  };
  return html(200, viewer(items, !env.SEEN_LOG), headers);
}

// ---- helpers --------------------------------------------------------------
function html(status, body, extra) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...(extra || {}) },
  });
}

function cookie(request, name) {
  const raw = request.headers.get("cookie") || "";
  const m = raw.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

function page(inner) {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Access log</title>${STYLE}<div class="wrap">${inner}</div>`;
}

function loginPage() {
  return page(`<h1>🔒 Access log</h1>
    <form class="login" method="GET" action="/log">
      <p>Enter the viewer password.</p>
      <input type="password" name="key" placeholder="password" autofocus>
      <button type="submit">View log</button>
    </form>`);
}

function viewer(items, noStorage) {
  const banner = noStorage
    ? `<div class="warn">Storage isn't connected yet — no history is being saved.
       Add a KV namespace bound as <code>SEEN_LOG</code> to this project.</div>`
    : "";
  // Embed data safely: JSON with < escaped so it can't break out of the script.
  const json = JSON.stringify(items).replace(/</g, "\\u003c");
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Access log</title>${STYLE}
<div class="wrap">
  <h1>📖 Access log</h1>
  ${banner}
  <div class="meta" id="summary"></div>
  <div class="scroll"><table id="tbl">
    <thead><tr>
      <th>Event</th><th>Their local time</th><th>Your local time</th>
      <th>Where</th><th>IP</th><th>Device</th>
    </tr></thead><tbody></tbody>
  </table></div>
  <p class="foot">Times convert automatically. “Your local time” uses this device’s timezone
  (<span id="ytz"></span>).</p>
</div>
<script>
const DATA = ${json};
const yourTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
document.getElementById('ytz').textContent = yourTz;

function fmt(ts, tz){
  try { return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short',timeZone:tz}).format(new Date(ts)); }
  catch(e){ return new Date(ts).toLocaleString(); }
}
function shortUA(ua){
  if(!ua) return 'unknown';
  const os = /iPhone|iPad/.test(ua)?'iOS':/Android/.test(ua)?'Android':/Mac OS X/.test(ua)?'Mac':/Windows/.test(ua)?'Windows':/Linux/.test(ua)?'Linux':'';
  const br = /Edg\\//.test(ua)?'Edge':/Chrome\\//.test(ua)?'Chrome':/Firefox\\//.test(ua)?'Firefox':/Safari\\//.test(ua)?'Safari':'';
  return [os,br].filter(Boolean).join(' · ') || 'other';
}
function td(text, title){ const c=document.createElement('td'); c.textContent=text; if(title) c.title=title; return c; }

const tb = document.querySelector('#tbl tbody');
let opens=0, unlocks=0;
for(const r of DATA){
  if(r.ev==='unlock') unlocks++; else if(r.ev==='load') opens++;
  const tr=document.createElement('tr');
  tr.className = r.ev==='unlock' ? 'unlock' : '';
  const label = r.ev==='unlock' ? '🔓 Unlocked' : r.ev==='load' ? '👀 Opened' : r.ev==='close' ? '🚪 Left / closed' : r.ev==='offline' ? '🔥 Hit burned page' : ('📩 '+r.ev);
  tr.appendChild(td(label));
  tr.appendChild(td(fmt(r.ts, r.tz) + (r.tz?'':' (UTC?)'), r.tz||'timezone unknown'));
  tr.appendChild(td(fmt(r.ts, yourTz)));
  const where=[r.city,r.region,r.country].filter(Boolean).join(', ')||'unknown';
  tr.appendChild(td(where, r.tz||''));
  tr.appendChild(td(r.ip||'unknown'));
  tr.appendChild(td(shortUA(r.ua), r.ua||''));
  tb.appendChild(tr);
}
document.getElementById('summary').textContent =
  DATA.length + ' events · ' + opens + ' opens · ' + unlocks + ' unlocks' +
  (DATA.length ? ' · latest ' + fmt(DATA[0].ts, yourTz) : '');
if(!DATA.length){
  const tr=document.createElement('tr');
  const c=document.createElement('td'); c.colSpan=6; c.className='empty'; c.textContent='No visits recorded yet.';
  tr.appendChild(c); tb.appendChild(tr);
}
</script>`;
}

const STYLE = `<style>
:root{color-scheme:light dark}
*{box-sizing:border-box}
body{margin:0;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#faf9f5;color:#2b2b2b}
@media (prefers-color-scheme:dark){body{background:#16181c;color:#e6e6e6}}
.wrap{max-width:1000px;margin:0 auto;padding:28px 18px 60px}
h1{font-size:22px;margin:0 0 6px}
.meta{color:#888;font-size:13px;margin-bottom:16px}
.scroll{overflow-x:auto;border:1px solid rgba(128,128,128,.25);border-radius:10px}
table{border-collapse:collapse;width:100%;font-size:14px;min-width:720px}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid rgba(128,128,128,.18);white-space:nowrap}
th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#999;background:rgba(128,128,128,.06)}
tr.unlock td:first-child{color:#39b37a;font-weight:600}
td.empty,.empty{color:#999;text-align:center;padding:28px}
.foot{color:#999;font-size:12px;margin-top:14px}
.warn{background:#4a2a00;color:#ffd08a;padding:10px 14px;border-radius:8px;margin-bottom:14px;font-size:13px}
code{background:rgba(128,128,128,.18);padding:1px 6px;border-radius:5px;font-size:13px}
.login{display:flex;flex-direction:column;gap:10px;max-width:280px}
.login input,.login button{padding:11px 14px;border-radius:8px;border:1px solid rgba(128,128,128,.4);font-size:15px}
.login button{background:#c9a53f;color:#231a00;border:0;font-weight:600;cursor:pointer}
</style>`;
