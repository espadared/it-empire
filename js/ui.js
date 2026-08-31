/* ============================================================
   IT EMPIRE — UI LAYER
   Screen rendering, sheets, and all the juice.
   ============================================================ */
const UI = (() => {
  const $ = s => document.querySelector(s);
  const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = Game.fmt;
  let screen = 'hq';
  let sayTimer = null;
  let board = null, boardAt = 0;

  function loadBoard(force) {
    if (typeof Net === 'undefined' || !Net.online) return;
    if (!force && Date.now() - boardAt < 20000) return;
    boardAt = Date.now();
    Net.leaderboard().then(r => {
      if (r && r.ok) { board = r.players; if (screen === 'rank') renderRanking(); }
    }).catch(() => { });
  }

  const rarColor = r => DATA.RARITY[r].color;
  const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);

  /* ================= FX ================= */
  function floatText(x, y, text, color, size) {
    const n = el('div', 'float', esc(text));
    n.style.cssText = `left:${x}px;top:${y}px;color:${color};font-size:${size || 17}px`;
    $('#fx').appendChild(n);
    setTimeout(() => n.remove(), 1250);
  }
  function burstFloats(x, y, lines) {
    lines.forEach((l, i) => setTimeout(() => floatText(x + (i % 2 ? 34 : -34), y - i * 6, l.t, l.c, l.s), i * 110));
  }
  function coins(fromEl, n) {
    const tgt = $('#resCredits'); if (!fromEl || !tgt) return;
    const a = fromEl.getBoundingClientRect(), b = tgt.getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      const c = el('div', 'coin');
      const sx = a.left + a.width / 2 + (Math.random() - .5) * a.width * .7;
      const sy = a.top + a.height / 2;
      c.style.cssText = `left:${sx}px;top:${sy}px`;
      $('#fx').appendChild(c);
      c.animate([
        { transform: 'translate(0,0) scale(.5)', opacity: 0 },
        { transform: `translate(${(Math.random() - .5) * 90}px,${-40 - Math.random() * 50}px) scale(1.15)`, opacity: 1, offset: .3 },
        { transform: `translate(${b.left - sx + 10}px,${b.top - sy + 8}px) scale(.35)`, opacity: .9 }
      ], { duration: 620 + i * 40, easing: 'cubic-bezier(.4,0,.5,1)' }).onfinish = () => c.remove();
    }
  }
  function sparks(x, y, color, n) {
    for (let i = 0; i < (n || 10); i++) {
      const s = el('div', 'spark');
      const ang = Math.random() * Math.PI * 2, d = 30 + Math.random() * 60;
      s.style.cssText = `left:${x}px;top:${y}px;background:${color};--dx:${Math.cos(ang) * d}px;--dy:${Math.sin(ang) * d}px`;
      $('#fx').appendChild(s);
      setTimeout(() => s.remove(), 750);
    }
  }
  const shake = () => { const a = $('#app'); a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake'); setTimeout(() => a.classList.remove('shake'), 460); };
  function beep(kind) {                             // sound-effect hook (WebAudio, no assets)
    if (!window.SFX) return; try { window.SFX(kind); } catch (e) { }
  }

  /* ================= MODAL ================= */
  let modalStack = [];
  function sheet(html, opts = {}) {
    const m = $('#modal');
    m.innerHTML = `<div class="sheet">${opts.grab === false ? '' : '<div class="grab"></div>'}${html}</div>`;
    m.classList.add('on');
    m.onclick = e => { if (e.target === m && opts.dismiss !== false) closeSheet(); };
    return m.querySelector('.sheet');
  }
  function closeSheet() { $('#modal').classList.remove('on'); $('#modal').innerHTML = ''; }

  /* ================= TOP BAR ================= */
  function renderTop() {
    const S = Game.state, r = Game.rank(S.reputation);
    const need = Game.xpNeed(S.level);
    $('#lvlNum').textContent = S.level;
    $('#pName').textContent = S.name;
    $('#pTitle').textContent = Game.title(S.level).toUpperCase();
    $('#pRank').textContent = r.name;
    $('#resCredits').textContent = f(S.credits);
    $('#resRep').textContent = f(S.reputation);
    $('#xpFill').style.width = Math.min(100, S.xp / need * 100) + '%';
    $('#xpLbl').textContent = f(S.xp) + '/' + f(need);
    $('#enFill').style.width = Math.min(100, S.energy / S.energyMax * 100) + '%';
    $('#enLbl').textContent = Math.floor(S.energy) + '/' + S.energyMax;
    const alerts = (S.missions || []).filter(m => m.done && !m.claimed).length + (Game.incidentReady() ? 1 : 0);
    $('#bellDot').style.display = alerts ? 'block' : 'none';
    const nb = $('#navBadge');
    const mc = (S.missions || []).filter(m => m.done && !m.claimed).length;
    nb.style.display = mc ? 'grid' : 'none'; nb.textContent = mc;
  }

  /* ================= HQ ================= */
  function buildStage() {
    const c = Game.active(), d = Game.def(c.defId);
    $('#stage').innerHTML = Art.office() +
      `<div class="stage-chip" id="stageChips"></div>
       <div class="hero-shadow"></div>
       <div class="hero-wrap" id="heroWrap">${Art.hero(d.art, 'idle')}</div>
       <div class="hero-name" id="heroName"></div>
       <div class="hero-say" id="heroSay"></div>`;
    updateHero();
  }
  function updateHero() {
    const S = Game.state, c = Game.active(), d = Game.def(c.defId);
    $('#heroName').innerHTML =
      `<div class="n">${esc(c.defId === 'hero' ? S.name : d.name)}</div>
       <div class="r">${esc(c.defId === 'hero' ? Game.title(S.level) : d.role)} · LV.${c.level}</div>
       <div class="p">⚡ POWER ${f(Game.charPower(c))}</div>`;
    const rate = Game.idleRate();
    $('#heroSay').textContent = rate > 0
      ? `"The team is on it. ${rate.toFixed(1)} tickets a minute."`
      : `"Right. Who is first in the queue?"`;
    updateChips();
  }
  function say(t) {
    const n = $('#heroSay'); if (!n) return;
    n.textContent = t; n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop');
    clearTimeout(sayTimer);
    sayTimer = setTimeout(updateHero, 3800);
  }
  function updateChips() {
    const S = Game.state, box = $('#stageChips'); if (!box) return;
    let h = `<span class="chip live">● HELPDESK LIVE</span>`;
    if (S.event) h += `<span class="chip event">${S.event.icon} ${esc(S.event.title)} · ${Game.fmtTime((S.event.until - Date.now()) / 1000)}</span>`;
    box.innerHTML = h;
  }

  function updateTicket() {
    const S = Game.state, t = S.ticket; if (!t) return;
    const T = Game.TIER[t.tier], o = Game.odds();
    const cr = Math.round(T.credits * (1 + S.level * 0.17) * Game.bonus('reward') * Game.bonus('credit') * Game.bonus('cat_' + t.cat));
    const xp = Math.round(T.xp * (1 + S.level * 0.11) * Game.bonus('xp'));
    const rp = Math.round(T.rep * Game.bonus('rep'));
    $('#ticketCard').className = 'ticket' + (t.tier === 'HARD' ? ' crit' : '');
    $('#ticketCard').innerHTML = `
      <div class="tk-top">
        <span class="tag" style="color:${t.tier === 'HARD' ? 'var(--alarm)' : t.tier === 'MEDIUM' ? 'var(--lamp)' : 'var(--good)'}">${t.tier}</span>
        <span class="tk-id">#${t.id} · ${esc(t.user)}</span>
        <span class="tk-stars">${stars(T.stars)}</span>
      </div>
      <div class="tk-main">
        <div class="tk-icon">${t.icon}</div>
        <div class="tk-body">
          <h3 class="tk-name">${esc(t.name)}</h3>
          <p class="tk-flav">${esc(t.flavour)}</p>
          <div class="tk-meta">
            <span class="tag stat">${DATA.STAT_ICON[t.stat]} ${t.stat}</span>
            <span class="tag">${t.cat}</span>
            <span class="tag odds">${Math.round(o.tech * 100)}% SUCCESS</span>
          </div>
        </div>
      </div>
      <div class="tk-rewards">
        <b class="rw-c">+${f(cr)} CR</b><b class="rw-x">+${f(xp)} XP</b><b class="rw-r">+${rp} REP</b>
        <b class="muted" style="margin-left:auto">−${Math.round(T.energy * Game.bonus('energy'))} ⚡</b>
      </div>`;
    const cost = Math.round(T.energy * Game.bonus('energy'));
    const tired = S.energy < cost;
    const btn = $('#btnResolve');
    btn.className = 'resolve' + (tired ? ' tired' : '');
    btn.innerHTML = `🔧 RESOLVE TICKET<span class="sub">${tired ? 'RUNNING ON FUMES · 35% REWARDS' : t.tier + ' · ' + Math.round(o.tech * 100) + '% SUCCESS'}</span>`;
  }

  function updateMini() {
    const S = Game.state;
    const ready = Game.incidentReady();
    $('#miniRow').innerHTML = `
      <button class="mini ${ready ? 'hot' : ''}" data-act="incident">
        <i>🚨</i>INCIDENT<small>${ready ? 'ACTIVE NOW' : 'STANDBY ' + Game.fmtTime((S.incidentAt - Date.now()) / 1000)}</small></button>
      <button class="mini" data-act="go-staff"><i>👥</i>TEAM<small>${S.roster.length} ON SHIFT</small></button>
      <button class="mini" data-act="go-missions"><i>📋</i>MISSIONS<small>${(S.missions || []).filter(m => m.done && !m.claimed).length} READY</small></button>`;
  }

  function updateIdle() {
    const S = Game.state, per = Game.idlePerSec(), a = S.idleAcc, n = Game.staff().length;
    $('#idleStrip').innerHTML = n === 0 ? `
      <div class="idle-head"><span>🤖</span> AUTOMATED QUEUE</div>
      <p class="idle-note">Nobody is working the queue but you. Hire your first colleague on the <b>STAFF</b> tab and tickets keep closing while you are away.</p>
      <button class="btn teal" style="width:100%;margin-top:9px" data-act="go-staff">HIRE SOMEONE</button>` : `
      <div class="idle-head"><span class="live-dot"></span> AUTOMATED QUEUE · ${n} WORKING</div>
      <div class="idle-grid">
        <div class="idle-cell"><b>${Game.idleRate().toFixed(1)}</b><span>tickets/min</span></div>
        <div class="idle-cell"><b style="color:var(--lamp)">${f(per.c * 60)}</b><span>credits/min</span></div>
        <div class="idle-cell"><b style="color:var(--crt)">${f(per.x * 60)}</b><span>xp/min</span></div>
      </div>
      <p class="idle-note">Waiting for you: <b class="mono">${f(a.t)}</b> tickets · <b class="mono" style="color:var(--lamp)">${f(a.c)}</b> CR · <b class="mono" style="color:var(--crt)">${f(a.x)}</b> XP</p>
      <button class="collect" data-act="collect" ${a.c < 1 ? 'style="opacity:.5"' : ''}>COLLECT ${f(a.c)} CREDITS</button>`;
  }

  function updateBuildings() {
    const S = Game.state;
    $('#buildList').innerHTML = DATA.BUILDINGS.map(b => {
      const lv = S.buildings[b.id] || 0;
      const locked = S.reputation < b.repReq;
      const cost = Game.buildCost(b);
      const maxed = lv >= b.max;
      return `<div class="card" style="${locked ? 'opacity:.5' : ''}">
        <div class="avatar" style="display:grid;place-items:center;font-size:24px;background:var(--ink-2)">${b.icon}</div>
        <div class="who">
          <h3>${esc(b.name)} ${lv ? `<span class="mono" style="color:var(--lamp);font-size:11px">LV.${lv}</span>` : ''}</h3>
          <div class="role">${esc(b.effect)}</div>
          <div class="tiny mono" style="color:${locked ? 'var(--alarm)' : 'var(--muted)'};margin-top:3px">
            ${locked ? `🔒 NEEDS ${f(b.repReq)} REPUTATION` : maxed ? 'MAX LEVEL' : `💰 ${f(cost)}`}
          </div>
        </div>
        ${locked || maxed ? '' : `<button class="btn gold sm ${S.credits < cost ? 'off' : ''}" data-build="${b.id}">${lv ? 'UPGRADE' : 'BUILD'}</button>`}
      </div>`;
    }).join('');
  }

  const renderHQ = () => { updateTicket(); updateMini(); updateIdle(); updateBuildings(); updateChips(); };

  /* ================= STAFF ================= */
  function renderStaff() {
    const S = Game.state;
    const cards = S.roster.map(c => {
      const d = Game.def(c.defId), isActive = c.uid === S.activeId;
      const need = Game.charXpNeed(c.level), can = Game.canLevel(c);
      return `<div class="card col" data-char="${c.uid}" style="${isActive ? 'border-color:var(--lamp)' : ''}">
        <div class="row">
          <div class="avatar">${Art.portrait(d.art, c.uid)}<span class="lv">L${c.level}</span></div>
          <div class="who">
            <h3>${esc(c.defId === 'hero' ? S.name : d.name)}</h3>
            <div class="role">${esc(d.role)}${isActive ? ' · <b style="color:var(--lamp)">ON DUTY</b>' : c.dept ? ' · ' + esc(DATA.DEPARTMENTS.find(x => x.id === c.dept).name) : ''}</div>
            <span class="rar" style="color:${rarColor(c.rarity)};border:1px solid ${rarColor(c.rarity)}33;background:${rarColor(c.rarity)}18">${c.rarity}</span>
          </div>
          <div style="text-align:right">
            <div class="pw">⚡ ${f(Game.charPower(c))}</div>
            <div class="tiny muted mono">${isActive ? 'ACTIVE' : Game.staffRate(c).toFixed(1) + '/min'}</div>
          </div>
        </div>
        <div class="row" style="margin-top:9px">
          <div class="pbar" style="flex:1"><span style="width:${Math.min(100, c.xp / need * 100)}%"></span></div>
          <span class="tiny mono muted">${f(c.xp)}/${f(need)}</span>
          <button class="btn sm ${can ? 'teal' : 'off'}" data-levelup="${c.uid}">LV UP</button>
        </div>
      </div>`;
    }).join('');

    const hireable = DATA.CHARACTERS.filter(d => d.hireable).map(d => {
      const cost = Game.hireCost(d), locked = S.reputation < d.repReq, owned = S.roster.filter(c => c.defId === d.id).length;
      return `<div class="card" style="${locked ? 'opacity:.55' : ''}">
        <div class="avatar">${Art.portrait(d.art, 'h' + d.id)}</div>
        <div class="who">
          <h3>${esc(d.name)}</h3>
          <div class="role">${esc(d.role)}${owned ? ` · <span class="mono tiny">×${owned} hired</span>` : ''}</div>
          <div class="tiny" style="color:var(--good);margin-top:3px">＋ ${esc(d.strength)}</div>
          <div class="tiny" style="color:var(--alarm)">－ ${esc(d.weakness)}</div>
          <span class="rar" style="color:${rarColor(d.rarity)};border:1px solid ${rarColor(d.rarity)}33;background:${rarColor(d.rarity)}18">${d.rarity}</span>
        </div>
        <div style="text-align:right">
          ${locked ? `<div class="tiny mono" style="color:var(--alarm)">🔒 ${f(d.repReq)} REP</div>`
          : `<button class="btn gold sm ${S.credits < cost ? 'off' : ''}" data-hire="${d.id}">💰 ${f(cost)}</button>`}
        </div>
      </div>`;
    }).join('');

    $('#screen-staff').innerHTML = `
      <div class="sec-head"><h2>YOUR TEAM</h2><span>${S.roster.length} EMPLOYEES · ⚡${f(Game.teamPower())}</span></div>
      <p class="tiny muted" style="padding:0 14px 8px;margin:0">Tap anyone to open their file, fit them out and assign a department. Whoever is <b style="color:var(--lamp)">ON DUTY</b> resolves your tapped tickets — everyone else works the automated queue.</p>
      <div class="list">${cards}</div>
      <div class="sec-head"><h2>RECRUITMENT</h2><span>REP ${f(S.reputation)}</span></div>
      <div class="list">${hireable}</div>
      <div style="height:14px"></div>`;
  }

  function charSheet(uid) {
    const S = Game.state, c = S.roster.find(x => x.uid === uid); if (!c) return;
    const d = Game.def(c.defId), st = Game.charStats(c), need = Game.charXpNeed(c.level);
    const slotHtml = DATA.SLOTS.map(s => {
      const iu = c.equip[s.key], it = iu && S.inventory.find(i => i.uid === iu);
      const e = it && Game.eqDef(it.eid);
      return `<button class="slot ${it ? 'filled' : ''}" data-slot="${s.key}" data-for="${c.uid}"
        style="${e ? `border-color:${rarColor(e.rarity)}` : ''}">
        <div class="si">${e ? '🔧' : s.icon}</div>
        <div class="sn" style="${e ? `color:${rarColor(e.rarity)}` : ''}">${e ? esc(e.name.split(' ').slice(0, 2).join(' ')) : s.label}</div>
      </button>`;
    }).join('');
    const deptHtml = DATA.DEPARTMENTS.map(dp => {
      const locked = S.reputation < dp.repReq;
      return `<button class="btn sm ${c.dept === dp.id ? 'teal' : ''} ${locked ? 'off' : ''}" data-dept="${dp.id}" data-for="${c.uid}"
        style="flex:1;min-width:calc(50% - 4px)">${dp.icon} ${esc(dp.name)}${locked ? ' 🔒' : ''}</button>`;
    }).join('');

    sheet(`
      <div class="row" style="align-items:flex-start">
        <div class="avatar lg">${Art.portrait(d.art, 'sh' + c.uid)}<span class="lv">L${c.level}</span></div>
        <div class="who">
          <h3 style="font-size:18px;text-align:left">${esc(c.defId === 'hero' ? S.name : d.name)}</h3>
          <div class="role">${esc(d.role)}</div>
          <span class="rar" style="color:${rarColor(c.rarity)};border:1px solid ${rarColor(c.rarity)}33;background:${rarColor(c.rarity)}18">${c.rarity}</span>
          <div class="pw" style="margin-top:4px">⚡ POWER ${f(Game.charPower(c))}</div>
        </div>
      </div>
      <p class="tiny muted" style="margin:10px 0 0;font-style:italic">${esc(d.personality)}</p>
      <p class="tiny" style="color:var(--crt);margin:6px 0 0">${esc(d.quotes[Math.floor(Math.random() * d.quotes.length)])}</p>
      <div class="row" style="margin-top:10px;gap:6px">
        <div class="tiny" style="color:var(--good);flex:1">＋ ${esc(d.strength)}</div>
      </div>
      <div class="tiny" style="color:var(--alarm)">－ ${esc(d.weakness)}</div>

      <div class="statgrid">
        ${DATA.STATS.map(s => `<div class="statrow"><span>${DATA.STAT_ICON[s]}</span><span class="nm">${s}</span><b>${st[s]}</b></div>`).join('')}
      </div>

      <div class="row" style="margin-top:12px">
        <div class="pbar" style="flex:1"><span style="width:${Math.min(100, c.xp / need * 100)}%"></span></div>
        <span class="tiny mono muted">${f(c.xp)}/${f(need)} XP</span>
      </div>
      <button class="btn ${Game.canLevel(c) ? 'gold' : 'off'} cta" data-levelup="${c.uid}">
        LEVEL UP · 💰 ${f(Game.levelCost(c))}</button>
      ${c.uid === S.activeId ? '' : `<button class="btn teal cta" data-setactive="${c.uid}">PUT ON DUTY</button>`}

      <div class="sec-head" style="padding:14px 0 4px"><h2>EQUIPMENT</h2></div>
      <div class="slots">${slotHtml}</div>

      <div class="sec-head" style="padding:14px 0 4px"><h2>DEPARTMENT</h2></div>
      <div class="row" style="flex-wrap:wrap;gap:8px">${deptHtml}</div>
      <button class="btn ghost cta" data-close="1">CLOSE</button>
    `);
  }

  function pickItemSheet(charUid, slot) {
    const S = Game.state;
    const items = S.inventory.filter(i => Game.eqDef(i.eid).slot === slot);
    const c = S.roster.find(x => x.uid === charUid);
    const cur = c.equip[slot];
    sheet(`
      <h3>${DATA.SLOTS.find(s => s.key === slot).label.toUpperCase()}</h3>
      <p class="sub">Fitting out ${esc(c.defId === 'hero' ? S.name : Game.def(c.defId).name)}</p>
      ${cur ? `<button class="btn ghost cta" data-unequip="${slot}" data-for="${charUid}">REMOVE CURRENT</button>` : ''}
      <div class="list" style="padding:0;margin-top:10px">
        ${items.length ? items.map(i => {
      const e = Game.eqDef(i.eid);
      return `<div class="card col" data-equip="${i.uid}" data-for="${charUid}" style="border-color:${rarColor(e.rarity)}55">
            <div class="spread">
              <div><h3 style="font-family:var(--disp);font-size:14px;margin:0">${esc(e.name)}</h3>
              <span class="rar" style="color:${rarColor(e.rarity)}">${e.rarity} · LV.${i.level}</span></div>
              ${i.on === charUid ? '<span class="tiny" style="color:var(--good)">EQUIPPED</span>' : '<button class="btn teal sm">EQUIP</button>'}
            </div>
            <div class="tiny mono" style="margin-top:6px">${Object.entries(e.stats || {}).map(([k, v]) => `<span style="color:${v > 0 ? 'var(--crt)' : 'var(--alarm)'}">${v > 0 ? '+' : ''}${Math.round(v * (1 + (i.level - 1) * .25))} ${k}</span>`).join(' · ')}</div>
            <div class="tiny muted" style="margin-top:4px">${esc(e.effect)}</div>
          </div>`;
    }).join('') : `<div class="empty"><span class="big">🎒</span>No ${DATA.SLOTS.find(s => s.key === slot).label.toLowerCase()} in the store cupboard yet. Resolve tickets — gear drops.</div>`}
      </div>
      <button class="btn ghost cta" data-back="${charUid}">BACK</button>`);
  }

  /* ================= EQUIPMENT SCREEN ================= */
  function renderGear() {
    const S = Game.state;
    const sorted = [...S.inventory].sort((a, b) =>
      DATA.RARITY[Game.eqDef(b.eid).rarity].order - DATA.RARITY[Game.eqDef(a.eid).rarity].order || b.level - a.level);
    $('#screen-gear').innerHTML = `
      <div class="sec-head"><h2>STORE CUPBOARD</h2><span>${S.inventory.length} ITEMS</span></div>
      <p class="tiny muted" style="padding:0 14px 8px;margin:0">Gear drops from tickets and incidents. Upgrade it with credits, or scrap what you will never use.</p>
      <div class="list">${sorted.length ? sorted.map(i => {
      const e = Game.eqDef(i.eid), owner = i.on && S.roster.find(c => c.uid === i.on);
      const up = Game.upgradeCost(i);
      return `<div class="card col" style="border-color:${rarColor(e.rarity)}44">
          <div class="spread">
            <div style="min-width:0">
              <h3 style="font-family:var(--disp);font-size:14px;margin:0">${DATA.SLOTS.find(s => s.key === e.slot).icon} ${esc(e.name)}</h3>
              <span class="rar" style="color:${rarColor(e.rarity)};border:1px solid ${rarColor(e.rarity)}33;background:${rarColor(e.rarity)}14">${e.rarity} · LV.${i.level}</span>
              ${owner ? `<span class="tiny" style="color:var(--good);margin-left:6px">worn by ${esc(owner.defId === 'hero' ? S.name : Game.def(owner.defId).name)}</span>` : ''}
            </div>
          </div>
          <div class="tiny mono" style="margin-top:6px">${Object.entries(e.stats || {}).map(([k, v]) => `<span style="color:${v > 0 ? 'var(--crt)' : 'var(--alarm)'}">${v > 0 ? '+' : ''}${Math.round(v * (1 + (i.level - 1) * .25))} ${k}</span>`).join(' · ')}</div>
          <div class="tiny muted" style="margin-top:4px">${esc(e.effect)}</div>
          <div class="row" style="margin-top:8px">
            <button class="btn sm ${S.credits < up || i.level >= 10 ? 'off' : 'gold'}" data-upgrade="${i.uid}">${i.level >= 10 ? 'MAX' : 'UPGRADE 💰' + f(up)}</button>
            <button class="btn sm ghost" data-scrap="${i.uid}" style="margin-left:auto">SCRAP</button>
          </div>
        </div>`;
    }).join('') : `<div class="empty"><span class="big">🧰</span>The cupboard is empty. Resolve tickets and gear will turn up — the harder the ticket, the better the drop.</div>`}</div>
      <div style="height:14px"></div>`;
  }

  /* ================= MISSIONS ================= */
  function renderMissions() {
    const S = Game.state;
    const ms = (S.missions || []).map(m => {
      const cur = Math.min(m.target, S.md[m.metric] || 0);
      return `<div class="card col ${m.claimed ? 'ach' : ''}">
        <div class="mrow">
          <div class="ico">${m.icon}</div>
          <div class="txt">
            <h4>${esc(m.text)}</h4>
            <div class="prog"><div class="pbar ${m.done ? 'gold' : ''}"><span style="width:${cur / m.target * 100}%"></span></div>
              <span>${f(cur)}/${f(m.target)}</span></div>
          </div>
          ${m.claimed ? '<span class="tiny muted">DONE</span>'
          : m.done ? `<button class="btn gold sm" data-claim="${m.id}">CLAIM</button>`
            : '<span class="tiny muted mono">…</span>'}
        </div>
        <div class="rewrow">
          <span class="rw-c">+${f(m.reward.credits)} CR</span><span class="rw-x">+${f(m.reward.xp)} XP</span>
          <span class="rw-r">+${m.reward.rep} REP</span><span style="color:var(--lamp)">+${m.reward.energy} ⚡</span>
        </div>
      </div>`;
    }).join('');

    const ach = DATA.ACHIEVEMENTS.map(a => {
      const got = !!S.achievements[a.id], v = Game.metricValue(a.metric);
      return `<div class="card ach ${got ? 'got' : ''}">
        <div class="avatar" style="display:grid;place-items:center;font-size:22px;background:var(--ink-2)">${got ? '🏅' : '🔒'}</div>
        <div class="who"><h3>${esc(a.name)}</h3><div class="role">${esc(a.desc)}</div>
          <div class="prog" style="display:flex;align-items:center;gap:7px;margin-top:5px">
            <div class="pbar gold" style="flex:1"><span style="width:${Math.min(100, v / a.target * 100)}%"></span></div>
            <span class="tiny mono muted">${f(Math.min(v, a.target))}/${f(a.target)}</span></div>
        </div>
        <div class="tiny mono" style="color:var(--rep)">+${a.rep}</div>
      </div>`;
    }).join('');

    $('#screen-missions').innerHTML = `
      <div class="sec-head"><h2>DAILY MISSIONS</h2><span>RESETS IN ${Game.fmtTime((S.missionsAt - Date.now()) / 1000)}</span></div>
      <div class="list">${ms}</div>
      <div class="sec-head"><h2>ACHIEVEMENTS</h2><span>${Object.keys(S.achievements).length}/${DATA.ACHIEVEMENTS.length}</span></div>
      <div class="list">${ach}</div>
      <div style="height:14px"></div>`;
  }

  /* ================= RANKING ================= */
  function renderRanking() {
    const S = Game.state, r = Game.rank(S.reputation), nx = Game.nextRank(S.reputation);
    const L = S.lifetime;
    const ranks = DATA.RANKS.map(x => {
      const got = S.reputation >= x.at;
      return `<div class="card" style="${got ? '' : 'opacity:.5'}">
        <div class="avatar" style="display:grid;place-items:center;font-size:20px;background:var(--ink-2);border-color:${got ? 'var(--rep)' : 'var(--line)'}">${got ? '🏆' : '🔒'}</div>
        <div class="who"><h3>${esc(x.name)}</h3><div class="role">${esc(x.blurb)}</div></div>
        <div class="mono tiny" style="color:var(--rep)">${f(x.at)}</div>
      </div>`;
    }).join('');
    const titles = DATA.TITLES.map(t => `<div class="row" style="gap:8px;padding:5px 0">
      <span style="width:9px;height:9px;border-radius:50%;background:${S.level >= t.level ? 'var(--lamp)' : 'var(--line)'}"></span>
      <span class="tiny" style="color:${S.level >= t.level ? 'var(--text)' : 'var(--muted)'}">${esc(t.name)}</span>
      <span class="tiny mono muted" style="margin-left:auto">LV.${t.level}</span></div>`).join('');

    const legacy = DATA.LEGACY.map(l => {
      const cur = S.legacySpent[l.id] || 0;
      return `<div class="card">
        <div class="avatar" style="display:grid;place-items:center;font-size:20px;background:var(--ink-2)">${l.icon}</div>
        <div class="who"><h3>${esc(l.name)}</h3><div class="role">${esc(l.desc)}</div>
          <div class="tiny mono" style="color:var(--rep)">${cur}/${l.max}</div></div>
        <button class="btn sm ${S.legacy > 0 && cur < l.max ? 'teal' : 'off'}" data-legacy="${l.id}">+1</button>
      </div>`;
    }).join('');

    const me = (S.name || '').toLowerCase();
    const company = (typeof Net === 'undefined' || !Net.online) ? '' : `
      <div class="sec-head"><h2>THE COMPANY</h2><span>${board ? board.length + ' PLAYING' : 'LOADING…'}</span></div>
      <p class="tiny muted" style="padding:0 14px 8px;margin:0">Everyone signed in to this office, ranked by reputation. Send your friends the link and they will appear here.</p>
      <div class="list">${board ? (board.length ? board.map((p, i) => {
      const isMe = (p.name || '').toLowerCase() === me;
      const art = p.art || DATA.CHARACTERS[0].art;
      const sp = p.spec ? DATA.spec(p.spec) : null;
      return `<div class="card" style="${isMe ? 'border-color:var(--lamp)' : ''}">
          <div class="lb-pos ${i < 3 ? 'top' : ''}">${i + 1}</div>
          <div class="avatar">${Art.portrait(art, 'lb' + i)}<span class="lv">L${p.level}</span></div>
          <div class="who">
            <h3>${esc(p.name)}${isMe ? ' <span class="tiny" style="color:var(--lamp)">· YOU</span>' : ''}</h3>
            <div class="role">${esc(Game.title(p.level))}${sp ? ' · ' + esc(sp.name) : ''}</div>
            <div class="tiny mono muted">${f(p.tickets)} tickets resolved</div>
          </div>
          <div class="mono tiny" style="color:var(--rep);text-align:right">🏆 ${f(p.reputation)}</div>
        </div>`;
    }).join('') : '<div class="empty"><span class="big">👥</span>Nobody else has clocked in yet. You are employee number one.</div>')
      : '<div class="empty">Fetching the company directory…</div>'}</div>`;

    $('#screen-rank').innerHTML = company + `
      <div class="sec-head"><h2>REPUTATION</h2><span>${f(S.reputation)} REP</span></div>
      <div class="list"><div class="card col">
        <div class="spread"><h3 style="font-family:var(--disp);font-size:17px;margin:0;color:var(--rep)">${esc(r.name)}</h3>
        <span class="tiny mono muted">${nx ? 'NEXT ' + f(nx.at) : 'MAXIMUM'}</span></div>
        <p class="tiny muted" style="margin:4px 0 8px">${esc(r.blurb)}</p>
        <div class="pbar gold"><span style="width:${nx ? Math.min(100, (S.reputation - r.at) / (nx.at - r.at) * 100) : 100}%"></span></div>
      </div></div>
      <div class="list" style="margin-top:9px">${ranks}</div>

      <div class="sec-head"><h2>CAREER</h2><span>${esc(Game.title(S.level))}</span></div>
      <div class="list"><div class="card col">${titles}</div></div>

      <div class="sec-head"><h2>LIFETIME</h2></div>
      <div class="list"><div class="card col">
        <div class="statgrid">
          <div class="statrow"><span>🎫</span><span class="nm">TICKETS</span><b>${f(L.tickets)}</b></div>
          <div class="statrow"><span>💰</span><span class="nm">CREDITS EARNED</span><b>${f(L.credits)}</b></div>
          <div class="statrow"><span>🚨</span><span class="nm">INCIDENTS WON</span><b>${f(L.incidents)}</b></div>
          <div class="statrow"><span>😊</span><span class="nm">HAPPY USERS</span><b>${f(L.happy)}</b></div>
          <div class="statrow"><span>🔥</span><span class="nm">BEST STREAK</span><b>${f(L.streak)}</b></div>
          <div class="statrow"><span>🔄</span><span class="nm">REORGANISATIONS</span><b>${f(S.reorgs || 0)}</b></div>
        </div>
      </div></div>

      <div class="sec-head"><h2>IT REORGANISATION</h2><span>${f(S.legacy)} LEGACY</span></div>
      <div class="list"><div class="card col">
        <p class="tiny muted" style="margin:0 0 8px">Restructure the whole department. You lose your staff, office, credits and level — you keep achievements, unlocked people and <b style="color:var(--rep)">Legacy Points</b> that make every future run faster.</p>
        <button class="btn ${Game.reorgReady() ? 'gold' : 'off'} cta" data-act="reorg" style="margin:0">
          ${Game.reorgReady() ? `REORGANISE FOR +${Game.reorgGain()} LEGACY` : `UNLOCKS AT LEVEL 30 (YOU ARE ${S.level})`}</button>
      </div></div>
      <div class="list" style="margin-top:9px">${legacy}</div>
      <div style="height:14px"></div>`;
  }

  /* ================= WORLD ================= */
  function renderWorld() {
    const S = Game.state;
    $('#screen-world').innerHTML = `
      <div class="sec-head"><h2>GLOBAL OPERATIONS</h2><span>REP ${f(S.reputation)}</span></div>
      <p class="tiny muted" style="padding:0 14px 8px;margin:0">Every office runs its own queue, its own people and its own disasters. Build reputation at home first — head office is watching.</p>
      <div class="list">${DATA.WORLD.map(w => {
      const open = S.reputation >= w.repReq;
      return `<div class="card loc ${open ? 'open' : ''}">
          <div class="flag">${w.icon}</div>
          <div class="who"><h3>${esc(w.name)}</h3><div class="role">${esc(w.note)}</div></div>
          <div class="tiny mono" style="color:${open ? 'var(--good)' : 'var(--muted)'};text-align:right">
            ${w.repReq === 0 ? 'ACTIVE' : open ? 'READY<br><span style="color:var(--muted)">soon</span>' : '🔒 ' + f(w.repReq)}</div>
        </div>`;
    }).join('')}</div>
      <div class="sec-head"><h2>DEPARTMENTS</h2></div>
      <div class="list">${DATA.DEPARTMENTS.map(d => {
      const open = S.reputation >= d.repReq;
      const n = S.roster.filter(c => c.dept === d.id).length;
      return `<div class="card" style="${open ? '' : 'opacity:.5'}">
          <div class="avatar" style="display:grid;place-items:center;font-size:22px;background:var(--ink-2)">${d.icon}</div>
          <div class="who"><h3>${esc(d.name)}</h3><div class="role">${esc(d.bonus)}</div>
            <div class="tiny mono muted">${open ? n + ' assigned' : '🔒 ' + f(d.repReq) + ' REP'}</div></div>
        </div>`;
    }).join('')}</div>
      <div style="height:14px"></div>`;
  }

  /* ================= SCREEN SWITCH ================= */
  function show(name) {
    screen = name;
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === 'screen-' + name));
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.screen === name));
    refresh();
    $('#screens').scrollTop = 0;
  }

  function refresh() {
    renderTop();
    if (screen === 'hq') renderHQ();
    else if (screen === 'staff') renderStaff();
    else if (screen === 'gear') renderGear();
    else if (screen === 'missions') renderMissions();
    else if (screen === 'rank') { loadBoard(); renderRanking(); }
    else if (screen === 'world') renderWorld();
  }

  return { $, el, esc, sheet, closeSheet, floatText, burstFloats, coins, sparks, shake, beep,
           show, refresh, renderTop, renderHQ, buildStage, updateHero, updateTicket, updateMini,
           updateIdle, updateBuildings, updateChips, charSheet, pickItemSheet, say,
           loadBoard, get screen() { return screen; }, rarColor, stars };
})();
