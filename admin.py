"""IT Empire — administration back end.

Kept apart from server.py on purpose. server.py answers the public game; this
answers a small number of authenticated humans who can change other people's
progress, and the two have very different risk profiles.

The governing rule is the one the game itself taught us. A player once lost a
night of progress and it could not be recovered, because the database keeps
only the newest save. So nothing here overwrites a player without first
writing down what was there. Every mutation takes a snapshot, records who did
it and why, and can be walked back.

Nothing in this module trusts the browser. The dashboard sends intent; the
values are read, validated and written here.
"""

import hashlib
import hmac
import json
import re
import secrets
import struct
import threading
import time
from datetime import datetime, timedelta, timezone

import admin_ui

# Filled in by install(), so this module never imports server.py back.
q = None
P_TABLE = S_TABLE = A_TABLE = ""
hash_password = check_password = None
_is_pg = False

AD_TABLE = "ie_admins"
AS_TABLE = "ie_admin_sessions"
AU_TABLE = "ie_audit"
BN_TABLE = "ie_bans"
SN_TABLE = "ie_snapshots"

SESSION_HOURS = 8           # configurable; how long an admin stays signed in
IDLE_MINUTES = 45           # and how long they may sit idle within that
LOCKOUT_AFTER = 5           # failed passwords before the account locks
LOCKOUT_MINUTES = 15
SNAPSHOT_KEEP = 40          # per player, so restores stay possible but bounded


# --- permissions ------------------------------------------------------------

# One string per thing a person can do. Roles are only a convenient bundle of
# these; the check at the point of use is always against the string, so a
# grant or revoke on an individual admin behaves exactly like a role would.
PERMISSIONS = {
    "players.view":            "Search players and read their profile",
    "players.activity":        "See a player's activity history",
    "players.reset.password":  "Send a player through a password reset",
    "players.reset.session":   "Force logout / revoke a player's sessions",
    "players.reset.daily":     "Reset daily missions",
    "players.reset.energy":    "Reset energy",
    "players.reset.tutorial":  "Reset the tutorial flag",
    "players.reset.run":       "Reset the current run",
    "players.restore":         "Restore a player from an earlier snapshot",
    "players.resource.add":    "Add resources to a player",
    "players.resource.remove": "Remove resources from a player",
    "players.resource.set":    "Set a resource to an absolute value",
    "players.suspend":         "Suspend an account",
    "players.ban.temp":        "Issue a temporary ban",
    "players.ban.perm":        "Issue a permanent ban",
    "players.unban":           "Lift a ban or suspension",
    "players.rankings":        "Show or hide a player in the public rankings",
    "players.deactivate":      "Soft-delete (deactivate) an account",
    "players.delete":          "Permanently delete an account",
    "content.manage":          "Edit game content",
    "config.change":           "Change game configuration and balance",
    "events.run":              "Create and publish events",
    "maintenance":             "Enter and leave maintenance mode",
    "analytics.view":          "View statistics and analytics",
    "logs.view":               "Read the audit log",
    "admins.manage":           "Create, edit and disable administrators",
}

ROLES = {
    "SUPER_ADMIN": sorted(PERMISSIONS),
    "GAME_ADMIN": [
        "players.view", "players.activity", "players.reset.password",
        "players.reset.session", "players.reset.daily", "players.reset.energy",
        "players.reset.tutorial", "players.reset.run", "players.restore",
        "players.resource.add", "players.resource.remove",
        "players.suspend", "players.ban.temp", "players.unban",
        "players.rankings",
        "content.manage", "events.run", "analytics.view", "logs.view",
    ],
    # Deliberately cannot set absolute values, cannot ban permanently, and
    # cannot delete. Support fixes problems; it does not reshape accounts.
    "CUSTOMER_SUPPORT": [
        "players.view", "players.activity", "players.reset.password",
        "players.reset.session", "players.reset.daily", "players.reset.energy",
        "players.reset.tutorial", "players.restore",
        "players.resource.add", "analytics.view",
    ],
    "CONTENT_ADMIN": ["content.manage", "analytics.view", "players.view"],
    "ANALYST": ["analytics.view", "players.view"],
}

# Even an explicit grant cannot hand these to the named roles. Stops a
# well-meaning super admin from quietly turning support into a super admin.
ROLE_CEILING = {
    "CUSTOMER_SUPPORT": {"players.ban.perm", "players.delete", "players.deactivate",
                         "players.resource.set", "config.change", "admins.manage",
                         "maintenance"},
    "CONTENT_ADMIN": {"admins.manage", "players.delete", "players.resource.set",
                      "config.change", "maintenance"},
    "ANALYST": set(PERMISSIONS) - {"analytics.view", "players.view", "logs.view"},
}

# Actions serious enough that the dashboard makes you type the phrase out.
TYPED_CONFIRM = {
    "players.delete": "DELETE PLAYER",
    "players.ban.perm": "PERMANENT BAN",
    "players.restore": "RESTORE PROGRESS",
    "players.resource.set": "SET RESOURCE",
}

RESOURCES = {
    # key            where it lives in the save            label
    "credits":    ("state", "credits", "IT Credits"),
    "xp":         ("state", "xp", "XP"),
    "energy":     ("state", "energy", "Energy"),
    "reputation": ("both", "reputation", "Reputation"),
    "legacy":     ("state", "legacy", "Legacy Points"),
    "level":      ("both", "level", "Level"),
}

MAX_RESOURCE = 10 ** 15     # refuse absurd values rather than store them


# --- schema -----------------------------------------------------------------

def _schema(pg):
    ts = "timestamptz" if pg else "text"
    pk = "bigserial primary key" if pg else "integer primary key autoincrement"
    big = "bigint" if pg else "integer"
    js = "jsonb" if pg else "text"
    boolean = "boolean" if pg else "integer"
    return (
        f"""create table if not exists {AD_TABLE} (
              id {pk},
              email text unique not null,
              name text not null,
              pw text not null,
              role text not null,
              grants {js},
              revokes {js},
              active {boolean} default {'true' if pg else '1'},
              must_change {boolean} default {'false' if pg else '0'},
              mfa_secret text,
              failed int default 0,
              locked_until {ts},
              last_login {ts},
              created_at {ts} not null,
              created_by {big}
            )""",
        f"""create table if not exists {AS_TABLE} (
              token text primary key,
              admin_id {big} not null,
              created_at {ts} not null,
              seen_at {ts} not null,
              expires_at {ts} not null,
              ip text,
              ua text
            )""",
        f"""create table if not exists {AU_TABLE} (
              id {pk},
              at {ts} not null,
              admin_id {big},
              admin_name text,
              action text not null,
              target_type text,
              target_id {big},
              target_name text,
              old_value text,
              new_value text,
              reason text,
              ip text
            )""",
        f"""create table if not exists {BN_TABLE} (
              id {pk},
              player_id {big} not null,
              kind text not null,
              reason text not null,
              until {ts},
              issued_by {big},
              issued_by_name text,
              issued_at {ts} not null,
              lifted_by_name text,
              lifted_at {ts},
              active {boolean} default {'true' if pg else '1'}
            )""",
        f"""create table if not exists {SN_TABLE} (
              id {pk},
              player_id {big} not null,
              at {ts} not null,
              reason text,
              admin_name text,
              level int,
              reputation {big},
              credits {big},
              state {js}
            )""",
        f"create index if not exists {AU_TABLE}_at_idx on {AU_TABLE} (id desc)",
        f"create index if not exists {SN_TABLE}_p_idx on {SN_TABLE} (player_id, id desc)",
        f"create index if not exists {BN_TABLE}_p_idx on {BN_TABLE} (player_id)",
    )


