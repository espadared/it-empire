"""The admin dashboard page.

Intentionally nothing like the game. The game is warm, illustrated and
forgiving; this is a console for people who can change other people's
progress, so it is plain, dense and states consequences before it acts.

The page is one self-contained document. It holds no state that matters —
every figure and every permission is fetched from the server on load, and
every action is re-checked there. Hiding a button here is a courtesy, not a
security control.
"""

import json


def page(roles, permissions, typed_confirm, resources):
    cfg = json.dumps({
        "roles": sorted(roles),
        "permissions": permissions,
        "typedConfirm": typed_confirm,
        "resources": {k: v[2] for k, v in resources.items()},
    })
    return TEMPLATE.replace("__CONFIG__", cfg)


TEMPLATE = r"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>IT Empire — Admin</title>
<style>
:root{
  --bg:#F4F6F9; --surface:#FFFFFF; --line:#DDE3EC; --line-2:#EEF1F6;
  --text:#16202E; --muted:#5C6B80; --faint:#8494A8;
  --brand:#1F4E79; --brand-2:#2C6CA8; --brand-ink:#FFFFFF;
  --ok:#1B7F4B; --ok-bg:#E7F5EC;
  --warn:#8A5A00; --warn-bg:#FEF3DC;
  --bad:#B3261E; --bad-bg:#FCE9E7;
  --info:#1F4E79; --info-bg:#E8F0F7;
  --side:#16202E; --side-2:#1E2B3C; --side-text:#C3CEDC;
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  --sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;height:100%}
body{background:var(--bg);color:var(--text);font:14px/1.5 var(--sans);-webkit-font-smoothing:antialiased}
a{color:var(--brand-2)}
button{font:inherit;cursor:pointer}
h1,h2,h3,h4{margin:0;font-weight:650;letter-spacing:-.01em}
.mono{font-family:var(--mono);font-variant-numeric:tabular-nums}

/* ---------- sign in ---------- */
#gate{display:flex;align-items:center;justify-content:center;min-height:100%;padding:24px}
.gatebox{width:100%;max-width:400px;background:var(--surface);border:1px solid var(--line);
  border-radius:10px;padding:28px;box-shadow:0 1px 3px rgba(16,32,54,.08)}
.gatebox h1{font-size:19px;margin-bottom:2px}
.gatebox .sub{color:var(--muted);font-size:13px;margin-bottom:20px}
label{display:block;font-size:12px;font-weight:650;color:var(--muted);
  text-transform:uppercase;letter-spacing:.04em;margin:14px 0 5px}
