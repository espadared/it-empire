/* ============================================================
   IT EMPIRE — GAME LAYER
   State, economy, ticket loop, idle engine, save/load.
   No DOM here. UI subscribes via Game.on().
   ============================================================ */
const Game = (() => {

  const SAVE_KEY = 'it-empire-save-v1';
  const listeners = {};
  const on = (evt, fn) => (listeners[evt] = listeners[evt] || []).push(fn);
  const emit = (evt, payload) => (listeners[evt] || []).forEach(f => f(payload));

  let S = null;                       // the state object
  let uidSeq = 1;
  const uid = () => 'u' + (uidSeq++) + Math.random().toString(36).slice(2, 5);

  /* ---------------- HELPERS ---------------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  /* Pick from a pool while avoiding the last few, so variety is actually felt
     rather than merely existing in the data. */
  function pickFresh(pool, recent, keep) {
    const fresh = pool.filter(x => !recent.includes(x.id));
    const chosen = pick(fresh.length ? fresh : pool);
    recent.push(chosen.id);
    while (recent.length > keep) recent.shift();
    return chosen;
  }
  function def(id) {
    const base = DATA.CHARACTERS.find(c => c.id === id);
    if (id !== 'hero' || !S || !S.hero) return base;
    const sp = DATA.spec(S.hero.spec);
    const stats = { ...base.base };
    Object.entries(sp.stats || {}).forEach(([k, v]) => { stats[k] += v; });
    return {
      ...base, name: S.name, art: S.hero.art, base: stats,
      role: sp.tag, strength: sp.strength, weakness: sp.weakness,
      personality: sp.blurb, perks: { ...base.perks, ...sp.perks },
    };
  }
  const eqDef = id => DATA.EQUIPMENT.find(e => e.id === id);
  const bDef = id => DATA.BUILDINGS.find(b => b.id === id);

  function fmt(n) {
    n = Math.floor(n);
    if (n < 1000) return '' + n;
    if (n < 1e6) return (n / 1e3).toFixed(n < 1e4 ? 1 : 0).replace(/\.0$/, '') + 'K';
    if (n < 1e9) return (n / 1e6).toFixed(n < 1e7 ? 2 : 1).replace(/\.0$/, '') + 'M';
    if (n < 1e12) return (n / 1e9).toFixed(2).replace(/\.00$/, '') + 'B';
    return (n / 1e12).toFixed(2) + 'T';
  }
  const fmtTime = s => {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return h ? `${h}h ${m}m` : m ? `${m}m ${x}s` : `${x}s`;
  };

  const xpNeed = lvl => Math.floor(70 * Math.pow(lvl, 1.62) + 45 * lvl);
  /* Steeper than it was: the last ranks should be a project, not an evening.
     Crossing into a new career rank is a promotion and costs four times as
     much, which is what makes a rank feel like a rank. */
  const charXpNeed = lvl => Math.floor(55 * Math.pow(lvl, 1.8) + 40 * lvl);
  const isPromotion = lvl => !!DATA.RANKS_STAFF.find(r => r.at === lvl + 1);

  const title = lvl => { let t = DATA.TITLES[0].name; DATA.TITLES.forEach(x => { if (lvl >= x.level) t = x.name; }); return t; };
  const rank = rep => { let r = DATA.RANKS[0]; DATA.RANKS.forEach(x => { if (rep >= x.at) r = x; }); return r; };
  const nextRank = rep => DATA.RANKS.find(x => rep < x.at) || null;

  /* ---------------- NEW GAME ---------------- */
  function newGame(keep, profile) {
    const hero = mkChar('hero', 1);
    const p = profile || (keep && keep.hero ? { name: keep.name, ...keep.hero } : null)
      || { name: 'JASON', spec: 'fixer', art: { ...DATA.CHARACTERS[0].art } };
    S = {
      v: 1,
      name: p.name,
      hero: { spec: p.spec, art: p.art },
      level: 1, xp: 0,
      credits: 120, reputation: 0,
      energy: 100, energyMax: 100, energyAcc: 0,
      roster: [hero], activeId: hero.uid,
      inventory: [mkItem('lap_basic'), mkItem('kb_sticky'), mkItem(DATA.spec(p.spec).kit)],
      standard: {},
      buildings: { helpdesk: 1 },
      dept: {},
      queue: [], streak: 0, chapter: 1,
      momentum: 0, morale: 75, busy: {}, lastAction: 0,
      quotaLeft: DATA.QUOTA.perHour, quotaEnds: 0,
      idleAcc: { t: 0, c: 0, x: 0, r: 0, gear: 0, inc: 0 },
      event: null, eventAt: Date.now() + 150000,
      incident: null, incidentAt: Date.now() + 180000,
      recentEvents: [], recentIncidents: [],
      solveTimes: [], sinceDiag: 0, lastWasDiag: false,
      missions: null, missionsAt: 0,
      md: {},                                  // daily mission counters
      lifetime: { tickets: 0, credits: 0, xp: 0, incidents: 0, happy: 0, levelups: 0, builds: 0, monday: 0, reorgs: 0, peak: 0, streak: 0, cat: {},
                   breaches: 0, escalated: 0, delegated: 0, diagnosed: 0 },
      achievements: {},
      legacy: keep ? keep.legacy : 0,
      legacySpent: keep ? keep.legacySpent : {},
      unlocked: keep ? keep.unlocked : { hero: true },
      reorgs: keep ? keep.reorgs : 0,
      lastTick: Date.now(), started: Date.now(),
    };
    if (keep) { S.lifetime.reorgs = keep.reorgs; S.achievements = keep.achievements; S.lifetime.tickets = keep.tickets; }
    rollMissions();
    fillQueue();
    return S;
  }

  function mkChar(defId, lvl) {
    const d = def(defId);
    return { uid: uid(), defId, level: lvl || 1, xp: 0, rarity: d.rarity, equip: {}, dept: null };
  }
  function mkItem(eid, lvl) {
    return { uid: uid(), eid, level: lvl || 1, on: null };
  }

  /* ---------------- CHARACTER MATH ---------------- */
  function charStats(c) {
    const d = def(c.defId), out = {};
    const growthBonus = 1 + legacyVal('l_growth');
    DATA.STATS.forEach(s => {
      out[s] = Math.round((d.base[s] + d.growth[s] * (c.level - 1) * growthBonus) * DATA.RARITY[c.rarity].mult);
    });
    // Standard issue: whatever the department has decided everyone carries.
    // Nobody has a personal loadout — that is the point of a standard.
    standardItems().forEach(it => {
      const e = eqDef(it.eid); if (!e || !e.stats) return;
      Object.entries(e.stats).forEach(([k, v]) => { out[k] = (out[k] || 0) + Math.round(v * (1 + (it.level - 1) * 0.25)); });
    });
    return out;
  }
  function charPower(c) {
    const st = charStats(c);
    let p = 0;
    DATA.STATS.forEach(s => p += st[s]);
    p = p * 6 + c.level * 12;
    const d = def(c.defId);
    if (d.perks.power) p *= (1 + d.perks.power);
    if (d.perks.all) p *= (1 + d.perks.all);
    return Math.round(p);
  }
  const active = () => S.roster.find(c => c.uid === S.activeId) || S.roster[0];
  const staff = () => S.roster.filter(c => c.uid !== S.activeId);
  const teamPower = () => S.roster.reduce((a, c) => a + charPower(c), 0);

  /* ---------------- BONUS AGGREGATION ---------------- */
  /* First of a kind is worth full value; after that, sharply less. */
  const DUP_SHARE = [1, 0.4, 0.15, 0.06];
  /* Bodies decay more gently than perks — a fourth Automation Expert should
     still be worth hiring, just clearly worse than a first Support. */
  const BODY_SHARE = [1, 0.8, 0.6, 0.45, 0.32, 0.22];

  /* Where this person sits among the others of their kind. */
  function dupShare(c) {
    let n = 0;
    for (const x of S.roster) {
      if (x.defId === c.defId) { n++; if (x.uid === c.uid) break; }
    }
    return BODY_SHARE[Math.min(n, BODY_SHARE.length) - 1];
  }

  function legacyVal(id) {
    const l = DATA.LEGACY.find(x => x.id === id);
    return (S.legacySpent[id] || 0) * l.per;
  }
  function bonus(key) {
    let b = 1;
    // buildings
    DATA.BUILDINGS.forEach(bd => {
      const lv = S.buildings[bd.id] || 0; if (!lv) return;
      if (bd.key === key) b += bd.per * lv;
      if (bd.key === 'all') b += bd.per * lv;
    });
    /* Staff perks. A second copy of the same person is worth much less than
       the first and a fourth is nearly nothing — otherwise the whole game is
       "hire nine of whoever is best", which is not a department. */
    const seen = {};
    S.roster.forEach(c => {
      const n = (seen[c.defId] = (seen[c.defId] || 0) + 1);
      const share = DUP_SHARE[Math.min(n, DUP_SHARE.length) - 1];
      const p = def(c.defId).perks || {};
      if (p[key]) b += p[key] * share;
      if (p.all && key !== 'energy') b += p.all * share;
    });
    // standard issue perks — counted once for the whole department
    standardItems().forEach(it => {
      const e = eqDef(it.eid); const p = e && e.perks;
      if (p && p[key]) b += p[key];
    });
    // event modifiers
    if (S.event && S.event.mods[key] != null) b *= S.event.mods[key];
    // legacy
    if (key === 'xp') b += legacyVal('l_xp');
    if (key === 'credit') b += legacyVal('l_cred');
    if (key === 'idle') b += legacyVal('l_idle');
    if (key === 'automation') b += legacyVal('l_auto');
    return Math.max(0.05, b);
  }

  /* ---------------- TICKETS ----------------
     Three tickets sit in the queue at once, each with its own clock. You
     cannot work them all: you choose who waits, and anyone who waits too
     long breaches. The valuable tickets are the impatient ones.        */
  const TIER = {
    EASY:   { n: 1, stars: 1, credits: 14,  xp: 22,  rep: 1, energy: 2 },
    MEDIUM: { n: 2, stars: 3, credits: 48,  xp: 62,  rep: 3, energy: 4 },
    HARD:   { n: 3, stars: 5, credits: 170, xp: 190, rep: 9, energy: 7 },
  };
  const QUEUE_SIZE = 3;

  /* Momentum: a run of good calls is worth more than the calls themselves.
     It bleeds away the moment you stop, so it rewards being present rather
     than being fast. */
  const MOMENTUM_MAX = 100;
  const momentumMult = () => 1 + (S.momentum / MOMENTUM_MAX) * 1.5;   // 1.0 → 2.5

  /* Morale: what your users think of the department. Breaches and botched
     fixes cost it, and everything you earn is scaled by it. */
  const moraleMult = () => 0.55 + (S.morale / 100) * 0.9;             // 0.55 → 1.45

  function tierRoll() {
    const l = S.level;
    const wHard = l < 5 ? 0 : Math.min(0.32, (l - 4) * 0.025);
    const wMed = l < 2 ? 0 : Math.min(0.48, (l - 1) * 0.07);
    const r = Math.random();
    if (r < wHard) return 'HARD';
    if (r < wHard + wMed) return 'MEDIUM';
    return 'EASY';
  }

  /* ---------------- YOUR HOURLY ALLOWANCE ----------------
     You work thirty tickets an hour by hand. The hour starts the moment you
     work your first one; when it runs out the allowance comes back in full.
     The automated queue never stops, so the reason to come back is that your
     team has been earning the whole time. */
  const quotaMax = () => DATA.QUOTA.perHour + (S.buildings.break || 0) * DATA.QUOTA.perBreakRoom;
  const quotaLeft = () => Math.max(0, Math.min(S.quotaLeft == null ? quotaMax() : S.quotaLeft, quotaMax()));
  const quotaResetIn = () => Math.max(0, ((S.quotaEnds || 0) - Date.now()) / 1000);
  const hasQuota = () => quotaLeft() > 0;

  /* Called every tick: when the hour is up, everything comes back. */
  function refreshQuota() {
    if (!S.quotaEnds) return false;
    if (Date.now() < S.quotaEnds) return false;
    S.quotaLeft = quotaMax();
    S.quotaEnds = 0;
    emit('quotarefresh', { allowance: S.quotaLeft });
    emit('change');
    return true;
  }

  function spendQuota(n) {
    if (S.quotaLeft == null) S.quotaLeft = quotaMax();
    if (!S.quotaEnds) S.quotaEnds = Date.now() + DATA.QUOTA.windowMs;   // the hour starts now
    S.quotaLeft = Math.max(0, S.quotaLeft - (n || 1));
    if (S.quotaLeft === 0) emit('quotaspent', { back: quotaResetIn() });
    return S.quotaLeft;
  }

  function grantQuota(n) {
    S.quotaLeft = Math.min(quotaMax(), (S.quotaLeft == null ? quotaMax() : S.quotaLeft) + n);
    emit('change');
    return S.quotaLeft;
  }

  /* What falls out of a ticket. Better tickets can drop better gear. */
  function dropItem(tier) {
    const pool = DATA.EQUIPMENT.filter(e => {
      const o = DATA.RARITY[e.rarity].order;
      if (tier === 'EASY') return o <= 1;
      if (tier === 'MEDIUM') return o <= 2 || (o === 3 && Math.random() < 0.25);
      return o >= 1 || Math.random() < 0.3;
    });
    // Prefer kit the department does not already own — a second identical item
    // is worthless when everyone wears the same standard.
    const fresh = pool.filter(x => !ownsItem(x.id));
    const e = pick(fresh.length ? fresh : (pool.length ? pool : DATA.EQUIPMENT));
    const it = mkItem(e.id);
    S.inventory.push(it);
    return it;
  }

  /* Resolutions in the last minute — a plain read on how hard you are working
     right now, used to decide how often a real puzzle should turn up. */
  function playTempo() {
    const now = Date.now();
    S.solveTimes = (S.solveTimes || []).filter(t => now - t < 60000);
    return S.solveTimes.length;
  }

  /* Someone hammering through the queue is in the mood for a puzzle; someone
     dipping in for a minute is not. The rate follows the player. A pity
     counter guarantees one eventually, so a bad run of luck cannot hide them
     completely. */
  function diagnoseChance() {
    const lean = 0.72 + Math.min(1, playTempo() / 14) * 0.9;
    return clamp(DATA.DIAGNOSE_CHANCE * lean, DATA.DIAGNOSE_MIN, DATA.DIAGNOSE_MAX);
  }

  function rollDiagnosis(hasCauses) {
    if (!hasCauses) return false;
    S.sinceDiag = (S.sinceDiag || 0) + 1;
    const due = S.sinceDiag >= DATA.DIAGNOSE_PITY;
    // two in a row reads as a glitch rather than a run of bad luck
    const damp = S.lastWasDiag ? 0.35 : 1;
    const hit = due || Math.random() < diagnoseChance() * damp;
    S.lastWasDiag = hit;
    if (hit) S.sinceDiag = 0;
    return hit;
  }

  function makeTicket() {
    const tier = tierRoll();
    // Don't put the same problem in the queue twice — it reads as a bug.
    const taken = new Set((S.queue || []).map(x => x.name));
    const pool = DATA.TICKETS[tier].filter(x => !taken.has(x.name));
    const t = pick(pool.length ? pool : DATA.TICKETS[tier]);
    const sla = DATA.SLA[tier] * bonus('sla');
    return {
      uid: uid(), id: 'INC' + (100000 + Math.floor(Math.random() * 899999)),
      tier, ...t,
      // Most tickets are a known fix. Occasionally one genuinely needs working
      // out — decided per ticket, and more often the harder you are working.
      diagnose: rollDiagnosis(!!(t.causes && t.causes.length)),
      flavour: pick(DATA.TICKET_FLAVOUR),
      sla, left: sla, born: Date.now(),
    };
  }

  function fillQueue() {
    S.queue = S.queue || [];
    while (S.queue.length < QUEUE_SIZE) S.queue.push(makeTicket());
    return S.queue;
  }
  const ticketBy = tuid => (S.queue || []).find(t => t.uid === tuid);

  /* Only runs while you are actually at the desk — the queue does not
     breach behind your back while the tab is closed. */
  function tickQueue(dt) {
    if (!S.queue) fillQueue();
    // Nothing breaches while your allowance is spent — you are not allowed to
    // work them, so it would be unfair to punish you for not working them.
    if (!hasQuota()) { fillQueue(); return []; }
    if (Date.now() - (S.lastAction || 0) > 3000)
      S.momentum = Math.max(0, S.momentum - 5.5 * dt);
    const breached = [];
    for (let i = S.queue.length - 1; i >= 0; i--) {
      const t = S.queue[i];
      t.left -= dt;
      if (t.left <= 0) { breached.push(t); S.queue.splice(i, 1); }
    }
    breached.forEach(breach);
    fillQueue();
    return breached;
  }

  function breach(t) {
    const T = TIER[t.tier];
    const lost = Math.max(1, Math.round(T.rep * 0.8));
    S.reputation = Math.max(0, S.reputation - lost);
    S.morale = clamp(S.morale - (t.tier === 'HARD' ? 7 : t.tier === 'MEDIUM' ? 5 : 3), 0, 100);
    S.momentum = Math.max(0, S.momentum - 40);
    S.streak = 0;
    S.lifetime.breaches = (S.lifetime.breaches || 0) + 1;
    emit('breach', { ticket: t, rep: lost });
    emit('change');
  }

  function requirement(tier) { return TIER[tier].n * (7 + S.level * 1.25); }

  /* diag: 1 you named the cause, 0 you guessed wrong, null not asked */
  function oddsFor(t, who, diag) {
    if (!t) return { tech: 0, sat: 0 };
    const c = who || active(), st = charStats(c);
    const req = requirement(t.tier);
    const catB = bonus('cat_' + t.cat) - 1;
    let tech = 0.57 + ((st[t.stat] - req) / req) * 0.42 + catB * 0.25;
    if (diag === 1) tech += 0.30;
    if (diag === 0) tech -= 0.24;
    const sat = clamp(0.40 + (st.COMMUNICATION / (req * 1.2)) * 0.35 + (bonus('sat') - 1) * 0.9, 0.05, 0.97);
    return { tech: clamp(tech, 0.05, 0.985), sat, req };
  }
  const needsDiagnosis = t => !!(t && t.diagnose && t.causes && t.causes.length);

  function resolveTicket(tuid, opts = {}) {
    if (!S.queue) fillQueue();
    const t = tuid ? ticketBy(tuid) : S.queue[0];
    if (!t) return null;
    const T = TIER[t.tier];
    const delegated = !!opts.by;
    const worker = delegated ? S.roster.find(c => c.uid === opts.by) : active();
    if (!worker) return null;
    const diag = opts.diag === 1 ? 1 : opts.diag === 0 ? 0 : null;

    if (!hasQuota()) return null;        // out of hours — nothing happens
    spendQuota(1);
    const tired = false;
    if (delegated) {
      const busyFor = (t.tier === 'HARD' ? 42 : t.tier === 'MEDIUM' ? 28 : 18) * 1000;
      S.busy[worker.uid] = Date.now() + busyFor;
    }

    const o = oddsFor(t, worker, diag);
    let techOk = Math.random() < o.tech;
    let auto = false;
    if (!techOk && t.cat === 'display' && Math.random() < (bonus('autoDisplay') - 1)) { techOk = true; auto = true; }
    const satOk = techOk && Math.random() < o.sat * roleSatMult(worker) * (delegated ? 0.85 : 1);

    const tiredMul = tired ? 0.35 : 1;
    const failMul = techOk ? 1 : 0.2;
    const satMul = satOk ? 1.25 : 1;
    const diagMul = diag === 1 ? 2.2 : diag === 0 ? 0.5 : 1;
    const delMul = delegated ? 0.7 : 1;
    const mo = momentumMult(), mr = moraleMult();

    const roleMul = roleTicketMult(worker, t.tier);
    let credits = T.credits * (1 + S.level * 0.17) * bonus('reward') * bonus('credit')
      * bonus('cat_' + t.cat) * tiredMul * failMul * satMul * diagMul * delMul * mo * mr * roleMul;
    let xpv = T.xp * (1 + S.level * 0.11) * bonus('xp') * tiredMul * failMul * diagMul * mo;
    let rep = techOk ? T.rep * bonus('rep') * (satOk ? 1.5 : 0.6) * (delegated ? 0.7 : 1) : -1;

    credits = Math.round(credits); xpv = Math.round(xpv); rep = Math.round(rep);

    // momentum and morale move on what you did, not on luck alone
    let momGain = techOk ? (delegated ? 5 : 12) : -8;
    if (diag === 1) momGain += 20;
    if (diag === 0) momGain -= 22;
    S.momentum = clamp(S.momentum + momGain, 0, MOMENTUM_MAX);
    S.morale = clamp(S.morale + (satOk ? 1.6 : techOk ? 0.4 : -2.6), 0, 100);
    S.lastAction = Date.now();

    S.credits += credits; S.reputation = Math.max(0, S.reputation + rep);
    addXp(xpv);
    grantStaffXp(Math.round(xpv * STAFF_XP_SHARE * bonus('staffXp')));

    S.lifetime.tickets++; S.lifetime.credits += credits; S.lifetime.xp += xpv;
    S.lifetime.cat[t.cat] = (S.lifetime.cat[t.cat] || 0) + 1;
    S.lifetime.peak = Math.max(S.lifetime.peak, S.credits);
    if (satOk) S.lifetime.happy++;
    if (diag === 1) S.lifetime.diagnosed = (S.lifetime.diagnosed || 0) + 1;
    if (delegated) { S.lifetime.delegated = (S.lifetime.delegated || 0) + 1; bump('delegated', 1); }
    S.streak = techOk ? S.streak + 1 : 0;
    S.lifetime.streak = Math.max(S.lifetime.streak, S.streak);
    S.solveTimes = (S.solveTimes || []).slice(-40);
    S.solveTimes.push(Date.now());
    bump('tickets', 1); bump('cat_' + t.cat, 1); bump('credits', credits); bump('xp', xpv);
    if (satOk) bump('happy', 1);
    if (diag === 1) bump('diagnosed', 1);
    bumpSet('streak', S.streak);
    bumpSet('momentum', Math.round(S.momentum));
    S.lifetime.maxMomentum = Math.max(S.lifetime.maxMomentum || 0, S.momentum);

    const result = {
      ticket: t, techOk, satOk, auto, tired, credits, xp: xpv, rep,
      diag, delegated, worker,
      momentum: S.momentum, momentumMult: mo, morale: S.morale,
      satReason: techOk ? (satOk ? pick(DATA.SAT_WINS) : pick(DATA.SAT_FAILS))
        : 'Ticket escalated. The user is now on first-name terms with your manager.',
      satPct: techOk ? (satOk ? 60 + Math.floor(Math.random() * 40) : 15 + Math.floor(Math.random() * 40)) : 5,
    };

    const i = S.queue.indexOf(t);
    if (i >= 0) S.queue.splice(i, 1);
    fillQueue();

    // Loot last: the ticket is already closed and paid, so nothing here can
    // leave the queue in a half-resolved state.
    if (Math.random() < (t.tier === 'HARD' ? 0.16 : t.tier === 'MEDIUM' ? 0.07 : 0.03))
      result.drop = dropItem(t.tier);

    checkAchievements();
    emit('resolved', result);
    emit('change');
    return result;
  }

  /* Pass it to somebody else. Free of energy, worth less, and it puts that
     colleague out of action for a while. */
  const isBusy = c => (S.busy[c.uid] || 0) > Date.now();
  const freeStaff = () => staff().filter(c => !isBusy(c));
  function delegate(tuid, charUid) {
    const c = S.roster.find(x => x.uid === charUid);
    if (!c || isBusy(c) || c.uid === S.activeId) return null;
    return resolveTicket(tuid, { by: charUid });
  }

  /* Sometimes the right call is to admit it is not yours. It costs standing —
     more for the big ones — but far less than letting it breach, which takes
     your morale and your whole momentum run with it. */
  const escalateCost = tier => ({ EASY: 1, MEDIUM: 3, HARD: 6 })[tier] || 2;

  function escalateTicket(tuid) {
    const t = ticketBy(tuid); if (!t) return null;
    const cost = escalateCost(t.tier);
    S.reputation = Math.max(0, S.reputation - cost);
    S.morale = clamp(S.morale - 1.5, 0, 100);
    S.momentum = Math.max(0, S.momentum - 10);
    S.streak = 0;
    S.lifetime.escalated = (S.lifetime.escalated || 0) + 1;
    const i = S.queue.indexOf(t); if (i >= 0) S.queue.splice(i, 1);
    fillQueue();
    checkAchievements();
    emit('change');
    return { ticket: t, cost };
  }

  /* ---------------- XP / LEVELS ---------------- */
  function addXp(n) {
    S.xp += n;
    let ups = 0;
    while (S.xp >= xpNeed(S.level)) {
      S.xp -= xpNeed(S.level); S.level++; ups++;
      // Deliberately no allowance here: thirty an hour has to mean thirty an
      // hour, or levelling quietly switches the limit off for new players.
    }
    if (ups) emit('levelup', { level: S.level, title: title(S.level) });
  }

  /* Your people learn from the work. Shares are deliberately generous: with a
     thirty-ticket hour there are far fewer tickets to learn from than when the
     queue was uncapped, and a team that never levels reads as a broken button
     rather than a long grind. */
  const STAFF_XP_SHARE = 1.0;        // of the XP a ticket paid you
  const BENCH_XP_SHARE = 0.75;       // for whoever is not on duty

  function grantStaffXp(n) {
    if (n <= 0) return;
    S.roster.forEach(c => {
      if (atMaxLevel(c)) { c.xp = charXpNeed(c.level); return; }   // done learning
      const d = def(c.defId);
      let g = n * (1 + (d.perks.xp || 0));
      if (c.uid !== S.activeId) g *= BENCH_XP_SHARE;
      c.xp += g;
    });
  }

  const atMaxLevel = c => c.level >= maxStaffLevel();
  function canLevel(c) {
    return !atMaxLevel(c) && c.xp >= charXpNeed(c.level) && S.credits >= levelCost(c);
  }
  function levelCost(c) {
    const base = 90 * Math.pow(c.level, 1.65) * DATA.RARITY[c.rarity].mult;
    return Math.floor(base * (isPromotion(c.level) ? 4 : 1));
  }
  /* Level somebody as far as their experience and your budget allow, stopping
     at the next career rank. Saves the repeated tapping without skipping past
     a promotion, which costs four times as much and deserves a decision. */
  function levelUpMax(uidc) {
    const c = S.roster.find(x => x.uid === uidc); if (!c) return null;
    const from = c.level, credits0 = S.credits;
    let gained = 0;
    while (canLevel(c) && !isPromotion(c.level) && gained < 200) {
      if (!levelUpChar(uidc)) break;
      gained++;
    }
    return gained ? { gained, from, to: c.level, spent: credits0 - S.credits } : null;
  }

  /* How many plain levels are available before the next rank wall. This has to
     agree exactly with what levelUpMax will actually do, or the button
     advertises levels it then refuses to spend. Standing ON a wall means zero
     plain levels are available — only the promotion, which is its own button. */
  function levelsReady(c) {
    if (!c || atMaxLevel(c)) return 0;
    if (isPromotion(c.level)) return 0;
    let lvl = c.level, xp = c.xp, credits = S.credits, n = 0;
    while (n < 200 && lvl < maxStaffLevel()) {
      const need = charXpNeed(lvl);
      const cost = Math.floor(90 * Math.pow(lvl, 1.65) * DATA.RARITY[c.rarity].mult);
      if (xp < need || credits < cost) break;
      xp -= need; credits -= cost; lvl++; n++;
      if (isPromotion(lvl)) break;              // arrived at the next wall
    }
    return n;
  }

  function levelUpChar(uidc) {
    const c = S.roster.find(x => x.uid === uidc); if (!c || !canLevel(c)) return false;
    const before = rankOf(c).name;
    S.credits -= levelCost(c); c.xp -= charXpNeed(c.level); c.level++;
    S.lifetime.levelups++; bump('levelups', 1);
    if (rankOf(c).name !== before) emit('promoted', { char: c, rank: rankOf(c) });
    checkAchievements(); emit('change');
    return true;
  }

  /* ---------------- IDLE ENGINE ---------------- */
  /* ---------------- CHAPTERS, RANKS AND ROLES ----------------
     The department grows in chapters. Each one decides how many people you can
     carry and how far they can be developed, so the game is about picking the
     right handful rather than hoarding a list.                              */
  const chapterNo = () => clamp(S.chapter || 1, 1, DATA.CHAPTERS.length);
  const chapter = () => DATA.CHAPTERS[chapterNo() - 1];
  const capacity = () => chapter().capacity;
  const maxStaffLevel = () => Math.min(DATA.MAX_CHAR_LEVEL, chapter().maxLevel);
  const atCapacity = () => S.roster.length >= capacity();

  const rankOf = c => DATA.staffRank(c.level);
  const roleOf = c => DATA.ROLES[def(c.defId).roleKey] || DATA.ROLES.TECHNICIAN;

  /* A manager produces nothing on their own and makes everyone else better. */
  function managerBoost(forChar) {
    if (forChar && def(forChar.defId).roleKey === 'MANAGER') return 1;
    const mgrs = S.roster.filter(c => def(c.defId).roleKey === 'MANAGER'
      && (!forChar || c.uid !== forChar.uid)).length;
    return 1 + Math.min(0.45, mgrs * 0.15);
  }

  /* What a role is actually worth on a given ticket. */
  function roleTicketMult(c, tier) {
    const r = def(c.defId).roleKey;
    if (r === 'TECHNICIAN' && tier !== 'HARD') return 1.25;
    if (r === 'SPECIALIST' && tier === 'HARD') return 1.35;
    return 1;
  }
  const roleSatMult = c => def(c.defId).roleKey === 'SUPPORT' ? 1.30 : 1;

  /* Team power is what the staff screen leads on: everyone you employ. */
  const teamPowerTotal = () => S.roster.reduce((a, c) => a + charPower(c), 0);

  function deptGrade() {
    const target = chapter().objectives.find(o => o.metric === 'power');
    const ratio = target ? teamPowerTotal() / target.target : 1;
    return (DATA.DEPT_GRADES.find(g => ratio >= g.at) || { g: 'E' }).g;
  }

  /* Progress against this chapter's objectives. */
  function objectiveValue(metric) {
    if (metric === 'tickets') return S.lifetime.tickets;
    if (metric === 'power') return teamPowerTotal();
    if (metric === 'morale') return Math.round(S.morale);
    if (metric === 'idle') return Math.round(idleRate() * 60);
    if (metric === 'incidents') return S.lifetime.incidents;
    if (metric === 'rep') return S.reputation;
    return 0;
  }
  function chapterProgress() {
    return chapter().objectives.map(o => {
      const have = objectiveValue(o.metric);
      return { ...o, have, done: have >= o.target,
               text: o.text.replace('{n}', fmt(o.target)) };
    });
  }
  const canPromoteChapter = () =>
    chapterNo() < DATA.CHAPTERS.length && chapterProgress().every(o => o.done);

  function promoteChapter() {
    if (!canPromoteChapter()) return null;
    S.chapter = chapterNo() + 1;
    const ch = chapter();
    S.reputation += 500 * ch.n;
    checkAchievements(); emit('change');
    emit('chapter', ch);
    return ch;
  }

  /* ---------------- WHAT TO DO NEXT ----------------
     A department has a lot of dials. Rather than making the player audit all
     of them, work out the single most valuable move available and say it in
     one sentence. Ordered by what actually costs them the most to ignore. */
  function advice() {
    const cap = capacity(), ch = chapter();

    if (canPromoteChapter())
      return { icon: ch.icon, tone: 'good', title: 'Your department is ready to grow',
        detail: `Every objective for ${ch.name} is met. Promoting opens more desks and a higher level ceiling.`,
        action: 'promote-chapter', label: 'PROMOTE THE DEPARTMENT' };

    const idle = unposted();
    if (idle.length)
      return { icon: '🪑', tone: 'warn', title: `${idle.length} ${idle.length > 1 ? 'people are' : 'person is'} not posted anywhere`,
        detail: 'Unposted staff still work the queue, but they earn nothing extra. A posting that suits them can be worth half again.',
        action: 'autopost', label: 'POST THEM WHERE THEY FIT' };

    const dc = deptCover();
    if (!dc.complete && S.roster.filter(c => c.uid !== S.activeId).length >= dc.open) {
      const dark = DATA.DEPARTMENTS.filter(d => S.reputation >= d.repReq
        && !S.roster.some(c => c.dept === d.id && c.uid !== S.activeId));
      return { icon: dark[0].icon, tone: 'warn',
        title: `${dark.length} department${dark.length > 1 ? 's have' : ' has'} nobody in ${dark.length > 1 ? 'them' : 'it'}`,
        detail: `${dark.map(d => d.name).join(' and ')} produce nothing while empty, and staffing every department is worth a bonus on top of each one.`,
        action: 'autopost', label: 'SPREAD THE TEAM OUT' };
    }

    const bad = misplaced();
    if (bad.length)
      return { icon: '🔀', tone: 'warn', title: `${bad.length} ${bad.length > 1 ? 'are' : 'is'} in the wrong department`,
        detail: `${bad.map(c => c.defId === 'hero' ? S.name : def(c.defId).name).slice(0, 2).join(' and ')} would earn more somewhere else.`,
        action: 'autopost', label: 'MOVE THEM' };

    const spread = roleSpread();
    if (!spread.complete && S.roster.length < cap) {
      const have = new Set(S.roster.map(c => def(c.defId).roleKey));
      const missing = Object.values(DATA.ROLES).find(r => !have.has(r.key));
      const who = DATA.CHARACTERS.find(d => d.hireable && d.roleKey === missing.key
        && S.reputation >= d.repReq);
      if (missing && who)
        return { icon: missing.icon, tone: 'idea', title: `No ${missing.name} on the payroll`,
          detail: `${missing.blurb} Covering all five roles is worth +25% on top of everything else.`,
          action: 'hire:' + who.id, label: `HIRE ${who.name} · 💰${fmt(hireCost(who))}`,
          affordable: S.credits >= hireCost(who) };
    }

    const ready = S.roster.filter(c => canLevel(c))
      .sort((a, b) => charPower(b) - charPower(a))[0];
    if (ready) {
      const nm = ready.defId === 'hero' ? S.name : def(ready.defId).name;
      const promo = isPromotion(ready.level);
      return { icon: promo ? '🎖️' : '📈', tone: 'good',
        title: promo ? `${nm} is ready for promotion` : `${nm} can level up`,
        detail: promo ? `Crossing into ${DATA.staffRank(ready.level + 1).name} costs four times a normal level, and is worth it.`
          : 'They have the experience and you have the budget.',
        action: 'levelup:' + ready.uid, label: promo ? 'PROMOTE THEM' : 'LEVEL THEM UP' };
    }

    if (S.roster.length >= cap)
      return { icon: '🪑', tone: 'idea', title: 'Every desk is taken',
        detail: 'To bring anyone new in you need to let somebody go, or meet this chapter\'s objectives for more room.',
        action: 'none', label: null };

    return { icon: '✅', tone: 'good', title: 'The department is in good order',
      detail: 'Everyone is posted where they belong and nobody is waiting on a promotion. Work the queue and build up experience.',
      action: 'none', label: null };
  }

  /* Letting somebody go. You get something back, which is what makes replacing
     a middling technician with a specialist a real decision rather than a loss. */
  function retireValue(c) {
    let spent = 0;
    for (let l = 1; l < c.level; l++) spent += Math.floor(90 * Math.pow(l, 1.65) * DATA.RARITY[c.rarity].mult * (isPromotion(l) ? 4 : 1));
    return {
      credits: Math.floor(spent * 0.6 + Game_hireRefund(c)),
      xp: Math.floor(charXpNeed(c.level) * 0.5),
      legacy: c.level >= 50 ? 1 : 0,
    };
  }
  function Game_hireRefund(c) {
    const d = def(c.defId);
    return Math.floor((d.cost || 0) * 0.35);
  }
  function retireStaff(uid) {
    const c = S.roster.find(x => x.uid === uid); if (!c) return null;
    if (c.defId === 'hero') return null;                 // you cannot retire yourself
    if (S.roster.length <= 1) return null;
    const v = retireValue(c);
    S.credits += v.credits;
    S.legacy += v.legacy;
    S.roster = S.roster.filter(x => x.uid !== uid);
    if (S.activeId === uid) S.activeId = S.roster[0].uid;
    grantStaffXp(v.xp);                                   // their experience stays behind
    emit('change');
    return { ...v, name: c.defId === 'hero' ? S.name : def(c.defId).name };
  }

  /* ---------------- DEPARTMENTS ----------------
     A posting is only worth what the person brings to it. Fit compares their
     department stat against their own average, so a specialist posted to their
     speciality is worth roughly double one who is merely present.          */
  const deptDef = id => DATA.DEPARTMENTS.find(d => d.id === id) || null;

  function deptFit(c, dept) {
    if (!dept) return 1;
    const st = charStats(c);
    const avg = DATA.STATS.reduce((a, k) => a + st[k], 0) / DATA.STATS.length;
    if (avg <= 0) return 1;
    // A department can be served by more than one strength — the front line
    // works for someone good with people OR someone with deep patience.
    const keys = dept.stats || [dept.stat];
    const best = Math.max(...keys.map(k => st[k] || 0));
    return clamp(best / avg, 0.45, 2.1);
  }

  /* How much a posting adds to one of the three things idle work produces. */
  function deptBoost(c, what) {
    const d = deptDef(c.dept);
    if (!d || d.effect !== what) return 1;
    if (S.reputation < d.repReq) return 1;        // posting lapses if unqualified
    return 1 + d.per * deptFit(c, d);
  }

  function assignDept(charUid, deptId) {
    const c = S.roster.find(x => x.uid === charUid); if (!c) return false;
    if (deptId) {
      const d = deptDef(deptId); if (!d || S.reputation < d.repReq) return false;
    }
    c.dept = c.dept === deptId ? null : (deptId || null);
    emit('change');
    return true;
  }

  const deptStaff = id => S.roster.filter(c => c.dept === id);

  /* The best posting available to this person right now. */
  /* What a posting is actually worth, as one number.

     Everything is converted to credits-an-hour. The rates come from the game's
     own economy rather than taste: a level at 30 costs about 26,000 experience
     and 33,000 credits, so experience runs about 1.5 credits a point once the
     scarcity of it is allowed for, and reputation is rare enough — a few
     thousand an hour against millions of credits — to be worth a few hundred
     each. Recommending by fit alone used to send people to a posting that
     lowered the number the player was watching. */
  const VALUE = { xp: 1.5, rep: 250 };

  function postingValue(c, deptId) {
    const was = c.dept;
    c.dept = deptId || null;
    const o = staffOutput(c);
    c.dept = was;
    return (o.credits + o.xp * VALUE.xp + o.rep * VALUE.rep) * 3600;
  }

  /* The same figure with the coverage bonus divided out. Coverage is the one
     part of a person's output that belongs to the whole team, so it has to be
     applied once to the roster rather than once per person. */
  function rawPostingValue(c, deptId) {
    const was = c.dept;
    c.dept = deptId || null;
    const o = staffOutput(c), cov = deptCover().mult;
    c.dept = was;
    return (o.credits + o.xp * VALUE.xp + o.rep * VALUE.rep) * 3600 / (cov || 1);
  }

  /* One pass over the roster, so a move can then be costed without rescanning. */
  function postingCtx() {
    const count = deptCensus();
    let sum = 0;
    S.roster.forEach(c => {
      if (c.uid === S.activeId || !c.dept) return;
      sum += rawPostingValue(c, c.dept);
    });
    return { count, sum, cover: coverFor(count) };
  }

  /* What the whole team is worth if this one person moves. Moving somebody
     changes what they produce and, when they were the last one in a
     department, the coverage bonus that multiplies everybody else. */
  function teamValueIfMoved(c, deptId, ctx) {
    ctx = ctx || postingCtx();
    const count = Object.assign({}, ctx.count);
    if (c.dept) count[c.dept] = (count[c.dept] || 1) - 1;
    if (deptId) count[deptId] = (count[deptId] || 0) + 1;
    const sum = ctx.sum
      - (c.dept ? rawPostingValue(c, c.dept) : 0)
      + (deptId ? rawPostingValue(c, deptId) : 0);
    return coverFor(count).mult * sum;
  }

  /* What this person produces where they are, in the currency that posting
     is actually for — the thing worth printing on their card. */
  function postingYield(c) {
    const d = deptDef(c.dept);
    const o = staffOutput(c);
    if (!d) return { label: fmt(o.credits * 3600) + ' cr/hr', of: 'credits' };
    if (d.effect === 'credits') return { label: fmt(o.credits * 3600) + ' cr/hr', of: 'credits' };
    if (d.effect === 'rate') return { label: fmt(o.rate * 60) + ' tickets/hr', of: 'throughput' };
    if (d.effect === 'xp') return { label: fmt(o.xp * 3600) + ' xp/hr', of: 'experience' };
    return { label: fmt(o.rep * 3600) + ' rep/hr', of: 'reputation' };
  }

  /* Where this person does the team the most good. Measured across the whole
     roster, because a posting that suits one person can still cost the team
     more than it gains by leaving a department with nobody in it. */
  function bestDept(c, ctx) {
    ctx = ctx || postingCtx();
    let best = null, bestVal = -Infinity;
    openDepts().forEach(d => {
      const v = teamValueIfMoved(c, d.id, ctx);
      if (v > bestVal) { bestVal = v; best = d; }
    });
    return best ? { dept: best, fit: deptFit(c, best), value: bestVal, ctx } : null;
  }

  /* Every posting for this person, best for the team first, saying what each
     would produce and whether taking it would strand a department. */
  function postingOptions(c) {
    const ctx = postingCtx();
    return openDepts()
      .map(d => {
        const was = c.dept; c.dept = d.id;
        const y = postingYield(c); c.dept = was;
        const strands = !!(c.dept && c.dept !== d.id && (ctx.count[c.dept] || 0) === 1);
        return {
          dept: d, fit: deptFit(c, d), yield: y.label, strands,
          leaving: strands ? deptDef(c.dept) : null,
          value: teamValueIfMoved(c, d.id, ctx),
          solo: postingValue(c, d.id),
        };
      })
      .sort((a, b) => b.value - a.value);
  }

  /* One move that posts everybody sensibly. The strategy is who you hire and
     who you develop; remembering to tap nine people is just admin. */
  /* Post everybody sensibly. Cover first, then fit: every open department gets
     its best available candidate before anyone gets their personal favourite,
     because an empty department is worth nothing to anybody. */
  function autoPost() {
    const before = idlePerSec().c * 3600;
    const crew = S.roster.filter(c => c.uid !== S.activeId);
    const open = DATA.DEPARTMENTS.filter(d => S.reputation >= d.repReq);
    const taken = new Set();
    const plan = new Map();

    // one pass to light up every department, best-suited candidate first
    open.forEach(() => {
      let pick = null;
      open.forEach(d => {
        if ([...plan.values()].includes(d.id)) return;
        crew.forEach(c => {
          if (taken.has(c.uid)) return;
          const v = postingValue(c, d.id);
          if (!pick || v > pick.v) pick = { c, d, v };
        });
      });
      if (pick) { plan.set(pick.c.uid, pick.d.id); taken.add(pick.c.uid); }
    });

    // everybody else goes where they personally do best
    crew.forEach(c => {
      if (taken.has(c.uid)) return;
      const b = bestDept(c);
      if (b) plan.set(c.uid, b.dept.id);
    });

    let moved = 0;
    crew.forEach(c => {
      const to = plan.get(c.uid);
      if (to && c.dept !== to) { c.dept = to; moved++; }
    });
    emit('change');
    return { moved, before: Math.round(before), after: Math.round(idlePerSec().c * 3600),
             cover: deptCover() };
  }

  /* Anyone sitting in a department that does not suit them. */
  /* Genuinely in the wrong place: somewhere else is worth meaningfully more
     to the department, not merely a better stat match. */
  const misplaced = () => {
    const ctx = postingCtx();
    const here = ctx.cover.mult * ctx.sum;
    if (!(here > 0)) return [];
    return S.roster.filter(c => {
      if (c.uid === S.activeId || !c.dept) return false;
      const b = bestDept(c, ctx);
      return b && b.dept.id !== c.dept && (b.value - here) / here > 0.02;
    });
  };
  const unposted = () => S.roster.filter(c => !c.dept && c.uid !== S.activeId);

  function staffRate(c) {
    const st = charStats(c), d = def(c.defId);
    let r = 3 + c.level * 0.45 + st.AUTOMATION * 0.16 + st.SPEED * 0.07;
    if (d.perks.idle) r *= (1 + d.perks.idle);
    if (d.perks.all) r *= (1 + d.perks.all);
    if (def(c.defId).roleKey === 'AUTOMATION') r *= 1.35;
    r *= deptBoost(c, 'rate');
    r *= managerBoost(c);
    r *= dupShare(c);
    return r;
  }
  function idleRate() {                                   // tickets per minute
    const base = staff().reduce((a, c) => a + staffRate(c), 0);
    return base * bonus('idle') * (1 + (bonus('automation') - 1) * 0.4);
  }

  /* What one person actually contributes per minute, posting included. */
  /* A mixed department works better than a monoculture. Every distinct role on
     the payroll lifts the whole automated queue. */
  /* A department with nobody in it is a room you are paying for and not using.
     Each one staffed lifts the whole floor, and running all four lifts it
     again — so there is a reason to spread out, not only to specialise. */
  const openDepts = () => DATA.DEPARTMENTS.filter(d => S.reputation >= d.repReq);

  /* How many people sit in each department. */
  function deptCensus() {
    const count = {};
    S.roster.forEach(c => {
      if (c.uid === S.activeId || !c.dept) return;
      count[c.dept] = (count[c.dept] || 0) + 1;
    });
    return count;
  }

  /* The coverage bonus for any arrangement, not just the current one — so the
     cost of emptying a department can be weighed before advising a move. */
  function coverFor(count) {
    const open = openDepts();
    const staffed = open.filter(d => (count[d.id] || 0) > 0).length;
    const complete = open.length > 0 && staffed === open.length;
    return {
      staffed, open: open.length, complete,
      mult: 1 + staffed * 0.07 + (complete && open.length >= 2 ? 0.20 : 0),
    };
  }

  function deptCover() { return coverFor(deptCensus()); }

  function roleSpread() {
    const all = Object.keys(DATA.ROLES).length;
    const roles = new Set(S.roster.map(c => def(c.defId).roleKey || 'TECHNICIAN'));
    // Every role helps, and covering all five is worth a bonus on top: a
    // department that can do everything beats one that does one thing well.
    const complete = roles.size >= all;
    return {
      roles: roles.size, of: all, complete,
      mult: 1 + roles.size * 0.08 + (complete ? 0.25 : 0),
    };
  }

  function staffOutput(c) {
    const rate = staffRate(c) * bonus('idle') * (1 + (bonus('automation') - 1) * 0.4) * roleSpread().mult * deptCover().mult;
    return {
      rate,
      credits: rate * idleCreditsPerTicket() * deptBoost(c, 'credits'),
      xp: rate * idleXpPerTicket() * deptBoost(c, 'xp'),
      rep: rate * 0.035 * bonus('rep') * deptBoost(c, 'reputation'),
    };
  }
  function idleCreditsPerTicket() {
    return 5.5 * (1 + S.level * 0.16) * bonus('credit') * bonus('idleCredit')
      * bonus('reward') * moraleMult();
  }
  function idleXpPerTicket() { return 3.2 * (1 + S.level * 0.05) * bonus('xp'); }
  function idlePerSec() {
    let t = 0, c = 0, x = 0, r = 0;
    staff().forEach(m => {
      const o = staffOutput(m);
      t += o.rate / 60; c += o.credits / 60; x += o.xp / 60; r += o.rep / 60;
    });
    return { t, c, x, r };
  }
  const offlineCapHours = () => 8 + (S.buildings.autolab || 0) + (S.buildings.noc || 0) * 0.5;

  function accrue(seconds, offline) {
    if (!staff().length || seconds <= 0) return null;
    const p = idlePerSec();
    const mul = offline ? 0.75 : 1;
    const a = S.idleAcc;
    a.t += p.t * seconds * mul; a.c += p.c * seconds * mul;
    a.x += p.x * seconds * mul; a.r += p.r * seconds * mul;
    if (offline) {
      a.gear += Math.min(6, Math.floor(seconds / 3600 * 0.8));
      a.inc += Math.floor(seconds / 5400);
    }
    return a;
  }

  function collectIdle() {
    const a = S.idleAcc;
    const c = Math.floor(a.c), x = Math.floor(a.x), r = Math.floor(a.r), t = Math.floor(a.t);
    const gear = [];
    for (let i = 0; i < a.gear; i++) gear.push(dropItem(Math.random() < 0.3 ? 'HARD' : 'MEDIUM'));
    const incBonus = Math.round(a.inc * 420 * (1 + S.level * 0.3) * bonus('incident'));
    S.lifetime.incidents += a.inc; if (a.inc) bump('incidents', a.inc);
    S.credits += c + incBonus; S.reputation += r; addXp(x);
    S.lifetime.tickets += t; S.lifetime.credits += c; S.lifetime.xp += x;
    S.lifetime.peak = Math.max(S.lifetime.peak, S.credits);
    bump('tickets', t); bump('credits', c); bump('xp', x);
    grantStaffXp(Math.round(x * 0.75 * bonus('staffXp')));
    S.idleAcc = { t: 0, c: 0, x: 0, r: 0, gear: 0, inc: 0 };
    checkAchievements(); emit('change');
    return { t, c: c + incBonus, x, r, gear, inc: a.inc };
  }

  /* ---------------- HIRING ---------------- */
  function hireCost(d) {
    const owned = S.roster.filter(c => c.defId === d.id).length;
    return Math.floor(d.cost * Math.pow(2.4, owned));
  }
  function canHire(d) {
    return d.hireable && !atCapacity() && S.reputation >= d.repReq && S.credits >= hireCost(d);
  }
  function hire(defId) {
    const d = def(defId); if (!canHire(d)) return null;
    S.credits -= hireCost(d);
    // A recruit arrives experienced enough to be useful and well short of the
    // ceiling — there has to be something left to develop, or hiring replaces
    // levelling entirely.
    const ceiling = maxStaffLevel();
    const start = clamp(Math.round(Math.min(S.level * 0.5, ceiling * 0.45)), 1, ceiling - 1);
    const c = mkChar(defId, start);
    S.roster.push(c); S.unlocked[defId] = true;
    checkAchievements(); emit('change');
    return c;
  }

  /* ---------------- EQUIPMENT ---------------- */
  /* ---------------- STANDARD ISSUE ----------------
     One kit for the whole department. You do not fit out people individually;
     you decide what an IT technician here carries, and everybody carries it. */
  const standardItem = slot => {
    const uidv = (S.standard || {})[slot];
    return uidv ? S.inventory.find(i => i.uid === uidv) : null;
  };
  const standardItems = () => DATA.SLOTS.map(s => standardItem(s.key)).filter(Boolean);
  const isStandard = itemUid => Object.values(S.standard || {}).includes(itemUid);

  function issueStandard(itemUid) {
    const it = S.inventory.find(i => i.uid === itemUid); if (!it) return false;
    const e = eqDef(it.eid); if (!e) return false;
    S.standard = S.standard || {};
    S.standard[e.slot] = it.uid;
    emit('change');
    return true;
  }
  function withdrawStandard(slot) {
    if (!S.standard || !S.standard[slot]) return false;
    delete S.standard[slot];
    emit('change');
    return true;
  }

  /* The whole department's kit, rated as one number. */
  function standardPower() {
    let p = 0;
    standardItems().forEach(it => {
      const e = eqDef(it.eid); if (!e || !e.stats) return;
      Object.values(e.stats).forEach(v => { p += v * (1 + (it.level - 1) * 0.25); });
    });
    return Math.round(p);
  }
  /* What finance will charge, and what they will give back. */
  const procurePrice = eid => {
    const e = eqDef(eid); if (!e) return Infinity;
    return Math.round(DATA.PROCURE.price[e.rarity] * (1 + S.level * 0.06));
  };
  const ownsItem = eid => S.inventory.some(i => i.eid === eid);
  const canProcure = eid => {
    const e = eqDef(eid); if (!e) return false;
    if (ownsItem(eid)) return false;          // everyone wears the same kit — one is enough
    return S.reputation >= DATA.PROCURE.repReq[e.rarity] && S.credits >= procurePrice(eid);
  };
  function procure(eid) {
    if (!canProcure(eid)) return null;
    S.credits -= procurePrice(eid);
    const it = mkItem(eid);
    S.inventory.push(it);
    checkAchievements(); emit('change');
    return it;
  }
  function disposeValue(it) {
    const e = eqDef(it.eid); if (!e) return 0;
    const base = DATA.PROCURE.price[e.rarity] * (1 + S.level * 0.06) * DATA.PROCURE.disposeShare;
    return Math.round(base * (1 + (it.level - 1) * 0.35));
  }

  function upgradeCost(it) { return Math.floor(180 * Math.pow(it.level, 1.5) * DATA.RARITY[eqDef(it.eid).rarity].mult); }
  function upgradeItem(itemUid) {
    const it = S.inventory.find(i => i.uid === itemUid); if (!it) return false;
    const cost = upgradeCost(it); if (S.credits < cost || it.level >= 10) return false;
    S.credits -= cost; it.level++; emit('change'); return true;
  }
  /* Clearing out several at once. Anything currently issued is withdrawn from
     the standard first, so the department is never left wearing a ghost. */
  function disposeMany(uids) {
    let credits = 0, count = 0, wasStandard = 0;
    (uids || []).forEach(u => {
      const it = S.inventory.find(x => x.uid === u); if (!it) return;
      if (isStandard(it.uid)) wasStandard++;
      const r = disposeItem(u);
      if (r) { credits += r.back; count++; }
    });
    return { credits, count, wasStandard };
  }

  /* Disposal. Asset recovery, not a bin. */
  function disposeItem(itemUid) {
    const i = S.inventory.findIndex(x => x.uid === itemUid); if (i < 0) return null;
    const it = S.inventory[i];
    if (isStandard(it.uid)) withdrawStandard(eqDef(it.eid).slot);
    const back = disposeValue(it);
    S.credits += back;
    S.inventory.splice(i, 1); emit('change');
    return { back, name: eqDef(it.eid).name };
  }

  /* ---------------- BUILDINGS ---------------- */
  function buildCost(b) { return Math.floor(b.base * Math.pow(b.growth, S.buildings[b.id] || 0)); }
  function canBuild(b) {
    const lv = S.buildings[b.id] || 0;
    return S.reputation >= b.repReq && lv < b.max && S.credits >= buildCost(b);
  }
  function build(id) {
    const b = bDef(id); if (!canBuild(b)) return false;
    S.credits -= buildCost(b);
    S.buildings[id] = (S.buildings[id] || 0) + 1;
    if (id === 'break') S.quotaLeft = Math.min(quotaMax(), (S.quotaLeft || 0) + DATA.QUOTA.perBreakRoom);
    S.lifetime.builds++; bump('builds', 1);
    checkAchievements(); emit('change'); emit('built', b);
    return true;
  }

  /* ---------------- MISSIONS ---------------- */
  function rollMissions() {
    // Always a couple of quick ones and at least one that takes real work.
    const easy = DATA.MISSION_POOL.filter(m => !m.tier).sort(() => Math.random() - 0.5).slice(0, 3);
    const hard = DATA.MISSION_POOL.filter(m => m.tier === 'hard').sort(() => Math.random() - 0.5).slice(0, 2);
    const pool = [...easy, ...hard];
    const scale = 1 + S.level * 0.22;
    S.missions = pool.map(m => ({
      id: m.id, icon: m.icon, metric: m.metric,
      target: Math.max(1, Math.round(m.base * scale)),
      text: (t => t === 1
        ? m.text.replace('{n}', '1').replace(/(ticket|incident|time|user|employee)s\b/g, '$1')
        : m.text.replace('{n}', fmt(t)))(Math.max(1, Math.round(m.base * scale))),
      done: false, claimed: false,
      tier: m.tier || 'normal',
      reward: {
        credits: Math.round((m.tier === 'hard' ? 2600 : 400) * scale * (1 + Math.random() * 0.6)),
        xp: Math.round((m.tier === 'hard' ? 1800 : 280) * scale),
        rep: Math.round((m.tier === 'hard' ? 90 : 12) * scale),
        energy: m.tier === 'hard' ? 12 : 5,
      }
    }));
    S.md = {};
    S.missionsAt = Date.now() + 24 * 3600 * 1000;
  }
  function bump(metric, n) {
    S.md[metric] = (S.md[metric] || 0) + n;
    updateMissions();
  }
  function bumpSet(metric, n) { S.md[metric] = Math.max(S.md[metric] || 0, n); updateMissions(); }
  function updateMissions() {
    if (!S.missions) return;
    S.missions.forEach(m => { if (!m.done && (S.md[m.metric] || 0) >= m.target) { m.done = true; emit('missiondone', m); } });
  }
  function claimMission(id) {
    const m = S.missions.find(x => x.id === id);
    if (!m || !m.done || m.claimed) return null;
    m.claimed = true;
    S.credits += m.reward.credits; S.reputation += m.reward.rep;
    grantQuota(m.reward.energy);         // claimed missions buy back some hands-on time
    addXp(m.reward.xp);
    checkAchievements(); emit('change');
    return m.reward;
  }

  /* ---------------- ACHIEVEMENTS ---------------- */
  function metricValue(m) {
    const L = S.lifetime;
    if (m === 'tickets') return L.tickets;
    if (m === 'incidents') return L.incidents;
    if (m === 'rep') return S.reputation;
    if (m === 'staff') return staff().length;
    if (m === 'peak') return L.peak;
    if (m === 'gear') return S.inventory.length;
    if (m === 'diagnosed') return L.diagnosed || 0;
    if (m === 'delegated') return L.delegated || 0;
    if (m === 'maxmomentum') return Math.round(L.maxMomentum || 0);
    if (m === 'maxedstaff') return S.roster.filter(c => c.level >= DATA.MAX_CHAR_LEVEL).length;
    if (m === 'monday') return L.monday;
    if (m === 'reorgs') return L.reorgs;
    if (m.startsWith('cat_')) return L.cat[m.slice(4)] || 0;
    return 0;
  }
  function checkAchievements() {
    DATA.ACHIEVEMENTS.forEach(a => {
      if (S.achievements[a.id]) return;
      if (metricValue(a.metric) >= a.target) {
        S.achievements[a.id] = Date.now();
        S.reputation += a.rep;
        emit('achievement', a);
      }
    });
  }

  /* ---------------- EVENTS ---------------- */
  function maybeEvent(now) {
    if (S.event && now > S.event.until) { S.event = null; S.eventAt = now + (120 + Math.random() * 180) * 1000; emit('change'); }
    if (!S.event && now > S.eventAt && S.level >= 2) {
      S.recentEvents = S.recentEvents || [];
      const e = pickFresh(DATA.EVENTS, S.recentEvents, 4);
      S.event = { ...e, until: now + e.dur * 1000 };
      if (e.id === 'monday') { S.lifetime.monday++; checkAchievements(); }
      emit('event', S.event); emit('change');
    }
  }

  /* ---------------- CRITICAL INCIDENTS ---------------- */
  const incidentReady = () => S.level >= 3 && !S.incident && Date.now() > S.incidentAt;
  function startIncident() {
    S.recentIncidents = S.recentIncidents || [];
    const d = pickFresh(DATA.INCIDENTS, S.recentIncidents, 5);
    S.incident = {
      ...d, step: 0, chance: 0.34 + (bonus('incidentSuccess') - 1),
      endsAt: Date.now() + d.time * 1000, log: [],
    };
    emit('incident', S.incident);
    return S.incident;
  }
  function incidentAnswer(i) {
    const inc = S.incident; if (!inc) return null;
    const step = inc.steps[inc.step];
    const ok = !!step.opts[i].ok;
    inc.chance = clamp(inc.chance + (ok ? 0.17 : -0.13), 0.02, 0.99);
    inc.log.push({ t: step.opts[i].t, ok });
    inc.step++;
    return { ok, done: inc.step >= inc.steps.length };
  }
  function incidentFinish(forceFail) {
    const inc = S.incident; if (!inc) return null;
    const win = !forceFail && Math.random() < inc.chance;
    const mul = bonus('incident') * (win ? 1 : 0.2);
    const credits = Math.round(950 * (1 + S.level * 0.34) * mul * bonus('credit'));
    const xpv = Math.round(430 * (1 + S.level * 0.2) * mul * bonus('xp'));
    const rep = Math.round(65 * mul * bonus('rep'));
    S.credits += credits; S.reputation += rep; addXp(xpv);
    grantStaffXp(Math.round(xpv * STAFF_XP_SHARE * bonus('staffXp')));
    if (win) { S.lifetime.incidents++; bump('incidents', 1); }
    S.lifetime.credits += credits;
    S.lifetime.peak = Math.max(S.lifetime.peak, S.credits);
    const drop = win && Math.random() < 0.55 ? dropItem('HARD') : null;
    S.incident = null;
    S.incidentAt = Date.now() + (150 + Math.random() * 180) * 1000;
    checkAchievements(); emit('change');
    return { win, credits, xp: xpv, rep, drop };
  }

  /* ---------------- REORGANISATION (PRESTIGE) ---------------- */
  const reorgReady = () => S.level >= 30;
  function reorgGain() {
    if (S.level < 30) return 0;
    return Math.max(1, Math.floor(Math.sqrt(S.reputation / 400) + (S.level - 25) / 6));
  }
  function reorg() {
    if (!reorgReady()) return 0;
    const gain = reorgGain();
    const keep = {
      legacy: S.legacy + gain, legacySpent: S.legacySpent, unlocked: S.unlocked,
      reorgs: S.reorgs + 1, achievements: S.achievements, tickets: S.lifetime.tickets,
      name: S.name, hero: S.hero,
    };
    newGame(keep);
    S.lifetime.reorgs = keep.reorgs;
    S.reorgs = keep.reorgs;
    checkAchievements(); save(); emit('change');
    return gain;
  }
  function spendLegacy(id) {
    const l = DATA.LEGACY.find(x => x.id === id);
    const cur = S.legacySpent[id] || 0;
    if (cur >= l.max || S.legacy < 1) return false;
    S.legacy--; S.legacySpent[id] = cur + 1; emit('change'); return true;
  }

  /* ---------------- MAIN TICK ---------------- */
  function tick() {
    const now = Date.now();
    const dt = Math.min(5, (now - S.lastTick) / 1000);
    S.lastTick = now;
    refreshQuota();
    // Morale drifts slowly back toward workable, so one bad session does not
    // sour the department forever — but it never drifts up into "great".
    const rest = 60;
    if (S.morale < rest) S.morale = Math.min(rest, S.morale + 0.045 * dt);
    else if (S.morale > 92) S.morale = Math.max(92, S.morale - 0.02 * dt);
    accrue(dt, false);
    maybeEvent(now);
    if (S.incident && now > S.incident.endsAt) emit('incidenttimeout');
    return dt;
  }

  /* ---------------- SAVE / LOAD ----------------
     The game does not care where the save lives. Solo play keeps it in this
     browser; signed in, net.js swaps in a store that keeps it on the server,
     so the same progress follows you to any device.                        */
  const localStore = {
    read() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; } },
    write(obj) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(obj)); } catch (e) { } },
  };
  let store = localStore;
  const setStore = st => { store = st; };
  const serialize = () => ({ ...S, savedAt: Date.now() });

  function save() { if (S) store.write(serialize()); }

  function load() {
    const saved = store.read();
    return loadFrom(saved);
  }

  /* A save arriving from the server may be older than this build, or may be
     a partial write from a connection that died mid-beacon. Merge it over a
     complete skeleton so a missing field can never brick somebody's game. */
  function skeleton() {
    return {
      v: 1, name: 'JASON', level: 1, xp: 0, credits: 0, reputation: 0,
      energy: 100, energyMax: 100, energyAcc: 0,
      roster: [], activeId: null, inventory: [], standard: {}, buildings: {}, dept: {},
      queue: [], streak: 0, chapter: 1, momentum: 0, morale: 75, busy: {}, lastAction: 0,
      quotaLeft: DATA.QUOTA.perHour, quotaEnds: 0,
      idleAcc: { t: 0, c: 0, x: 0, r: 0, gear: 0, inc: 0 },
      event: null, eventAt: Date.now() + 150000,
      incident: null, incidentAt: Date.now() + 180000,
      recentEvents: [], recentIncidents: [],
      solveTimes: [], sinceDiag: 0, lastWasDiag: false,
      missions: null, missionsAt: 0, md: {},
      lifetime: {
        tickets: 0, credits: 0, xp: 0, incidents: 0, happy: 0, levelups: 0,
        builds: 0, monday: 0, reorgs: 0, peak: 0, streak: 0, cat: {},
        breaches: 0, escalated: 0, delegated: 0, diagnosed: 0, maxMomentum: 0,
      },
      achievements: {}, legacy: 0, legacySpent: {}, unlocked: { hero: true },
      reorgs: 0, lastTick: Date.now(), started: Date.now(),
    };
  }

  function loadFrom(saved, serverNow) {
    if (!saved || typeof saved !== 'object') { return { needsCharacter: true }; }
    try {
      const base = skeleton();
      // Note this before the merge: the skeleton supplies an empty standard,
      // so afterwards we cannot tell "never had one" from "has none issued".
      const preStandard = !saved.standard;
      const s = { ...base, ...saved };
      s.lifetime = { ...base.lifetime, ...(saved.lifetime || {}) };
      s.lifetime.cat = { ...(saved.lifetime && saved.lifetime.cat) };
      s.idleAcc = { ...base.idleAcc, ...(saved.idleAcc || {}) };
      // Without a roster there is no game to resume — send them to the creator.
      if (!Array.isArray(s.roster) || !s.roster.length) return { needsCharacter: true };
      if (!s.roster.some(c => c.uid === s.activeId)) s.activeId = s.roster[0].uid;
      S = s;
      S.incident = null;
      uidSeq = Date.now() % 100000;
      delete S.ticket;
      if (!Array.isArray(S.queue)) S.queue = [];
      refreshQuota();          // an hour away means a full allowance on arrival
      S.roster.forEach(c => { if (c.level > DATA.MAX_CHAR_LEVEL) c.level = DATA.MAX_CHAR_LEVEL; });

      // Older saves fitted people out individually. Promote the best of what
      // anyone was carrying into the department standard, then retire the
      // personal loadouts.
      if (preStandard) {
        S.standard = {};
        const rank = it => {
          const e = eqDef(it.eid); if (!e) return -1;
          return DATA.RARITY[e.rarity].order * 100 + it.level;
        };
        (S.roster || []).forEach(c => {
          Object.values(c.equip || {}).forEach(iuid => {
            const it = (S.inventory || []).find(i => i.uid === iuid); if (!it) return;
            const e = eqDef(it.eid); if (!e) return;
            const cur = S.standard[e.slot] && S.inventory.find(i => i.uid === S.standard[e.slot]);
            if (!cur || rank(it) > rank(cur)) S.standard[e.slot] = it.uid;
          });
          c.equip = {};
        });
        (S.inventory || []).forEach(i => { delete i.on; });
      }
      // a queue that sat through a break starts fresh rather than pre-breached,
      // and picks up the current SLA budget rather than the one it was born with
      S.queue.forEach(t => { t.sla = DATA.SLA[t.tier] || 300; t.left = t.sla; });
      fillQueue();
      if (!S.missions || Date.now() > S.missionsAt) rollMissions();
      if (!S.hero) S.hero = { spec: 'fixer', art: { ...DATA.CHARACTERS[0].art } };
      // The server's clock is the honest one when we are signed in.
      const now = serverNow || Date.now();
      const away = Math.max(0, (now - (s.savedAt || s.lastTick || now)) / 1000);
      const capped = Math.min(away, offlineCapHours() * 3600);
      S.lastTick = Date.now();
      if (capped > 60 && staff().length) { accrue(capped, true); return { away: capped, offline: true }; }
      return { away: capped };
    } catch (e) { return { needsCharacter: true, broken: true }; }
  }
  function wipe() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } }

  return {
    on, emit, get state() { return S; },
    newGame, load, loadFrom, save, wipe, tick, serialize, setStore, localStore,
    fmt, fmtTime, xpNeed, charXpNeed, title, rank, nextRank,
    def, eqDef, bDef, charStats, charPower, active, staff, teamPower, bonus, legacyVal,
    resolveTicket, delegate, escalateTicket, escalateCost, TIER, requirement,
    fillQueue, tickQueue, ticketBy, oddsFor, needsDiagnosis, isBusy, freeStaff,
    playTempo, diagnoseChance,
    momentumMult, moraleMult, MOMENTUM_MAX, QUEUE_SIZE, breach,
    quotaMax, quotaLeft, quotaResetIn, hasQuota, grantQuota, refreshQuota,
    idleRate, idlePerSec, collectIdle, offlineCapHours, staffRate, staffOutput,
    deptDef, deptFit, deptBoost, assignDept, deptStaff,
    hire, hireCost, canHire, canLevel, levelCost, levelUpChar, levelUpMax, levelsReady, atMaxLevel,
    chapter, chapterNo, capacity, atCapacity, maxStaffLevel, rankOf, roleOf,
    teamPowerTotal, deptGrade, chapterProgress, canPromoteChapter, promoteChapter, roleSpread, dupShare,
    bestDept, autoPost, misplaced, unposted, isPromotion, advice, deptCover,
    postingValue, postingYield, postingOptions, teamValueIfMoved, postingCtx,
    retireValue, retireStaff, managerBoost, objectiveValue,
    issueStandard, withdrawStandard, standardItem, standardItems, isStandard, standardPower,
    upgradeItem, upgradeCost, disposeItem, disposeMany, disposeValue, procure, procurePrice, canProcure, ownsItem,
    build, buildCost, canBuild,
    rollMissions, claimMission, checkAchievements, metricValue,
    incidentReady, startIncident, incidentAnswer, incidentFinish,
    reorgReady, reorgGain, reorg, spendLegacy, mkItem,
  };
})();