def install(runner, tables, hasher, checker, is_pg):
    global q, P_TABLE, S_TABLE, A_TABLE, hash_password, check_password, _is_pg
    global _DUMMY_HASH
    q = runner
    P_TABLE, S_TABLE, A_TABLE = tables
    hash_password, check_password = hasher, checker
    _is_pg = is_pg
    _DUMMY_HASH = hasher(secrets.token_urlsafe(32))


_schema_ready = False
_schema_lock = threading.Lock()


def ensure_schema():
    """Build the tables once per process.

    handle() calls this on every request so a cold or replaced database heals
    itself, but without this guard that meant a dozen DDL round trips and a
    bootstrap check on each one — slow against a hosted database, and it filled
    the log with the same line over and over.
    """
    global _schema_ready
    with _schema_lock:
        if _schema_ready:
            return
        _build_schema()
        _schema_ready = True


def _build_schema():
    for stmt in _schema(_is_pg):
        q(stmt)
    # the player table predates any notion of an account being anything other
    # than live, so soft delete and suspension are added here
    # `ranked` is created by the game's own schema, because the public
    # leaderboard reads it. Only the console's own columns are added here.
    for col, decl in (("status", "text"), ("status_note", "text")):
        try:
            if _is_pg:
                q(f"alter table {P_TABLE} add column if not exists {col} {decl}")
            else:
                cols = [r[1] for r in q(f"pragma table_info({P_TABLE})", (), "all")]
                if col not in cols:
                    q(f"alter table {P_TABLE} add column {col} {decl}")
        except Exception:
            pass
    _bootstrap()


def _bootstrap():
    """Create — or recover — the first super admin from the environment.

    The password is never generated here and never printed. Whoever deploys the
    service supplies it, and the account is flagged so the first sign-in has to
    replace it.

    Recovery matters as much as creation. If the only administrator's password
    is wrong, forgotten, or the account is locked, there is otherwise no way
    back into the console at all. Setting ADMIN_RESET alongside the other two
    repairs the named account. That is safe because anyone who can set
    environment variables already controls the deployment; it is gated behind
    an explicit flag only so an ordinary redeploy never silently reverts a
    password somebody chose.

    Everything it does is printed, because Render's log tab is the one place an
    operator can look when they cannot get in.
    """
    import os
    email = (os.environ.get("ADMIN_EMAIL") or "").strip().lower()
    pw = os.environ.get("ADMIN_PASSWORD") or ""
    reset = (os.environ.get("ADMIN_RESET") or "").strip().lower() in ("1", "true", "yes", "on")

    def say(msg):
        print(f"[admin] {msg}", flush=True)

    if not email or not pw:
        row = q(f"select count(*) from {AD_TABLE}", (), "one")
        if not (row and row[0]):
            say("no administrator exists and ADMIN_EMAIL / ADMIN_PASSWORD are "
                "not set — the console cannot be signed into yet")
        return

    total = (q(f"select count(*) from {AD_TABLE}", (), "one") or [0])[0]
    existing = _admin_by_email(email)

    if not total:
        q(f"""insert into {AD_TABLE} (email, name, pw, role, active, must_change,
                                      created_at)
              values (%s, %s, %s, 'SUPER_ADMIN', %s, %s, %s)""",
          (email, email.split("@")[0][:40] or "Owner", hash_password(pw),
           _true(), _true(), _now()))
        say(f"created the first administrator: {email}")
        _audit(None, "Bootstrapped the first super admin", target_type="admin",
               target_name=email, reason="ADMIN_EMAIL set in the environment")
        return

    if existing and reset:
        q(f"""update {AD_TABLE} set pw = %s, must_change = %s, failed = 0,
                  locked_until = null, active = %s where id = %s""",
          (hash_password(pw), _true(), _true(), existing["id"]))
        q(f"delete from {AS_TABLE} where admin_id = %s", (existing["id"],))
        say(f"ADMIN_RESET: reset the password for {email} and cleared any lock. "
            f"Remove ADMIN_RESET and ADMIN_PASSWORD once you are back in.")
        _audit(None, "Password reset from the environment", target_type="admin",
               target_id=existing["id"], target_name=email,
               reason="ADMIN_RESET set in the environment")
        return

    if existing:
        locked = _dt(existing["locked_until"])
        state = []
        if not existing["active"]:
            state.append("DISABLED")
        if locked and locked > datetime.now(timezone.utc):
            state.append(f"LOCKED until {locked:%H:%M} UTC")
        if existing["must_change"]:
            state.append("must change password")
        say(f"administrator {email} already exists"
            + (f" ({', '.join(state)})" if state else "")
            + " — ADMIN_PASSWORD is ignored. Set ADMIN_RESET=1 to reset it.")
        return

    if reset:
        q(f"""insert into {AD_TABLE} (email, name, pw, role, active, must_change,
                                      created_at)
              values (%s, %s, %s, 'SUPER_ADMIN', %s, %s, %s)""",
          (email, email.split("@")[0][:40] or "Owner", hash_password(pw),
           _true(), _true(), _now()))
        say(f"ADMIN_RESET: created a new super admin {email}")
        _audit(None, "Super admin created from the environment", target_type="admin",
               target_name=email, reason="ADMIN_RESET set in the environment")
        return

    others = q(f"select email from {AD_TABLE} order by id limit 5", (), "all") or []
    say(f"{total} administrator(s) exist but {email} is not one of them "
        f"(existing: {', '.join(r[0] for r in others)}). "
        f"Set ADMIN_RESET=1 to create it, or sign in as one of those.")


# --- small helpers ----------------------------------------------------------

def _now():
    return datetime.now(timezone.utc).isoformat()


def _dt(value):
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not value:
        return None
    try:
        d = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _jin(value):
    return json.dumps(value) if not _is_pg else json.dumps(value)


def _jout(value):
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return None


TRUE = "true" if False else None      # replaced below once _is_pg is known


def _true_sql():
    return 'true' if _is_pg else '1'


def _true():
    return True if _is_pg else 1


def _false():
    return False if _is_pg else 0


