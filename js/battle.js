/* ============================================================
   IT EMPIRE — BATTLE
   Paid rooms and the games played in them. Everyone runs the same
   room on their own time and the best run takes the pot, so friends
   never have to be online together.
   ============================================================ */
const Battle = (() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = Game.fmt;
  const gameDef = id => BATTLE.GAMES.find(g => g.id === id);

  let board = null, loading = false, run = null;

  const ms2s = ms => (ms / 1000).toFixed(2) + 's';
  const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);

  async function api(path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const t = Net.token; if (t) headers.Authorization = 'Bearer ' + t;
    const r = await fetch('api/' + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined });
    let j = {}; try { j = await r.json(); } catch (e) { }
    return { ok: r.ok, status: r.status, ...j };
  }

  async function load(force) {
    if (!Net.online || loading) return;
    loading = true;
    const r = await api('battle');
    loading = false;
    if (r.ok) { board = r; render(); collectWins(r.wins); }
  }

  /* Winning is claimed rather than pushed, because the credits live in the
     save on this device, not on the server. */
  async function collectWins(wins) {
    if (!wins || !wins.length) return;
    for (const w of wins) {
      const r = await api('battle-claim', { room: w.room });
      if (r.ok && r.payout) {
        Game.state.credits += r.payout;
        Game.save();
        UI.beep('level');
        UI.sheet(`<span class="big-emoji">🏆</span>
          <h3>YOU TOOK THE POT</h3>
          <p class="sub">${esc(gameDef(w.game) ? gameDef(w.game).name : w.game)}</p>
          <p class="tiny muted" style="text-align:center">Nobody beat your run before the room closed.</p>
          <div class="reward-line"><span class="rw-c">+${f(r.payout)} IT CREDITS</span></div>
          <button class="btn gold cta" data-close="1">COLLECT</button>`);
      }
    }
    load();
  }

  /* ---------------- ROOM LIST ---------------- */
  function render() {
    const el = $('#screen-battle'); if (!el) return;
    if (!Net.online) {
      el.innerHTML = `<div class="sec-head"><h2>BATTLE</h2></div>
        <div class="empty"><span class="big">🏆</span>Battle rooms need an account — they are how you play against your friends. Sign in on the hosted game to take part.</div>`;
      return;
    }
    if (!board) {
      el.innerHTML = `<div class="sec-head"><h2>BATTLE</h2></div><div class="empty">Finding rooms…</div>`;
      return;
    }
    const S = Game.state;
    el.innerHTML = `
      <div class="sec-head"><h2>BATTLE</h2><span>💰 ${f(S.credits)}</span></div>
      <p class="tiny muted" style="padding:0 14px 8px;margin:0">Pay to enter, run it whenever suits you, and the best time when the room closes takes every stake in it. Your friends are racing the same room on their own schedule.</p>
      <div class="list">${board.rooms.map(r => {
      const g = gameDef(r.game); if (!g) return '';
      const mine = r.entries.find(e => e.mine);
      const ranked = r.entries.filter(e => e.ms != null);
      const closes = r.closes ? new Date(r.closes).getTime() - Date.now() : 0;
      const canPay = S.credits >= (r.stake || g.stake);
      return `<div class="room">
          <div class="room-top">
            <span class="room-ico">${g.icon}</span>
            <div style="flex:1;min-width:0">
              <h3>${esc(g.name)}</h3>
              <div class="room-sub">${r.entries.length} in · pot <b>${f(r.pot || 0)}</b></div>
            </div>
            <div class="room-stake"><b>${f(r.stake || g.stake)}</b><small>to enter</small></div>
          </div>
          <p class="room-blurb">${esc(g.blurb)}</p>
          ${ranked.length ? `<div class="ladder">${ranked.slice(0, 5).map((e, i) => `
            <div class="lrow ${e.mine ? 'me' : ''}">
              <span class="lpos">${i + 1}</span>
              <span class="lname">${esc(e.name)}${e.mine ? ' · you' : ''}</span>
              <span class="ltime">${ms2s(e.ms)}</span>
            </div>`).join('')}</div>` : '<div class="ladder empty-l">No times posted yet. Set one.</div>'}
          <div class="room-foot">
            <span class="tiny muted">${!r.id ? 'opens when you enter'
          : closes > 0 ? 'closes in ' + Game.fmtTime(closes / 1000) : 'settling now'}</span>
            ${r.played ? `<span class="tiny" style="color:var(--good)">your time is in — ${ms2s(mine.ms)}</span>`
          : r.joined ? `<button class="btn teal sm" data-play="${r.game}" data-room="${r.id}">PLAY YOUR RUN</button>`
            : `<button class="btn gold sm ${canPay ? '' : 'off'}" data-enter="${r.game}" data-stake="${r.stake || g.stake}">ENTER · 💰${f(r.stake || g.stake)}</button>`}
          </div>
        </div>`;
    }).join('')}</div>
      ${board.recent && board.recent.length ? `
        <div class="sec-head"><h2>RECENT WINNERS</h2></div>
        <div class="list"><div class="card col">${board.recent.map(w => `
          <div class="recent"><span>${(gameDef(w.game) || {}).icon || '🏆'}</span>
            <b>${esc(w.name)}</b> took ${f(w.payout)} in ${esc((gameDef(w.game) || {}).name || w.game)}</div>`).join('')}
        </div></div>` : ''}
      <div style="height:14px"></div>`;
  }

  /* ---------------- ENTERING ---------------- */
  async function enter(game, stake) {
    const S = Game.state;
    if (S.credits < stake) { UI.beep('fail'); return; }
    const r = await api('battle-enter', { game, stake });
    if (!r.ok) { UI.beep('fail'); return UI.sheet(`<h3>COULD NOT ENTER</h3><p class="sub">${esc(r.error || 'Try again.')}</p><button class="btn ghost cta" data-close="1">OK</button>`); }
    S.credits -= stake;                     // the stake is committed
    Game.save(); Net.flush(true);
    UI.beep('coin');
    await load();
    play(game, r.room);
  }

  /* ---------------- THE GAMES ---------------- */
  function frame(inner, opts = {}) {
    UI.sheet(`<div class="bgame">${inner}</div>`, { dismiss: false, grab: false, live: true, ...opts });
  }

  function start(game, room, rounds) {
    run = { game, room, rounds, i: 0, t0: performance.now(), penalty: 0, wrong: 0 };
  }
  const elapsed = () => Math.round(performance.now() - run.t0 + run.penalty);

  async function finish() {
    const ms = elapsed();
    const r = await api('battle-score', { room: run.room, ms });
    UI.beep(r.ok ? 'great' : 'fail');
    const g = gameDef(run.game);
    UI.sheet(`<span class="big-emoji">${g.icon}</span>
      <h3>RUN COMPLETE</h3>
      <p class="sub">${esc(g.name)}</p>
      <div class="bigtime">${ms2s(ms)}</div>
      ${run.wrong ? `<p class="tiny muted" style="text-align:center">${run.wrong} wrong · ${(run.penalty / 1000)}s of penalties included</p>`
      : '<p class="tiny" style="text-align:center;color:var(--good)">Clean run — no penalties</p>'}
      <p class="tiny muted" style="text-align:center">Your time is on the board. The pot pays out when the room closes.</p>
      <button class="btn gold cta" data-close="1">DONE</button>`);
    run = null;
    load();
  }

  function penalise() {
    run.penalty += BATTLE.PENALTY_MS; run.wrong++;
    UI.beep('fail'); UI.shake();
  }

  function head(title, sub) {
    return `<div class="bg-head"><div><h3>${esc(title)}</h3><div class="bg-sub">${esc(sub)}</div></div>
      <div class="bg-clock" id="bgClock">0.0s</div></div>
      <div class="bg-bar"><span style="width:${run.i / run.rounds * 100}%"></span></div>`;
  }

  /* --- 1. Certification exam --- */
  function playQuiz() {
    if (run.i >= run.rounds) return finish();
    const q = run.set[run.i];
    frame(`${head('Certification Exam', `Question ${run.i + 1} of ${run.rounds} · ${q.src}`)}
      <p class="bq">${esc(q.q)}</p>
      ${q.order.map((oi, n) => `<button class="bopt" data-bq="${n}">${esc(q.o[oi])}</button>`).join('')}
      <p class="bg-note">A wrong answer costs five seconds.</p>`);
  }
  function answerQuiz(n) {
    const q = run.set[run.i];
    const correct = q.order[n] === q.a;
    const btns = document.querySelectorAll('[data-bq]');
    btns.forEach((b, k) => { if (q.order[k] === q.a) b.classList.add('right'); });
    if (!correct) { btns[n].classList.add('wrong'); penalise(); } else UI.beep('ok');
    btns.forEach(b => b.disabled = true);
    setTimeout(() => { run.i++; playQuiz(); }, correct ? 320 : 900);
  }

  /* --- 2. Rack memory rush --- */
  function playMemory() {
    if (run.i >= run.rounds) return finish();
    run.seq = run.seq || [];
    run.seq.push(Math.floor(Math.random() * 6));
    run.input = [];
    frame(`${head('Rack Memory Rush', `Sequence ${run.i + 1} of ${run.rounds} · ${run.seq.length} lights`)}
      <div class="rack">${Array.from({ length: 6 }, (_, k) =>
      `<button class="led-btn" data-led="${k}" disabled></button>`).join('')}</div>
      <p class="bg-note" id="memNote">Watch…</p>`);
    showSequence();
  }
  function showSequence() {
    const btns = [...document.querySelectorAll('[data-led]')];
    let k = 0;
    const step = () => {
      if (k >= run.seq.length) {
        btns.forEach(b => b.disabled = false);
        const n = document.querySelector('#memNote'); if (n) n.textContent = 'Now repeat it';
        return;
      }
      const b = btns[run.seq[k]];
      if (b) { b.classList.add('lit'); setTimeout(() => b.classList.remove('lit'), 330); }
      k++;
      setTimeout(step, 480);
    };
    setTimeout(step, 420);
  }
  function pressLed(k) {
    const btns = [...document.querySelectorAll('[data-led]')];
    const b = btns[k]; if (b) { b.classList.add('lit'); setTimeout(() => b.classList.remove('lit'), 180); }
    run.input.push(k);
    const idx = run.input.length - 1;
    if (run.input[idx] !== run.seq[idx]) {
      penalise();
      run.input = []; run.seq.pop();          // that round does not count, try again
      btns.forEach(x => x.disabled = true);
      setTimeout(() => playMemory(), 700);
      return;
    }
    UI.beep('tap');
    if (run.input.length === run.seq.length) {
      btns.forEach(x => x.disabled = true);
      run.i++;
      setTimeout(() => playMemory(), 420);
    }
  }

  /* --- 3. Cable scramble --- */
  function playScramble() {
    if (run.i >= run.rounds) return finish();
    const item = run.set[run.i];
    frame(`${head('Cable Scramble', `Term ${run.i + 1} of ${run.rounds}`)}
      <div class="scram">${item.mixed.split('').map(ch => `<span>${ch}</span>`).join('')}</div>
      <p class="bq" style="text-align:center;font-size:13px;color:var(--muted)">${esc(item.hint)}</p>
      <input class="bg-input" id="scramIn" autocomplete="off" autocapitalize="characters"
        spellcheck="false" placeholder="type the term">
      <button class="btn teal cta" data-scram="1">SUBMIT</button>
      <p class="bg-note">A wrong guess costs five seconds.</p>`);
    setTimeout(() => { const i = document.querySelector('#scramIn'); if (i) i.focus(); }, 60);
  }
  function submitScramble() {
    const el = document.querySelector('#scramIn'); if (!el) return;
    const guess = (el.value || '').trim().toUpperCase();
    if (!guess) return;
    if (guess === run.set[run.i].w) { UI.beep('ok'); run.i++; playScramble(); }
    else { penalise(); el.value = ''; el.classList.add('bad'); setTimeout(() => el.classList.remove('bad'), 400); }
  }

  /* --- 4. Spot the fault --- */
  function playFault() {
    if (run.i >= run.rounds) return finish();
    const c = run.set[run.i];
    frame(`${head('Spot The Fault', `Config ${run.i + 1} of ${run.rounds} · ${c.title}`)}
      <p class="bq" style="font-size:12.5px;color:var(--muted)">One line was changed. Tap it.</p>
      <div class="cfg">${c.shown.map((l, k) => `<button class="cfgline" data-fault="${k}">${esc(l)}</button>`).join('')}</div>
      <p class="bg-note">A wrong pick costs five seconds.</p>`);
  }
  function pickFault(k) {
    const c = run.set[run.i];
    if (k === c.bad) {
      UI.beep('ok');
      const b = document.querySelector(`[data-fault="${k}"]`); if (b) b.classList.add('right');
      run.i++; setTimeout(() => playFault(), 350);
    } else {
      penalise();
      const b = document.querySelector(`[data-fault="${k}"]`);
      if (b) { b.classList.add('wrong'); b.disabled = true; }
    }
  }

  /* ---------------- LAUNCH ---------------- */
  function play(game, room) {
    const g = gameDef(game);
    start(game, room, g.rounds);
    if (game === 'quiz') {
      run.set = shuffle(BATTLE.QUIZ).slice(0, g.rounds).map(q => ({ ...q, order: shuffle([0, 1, 2, 3]) }));
      playQuiz();
    } else if (game === 'memory') {
      playMemory();
    } else if (game === 'scramble') {
      run.set = shuffle(BATTLE.SCRAMBLE).slice(0, g.rounds).map(s => {
        let mixed = s.w;
        while (mixed === s.w) mixed = shuffle(s.w.split('')).join('');
        return { ...s, mixed };
      });
      playScramble();
    } else if (game === 'fault') {
      run.set = shuffle(BATTLE.FAULTS).slice(0, g.rounds).map(c => {
        const shown = [...c.lines]; shown[c.bad] = c.now;
        return { ...c, shown };
      });
      playFault();
    }
    tickClock();
  }

  function tickClock() {
    const el = document.querySelector('#bgClock');
    if (!el || !run) return;
    el.textContent = ((performance.now() - run.t0 + run.penalty) / 1000).toFixed(1) + 's';
    requestAnimationFrame(tickClock);
  }

  return { load, render, enter, play, answerQuiz, pressLed, submitScramble, pickFault,
           get running() { return !!run; } };
})();
