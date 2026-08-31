/* ============================================================
   IT EMPIRE — ONBOARDING
   The sign-in gate and the character creator. Both render into
   #gate, a full-screen layer that sits over the game until the
   player has an identity and a technician of their own.
   ============================================================ */
const Onboard = (() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const gate = () => $('#gate');

  const show = html => { const g = gate(); g.innerHTML = html; g.classList.add('on'); g.scrollTop = 0; };
  const hide = () => { const g = gate(); g.classList.remove('on'); g.innerHTML = ''; };

  const LOGO = `<div class="gate-logo">
      <div class="gate-mark">🔧</div>
      <h1>IT EMPIRE</h1>
      <p>One desk. One screwdriver. A queue that never ends.</p>
    </div>`;

  /* ================= SIGN IN ================= */
  let mode = 'login';                 // 'login' | 'signup'
  function auth(onDone, opts = {}) {
    const signup = mode === 'signup';
    show(`<div class="gate-inner">
      ${LOGO}
      <div class="gate-card">
        <div class="seg">
          <button class="seg-btn ${!signup ? 'on' : ''}" data-mode="login">SIGN IN</button>
          <button class="seg-btn ${signup ? 'on' : ''}" data-mode="signup">NEW STARTER</button>
        </div>
        <label class="fld"><span>TECHNICIAN NAME</span>
          <input id="fName" type="text" autocomplete="username" maxlength="18"
            placeholder="the name on your badge" autocapitalize="characters"></label>
        <label class="fld"><span>PASSWORD</span>
          <input id="fPass" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}"
            maxlength="72" placeholder="${signup ? 'at least 6 characters' : ''}"></label>
        <p class="gate-err" id="gErr">${opts.error ? esc(opts.error) : ''}</p>
        <button class="btn gold cta" id="gGo">${signup ? 'CREATE MY ACCOUNT' : 'CLOCK IN'}</button>
        <p class="gate-note">${signup
        ? 'Your progress is saved to the server, so you can carry on from any phone or laptop — and your friends can see you climbing the company ladder.'
        : 'Signing in on a new device picks up exactly where you left off.'}</p>
      </div>
    </div>`);

    const go = async () => {
      const name = $('#fName').value.trim();
      const pass = $('#fPass').value;
      const err = m => { $('#gErr').textContent = m; $('#gErr').classList.add('shownow'); };
      if (name.length < 2) return err('Pick a name of at least 2 characters.');
      if (pass.length < (signup ? 6 : 1)) return err('Passwords need at least 6 characters.');
      $('#gGo').disabled = true; $('#gGo').textContent = 'CONNECTING…';
      if (signup) {
        // A new starter builds their technician first, then the account is created.
        creator(async profile => {
          const r = await Net.signup(name, pass, profile);
          if (!r.ok) { mode = 'signup'; auth(onDone, { error: r.error }); return; }
          onDone(r);
        }, { name: name.toUpperCase(), lockName: true, back: () => { mode = 'signup'; auth(onDone); } });
      } else {
        const r = await Net.login(name, pass);
        if (!r.ok) { $('#gGo').disabled = false; $('#gGo').textContent = 'CLOCK IN'; return err(r.error); }
        onDone(r);
      }
    };

    $('#gGo').onclick = go;
    $('#fPass').onkeydown = e => { if (e.key === 'Enter') go(); };
    $('#fName').onkeydown = e => { if (e.key === 'Enter') $('#fPass').focus(); };
    gate().querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { mode = b.dataset.mode; auth(onDone); });
  }

  /* ================= CHARACTER CREATOR ================= */
  function creator(onDone, opts = {}) {
    const C = DATA.CREATOR;
    const art = {
      skin: C.skin[Math.floor(Math.random() * C.skin.length)],
      hair: C.hair[Math.floor(Math.random() * C.hair.length)],
      hairStyle: C.styles[Math.floor(Math.random() * C.styles.length)].key,
      shirt: C.shirt[Math.floor(Math.random() * C.shirt.length)],
      accent: '#2B4EA8', glasses: true, headset: false, beard: false,
    };
    const sync = () => { art.accent = Art.shade(art.shirt, -45); };
    sync();
    let spec = 'fixer';
    let name = (opts.name || '').toUpperCase();

    const swatches = (list, key) => list.map(c =>
      `<button class="sw ${art[key] === c ? 'on' : ''}" data-set="${key}" data-val="${c}"
        style="background:${c}" aria-label="colour ${c}"></button>`).join('');

    function render() {
      show(`<div class="gate-inner">
        <div class="gate-logo tight"><h1>YOUR TECHNICIAN</h1>
          <p>This is you. Every player builds their own — no two desks look alike.</p></div>

        <div class="creator-stage">
          <div class="creator-glow"></div>
          <svg class="creator-svg" viewBox="0 0 160 250" xmlns="http://www.w3.org/2000/svg" id="cPrev">
            ${Art.person(art, { id: 'cr' + Date.now() })}
          </svg>
          <button class="btn sm ghost dice" data-act="random">🎲 SURPRISE ME</button>
        </div>

        <div class="gate-card">
          ${opts.lockName
          ? `<div class="fld locked"><span>NAME ON THE BADGE</span><b>${esc(name)}</b></div>`
          : `<label class="fld"><span>NAME ON THE BADGE</span>
            <input id="cName" type="text" maxlength="14" value="${esc(name)}"
              placeholder="e.g. SAM" autocapitalize="characters"></label>`}

          <div class="opt"><span class="opt-lbl">SKIN</span><div class="sws">${swatches(C.skin, 'skin')}</div></div>
          <div class="opt"><span class="opt-lbl">HAIR</span><div class="sws">${swatches(C.hair, 'hair')}</div></div>
          <div class="opt"><span class="opt-lbl">STYLE</span><div class="sws wrap">
            ${C.styles.map(st => `<button class="pill ${art.hairStyle === st.key ? 'on' : ''}" data-set="hairStyle" data-val="${st.key}">${st.label}</button>`).join('')}
          </div></div>
          <div class="opt"><span class="opt-lbl">SHIRT</span><div class="sws">${swatches(C.shirt, 'shirt')}</div></div>
          <div class="opt"><span class="opt-lbl">EXTRAS</span><div class="sws wrap">
            <button class="pill ${art.glasses ? 'on' : ''}" data-toggle="glasses">👓 Glasses</button>
            <button class="pill ${art.headset ? 'on' : ''}" data-toggle="headset">🎧 Headset</button>
            <button class="pill ${art.beard ? 'on' : ''}" data-toggle="beard">🧔 Beard</button>
          </div></div>
        </div>

        <div class="gate-logo tight"><h1>YOUR STARTING PATH</h1>
          <p>What kind of technician are you? This shapes your whole run — pick the one that sounds like you.</p></div>
        <div class="spec-list">
          ${C.specs.map(sp => `<button class="spec ${spec === sp.id ? 'on' : ''}" data-spec="${sp.id}">
            <div class="spec-top"><span class="spec-ico">${sp.icon}</span>
              <div><h3>${esc(sp.name)}</h3><div class="spec-tag">${esc(sp.tag)}</div></div>
              <span class="spec-tick">${spec === sp.id ? '✓' : ''}</span></div>
            <p class="spec-blurb">${esc(sp.blurb)}</p>
            <div class="spec-pro">＋ ${esc(sp.strength)}</div>
            <div class="spec-con">－ ${esc(sp.weakness)}</div>
          </button>`).join('')}
        </div>

        <p class="gate-err" id="cErr"></p>
        <button class="btn gold cta big" id="cGo">START YOUR FIRST SHIFT</button>
        ${opts.back ? '<button class="btn ghost cta" data-act="back">BACK</button>' : ''}
        <div style="height:20px"></div>
      </div>`);

      const preview = () => { $('#cPrev').innerHTML = Art.person(art, { id: 'cr' + Math.random().toString(36).slice(2, 6) }); };

      gate().querySelectorAll('[data-set]').forEach(b => b.onclick = () => {
        art[b.dataset.set] = b.dataset.val; sync(); render();
      });
      gate().querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => {
        art[b.dataset.toggle] = !art[b.dataset.toggle]; render();
      });
      gate().querySelectorAll('[data-spec]').forEach(b => b.onclick = () => { spec = b.dataset.spec; render(); });
      const dice = gate().querySelector('[data-act="random"]');
      if (dice) dice.onclick = () => {
        art.skin = C.skin[Math.floor(Math.random() * C.skin.length)];
        art.hair = C.hair[Math.floor(Math.random() * C.hair.length)];
        art.shirt = C.shirt[Math.floor(Math.random() * C.shirt.length)];
        art.hairStyle = C.styles[Math.floor(Math.random() * C.styles.length)].key;
        art.glasses = Math.random() < .5; art.headset = Math.random() < .4; art.beard = Math.random() < .3;
        sync(); render();
      };
      const back = gate().querySelector('[data-act="back"]');
      if (back) back.onclick = opts.back;

      const nameField = $('#cName');
      if (nameField) nameField.oninput = e => { name = e.target.value.toUpperCase(); e.target.value = name; };
      $('#cGo').onclick = () => {
        const n = (nameField ? nameField.value : name || '').trim().toUpperCase();
        if (n.length < 2) { $('#cErr').textContent = 'Give your technician a name first.'; return; }
        $('#cGo').disabled = true; $('#cGo').textContent = 'CLOCKING IN…';
        onDone({ name: n, art, spec });
      };
    }
    render();
  }

  return { auth, creator, show, hide, gate };
})();
