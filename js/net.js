/* ============================================================
   IT EMPIRE — NETWORK
   When the game is served by its own backend, progress lives on
   the server behind a login. Opened as a plain file (or as a
   published Artifact) the same build runs solo from this browser.
   ============================================================ */
const Net = (() => {
  const TOKEN_KEY = 'ie-token';
  let online = false, token = null, player = null, cache = null, rev = 0;
  let onConflict = null;
  let dirty = false, sending = false, lastSent = 0;

  try { token = localStorage.getItem(TOKEN_KEY); } catch (e) { }

  async function api(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const r = await fetch('api/' + path, { ...opts, headers });
    let body = {};
    try { body = await r.json(); } catch (e) { }
    if (!r.ok) return { ok: false, status: r.status, error: body.error || 'Something went wrong. Try again.' };
    return { ok: true, ...body };
  }

  /* Is there a backend behind this page? */
  async function probe() {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 4000);
      const r = await fetch('api/ping', { signal: ctl.signal });
      clearTimeout(t);
      online = r.ok;
    } catch (e) { online = false; }
    return online;
  }

  function keep(r) {
    token = r.token; player = r.player; cache = r.state || null;
    rev = r.rev || 0;
    try { localStorage.setItem(TOKEN_KEY, token); } catch (e) { }
    return { ok: true, state: r.state, now: r.now, player: r.player, fresh: r.fresh, rev };
  }

  const signup = async (name, password, profile) => {
    const r = await api('signup', { method: 'POST', body: JSON.stringify({ name, password, profile }) });
    return r.ok ? { ...keep(r), profile } : r;
  };
  const login = async (name, password) => {
    const r = await api('login', { method: 'POST', body: JSON.stringify({ name, password }) });
    return r.ok ? keep(r) : r;
  };
  function logout() {
    if (token) api('logout', { method: 'POST' }).catch(() => { });
    token = null; player = null; cache = null;
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { }
  }
  const resume = async () => {
    if (!token) return { ok: false };
    const r = await api('state');
    return r.ok ? keep({ ...r, token }) : r;
  };

  /* The store the game writes through when signed in. Writes are queued and
     flushed at most once every few seconds so tapping never waits on a
     network call; the browser cache keeps a copy in case the server is down. */
  const store = {
    read: () => cache,
    write(obj) {
      cache = obj; dirty = true;
      Game.localStore.write(obj);
      flush();
    },
  };

  let stopped = false;      // set once another device has won; we stop writing

  async function flush(force) {
    if (stopped || !online || !token || !dirty || sending) return;
    if (!force && Date.now() - lastSent < 4000) return;
    sending = true; dirty = false; lastSent = Date.now();
    try {
      const r = await api('state', { method: 'PUT', body: JSON.stringify({ state: cache, rev }) });
      if (r.ok) {
        rev = r.rev != null ? r.rev : rev + 1;
      } else if (r.status === 409) {
        // Another copy of this game is further ahead. Stop writing immediately
        // — one more save from here would undo their progress — and hand the
        // winning state back so we can pick it up instead.
        stopped = true;
        rev = r.rev || rev;
        cache = r.state || cache;
        if (onConflict) onConflict({ state: r.state, now: r.now });
      } else {
        dirty = true;                    // a real failure; try again later
      }
    } catch (e) { dirty = true; }
    sending = false;
  }

  /* On the way out, a beacon still gets through where fetch would be killed. */
  function flushBeacon() {
    if (stopped || !online || !token || !cache) return;
    try {
      const blob = new Blob([JSON.stringify({ state: cache, token, rev })], { type: 'application/json' });
      navigator.sendBeacon('api/state-beacon', blob);
      dirty = false;
    } catch (e) { }
  }

  const leaderboard = () => api('leaderboard');
  const deleteAccount = () => api('account', { method: 'DELETE' });

  return {
    probe, signup, login, logout, resume, store, flush, flushBeacon, leaderboard, deleteAccount,
    set onConflict(fn) { onConflict = fn; },
    get stopped() { return stopped; },
    get online() { return online; },
    coop(n) {
      if (!online || !token) return Promise.resolve(null);
      return api('coop', { method: 'POST', body: JSON.stringify({ n: n || 0 }) })
        .then(r => (r && r.coop) || null).catch(() => null);
    },
    coopClaim() {
      if (!online || !token) return Promise.resolve(null);
      return api('coop-claim', { method: 'POST', body: '{}' }).catch(() => null);
    },
    eotm() {
      if (!online || !token) return Promise.resolve(null);
      return api('eotm').then(r => (r && r.eotm) || null).catch(() => null);
    },
    eotmClaim() {
      if (!online || !token) return Promise.resolve(null);
      return api('eotm-claim', { method: 'POST', body: '{}' }).catch(() => null);
    },
    get token() { return token; },
    get player() { return player; },
  };
})();