def _truthy(v):
    return bool(v) and v not in (0, "0", "false", "f")


# --- audit ------------------------------------------------------------------

def _audit(actor, action, target_type=None, target_id=None, target_name=None,
           old_value=None, new_value=None, reason=None, ip=None):
    """Write one immutable line. There is deliberately no update or delete
    path for this table anywhere in the module."""
    q(f"""insert into {AU_TABLE}
          (at, admin_id, admin_name, action, target_type, target_id,
           target_name, old_value, new_value, reason, ip)
          values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
      (_now(), (actor or {}).get("id"), (actor or {}).get("name", "system"),
       action, target_type, target_id, target_name,
       None if old_value is None else str(old_value)[:400],
       None if new_value is None else str(new_value)[:400],
       (reason or "")[:400] or None, ip))


# --- snapshots --------------------------------------------------------------

def snapshot(player_id, reason, admin_name=None):
    """Copy a player's save before anything touches it.

    This is the difference between "we changed the wrong account" being an
    apology and being a fix.
    """
    row = q(f"select state, level, reputation from {P_TABLE} where id = %s",
            (player_id,), "one")
    if not row:
        return None
    state = _jout(row[0]) or {}
    q(f"""insert into {SN_TABLE} (player_id, at, reason, admin_name, level,
                                  reputation, credits, state)
          values (%s,%s,%s,%s,%s,%s,%s,%s)""",
      (player_id, _now(), reason, admin_name, row[1], row[2],
       int(state.get("credits") or 0), _jin(state)))
    # keep the history bounded without ever discarding the newest few
    old = q(f"""select id from {SN_TABLE} where player_id = %s
                order by id desc offset {SNAPSHOT_KEEP}""" if _is_pg else
            f"""select id from {SN_TABLE} where player_id = %s
                order by id desc limit -1 offset {SNAPSHOT_KEEP}""",
            (player_id,), "all") or []
    for (sid,) in old:
        q(f"delete from {SN_TABLE} where id = %s", (sid,))
    return True


# --- authentication ---------------------------------------------------------

_fails = {}
_fails_lock = threading.Lock()

# A real hash of a value nobody knows, used only to burn the same time a
# genuine password check would when there is no account to check against.
_DUMMY_HASH = None


def _rate_limited(ip):
    now = time.time()
    with _fails_lock:
        hits = [t for t in _fails.get(ip, []) if now - t < 300]
        _fails[ip] = hits
        return len(hits) >= 10


def _note_fail(ip):
    with _fails_lock:
        _fails.setdefault(ip, []).append(time.time())


def _totp(secret, when=None, drift=1):
    """Standard 30-second TOTP, so any authenticator app works."""
    try:
        import base64
        key = base64.b32decode(secret.upper() + "=" * (-len(secret) % 8))
    except Exception:
        return set()
    step = int((when or time.time()) // 30)
    out = set()
    for s in range(step - drift, step + drift + 1):
        mac = hmac.new(key, struct.pack(">Q", s), hashlib.sha1).digest()
        off = mac[-1] & 0x0F
        code = (struct.unpack(">I", mac[off:off + 4])[0] & 0x7FFFFFFF) % 1_000_000
        out.add(f"{code:06d}")
    return out


def _admin_row(row):
    if not row:
        return None
    (aid, email, name, pw, role, grants, revokes, active, must_change,
     mfa, failed, locked, last_login) = row
    grants = _jout(grants) or []
    revokes = _jout(revokes) or []
    perms = set(ROLES.get(role, []))
    perms |= set(grants)
    perms -= set(revokes)
    perms -= ROLE_CEILING.get(role, set())
    return {
        "id": aid, "email": email, "name": name, "pw": pw, "role": role,
        "grants": grants, "revokes": revokes, "active": _truthy(active),
        "must_change": _truthy(must_change), "mfa": bool(mfa),
        "mfa_secret": mfa, "failed": failed or 0, "locked_until": locked,
        "last_login": last_login, "perms": sorted(perms),
    }


ADMIN_COLS = ("id, email, name, pw, role, grants, revokes, active, "
              "must_change, mfa_secret, failed, locked_until, last_login")


def _admin_by_email(email):
    return _admin_row(q(f"select {ADMIN_COLS} from {AD_TABLE} where email = %s",
                        (email.strip().lower(),), "one"))


def _admin_by_id(aid):
    return _admin_row(q(f"select {ADMIN_COLS} from {AD_TABLE} where id = %s",
                        (aid,), "one"))


def actor_for(token):
    """Resolve a session cookie to an admin, enforcing both expiry and idle."""
    if not token:
        return None
    row = q(f"select admin_id, expires_at, seen_at from {AS_TABLE} where token = %s",
            (token,), "one")
    if not row:
        return None
    now = datetime.now(timezone.utc)
    expires, seen = _dt(row[1]), _dt(row[2])
    if (expires and now > expires) or (seen and now - seen > timedelta(minutes=IDLE_MINUTES)):
        q(f"delete from {AS_TABLE} where token = %s", (token,))
        return None
    admin = _admin_by_id(row[0])
    if not admin or not admin["active"]:
        q(f"delete from {AS_TABLE} where token = %s", (token,))
        return None
    q(f"update {AS_TABLE} set seen_at = %s where token = %s", (_now(), token))
    admin["token"] = token
    return admin


def _login(body, ip, ua):
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    code = (body.get("code") or "").strip()
    if _rate_limited(ip):
        return 429, {"error": "Too many attempts. Try again in a few minutes."}
    admin = _admin_by_email(email)

    # One indistinguishable failure for a bad address and a bad password, so
    # the form cannot be used to find out which addresses are administrators.
    def refuse():
        _note_fail(ip)
        return 401, {"error": "Those details were not recognised."}

    if not admin or not admin["active"]:
        # Spend the same time hashing as a real check would, so the reply for
        # an unknown address is not measurably faster than one for a real
        # account with the wrong password. Without this the form answers "does
        # this person administer the game?" to anyone holding a stopwatch.
        check_password(password, _DUMMY_HASH)
        if admin:
            _audit(None, "Sign-in refused (account disabled)", target_type="admin",
                   target_name=email, ip=ip)
        return refuse()
    locked = _dt(admin["locked_until"])
    if locked and datetime.now(timezone.utc) < locked:
        mins = max(1, int((locked - datetime.now(timezone.utc)).total_seconds() // 60) + 1)
        return 423, {"error": f"This account is locked for another {mins} minute(s)."}
    if not check_password(password, admin["pw"]):
        failed = admin["failed"] + 1
        until = None
        if failed >= LOCKOUT_AFTER:
            until = (datetime.now(timezone.utc)
                     + timedelta(minutes=LOCKOUT_MINUTES)).isoformat()
            _audit(None, "Account locked after repeated failures", target_type="admin",
                   target_id=admin["id"], target_name=email,
                   new_value=f"{failed} failures", ip=ip)
        q(f"update {AD_TABLE} set failed = %s, locked_until = %s where id = %s",
          (failed, until, admin["id"]))
        _audit(None, "Failed sign-in", target_type="admin", target_id=admin["id"],
               target_name=email, new_value=f"attempt {failed}", ip=ip)
        return refuse()
    if admin["mfa_secret"]:
        if not code:
            return 401, {"error": "Enter the 6-digit code from your authenticator.",
                         "mfa": True}
        if code not in _totp(admin["mfa_secret"]):
            _note_fail(ip)
            _audit(None, "Failed sign-in (wrong 2FA code)", target_type="admin",
                   target_id=admin["id"], target_name=email, ip=ip)
            return 401, {"error": "That code was not right.", "mfa": True}

    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    q(f"""insert into {AS_TABLE} (token, admin_id, created_at, seen_at,
                                  expires_at, ip, ua)
          values (%s,%s,%s,%s,%s,%s,%s)""",
      (token, admin["id"], now.isoformat(), now.isoformat(),
       (now + timedelta(hours=SESSION_HOURS)).isoformat(), ip, (ua or "")[:200]))
    q(f"update {AD_TABLE} set failed = 0, locked_until = null, last_login = %s where id = %s",
      (_now(), admin["id"]))
    _audit(admin, "Signed in", ip=ip)
    return 200, {"ok": True, "token": token, "must_change": admin["must_change"],
                 "me": _me(admin)}


def _me(admin):
    return {"id": admin["id"], "name": admin["name"], "email": admin["email"],
            "role": admin["role"], "perms": admin["perms"],
            "must_change": admin["must_change"], "mfa": admin["mfa"]}


def can(actor, perm):
    return bool(actor) and perm in actor["perms"]


# --- player reads -----------------------------------------------------------

def _ban_state(player_id):
    rows = q(f"""select id, kind, reason, until, issued_by_name, issued_at,
                        lifted_by_name, lifted_at, active
                 from {BN_TABLE} where player_id = %s order by id desc""",
             (player_id,), "all") or []
    history, active = [], None
    now = datetime.now(timezone.utc)
    for r in rows:
        until = _dt(r[3])
        live = _truthy(r[8]) and (until is None or until > now)
        item = {"id": r[0], "kind": r[1], "reason": r[2],
                "until": until.isoformat() if until else None,
                "by": r[4], "at": _dt(r[5]).isoformat() if _dt(r[5]) else None,
                "lifted_by": r[6],
                "lifted_at": _dt(r[7]).isoformat() if _dt(r[7]) else None,
                "active": live}
        if live and not active:
            active = item
        history.append(item)
    return active, history


def _activity(player_id, days=30):
    rows = q(f"""select day, seconds, saves, sessions from {A_TABLE}
                 where player_id = %s order by day desc limit %s""",
             (player_id, days), "all") or []
    return [{"day": str(r[0]), "seconds": r[1] or 0, "saves": r[2] or 0,
             "sessions": r[3] or 0} for r in rows]


def _player_full(pid):
    row = q(f"""select id, name_key, display, created_at, updated_at, level,
                       reputation, tickets, spec, rev, state, status, status_note,
                       coalesce(ranked, {_true_sql()})
                from {P_TABLE} where id = %s""", (pid,), "one")
    if not row:
        return None
    state = _jout(row[10]) or {}
    life = state.get("lifetime") or {}
    roster = state.get("roster") or []
    inv = state.get("inventory") or []
    sessions = q(f"select count(*) from {S_TABLE} where player_id = %s", (pid,), "one")
    ban, ban_history = _ban_state(pid)
    snaps = q(f"""select id, at, reason, admin_name, level, reputation, credits
                  from {SN_TABLE} where player_id = %s order by id desc limit 40""",
              (pid,), "all") or []
    return {
        "id": row[0], "username": row[1], "display": row[2],
        "created_at": _dt(row[3]).isoformat() if _dt(row[3]) else None,
        "last_save": _dt(row[4]).isoformat() if _dt(row[4]) else None,
        "level": row[5], "reputation": row[6], "tickets": row[7],
        "spec": row[8], "rev": row[9],
        "status": row[11] or "active", "status_note": row[12],
        "ranked": _truthy(row[13]),
        "sessions": (sessions or [0])[0],
        "ban": ban, "ban_history": ban_history,
        "progression": {
            "chapter": state.get("chapter"), "xp": state.get("xp"),
            "credits": state.get("credits"), "energy": state.get("energy"),
            "energy_max": state.get("energyMax"), "legacy": state.get("legacy"),
            "morale": state.get("morale"), "streak": state.get("streak"),
            "reorgs": state.get("reorgs"), "started": state.get("started"),
        },
        "lifetime": life,
        "staff": [{"uid": c.get("uid"), "defId": c.get("defId"),
                   "level": c.get("level"), "xp": c.get("xp"),
                   "rarity": c.get("rarity"), "dept": c.get("dept"),
                   "equipped": len(c.get("equip") or {})} for c in roster],
        "equipment": [{"uid": i.get("uid"), "eid": i.get("eid"),
                       "level": i.get("level"), "on": i.get("on")} for i in inv],
        "standard": state.get("standard") or {},
        "achievements": state.get("achievements") or [],
        "activity": _activity(pid),
        "snapshots": [{"id": s[0],
                       "at": _dt(s[1]).isoformat() if _dt(s[1]) else None,
                       "reason": s[2], "by": s[3], "level": s[4],
                       "reputation": s[5], "credits": s[6]} for s in snaps],
        "has_state": bool(state),
    }


def _search(term, limit=50):
    term = (term or "").strip()
    params, where = [], ""
    if term:
        if term.isdigit():
            where = "where id = %s or name_key like %s"
            params = [int(term), f"%{term}%"]
        else:
            where = "where name_key like %s or display like %s"
            params = [f"%{term.lower()}%", f"%{term}%"]
    rows = q(f"""select id, name_key, display, level, reputation, tickets,
                        created_at, updated_at, status
                 from {P_TABLE} {where} order by updated_at desc limit {int(limit)}""",
             tuple(params), "all") or []
    live = {r[0] for r in (q(f"select distinct player_id from {S_TABLE}", (), "all") or [])}
    banned = {r[0] for r in (q(f"select distinct player_id from {BN_TABLE} where active = %s",
                               (_true(),), "all") or [])}
    return [{"id": r[0], "username": r[1], "display": r[2], "level": r[3],
             "reputation": r[4], "tickets": r[5],
             "created_at": _dt(r[6]).isoformat() if _dt(r[6]) else None,
             "last_save": _dt(r[7]).isoformat() if _dt(r[7]) else None,
             "status": r[8] or "active", "online": r[0] in live,
             "flagged": r[0] in banned} for r in rows]


# --- dashboard --------------------------------------------------------------

def _dashboard():
    """Only numbers the database can actually answer.

    Where the game does not record something, this reports that plainly
    instead of estimating. An operations screen that guesses is worse than one
    that admits a gap, because somebody will act on the guess.
    """
    today = datetime.now(timezone.utc).date()

    def one(sql, params=()):
        r = q(sql, params, "one")
        return (r or [0])[0] or 0

    total = one(f"select count(*) from {P_TABLE}")
    online = one(f"select count(distinct player_id) from {S_TABLE}")
    d = lambda n: (today - timedelta(days=n)).isoformat()
    active_today = one(f"select count(*) from {A_TABLE} where day = %s", (today.isoformat(),))
    active_week = one(f"select count(distinct player_id) from {A_TABLE} where day >= %s", (d(6),))
    new_today = one(f"select count(*) from {P_TABLE} where created_at >= %s", (d(0),))
    new_week = one(f"select count(*) from {P_TABLE} where created_at >= %s", (d(6),))
    secs = one(f"select coalesce(sum(seconds),0) from {A_TABLE} where day = %s",
               (today.isoformat(),))
    sess = one(f"select coalesce(sum(sessions),0) from {A_TABLE} where day = %s",
               (today.isoformat(),))
    banned = one(f"select count(distinct player_id) from {BN_TABLE} where active = %s",
                 (_true(),))
    deactivated = one(f"select count(*) from {P_TABLE} where status = %s", ("deactivated",))

    # retention: of the people who first appeared N days ago, how many came back
    def retention(n):
        start = d(n)
        cohort = q(f"select id from {P_TABLE} where created_at >= %s and created_at < %s",
                   (start, d(n - 1)), "all") or []
        if not cohort:
            return None
        ids = [c[0] for c in cohort]
        back = 0
        for pid in ids:
            hit = q(f"select 1 from {A_TABLE} where player_id = %s and day > %s limit 1",
                    (pid, start), "one")
            if hit:
                back += 1
        return {"cohort": len(ids), "returned": back,
                "pct": round(back * 100.0 / len(ids), 1)}

    # economy, read straight out of the saves. Cumulative lifetime totals are
    # all the game keeps, so that is what this says — not a daily flow.
    rows = q(f"select state from {P_TABLE} where state is not null limit 2000", (), "all") or []
    econ = {"credits_earned": 0, "xp_earned": 0, "tickets": 0, "incidents": 0,
            "levelups": 0, "held_credits": 0, "reorgs": 0}
    levels, chapters, powers = [], {}, 0
    for (raw,) in rows:
        st = _jout(raw) or {}
        life = st.get("lifetime") or {}
        econ["credits_earned"] += int(life.get("credits") or 0)
        econ["xp_earned"] += int(life.get("xp") or 0)
        econ["tickets"] += int(life.get("tickets") or 0)
        econ["incidents"] += int(life.get("incidents") or 0)
        econ["levelups"] += int(life.get("levelups") or 0)
        econ["reorgs"] += int(life.get("reorgs") or 0)
        econ["held_credits"] += int(st.get("credits") or 0)
        levels.append(int(st.get("level") or 1))
        ch = str(st.get("chapter") or 1)
        chapters[ch] = chapters.get(ch, 0) + 1
        powers += len(st.get("roster") or [])

    audit_today = one(f"select count(*) from {AU_TABLE} where at >= %s", (d(0),))
    fails_today = one(f"""select count(*) from {AU_TABLE}
                          where at >= %s and action like %s""", (d(0), "Failed sign-in%"))

    return {
        "players": {
            "total": total, "online": online, "active_today": active_today,
            "active_week": active_week, "new_today": new_today,
            "new_week": new_week, "banned": banned, "deactivated": deactivated,
        },
        "activity": {
            "seconds_today": secs, "sessions_today": sess,
            "avg_session_min": round(secs / sess / 60, 1) if sess else 0,
            "avg_minutes_per_active": round(secs / active_today / 60, 1) if active_today else 0,
        },
        "retention": {"d1": retention(1), "d7": retention(7), "d30": retention(30)},
        "economy": econ,
        "progression": {
            "avg_level": round(sum(levels) / len(levels), 1) if levels else 0,
            "max_level": max(levels) if levels else 0,
            "chapters": chapters,
            "staff_total": powers,
        },
        "admin": {"actions_today": audit_today, "failed_logins_today": fails_today},
        # Said out loud, so nobody reads a zero as a fact.
        "not_captured": [
            "Tickets resolved today (only lifetime totals are stored per save)",
            "Credits and XP spent (the game records what was earned, not each transaction)",
            "Equipment acquisition source and date",
            "API error rate, response time and background job status",
            "Database backup age and size (managed by the hosting provider)",
        ],
    }


# --- mutations --------------------------------------------------------------

def _load_state(pid):
    row = q(f"select state from {P_TABLE} where id = %s", (pid,), "one")
    return _jout(row[0]) if row else None


def _save_state(pid, state, bump_rev=True):
    """Write a save back, moving the revision on.

    The player client refuses to write over a newer revision than it last
    read, so bumping this is what makes an open tab notice that something
    changed underneath it rather than silently undoing the fix.
    """
    level = int(state.get("level") or 1)
    rep = int(state.get("reputation") or 0)
    tickets = int((state.get("lifetime") or {}).get("tickets") or 0)
    if bump_rev:
        q(f"""update {P_TABLE} set state = %s, level = %s, reputation = %s,
                  tickets = %s, updated_at = %s, rev = rev + 1 where id = %s""",
          (_jin(state), level, rep, tickets, _now(), pid))
    else:
        q(f"update {P_TABLE} set state = %s, updated_at = %s where id = %s",
          (_jin(state), _now(), pid))


def _resource(actor, pid, body, ip):
    key = body.get("resource")
    mode = (body.get("mode") or "").lower()
    reason = (body.get("reason") or "").strip()
    if key not in RESOURCES:
        return 400, {"error": "Unknown resource."}
    if mode not in ("add", "remove", "set"):
        return 400, {"error": "Mode must be add, remove or set."}
    if not reason:
        return 400, {"error": "A reason is required."}
    perm = f"players.resource.{mode}"
    if not can(actor, perm):
        return 403, {"error": "Your role cannot do that."}
    try:
        amount = int(float(body.get("amount")))
    except Exception:
        return 400, {"error": "Amount must be a number."}
    if amount < 0:
        return 400, {"error": "Amount cannot be negative. Use remove instead."}
    if amount > MAX_RESOURCE:
        return 400, {"error": "That amount is out of range."}

    state = _load_state(pid)
    if state is None:
        return 404, {"error": "That player has no save yet."}
    where, field, label = RESOURCES[key]
    old = int(state.get(field) or 0)
    if mode == "add":
        new = old + amount
    elif mode == "remove":
        new = max(0, old - amount)
    else:
        new = amount
    if new > MAX_RESOURCE:
        return 400, {"error": "That would put the value out of range."}
    if key == "level":
        new = max(1, min(new, 999))
    if new == old:
        return 200, {"ok": True, "unchanged": True, "old": old, "new": new}

    snapshot(pid, f"before {mode} {label}", actor["name"])
    state[field] = new
    if where == "both":
        pass                       # _save_state mirrors level and reputation
    _save_state(pid, state)
    name = q(f"select name_key from {P_TABLE} where id = %s", (pid,), "one")
    _audit(actor, f"{mode.title()} {label}", "player", pid,
           name[0] if name else None, old, new, reason, ip)
    return 200, {"ok": True, "old": old, "new": new, "difference": new - old}


def _ban(actor, pid, body, ip):
    kind = (body.get("kind") or "").lower()
    reason = (body.get("reason") or "").strip()
    if not reason:
        return 400, {"error": "A reason is required."}
    perm = {"temporary": "players.ban.temp", "permanent": "players.ban.perm",
            "suspend": "players.suspend"}.get(kind)
    if not perm:
        return 400, {"error": "Unknown ban type."}
    if not can(actor, perm):
        return 403, {"error": "Your role cannot issue that."}
    until = None
    if kind in ("temporary", "suspend"):
        try:
            hours = float(body.get("hours") or 24)
        except Exception:
            return 400, {"error": "Duration must be a number of hours."}
        if hours <= 0 or hours > 24 * 365:
            return 400, {"error": "Duration must be between 1 hour and a year."}
        until = (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()
    row = q(f"select name_key from {P_TABLE} where id = %s", (pid,), "one")
    if not row:
        return 404, {"error": "No such player."}
    q(f"""insert into {BN_TABLE} (player_id, kind, reason, until, issued_by,
                                  issued_by_name, issued_at, active)
          values (%s,%s,%s,%s,%s,%s,%s,%s)""",
      (pid, kind, reason, until, actor["id"], actor["name"], _now(), _true()))
    q(f"delete from {S_TABLE} where player_id = %s", (pid,))    # end their sessions
    _audit(actor, f"{kind.title()} ban issued", "player", pid, row[0],
           "active", kind + (f" until {until}" if until else ""), reason, ip)
    return 200, {"ok": True}


def _unban(actor, pid, body, ip):
    if not can(actor, "players.unban"):
        return 403, {"error": "Your role cannot lift bans."}
    reason = (body.get("reason") or "").strip()
    if not reason:
        return 400, {"error": "A reason is required."}
    q(f"""update {BN_TABLE} set active = %s, lifted_by_name = %s, lifted_at = %s
          where player_id = %s and active = %s""",
      (_false(), actor["name"], _now(), pid, _true()))
    q(f"update {P_TABLE} set status = null, status_note = null where id = %s", (pid,))
    row = q(f"select name_key from {P_TABLE} where id = %s", (pid,), "one")
    _audit(actor, "Ban lifted", "player", pid, row[0] if row else None,
           "banned", "active", reason, ip)
    return 200, {"ok": True}


def _restore(actor, pid, body, ip):
    if not can(actor, "players.restore"):
        return 403, {"error": "Your role cannot restore progress."}
    reason = (body.get("reason") or "").strip()
    if not reason:
        return 400, {"error": "A reason is required."}
    sid = body.get("snapshot_id")
    row = q(f"select state, at, level, reputation, credits from {SN_TABLE} "
            f"where id = %s and player_id = %s", (sid, pid), "one")
    if not row:
        return 404, {"error": "That snapshot does not belong to this player."}
    state = _jout(row[0])
    if not isinstance(state, dict):
        return 400, {"error": "That snapshot is unreadable and will not be applied."}
    # the current state becomes a snapshot too, so a restore is itself undoable
    snapshot(pid, f"before restoring snapshot #{sid}", actor["name"])
    before = _load_state(pid) or {}
    _save_state(pid, state)
    q(f"delete from {S_TABLE} where player_id = %s", (pid,))    # force a clean reload
    name = q(f"select name_key from {P_TABLE} where id = %s", (pid,), "one")
    _audit(actor, "Restored progress from snapshot", "player", pid,
           name[0] if name else None,
           f"level {before.get('level')}, {before.get('credits')} cr",
           f"level {state.get('level')}, {state.get('credits')} cr "
           f"(snapshot #{sid})", reason, ip)
    return 200, {"ok": True}


def _reset(actor, pid, body, ip):
    """The several small resets, each with its own permission, instead of one
    button that does something drastic and vague."""
    kind = (body.get("kind") or "").lower()
    reason = (body.get("reason") or "").strip() or "Support request"
    spec = {
        "password": ("players.reset.password", "Required a new password"),
        "session":  ("players.reset.session", "Revoked sessions"),
        "daily":    ("players.reset.daily", "Reset daily missions"),
        "energy":   ("players.reset.energy", "Reset energy"),
        "tutorial": ("players.reset.tutorial", "Reset the tutorial"),
        "run":      ("players.reset.run", "Reset the current run"),
    }.get(kind)
    if not spec:
        return 400, {"error": "Unknown reset."}
    perm, label = spec
    if not can(actor, perm):
        return 403, {"error": "Your role cannot do that."}
    row = q(f"select name_key from {P_TABLE} where id = %s", (pid,), "one")
    if not row:
        return 404, {"error": "No such player."}

    if kind == "password":
        # A one-time code the player types in. No administrator ever sees or
        # sets the player's actual password.
        code = f"{secrets.randbelow(1000000):06d}"
        q(f"update {P_TABLE} set status_note = %s where id = %s",
          (f"pwreset:{hashlib.sha256(code.encode()).hexdigest()}:"
           f"{(datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()}", pid))
        q(f"delete from {S_TABLE} where player_id = %s", (pid,))
        _audit(actor, label, "player", pid, row[0], None, "reset code issued", reason, ip)
        return 200, {"ok": True, "code": code,
                     "note": "Give this to the player. It expires in 2 hours and "
                             "can be used once. It is not their password."}
    if kind == "session":
        n = q(f"select count(*) from {S_TABLE} where player_id = %s", (pid,), "one")
        q(f"delete from {S_TABLE} where player_id = %s", (pid,))
        _audit(actor, label, "player", pid, row[0], f"{(n or [0])[0]} sessions",
               "0 sessions", reason, ip)
        return 200, {"ok": True}

    state = _load_state(pid)
    if state is None:
        return 404, {"error": "That player has no save yet."}
    snapshot(pid, f"before {label.lower()}", actor["name"])
    old = None
    if kind == "daily":
        old = len(state.get("missions") or [])
        state["missions"] = []
        state["missionsAt"] = 0
    elif kind == "energy":
        old = state.get("energy")
        state["energy"] = state.get("energyMax") or 0
        state["energyAcc"] = 0
    elif kind == "tutorial":
        old = state.get("md")
        state["md"] = 0
    elif kind == "run":
        old = f"{len(state.get('queue') or [])} queued"
        state["queue"] = []
        state["incident"] = None
        state["busy"] = False
    _save_state(pid, state)
    _audit(actor, label, "player", pid, row[0], old, "reset", reason, ip)
    return 200, {"ok": True}


def _ranking(actor, pid, body, ip):
    """Show or hide one account in the public boards.

    Nothing about the player's own game changes — they keep every credit, every
    level and their whole save, and they still see their own figures. They are
    simply not listed for anybody else, and cannot win the month. The reason a
    game needs this is the owner's own account: a year of testing sitting
    permanently at the top makes the leaderboard meaningless for the friends it
    is supposed to be for.
    """
    if not can(actor, "players.rankings"):
        return 403, {"error": "Your role cannot change the rankings."}
    show = bool(body.get("ranked"))
    reason = (body.get("reason") or "").strip()
    if not reason:
        return 400, {"error": "A reason is required."}
    row = q(f"select name_key, coalesce(ranked, {_true_sql()}) from {P_TABLE} where id = %s",
            (pid,), "one")
    if not row:
        return 404, {"error": "No such player."}
    was = _truthy(row[1])
    q(f"update {P_TABLE} set ranked = %s where id = %s",
      (_true() if show else _false(), pid))
    _audit(actor, "Shown in rankings" if show else "Hidden from rankings",
           "player", pid, row[0],
           "listed" if was else "hidden", "listed" if show else "hidden", reason, ip)
    return 200, {"ok": True, "ranked": show}


def _deactivate(actor, pid, body, ip):
    """Soft delete. The row and the save both stay exactly where they are."""
    if not can(actor, "players.deactivate"):
        return 403, {"error": "Your role cannot deactivate accounts."}
    reason = (body.get("reason") or "").strip()
    if not reason:
        return 400, {"error": "A reason is required."}
    row = q(f"select name_key, status from {P_TABLE} where id = %s", (pid,), "one")
    if not row:
        return 404, {"error": "No such player."}
    snapshot(pid, "before deactivation", actor["name"])
    q(f"update {P_TABLE} set status = %s where id = %s", ("deactivated", pid))
    q(f"delete from {S_TABLE} where player_id = %s", (pid,))
    _audit(actor, "Deactivated account", "player", pid, row[0],
           row[1] or "active", "deactivated", reason, ip)
    return 200, {"ok": True}


def _reactivate(actor, pid, body, ip):
    if not can(actor, "players.deactivate"):
        return 403, {"error": "Your role cannot change account status."}
    row = q(f"select name_key from {P_TABLE} where id = %s", (pid,), "one")
    q(f"update {P_TABLE} set status = null where id = %s", (pid,))
    _audit(actor, "Reactivated account", "player", pid, row[0] if row else None,
           "deactivated", "active", (body.get("reason") or "").strip(), ip)
    return 200, {"ok": True}


def _change_password(actor, body, ip):
    """Change one's own password.

    A forced first rotation is the exception to needing the current password.
    The admin proved they knew the temporary one to get this session at all,
    and there is a real case — reloading the page while the session cookie is
    still valid — where the browser is asked to rotate with no login form on
    screen and so cannot know it. Requiring it there made the account
    impossible to finish setting up.
    """
    current = body.get("current") or ""
    new = body.get("new") or ""
    row = q(f"select pw from {AD_TABLE} where id = %s", (actor["id"],), "one")
    if not row:
        return 401, {"error": "Sign in again."}
    forced = actor["must_change"]
    if not forced and not check_password(current, row[0]):
        return 401, {"error": "Your current password was not right."}
    problem = _password_problem(new)
    if problem:
        return 400, {"error": problem}
    if check_password(new, row[0]):
        return 400, {"error": "The new password must be different."}
    q(f"""update {AD_TABLE} set pw = %s, must_change = %s, failed = 0,
              locked_until = null where id = %s""",
      (hash_password(new), _false(), actor["id"]))
    # every other session for this admin ends
    q(f"delete from {AS_TABLE} where admin_id = %s and token <> %s",
      (actor["id"], actor.get("token") or ""))
    _audit(actor, "Set first password" if forced else "Changed own password",
           "admin", actor["id"], actor["email"], ip=ip)
    return 200, {"ok": True}


def _password_problem(pw):
    if len(pw or "") < 12:
        return "Use at least 12 characters."
    if not re.search(r"[A-Za-z]", pw) or not re.search(r"\d", pw):
        return "Use at least one letter and one number."
    if pw.lower() in ("password1234", "administrator", "itempire1234"):
        return "That password is too easy to guess."
    return None


# --- admin management -------------------------------------------------------

def _admins_list():
    rows = q(f"""select id, email, name, role, active, must_change, mfa_secret,
                        last_login, created_at, failed, locked_until
                 from {AD_TABLE} order by id""", (), "all") or []
    live = {}
    for r in (q(f"select admin_id, max(seen_at) from {AS_TABLE} group by admin_id",
                (), "all") or []):
        live[r[0]] = _dt(r[1])
    now = datetime.now(timezone.utc)
    out = []
    for r in rows:
        seen = live.get(r[0])
        out.append({
            "id": r[0], "email": r[1], "name": r[2], "role": r[3],
            "active": _truthy(r[4]), "must_change": _truthy(r[5]),
            "mfa": bool(r[6]),
            "last_login": _dt(r[7]).isoformat() if _dt(r[7]) else None,
            "created_at": _dt(r[8]).isoformat() if _dt(r[8]) else None,
            "failed": r[9] or 0,
            "locked": bool(_dt(r[10]) and _dt(r[10]) > now),
            "online": bool(seen and now - seen < timedelta(minutes=IDLE_MINUTES)),
        })
    return out


def _admin_create(actor, body, ip):
    if not can(actor, "admins.manage"):
        return 403, {"error": "Your role cannot manage administrators."}
    email = (body.get("email") or "").strip().lower()
    name = (body.get("name") or "").strip()[:40]
    role = body.get("role")
    pw = body.get("password") or ""
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        return 400, {"error": "That email address does not look right."}
    if role not in ROLES:
        return 400, {"error": "Unknown role."}
    problem = _password_problem(pw)
    if problem:
        return 400, {"error": problem}
    if _admin_by_email(email):
        return 409, {"error": "An administrator with that address already exists."}
    q(f"""insert into {AD_TABLE} (email, name, pw, role, active, must_change,
                                  created_at, created_by)
          values (%s,%s,%s,%s,%s,%s,%s,%s)""",
      (email, name or email.split("@")[0], hash_password(pw), role,
       _true(), _true(), _now(), actor["id"]))
    _audit(actor, "Created administrator", "admin", None, email, None, role,
           (body.get("reason") or "").strip(), ip)
    return 200, {"ok": True}


def _admin_update(actor, aid, body, ip):
    if not can(actor, "admins.manage"):
        return 403, {"error": "Your role cannot manage administrators."}
    target = _admin_by_id(aid)
    if not target:
        return 404, {"error": "No such administrator."}
    changes = []
    if "role" in body:
        if body["role"] not in ROLES:
            return 400, {"error": "Unknown role."}
        if target["id"] == actor["id"] and body["role"] != actor["role"]:
            return 400, {"error": "You cannot change your own role."}
        changes.append(("role", target["role"], body["role"]))
        q(f"update {AD_TABLE} set role = %s where id = %s", (body["role"], aid))
    if "active" in body:
        if target["id"] == actor["id"] and not body["active"]:
            return 400, {"error": "You cannot disable your own account."}
        changes.append(("active", target["active"], bool(body["active"])))
        q(f"update {AD_TABLE} set active = %s where id = %s",
          (_true() if body["active"] else _false(), aid))
        if not body["active"]:
            q(f"delete from {AS_TABLE} where admin_id = %s", (aid,))
    for field in ("grants", "revokes"):
        if field in body:
            vals = [p for p in (body[field] or []) if p in PERMISSIONS]
            changes.append((field, getattr_safe(target, field), vals))
            q(f"update {AD_TABLE} set {field} = %s where id = %s", (_jin(vals), aid))
    if "unlock" in body:
        q(f"update {AD_TABLE} set failed = 0, locked_until = null where id = %s", (aid,))
        changes.append(("locked", True, False))
    for field, old, new in changes:
        _audit(actor, f"Updated administrator ({field})", "admin", aid,
               target["email"], old, new, (body.get("reason") or "").strip(), ip)
    return 200, {"ok": True}


def getattr_safe(d, k):
    return d.get(k) if isinstance(d, dict) else None


# --- audit read -------------------------------------------------------------

def _audit_read(params):
    where, vals = [], []
    if params.get("player"):
        where.append("target_id = %s")
        vals.append(int(params["player"][0]))
    if params.get("admin"):
        where.append("admin_name like %s")
        vals.append(f"%{params['admin'][0]}%")
    if params.get("q"):
        where.append("(action like %s or reason like %s or target_name like %s)")
        term = f"%{params['q'][0]}%"
        vals += [term, term, term]
    clause = ("where " + " and ".join(where)) if where else ""
    rows = q(f"""select id, at, admin_name, action, target_type, target_id,
                        target_name, old_value, new_value, reason, ip
                 from {AU_TABLE} {clause} order by id desc limit 300""",
             tuple(vals), "all") or []
    return [{"id": r[0], "at": _dt(r[1]).isoformat() if _dt(r[1]) else None,
             "admin": r[2], "action": r[3], "target_type": r[4],
             "target_id": r[5], "target_name": r[6], "old": r[7],
             "new": r[8], "reason": r[9], "ip": r[10]} for r in rows]


# --- routing ----------------------------------------------------------------

def page():
    return admin_ui.page(ROLES, PERMISSIONS, TYPED_CONFIRM, RESOURCES)


def handle(method, route, body, token, ip, ua, params):
    """Return (status, payload, set_cookie_or_None).

    Every branch that changes anything checks a permission first, and every
    branch that changes anything writes an audit line. There is no path
    through this function that mutates a player without doing both.
    """
    ensure_schema()

    if route == "session" and method == "POST":
        status, payload = _login(body, ip, ua)
        cookie = payload.pop("token", None) if status == 200 else None
        return status, payload, cookie

    actor = actor_for(token)
    if route == "session" and method == "DELETE":
        if token:
            q(f"delete from {AS_TABLE} where token = %s", (token,))
            if actor:
                _audit(actor, "Signed out", ip=ip)
        return 200, {"ok": True}, "-"

    if not actor:
        return 401, {"error": "Sign in again."}, None

    # A password that has to change blocks everything else first.
    if actor["must_change"] and route != "password":
        return 403, {"error": "Set a new password before continuing.",
                     "must_change": True}, None

    if route == "me":
        return 200, {"me": _me(actor), "roles": sorted(ROLES),
                     "permissions": PERMISSIONS,
                     "typed_confirm": TYPED_CONFIRM,
                     "session_hours": SESSION_HOURS,
                     "idle_minutes": IDLE_MINUTES}, None

    if route == "password" and method == "POST":
        s, p = _change_password(actor, body, ip)
        return s, p, None

    if route == "dashboard":
        if not can(actor, "analytics.view") and not can(actor, "players.view"):
            return 403, {"error": "Your role cannot view the dashboard."}, None
        return 200, _dashboard(), None

    if route == "players":
        if not can(actor, "players.view"):
            return 403, {"error": "Your role cannot search players."}, None
        return 200, {"players": _search((params.get("q") or [""])[0])}, None

    if route == "audit":
        if not can(actor, "logs.view"):
            return 403, {"error": "Your role cannot read the audit log."}, None
        return 200, {"entries": _audit_read(params)}, None

    if route == "admins":
        if not can(actor, "admins.manage"):
            return 403, {"error": "Your role cannot manage administrators."}, None
        if method == "POST":
            s, p = _admin_create(actor, body, ip)
            return s, p, None
        return 200, {"admins": _admins_list(), "roles": sorted(ROLES),
                     "permissions": PERMISSIONS}, None

    m = re.match(r"^admins/(\d+)$", route)
    if m and method == "POST":
        s, p = _admin_update(actor, int(m.group(1)), body, ip)
        return s, p, None

    m = re.match(r"^player/(\d+)$", route)
    if m:
        if not can(actor, "players.view"):
            return 403, {"error": "Your role cannot view players."}, None
        data = _player_full(int(m.group(1)))
        if not data:
            return 404, {"error": "No such player."}, None
        return 200, data, None

    m = re.match(r"^player/(\d+)/(\w+)$", route)
    if m and method == "POST":
        pid, act = int(m.group(1)), m.group(2)
        # the phrase has to arrive with the request, not merely be typed in a
        # dialog the browser could skip
        need = {"resource": None, "ban": None, "restore": "players.restore",
                "delete": "players.delete"}.get(act)
        if act == "resource" and (body.get("mode") == "set"):
            need = "players.resource.set"
        if act == "ban" and (body.get("kind") == "permanent"):
            need = "players.ban.perm"
        phrase = TYPED_CONFIRM.get(need)
        if phrase and (body.get("confirm") or "").strip().upper() != phrase:
            return 400, {"error": f'Type "{phrase}" to confirm this.'}, None

        fn = {"resource": _resource, "ban": _ban, "unban": _unban,
              "restore": _restore, "reset": _reset, "ranking": _ranking,
              "deactivate": _deactivate, "reactivate": _reactivate}.get(act)
        if not fn:
            return 404, {"error": "Unknown action."}, None
        s, p = fn(actor, pid, body, ip)
        return s, p, None

    return 404, {"error": "Unknown route."}, None
