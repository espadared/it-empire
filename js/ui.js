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
  /* Why the level-up button is not lit. An unexplained dead button reads as
     a bug; naming the missing piece turns it into a goal. */
  function levelBlocker(c) {
    if (Game.atMaxLevel(c)) return { what: 'max', text: `fully qualified — level ${DATA.MAX_CHAR_LEVEL} is as far as anyone goes` };
    const need = Game.charXpNeed(c.level), cost = Game.levelCost(c);
    if (c.xp < need) return { what: 'xp', text: `${f(need - c.xp)} more XP` };
    if (Game.state.credits < cost) return { what: 'credits', text: `💰${f(cost - Game.state.credits)} short` };
    return null;
  }
  const statLine = (e, i) => Object.entries(e.stats || {}).map(([k, v]) =>
    `<span style="color:${v > 0 ? 'var(--crt)' : 'var(--alarm)'}">${v > 0 ? '+' : ''}${Math.round(v * (1 + (i.level - 1) * .25))} ${k}</span>`).join(' · ');
  /* A ticket clock reads as m:ss once there are minutes on it. */
  const clock = secs => {
    const n = Math.max(0, Math.ceil(secs));
    return n >= 60 ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` : `${n}s`;
  };
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
  let paused = false;
  function sheet(html, opts = {}) {
    paused = !opts.live;               // a sheet stops the clock unless it IS the clock
    const m = $('#modal');
    m.innerHTML = `<div class="sheet">${opts.grab === false ? '' : '<div class="grab"></div>'}${html}</div>`;
    m.classList.add('on');
    m.onclick = e => { if (e.target === m && opts.dismiss !== false) closeSheet(); };
    return m.querySelector('.sheet');
  }
  function closeSheet() { paused = false; $('#modal').classList.remove('on'); $('#modal').innerHTML = ''; }
  const isPaused = () => paused && $('#modal').classList.contains('on');

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
    const left = Game.quotaLeft(), max = Game.quotaMax();
    $('#enFill').style.width = Math.min(100, left / max * 100) + '%';
    $('#enLbl').textContent = left ? left + '/' + max : Game.fmtTime(Game.quotaResetIn());
    $('#resAllow').classList.toggle('spent', !left);
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
      `<div class="meters" id="meters"></div>
       <div class="stage-chip" id="stageChips"></div>
       <div class="hero-shadow"></div>
       <div class="hero-wrap" id="heroWrap">${Art.hero(d.art, 'idle')}</div>
       <div class="hero-name" id="heroName"></div>
       <div class="hero-say" id="heroSay"></div>`;
    updateHero();
    updateMeters();
  }
  function updateHero() {
    const S = Game.state, c = Game.active(), d = Game.def(c.defId);
    $('#heroName').innerHTML =
      `<div class="n">${esc(c.defId === 'hero' ? S.name : d.name)}</div>
       <div class="r">${esc(c.defId === 'hero' ? Game.title(S.level) : d.role)} · LV.${c.level}</div>
       <div class="p">⚡ POWER ${f(Game.charPower(c))}</div>`;
    const rate = Game.idleRate();
    $('#heroSay').textContent = rate > 0
      ? `"Team's on the queue. ${rate.toFixed(1)} a minute."`
      : `"Right. Who is first?"`;
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

  /* ---------------- THE QUEUE ---------------- */
  function ticketRewards(t) {
    const S = Game.state, T = Game.TIER[t.tier];
    const m = Game.momentumMult() * Game.moraleMult();
    return {
      cr: Math.round(T.credits * (1 + S.level * 0.17) * Game.bonus('reward') * Game.bonus('credit') * Game.bonus('cat_' + t.cat) * m),
      xp: Math.round(T.xp * (1 + S.level * 0.11) * Game.bonus('xp') * Game.momentumMult()),
      rp: Math.round(T.rep * Game.bonus('rep')),
    };
  }

  function updateMeters() {
    const S = Game.state;
    const mo = Game.momentumMult(), pct = S.momentum / Game.MOMENTUM_MAX * 100;
    const box = $('#meters'); if (!box) return;
    box.innerHTML = `
      <div class="meter ${pct > 66 ? 'hot' : ''}">
        <span class="m-lbl">🔥</span>
        <div class="mbar"><span style="width:${pct}%"></span></div>
        <b>×${mo.toFixed(2)}</b>
      </div>
      <div class="meter">
        <span class="m-lbl">😊</span>
        <div class="mbar morale"><span style="width:${S.morale}%"></span></div>
        <b class="${S.morale < 35 ? 'bad' : ''}">${Math.round(S.morale)}%</b>
      </div>`;
  }

  function renderQueue() {
    const S = Game.state, box = $('#queue'); if (!box) return;
    Game.fillQueue();
    if (!Game.hasQuota()) {
      const per = Game.idlePerSec();
      box.innerHTML = `<div class="spent-card">
        <div class="spent-ico">🎫</div>
        <h3>THAT IS YOUR THIRTY</h3>
        <p>You have worked your allowance for this hour. The queue is frozen —
           nothing will breach while you are off the floor.</p>
        <div class="spent-clock">BACK IN <b>${Game.fmtTime(Game.quotaResetIn())}</b></div>
        ${Game.staff().length ? `<p class="spent-idle">Your team is still on it —
           about <b>${f(per.c * 3600)}</b> credits and <b>${f(per.x * 3600)}</b> XP
           banking up every hour while you are away.</p>`
        : `<p class="spent-idle">Hire a colleague on the <b>STAFF</b> tab and the
           queue keeps earning while your allowance refills.</p>`}
      </div>`;
      return;
    }
    if (nudged.size > 24) nudged.clear();
    box.innerHTML = S.queue.map((t, i) => {
      const T = Game.TIER[t.tier], r = ticketRewards(t);
      const puz = Game.needsDiagnosis(t);
      // For a puzzle ticket, show the odds you get for calling the cause
      // right — that is the number the player can actually act on.
      const o = Game.oddsFor(t, null, puz ? 1 : null);
      const frac = Math.max(0, t.left / t.sla);
      const urgent = t.left <= DATA.SLA_URGENT;
      const puzzle = puz;
      const free = Game.freeStaff().length;
      // only a genuinely new ticket slides in; a re-render must not replay
      // the entrance animation on cards the player is already looking at
      const isNew = !shown.has(t.uid);
      return `<article class="tk ${isNew ? 'fresh' : ''} ${urgent ? 'urgent' : ''} ${puz ? 'tricky' : ''} ${t.tier === 'HARD' ? 'hard' : ''}" data-tk="${t.uid}">
        <div class="tk-head">
          <span class="tier t-${t.tier}">${t.tier}</span>
          ${puz ? '<span class="tier tricky">🔍 TRICKY</span>' : ''}
          <span class="tag stat">${DATA.STAT_ICON[t.stat]} ${t.stat}</span>
          <span class="tag odds">${Math.round(o.tech * 100)}%</span>
          <span class="tk-clock ${urgent ? 'urgent' : ''}">${clock(t.left)}</span>
        </div>
        <div class="sla"><span style="width:${frac * 100}%"></span></div>
        <div class="tk-row">
          <div class="tk-ico">${t.icon}</div>
          <div class="tk-txt">
            <h3>${esc(t.name)}</h3>
            <p>${esc(t.clue)}</p>
          </div>
          <div class="tk-rw"><b class="rw-c">+${f(r.cr)}</b><b class="rw-x">+${f(r.xp)}</b></div>
        </div>
        <div class="tk-acts">
          <button class="act fix ${puzzle ? 'puzzle' : ''}" data-fix="${t.uid}">
            ${puzzle ? '🔍 DIAGNOSE' : '🔧 FIX IT'}</button>
          <button class="act del ${free ? '' : 'off'}" data-delegate="${t.uid}" title="Hand it to a colleague">
            👥<small>${free}</small></button>
          <button class="act esc" data-escalate="${t.uid}"
            title="Escalate away — costs ${Game.escalateCost(t.tier)} reputation">✕<small>−${Game.escalateCost(t.tier)}</small></button>
        </div>
      </article>`;
    }).join('');
    shown = new Set(S.queue.map(t => t.uid));
  }

  /* Only the numbers that move every frame — redrawing the whole queue at
     10fps would fight the player's thumb. A ticket that goes critical pulls
     itself into view, so nothing ever breaches somewhere you cannot see. */
  const nudged = new Set();
  let shown = new Set();          // which tickets have already animated in
  function tickQueueUI() {
    const S = Game.state;
    (S.queue || []).forEach(t => {
      const el = document.querySelector(`[data-tk="${t.uid}"]`);
      if (!el) return;
      const frac = Math.max(0, t.left / t.sla), urgent = t.left <= DATA.SLA_URGENT;
      const bar = el.querySelector('.sla > span');
      const clockEl = el.querySelector('.tk-clock');
      if (bar) bar.style.width = (frac * 100) + '%';
      if (clockEl) { clockEl.textContent = clock(t.left); clockEl.classList.toggle('urgent', urgent); }
      el.classList.toggle('urgent', urgent);
      if (urgent && !nudged.has(t.uid)) {
        nudged.add(t.uid);
        const r = el.getBoundingClientRect(), nav = document.querySelector('#nav').getBoundingClientRect();
        if (r.bottom > nav.top || r.top < 140) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
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

  const renderHQ = () => { updateMeters(); renderQueue(); updateMini(); updateIdle(); updateBuildings(); updateChips(); };

  /* ================= STAFF ================= */
  /* Two ways to look at the same people: a sortable roster, or the department
     board showing who is posted where. View and sort are per-device taste, so
     they live in localStorage rather than the save. */
  let staffView = 'list', staffSort = 'power', gearSort = 'rarity';
  try {
    staffView = localStorage.getItem('ie-staff-view') || 'list';
    staffSort = localStorage.getItem('ie-staff-sort') || 'power';
    gearSort = localStorage.getItem('ie-gear-sort') || 'rarity';
  } catch (e) { }
  function setStaffView(v) { staffView = v; try { localStorage.setItem('ie-staff-view', v); } catch (e) { } renderStaff(); }
  function setGearSort(v) { gearSort = v; try { localStorage.setItem('ie-gear-sort', v); } catch (e) { } renderGear(); }
  function setStaffSort(v) { staffSort = v; try { localStorage.setItem('ie-staff-sort', v); } catch (e) { } renderStaff(); }

  const SORTS = [
    { k: 'power', label: 'Power' },
    { k: 'output', label: 'Output' },
    { k: 'level', label: 'Level' },
    { k: 'dept', label: 'Dept' },
    { k: 'name', label: 'Name' },
  ];

  function sortedRoster() {
    const S = Game.state;
    const nameOf = c => c.defId === 'hero' ? S.name : Game.def(c.defId).name;
    const out = c => c.uid === S.activeId ? -1 : Game.staffOutput(c).credits;
    const list = [...S.roster];
    const cmp = {
      power: (a, b) => Game.charPower(b) - Game.charPower(a),
      level: (a, b) => b.level - a.level,
      output: (a, b) => out(b) - out(a),
      name: (a, b) => nameOf(a).localeCompare(nameOf(b)),
      dept: (a, b) => (a.dept || 'zz').localeCompare(b.dept || 'zz') || Game.charPower(b) - Game.charPower(a),
    }[staffSort] || (() => 0);
    // whoever is on duty always leads: they are the one you are playing
    return list.sort((a, b) =>
      (b.uid === S.activeId) - (a.uid === S.activeId) || cmp(a, b));
  }

  const deptChip = c => {
    const d = c.dept && Game.deptDef(c.dept);
    return d
      ? `<span class="dchip" style="border-color:${d.id === 'auto' ? 'var(--crt)' : 'var(--line)'}">${d.icon} ${esc(d.name)}</span>`
      : `<span class="dchip empty">＋ post to a department</span>`;
  };

  function staffCard(c) {
    const S = Game.state, d = Game.def(c.defId), isActive = c.uid === S.activeId;
    const need = Game.charXpNeed(c.level), can = Game.canLevel(c);
    const o = Game.staffOutput(c);
    const rank = Game.rankOf(c), role = Game.roleOf(c);
    const maxed = Game.atMaxLevel(c);
    return `<div class="card col staffcard" data-char="${c.uid}" style="${isActive ? 'border-color:var(--lamp)' : ''}">
      <div class="row">
        <div class="avatar lg">${Art.portrait(d.art, c.uid)}<span class="lv${maxed ? ' max' : ''}">L${c.level}</span></div>
        <div class="who">
          <h3>${esc(c.defId === 'hero' ? S.name : d.name)}</h3>
          <div class="rankline" style="color:${rank.colour}">${esc(rank.name)}${isActive ? ' · <b style="color:var(--lamp)">ON DUTY</b>' : ''}</div>
          <div class="badges">
            <span class="rolechip" style="color:${role.colour};border-color:${role.colour}44;background:${role.colour}14">${role.icon} ${role.name}</span>
            <span class="rar" style="color:${rarColor(c.rarity)};border:1px solid ${rarColor(c.rarity)}33;background:${rarColor(c.rarity)}18">${c.rarity}</span>
          </div>
        </div>
        <div style="text-align:right">
          <div class="pw">⚡ ${f(Game.charPower(c))}</div>
          <div class="tiny muted mono">${isActive ? 'your tickets' : f(o.credits * 3600) + ' cr/hr'}</div>
        </div>
      </div>
      <div class="tiny muted" style="margin-top:6px">${esc(role.perk)}</div>
      <button class="dchip-row" data-post="${c.uid}">${deptChip(c)}</button>
      <div class="row" style="margin-top:8px">
        <div class="pbar ${maxed ? 'gold' : ''}" style="flex:1"><span style="width:${maxed ? 100 : Math.min(100, c.xp / need * 100)}%"></span></div>
        <span class="tiny mono muted">${maxed ? 'MAX' : f(c.xp) + '/' + f(need)}</span>
        <button class="btn sm ${can ? 'teal' : 'off'}" data-levelup="${c.uid}">${maxed ? 'MAX' : 'LV UP'}</button>
      </div>
      ${can ? '' : `<div class="blocked">${esc(levelBlocker(c).text)}${maxed ? '' : ` to reach LV.${c.level + 1}`}</div>`}
    </div>`;
  }

  function deptBoard() {
    const S = Game.state;
    const unposted = S.roster.filter(c => !c.dept && c.uid !== S.activeId);
    return DATA.DEPARTMENTS.map(d => {
      const locked = S.reputation < d.repReq;
      const crew = Game.deptStaff(d.id);
      const contribution = crew.filter(c => c.uid !== S.activeId)
        .reduce((a, c) => a + (d.effect === 'credits' ? Game.staffOutput(c).credits * 3600
          : d.effect === 'reputation' ? Game.staffOutput(c).rep * 3600
            : Game.staffOutput(c).rate * 60), 0);
      const unit = d.effect === 'credits' ? 'cr/hr' : d.effect === 'reputation' ? 'rep/hr' : 'tickets/hr';
      return `<div class="dept ${locked ? 'locked' : ''}">
        <div class="dept-head">
          <span class="dept-ico">${d.icon}</span>
          <div style="flex:1;min-width:0">
            <h3>${esc(d.name)}</h3>
            <div class="dept-bonus">${esc(d.bonus)} · leans on ${DATA.STAT_ICON[d.stat]} ${d.stat}</div>
          </div>
          ${locked ? `<span class="tiny mono" style="color:var(--alarm)">🔒 ${f(d.repReq)}</span>`
          : `<span class="dept-out">${f(contribution)}<small>${unit}</small></span>`}
        </div>
        <p class="dept-blurb">${esc(d.blurb)}</p>
        <div class="dept-crew">
          ${crew.length ? crew.map(c => {
        const cd = Game.def(c.defId);
        const fit = Game.deptFit(c, d);
        return `<button class="crew" data-post="${c.uid}" title="${esc(cd.name)}">
              <div class="avatar" style="width:40px;height:40px">${Art.portrait(cd.art, 'd' + d.id + c.uid)}</div>
              <div class="crew-fit ${fit >= 1.4 ? 'good' : fit < 0.8 ? 'poor' : ''}">${fit.toFixed(1)}×</div>
            </button>`;
      }).join('') : `<div class="dept-empty">Nobody posted here</div>`}
        </div>
        ${locked ? '' : `<button class="btn sm ${unposted.length ? 'teal' : 'ghost'}" data-deptfill="${d.id}" style="width:100%;margin-top:8px">POST SOMEONE HERE</button>`}
      </div>`;
    }).join('');
  }

  function renderStaff() {
    const S = Game.state;
    const idle = Game.idlePerSec();
    const posted = S.roster.filter(c => c.dept && c.uid !== S.activeId).length;
    const workers = Game.staff().length;

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
          : Game.atCapacity() ? `<div class="tiny mono" style="color:var(--alarm)">NO DESK FREE</div>`
          : `<button class="btn gold sm ${S.credits < cost ? 'off' : ''}" data-hire="${d.id}">💰 ${f(cost)}</button>`}
        </div>
      </div>`;
    }).join('');

    const ch = Game.chapter(), objs = Game.chapterProgress();
    const canPromote = Game.canPromoteChapter();
    const cap = Game.capacity(), grade = Game.deptGrade();

    const chapterPanel = `
      <div class="chapter ${canPromote ? 'ready' : ''}">
        <div class="chapter-top">
          <span class="chapter-ico">${ch.icon}</span>
          <div style="flex:1;min-width:0">
            <div class="chapter-n">CHAPTER ${ch.n} OF ${DATA.CHAPTERS.length}</div>
            <h3>${esc(ch.name)}</h3>
          </div>
          <div class="chapter-caps">
            <div>staff to <b>L${Game.maxStaffLevel()}</b></div>
            <div><b>${cap}</b> desks</div>
          </div>
        </div>
        <p class="chapter-goal">${esc(ch.goal)}</p>
        <div class="objs">${objs.map(o => `
          <div class="obj ${o.done ? 'done' : ''}">
            <span class="obj-tick">${o.done ? '✓' : ''}</span>
            <div style="flex:1;min-width:0">
              <div class="obj-text">${esc(o.text)}</div>
              <div class="pbar" style="margin-top:4px"><span style="width:${Math.min(100, o.have / o.target * 100)}%"></span></div>
            </div>
            <span class="obj-n">${f(Math.min(o.have, o.target))}/${f(o.target)}</span>
          </div>`).join('')}</div>
        ${ch.unlocks ? `<p class="chapter-next">Next: ${esc(ch.unlocks)}</p>` : '<p class="chapter-next">The last chapter. Everything from here is yours to run.</p>'}
        ${canPromote ? `<button class="btn gold cta" data-promote="1" style="margin-top:10px">PROMOTE THE DEPARTMENT</button>` : ''}
      </div>`;

    $('#screen-staff').innerHTML = `
      <div class="teamhead">
        <div class="th-main">
          <div class="th-lbl">TEAM POWER</div>
          <div class="th-power">${f(Game.teamPowerTotal())}</div>
        </div>
        <div class="th-side">
          <div class="th-stat"><b class="${S.roster.length >= cap ? 'full' : ''}">${S.roster.length}/${cap}</b><span>STAFF</span></div>
          <div class="th-stat"><b class="grade g-${grade}">${grade}</b><span>DEPT RANK</span></div>
        </div>
      </div>
      <div class="teamstats">
        <div><b>${f(idle.t * 3600)}</b><span>tickets/hr</span></div>
        <div><b>${Math.round(S.morale)}%</b><span>morale</span></div>
        <div><b>${f(idle.c * 3600)}</b><span>credits/hr</span></div>
      </div>
      ${(() => {
        const sp = Game.roleSpread();
        const have = new Set(S.roster.map(c => Game.roleOf(c).key));
        return `<div class="spread-strip ${sp.complete ? 'full' : ''}">
          <div class="spread-roles">
            ${Object.values(DATA.ROLES).map(r => `<span class="rdot ${have.has(r.key) ? 'on' : ''}"
              style="${have.has(r.key) ? `color:${r.colour};border-color:${r.colour}55;background:${r.colour}14` : ''}"
              title="${esc(r.name)}">${r.icon}</span>`).join('')}
          </div>
          <div class="spread-txt">
            <b>${sp.roles}/${sp.of} roles covered</b>
            <span>${sp.complete ? 'full cover — +25% bonus on top' : 'a department that can do everything earns more'}</span>
          </div>
          <div class="spread-mult">×${sp.mult.toFixed(2)}</div>
        </div>`;
      })()}
      ${chapterPanel}
      <div class="sec-head"><h2>YOUR TEAM</h2><span>${workers} ON THE QUEUE · ${posted} POSTED</span></div>
      <div class="seg" style="margin:0 12px 10px">
        <button class="seg-btn ${staffView === 'list' ? 'on' : ''}" data-sview="list">BY PERSON</button>
        <button class="seg-btn ${staffView === 'dept' ? 'on' : ''}" data-sview="dept">BY DEPARTMENT</button>
      </div>

      <div class="idle-summary">
        <div><b>${f(idle.c * 3600)}</b><span>credits/hr</span></div>
        <div><b>${f(idle.t * 3600)}</b><span>tickets/hr</span></div>
        <div><b>${f(idle.r * 3600)}</b><span>rep/hr</span></div>
      </div>

      ${staffView === 'dept' ? `
        <p class="tiny muted" style="padding:8px 14px 8px;margin:0">Post people where their strengths land. The number under a portrait is their fit — a specialist in the right department is worth roughly double one who is merely present.</p>
        <div class="dept-list">${deptBoard()}</div>
        ${S.roster.filter(c => !c.dept && c.uid !== S.activeId).length
        ? `<div class="sec-head"><h2>UNPOSTED</h2><span>EARNING LESS THAN THEY COULD</span></div>
             <div class="list">${S.roster.filter(c => !c.dept && c.uid !== S.activeId).map(staffCard).join('')}</div>` : ''}
      ` : `
        <div class="sortbar">
          <span class="sortbar-lbl">SORT</span>
          ${SORTS.map(o => `<button class="sortchip ${staffSort === o.k ? 'on' : ''}" data-ssort="${o.k}">${o.label}</button>`).join('')}
        </div>
        <div class="list">${sortedRoster().map(staffCard).join('')}</div>
      `}

      <div class="sec-head"><h2>RECRUITMENT</h2><span>${S.roster.length}/${cap} DESKS USED</span></div>
      ${Game.atCapacity() ? `<p class="tiny" style="padding:0 14px 8px;margin:0;color:var(--lamp)">Every desk is taken. Retire somebody, or promote the department for more room.</p>` : ''}
      <div class="list">${hireable}</div>
      <div style="height:14px"></div>`;
  }

  /* Choosing who goes where — from either direction. */
  function postSheet(charUid) {
    const S = Game.state, c = S.roster.find(x => x.uid === charUid); if (!c) return;
    const d = Game.def(c.defId);
    sheet(`
      <div class="row" style="align-items:center;gap:10px">
        <div class="avatar">${Art.portrait(d.art, 'ps' + c.uid)}<span class="lv">L${c.level}</span></div>
        <div class="who"><h3 style="text-align:left">${esc(c.defId === 'hero' ? S.name : d.name)}</h3>
          <div class="role">${esc(d.role)}</div></div>
      </div>
      <p class="sub" style="margin-top:12px">Where should they be posted?</p>
      ${c.uid === S.activeId ? '<p class="tiny muted" style="text-align:center;margin:-6px 0 8px">They are on duty, so they work your tapped tickets. A posting applies the moment somebody else takes over.</p>' : ''}
      ${DATA.DEPARTMENTS.map(dp => {
      const locked = S.reputation < dp.repReq, fit = Game.deptFit(c, dp), on = c.dept === dp.id;
      return `<button class="postopt ${on ? 'on' : ''} ${locked ? 'off' : ''}" ${locked ? '' : `data-assign="${dp.id}" data-who="${c.uid}"`}>
          <span class="dept-ico">${dp.icon}</span>
          <div style="flex:1;min-width:0">
            <h4>${esc(dp.name)}${on ? ' · POSTED' : ''}</h4>
            <div class="tiny muted">${esc(dp.bonus)}</div>
          </div>
          ${locked ? `<span class="tiny mono" style="color:var(--alarm)">🔒 ${f(dp.repReq)}</span>`
          : `<span class="fitbadge ${fit >= 1.4 ? 'good' : fit < 0.8 ? 'poor' : ''}">${fit.toFixed(1)}×<small>fit</small></span>`}
        </button>`;
    }).join('')}
      ${c.dept ? `<button class="btn ghost cta" data-assign="" data-who="${c.uid}">UNPOST THEM</button>` : ''}
      <button class="btn ghost cta" data-close="1">CLOSE</button>`);
  }

  function fillDeptSheet(deptId) {
    const S = Game.state, dp = Game.deptDef(deptId); if (!dp) return;
    const pool = S.roster.filter(c => c.dept !== deptId)
      .sort((a, b) => Game.deptFit(b, dp) - Game.deptFit(a, dp));
    sheet(`
      <span class="big-emoji">${dp.icon}</span>
      <h3>${esc(dp.name)}</h3>
      <p class="sub">${esc(dp.bonus)} · best suited first</p>
      ${pool.length ? pool.map(c => {
      const d = Game.def(c.defId), fit = Game.deptFit(c, dp);
      return `<button class="postopt" data-assign="${deptId}" data-who="${c.uid}">
          <div class="avatar" style="width:42px;height:42px">${Art.portrait(d.art, 'fd' + c.uid)}</div>
          <div style="flex:1;min-width:0">
            <h4>${esc(c.defId === 'hero' ? S.name : d.name)}</h4>
            <div class="tiny muted">${esc(d.role)}${c.dept ? ' · now in ' + esc(Game.deptDef(c.dept).name) : ''}</div>
          </div>
          <span class="fitbadge ${fit >= 1.4 ? 'good' : fit < 0.8 ? 'poor' : ''}">${fit.toFixed(1)}×<small>fit</small></span>
        </button>`;
    }).join('') : '<div class="empty">Everyone is already posted here.</div>'}
      <button class="btn ghost cta" data-close="1">CLOSE</button>`);
  }

  function charSheet(uid) {
    const S = Game.state, c = S.roster.find(x => x.uid === uid); if (!c) return;
    const d = Game.def(c.defId), st = Game.charStats(c), need = Game.charXpNeed(c.level);
    const issued = Game.standardItems().length;
    const slotHtml = DATA.SLOTS.map(sl => {
      const it = Game.standardItem(sl.key);
      const e = it && Game.eqDef(it.eid);
      return `<div class="slot ${it ? 'filled' : ''}" style="${e ? `border-color:${rarColor(e.rarity)}` : ''}">
        <div class="si">${sl.icon}</div>
        <div class="sn" style="${e ? `color:${rarColor(e.rarity)}` : ''}">${e ? esc(e.name.split(' ').slice(0, 2).join(' ')) : sl.label}</div>
      </div>`;
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
        <div class="pbar ${Game.atMaxLevel(c) ? 'gold' : ''}" style="flex:1"><span style="width:${Game.atMaxLevel(c) ? 100 : Math.min(100, c.xp / need * 100)}%"></span></div>
        <span class="tiny mono muted">${Game.atMaxLevel(c) ? 'MAX LEVEL' : f(c.xp) + '/' + f(need) + ' XP'}</span>
      </div>
      ${Game.atMaxLevel(c)
        ? `<div class="maxed">🎓 FULLY QUALIFIED · LEVEL ${DATA.MAX_CHAR_LEVEL}</div>`
        : `<button class="btn ${Game.canLevel(c) ? 'gold' : 'off'} cta" data-levelup="${c.uid}">
        LEVEL UP · 💰 ${f(Game.levelCost(c))}</button>`}
      ${Game.canLevel(c) || Game.atMaxLevel(c) ? '' : `<div class="blocked">Still needs ${esc(levelBlocker(c).text)}. They earn XP from every ticket you work and from the automated queue — collect on the HQ tab.</div>`}
      ${c.uid === S.activeId ? '' : `<button class="btn teal cta" data-setactive="${c.uid}">PUT ON DUTY</button>`}
      ${c.defId === 'hero' || S.roster.length <= 1 ? '' : (() => {
        const v = Game.retireValue(c);
        return `<button class="btn ghost cta" data-retire="${c.uid}" style="color:var(--muted)">
          RETIRE · frees a desk, returns 💰${f(v.credits)}${v.legacy ? ' + ' + v.legacy + ' legacy' : ''}</button>`;
      })()}

      <div class="sec-head" style="padding:14px 0 4px"><h2>STANDARD ISSUE</h2>
        <span>${issued}/${DATA.SLOTS.length} FITTED</span></div>
      <p class="tiny muted" style="margin:0 0 4px">Everyone in the department carries the same kit — these stats are already counted above. Change it on the <b>GEAR</b> tab and it changes for all of them.</p>
      <div class="slots">${slotHtml}</div>
      <button class="btn ghost cta" data-screen="gear">OPEN STANDARD ISSUE</button>

      <div class="sec-head" style="padding:14px 0 4px"><h2>DEPARTMENT</h2></div>
      <div class="row" style="flex-wrap:wrap;gap:8px">${deptHtml}</div>
      <button class="btn ghost cta" data-close="1">CLOSE</button>
    `);
  }

  /* One slot of the standard. If something is fitted you can level it here
     rather than hunting for it in the cupboard. */
  function pickItemSheet(slot) {
    const S = Game.state;
    const label = DATA.SLOTS.find(s2 => s2.key === slot);
    const cur = Game.standardItem(slot);
    const curDef = cur && Game.eqDef(cur.eid);
    const items = S.inventory.filter(i => Game.eqDef(i.eid).slot === slot && (!cur || i.uid !== cur.uid))
      .sort((a, b) => DATA.RARITY[Game.eqDef(b.eid).rarity].order - DATA.RARITY[Game.eqDef(a.eid).rarity].order || b.level - a.level);
    const up = cur ? Game.upgradeCost(cur) : 0;
    const maxed = cur && cur.level >= 10;

    sheet(`
      <h3>${label.icon} ${label.label.toUpperCase()}</h3>
      <p class="sub">Standard issue — whatever is fitted here, everybody carries</p>

      ${cur ? `
        <div class="fitted" style="border-color:${rarColor(curDef.rarity)}55">
          <div class="fitted-top">
            <div style="flex:1;min-width:0">
              <h4>${esc(curDef.name)}</h4>
              <span class="rar" style="color:${rarColor(curDef.rarity)};border:1px solid ${rarColor(curDef.rarity)}33;background:${rarColor(curDef.rarity)}14">${curDef.rarity}</span>
            </div>
            <div class="fitted-lv"><b>LV.${cur.level}</b><small>of 10</small></div>
          </div>
          <div class="lvbar"><span style="width:${cur.level / 10 * 100}%"></span></div>
          <div class="tiny mono" style="margin-top:8px">${statLine(curDef, cur)}</div>
          <div class="tiny muted" style="margin-top:4px">${esc(curDef.effect)}</div>
          ${maxed ? '<div class="maxed" style="margin-top:10px">🎓 FULLY UPGRADED</div>'
        : `<button class="btn ${S.credits >= up ? 'gold' : 'off'} cta" data-upgrade="${cur.uid}" data-inslot="${slot}">
              LEVEL UP TO ${cur.level + 1} · 💰 ${f(up)}</button>
            ${S.credits >= up ? '' : `<div class="blocked">💰${f(up - S.credits)} short</div>`}`}
          <button class="btn ghost cta" data-withdraw="${slot}">WITHDRAW FROM STANDARD</button>
        </div>`
      : '<p class="tiny muted" style="text-align:center;margin:14px 0">Nothing fitted in this slot yet.</p>'}

      ${items.length ? `<div class="sec-head" style="padding:16px 0 4px"><h2>SWAP FOR</h2></div>
        <div class="list" style="padding:0">${items.map(i => {
          const e = Game.eqDef(i.eid);
          return `<div class="card col" data-issue="${i.uid}" style="border-color:${rarColor(e.rarity)}44">
            <div class="spread">
              <div style="min-width:0"><h3 style="font-family:var(--disp);font-size:14px;margin:0">${esc(e.name)}</h3>
              <span class="rar" style="color:${rarColor(e.rarity)}">${e.rarity} · LV.${i.level}</span></div>
              <button class="btn teal sm">ISSUE</button>
            </div>
            <div class="tiny mono" style="margin-top:6px">${statLine(e, i)}</div>
          </div>`;
        }).join('')}</div>`
      : (cur ? '' : `<div class="empty"><span class="big">🎒</span>No ${label.label.toLowerCase()} in the cupboard. Procure one on the GEAR tab.</div>`)}
      <button class="btn ghost cta" data-close="1">DONE</button>`);
  }

  /* Three focused views rather than one very long scroll. */
  let gearView = 'cupboard', gearFilter = 'all', gearRarity = 'all';
  let picking = false;
  const picked = new Set();
  try { gearView = localStorage.getItem('ie-gear-view') || 'cupboard'; } catch (e) { }
  function setGearView(v) {
    gearView = v; picking = false; picked.clear();
    try { localStorage.setItem('ie-gear-view', v); } catch (e) { }
    renderGear();
  }
  function setGearFilter(v) { gearFilter = v; renderGear(); }
  function setGearRarity(v) { gearRarity = v; renderGear(); }
  function togglePicking() { picking = !picking; picked.clear(); renderGear(); }
  function togglePick(uid) {
    if (picked.has(uid)) picked.delete(uid); else picked.add(uid);
    renderGear();
  }
  function pickAll(uids) {
    const all = uids.every(u => picked.has(u));
    uids.forEach(u => all ? picked.delete(u) : picked.add(u));
    renderGear();
  }
  const pickedList = () => [...picked];

  function itemCard(i, opts = {}) {
    const S = Game.state, e = Game.eqDef(i.eid), on = Game.isStandard(i.uid);
    const up = Game.upgradeCost(i);
    const sel = picked.has(i.uid);
    return `<div class="card col item ${sel ? 'picked' : ''}" style="border-color:${on ? rarColor(e.rarity) : sel ? 'var(--crt)' : 'var(--line)'}"
      ${picking ? `data-pick="${i.uid}"` : ''}>
      <div class="spread">
        <div style="min-width:0;display:flex;gap:9px;align-items:flex-start">
          ${picking ? `<span class="tick ${sel ? 'on' : ''}">${sel ? '✓' : ''}</span>` : ''}
          <div style="min-width:0">
            <h3 style="font-family:var(--disp);font-size:14px;margin:0">${DATA.SLOTS.find(s2 => s2.key === e.slot).icon} ${esc(e.name)}</h3>
            <span class="rar" style="color:${rarColor(e.rarity)};border:1px solid ${rarColor(e.rarity)}33;background:${rarColor(e.rarity)}14">${e.rarity} · LV.${i.level}</span>
            ${on ? '<span class="tiny" style="color:var(--good);margin-left:6px">ISSUED</span>' : ''}
          </div>
        </div>
      </div>
      <div class="tiny mono" style="margin-top:6px">${statLine(e, i)}</div>
      <div class="tiny muted" style="margin-top:4px">${esc(e.effect)}</div>
      ${picking ? '' : `<div class="row" style="margin-top:8px">
        <button class="btn sm ${S.credits < up || i.level >= 10 ? 'off' : 'gold'}" data-upgrade="${i.uid}">${i.level >= 10 ? 'MAX' : 'UPGRADE 💰' + f(up)}</button>
        ${on ? `<button class="btn sm ghost" data-withdraw="${e.slot}">WITHDRAW</button>`
        : `<button class="btn sm teal" data-issue="${i.uid}">MAKE STANDARD</button>`}
        <button class="btn sm ghost" data-dispose="${i.uid}" style="margin-left:auto">DISPOSE 💰${f(Game.disposeValue(i))}</button>
      </div>`}
    </div>`;
  }

  function renderGear() {
    const S = Game.state;
    const issued = Game.standardItems().length;
    const screen$ = $('#screen-gear'); if (!screen$) return;

    const tabs = `<div class="seg" style="margin:12px 12px 10px">
      ${[['standard', 'STANDARD'], ['cupboard', 'CUPBOARD'], ['procure', 'PROCURE']]
        .map(([k, l]) => `<button class="seg-btn ${gearView === k ? 'on' : ''}" data-gview="${k}">${l}</button>`).join('')}
    </div>`;

    /* --- what everyone carries --- */
    if (gearView === 'standard') {
      const rack = DATA.SLOTS.map(sl => {
        const it = Game.standardItem(sl.key);
        const e = it && Game.eqDef(it.eid);
        return `<button class="issue-slot ${it ? 'filled' : ''}" data-slot="${sl.key}"
          style="${e ? `border-color:${rarColor(e.rarity)}` : ''}">
          <div class="is-ico">${sl.icon}</div>
          <div class="is-lbl">${sl.label}</div>
          <div class="is-item" style="${e ? `color:${rarColor(e.rarity)}` : ''}">${e ? esc(e.name) : 'not issued'}</div>
          ${e ? `<div class="is-lv">LV.${it.level}</div>` : ''}
        </button>`;
      }).join('');
      screen$.innerHTML = `
        <div class="sec-head"><h2>STANDARD ISSUE</h2><span>${issued}/${DATA.SLOTS.length} FITTED</span></div>
        ${tabs}
        <p class="tiny muted" style="padding:0 14px 8px;margin:0">Every technician in the department carries this, you included. Tap a slot to change what the standard is.</p>
        <div class="issue-rack">${rack}</div>
        <div class="list" style="margin-top:10px"><div class="card">
          <div class="avatar" style="display:grid;place-items:center;font-size:22px;background:var(--ink-2)">🏷️</div>
          <div class="who"><h3>Kit rating</h3><div class="role">Every point lands on every member of staff</div></div>
          <div class="pw">⚡ ${f(Game.standardPower())}</div>
        </div></div>
        <div style="height:14px"></div>`;
      return;
    }

    /* --- what finance will buy --- */
    if (gearView === 'procure') {
      const pool = DATA.EQUIPMENT
        .filter(e => gearFilter === 'all' || e.slot === gearFilter)
        .filter(e => S.reputation >= DATA.PROCURE.repReq[e.rarity])
        .sort((a, b) => DATA.RARITY[b.rarity].order - DATA.RARITY[a.rarity].order);
      const locked = DATA.EQUIPMENT.filter(e => S.reputation < DATA.PROCURE.repReq[e.rarity]);
      const nextTier = locked.sort((a, b) => DATA.PROCURE.repReq[a.rarity] - DATA.PROCURE.repReq[b.rarity])[0];
      screen$.innerHTML = `
        <div class="sec-head"><h2>PROCURE</h2><span>${DATA.EQUIPMENT.filter(e => !Game.ownsItem(e.id)).length} STILL TO OWN</span></div>
        ${tabs}
        <div class="sortbar">
          <button class="sortchip ${gearFilter === 'all' ? 'on' : ''}" data-gfilter="all">All</button>
          ${DATA.SLOTS.map(sl => `<button class="sortchip ${gearFilter === sl.key ? 'on' : ''}" data-gfilter="${sl.key}">${sl.icon}</button>`).join('')}
        </div>
        <div class="list">${pool.length ? pool.map(e => {
        const price = Game.procurePrice(e.id), afford = S.credits >= price;
        const owned = Game.ownsItem(e.id);
        return `<div class="card col ${owned ? 'owned' : ''}" style="border-color:${owned ? 'var(--good)' : rarColor(e.rarity) + '33'}">
            <div class="spread">
              <div style="min-width:0">
                <h3 style="font-family:var(--disp);font-size:14px;margin:0">${DATA.SLOTS.find(s2 => s2.key === e.slot).icon} ${esc(e.name)}</h3>
                <span class="rar" style="color:${rarColor(e.rarity)};border:1px solid ${rarColor(e.rarity)}33;background:${rarColor(e.rarity)}14">${e.rarity}</span>
              </div>
              ${owned ? '<span class="ownedtag">✓ IN THE CUPBOARD</span>'
              : `<button class="btn gold sm ${afford ? '' : 'off'}" data-procure="${e.id}">💰 ${f(price)}</button>`}
            </div>
            <div class="tiny mono" style="margin-top:6px">${statLine(e, { level: 1 })}</div>
            <div class="tiny muted" style="margin-top:4px">${esc(e.effect)}</div>
          </div>`;
      }).join('') : '<div class="empty">Nothing in this category you can sign off yet.</div>'}</div>
        ${nextTier ? `<p class="tiny muted" style="padding:12px 14px;text-align:center;margin:0">
          ${DATA.RARITY[nextTier.rarity].label} kit unlocks at ${f(DATA.PROCURE.repReq[nextTier.rarity])} reputation.</p>` : ''}
        <div style="height:14px"></div>`;
      return;
    }

    /* --- the cupboard --- */
    const rk = i => DATA.RARITY[Game.eqDef(i.eid).rarity].order;
    const slotIdx = i => DATA.SLOTS.findIndex(s2 => s2.key === Game.eqDef(i.eid).slot);

    // Owned rarities only, so the filter row never offers an empty shelf.
    const counts = {};
    S.inventory.forEach(i => { const r = Game.eqDef(i.eid).rarity; counts[r] = (counts[r] || 0) + 1; });
    const tiers = Object.values(DATA.RARITY).sort((a, b) => b.order - a.order).filter(r => counts[r.key]);
    if (gearRarity !== 'all' && !counts[gearRarity]) gearRarity = 'all';

    const shelf = S.inventory
      .filter(i => gearRarity === 'all' || Game.eqDef(i.eid).rarity === gearRarity)
      .sort((a, b) => (Game.isStandard(b.uid) ? 1 : 0) - (Game.isStandard(a.uid) ? 1 : 0)
        || rk(b) - rk(a) || slotIdx(a) - slotIdx(b) || b.level - a.level);

    const total = pickedList().reduce((a, u) => {
      const it = S.inventory.find(x => x.uid === u);
      return a + (it ? Game.disposeValue(it) : 0);
    }, 0);

    screen$.innerHTML = `
      <div class="sec-head"><h2>STORE CUPBOARD</h2><span>${S.inventory.length} ITEMS</span></div>
      ${tabs}
      <div class="sortbar">
        <span class="sortbar-lbl">SHOW</span>
        <button class="sortchip ${gearRarity === 'all' ? 'on' : ''}" data-grarity="all">All <i>${S.inventory.length}</i></button>
        ${tiers.map(r => `<button class="sortchip ${gearRarity === r.key ? 'on' : ''}" data-grarity="${r.key}"
          style="${gearRarity === r.key ? `border-color:${r.color};color:${r.color};background:${r.color}14` : ''}">${r.label[0] + r.label.slice(1).toLowerCase()} <i>${counts[r.key]}</i></button>`).join('')}
      </div>
      <div class="sortbar" style="padding-top:0">
        <button class="sortchip ${picking ? 'on' : ''}" data-gpick="1">${picking ? '✕ Cancel' : '☑ Select'}</button>
        ${picking && shelf.length ? `<button class="sortchip" data-pickall="${shelf.map(i => i.uid).join(',')}">Select all shown</button>` : ''}
      </div>
      ${shelf.length ? `<div class="list">${shelf.map(i => itemCard(i)).join('')}</div>`
        : `<div class="empty"><span class="big">🧰</span>${S.inventory.length ? 'Nothing at that rarity.' : 'The cupboard is empty. Resolve tickets, or procure something.'}</div>`}
      <div style="height:${picking ? 90 : 14}px"></div>`;

    // the bulk bar only exists while picking
    const old = document.querySelector('#bulkbar'); if (old) old.remove();
    if (picking) {
      const bar = el('div', 'bulkbar', `
        <div class="bulk-n"><b>${picked.size}</b> selected</div>
        <button class="btn ${picked.size ? 'gold' : 'off'} sm" data-disposemany="1">DISPOSE · 💰${f(total)}</button>`);
      bar.id = 'bulkbar';
      document.body.appendChild(bar);
    }
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
          <span class="rw-r">+${m.reward.rep} REP</span><span style="color:var(--lamp)">+${m.reward.energy} 🎫</span>
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
    else if (screen === 'battle') { Battle.load(); Battle.render(); }
  }

  return { $, el, esc, clock, sheet, closeSheet, isPaused, floatText, burstFloats, coins, sparks, shake, beep,
           show, refresh, renderTop, renderHQ, buildStage, updateHero, updateMini,
           renderQueue, tickQueueUI, updateMeters, ticketRewards,
           updateIdle, updateBuildings, updateChips, charSheet, pickItemSheet, say,
           postSheet, fillDeptSheet, setStaffView, setStaffSort, setGearSort, renderStaff, renderGear,
           setGearView, setGearFilter, setGearRarity, togglePicking, togglePick, pickAll, pickedList,
           loadBoard, get screen() { return screen; }, rarColor, stars };
})();
