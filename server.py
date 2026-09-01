"""IT Empire — accounts, cloud saves and the company leaderboard.

Run with:  python3 server.py     then open http://localhost:8480

Everyone who plays signs in with a name and a password, builds their own
technician, and their progress follows them to any device. The server is a
dumb, careful safe: the game rules all live in the browser, and the server
only ever stores the save blob the game hands it, plus the few numbers the
leaderboard needs.

Storage is Postgres when DATABASE_URL is set (that is what the hosted copy
uses, so saves survive restarts) and a local SQLite file otherwise, so this
runs on your laptop with no setup at all.
"""

import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import threading
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path

import owner
from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get("PORT", 8480))
DIR = Path(__file__).parent
DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Tables are prefixed so this can share a database with other projects.
P_TABLE = "ie_players"
S_TABLE = "ie_sessions"
A_TABLE = "ie_activity"

# The owner dashboard stays switched off on a host until a real key is set.
# "localtest" only ever works on your own machine.
OWNER_KEY = os.environ.get("OWNER_KEY", "" if os.environ.get("RENDER") else "localtest")

# A save more than this far after the last one means they walked away in
# between, so the gap is not counted as time played.
ACTIVE_GAP_MAX = 90
# A gap longer than this starts a new visit.
SESSION_GAP = 30 * 60

SESSION_DAYS = 90
MAX_STATE_BYTES = 400_000          # a very long game is ~40KB; this is generous
NAME_RE = re.compile(r"^[A-Za-z0-9 ._-]{2,18}$")
SG = ZoneInfo("Asia/Singapore")

# Files the browser is allowed to ask for. Everything else is a 404, so the
# server's own source and the build folder are never served.
STATIC_DIRS = ("css", "js")


# --- database ---------------------------------------------------------------

_pg = None
if DATABASE_URL:
    try:
        import psycopg
        from psycopg_pool import ConnectionPool
        _pg = ConnectionPool(DATABASE_URL, min_size=1, max_size=4, kwargs={"autocommit": True})
    except Exception as exc:          # fall back rather than refuse to start
        print(f"[db] Postgres unavailable ({exc}); using local SQLite instead")
        _pg = None

_sqlite_path = DIR / "it-empire.db"
_sqlite_lock = threading.Lock()

SCHEMA_PG = (
    f"""create table if not exists {P_TABLE} (
          id          bigserial primary key,
          name_key    text unique not null,
          display     text not null,
          pw          text not null,
          created_at  timestamptz not null default now(),
          updated_at  timestamptz not null default now(),
          state       jsonb,
          level       int  default 1,
          reputation  bigint default 0,
          tickets     bigint default 0,
          spec        text,
          art         jsonb,
          rev         bigint default 0
        )""",
    f"""create table if not exists {S_TABLE} (
          token      text primary key,
          player_id  bigint not null,
          created_at timestamptz not null default now()
        )""",
    f"""create table if not exists {A_TABLE} (
          player_id  bigint not null,
          day        date not null,
          seconds    int default 0,
          saves      int default 0,
          sessions   int default 0,
          primary key (player_id, day)
        )""",
    f"create index if not exists {P_TABLE}_rep_idx on {P_TABLE} (reputation desc)",
)

SCHEMA_LITE = (
    f"""create table if not exists {P_TABLE} (
          id integer primary key autoincrement,
          name_key text unique not null, display text not null, pw text not null,
          created_at text not null, updated_at text not null,
          state text, level integer default 1, reputation integer default 0,
          tickets integer default 0, spec text, art text, rev integer default 0)""",
    f"""create table if not exists {S_TABLE} (
          token text primary key, player_id integer not null, created_at text not null)""",
    f"""create table if not exists {A_TABLE} (
          player_id integer not null, day text not null, seconds integer default 0,
          saves integer default 0, sessions integer default 0,
          primary key (player_id, day))""",
)

_ready = False
_ready_lock = threading.Lock()


def _ensure_schema():
    global _ready
    with _ready_lock:
        if _ready:
            return
        if _pg:
            with _pg.connection() as c:
                for stmt in SCHEMA_PG:
                    c.execute(stmt)
                # tables that predate the revision guard
                c.execute(f"alter table {P_TABLE} add column if not exists rev bigint default 0")
        else:
            with _sqlite_lock, sqlite3.connect(_sqlite_path) as c:
                for stmt in SCHEMA_LITE:
                    c.execute(stmt)
                cols = [r[1] for r in c.execute(f"pragma table_info({P_TABLE})")]
                if "rev" not in cols:
                    c.execute(f"alter table {P_TABLE} add column rev integer default 0")
        _ready = True


