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

  /* ---------- WORKING THE QUEUE ---------- */
  /* One ticket at a time, not one queue at a time. A single shared flag meant
     that fixing anything froze the whole board for a moment, so a second tap
     on a *different* ticket was silently swallowed. */
  const working = new Set();

  function cardOf(tuid) { return document.querySelector(`[data-tk="${tuid}"]`); }

  /* Nothing may stay flagged as in-progress once it has left the queue. If it
     did, every future tap on that card would be swallowed in silence and the
     only way out would be a reload. */
  function sweepWorking() {
    if (!working.size) return;
    const live = new Set((Game.state.queue || []).map(t => t.uid));
    let changed = false;
    working.forEach(uid => { if (!live.has(uid)) { working.delete(uid); changed = true; } });
    if (changed && !working.size) {
      const hero = $('#heroWrap');
      hero && hero.classList.remove('working');
    }
  }

  function stopWorking(tuid) {
    working.delete(tuid);
    if (!working.size) {
      const hero = $('#heroWrap');
      hero && hero.classList.remove('working');
    }
  }

  function showResult(res, anchor) {
    const r = (anchor || document.body).getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + 10;
    const lines = [];
    if (res.xp) lines.push({ t: `+${f(res.xp)} XP`, c: 'var(--crt)' });
    if (res.credits) lines.push({ t: `+${f(res.credits)} CR`, c: 'var(--lamp)', s: 19 });
    if (res.rep) lines.push({ t: `${res.rep > 0 ? '+' : ''}${res.rep} REP`, c: res.rep > 0 ? 'var(--rep)' : 'var(--alarm)' });
    UI.burstFloats(x, y, lines);
    UI.coins(anchor || document.body, Math.min(10, 3 + Math.floor(res.credits / 60)));

    if (res.diag === 1) UI.floatText(x, y - 40, 'CORRECT DIAGNOSIS', 'var(--good)', 15);
    else if (res.diag === 0) UI.floatText(x, y - 40, 'WRONG CALL', 'var(--alarm)', 15);
    if (res.momentumMult >= 1.6) UI.floatText(x, y - 62, `🔥 ×${res.momentumMult.toFixed(1)}`, 'var(--lamp)', 16);

    if (!res.techOk) { UI.beep('fail'); UI.floatText(x, y - 22, 'ESCALATED', 'var(--alarm)', 15); }
    else if (res.ticket.tier === 'HARD' || res.diag === 1) {
      UI.beep('great'); UI.sparks(x, y, res.diag === 1 ? '#5FD37A' : '#FFB347', 16);
      if (res.ticket.tier === 'HARD') UI.shake();
    } else UI.beep('ok');

    UI.say(res.delegated
      ? `"${res.worker.defId === 'hero' ? 'I' : Game.def(res.worker.defId).name} took that one."`
      : res.auto ? '"The Dongle of Destiny strikes again."' : res.satReason);
    if (res.drop) setTimeout(() => showDrop(res.drop), 480);
    UI.refresh();
  }

  function doFix(tuid) {
    if (working.has(tuid)) return;
    const t = Game.ticketBy(tuid);
    // The card on screen is describing a ticket that has since gone — it ran
    // out while a sheet was open, or somebody else in the queue resolved
    // underneath it. Redraw and say so, rather than swallowing the tap.
    if (!t) {
      UI.beep('fail');
      UI.refresh();
      return toast('🎫', 'THAT ONE HAS GONE', 'The queue moved on. Here is what is waiting now.');
    }
    if (!Game.hasQuota()) {
      UI.beep('fail');
      UI.refresh();
      return toast('🎫', 'ALLOWANCE SPENT', 'Your team keeps earning. Come back when it refills.');
    }
    if (Game.needsDiagnosis(t)) return openDiagnosis(tuid);
    working.add(tuid);
    const hero = $('#heroWrap');
    hero && hero.classList.add('working');
    const card = cardOf(tuid);
    card && card.classList.add('going');
    UI.beep('tap');
    setTimeout(() => {
      try {
        // another ticket resolving may have re-rendered the queue underneath
        // us, so find the card again rather than trusting the old node
        const live = cardOf(tuid) || card;
        const res = Game.resolveTicket(tuid);
        if (res) showResult(res, live);
      } finally {
        stopWorking(tuid);
      }
    }, 180);
  }

  /* The diagnosis. The ticket's clock keeps running while you think — that
     is the point of it. */
  function openDiagnosis(tuid) {
    const t = Game.ticketBy(tuid); if (!t) return;
    const opts = t.causes.map((c, i) => ({ ...c, i })).sort(() => Math.random() - 0.5);
    UI.beep('tap');
    UI.sheet(`
      <div class="row" style="gap:10px;align-items:flex-start">
        <div class="tk-ico" style="width:46px;height:46px;font-size:23px">${t.icon}</div>
        <div style="flex:1;min-width:0">
          <h3 style="text-align:left;font-size:16px;margin:0">${esc(t.name)}</h3>
          <div class="tiny muted">${esc(t.user)} · #${t.id}</div>
        </div>
        <span class="tier t-${t.tier}">${t.tier}</span>
      </div>
      <div class="diag-clue"><span>WHAT YOU CAN SEE</span>${esc(t.clue)}</div>
      <p class="tiny" style="text-align:center;font-family:var(--disp);font-weight:800;font-size:13px;letter-spacing:.04em">SO WHAT IS ACTUALLY WRONG?</p>
      ${opts.map((o, i) => `<button class="diag-opt" data-diag="${tuid}" data-ok="${o.ok ? 1 : 0}" data-i="${i}">${esc(o.t)}</button>`).join('')}
      <p class="diag-timer" style="margin-top:12px">The clock is still running · <b id="diagLeft">${UI.clock(t.left)}</b></p>
      <button class="btn cta giveup" data-giveup="${tuid}">
        🤷 I DON'T KNOW <span>hand it up · −${Game.escalateCost(t.tier)} REP</span></button>
      <button class="btn ghost cta" data-close="1">← BACK TO THE QUEUE (keep it)</button>
    `, { grab: false, live: true });
  }

  /* ---------------- COMPANY-WIDE INCIDENT ----------------
     A goal the whole group pushes at once. Contributions are batched rather
     than sent per ticket, so a busy session is a handful of requests. */
  let coop = null, coopPending = 0, coopTimer = 0;

  function coopPaint() {
    const box = document.querySelector('#coopStrip'); if (!box) return;
    if (!coop) { box.innerHTML = ''; return; }
    const pct = Math.min(100, coop.progress / coop.goal * 100);
    const hrs = Math.floor(coop.endsIn / 3600);
    box.innerHTML = `<div class="coop ${coop.done ? 'done' : ''}">
      <div class="coop-top">
        <span class="coop-ico">${coop.done ? '🎉' : '🚨'}</span>
        <div style="flex:1;min-width:0">
          <b>${esc(coop.title)}</b>
          <span>${esc(coop.blurb)}</span>
        </div>
        <span class="coop-time">${coop.done ? 'DONE' : hrs + 'h left'}</span>
      </div>
      <div class="pbar coop-bar"><span style="width:${pct}%"></span></div>
      <div class="coop-foot">
        <span>${f(coop.progress)} / ${f(coop.goal)} tickets — everyone together</span>
        <span class="coop-mine">you: ${f(coop.mine)}</span>
      </div>
      ${coop.helpers && coop.helpers.length > 1
        ? `<div class="coop-helpers">${coop.helpers.map(h =>
            `<span>${esc(h.name)} ${f(h.n)}</span>`).join('')}</div>` : ''}
      ${coop.canClaim
        ? `<button class="btn gold cta" data-act="coop-claim" style="margin-top:10px">
             COLLECT YOUR SHARE · 💰${f(coop.reward.credits)} · 🏆${f(coop.reward.rep)}</button>`
        : coop.done && coop.claimed
          ? '<p class="tiny muted" style="margin:8px 0 0">Collected. The next one starts soon.</p>'
          : coop.done && !coop.mine
            ? '<p class="tiny muted" style="margin:8px 0 0">Finished without you this time.</p>' : ''}
    </div>`;
  }

  function eotmRefresh() {
    if (!Net.online) return;
    Net.eotm().then(d => { if (d) UI.setEotm(d); });
  }

  function coopRefresh() {
    if (!Net.online) return;
    Net.coop(0).then(c => { if (c) { coop = c; coopPaint(); } });
  }

  function coopCredit(n) {
    if (!Net.online) return;
    coopPending += n || 1;
    clearTimeout(coopTimer);
    coopTimer = setTimeout(() => {
      const send = Math.min(coopPending, 60); coopPending = 0;
      Net.coop(send).then(c => { if (c) { coop = c; coopPaint(); } });
    }, 4000);
  }

  function answerDiagnosis(tuid, ok, idx) {
    if (working.has(tuid)) return;
    working.add(tuid);
    const btn = document.querySelector(`[data-diag="${tuid}"][data-i="${idx}"]`);
    document.querySelectorAll('[data-diag]').forEach(b => {
      if (b.dataset.ok === '1') b.classList.add('ok');
      else if (b === btn) b.classList.add('bad');
    });
    UI.beep(ok ? 'great' : 'fail');
    if (!ok) UI.shake();
    const t = Game.ticketBy(tuid);
    const why = t && t.why;
    const right = t && (t.causes || []).find(c => c.ok);
    setTimeout(() => {
      try {
        const card = cardOf(tuid);
        const res = Game.resolveTicket(tuid, { diag: ok ? 1 : 0 });
        // Teach the reasoning, right or wrong. Getting it right and not knowing
        // why you were right is the same as guessing.
        if (why) { showWhy(ok, right, why, () => { if (res) showResult(res, card); }); }
        else { UI.closeSheet(); if (res) showResult(res, card); }
      } finally {
        stopWorking(tuid);
      }
    }, 700);
  }

  /* The explanation card. This is the part of the game that is actually about
     IT rather than about numbers going up, so it is worth a screen of its own
     rather than a line in a toast. */
  /* Whether the explanation appears at all. Some players want to learn the
     reasoning; some just want to clear the queue. Both are reasonable, so it
     is a switch rather than a decision made for them. Kept on the save so it
     follows them between devices. */
  const wantsWhy = () => Game.state.showWhy !== false;

  function showWhy(ok, right, why, done) {
    if (!wantsWhy()) { UI.closeSheet(); if (done) done(); return; }
    UI.sheet(`
      <button class="why-toggle" data-act="why-off" title="Stop showing these">💡 ON</button>
      <span class="big-emoji">${ok ? '✅' : '💡'}</span>
      <h3>${ok ? 'Correct' : 'The answer was'}</h3>
      <p class="diag-answer" style="margin:2px 0 0">${esc(right ? right.t : '')}</p>
      <div class="whycard">
        <b>Why</b>
        <p>${esc(why)}</p>
      </div>
      <button class="btn gold cta" data-act="why-done">${ok ? 'NEXT TICKET' : 'GOT IT'}</button>`);
    whyDone = done;
  }
  let whyDone = null;

  /* Admitting you are stuck. It costs reputation — more on the big ones — but
     far less than letting it breach, and you are told what it actually was,
     which is how you get better at the next one. */
  function giveUp(tuid) {
    if (working.has(tuid)) return;
    const t = Game.ticketBy(tuid); if (!t) return;
    working.add(tuid);
    const right = (t.causes || []).find(c => c.ok) || { t: 'something else entirely' };
    document.querySelectorAll('[data-diag]').forEach(b => {
      if (b.dataset.ok === '1') b.classList.add('ok');
      b.disabled = true;
    });
    const btn = document.querySelector('[data-giveup]');
    if (btn) btn.outerHTML = `<p class="diag-answer">It was <b>${esc(right.t)}</b></p>`
      + (t.why ? `<div class="whycard"><b>Why</b><p>${esc(t.why)}</p></div>` : '');
    // the free back-out is gone the moment you commit to handing it up
    const back = document.querySelector('#modal [data-close]');
    if (back) back.remove();
    UI.beep('fail');
    setTimeout(() => {
      try {
        UI.closeSheet();
        const r = Game.escalateTicket(tuid);
        if (r) {
          UI.floatText(window.innerWidth / 2, window.innerHeight * 0.45,
            `HANDED UP  −${r.cost} REP`, 'var(--alarm)', 19);
          toast('🤷', 'PASSED UP THE CHAIN', `${t.name} — it was ${right.t.toLowerCase()}. Now you know.`);
        }
        UI.refresh();
      } finally { working.delete(tuid); }
    }, 1600);
  }

  /* Hand it over. Costs you nothing but the reward and their availability. */
  function openDelegate(tuid) {
    const t = Game.ticketBy(tuid); if (!t) return;
    const S = Game.state;
    const others = S.roster.filter(c => c.uid !== S.activeId);
    if (!others.length) {
      UI.beep('fail');
      return toast('👥', 'NOBODY TO ASK', 'Hire a colleague on the STAFF tab and you can hand tickets over.');
    }
    UI.sheet(`
      <h3>WHO TAKES IT?</h3>
      <p class="sub">${esc(t.name)} · they earn 70% and are busy afterwards</p>
      ${others.map(c => {
      const d = Game.def(c.defId), free = !Game.isBusy(c);
      const o = Game.oddsFor(t, c);
      const left = Math.ceil(((S.busy[c.uid] || 0) - Date.now()) / 1000);
      return `<button class="dpick ${free ? '' : 'busy'}" ${free ? `data-dele-go="${tuid}" data-who="${c.uid}"` : ''}>
          <div class="avatar" style="width:44px;height:44px">${Art.portrait(d.art, 'dp' + c.uid)}</div>
          <div class="who"><h3>${esc(d.name)}</h3><div class="role">${esc(d.role)} · LV.${c.level}</div></div>
          <div class="fit">${free
          ? `<b style="color:${o.tech > .7 ? 'var(--good)' : o.tech > .45 ? 'var(--lamp)' : 'var(--alarm)'}">${Math.round(o.tech * 100)}%</b>
               <div class="tiny muted">chance</div>`
          : `<b style="color:var(--muted)">BUSY</b><div class="tiny muted">${left}s</div>`}</div>
        </button>`;
    }).join('')}
      <button class="btn ghost cta" data-close="1">CANCEL</button>`, { live: true });
  }

  function doEscalate(tuid) {
    if (working.has(tuid)) return;
    working.add(tuid);
    try {
      const card = cardOf(tuid);
      if (card) card.classList.add('going');
      const r = Game.escalateTicket(tuid);
      if (!r) return;
      UI.beep('tap');
      if (card) {
        const b = card.getBoundingClientRect();
        UI.floatText(b.left + b.width / 2, b.top + 10, `ESCALATED  −${r.cost} REP`, 'var(--alarm)', 14);
      }
      UI.refresh();
    } finally { working.delete(tuid); }
  }

  // Every resolved ticket counts toward the company-wide incident. Hooked to
  // the engine event, not the result card, because some routes (delegating,
  // escalating) never draw one.
  Game.on('resolved', () => coopCredit(1));

  Game.on('moralefirst', ({ morale }) => {
    setTimeout(() => UI.sheet(`<span class="big-emoji">😟</span>
      <h3>THE TEAM IS FLAGGING</h3>
      <p class="sub">Morale has dropped to ${morale}%.</p>
      <div class="whycard"><b>What this is</b>
        <p>How your users feel about the department. It falls when tickets are
          botched or left to run out of time, and it quietly scales everything
          you earn — so a flagging team is a poorer one.</p></div>
      <div class="whycard"><b>How to bring it back</b>
        <p>Fix tickets properly and stop letting them lapse. It recovers on its
          own once you are on top of the queue again, and this meter goes away
          when it does.</p></div>
      <button class="btn gold cta" data-close="1">GOT IT</button>`), 600);
  });

  Game.on('allowancechanged', ({ from, to, level }) => {
    if (to >= from) return;
    setTimeout(() => UI.sheet(`<span class="big-emoji">🎫</span>
      <h3>YOUR ALLOWANCE HAS SETTLED</h3>
      <p class="sub">${f(from)} an hour → <b style="color:var(--lamp)">${f(to)} an hour</b></p>
      <div class="whycard"><b>Why it went down</b>
        <p>Your first days come with a much bigger allowance so you can learn the
          job without the game stopping on you. As you level up it settles toward
          the normal pace — by now you have colleagues working the queue while you
          are away, which is where most of your income comes from.</p></div>
      <div class="whycard"><b>You have not lost anything</b>
        <p>Whatever is already in your allowance stays yours. The Break Room in
          THE OFFICE adds more on top, permanently.</p></div>
      <button class="btn gold cta" data-close="1">UNDERSTOOD</button>`), 1400);
  });

  Game.on('tabunlock', def => {
    UI.beep('great');
    toast('🔓', def.label + ' UNLOCKED', def.why);
  });

  /* Your own rank moving is the payoff the whole premise promises, so it gets
     a moment rather than a silent stat change. */
  Game.on('heropromoted', ({ from, to }) => {
    UI.beep('great');
    setTimeout(() => UI.sheet(`<span class="big-emoji">🎖️</span>
      <h3>YOU HAVE BEEN PROMOTED</h3>
      <p class="sub">${esc(Game.state.name)} is now <b style="color:${rarColour(to)}">${esc(to)}</b>,
        up from ${esc(from)}.</p>
      <div class="whycard"><b>What this means</b>
        <p>Every one of your stats scales with your rank. You remain the strongest
          technician in the building — no hire outgrows the person running the place.</p></div>
      <button class="btn gold cta" data-close="1">BACK TO WORK</button>`), 1200);
  });

  const rarColour = r => ({ COMMON:'#8A93AD', UNCOMMON:'#5FD37A', RARE:'#4FA8FF',
    EPIC:'#B67CFF', LEGENDARY:'#FFB347', MYTHIC:'#FF5A9E' }[r] || '#FFB347');

  Game.on('quotaspent', () => {
    UI.beep('alarm');
    UI.sheet(`
      <span class="big-emoji">🎫</span>
      <h3>THAT IS YOUR ${Game.quotaMax()}</h3>
      <p class="sub">You have worked your allowance for this hour</p>
      <p class="tiny muted" style="text-align:center">The queue is frozen until it refills — nothing breaches while you are off the floor. Your team keeps working the automated queue the whole time, so there will be a pile of credits waiting when you get back.</p>
      <p class="tiny" style="text-align:center;color:var(--lamp);font-family:var(--disp);font-size:15px">BACK IN ${Game.fmtTime(Game.quotaResetIn())}</p>
      <button class="btn gold cta" data-close="1">SEE YOU IN AN HOUR</button>`);
    UI.refresh();
  });

  Game.on('quotarefresh', ({ allowance }) => {
    UI.beep('level');
    toast('🎫', 'ALLOWANCE REFILLED', `${allowance} tickets are yours again. The queue is live.`);
    UI.refresh();
  });

  Game.on('breach', ({ ticket, rep }) => {
    UI.beep('alarm'); UI.shake();
    toast('⏰', 'SLA BREACHED', `${ticket.name} — ${ticket.user} gave up waiting. −${rep} reputation, morale down.`);
    UI.floatText(window.innerWidth / 2, window.innerHeight * 0.42, `BREACH −${rep} REP`, 'var(--alarm)', 20);
    if (UI.screen === 'hq') UI.renderQueue();
  });

  /* ---------- LEVEL UP ---------- */
  Game.on('levelup', d => {
    UI.beep('level');
    UI.sheet(`
      <span class="big-emoji">🎉</span>
      <h3>LEVEL ${d.level}</h3>
      <p class="sub">${esc(d.title.toUpperCase())}</p>
      <p class="tiny muted" style="text-align:center">Your hands-on allowance is topped back up. Harder tickets are now hitting your queue — and they pay a great deal more.</p>
      <button class="btn gold cta" data-close="1">BACK TO WORK</button>`);
    setTimeout(() => UI.sparks(window.innerWidth / 2, window.innerHeight * .55, '#FFB347', 26), 100);
  });

  /* A rank costs four times a normal level, so it gets a moment rather than a
     line of toast. */
  Game.on('promoted', ({ char, rank }) => {
    UI.beep('level');
    const d = Game.def(char.defId);
    const nm = char.defId === 'hero' ? Game.state.name : d.name;
    const role = Game.roleOf(char);
    UI.sheet(`
      <div class="promo">
        <div class="promo-ribbon">PROMOTED</div>
        <div class="promo-art">${Art.portrait(d.art, 'pr' + char.uid + rank.at)}</div>
        <h3>${esc(nm)}</h3>
        <div class="promo-rank" style="color:${rank.colour}">${esc(rank.name)}</div>
        <div class="promo-row">
          <span>${role.icon} ${esc(role.name)}</span><span>LV.${char.level}</span><span>⚡ ${f(Game.charPower(char))}</span>
        </div>
        <p class="tiny muted" style="text-align:center;margin:12px 0 0">${esc(role.perk)} — and they are worth more to every department from here.</p>
      </div>
      <button class="btn gold cta" data-close="1">CONGRATULATE THEM</button>`);
    setTimeout(() => {
      UI.sparks(window.innerWidth / 2, window.innerHeight * 0.42, rank.colour, 30);
      UI.sparks(window.innerWidth / 2, window.innerHeight * 0.42, '#FFB347', 18);
    }, 120);
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
        <button class="btn sm" data-act="${wantsWhy() ? 'why-off' : 'why-on'}" style="flex:1">${
          wantsWhy() ? '💡 EXPLANATIONS ON' : '💡 EXPLANATIONS OFF'}</button>
      </div>
      <p class="tiny muted" style="text-align:center;margin:6px 0 0">Explanations tell you why a diagnosis was right. Turn them off to resolve straight away.</p>
      <div class="row" style="margin-top:10px;gap:8px">
        <button class="btn sm ghost" data-act="reset" style="flex:1;color:var(--alarm)">START OVER</button>
      </div>
      ${Net.online ? `<div class="acct">
        <div><div class="tiny muted">SIGNED IN AS</div><b>${esc(S.name)}</b>
          <div class="tiny muted">Progress saves to the server automatically.</div></div>
        <button class="btn sm ghost" data-act="signout">SIGN OUT</button>
      </div>
      <button class="btn ghost cta tiny" data-act="delete-account"
        style="color:var(--muted);font-size:11px;padding:6px">Delete my account and all my progress</button>` : `<p class="tiny muted" style="text-align:center;margin-top:12px">Playing solo — this save lives in this browser only.</p>`}
      <button class="btn ghost cta" data-close="1">CLOSE</button>`);
  }

  /* ---------- INPUT ---------- */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-screen],[data-act],[data-build],[data-hire],[data-levelup],[data-levelmax],[data-setactive],[data-char],[data-slot],[data-issue],[data-withdraw],[data-back],[data-sview],[data-ssort],[data-post],[data-deptfill],[data-assign],[data-promote],[data-retire],[data-retire-yes],[data-advice],[data-dept],[data-upgrade],[data-dispose],[data-procure],[data-gsort],[data-grarity],[data-gview],[data-gfilter],[data-gpick],[data-pick],[data-pickall],[data-disposemany],[data-disposemany-yes],[data-enter],[data-play],[data-bq],[data-led],[data-scram],[data-fault],[data-claim],[data-legacy],[data-close],[data-incopt],[data-fix],[data-delegate],[data-dele-go],[data-escalate],[data-diag],[data-giveup],[data-invest],#bell,#help');
    if (!t) return;
    const d = t.dataset;

    if (t.id === 'help') { UI.beep('tap'); return UI.explain(); }
    if (t.id === 'bell') return bellSheet();
    if (d.fix) return doFix(d.fix);
    if (d.delegate) return openDelegate(d.delegate);
    if (d.deleGo) {
      if (working.has(d.deleGo)) return;
      working.add(d.deleGo);
      try {
        UI.closeSheet();
        const card = cardOf(d.deleGo);
        const res = Game.delegate(d.deleGo, d.who);
        if (res) showResult(res, card); else UI.beep('fail');
      } finally { stopWorking(d.deleGo); }
      return;
    }
    if (d.giveup) return giveUp(d.giveup);
    if (d.escalate) return doEscalate(d.escalate);
    if (d.diag) return answerDiagnosis(d.diag, d.ok === '1', d.i);
    if (d.screen) {
      const st = Game.tabState(d.screen);
      if (!st.open) {
        UI.beep('fail');
        return UI.sheet(`<span class="big-emoji">🔒</span>
          <h3>${esc(st.def.label)} is not open yet</h3>
          <p class="sub">${esc(st.def.why)}</p>
          <div class="whycard"><b>To unlock</b><p>${esc(st.def.hint)} —
            you are at ${Game.f ? Game.f(st.have) : st.have} of ${st.need}.</p></div>
          <button class="btn gold cta" data-close="1">BACK TO WORK</button>`);
      }
      UI.beep('tap');
      if (d.screen === 'rank') eotmRefresh();
      return UI.show(d.screen);
    }
    if (d.invest) {
      const r = Game.invest();
      if (!r) { UI.beep('fail'); return toast('🏙️', 'NOT ENOUGH CREDITS', 'Keep the queue moving and come back.'); }
      UI.beep('great'); UI.refresh();
      return UI.sheet(`<span class="big-emoji">🏙️</span>
        <h3>${esc(r.site.name.toUpperCase())}</h3>
        <p class="sub">${esc(r.site.blurb)}</p>
        <div class="whycard"><b>What it gives you</b>
          <p>+${Math.round(DATA.EXPANSION.idlePer * 100)}% idle output, permanently${r.desk
            ? ', and a desk — you can hire one more person' : ''}.
            You now hold ${Game.expansionOwned()} site${Game.expansionOwned() > 1 ? 's' : ''}.</p></div>
        <button class="btn gold cta" data-close="1">BACK TO WORK</button>`);
    }
    if (d.close) return UI.closeSheet();
    if (d.incopt != null) return answerIncident(+d.incopt);

    if (d.act) {
      switch (d.act) {
        case 'adopt-newer': {
          UI.closeSheet();
          location.reload();          // simplest correct thing: start from the server's copy
          return;
        }
        case 'day-one-done': {
          UI.closeSheet();
          // now the guide for the screen they are standing on, which the
          // day-one card would otherwise have talked over
          if (Game.state.taught) delete Game.state.taught.hq;
          setTimeout(() => UI.show('hq'), 220);
          return;
        }
        case 'eotm-claim': {
          Net.eotmClaim().then(r => {
            if (!r || !r.won) return toast('🏅', 'NOTHING TO COLLECT', 'It may already be claimed.');
            Game.grantReward({ credits: r.won.credits });
            UI.setEotm(r.eotm);
            const best = r.won.months.reduce((a, m) => Math.min(a, m.place), 9);
            UI.sheet(`<span class="big-emoji">${best === 1 ? '🏅' : best === 2 ? '🥈' : '🥉'}</span>
              <h3>${best === 1 ? 'EMPLOYEE OF THE MONTH' : 'ON THE PODIUM'}</h3>
              <p class="sub">${r.won.months.map(m =>
                `${esc(m.month)} · place ${m.place}`).join('<br>')}</p>
              <div class="whycard"><b>Your prize</b>
                <p>💰 ${f(r.won.credits)} credits, paid into your account.</p></div>
              <p class="tiny muted" style="text-align:center">A new month has already started.
                Everyone is back to zero.</p>
              <button class="btn gold cta" data-close="1">BACK TO WORK</button>`);
          });
          return;
        }
        case 'coop-claim': {
          Net.coopClaim().then(r => {
            if (!r || !r.reward) return toast('🚨', 'NOTHING TO COLLECT', 'It may already be claimed.');
            Game.grantReward({ credits: r.reward.credits, reputation: r.reward.rep });
            coop = r.coop; coopPaint();
            toast('🎉', 'INCIDENT CLOSED',
              `The whole company pulled together. +${f(r.reward.credits)} credits, +${f(r.reward.rep)} reputation.`);
          });
          return;
        }
        case 'why-off': {
          Game.state.showWhy = false; Game.save();
          UI.beep('tap');
          UI.closeSheet();
          const fn = whyDone; whyDone = null;
          if (fn) fn();
          toast('💡', 'EXPLANATIONS OFF',
            'Diagnoses will resolve straight away. Turn them back on from the 🔔 menu.');
          return;
        }
        case 'why-on': {
          Game.state.showWhy = true; Game.save();
          UI.beep('tap'); UI.closeSheet();
          toast('💡', 'EXPLANATIONS ON', 'You will see why each answer was right.');
          return;
        }
        case 'why-done': {
          UI.closeSheet();
          const fn = whyDone; whyDone = null;
          if (fn) fn();
          return;
        }
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
        case 'delete-account': return UI.sheet(`<span class="big-emoji">🗑️</span><h3>DELETE YOUR ACCOUNT?</h3>
          <p class="sub">${esc(Game.state.name)} disappears from the leaderboard and every level, employee and credit goes with it. This cannot be undone.</p>
          <button class="btn cta" style="background:var(--alarm);color:#fff" data-act="delete-yes">DELETE EVERYTHING</button>
          <button class="btn ghost cta" data-close="1">KEEP MY ACCOUNT</button>`);
        case 'delete-yes': {
          Net.deleteAccount().then(() => { Net.logout(); Game.wipe(); location.reload(); });
          return;
        }
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
      const c = Game.state.roster.find(x => x.uid === d.levelup);
      // Note these BEFORE levelling: a promotion opens its own card, which is
      // also a .sheet, so afterwards we cannot tell it apart from the character
      // sheet the player may have been reading.
      const sheetWasOpen = !!document.querySelector('#modal.on');
      const rankBefore = c ? Game.rankOf(c).name : null;
      const ok = Game.levelUpChar(d.levelup);
      const promoted = ok && c && Game.rankOf(c).name !== rankBefore;
      if (ok) { UI.beep('level'); const b = t.getBoundingClientRect(); UI.sparks(b.left + b.width / 2, b.top + 10, '#4FD6C9', 14); }
      else {
        UI.beep('fail');
        if (c && Game.atMaxLevel(c)) {
          toast('🎓', 'FULLY QUALIFIED', `${c.defId === 'hero' ? Game.state.name : Game.def(c.defId).name} is at level ${Game.maxStaffLevel()} — as far as this chapter allows.`);
          return;
        }
        const short = c && (c.xp < Game.charXpNeed(c.level)
          ? `${f(Game.charXpNeed(c.level) - c.xp)} more XP — they earn it from every ticket you work`
          : `${f(Game.levelCost(c) - Game.state.credits)} more credits`);
        toast('📈', 'NOT READY YET', short || 'Needs more XP or credits.');
      }
      UI.refresh();
      // Never replace the promotion card with the character sheet.
      if (sheetWasOpen && ok && !promoted) UI.charSheet(d.levelup, { replace: true });
      return;
    }
    if (d.setactive) { Game.state.activeId = d.setactive; Game.save(); UI.closeSheet(); UI.buildStage(); UI.beep('ok'); return UI.refresh(); }
    if (d.sview) { UI.beep('tap'); return UI.setStaffView(d.sview); }
    if (d.ssort) { UI.beep('tap'); return UI.setStaffSort(d.ssort); }
    if (d.advice) {
      const a = d.advice;
      if (a === 'promote-chapter') { const btn = { dataset: { promote: '1' } }; d.promote = '1'; }
      else if (a === 'autopost') {
        const r = Game.autoPost();
        UI.beep('great');
        toast('🪑', `${r.moved} POSTED`, r.after > r.before
          ? `Idle income ${f(r.before)} → ${f(r.after)} credits an hour.`
          : 'Everybody is where they belong.');
        return UI.show('staff');
      }
      else if (a.startsWith('hire:')) {
        const id = a.slice(5);
        const c = Game.hire(id);
        if (!c) { UI.beep('fail'); return toast('💸', 'CANNOT HIRE', 'Not enough credits, no desk free, or not enough standing.'); }
        Game.autoPost();
        UI.beep('great');
        toast(Game.roleOf(c).icon, `${Game.def(id).name} JOINS`, `Posted straight to ${Game.deptDef(c.dept) ? Game.deptDef(c.dept).name : 'the floor'}.`);
        return UI.show('staff');
      }
      else if (a.startsWith('levelup:')) { d.levelup = a.slice(8); }
      else return;
    }
    if (d.promote) {
      const ch = Game.promoteChapter();
      if (!ch) return UI.beep('fail');
      UI.beep('level');
      UI.sheet(`<span class="big-emoji">${ch.icon}</span>
        <h3>PROMOTED TO ${esc(ch.name.toUpperCase())}</h3>
        <p class="sub">Chapter ${ch.n} of ${DATA.CHAPTERS.length}</p>
        <p class="tiny muted" style="text-align:center">${esc(ch.goal)}</p>
        <div class="reward-line"><span class="rw-c">${ch.capacity} DESKS</span><span class="rw-x">STAFF TO L${ch.maxLevel}</span></div>
        <button class="btn gold cta" data-close="1">GET TO WORK</button>`);
      setTimeout(() => UI.sparks(window.innerWidth / 2, window.innerHeight * .45, '#FFB347', 28), 100);
      return UI.show('staff');
    }
    if (d.retire) {
      const c = Game.state.roster.find(x => x.uid === d.retire);
      if (!c) return;
      const v = Game.retireValue(c), nm = Game.def(c.defId).name;
      return UI.sheet(`<span class="big-emoji">👋</span>
        <h3>LET ${esc(nm)} GO?</h3>
        <p class="sub">Frees a desk. There is no getting them back.</p>
        <p class="tiny muted" style="text-align:center">Everything they learned stays with the department, and you recover part of what you put into them.</p>
        <div class="reward-line"><span class="rw-c">+${f(v.credits)} CR</span><span class="rw-x">+${f(v.xp)} TRAINING XP</span>${v.legacy ? `<span class="rw-r">+${v.legacy} LEGACY</span>` : ''}</div>
        <button class="btn cta" style="background:var(--alarm);color:#fff" data-retire-yes="${d.retire}">RETIRE THEM</button>
        <button class="btn ghost cta" data-close="1">KEEP THEM</button>`);
    }
    if (d.retireYes) {
      const r = Game.retireStaff(d.retireYes);
      UI.closeSheet();
      if (r) { UI.beep('ok'); toast('👋', 'RETIRED', `${r.name} left with a good reference. +${f(r.credits)} credits recovered.`); }
      return UI.show('staff');
    }
    if (d.post) return UI.postSheet(d.post);
    if (d.deptfill) return UI.fillDeptSheet(d.deptfill);
    if (d.assign !== undefined) {
      const ok = Game.assignDept(d.who, d.assign || null);
      if (ok) {
        UI.beep('ok');
        const c = Game.state.roster.find(x => x.uid === d.who);
        const dp = c && c.dept && Game.deptDef(c.dept);
        const name = c && (c.defId === 'hero' ? Game.state.name : Game.def(c.defId).name);
        toast(dp ? dp.icon : '👤', dp ? 'POSTED TO ' + dp.name.toUpperCase() : 'UNPOSTED',
          dp ? `${name} · ${Game.deptFit(c, dp).toFixed(1)}× fit · ${dp.bonus}` : `${name} is off the department roster.`);
      } else UI.beep('fail');
      UI.closeSheet();
      return UI.show('staff');
    }
    if (d.char && !e.target.closest('[data-levelup],[data-levelmax],[data-post]')) return UI.charSheet(d.char);
    if (d.slot) return UI.pickItemSheet(d.slot);
    if (d.issue) {
      const wasSheet = !!document.querySelector('#modal.on');
      const it = Game.state.inventory.find(i => i.uid === d.issue);
      const e = it && Game.eqDef(it.eid);
      if (Game.issueStandard(d.issue)) {
        UI.beep('great');
        toast(DATA.SLOTS.find(s => s.key === e.slot).icon, 'ISSUED TO EVERYONE',
          `${e.name} is now standard for the whole department.`);
      }
      UI.closeSheet(); UI.show('gear');
      return;
    }
    if (d.withdraw) { Game.withdrawStandard(d.withdraw); UI.beep('tap'); UI.closeSheet(); return UI.show('gear'); }
    if (d.back) return UI.charSheet(d.back);
    if (d.dept) {
      const c = Game.state.roster.find(x => x.uid === d.for);
      const dp = DATA.DEPARTMENTS.find(x => x.id === d.dept);
      if (Game.state.reputation < dp.repReq) { UI.beep('fail'); return toast('🔒', 'LOCKED', `${dp.name} opens at ${f(dp.repReq)} reputation.`); }
      c.dept = c.dept === d.dept ? null : d.dept; Game.save(); UI.beep('ok'); return UI.charSheet(d.for);
    }
    if (d.levelmax) {
      const sheetWasOpen = !!document.querySelector('#modal.on');
      const c = Game.state.roster.find(x => x.uid === d.levelmax);
      const r = Game.levelUpMax(d.levelmax);
      if (!r) { UI.beep('fail'); return toast('📈', 'NOT READY YET', 'Not enough experience or budget for another level.'); }
      UI.beep('level');
      const b = t.getBoundingClientRect();
      UI.sparks(b.left + b.width / 2, b.top + 10, '#4FD6C9', 18);
      const nm = c.defId === 'hero' ? Game.state.name : Game.def(c.defId).name;
      toast('📈', `${nm} · LV.${r.from} → ${r.to}`,
        Game.isPromotion(c.level) && Game.canLevel(c)
          ? `${r.gained} levels for ${f(r.spent)} credits. They are at a rank wall — promote them when you are ready.`
          : `${r.gained} levels for ${f(r.spent)} credits.`);
      UI.refresh();
      if (sheetWasOpen) UI.charSheet(d.levelmax, { replace: true });
      return;
    }
    if (d.upgrade) {
      const ok = Game.upgradeItem(d.upgrade);
      UI.beep(ok ? 'coin' : 'fail');
      if (ok) {
        const b = t.getBoundingClientRect();
        UI.sparks(b.left + b.width / 2, b.top + 10, '#FFB347', 12);
      }
      UI.refresh();
      // upgrading from inside a standard slot should leave you looking at it
      if (d.inslot) return UI.pickItemSheet(d.inslot);
      return;
    }
    if (d.gsort) { UI.beep('tap'); return UI.setGearSort(d.gsort); }
    if (d.gview) { UI.beep('tap'); return UI.setGearView(d.gview); }
    if (d.gfilter) { UI.beep('tap'); return UI.setGearFilter(d.gfilter); }
    if (d.grarity) { UI.beep('tap'); return UI.setGearRarity(d.grarity); }
    if (d.gpick) { UI.beep('tap'); return UI.togglePicking(); }
    if (d.pick) { UI.beep('tap'); return UI.togglePick(d.pick); }
    if (d.pickall) { UI.beep('tap'); return UI.pickAll(d.pickall.split(',')); }
    if (d.disposemany) {
      const uids = UI.pickedList();
      if (!uids.length) return UI.beep('fail');
      const S = Game.state;
      const items = uids.map(u => S.inventory.find(x => x.uid === u)).filter(Boolean);
      const total = items.reduce((a, i) => a + Game.disposeValue(i), 0);
      const issued = items.filter(i => Game.isStandard(i.uid)).length;
      return UI.sheet(`<span class="big-emoji">♻️</span>
        <h3>DISPOSE OF ${items.length} ITEM${items.length > 1 ? 'S' : ''}?</h3>
        <p class="sub">Written off the asset register for good</p>
        ${issued ? `<p class="tiny" style="text-align:center;color:var(--alarm)">${issued} of these ${issued > 1 ? 'are' : 'is'} currently standard issue and will be withdrawn from the whole department.</p>` : ''}
        <div class="reward-line"><span class="rw-c">+${f(total)} IT CREDITS RECOVERED</span></div>
        <button class="btn cta" style="background:var(--alarm);color:#fff" data-disposemany-yes="1">DISPOSE OF THEM</button>
        <button class="btn ghost cta" data-close="1">KEEP THEM</button>`);
    }
    if (d.disposemanyYes) {
      const r = Game.disposeMany(UI.pickedList());
      UI.closeSheet(); UI.togglePicking();
      UI.beep('coin');
      toast('♻️', `${r.count} ITEM${r.count > 1 ? 'S' : ''} DISPOSED`,
        `${f(r.credits)} credits recovered${r.wasStandard ? ` · ${r.wasStandard} withdrawn from standard issue` : ''}.`);
      return UI.refresh();
    }
    if (d.enter) return Battle.enter(d.enter, +d.stake);
    if (d.play) return Battle.play(d.play, +d.room);
    if (d.bq != null) return Battle.answerQuiz(+d.bq);
    if (d.led != null) return Battle.pressLed(+d.led);
    if (d.scram) return Battle.submitScramble();
    if (d.fault != null) return Battle.pickFault(+d.fault);
    if (d.dispose) {
      const r = Game.disposeItem(d.dispose);
      if (r) { UI.beep('coin'); toast('♻️', 'DISPOSED', `${r.name} written off — ${f(r.back)} credits recovered.`); }
      return UI.refresh();
    }
    if (d.procure) {
      const it = Game.procure(d.procure);
      if (!it) { UI.beep('fail'); return toast('💸', 'NOT APPROVED', 'Not enough credits, or not enough standing for that one yet.'); }
      UI.beep('great');
      const e = Game.eqDef(it.eid);
      toast(DATA.SLOTS.find(x => x.key === e.slot).icon, 'PROCURED', `${e.name} is in the cupboard. Make it standard issue on this tab.`);
      return UI.refresh();
    }
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
    const dt = Game.tick();

    // The queue only runs while you are at the desk and nothing has
    // interrupted you — it never breaches behind your back.
    const atDesk = !document.hidden && UI.screen === 'hq' && !UI.isPaused();
    if (atDesk) {
      Game.tickQueue(dt);
      UI.tickQueueUI();
    }
    const dl = document.querySelector('#diagLeft');
    if (dl) {
      const open = (Game.state.queue || []).find(x => document.querySelector(`[data-diag="${x.uid}"]`));
      // the sheet is marked live, so the queue above is still ticking it down
      if (open) dl.textContent = UI.clock(open.left);
      else UI.closeSheet();
    }

    if (ts - lastUi > 900) {
      lastUi = ts;
      sweepWorking();
      UI.renderTop();
      if (UI.screen === 'hq') { UI.updateMeters(); UI.updateIdle(); UI.updateMini(); UI.updateChips(); }
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
      <p class="tiny muted" style="text-align:center">Tap <b style="color:var(--lamp)">FIX IT</b> on any ticket to work the queue. Credits hire colleagues, colleagues work the queue while you are gone, and reputation opens up the rest of the company.</p>
      <p class="tiny" style="text-align:center;color:var(--crt)">Somewhere above you, there is a CTO chair with your name on it.</p>
      <button class="btn gold cta" data-act="day-one-done">CLOCK IN</button>`);
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
    coopRefresh();
    setInterval(coopRefresh, 90000);
    eotmRefresh();
    setInterval(eotmRefresh, 300000);
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

  /* Another device (or a tab left open on a laptop) has newer progress. This
     copy stopped writing the moment it found out, so nothing here can undo it.
     Show what happened and pick up the winning save. */
  Net.onConflict = ({ state, now }) => {
    UI.beep('alarm');
    UI.sheet(`
      <span class="big-emoji">📱💻</span>
      <h3>PLAYED SOMEWHERE ELSE</h3>
      <p class="sub">This copy of the game was behind</p>
      <p class="tiny muted" style="text-align:center">You have IT Empire open on another device, and that one is further ahead. This tab has stopped saving so it cannot undo that progress. Load the newer save to carry on here.</p>
      <button class="btn gold cta" data-act="adopt-newer">LOAD THE NEWER SAVE</button>`, { dismiss: false });
    window.__newer = { state, now };
  };

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
