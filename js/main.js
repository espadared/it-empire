/* ============================================================
   IT EMPIRE — BOOT + INPUT
   ============================================================ */
(() => {
  const $ = s => document.querySelector(s);
  const f = Game.fmt, esc = UI.esc;

  /* ---------- SOUND (synthesised, no assets) ---------- */
  let ac = null, muted = localStorage.getItem('ie-mute') === '1';
  window.SFX = kind => {
    if (muted) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      const map = { tap: [420, 620, .05], ok: [560, 880, .12], great: [660, 1320, .2],
                    fail: [300, 170, .18], coin: [900, 1500, .07], level: [520, 1040, .35],
                    alarm: [340, 300, .3] };
      const [a, b, d] = map[kind] || map.tap;
      o.type = kind === 'fail' || kind === 'alarm' ? 'sawtooth' : 'triangle';
      o.frequency.setValueAtTime(a, t);
      o.frequency.exponentialRampToValueAtTime(b, t + d);
      g.gain.setValueAtTime(kind === 'level' ? .16 : .09, t);
      g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + .02);
    } catch (e) { }
  };

  /* ---------- TOAST ---------- */
  function toast(icon, t1, t2) {
    document.querySelectorAll('.toast').forEach(x => x.remove());
    const n = UI.el('div', 'toast', `<span style="font-size:22px">${icon}</span>
      <div><div class="t1">${esc(t1)}</div><div class="t2">${esc(t2)}</div></div>`);
    document.body.appendChild(n);
    setTimeout(() => { n.style.transition = 'opacity .4s'; n.style.opacity = '0'; setTimeout(() => n.remove(), 400); }, 2600);
  }

  /* ---------- RESOLVE ---------- */
  let busy = false;
  function doResolve() {
    if (busy) return; busy = true;
    const btn = $('#btnResolve'), hero = $('#heroWrap');
    const r = btn.getBoundingClientRect();
    hero && hero.classList.add('working');
    UI.beep('tap');
    setTimeout(() => {
      hero && hero.classList.remove('working');
      const res = Game.resolveTicket();
      const lines = [];
      if (res.xp) lines.push({ t: `+${f(res.xp)} XP`, c: 'var(--crt)' });
      if (res.credits) lines.push({ t: `+${f(res.credits)} CR`, c: 'var(--lamp)', s: 19 });
      if (res.rep) lines.push({ t: `${res.rep > 0 ? '+' : ''}${res.rep} REP`, c: res.rep > 0 ? 'var(--rep)' : 'var(--alarm)' });
      UI.burstFloats(r.left + r.width / 2, r.top - 6, lines);
      UI.coins(btn, Math.min(10, 3 + Math.floor(res.credits / 60)));

      if (!res.techOk) {
        UI.beep('fail');
        UI.floatText(r.left + r.width / 2, r.top - 34, 'ESCALATED', 'var(--alarm)', 15);
      } else if (res.ticket.tier === 'HARD') {
        UI.beep('great'); UI.shake();
        UI.sparks(r.left + r.width / 2, r.top, '#FFB347', 16);
      } else UI.beep('ok');

      UI.say(res.auto ? '"The Dongle of Destiny strikes again."' : res.satReason);
      if (res.drop) setTimeout(() => showDrop(res.drop), 480);
      UI.refresh();
      busy = false;
    }, 340);
  }

  function showDrop(it) {
    const e = Game.eqDef(it.eid), col = UI.rarColor(e.rarity);
    UI.beep('great');
    UI.sheet(`
      <span class="big-emoji">🎁</span>
      <h3 style="color:${col}">${esc(e.name)}</h3>
      <p class="sub">${e.rarity} ${DATA.SLOTS.find(s => s.key === e.slot).label.toUpperCase()} — pulled out of a ticket</p>
      <div class="reward-line">${Object.entries(e.stats || {}).map(([k, v]) =>
      `<span style="color:${v > 0 ? 'var(--crt)' : 'var(--alarm)'}">${v > 0 ? '+' : ''}${v} ${k}</span>`).join('')}</div>
      <p class="tiny muted" style="text-align:center">${esc(e.effect)}</p>
      <button class="btn gold cta" data-close="1">NICE</button>`);
    setTimeout(() => {
      const s = document.querySelector('.sheet');
      if (s) { const b = s.getBoundingClientRect(); UI.sparks(b.left + b.width / 2, b.top + 60, col, 22); }
    }, 120);
  }

  /* ---------- LEVEL UP ---------- */
  Game.on('levelup', d => {
    UI.beep('level');
    UI.sheet(`
      <span class="big-emoji">🎉</span>
      <h3>LEVEL ${d.level}</h3>
      <p class="sub">${esc(d.title.toUpperCase())}</p>
      <p class="tiny muted" style="text-align:center">Energy fully restored. Harder tickets are now hitting your queue — and they pay a great deal more.</p>
      <button class="btn gold cta" data-close="1">BACK TO WORK</button>`);
    setTimeout(() => UI.sparks(window.innerWidth / 2, window.innerHeight * .55, '#FFB347', 26), 100);
  });

  Game.on('achievement', a => { UI.beep('great'); toast('🏅', a.name, `${a.desc}  +${a.rep} REP`); });
  Game.on('missiondone', m => { UI.beep('ok'); toast('📋', 'MISSION COMPLETE', m.text + ' — claim it on Missions.'); });
  Game.on('event', e => { UI.beep('alarm'); toast(e.icon, e.title, e.desc); UI.updateChips(); });
  Game.on('built', b => { UI.beep('great'); toast(b.icon, b.name.toUpperCase(), b.effect); });

  /* ---------- CRITICAL INCIDENT ---------- */
  let incTimer = null;
  function openIncidentWarning() {
    UI.beep('alarm'); UI.shake();
    UI.sheet(`
      <span class="big-emoji">🚨</span>
      <h3 style="color:var(--alarm)">CRITICAL INCIDENT</h3>
      <p class="sub">Something big just broke. The normal queue can wait.</p>
      <p class="tiny muted" style="text-align:center">Work the problem in the right order and you will be paid many times what a ticket is worth. Guess, and you will not.</p>
      <button class="btn gold cta" data-act="incident-go">RESPOND NOW</button>
      <button class="btn ghost cta" data-close="1">NOT YET</button>`, { dismiss: false });
  }
  function runIncident() {
    const inc = Game.startIncident();
    drawIncident();
    clearInterval(incTimer);
    incTimer = setInterval(() => {
      const s = Game.state.incident;
      if (!s) return clearInterval(incTimer);
      const left = (s.endsAt - Date.now()) / 1000;
      const bar = document.querySelector('#incBar > span');
      if (bar) bar.style.width = Math.max(0, left / s.time * 100) + '%';
      const lbl = document.querySelector('#incLeft');
      if (lbl) lbl.textContent = Math.max(0, Math.ceil(left)) + 's';
      if (left <= 0) { clearInterval(incTimer); finishIncident(true); }
    }, 200);
  }
  function drawIncident() {
    const inc = Game.state.incident; if (!inc) return;
    const step = inc.steps[inc.step];
    UI.sheet(`
      <span class="big-emoji">${inc.icon}</span>
      <h3 style="color:var(--alarm)">${esc(inc.title)}</h3>
      <p class="sub">${esc(inc.brief)}</p>
      <div class="inc-steps">${inc.steps.map((s, i) =>
      `<i class="${inc.log[i] ? (inc.log[i].ok ? 'ok' : 'bad') : ''}"></i>`).join('')}</div>
      <div class="inc-timer" id="incBar"><span style="width:100%"></span></div>
      <div class="inc-chance">SUCCESS <b style="color:var(--lamp)">${Math.round(inc.chance * 100)}%</b>
        · <span id="incLeft">${inc.time}s</span> LEFT</div>
      <p class="tiny" style="text-align:center;font-family:var(--disp);font-weight:700;font-size:14px">${esc(step.q)}</p>
      ${step.opts.map((o, i) => `<button class="inc-opt" data-incopt="${i}">${esc(o.t)}</button>`).join('')}
    `, { dismiss: false, grab: false });
  }
  function answerIncident(i) {
    const r = Game.incidentAnswer(i); if (!r) return;
    UI.beep(r.ok ? 'ok' : 'fail');
    const btn = document.querySelector(`[data-incopt="${i}"]`);
    if (btn) {
      btn.classList.add(r.ok ? 'ok' : 'bad');
      const b = btn.getBoundingClientRect();
      UI.floatText(b.left + b.width / 2, b.top, r.ok ? 'CORRECT +17%' : 'WRONG −13%', r.ok ? 'var(--good)' : 'var(--alarm)', 14);
      if (!r.ok) UI.shake();
    }
    setTimeout(() => { if (r.done) finishIncident(false); else drawIncident(); }, 520);
  }
  function finishIncident(timeout) {
    clearInterval(incTimer);
    const res = Game.incidentFinish(timeout);
    if (!res) return;
    UI.beep(res.win ? 'level' : 'fail');
    UI.sheet(`
      <span class="big-emoji">${res.win ? '🏆' : '💀'}</span>
      <h3 style="color:${res.win ? 'var(--good)' : 'var(--alarm)'}">${res.win ? 'INCIDENT RESOLVED' : timeout ? 'OUT OF TIME' : 'INCIDENT ESCALATED'}</h3>
      <p class="sub">${res.win ? 'Service restored. Somebody upstairs noticed.' : 'It got fixed eventually. By someone else. Loudly.'}</p>
      <div class="reward-line">
        <span class="rw-c">+${f(res.credits)} CR</span>
        <span class="rw-x">+${f(res.xp)} XP</span>
        <span class="rw-r">+${f(res.rep)} REP</span></div>
      ${res.drop ? `<p class="tiny" style="text-align:center;color:${UI.rarColor(Game.eqDef(res.drop.eid).rarity)}">🎁 ${esc(Game.eqDef(res.drop.eid).name)}</p>` : ''}
      <button class="btn gold cta" data-close="1">CLOSE</button>`);
    if (res.win) setTimeout(() => UI.sparks(window.innerWidth / 2, window.innerHeight * .5, '#5FD37A', 26), 100);
    UI.refresh();
  }
  Game.on('incidenttimeout', () => { if (Game.state.incident) finishIncident(true); });

  /* ---------- WELCOME BACK ---------- */
  function welcomeBack(seconds) {
    const a = Game.state.idleAcc;
    UI.sheet(`
      <span class="big-emoji">☕</span>
      <h3>WELCOME BACK</h3>
      <p class="sub">The team kept the queue moving for ${Game.fmtTime(seconds)}</p>
      <div class="list" style="padding:0"><div class="card col">
        <div class="statgrid">
          <div class="statrow"><span>🎫</span><span class="nm">TICKETS RESOLVED</span><b>${f(a.t)}</b></div>
          <div class="statrow"><span>💰</span><span class="nm">IT CREDITS</span><b style="color:var(--lamp)">+${f(a.c)}</b></div>
          <div class="statrow"><span>⭐</span><span class="nm">XP</span><b style="color:var(--crt)">+${f(a.x)}</b></div>
          <div class="statrow"><span>🏆</span><span class="nm">REPUTATION</span><b style="color:var(--rep)">+${f(a.r)}</b></div>
          <div class="statrow"><span>🎁</span><span class="nm">EQUIPMENT FOUND</span><b>${a.gear}</b></div>
          <div class="statrow"><span>🚨</span><span class="nm">INCIDENTS HANDLED</span><b>${a.inc}</b></div>
        </div>
      </div></div>
      <button class="btn gold cta" data-act="collect-sheet">COLLECT ALL</button>`, { dismiss: false });
  }

  function collect() {
    const before = Game.state.idleAcc.c;
    if (before < 1) return;
    const res = Game.collectIdle();
    UI.beep('coin');
    const t = $('#resCredits').getBoundingClientRect();
    UI.floatText(window.innerWidth / 2, window.innerHeight * .5, `+${f(res.c)} CREDITS`, 'var(--lamp)', 22);
    setTimeout(() => UI.floatText(window.innerWidth / 2, window.innerHeight * .5 - 30, `+${f(res.x)} XP`, 'var(--crt)', 18), 140);
    const src = document.querySelector('.collect') || $('#idleStrip') || document.body;
    UI.coins(src, 14);
    if (res.gear.length) setTimeout(() => showDrop(res.gear[0]), 700);
    UI.refresh();
  }

  /* ---------- NOTIFICATIONS ---------- */
  function bellSheet() {
    const S = Game.state;
    const ready = (S.missions || []).filter(m => m.done && !m.claimed);
    UI.sheet(`
      <h3>NOTIFICATIONS</h3>
      <p class="sub">${esc(Game.rank(S.reputation).name)}</p>
      <div class="list" style="padding:0">
        ${S.event ? `<div class="card"><div class="avatar" style="display:grid;place-items:center;font-size:22px;background:var(--ink-2)">${S.event.icon}</div>
          <div class="who"><h3>${esc(S.event.title)}</h3><div class="role">${esc(S.event.desc)}</div>
          <div class="tiny mono" style="color:var(--lamp)">${Game.fmtTime((S.event.until - Date.now()) / 1000)} remaining</div></div></div>` : ''}
        ${Game.incidentReady() ? `<div class="card"><div class="avatar" style="display:grid;place-items:center;font-size:22px;background:var(--ink-2)">🚨</div>
          <div class="who"><h3>Critical incident waiting</h3><div class="role">Big rewards. Bigger consequences.</div></div>
          <button class="btn gold sm" data-act="incident-go">GO</button></div>` : ''}
        ${ready.length ? `<div class="card"><div class="avatar" style="display:grid;place-items:center;font-size:22px;background:var(--ink-2)">📋</div>
          <div class="who"><h3>${ready.length} mission${ready.length > 1 ? 's' : ''} ready to claim</h3><div class="role">${esc(ready.map(m => m.text).join(' · '))}</div></div>
          <button class="btn teal sm" data-act="go-missions">CLAIM</button></div>` : ''}
        ${!S.event && !Game.incidentReady() && !ready.length ? `<div class="empty"><span class="big">🌙</span>Nothing on fire. Enjoy it.</div>` : ''}
      </div>
      <div class="row" style="margin-top:12px;gap:8px">
        <button class="btn sm" data-act="mute" style="flex:1">${muted ? '🔇 SOUND OFF' : '🔊 SOUND ON'}</button>
        <button class="btn sm ghost" data-act="reset" style="flex:1;color:var(--alarm)">START OVER</button>
      </div>
      ${Net.online ? `<div class="acct">
        <div><div class="tiny muted">SIGNED IN AS</div><b>${esc(S.name)}</b>
          <div class="tiny muted">Progress saves to the server automatically.</div></div>
        <button class="btn sm ghost" data-act="signout">SIGN OUT</button>
      </div>` : `<p class="tiny muted" style="text-align:center;margin-top:12px">Playing solo — this save lives in this browser only.</p>`}
      <button class="btn ghost cta" data-close="1">CLOSE</button>`);
  }

  /* ---------- INPUT ---------- */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-screen],[data-act],[data-build],[data-hire],[data-levelup],[data-setactive],[data-char],[data-slot],[data-equip],[data-unequip],[data-back],[data-dept],[data-upgrade],[data-scrap],[data-claim],[data-legacy],[data-close],[data-incopt],#btnResolve,#bell');
    if (!t) return;
    const d = t.dataset;

    if (t.id === 'btnResolve') return doResolve();
    if (t.id === 'bell') return bellSheet();
    if (d.screen) { UI.beep('tap'); return UI.show(d.screen); }
    if (d.close) return UI.closeSheet();
    if (d.incopt != null) return answerIncident(+d.incopt);

    if (d.act) {
      switch (d.act) {
        case 'collect': return collect();
        case 'collect-sheet': UI.closeSheet(); return collect();
        case 'go-staff': UI.closeSheet(); return UI.show('staff');
        case 'go-missions': UI.closeSheet(); return UI.show('missions');
        case 'incident': return Game.incidentReady() ? openIncidentWarning() : toast('🚨', 'NO ACTIVE INCIDENT', 'The next one is already brewing somewhere.');
        case 'incident-go': return runIncident();
        case 'mute': muted = !muted; localStorage.setItem('ie-mute', muted ? '1' : '0'); UI.closeSheet(); return toast(muted ? '🔇' : '🔊', muted ? 'SOUND OFF' : 'SOUND ON', 'Changed your mind? The bell menu has it.');
        case 'signout': return UI.sheet(`<span class="big-emoji">👋</span><h3>SIGN OUT?</h3>
          <p class="sub">Your progress is saved. Sign back in any time, on any device.</p>
          <button class="btn gold cta" data-act="signout-yes">SIGN OUT</button>
          <button class="btn ghost cta" data-close="1">STAY</button>`);
        case 'signout-yes': window.IE_signOut(); return;
        case 'reset': return UI.sheet(`<span class="big-emoji">⚠️</span><h3>START OVER?</h3>
          <p class="sub">Every level, employee and credit goes. You will build a new technician from scratch${Net.online ? ' under the same account' : ''}. There is no undo.</p>
          <button class="btn cta" style="background:var(--alarm);color:#fff" data-act="reset-yes">YES, WIPE IT</button>
          <button class="btn ghost cta" data-close="1">KEEP MY EMPIRE</button>`);
        case 'reset-yes':
          UI.closeSheet();
          if (!Net.online) Game.wipe();
          window.IE_startOver();
          return;
        case 'reorg':
          if (!Game.reorgReady()) return toast('🔒', 'NOT YET', 'Reach level 30 before restructuring.');
          return UI.sheet(`<span class="big-emoji">🔄</span><h3>IT REORGANISATION</h3>
            <p class="sub">You will gain <b style="color:var(--rep)">+${Game.reorgGain()} Legacy Points</b></p>
            <p class="tiny muted" style="text-align:center">Lost: staff, office, credits, level, equipment. Kept: achievements, unlocked people, legacy bonuses — permanently.</p>
            <button class="btn gold cta" data-act="reorg-yes">RESTRUCTURE</button>
            <button class="btn ghost cta" data-close="1">NOT TODAY</button>`);
        case 'reorg-yes': {
          const g = Game.reorg(); UI.closeSheet(); UI.beep('level');
          UI.buildStage(); UI.show('hq');
          toast('🔄', `+${g} LEGACY POINTS`, 'A fresh department. Same you, but faster.');
          return;
        }
      }
    }

    if (d.build) { if (Game.build(d.build)) { UI.beep('coin'); UI.coins(t, 6); } else UI.beep('fail'); return UI.refresh(); }
    if (d.hire) {
      const c = Game.hire(d.hire);
      if (!c) { UI.beep('fail'); return toast('💸', 'CANNOT HIRE', 'Not enough credits or reputation yet.'); }
      UI.beep('great'); const def = Game.def(d.hire);
      UI.sheet(`<span class="big-emoji">${def.icon}</span><h3 style="color:${UI.rarColor(def.rarity)}">${esc(def.name)} JOINS</h3>
        <p class="sub">${esc(def.role)} · ${def.rarity}</p>
        <p class="tiny muted" style="text-align:center">${esc(def.personality)}</p>
        <p class="tiny" style="text-align:center;color:var(--crt)">${esc(def.quotes[0])}</p>
        <button class="btn gold cta" data-close="1">WELCOME ABOARD</button>`);
      return UI.refresh();
    }
    if (d.levelup) {
      const ok = Game.levelUpChar(d.levelup);
      if (ok) { UI.beep('level'); const b = t.getBoundingClientRect(); UI.sparks(b.left + b.width / 2, b.top + 10, '#4FD6C9', 14); }
      else { UI.beep('fail'); toast('📈', 'NOT READY', 'Needs more character XP or more credits.'); }
      UI.refresh();
      if (document.querySelector('.sheet') && ok) UI.charSheet(d.levelup);
      return;
    }
    if (d.setactive) { Game.state.activeId = d.setactive; Game.save(); UI.closeSheet(); UI.buildStage(); UI.beep('ok'); return UI.refresh(); }
    if (d.char && !e.target.closest('[data-levelup]')) return UI.charSheet(d.char);
    if (d.slot) return UI.pickItemSheet(d.for, d.slot);
    if (d.equip) { Game.equip(d.equip, d.for); UI.beep('ok'); return UI.charSheet(d.for); }
    if (d.unequip) { Game.unequip(d.for, d.unequip); UI.beep('tap'); return UI.charSheet(d.for); }
    if (d.back) return UI.charSheet(d.back);
    if (d.dept) {
      const c = Game.state.roster.find(x => x.uid === d.for);
      const dp = DATA.DEPARTMENTS.find(x => x.id === d.dept);
      if (Game.state.reputation < dp.repReq) { UI.beep('fail'); return toast('🔒', 'LOCKED', `${dp.name} opens at ${f(dp.repReq)} reputation.`); }
      c.dept = c.dept === d.dept ? null : d.dept; Game.save(); UI.beep('ok'); return UI.charSheet(d.for);
    }
    if (d.upgrade) { Game.upgradeItem(d.upgrade) ? UI.beep('coin') : UI.beep('fail'); return UI.refresh(); }
    if (d.scrap) { Game.scrapItem(d.scrap); UI.beep('tap'); return UI.refresh(); }
    if (d.claim) {
      const r = Game.claimMission(d.claim);
      if (r) { UI.beep('level'); const b = t.getBoundingClientRect(); UI.coins(t, 8); UI.floatText(b.left, b.top - 10, `+${f(r.credits)} CR`, 'var(--lamp)', 16); }
      return UI.refresh();
    }
    if (d.legacy) { Game.spendLegacy(d.legacy) ? UI.beep('great') : UI.beep('fail'); return UI.refresh(); }
  });

  /* ---------- LOOP ---------- */
  let lastUi = 0, warned = false;
  function loop(ts) {
    Game.tick();
    if (ts - lastUi > 900) {
      lastUi = ts;
      UI.renderTop();
      if (UI.screen === 'hq') { UI.updateIdle(); UI.updateMini(); UI.updateChips(); }
      if (Game.incidentReady() && !warned && !document.querySelector('#modal.on') && UI.screen === 'hq') {
        warned = true; openIncidentWarning();
      }
      if (!Game.incidentReady()) warned = false;
      if (Date.now() > Game.state.missionsAt) { Game.rollMissions(); toast('📋', 'NEW DAILY MISSIONS', 'Fresh objectives are up.'); UI.refresh(); }
    }
    requestAnimationFrame(loop);
  }

  /* ---------- BOOT ---------- */
  Game.on('change', () => { if (!document.hidden) UI.renderTop(); });

  let running = false;

  function firstShift() {
    const sp = DATA.spec(Game.state.hero.spec);
    UI.sheet(`
      <span class="big-emoji">${sp.icon}</span>
      <h3>DAY ONE ON THE HELPDESK</h3>
      <p class="sub">${esc(Game.state.name)} · ${esc(sp.name)}</p>
      <p class="tiny muted" style="text-align:center">Tap <b style="color:var(--lamp)">RESOLVE TICKET</b> to work the queue. Credits hire colleagues, colleagues work the queue while you are gone, and reputation opens up the rest of the company.</p>
      <p class="tiny" style="text-align:center;color:var(--crt)">Somewhere above you, there is a CTO chair with your name on it.</p>
      <button class="btn gold cta" data-close="1">CLOCK IN</button>`);
  }

  const dropSplash = () => {
    const sp = document.querySelector('#splash');
    if (sp) { sp.classList.add('gone'); setTimeout(() => sp.remove(), 400); }
  };

  function startGame(res, opts = {}) {
    Onboard.hide();
    dropSplash();
    UI.buildStage();
    UI.show('hq');
    if (res && res.offline && Game.state.idleAcc.c >= 1) setTimeout(() => welcomeBack(res.away), 500);
    else if (opts.fresh) setTimeout(firstShift, 350);
    if (!running) {
      running = true;
      setInterval(() => { Game.save(); if (Net.online) Net.flush(true); }, 10000);
      requestAnimationFrame(loop);
    }
  }

  function buildCharacter(opts) {
    dropSplash();
    Onboard.creator(profile => {
      Game.newGame(null, profile);
      Game.save();
      if (Net.online) Net.flush(true);
      startGame(null, { fresh: true });
    }, opts || {});
  }

  function afterAuth(r) {
    Game.setStore(Net.store);
    if (r.state) {
      const res = Game.loadFrom(r.state, r.now);
      if (!res.needsCharacter) {
        if (r.player && r.player.name) Game.state.name = r.player.name;
        return startGame(res);
      }
    }
    // A brand new account: they built their technician on the way in.
    const name = (r.profile && r.profile.name) || (r.player && r.player.name) || 'JASON';
    if (r.profile) {
      Game.newGame(null, r.profile);
      Game.save(); Net.flush(true);
      return startGame(null, { fresh: true });
    }
    buildCharacter({ name: name.toUpperCase(), lockName: true });
  }

  async function boot() {
    const online = await Net.probe();

    if (!online) {                       // solo: this browser keeps the save
      const saved = Game.localStore.read();
      const res = saved ? Game.loadFrom(saved) : { needsCharacter: true };
      if (res.needsCharacter) return buildCharacter();
      return startGame(res);
    }

    Game.setStore(Net.store);
    if (Net.token) {
      const r = await Net.resume();
      if (r.ok) return afterAuth(r);
      Net.logout();
    }
    dropSplash();
    Onboard.auth(afterAuth);
  }

  window.IE_startOver = () => buildCharacter(
    Net.online ? { name: (Game.state.name || '').toUpperCase(), lockName: true } : {});

  window.IE_signOut = () => {
    Game.save(); Net.flushBeacon(); Net.logout();
    location.reload();
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { Game.save(); if (Net.online) Net.flush(true); }
    else if (running) UI.refresh();
  });
  window.addEventListener('pagehide', () => { Game.save(); Net.flushBeacon(); });
  window.addEventListener('beforeunload', () => { Game.save(); Net.flushBeacon(); });

  boot();
})();