def q(sql, params=(), fetch=None):
    """Run one statement. `fetch` is None, 'one' or 'all'.

    Written with %s placeholders (Postgres style) and translated for SQLite,
    so there is only ever one copy of each query.

    If the statement fails because the tables are not there — a fresh database,
    or one that went away underneath us — rebuild the schema once and retry,
    rather than staying wedged until someone restarts the process."""
    try:
        return _run(sql, params, fetch)
    except Exception as exc:
        if "does not exist" not in str(exc) and "no such table" not in str(exc):
            raise
        global _ready
        with _ready_lock:
            _ready = False
        _ensure_schema()
        return _run(sql, params, fetch)


def _run(sql, params=(), fetch=None):
    _ensure_schema()
    if _pg:
        with _pg.connection() as c:
            cur = c.execute(sql, params)
            if fetch == "one":
                return cur.fetchone()
            if fetch == "all":
                return cur.fetchall()
            return None
    lite_sql = sql.replace("%s", "?")
    with _sqlite_lock, sqlite3.connect(_sqlite_path) as c:
        cur = c.execute(lite_sql, params)
        if fetch == "one":
            return cur.fetchone()
        if fetch == "all":
            return cur.fetchall()
        return None


def _json_in(value):
    """Postgres takes jsonb natively; SQLite wants text."""
    if value is None:
        return None
    if _pg:
        return json.dumps(value)
    return json.dumps(value)


def _json_out(value):
    if value is None or isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return None


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


# --- passwords --------------------------------------------------------------

# PBKDF2 rather than scrypt: scrypt needs an OpenSSL that not every Python
# build ships with, and a password check that crashes is worse than one that
# is merely slower.
PBKDF2_ROUNDS = 200_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ROUNDS)
    return f"pbkdf2${PBKDF2_ROUNDS}${salt.hex()}${digest.hex()}"


def check_password(password: str, stored: str) -> bool:
    try:
        _, rounds, salt_hex, want = stored.split("$")
        got = hashlib.pbkdf2_hmac("sha256", password.encode(),
                                  bytes.fromhex(salt_hex), int(rounds)).hex()
        return hmac.compare_digest(got, want)
    except Exception:
        return False


# --- login throttle ---------------------------------------------------------

_attempts = {}
_attempts_lock = threading.Lock()


def too_many_attempts(ip: str) -> bool:
    now = time.time()
    with _attempts_lock:
        hits = [t for t in _attempts.get(ip, []) if now - t < 300]
        _attempts[ip] = hits
        return len(hits) >= 12


def note_attempt(ip: str):
    with _attempts_lock:
        _attempts.setdefault(ip, []).append(time.time())


# --- player helpers ---------------------------------------------------------

def player_by_name(name: str):
    return q(f"select id, display, pw from {P_TABLE} where name_key = %s",
             (name.strip().lower(),), "one")


def player_public(row):
    return {"name": row[0], "level": row[1], "reputation": row[2],
            "tickets": row[3], "spec": row[4], "art": _json_out(row[5]),
            "updated": str(row[6])}


def session_player(token: str):
    if not token:
        return None
    row = q(f"""select p.id, p.display, p.state, p.spec, p.updated_at, p.rev
                from {S_TABLE} s join {P_TABLE} p on p.id = s.player_id
                where s.token = %s""", (token,), "one")
    return row


def new_session(player_id: int) -> str:
    token = secrets.token_urlsafe(32)
    q(f"insert into {S_TABLE} (token, player_id, created_at) values (%s, %s, %s)",
      (token, player_id, _now_iso()))
    return token


def _parse_ts(value):
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromisoformat(str(value))
    except Exception:
        return None


def today_key():
    return datetime.now(SG).date().isoformat()


def record_activity(player_id, last_seen, new_session=False):
    """Count time played from the gap between saves.

    The game saves every ten seconds while somebody is actually playing, so
    consecutive saves are a decent measure of attention. A gap longer than
    ACTIVE_GAP_MAX means they walked away, and is not counted at all — this
    measures time played, not time logged in."""
    now = datetime.now(timezone.utc)
    prev = _parse_ts(last_seen)
    gap = (now - prev).total_seconds() if prev else None
    seconds = int(gap) if gap is not None and 0 < gap <= ACTIVE_GAP_MAX else 0
    starts = 1 if (new_session or gap is None or gap > SESSION_GAP) else 0
    day = today_key()
    if _pg:
        q(f"""insert into {A_TABLE} (player_id, day, seconds, saves, sessions)
              values (%s, %s, %s, 1, %s)
              on conflict (player_id, day) do update set
                seconds = {A_TABLE}.seconds + excluded.seconds,
                saves = {A_TABLE}.saves + 1,
                sessions = {A_TABLE}.sessions + excluded.sessions""",
          (player_id, day, seconds, starts))
    else:
        q(f"""insert into {A_TABLE} (player_id, day, seconds, saves, sessions)
              values (%s, %s, %s, 1, %s)
              on conflict (player_id, day) do update set
                seconds = seconds + %s, saves = saves + 1, sessions = sessions + %s""",
          (player_id, day, seconds, starts, seconds, starts))