input,select,textarea{width:100%;padding:9px 11px;border:1px solid var(--line);
  border-radius:6px;background:#fff;color:var(--text);font:14px var(--sans)}
input:focus,select:focus,textarea:focus{outline:2px solid var(--brand-2);outline-offset:-1px;border-color:var(--brand-2)}
textarea{resize:vertical;min-height:62px}
.btn{padding:9px 14px;border-radius:6px;border:1px solid var(--line);
  background:var(--surface);color:var(--text);font-weight:600;font-size:13px}
.btn:hover{background:var(--line-2)}
.btn.primary{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}
.btn.primary:hover{background:var(--brand-2)}
.btn.danger{background:var(--bad);border-color:var(--bad);color:#fff}
.btn.danger:hover{filter:brightness(1.08)}
.btn.wide{width:100%;justify-content:center;margin-top:20px}
.btn[disabled]{opacity:.5;cursor:not-allowed}
.btn.sm{padding:5px 10px;font-size:12px}
.msg{margin-top:14px;padding:10px 12px;border-radius:6px;font-size:13px}
.msg.bad{background:var(--bad-bg);color:var(--bad);border:1px solid #F3C9C5}
.msg.ok{background:var(--ok-bg);color:var(--ok);border:1px solid #BFE3CD}
.msg.warn{background:var(--warn-bg);color:var(--warn);border:1px solid #F0DCAE}
.msg.info{background:var(--info-bg);color:var(--info);border:1px solid #C6DBEC}

/* ---------- shell ---------- */
#shell{display:none;min-height:100%}
#shell.on{display:grid;grid-template-columns:216px 1fr}
aside{background:var(--side);color:var(--side-text);padding:0 0 32px;min-height:100vh;
  position:sticky;top:0;height:100vh;overflow:auto}
.brand{padding:18px 18px 14px;border-bottom:1px solid #2A3849}
.brand b{color:#fff;font-size:15px;display:block;letter-spacing:-.01em}
.brand span{font-size:11px;color:#7E90A6;text-transform:uppercase;letter-spacing:.09em}
nav{padding:10px 8px}
nav .grp{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#6E819A;
  padding:14px 10px 6px;font-weight:700}
nav button{display:flex;align-items:center;gap:9px;width:100%;text-align:left;
  padding:8px 10px;border:0;border-radius:6px;background:none;color:var(--side-text);
  font-size:13.5px;font-weight:550}
nav button:hover{background:var(--side-2);color:#fff}
nav button.on{background:var(--brand-2);color:#fff}
nav button.soon{color:#63758C;cursor:default}
nav button.soon:hover{background:none;color:#63758C}
nav button .tag{margin-left:auto;font-size:9.5px;background:#2A3849;color:#8FA2B8;
  padding:2px 5px;border-radius:4px;letter-spacing:.05em}
main{padding:22px 26px 60px;min-width:0}
.topbar{display:flex;align-items:center;gap:14px;margin-bottom:20px;flex-wrap:wrap}
.topbar h1{font-size:20px}
.topbar .who{margin-left:auto;display:flex;align-items:center;gap:10px;font-size:12.5px;color:var(--muted)}
.pill{display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:99px;
  font-size:11px;font-weight:700;letter-spacing:.03em;text-transform:uppercase}
.pill.ok{background:var(--ok-bg);color:var(--ok)}
.pill.warn{background:var(--warn-bg);color:var(--warn)}
.pill.bad{background:var(--bad-bg);color:var(--bad)}
.pill.info{background:var(--info-bg);color:var(--info)}
.pill.grey{background:var(--line-2);color:var(--muted)}

/* ---------- cards & tables ---------- */
.card{background:var(--surface);border:1px solid var(--line);border-radius:9px;margin-bottom:18px}
.card>h3{padding:13px 16px;border-bottom:1px solid var(--line);font-size:13.5px}
.card>h3 small{font-weight:500;color:var(--muted);margin-left:8px;font-size:12px}
.card .body{padding:16px}
.grid{display:grid;gap:14px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:12px;margin-bottom:18px}
.stat{background:var(--surface);border:1px solid var(--line);border-radius:9px;padding:13px 15px}
.stat .k{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:650}
.stat .v{font-size:24px;font-weight:680;margin-top:3px;letter-spacing:-.02em;
  font-family:var(--mono);font-variant-numeric:tabular-nums}
.stat .n{font-size:11.5px;color:var(--faint);margin-top:1px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;
  color:var(--muted);font-weight:700;padding:9px 12px;border-bottom:1px solid var(--line);
  background:#FAFBFD;position:sticky;top:0}
td{padding:9px 12px;border-bottom:1px solid var(--line-2);vertical-align:middle}
tr:last-child td{border-bottom:0}
tbody tr.click{cursor:pointer}
tbody tr.click:hover{background:#F7F9FC}
.scroll{overflow:auto;max-height:70vh}
.tools{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
.tools input,.tools select{width:auto;min-width:190px}
.empty{padding:30px;text-align:center;color:var(--faint);font-size:13px}
.kv{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;font-size:13px}
.kv dt{color:var(--muted);font-weight:600}
.kv dd{margin:0;font-family:var(--mono);font-variant-numeric:tabular-nums}
.cols2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
@media(max-width:900px){.cols2{grid-template-columns:1fr}
  #shell.on{grid-template-columns:1fr}
  aside{position:static;height:auto;min-height:0}}

/* ---------- modal ---------- */
.veil{position:fixed;inset:0;background:rgba(16,32,54,.45);display:flex;
  align-items:flex-start;justify-content:center;padding:40px 18px;overflow:auto;z-index:50}
.modal{background:var(--surface);border-radius:10px;width:100%;max-width:520px;
  box-shadow:0 12px 40px rgba(16,32,54,.28)}
.modal h3{padding:15px 18px;border-bottom:1px solid var(--line);font-size:15px}
.modal .body{padding:18px}
.modal .foot{padding:14px 18px;border-top:1px solid var(--line);display:flex;
  gap:9px;justify-content:flex-end;background:#FAFBFD;border-radius:0 0 10px 10px}
.diff{border:1px solid var(--line);border-radius:7px;overflow:hidden;margin:14px 0}
.diff div{display:flex;justify-content:space-between;gap:14px;padding:9px 13px;font-size:13px}
.diff div+div{border-top:1px solid var(--line-2)}
.diff .lbl{color:var(--muted);font-weight:600}
.diff .val{font-family:var(--mono);font-weight:650}
.diff .now{background:#FAFBFD}
.diff .next{background:var(--info-bg)}
.diff .next .val{color:var(--brand)}
.tabs{display:flex;gap:2px;border-bottom:1px solid var(--line);margin-bottom:16px;flex-wrap:wrap}
.tabs button{border:0;background:none;padding:9px 13px;font-size:13px;font-weight:600;
  color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-1px}
.tabs button.on{color:var(--brand);border-bottom-color:var(--brand)}
.note{font-size:12.5px;color:var(--muted);line-height:1.55}
.gap{height:14px}
code{font-family:var(--mono);background:var(--line-2);padding:1px 5px;border-radius:4px;font-size:12.5px}
</style></head><body>

<div id="gate">
  <div class="gatebox">
    <h1>IT Empire — Administration</h1>
    <div class="sub">Authorised staff only. Every action here is recorded.</div>
    <form id="loginForm" autocomplete="on">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="username" required>
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required>
      <div id="mfaWrap" style="display:none">
        <label for="code">Authenticator code</label>
        <input id="code" name="code" inputmode="numeric" autocomplete="one-time-code"
               pattern="[0-9]{6}" maxlength="6">
      </div>
      <button class="btn primary wide" type="submit">Sign in</button>
    </form>
    <div id="gateMsg"></div>
  </div>
</div>

<div id="shell">
  <aside>
    <div class="brand"><b>IT Empire</b><span>Admin console</span></div>
    <nav id="nav"></nav>
  </aside>
  <main>
    <div class="topbar">
      <h1 id="pageTitle">Dashboard</h1>
      <div class="who">
        <span id="whoName"></span>
        <span class="pill info" id="whoRole"></span>
        <button class="btn sm" id="btnPw">Password</button>
        <button class="btn sm" id="btnOut">Sign out</button>
      </div>
    </div>
    <div id="view"></div>
  </main>
</div>

<script>
const CFG = __CONFIG__;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = n => (n === null || n === undefined || n === '') ? '—'
  : Number(n).toLocaleString('en-GB');
const when = t => {
  if (!t) return '—';
  const d = new Date(t); if (isNaN(d)) return '—';
  return d.toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric',
    hour:'2-digit', minute:'2-digit' });
};
const ago = t => {
  if (!t) return '—';
  const s = (Date.now() - new Date(t)) / 1000;
  if (isNaN(s)) return '—';
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return Math.floor(s/86400) + 'd ago';
};
const dur = s => {
  s = Number(s) || 0;
  if (s < 60) return s + 's';
  if (s < 3600) return Math.round(s/60) + 'm';
  return (s/3600).toFixed(1) + 'h';
};

let ME = null, PAGE = 'dashboard', CACHE = {};

async function api(route, opts = {}) {
  const res = await fetch('/admin/api/' + route, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Request': '1' },
    credentials: 'same-origin',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (res.status === 401 && ME) { location.reload(); return {}; }
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { data, status: res.status });
  return data;
}
const can = p => ME && ME.perms.includes(p);

/* ---------- sign in ---------- */
$('#loginForm').onsubmit = async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  $('#gateMsg').innerHTML = '';
  try {
    const r = await api('session', { method: 'POST', body: {
      email: $('#email').value, password: $('#password').value, code: $('#code').value } });
    ME = r.me;
    if (r.must_change) return forcePassword();
    boot();
  } catch (err) {
    if (err.data && err.data.mfa) $('#mfaWrap').style.display = 'block';
    $('#gateMsg').innerHTML = `<div class="msg bad">${esc(err.message)}</div>`;
  } finally { btn.disabled = false; }
};

function forcePassword() {
  $('#gate').innerHTML = `<div class="gatebox">
    <h1>Choose a new password</h1>
    <div class="sub">This account was set up with a temporary password. Replace it
      before going any further.</div>
    <label>New password</label><input id="np" type="password" autocomplete="new-password">
    <label>Repeat it</label><input id="np2" type="password" autocomplete="new-password">
    <div class="note" style="margin-top:10px">At least 12 characters, with a letter and a number.</div>
    <button class="btn primary wide" id="npGo">Set password and continue</button>
    <div id="npMsg"></div></div>`;
  $('#npGo').onclick = async () => {
    const go = $('#npGo');
    $('#npMsg').innerHTML = '';
    if ($('#np').value !== $('#np2').value)
      return $('#npMsg').innerHTML = '<div class="msg bad">Those two do not match.</div>';
    go.disabled = true;
    try {
      await api('password', { method: 'POST', body: { new: $('#np').value } });
      location.reload();
    } catch (err) {
      go.disabled = false;
      $('#npMsg').innerHTML = `<div class="msg bad">${esc(err.message)}
        <br><br>Your password has <b>not</b> been changed. Sign in with the
        temporary one again.</div>`;
    }
  };
}

/* ---------- shell ---------- */
const NAV = [
  ['Operations', [
    ['dashboard', 'Dashboard', null],
    ['players', 'Players', 'players.view'],
    ['audit', 'Audit log', 'logs.view'],
    ['admins', 'Administrators', 'admins.manage'],
  ]],
  ['Not built yet', [
    ['soon:support', 'Support tickets', null],
    ['soon:content', 'Characters / Equipment', null],
    ['soon:minigames', 'Mini-games', null],
    ['soon:events', 'Events & announcements', null],
    ['soon:economy', 'Economy & balance', null],
    ['soon:anticheat', 'Anti-cheat', null],
    ['soon:errors', 'Errors & jobs', null],
    ['soon:backups', 'Backups & maintenance', null],
  ]],
];

function boot() {
  $('#gate').style.display = 'none';
  $('#shell').classList.add('on');
  $('#whoName').textContent = ME.name;
  $('#whoRole').textContent = ME.role.replace('_', ' ');
  const nav = NAV.map(([grp, items]) => {
    const rows = items.filter(([id, , perm]) => !perm || can(perm)).map(([id, label]) => {
      const soon = id.startsWith('soon:');
      return `<button data-go="${id}" class="${soon ? 'soon' : ''}">${esc(label)}
        ${soon ? '<span class="tag">PHASE 2+</span>' : ''}</button>`;
    }).join('');
    return rows ? `<div class="grp">${esc(grp)}</div>${rows}` : '';
  }).join('');
  $('#nav').innerHTML = nav;
  $('#nav').onclick = e => {
    const b = e.target.closest('[data-go]'); if (!b) return;
    go(b.dataset.go);
  };
  go('dashboard');
}

$('#btnOut').onclick = async () => {
  await api('session', { method: 'DELETE' });
  location.reload();
};
$('#btnPw').onclick = () => changePassword();

function go(id) {
  PAGE = id;
  document.querySelectorAll('#nav button').forEach(b =>
    b.classList.toggle('on', b.dataset.go === id));
  const titles = { dashboard:'Dashboard', players:'Players', audit:'Audit log',
    admins:'Administrators' };
  $('#pageTitle').textContent = titles[id] || 'Not built yet';
  if (id.startsWith('soon:')) return renderSoon(id.slice(5));
  ({ dashboard: renderDashboard, players: renderPlayers, audit: renderAudit,
     admins: renderAdmins }[id] || renderDashboard)();
}

function loading() { $('#view').innerHTML = '<div class="empty">Loading…</div>'; }
function oops(err) {
  $('#view').innerHTML = `<div class="msg bad">${esc(err.message || 'Something went wrong.')}</div>`;
}

/* ---------- dashboard ---------- */
async function renderDashboard() {
  loading();
  try {
    const d = await api('dashboard');
    const p = d.players, a = d.activity, e = d.economy, pr = d.progression;
    const stat = (k, v, n) => `<div class="stat"><div class="k">${k}</div>
      <div class="v">${v}</div>${n ? `<div class="n">${n}</div>` : ''}</div>`;
    const ret = r => r ? `${r.pct}% <span style="font-size:12px;color:var(--faint)">(${r.returned}/${r.cohort})</span>` : '—';
    $('#view').innerHTML = `
      <div class="stats">
        ${stat('Registered players', num(p.total), `${num(p.new_today)} new today`)}
        ${stat('Online now', num(p.online), 'open sessions')}
        ${stat('Active today', num(p.active_today), `${num(p.active_week)} this week`)}
        ${stat('Time played today', dur(a.seconds_today), `${num(a.sessions_today)} sessions`)}
        ${stat('Avg session', a.avg_session_min + 'm', 'today')}
        ${stat('Banned / disabled', num(p.banned + p.deactivated),
               `${num(p.banned)} banned · ${num(p.deactivated)} deactivated`)}
      </div>
      <div class="cols2">
        <div class="card"><h3>Retention <small>did they come back?</small></h3><div class="body">
          <dl class="kv">
            <dt>Day 1</dt><dd>${ret(d.retention.d1)}</dd>
            <dt>Day 7</dt><dd>${ret(d.retention.d7)}</dd>
            <dt>Day 30</dt><dd>${ret(d.retention.d30)}</dd>
          </dl>
          <div class="note" style="margin-top:12px">A cohort is everyone who registered on that
            day. A dash means nobody registered that day, so there is nothing to measure.</div>
        </div></div>
        <div class="card"><h3>Progression</h3><div class="body">
          <dl class="kv">
            <dt>Average level</dt><dd>${pr.avg_level}</dd>
            <dt>Highest level</dt><dd>${num(pr.max_level)}</dd>
            <dt>Staff hired, all players</dt><dd>${num(pr.staff_total)}</dd>
            <dt>Chapter spread</dt><dd>${Object.keys(pr.chapters).length
              ? Object.entries(pr.chapters).sort().map(([c,n]) => `Ch${c}: ${n}`).join(' · ')
              : '—'}</dd>
          </dl>
        </div></div>
      </div>
      <div class="card"><h3>Economy <small>lifetime totals across all saves</small></h3><div class="body">
        <dl class="kv">
          <dt>IT Credits earned</dt><dd>${num(e.credits_earned)}</dd>
          <dt>IT Credits held right now</dt><dd>${num(e.held_credits)}</dd>
          <dt>XP earned</dt><dd>${num(e.xp_earned)}</dd>
          <dt>Tickets resolved</dt><dd>${num(e.tickets)}</dd>
          <dt>Incidents handled</dt><dd>${num(e.incidents)}</dd>
          <dt>Reorganisations (prestige)</dt><dd>${num(e.reorgs)}</dd>
        </dl>
      </div></div>
      <div class="card"><h3>Administrator activity</h3><div class="body">
        <dl class="kv">
          <dt>Admin actions today</dt><dd>${num(d.admin.actions_today)}</dd>
          <dt>Failed admin sign-ins today</dt>
          <dd>${num(d.admin.failed_logins_today)}
            ${d.admin.failed_logins_today > 5 ? '<span class="pill bad">check this</span>' : ''}</dd>
        </dl>
      </div></div>
      <div class="card"><h3>Not measured yet</h3><div class="body">
        <div class="note">These tiles are deliberately absent rather than estimated. The game
          does not record the underlying data, so any figure shown here would be invented —
          and somebody would act on it.</div>
        <ul class="note" style="margin:10px 0 0;padding-left:18px">
          ${d.not_captured.map(x => `<li>${esc(x)}</li>`).join('')}
        </ul>
      </div></div>`;
  } catch (err) { oops(err); }
}

/* ---------- players ---------- */
async function renderPlayers(term) {
  loading();
  try {
    const q = term !== undefined ? term : (CACHE.playerTerm || '');
    CACHE.playerTerm = q;
    const d = await api('players?q=' + encodeURIComponent(q));
    $('#view').innerHTML = `
      <div class="tools">
        <input id="psearch" placeholder="Player ID, username or display name" value="${esc(q)}">
        <button class="btn" id="pgo">Search</button>
        <span class="note">${d.players.length} shown${d.players.length >= 50 ? ', newest saves first' : ''}</span>
      </div>
      <div class="card"><div class="scroll"><table>
        <thead><tr><th>ID</th><th>Username</th><th>Display</th><th>Level</th>
          <th>Reputation</th><th>Tickets</th><th>Last save</th><th>Status</th></tr></thead>
        <tbody>${d.players.map(p => `<tr class="click" data-p="${p.id}">
          <td class="mono">${p.id}</td>
          <td>${esc(p.username)}</td>
          <td>${esc(p.display)}</td>
          <td class="mono">${num(p.level)}</td>
          <td class="mono">${num(p.reputation)}</td>
          <td class="mono">${num(p.tickets)}</td>
          <td>${ago(p.last_save)}</td>
          <td>${p.flagged ? '<span class="pill bad">Banned</span>'
              : p.status === 'deactivated' ? '<span class="pill grey">Deactivated</span>'
              : p.online ? '<span class="pill ok">Online</span>'
              : '<span class="pill grey">Offline</span>'}</td>
        </tr>`).join('') || '<tr><td colspan="8" class="empty">No players matched.</td></tr>'}
        </tbody></table></div></div>`;
    const run = () => renderPlayers($('#psearch').value);
    $('#pgo').onclick = run;
    $('#psearch').onkeydown = e => { if (e.key === 'Enter') run(); };
    $('#view').onclick = e => {
      const tr = e.target.closest('[data-p]'); if (tr) openPlayer(tr.dataset.p);
    };
  } catch (err) { oops(err); }
}

async function openPlayer(id) {
  loading();
  try {
    const p = await api('player/' + id);
    CACHE.player = p;
    drawPlayer(p, 'account');
  } catch (err) { oops(err); }
}

function drawPlayer(p, tab) {
  const st = p.ban ? `<span class="pill bad">${esc(p.ban.kind)} ban</span>`
    : p.status === 'deactivated' ? '<span class="pill grey">Deactivated</span>'
    : '<span class="pill ok">Active</span>';
  const tabs = ['account','progression','staff','equipment','activity','snapshots','actions'];
  $('#pageTitle').textContent = p.display + ' · #' + p.id;
  $('#view').innerHTML = `
    <div class="tools">
      <button class="btn sm" id="back">← All players</button> ${st}
      ${p.sessions ? `<span class="pill info">${p.sessions} open session${p.sessions>1?'s':''}</span>` : ''}
      ${!p.has_state ? '<span class="pill warn">No save yet</span>' : ''}
    </div>
    <div class="tabs">${tabs.map(t =>
      `<button data-tab="${t}" class="${t===tab?'on':''}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</div>
    <div id="ptab"></div>`;
  $('#back').onclick = () => { $('#pageTitle').textContent = 'Players'; renderPlayers(); };
  $('#view').querySelector('.tabs').onclick = e => {
    const b = e.target.closest('[data-tab]'); if (b) drawPlayer(p, b.dataset.tab);
  };
  $('#ptab').innerHTML = ({
    account: () => `<div class="cols2">
      <div class="card"><h3>Account</h3><div class="body"><dl class="kv">
        <dt>Player ID</dt><dd>${p.id}</dd>
        <dt>Username</dt><dd>${esc(p.username)}</dd>
        <dt>Display name</dt><dd>${esc(p.display)}</dd>
        <dt>Registered</dt><dd>${when(p.created_at)}</dd>
        <dt>Last save</dt><dd>${when(p.last_save)} <span class="note">(${ago(p.last_save)})</span></dd>
        <dt>Save revision</dt><dd>${p.rev}</dd>
        <dt>Status</dt><dd>${esc(p.status)}</dd>
      </dl></div></div>
      <div class="card"><h3>Headline progress</h3><div class="body"><dl class="kv">
        <dt>Level</dt><dd>${num(p.level)}</dd>
        <dt>Reputation</dt><dd>${num(p.reputation)}</dd>
        <dt>Tickets resolved</dt><dd>${num(p.tickets)}</dd>
        <dt>IT Credits</dt><dd>${num(p.progression.credits)}</dd>
        <dt>Chapter</dt><dd>${num(p.progression.chapter)}</dd>
        <dt>Staff</dt><dd>${num(p.staff.length)}</dd>
      </dl></div></div></div>
      ${p.ban_history.length ? `<div class="card"><h3>Ban history</h3><div class="scroll"><table>
        <thead><tr><th>Type</th><th>Reason</th><th>By</th><th>Issued</th><th>Until</th><th>State</th></tr></thead>
        <tbody>${p.ban_history.map(b => `<tr>
          <td>${esc(b.kind)}</td><td>${esc(b.reason)}</td><td>${esc(b.by)}</td>
          <td>${when(b.at)}</td><td>${b.until ? when(b.until) : 'never'}</td>
          <td>${b.active ? '<span class="pill bad">Active</span>'
            : `<span class="pill grey">Lifted${b.lifted_by ? ' by ' + esc(b.lifted_by) : ''}</span>`}</td>
        </tr>`).join('')}</tbody></table></div></div>` : ''}`,

    progression: () => `<div class="card"><h3>Progression</h3><div class="body"><dl class="kv">
        ${Object.entries(p.progression).map(([k, v]) =>
          `<dt>${esc(k)}</dt><dd>${typeof v === 'number' ? num(v) : esc(v ?? '—')}</dd>`).join('')}
      </dl></div></div>
      <div class="card"><h3>Lifetime totals <small>from the save</small></h3><div class="body"><dl class="kv">
        ${Object.entries(p.lifetime).filter(([k, v]) => typeof v === 'number').map(([k, v]) =>
          `<dt>${esc(k)}</dt><dd>${num(v)}</dd>`).join('') || '<dt>—</dt><dd>nothing recorded</dd>'}
      </dl></div></div>`,

    staff: () => p.staff.length ? `<div class="card"><div class="scroll"><table>
        <thead><tr><th>Character</th><th>Level</th><th>XP</th><th>Rarity</th>
          <th>Department</th><th>Equipped</th></tr></thead>
        <tbody>${p.staff.map(s => `<tr><td>${esc(s.defId)}</td><td class="mono">${num(s.level)}</td>
          <td class="mono">${num(s.xp)}</td><td>${esc(s.rarity)}</td>
          <td>${esc(s.dept || '—')}</td><td class="mono">${s.equipped}</td></tr>`).join('')}
        </tbody></table></div></div>
        <div class="note">Acquisition date and source are not recorded by the game, so they
          cannot be shown.</div>`
      : '<div class="card"><div class="empty">No staff.</div></div>',

    equipment: () => p.equipment.length ? `<div class="card"><div class="scroll"><table>
        <thead><tr><th>Item</th><th>Level</th><th>Issued to</th></tr></thead>
        <tbody>${p.equipment.map(i => `<tr><td>${esc(i.eid)}</td>
          <td class="mono">${num(i.level)}</td><td>${esc(i.on || '—')}</td></tr>`).join('')}
        </tbody></table></div></div>
        <div class="note">Drop source and acquisition date are not recorded by the game.</div>`
      : '<div class="card"><div class="empty">No equipment.</div></div>',

    activity: () => p.activity.length ? `<div class="card"><h3>Daily activity
        <small>the game records totals per day, not individual events</small></h3>
        <div class="scroll"><table>
        <thead><tr><th>Day</th><th>Time played</th><th>Sessions</th><th>Saves</th></tr></thead>
        <tbody>${p.activity.map(a => `<tr><td>${esc(a.day)}</td><td>${dur(a.seconds)}</td>
          <td class="mono">${a.sessions}</td><td class="mono">${a.saves}</td></tr>`).join('')}
        </tbody></table></div></div>`
      : '<div class="card"><div class="empty">No activity recorded.</div></div>',

    snapshots: () => `<div class="card"><h3>Save snapshots
        <small>taken automatically before any admin change</small></h3>
      ${p.snapshots.length ? `<div class="scroll"><table>
        <thead><tr><th>Taken</th><th>Why</th><th>By</th><th>Level</th>
          <th>Reputation</th><th>Credits</th><th></th></tr></thead>
        <tbody>${p.snapshots.map(s => `<tr>
          <td>${when(s.at)}</td><td>${esc(s.reason || '—')}</td><td>${esc(s.by || 'system')}</td>
          <td class="mono">${num(s.level)}</td><td class="mono">${num(s.reputation)}</td>
          <td class="mono">${num(s.credits)}</td>
          <td>${can('players.restore')
            ? `<button class="btn sm" data-restore="${s.id}">Restore…</button>` : ''}</td>
        </tr>`).join('')}</tbody></table></div>`
        : `<div class="empty">No snapshots yet. One is taken automatically before any
             administrative change to this account.</div>`}</div>`,

    actions: () => renderActions(p),
  }[tab] || (() => ''))();

  const rs = $('#ptab').querySelectorAll('[data-restore]');
  rs.forEach(b => b.onclick = () => restoreDialog(p, b.dataset.restore));
  wireActions(p);
}

function renderActions(p) {
  const blocks = [];
  if (can('players.resource.add') || can('players.resource.remove') || can('players.resource.set')) {
    blocks.push(`<div class="card"><h3>Adjust resources</h3><div class="body">
      <div class="tools">
        <select id="rKey">${Object.entries(CFG.resources).map(([k, l]) =>
          `<option value="${k}">${esc(l)}</option>`).join('')}</select>
        <select id="rMode">
          ${can('players.resource.add') ? '<option value="add">Add</option>' : ''}
          ${can('players.resource.remove') ? '<option value="remove">Remove</option>' : ''}
          ${can('players.resource.set') ? '<option value="set">Set to…</option>' : ''}
        </select>
        <input id="rAmt" type="number" min="0" placeholder="Amount" style="min-width:130px">
      </div>
      <label for="rWhy">Reason (recorded in the audit log)</label>
      <textarea id="rWhy" placeholder="e.g. Missing reward from the launch event"></textarea>
      <button class="btn primary" id="rGo" style="margin-top:12px">Review change…</button>
    </div></div>`);
  }
  const resets = [
    ['password', 'Send a password reset', 'players.reset.password',
     'Issues a one-time code for the player. You never see their password.'],
    ['session', 'Force logout', 'players.reset.session',
     'Ends every open session. They sign in again as normal.'],
    ['daily', 'Reset daily missions', 'players.reset.daily', ''],
    ['energy', 'Refill energy', 'players.reset.energy', ''],
    ['tutorial', 'Reset the tutorial', 'players.reset.tutorial', ''],
    ['run', 'Clear the current queue', 'players.reset.run',
     'Empties the ticket queue and any stuck incident.'],
  ].filter(r => can(r[2]));
  if (resets.length) {
    blocks.push(`<div class="card"><h3>Support tools</h3><div class="body">
      ${resets.map(([k, label, , note]) => `<div style="display:flex;align-items:center;
        gap:12px;padding:9px 0;border-bottom:1px solid var(--line-2)">
        <div style="flex:1"><b style="font-weight:600">${esc(label)}</b>
          ${note ? `<div class="note">${esc(note)}</div>` : ''}</div>
        <button class="btn sm" data-reset="${k}">Run</button></div>`).join('')}
    </div></div>`);
  }
  const bans = [];
  if (can('players.suspend')) bans.push(['suspend', 'Suspend (hours)']);
  if (can('players.ban.temp')) bans.push(['temporary', 'Temporary ban (hours)']);
  if (can('players.ban.perm')) bans.push(['permanent', 'Permanent ban']);
  if (bans.length || can('players.unban') || can('players.deactivate')) {
    blocks.push(`<div class="card"><h3>Account standing</h3><div class="body">
      ${p.ban ? `<div class="msg warn">Currently under a ${esc(p.ban.kind)} ban issued by
        ${esc(p.ban.by)}${p.ban.until ? ', until ' + when(p.ban.until) : ''}.
        <br>Reason: ${esc(p.ban.reason)}</div><div class="gap"></div>` : ''}
      <div class="tools">
        ${bans.map(([k, l]) => `<button class="btn" data-ban="${k}">${esc(l)}</button>`).join('')}
        ${p.ban && can('players.unban') ? '<button class="btn" data-unban="1">Lift ban</button>' : ''}
        ${can('players.deactivate') ? (p.status === 'deactivated'
          ? '<button class="btn" data-react="1">Reactivate</button>'
          : '<button class="btn danger" data-deact="1">Deactivate account</button>') : ''}
      </div>
      <div class="note" style="margin-top:10px">Deactivating is reversible and keeps every
        record. Nothing here deletes a player.</div>
    </div></div>`);
  }
  return blocks.join('') || '<div class="card"><div class="empty">Your role has no actions on this player.</div></div>';
}

function wireActions(p) {
  const t = $('#ptab');
  const go = t.querySelector('#rGo');
  if (go) go.onclick = () => resourceDialog(p);
  t.querySelectorAll('[data-reset]').forEach(b => b.onclick = () => resetDialog(p, b.dataset.reset));
  t.querySelectorAll('[data-ban]').forEach(b => b.onclick = () => banDialog(p, b.dataset.ban));
  const ub = t.querySelector('[data-unban]');
  if (ub) ub.onclick = () => simpleDialog(p, 'Lift the ban', 'unban', {},
    'The player can sign in again immediately.');
  const de = t.querySelector('[data-deact]');
  if (de) de.onclick = () => simpleDialog(p, 'Deactivate this account', 'deactivate', {},
    'The account and its save are kept exactly as they are. It can be reactivated at any time.');
  const re = t.querySelector('[data-react]');
  if (re) re.onclick = () => simpleDialog(p, 'Reactivate this account', 'reactivate', {}, '');
}

/* ---------- confirmation dialogs ---------- */
function modal(title, bodyHtml, onConfirm, confirmLabel = 'Confirm', danger = false) {
  const v = document.createElement('div');
  v.className = 'veil';
  v.innerHTML = `<div class="modal"><h3>${esc(title)}</h3>
    <div class="body">${bodyHtml}</div>
    <div class="foot"><button class="btn" data-x>Cancel</button>
      <button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(confirmLabel)}</button></div></div>`;
  document.body.appendChild(v);
  const close = () => v.remove();
  v.querySelector('[data-x]').onclick = close;
  v.onclick = e => { if (e.target === v) close(); };
  v.querySelector('[data-ok]').onclick = async () => {
    const btn = v.querySelector('[data-ok]'); btn.disabled = true;
    try { await onConfirm(v); close(); }
    catch (err) {
      let m = v.querySelector('.msg.bad');
      if (!m) { m = document.createElement('div'); m.className = 'msg bad';
        v.querySelector('.body').appendChild(m); }
      m.textContent = err.message || 'That did not work.';
      btn.disabled = false;
    }
  };
  return v;
}

function diffBlock(what, who, now, next) {
  return `<div class="diff">
    <div><span class="lbl">What changes</span><span class="val">${esc(what)}</span></div>
    <div><span class="lbl">Who is affected</span><span class="val">${esc(who)}</span></div>
    <div class="now"><span class="lbl">Current value</span><span class="val">${esc(now)}</span></div>
    <div class="next"><span class="lbl">New value</span><span class="val">${esc(next)}</span></div>
  </div>`;
}

function typedGuard(perm) {
  const phrase = CFG.typedConfirm[perm];
  if (!phrase) return { html: '', get: () => undefined };
  return {
    html: `<label>Type <code>${esc(phrase)}</code> to confirm</label>
           <input id="confirmPhrase" autocomplete="off" spellcheck="false">`,
    get: v => (v.querySelector('#confirmPhrase') || {}).value,
  };
}

function resourceDialog(p) {
  const key = $('#rKey').value, mode = $('#rMode').value;
  const amount = Number($('#rAmt').value), reason = $('#rWhy').value.trim();
  if (!amount && mode !== 'set') return alert('Enter an amount.');
  if (!reason) return alert('A reason is required — it goes into the audit log.');
  const label = CFG.resources[key];
  const cur = key === 'credits' ? p.progression.credits
    : key === 'reputation' ? p.reputation : key === 'level' ? p.level
    : p.progression[key];
  const next = mode === 'add' ? (Number(cur) || 0) + amount
    : mode === 'remove' ? Math.max(0, (Number(cur) || 0) - amount) : amount;
  const guard = typedGuard(mode === 'set' ? 'players.resource.set' : null);
  modal(`${mode === 'set' ? 'Set' : mode === 'add' ? 'Add' : 'Remove'} ${label}`,
    diffBlock(label, `${p.display} (#${p.id})`, num(cur), num(next)) +
    `<div class="note">Reason: ${esc(reason)}</div>${guard.html}`,
    async v => {
      await api(`player/${p.id}/resource`, { method: 'POST', body: {
        resource: key, mode, amount, reason, confirm: guard.get(v) } });
      openPlayer(p.id);
    }, 'Apply change', mode === 'set');
}

function resetDialog(p, kind) {
  const labels = { password: 'Send a password reset', session: 'Force logout',
    daily: 'Reset daily missions', energy: 'Refill energy',
    tutorial: 'Reset the tutorial', run: 'Clear the current queue' };
  modal(labels[kind],
    `<div class="note">This affects <b>${esc(p.display)} (#${p.id})</b> only.
      ${kind === 'password' ? 'A one-time code is generated for you to pass on. Their existing password is never shown and is not changed until they use the code.' : ''}
      ${['daily','energy','tutorial','run'].includes(kind) ? ' A snapshot of their save is taken first, so this can be undone.' : ''}</div>
     <label>Reason</label><textarea id="rr" placeholder="Why is this needed?"></textarea>`,
    async v => {
      const r = await api(`player/${p.id}/reset`, { method: 'POST', body: {
        kind, reason: v.querySelector('#rr').value } });
      if (r.code) {
        modal('One-time reset code',
          `<div class="msg info">Give this to the player. It works once and expires in two hours.</div>
           <div style="font:700 30px var(--mono);text-align:center;letter-spacing:.16em;
             padding:16px;background:var(--line-2);border-radius:8px">${esc(r.code)}</div>
           <div class="note" style="margin-top:10px">This is not their password. Nobody,
             including you, can see that.</div>`, async () => {}, 'Done');
      }
      openPlayer(p.id);
    }, 'Run it');
}

function banDialog(p, kind) {
  const perm = kind === 'permanent' ? 'players.ban.perm' : null;
  const guard = typedGuard(perm);
  modal(kind === 'permanent' ? 'Permanent ban' : kind === 'suspend' ? 'Suspend account' : 'Temporary ban',
    diffBlock('Account standing', `${p.display} (#${p.id})`,
      p.ban ? p.ban.kind + ' ban' : 'in good standing',
      kind + ' ban') +
    (kind === 'permanent' ? '' :
      '<label>Duration in hours</label><input id="bh" type="number" min="1" value="24">') +
    `<label>Reason (shown in the ban history)</label>
     <textarea id="br" placeholder="What did they do?"></textarea>
     <div class="note">Their open sessions end immediately.</div>${guard.html}`,
    async v => {
      await api(`player/${p.id}/ban`, { method: 'POST', body: {
        kind, reason: v.querySelector('#br').value,
        hours: v.querySelector('#bh') ? Number(v.querySelector('#bh').value) : undefined,
        confirm: guard.get(v) } });
      openPlayer(p.id);
    }, 'Issue it', true);
}

function simpleDialog(p, title, action, extra, note) {
  modal(title, `<div class="note">${esc(note)}</div>
    <label>Reason</label><textarea id="sr"></textarea>`,
    async v => {
      await api(`player/${p.id}/${action}`, { method: 'POST', body: Object.assign(
        { reason: v.querySelector('#sr').value }, extra) });
      openPlayer(p.id);
    }, 'Confirm', action === 'deactivate');
}

function restoreDialog(p, snapId) {
  const s = p.snapshots.find(x => String(x.id) === String(snapId));
  const guard = typedGuard('players.restore');
  modal('Restore this save',
    `<div class="note">The player's current save is snapshotted first, so this restore can
      itself be undone. Their open sessions end so nothing overwrites the restored save.</div>
     <div class="diff">
       <div class="now"><span class="lbl">Right now</span>
         <span class="val">L${num(p.level)} · ${num(p.reputation)} rep · ${num(p.progression.credits)} cr</span></div>
       <div class="next"><span class="lbl">After restoring</span>
         <span class="val">L${num(s.level)} · ${num(s.reputation)} rep · ${num(s.credits)} cr</span></div>
       <div><span class="lbl">Snapshot taken</span><span class="val">${esc(when(s.at))}</span></div>
     </div>
     <label>Reason</label><textarea id="qr" placeholder="e.g. Progress lost to the save race on 1 Sep"></textarea>
     ${guard.html}`,
    async v => {
      await api(`player/${p.id}/restore`, { method: 'POST', body: {
        snapshot_id: s.id, reason: v.querySelector('#qr').value, confirm: guard.get(v) } });
      openPlayer(p.id);
    }, 'Restore', true);
}

function changePassword() {
  modal('Change your password',
    `<label>Current password</label><input id="cp" type="password" autocomplete="current-password">
     <label>New password</label><input id="cn" type="password" autocomplete="new-password">
     <div class="note">At least 12 characters, with a letter and a number.
       Your other sessions will be signed out.</div>`,
    async v => {
      await api('password', { method: 'POST', body: {
        current: v.querySelector('#cp').value, new: v.querySelector('#cn').value } });
    }, 'Change it');
}

/* ---------- audit ---------- */
async function renderAudit() {
  loading();
  try {
    const d = await api('audit?q=' + encodeURIComponent(CACHE.auditTerm || ''));
    $('#view').innerHTML = `
      <div class="tools">
        <input id="asearch" placeholder="Filter by action, reason or player"
               value="${esc(CACHE.auditTerm || '')}">
        <button class="btn" id="ago">Filter</button>
        <span class="note">Newest first. These entries cannot be edited or removed from this console.</span>
      </div>
      <div class="card"><div class="scroll"><table>
        <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th>
          <th>Before</th><th>After</th><th>Reason</th></tr></thead>
        <tbody>${d.entries.map(e => `<tr>
          <td style="white-space:nowrap">${when(e.at)}</td>
          <td>${esc(e.admin || 'system')}</td>
          <td><b style="font-weight:600">${esc(e.action)}</b></td>
          <td>${e.target_name ? esc(e.target_name) + (e.target_id ? ` <span class="note">#${e.target_id}</span>` : '') : '—'}</td>
          <td class="mono">${esc(e.old ?? '—')}</td>
          <td class="mono">${esc(e.new ?? '—')}</td>
          <td>${esc(e.reason || '—')}</td>
        </tr>`).join('') || '<tr><td colspan="7" class="empty">Nothing logged yet.</td></tr>'}
        </tbody></table></div></div>`;
    const run = () => { CACHE.auditTerm = $('#asearch').value; renderAudit(); };
    $('#ago').onclick = run;
    $('#asearch').onkeydown = e => { if (e.key === 'Enter') run(); };
  } catch (err) { oops(err); }
}

/* ---------- administrators ---------- */
async function renderAdmins() {
  loading();
  try {
    const d = await api('admins');
    $('#view').innerHTML = `
      <div class="tools"><button class="btn primary" id="newAdmin">Add administrator</button></div>
      <div class="card"><div class="scroll"><table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last sign-in</th>
          <th>State</th><th></th></tr></thead>
        <tbody>${d.admins.map(a => `<tr>
          <td>${esc(a.name)}</td><td>${esc(a.email)}</td>
          <td><span class="pill info">${esc(a.role.replace('_',' '))}</span></td>
          <td>${a.last_login ? when(a.last_login) : 'never'}</td>
          <td>${!a.active ? '<span class="pill grey">Disabled</span>'
            : a.locked ? '<span class="pill bad">Locked</span>'
            : a.online ? '<span class="pill ok">Online</span>'
            : '<span class="pill grey">Offline</span>'}
            ${a.must_change ? '<span class="pill warn">Must change password</span>' : ''}
            ${a.mfa ? '<span class="pill ok">2FA</span>' : ''}</td>
          <td style="white-space:nowrap">
            ${a.id !== ME.id ? `<button class="btn sm" data-toggle="${a.id}"
              data-active="${a.active ? 1 : 0}">${a.active ? 'Disable' : 'Enable'}</button>` : ''}
            ${a.locked ? `<button class="btn sm" data-unlock="${a.id}">Unlock</button>` : ''}
          </td></tr>`).join('')}</tbody></table></div></div>
      <div class="card"><h3>What each role can do</h3><div class="body">
        <div class="note">Permissions are checked on the server for every request. Hiding a
          button in this page is a convenience, not a security control.</div>
        <div class="gap"></div>
        <dl class="kv">${Object.entries(CFG.permissions).map(([k, v]) =>
          `<dt><code>${esc(k)}</code></dt><dd style="font-family:var(--sans)">${esc(v)}</dd>`).join('')}</dl>
      </div></div>`;
    $('#newAdmin').onclick = () => modal('Add an administrator',
      `<label>Name</label><input id="an">
       <label>Email</label><input id="ae" type="email">
       <label>Role</label><select id="ar">${CFG.roles.map(r =>
         `<option value="${r}">${esc(r.replace('_',' '))}</option>`).join('')}</select>
       <label>Temporary password</label><input id="ap" type="password" autocomplete="new-password">
       <div class="note">They will have to replace this the first time they sign in.
         At least 12 characters, with a letter and a number.</div>`,
      async v => {
        await api('admins', { method: 'POST', body: {
          name: v.querySelector('#an').value, email: v.querySelector('#ae').value,
          role: v.querySelector('#ar').value, password: v.querySelector('#ap').value } });
        renderAdmins();
      }, 'Create');
    $('#view').querySelectorAll('[data-toggle]').forEach(b => b.onclick = () =>
      modal(b.dataset.active === '1' ? 'Disable this administrator' : 'Enable this administrator',
        `<div class="note">Disabling ends their sessions immediately.</div>
         <label>Reason</label><textarea id="tr"></textarea>`,
        async v => {
          await api('admins/' + b.dataset.toggle, { method: 'POST', body: {
            active: b.dataset.active !== '1', reason: v.querySelector('#tr').value } });
          renderAdmins();
        }, 'Confirm', b.dataset.active === '1'));
    $('#view').querySelectorAll('[data-unlock]').forEach(b => b.onclick = async () => {
      await api('admins/' + b.dataset.unlock, { method: 'POST', body: { unlock: true } });
      renderAdmins();
    });
  } catch (err) { oops(err); }
}

/* ---------- the parts that are not built ---------- */
const SOON = {
  support: ['Player bug reports', 'Needs a reports table plus an in-game form so players can file one. Nothing exists today.'],
  content: ['Characters and equipment CMS', 'Content lives in js/data.js and ships with the build. A CMS needs it moved into the database and read at runtime.'],
  minigames: ['Mini-game CMS with CSV import', 'Questions live in js/battle-data.js. Same move to the database, plus duplicate and answer validation.'],
  events: ['Events and announcements', 'Needs an events table and a client that polls for live modifiers and messages.'],
  economy: ['Economy, balance and versioned config', 'Needs the balance constants pulled out of js/data.js into versioned config rows with draft, publish and roll back.'],
  anticheat: ['Anti-cheat and risk scoring', 'Needs event-level history to compare against. Snapshots now give a baseline, so impossible jumps between saves become detectable over time.'],
  errors: ['Errors and background jobs', 'The server has no error store and no job runner; the game calculates idle progress in the client on load.'],
  backups: ['Backups, restore and maintenance mode', 'Per-player restore is live now under Players. Full database backups are handled by the hosting provider and are not visible to this app.'],
};

function renderSoon(key) {
  const [title, why] = SOON[key] || ['Not built yet', ''];
  $('#pageTitle').textContent = title;
  $('#view').innerHTML = `<div class="card"><h3>${esc(title)}</h3><div class="body">
    <div class="msg info">This section is not built. It is listed here so the plan is visible,
      not to imply it works.</div>
    <div class="note" style="margin-top:12px">${esc(why)}</div>
  </div></div>`;
}

/* ---------- start ---------- */
(async () => {
  try {
    const r = await api('me');
    ME = r.me;
    if (ME.must_change) return forcePassword();
    boot();
  } catch (e) { /* not signed in; the gate is already showing */ }
})();
</script></body></html>
"""
