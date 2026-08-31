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
  const charXpNeed = lvl => Math.floor(45 * Math.pow(lvl, 1.55) + 30 * lvl);

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
      buildings: { helpdesk: 1 },
      dept: {},
      ticket: null, streak: 0,
      idleAcc: { t: 0, c: 0, x: 0, r: 0, gear: 0, inc: 0 },
      event: null, eventAt: Date.now() + 150000,
      incident: null, incidentAt: Date.now() + 180000,
      missions: null, missionsAt: 0,
      md: {},                                  // daily mission counters
      lifetime: { tickets: 0, credits: 0, xp: 0, incidents: 0, happy: 0, levelups: 0, builds: 0, monday: 0, reorgs: 0, peak: 0, streak: 0, cat: {} },
      achievements: {},
      legacy: keep ? keep.legacy : 0,
      legacySpent: keep ? keep.legacySpent : {},
      unlocked: keep ? keep.unlocked : { hero: true },
      reorgs: keep ? keep.reorgs : 0,
      lastTick: Date.now(), started: Date.now(),
    };
    if (keep) { S.lifetime.reorgs = keep.reorgs; S.achievements = keep.achievements; S.lifetime.tickets = keep.tickets; }
    rollMissions();
    newTicket();
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
    Object.values(c.equip).forEach(iuid => {
      const it = S.inventory.find(i => i.uid === iuid); if (!it) return;
      const e = eqDef(it.eid); if (!e.stats) return;
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
    // staff perks (everyone you employ helps)
    S.roster.forEach(c => {
      const p = def(c.defId).perks || {};
      if (p[key]) b += p[key];
      if (p.all && key !== 'energy') b += p.all;
    });
    // equipment perks
    S.inventory.forEach(it => {
      if (!it.on) return;
      const p = eqDef(it.eid).perks; if (p && p[key]) b += p[key];
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

  /* ---------------- TICKETS ---------------- */
  const TIER = {
    EASY:   { n: 1, stars: 1, credits: 14,  xp: 22,  rep: 1,  energy: 2, time: 45 },
    MEDIUM: { n: 2, stars: 3, credits: 48,  xp: 62,  rep: 3,  energy: 4, time: 90 },
    HARD:   { n: 3, stars: 5, credits: 170, xp: 190, rep: 9,  energy: 7, time: 180 },
  };

  function tierRoll() {
    const l = S.level;
    const wHard = l < 6 ? 0 : Math.min(0.30, (l - 5) * 0.022);
    const wMed = l < 3 ? 0 : Math.min(0.45, (l - 2) * 0.05);
    const r = Math.random();
    if (r < wHard) return 'HARD';
    if (r < wHard + wMed) return 'MEDIUM';
    return 'EASY';
  }

  function newTicket() {
    const tier = tierRoll();
    const t = pick(DATA.TICKETS[tier]);
    S.ticket = {
      id: 'INC' + (100000 + Math.floor(Math.random() * 899999)),
      tier, ...t,
      flavour: pick(DATA.TICKET_FLAVOUR),
      born: Date.now(),
    };
    return S.ticket;
  }

  function requirement(tier) { return TIER[tier].n * (7 + S.level * 1.25); }

  function odds() {
    const t = S.ticket; if (!t) return { tech: 0, sat: 0 };
    const c = active(), st = charStats(c);
    const req = requirement(t.tier);
    const catB = bonus('cat_' + t.cat) - 1;
    const tech = clamp(0.57 + ((st[t.stat] - req) / req) * 0.42 + catB * 0.25, 0.12, 0.985);
    const sat = clamp(0.40 + (st.COMMUNICATION / (req * 1.2)) * 0.35 + (bonus('sat') - 1) * 0.9, 0.05, 0.97);
    return { tech, sat, req };
  }

  function resolveTicket() {
    if (!S.ticket) newTicket();
    const t = S.ticket, T = TIER[t.tier], c = active();
    const cost = Math.round(T.energy * bonus('energy'));
    const tired = S.energy < cost;
    S.energy = Math.max(0, S.energy - cost);

    const o = odds();
    let techOk = Math.random() < o.tech;
    let auto = false;
    if (!techOk && t.cat === 'display' && Math.random() < (bonus('autoDisplay') - 1)) { techOk = true; auto = true; }
    const satOk = techOk && Math.random() < o.sat;

    const tiredMul = tired ? 0.35 : 1;
    const failMul = techOk ? 1 : 0.25;
    const satMul = satOk ? 1.25 : 1;

    let credits = T.credits * (1 + S.level * 0.17) * bonus('reward') * bonus('credit') * bonus('cat_' + t.cat) * tiredMul * failMul * satMul;
    let xpv = T.xp * (1 + S.level * 0.11) * bonus('xp') * tiredMul * failMul;
    let rep = techOk ? T.rep * bonus('rep') * (satOk ? 1.5 : 0.6) : -1;

    credits = Math.round(credits); xpv = Math.round(xpv); rep = Math.round(rep);

    S.credits += credits; S.reputation = Math.max(0, S.reputation + rep);
    addXp(xpv);
    grantStaffXp(Math.round(xpv * 0.35 * bonus('staffXp')));

    // counters
    S.lifetime.tickets++; S.lifetime.credits += credits; S.lifetime.xp += xpv;
    S.lifetime.cat[t.cat] = (S.lifetime.cat[t.cat] || 0) + 1;
    S.lifetime.peak = Math.max(S.lifetime.peak, S.credits);
    if (satOk) S.lifetime.happy++;
    S.streak = techOk ? S.streak + 1 : 0;
    S.lifetime.streak = Math.max(S.lifetime.streak, S.streak);
    bump('tickets', 1); bump('cat_' + t.cat, 1); bump('credits', credits); bump('xp', xpv);
    if (satOk) bump('happy', 1);
    bumpSet('streak', S.streak);

    const result = {
      ticket: t, techOk, satOk, auto, tired, credits, xp: xpv, rep,
      satReason: techOk ? (satOk ? pick(DATA.SAT_WINS) : pick(DATA.SAT_FAILS)) : 'Ticket escalated. User is now on first-name terms with your manager.',
      tech: techOk ? 100 : 0,
      satPct: techOk ? (satOk ? 60 + Math.floor(Math.random() * 40) : 15 + Math.floor(Math.random() * 40)) : 5,
    };

    // equipment drop
    if (Math.random() < (t.tier === 'HARD' ? 0.16 : t.tier === 'MEDIUM' ? 0.07 : 0.03)) {
      result.drop = dropItem(t.tier);
    }
    checkAchievements();
    newTicket();
    emit('resolved', result);
    emit('change');
    return result;
  }

  function dropItem(tier) {
    const pool = DATA.EQUIPMENT.filter(e => {
      const o = DATA.RARITY[e.rarity].order;
      if (tier === 'EASY') return o <= 1;
      if (tier === 'MEDIUM') return o <= 2 || (o === 3 && Math.random() < 0.25);
      return o >= 1 || Math.random() < 0.3;
    });
    const e = pick(pool.length ? pool : DATA.EQUIPMENT);
    const it = mkItem(e.id);
    S.inventory.push(it);
    return it;
  }

  /* ---------------- XP / LEVELS ---------------- */
  function addXp(n) {
    S.xp += n;
    let ups = 0;
    while (S.xp >= xpNeed(S.level)) {
      S.xp -= xpNeed(S.level); S.level++; ups++;
      S.energyMax = 100 + (S.buildings.break || 0) * 10 + Math.floor(S.level / 5) * 5;
      S.energy = S.energyMax;
    }
    if (ups) emit('levelup', { level: S.level, title: title(S.level) });
  }

  function grantStaffXp(n) {
    if (n <= 0) return;
    S.roster.forEach(c => {
      const d = def(c.defId);
      let g = n * (1 + (d.perks.xp || 0));
      if (c.uid !== S.activeId) g *= 0.6;
      c.xp += g;
    });
  }

  function canLevel(c) { return c.xp >= charXpNeed(c.level) && S.credits >= levelCost(c); }
  function levelCost(c) { return Math.floor(60 * Math.pow(c.level, 1.45) * DATA.RARITY[c.rarity].mult); }
  function levelUpChar(uidc) {
    const c = S.roster.find(x => x.uid === uidc); if (!c || !canLevel(c)) return false;
    S.credits -= levelCost(c); c.xp -= charXpNeed(c.level); c.level++;
    S.lifetime.levelups++; bump('levelups', 1);
    checkAchievements(); emit('change');
    return true;
  }

  /* ---------------- IDLE ENGINE ---------------- */
  function staffRate(c) {
    const st = charStats(c), d = def(c.defId);
    let r = 3 + c.level * 0.45 + st.AUTOMATION * 0.16 + st.SPEED * 0.07;
    if (d.perks.idle) r *= (1 + d.perks.idle);
    if (d.perks.all) r *= (1 + d.perks.all);
    if (c.dept === 'auto') r *= 1.35;
    return r;
  }
  function idleRate() {                                   // tickets per minute
    const base = staff().reduce((a, c) => a + staffRate(c), 0);
    return base * bonus('idle') * (1 + (bonus('automation') - 1) * 0.4);
  }
  function idleCreditsPerTicket() {
    return 5.5 * (1 + S.level * 0.16) * bonus('credit') * bonus('idleCredit') * bonus('reward');
  }
  function idleXpPerTicket() { return 3.2 * (1 + S.level * 0.05) * bonus('xp'); }
  function idlePerSec() {
    const tpm = idleRate();
    return { t: tpm / 60, c: (tpm / 60) * idleCreditsPerTicket(), x: (tpm / 60) * idleXpPerTicket(), r: (tpm / 60) * 0.035 * bonus('rep') };
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
    grantStaffXp(Math.round(x * 0.5 * bonus('staffXp')));
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
    return d.hireable && S.reputation >= d.repReq && S.credits >= hireCost(d);
  }
  function hire(defId) {
    const d = def(defId); if (!canHire(d)) return null;
    S.credits -= hireCost(d);
    const c = mkChar(defId, Math.max(1, Math.floor(S.level * 0.6)));
    S.roster.push(c); S.unlocked[defId] = true;
    checkAchievements(); emit('change');
    return c;
  }

  /* ---------------- EQUIPMENT ---------------- */
  function equip(itemUid, charUid) {
    const it = S.inventory.find(i => i.uid === itemUid); if (!it) return;
    const c = S.roster.find(x => x.uid === charUid); if (!c) return;
    const slot = eqDef(it.eid).slot;
    const prev = c.equip[slot];
    if (prev) { const p = S.inventory.find(i => i.uid === prev); if (p) p.on = null; }
    S.inventory.forEach(i => { if (i.on === charUid && eqDef(i.eid).slot === slot) i.on = null; });
    it.on = charUid; c.equip[slot] = it.uid;
    emit('change');
  }
  function unequip(charUid, slot) {
    const c = S.roster.find(x => x.uid === charUid); if (!c) return;
    const iu = c.equip[slot]; if (!iu) return;
    const it = S.inventory.find(i => i.uid === iu); if (it) it.on = null;
    delete c.equip[slot]; emit('change');
  }
  function upgradeCost(it) { return Math.floor(180 * Math.pow(it.level, 1.5) * DATA.RARITY[eqDef(it.eid).rarity].mult); }
  function upgradeItem(itemUid) {
    const it = S.inventory.find(i => i.uid === itemUid); if (!it) return false;
    const cost = upgradeCost(it); if (S.credits < cost || it.level >= 10) return false;
    S.credits -= cost; it.level++; emit('change'); return true;
  }
  function scrapItem(itemUid) {
    const i = S.inventory.findIndex(x => x.uid === itemUid); if (i < 0) return;
    const it = S.inventory[i];
    if (it.on) unequip(it.on, eqDef(it.eid).slot);
    S.credits += Math.floor(upgradeCost(it) * 0.4);
    S.inventory.splice(i, 1); emit('change');
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
    if (id === 'break') S.energyMax = 100 + S.buildings.break * 10 + Math.floor(S.level / 5) * 5;
    S.lifetime.builds++; bump('builds', 1);
    checkAchievements(); emit('change'); emit('built', b);
    return true;
  }

  /* ---------------- MISSIONS ---------------- */
  function rollMissions() {
    const pool = [...DATA.MISSION_POOL].sort(() => Math.random() - 0.5).slice(0, 4);
    const scale = 1 + S.level * 0.22;
    S.missions = pool.map(m => ({
      id: m.id, icon: m.icon, metric: m.metric,
      target: Math.max(1, Math.round(m.base * scale)),
      text: (t => t === 1
        ? m.text.replace('{n}', '1').replace(/(ticket|incident|time|user|employee)s\b/g, '$1')
        : m.text.replace('{n}', fmt(t)))(Math.max(1, Math.round(m.base * scale))),
      done: false, claimed: false,
      reward: {
        credits: Math.round(400 * scale * (1 + Math.random() * 0.6)),
        xp: Math.round(280 * scale),
        rep: Math.round(12 * scale),
        energy: 25,
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
    S.energy = Math.min(S.energyMax, S.energy + m.reward.energy);
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
      const e = pick(DATA.EVENTS);
      S.event = { ...e, until: now + e.dur * 1000 };
      if (e.id === 'monday') { S.lifetime.monday++; checkAchievements(); }
      emit('event', S.event); emit('change');
    }
  }

  /* ---------------- CRITICAL INCIDENTS ---------------- */
  const incidentReady = () => S.level >= 3 && !S.incident && Date.now() > S.incidentAt;
  function startIncident() {
    const d = pick(DATA.INCIDENTS);
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
    grantStaffXp(Math.round(xpv * 0.4 * bonus('staffXp')));
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
    // energy
    S.energyAcc += dt * (1 / 7) * bonus('energyRegen');
    if (S.energyAcc >= 1) { const g = Math.floor(S.energyAcc); S.energyAcc -= g; S.energy = Math.min(S.energyMax, S.energy + g); }
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

  function loadFrom(saved, serverNow) {
    if (!saved) { return { needsCharacter: true }; }
    try {
      const s = saved;
      S = s;
      S.md = S.md || {}; S.idleAcc = S.idleAcc || { t: 0, c: 0, x: 0, r: 0, gear: 0, inc: 0 };
      S.lifetime.cat = S.lifetime.cat || {};
      S.incident = null;
      uidSeq = Date.now() % 100000;
      if (!S.ticket) newTicket();
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
    newTicket, resolveTicket, odds, TIER, requirement,
    idleRate, idlePerSec, collectIdle, offlineCapHours, staffRate,
    hire, hireCost, canHire, canLevel, levelCost, levelUpChar,
    equip, unequip, upgradeItem, upgradeCost, scrapItem,
    build, buildCost, canBuild,
    rollMissions, claimMission, checkAchievements, metricValue,
    incidentReady, startIncident, incidentAnswer, incidentFinish,
    reorgReady, reorgGain, reorg, spendLegacy, mkItem,
  };
})();