def summarise(state: dict):
    """Pull the handful of numbers the leaderboard shows out of a save."""
    if not isinstance(state, dict):
        return 1, 0, 0, None, None
    life = state.get("lifetime") or {}
    hero = state.get("hero") or {}
    return (int(state.get("level") or 1),
            int(state.get("reputation") or 0),
            int(life.get("tickets") or 0),
            hero.get("spec"),
            hero.get("art"))


# --- http -------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    server_version = "ITEmpire"

    def log_message(self, fmt, *args):        # keep the console readable
        pass

    # -- plumbing --
    def _send(self, code, body=b"", ctype="application/json", extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def json(self, code, obj):
        self._send(code, json.dumps(obj).encode())

    def fail(self, code, message):
        self.json(code, {"error": message})

    def body(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return None
        if n <= 0 or n > MAX_STATE_BYTES + 4096:
            return None
        try:
            return json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            return None

    def token(self):
        auth = self.headers.get("Authorization") or ""
        return auth[7:].strip() if auth.startswith("Bearer ") else ""

    @property
    def ip(self):
        return self.headers.get("X-Forwarded-For", self.client_address[0]).split(",")[0].strip()

    # -- routes --
    def guard(self, fn, *args):
        """Any unexpected failure becomes a plain 500 the browser can read."""
        try:
            return fn(*args)
        except Exception as exc:
            import traceback
            traceback.print_exc()
            try:
                return self.fail(500, "The server had a problem saving that. Your progress is safe in this browser.")
            except Exception:
                return None

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path.startswith("/api/"):
            return self.guard(self.api_get, path[5:])
        if path == "/owner":
            return self.guard(self.owner_page, parse_qs(parsed.query))
        return self.guard(self.static, path)

    def owner_page(self, params):
        """Wrong key, no key, or no key configured all look identical from
        outside: a plain 404. The page never announces that it exists."""
        given = (params.get("key") or [""])[0]
        if not OWNER_KEY or not hmac.compare_digest(given, OWNER_KEY):
            return self.fail(404, "Not found")
        _ensure_schema()
        body = owner.page(q, P_TABLE, A_TABLE).encode()
        self._send(200, body, "text/html; charset=utf-8", {"Cache-Control": "no-store"})

    do_HEAD = do_GET

    def do_POST(self):
        path = urlparse(self.path).path
        if not path.startswith("/api/"):
            return self.fail(404, "Not found")
        return self.guard(self.api_post, path[5:])

    def do_DELETE(self):
        path = urlparse(self.path).path
        if path == "/api/account":
            return self.guard(self.delete_account)
        return self.fail(404, "Not found")

    def do_PUT(self):
        path = urlparse(self.path).path
        if path == "/api/state":
            return self.guard(self.save_state, self.token(), self.body())
        return self.fail(404, "Not found")

    # -- static --
    def static(self, path):
        if path in ("/", "/index.html"):
            target = DIR / "index.html"
        else:
            parts = [p for p in path.strip("/").split("/") if p not in ("", ".", "..")]
            if len(parts) != 2 or parts[0] not in STATIC_DIRS:
                return self.fail(404, "Not found")
            target = DIR / parts[0] / parts[1]
        if not target.is_file():
            return self.fail(404, "Not found")
        ctype = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript",):
            ctype += "; charset=utf-8"
        # no-cache everywhere: a returning player should never be left running
        # last week's javascript against this week's save format.
        self._send(200, target.read_bytes(), ctype, {"Cache-Control": "no-cache"})

    # -- api --
    def api_get(self, route):
        if route == "ping":
            return self.json(200, {"ok": True, "game": "IT Empire",
                                   "store": "postgres" if _pg else "sqlite"})
        if route == "state":
            row = session_player(self.token())
            if not row:
                return self.fail(401, "Your session expired. Sign in again.")
            return self.json(200, {"ok": True, "player": {"name": row[1]},
                                   "state": _json_out(row[2]), "rev": row[5] or 0,
                                   "now": int(time.time() * 1000)})
        if route == "leaderboard":
            rows = q(f"""select display, level, reputation, tickets, spec, art, updated_at
                         from {P_TABLE} order by reputation desc, tickets desc limit 50""",
                     (), "all") or []
            return self.json(200, {"ok": True, "players": [player_public(r) for r in rows]})
        return self.fail(404, "Not found")

    def api_post(self, route):
        data = self.body()
        if data is None:
            return self.fail(400, "That request did not arrive in one piece. Try again.")

        if route == "signup":
            name = str(data.get("name") or "").strip()
            password = str(data.get("password") or "")
            profile = data.get("profile") or {}
            if not NAME_RE.match(name):
                return self.fail(400, "Names are 2–18 characters: letters, numbers, spaces, . _ -")
            if len(password) < 6:
                return self.fail(400, "Passwords need at least 6 characters.")
            if player_by_name(name):
                return self.fail(409, "That name is taken. Try another.")
            art = profile.get("art")
            spec = profile.get("spec")
            q(f"""insert into {P_TABLE} (name_key, display, pw, created_at, updated_at,
                                          state, level, reputation, tickets, spec, art)
                  values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
              (name.lower(), name, hash_password(password), _now_iso(), _now_iso(),
               None, 1, 0, 0, spec, _json_in(art)))
            row = player_by_name(name)
            token = new_session(row[0])
            record_activity(row[0], None, new_session=True)
            return self.json(200, {"ok": True, "token": token, "fresh": True,
                                   "player": {"name": row[1]}, "state": None, "rev": 0,
                                   "now": int(time.time() * 1000)})

        if route == "login":
            if too_many_attempts(self.ip):
                return self.fail(429, "Too many attempts. Wait five minutes and try again.")
            name = str(data.get("name") or "").strip()
            password = str(data.get("password") or "")
            row = player_by_name(name)
            if not row or not check_password(password, row[2]):
                note_attempt(self.ip)
                return self.fail(401, "That name and password do not match.")
            token = new_session(row[0])
            record_activity(row[0], None, new_session=True)
            saved = q(f"select state, rev from {P_TABLE} where id = %s", (row[0],), "one")
            return self.json(200, {"ok": True, "token": token,
                                   "player": {"name": row[1]},
                                   "state": _json_out(saved[0]) if saved else None,
                                   "rev": (saved[1] or 0) if saved else 0,
                                   "now": int(time.time() * 1000)})

        if route == "logout":
            q(f"delete from {S_TABLE} where token = %s", (self.token(),))
            return self.json(200, {"ok": True})

        if route == "state-beacon":
            # Sent by the browser on the way out, where headers cannot be set.
            return self.save_state(str(data.get("token") or ""), data, quiet=True)

        return self.fail(404, "Not found")

    def delete_account(self):
        row = session_player(self.token())
        if not row:
            return self.fail(401, "Your session expired. Sign in again.")
        q(f"delete from {S_TABLE} where player_id = %s", (row[0],))
        q(f"delete from {A_TABLE} where player_id = %s", (row[0],))
        q(f"delete from {P_TABLE} where id = %s", (row[0],))
        return self.json(200, {"ok": True})

    def save_state(self, token, data, quiet=False):
        row = session_player(token)
        if not row:
            return self.fail(401, "Your session expired. Sign in again.")
        state = (data or {}).get("state")
        if not isinstance(state, dict):
            return self.fail(400, "That save did not look right, so nothing was overwritten.")
        blob = json.dumps(state)
        if len(blob) > MAX_STATE_BYTES:
            return self.fail(413, "That save is too large to store.")
        # The revision guard. Every accepted save bumps rev; a client must send
        # the rev it last saw. A second device — or a tab left open on a laptop
        # overnight — is holding an older rev, so its write is refused instead
        # of silently overwriting newer progress. It gets the winning state back
        # and adopts it.
        # A write with no revision at all is an old tab that has not reloaded
        # since this guard shipped. Refuse it too — that is precisely the tab
        # that overwrites a night of progress from another device.
        current = row[5] or 0
        sent = (data or {}).get("rev")
        if sent is None or int(sent) != int(current):
            return self.json(409, {
                "error": "Your game is open somewhere else and that copy is further ahead.",
                "conflict": True, "state": _json_out(row[2]), "rev": current,
                "now": int(time.time() * 1000),
            })

        record_activity(row[0], row[4] if len(row) > 4 else None)
        level, rep, tickets, spec, art = summarise(state)
        new_rev = int(current) + 1
        q(f"""update {P_TABLE} set state = %s, updated_at = %s, level = %s,
              reputation = %s, tickets = %s, spec = coalesce(%s, spec),
              art = coalesce(%s, art), rev = %s
              where id = %s""",
          (_json_in(state), _now_iso(), level, rep, tickets, spec, _json_in(art),
           new_rev, row[0]))
        return self.json(200, {"ok": True, "rev": new_rev, "now": int(time.time() * 1000)})


def main():
    _ensure_schema()
    where = "Postgres" if _pg else f"SQLite ({_sqlite_path.name})"
    print(f"IT Empire running on http://localhost:{PORT}  ·  saves in {where}")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
