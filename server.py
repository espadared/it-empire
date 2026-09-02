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
import admin
from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get("PORT", 8480))
DIR = Path(__file__).parent
DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Tables are prefixed so this can share a database with other projects.
P_TABLE = "ie_players"
S_TABLE = "ie_sessions"
A_TABLE = "ie_activity"
R_TABLE = "ie_rooms"
E_TABLE = "ie_entries"
C_TABLE = "ie_coop"
CP_TABLE = "ie_coop_parts"

# The owner dashboard stays switched off on a host until a real key is set.
# "localtest" only ever works on your own machine.
OWNER_KEY = os.environ.get("OWNER_KEY", "" if os.environ.get("RENDER") else "localtest")

# Admin console. The cookie is host-only, path-scoped and HttpOnly, so the game's
# own javascript can never read it even though both are served from one origin.
ADMIN_COOKIE = "ie_admin"
ADMIN_SECURE = "; Secure" if os.environ.get("RENDER") else ""

# A save more than this far after the last one means they walked away in
# between, so the gap is not counted as time played.
ACTIVE_GAP_MAX = 90
# A gap longer than this starts a new visit.
SESSION_GAP = 30 * 60

# A battle room stays open this long from its first entry, or until it fills.
ROOM_HOURS = 24        # a full day, so a small group still meets in one room
ROOM_MAX_ENTRIES = 8

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
        _pg = ConnectionPool(DATABASE_URL, min_size=1, max_size=4, timeout=20,
                             kwargs={"autocommit": True, "connect_timeout": 15})
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
    f"""create table if not exists {R_TABLE} (
          id         bigserial primary key,
          game       text not null,
          stake      bigint not null,
          created_at timestamptz not null default now(),
          closes_at  timestamptz not null,
          settled    boolean default false,
          winner_id  bigint,
          payout     bigint default 0,
          paid       boolean default false
        )""",
    f"""create table if not exists {E_TABLE} (
          room_id   bigint not null,
          player_id bigint not null,
          display   text not null,
          ms        bigint,
          played_at timestamptz not null default now(),
          primary key (room_id, player_id)
        )""",
    f"""create table if not exists {C_TABLE} (
          id         bigserial primary key,
          title      text not null,
          blurb      text,
          goal       bigint not null,
          progress   bigint default 0,
          started_at timestamptz not null default now(),
          ends_at    timestamptz not null,
          settled    boolean default false
        )""",
    f"""create table if not exists {CP_TABLE} (
          event_id    bigint not null,
          player_id   bigint not null,
          contributed bigint default 0,
          claimed     boolean default false,
          primary key (event_id, player_id)
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
    f"""create table if not exists {R_TABLE} (
          id integer primary key autoincrement, game text not null, stake integer not null,
          created_at text not null, closes_at text not null, settled integer default 0,
          winner_id integer, payout integer default 0, paid integer default 0)""",
    f"""create table if not exists {E_TABLE} (
          room_id integer not null, player_id integer not null, display text not null,
          ms integer, played_at text not null, primary key (room_id, player_id))""",
    f"""create table if not exists {C_TABLE} (
          id integer primary key autoincrement, title text not null, blurb text,
          goal integer not null, progress integer default 0,
          started_at text not null, ends_at text not null, settled integer default 0)""",
    f"""create table if not exists {CP_TABLE} (
          event_id integer not null, player_id integer not null,
          contributed integer default 0, claimed integer default 0,
          primary key (event_id, player_id))""",
)

_ready = False
_ready_lock = threading.Lock()

# Postgres wants true/false; SQLite stores booleans as 1/0.
TRUE, FALSE = ("true", "false") if _pg else ("1", "0")


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


def account_block(player_id):
    """Why this account cannot play right now, or None.

    Checked at sign-in and on every save, so a ban issued while somebody is
    mid-session takes effect on their next write rather than at their leisure.
    """
    try:
        row = q(f"select status from {P_TABLE} where id = %s", (player_id,), "one")
        if row and row[0] == "deactivated":
            return "This account has been deactivated. Contact support."
        ban = q(f"""select kind, reason, until from {admin.BN_TABLE}
                    where player_id = %s and active = {TRUE}
                    order by id desc limit 1""", (player_id,), "one")
    except Exception:
        return None                     # never lock people out on a lookup failure
    if not ban:
        return None
    kind, reason, until = ban
    word = "suspended" if kind == "suspend" else "banned"
    if until:
        end = admin._dt(until)
        if end and datetime.now(timezone.utc) > end:
            return None                 # lapsed; the admin side tidies it up
        return (f"This account is {word} until "
                f"{end.strftime('%d %b %Y, %H:%M')} UTC. Reason: {reason}")
    return f"This account has been permanently banned. Reason: {reason}"


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


# --- battle rooms ------------------------------------------------------------

def _iso(dt):
    return dt.isoformat()


def open_room(game, stake):
    """The open room for a game, created on demand."""
    row = q(f"""select id, stake, closes_at from {R_TABLE}
                where game = %s and settled = {FALSE} order by id desc limit 1""",
            (game,), "one")
    if row:
        closes = _parse_ts(row[2])
        n = q(f"select count(*) from {E_TABLE} where room_id = %s", (row[0],), "one")[0]
        if (closes and closes > datetime.now(timezone.utc)) and n < ROOM_MAX_ENTRIES:
            return row[0], row[1]
    now = datetime.now(timezone.utc)
    q(f"insert into {R_TABLE} (game, stake, created_at, closes_at) values (%s,%s,%s,%s)",
      (game, stake, _iso(now), _iso(now + timedelta(hours=ROOM_HOURS))))
    new = q(f"""select id, stake from {R_TABLE} where game = %s and settled = {FALSE}
                order by id desc limit 1""", (game,), "one")
    return new[0], new[1]


def settle_rooms():
    """Close any room past its deadline or full, and decide the winner.

    A room with a single entry refunds that player rather than paying them a
    pot of their own money — with a handful of friends playing, a room often
    only gets one runner."""
    now = datetime.now(timezone.utc)
    rooms = q(f"select id, stake, closes_at from {R_TABLE} where settled = {FALSE}", (), "all") or []
    for rid, stake, closes in rooms:
        entries = q(f"""select player_id, ms from {E_TABLE}
                        where room_id = %s and ms is not null order by ms asc""",
                    (rid,), "all") or []
        expired = _parse_ts(closes) and _parse_ts(closes) <= now
        full = len(entries) >= ROOM_MAX_ENTRIES
        if not expired and not full:
            continue
        if not entries:
            q(f"update {R_TABLE} set settled = {TRUE}, paid = {TRUE} where id = %s", (rid,))
            continue
        winner, _best = entries[0]
        pot = int(stake) * len(entries)
        q(f"update {R_TABLE} set settled = {TRUE}, winner_id = %s, payout = %s where id = %s",
          (winner, pot, rid))


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


# --- company-wide incident ------------------------------------------------

# A shared goal every player pushes at the same time. The game had a scoreboard
# and a wager, but nothing the group does together — nothing that makes one
# player message another. Contributions are counted server-side from tickets
# actually resolved, because a number the client reports is a number the client
# can invent.

COOP_EVENTS = [
    ("Company-Wide Outage", "Half the building cannot log in. Everyone on deck."),
    ("Ransomware Scare", "Suspicious traffic on the network. Clear the queue while security sweeps."),
    ("Head Office Migration", "Every laptop moves to the new domain this week."),
    ("Product Launch Day", "Ten thousand new users, and all of them have questions."),
    ("The Great Windows Update", "It rolled out overnight. Nothing survived contact."),
]
COOP_HOURS = 48
COOP_PER_PLAYER_CAP = 600        # what one committed player can carry over two days


def _coop_current(create=True):
    """The live event, creating a new one when the last has run its course."""
    now = datetime.now(timezone.utc)
    row = q(f"""select id, title, blurb, goal, progress, ends_at, settled
                from {C_TABLE} order by id desc limit 1""", (), "one")
    if row:
        ends = _parse_ts(row[5])
        if not _truthy_c(row[6]) and ends and ends > now:
            return row
        if not _truthy_c(row[6]) and ends and ends <= now:
            q(f"update {C_TABLE} set settled = {TRUE} where id = %s", (row[0],))
    if not create:
        return None
    players = (q(f"select count(*) from {P_TABLE}", (), "one") or [0])[0] or 1
    # The goal has to be reachable by the people who actually turn up, not by
    # everyone registered. At roughly a third of the per-player cap each, a
    # group finishes it when about half of them play — and the keen ones can
    # carry the rest, which is the point of a shared goal.
    goal = max(300, min(40000, players * 200))
    title, blurb = COOP_EVENTS[int(time.time() // (COOP_HOURS * 3600)) % len(COOP_EVENTS)]
    q(f"""insert into {C_TABLE} (title, blurb, goal, progress, started_at, ends_at)
          values (%s,%s,%s,0,%s,%s)""",
      (title, blurb, goal, _now_iso(),
       _iso(now + timedelta(hours=COOP_HOURS))))
    return q(f"""select id, title, blurb, goal, progress, ends_at, settled
                 from {C_TABLE} order by id desc limit 1""", (), "one")


def _truthy_c(v):
    return bool(v) and v not in (0, "0", "false", "f")


def coop_view(player_id):
    row = _coop_current()
    if not row:
        return None
    eid, title, blurb, goal, progress, ends_at, _ = row
    mine = q(f"""select contributed, claimed from {CP_TABLE}
                 where event_id = %s and player_id = %s""", (eid, player_id), "one")
    contributed = (mine[0] if mine else 0) or 0
    claimed = _truthy_c(mine[1]) if mine else False
    top = q(f"""select p.display, c.contributed from {CP_TABLE} c
                join {P_TABLE} p on p.id = c.player_id
                where c.event_id = %s order by c.contributed desc limit 5""",
            (eid,), "all") or []
    done = (progress or 0) >= goal
    ends = _parse_ts(ends_at)
    return {
        "id": eid, "title": title, "blurb": blurb,
        "goal": goal, "progress": min(progress or 0, goal),
        "done": done,
        "endsIn": max(0, int((ends - datetime.now(timezone.utc)).total_seconds())) if ends else 0,
        "mine": contributed, "claimed": claimed,
        "canClaim": bool(done and contributed > 0 and not claimed),
        "reward": _coop_reward(contributed, goal),
        "helpers": [{"name": r[0], "n": r[1]} for r in top],
        "players": len(top),
    }


def _coop_reward(contributed, goal):
    """Everyone who turned up gets something; the share scales with the work."""
    if contributed <= 0:
        return {"credits": 0, "rep": 0}
    share = min(1.0, contributed / max(1, goal * 0.25))
    return {"credits": int(4000 + 26000 * share), "rep": int(60 + 340 * share)}


def coop_add(player_id, n):
    row = _coop_current()
    if not row:
        return None
    eid, _, _, goal, progress, _, _ = row
    n = max(0, min(int(n or 0), 60))              # one batch is never a whole session
    if not n:
        return coop_view(player_id)
    mine = q(f"""select contributed from {CP_TABLE}
                 where event_id = %s and player_id = %s""", (eid, player_id), "one")
    have = (mine[0] if mine else 0) or 0
    n = max(0, min(n, COOP_PER_PLAYER_CAP - have))
    if n:
        if mine:
            q(f"""update {CP_TABLE} set contributed = contributed + %s
                  where event_id = %s and player_id = %s""", (n, eid, player_id))
        else:
            q(f"""insert into {CP_TABLE} (event_id, player_id, contributed)
                  values (%s,%s,%s)""", (eid, player_id, n))
        q(f"update {C_TABLE} set progress = progress + %s where id = %s", (n, eid))
    return coop_view(player_id)


def coop_claim(player_id):
    view = coop_view(player_id)
    if not view or not view["canClaim"]:
        return None
    q(f"""update {CP_TABLE} set claimed = {TRUE}
          where event_id = %s and player_id = %s""", (view["id"], player_id))
    return view["reward"]


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
        if path == "/admin" or path == "/admin/":
            return self.guard(self.admin_page)
        if path.startswith("/admin/api/"):
            return self.guard(self.admin_api, "GET", path[11:], parse_qs(parsed.query))
        return self.guard(self.static, path)

    # -- admin console --
    def admin_cookie(self):
        raw = self.headers.get("Cookie") or ""
        for part in raw.split(";"):
            k, _, v = part.strip().partition("=")
            if k == ADMIN_COOKIE:
                return v
        return ""

    def admin_page(self):
        _ensure_schema()
        admin.ensure_schema()
        body = admin.page().encode()
        self._send(200, body, "text/html; charset=utf-8",
                   {"Cache-Control": "no-store",
                    "X-Frame-Options": "DENY",
                    "Referrer-Policy": "no-referrer",
                    "X-Content-Type-Options": "nosniff"})

    def admin_api(self, method, route, params=None, data=None):
        _ensure_schema()
        # The console always sends this header. A cross-site form post cannot,
        # which together with SameSite=Strict is what stands in for CSRF tokens.
        if method != "GET" and self.headers.get("X-Admin-Request") != "1":
            return self.fail(403, "Bad request origin.")
        status, payload, cookie = admin.handle(
            method, route, data or {}, self.admin_cookie(), self.ip,
            self.headers.get("User-Agent", ""), params or {})
        extra = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}
        if cookie == "-":
            extra["Set-Cookie"] = (f"{ADMIN_COOKIE}=; Path=/admin; Max-Age=0; "
                                   f"HttpOnly; SameSite=Strict" + ADMIN_SECURE)
        elif cookie:
            extra["Set-Cookie"] = (
                f"{ADMIN_COOKIE}={cookie}; Path=/admin; "
                f"Max-Age={admin.SESSION_HOURS * 3600}; HttpOnly; SameSite=Strict"
                + ADMIN_SECURE)
        body = json.dumps(payload).encode()
        self._send(status, body, "application/json", extra)

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
        parsed = urlparse(self.path)
        path = parsed.path
        if path.startswith("/admin/api/"):
            return self.guard(self.admin_api, "POST", path[11:],
                              parse_qs(parsed.query), self.body())
        if not path.startswith("/api/"):
            return self.fail(404, "Not found")
        return self.guard(self.api_post, path[5:])

    def do_DELETE(self):
        path = urlparse(self.path).path
        if path.startswith("/admin/api/"):
            return self.guard(self.admin_api, "DELETE", path[11:], {}, self.body())
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
        if route == "coop":
            row = session_player(self.token())
            if not row:
                return self.fail(401, "Sign in again.")
            return self.json(200, {"ok": True, "coop": coop_view(row[0])})

        if route == "ping":
            # Answers without touching the database on purpose: this is what
            # the host polls to decide whether the service is up.
            return self.json(200, {"ok": True, "game": "IT Empire",
                                   "store": "postgres" if _pg else "sqlite",
                                   "schema": "ready" if _ready else "warming"})
        if route == "state":
            row = session_player(self.token())
            if not row:
                return self.fail(401, "Your session expired. Sign in again.")
            return self.json(200, {"ok": True, "player": {"name": row[1]},
                                   "state": _json_out(row[2]), "rev": row[5] or 0,
                                   "now": int(time.time() * 1000)})
        if route == "battle":
            row = session_player(self.token())
            if not row:
                return self.fail(401, "Your session expired. Sign in again.")
            settle_rooms()
            me = row[0]
            out = []
            for g in ("quiz", "memory", "scramble", "fault"):
                r = q(f"""select id, stake, closes_at from {R_TABLE}
                          where game = %s and settled = {FALSE} order by id desc limit 1""",
                      (g,), "one")
                if not r:
                    out.append({"game": g, "id": None, "entries": [], "pot": 0})
                    continue
                ents = q(f"""select display, ms, player_id from {E_TABLE}
                             where room_id = %s order by (ms is null), ms asc""", (r[0],), "all") or []
                out.append({
                    "game": g, "id": r[0], "stake": int(r[1]),
                    "closes": str(r[2]), "pot": int(r[1]) * len(ents),
                    "entries": [{"name": e[0], "ms": e[1], "mine": e[2] == me} for e in ents],
                    "joined": any(e[2] == me for e in ents),
                    "played": any(e[2] == me and e[1] is not None for e in ents),
                })
            # anything won and not yet collected
            wins = q(f"""select r.id, r.game, r.payout from {R_TABLE} r
                         where r.winner_id = %s and r.settled = {TRUE} and r.paid = {FALSE}""",
                     (me,), "all") or []
            # recent results, so a room feels like it happened
            past = q(f"""select r.game, r.payout, p.display from {R_TABLE} r
                         join {P_TABLE} p on p.id = r.winner_id
                         where r.settled = {TRUE} and r.winner_id is not null
                         order by r.id desc limit 6""", (), "all") or []
            return self.json(200, {"ok": True, "rooms": out,
                                   "wins": [{"room": w[0], "game": w[1], "payout": int(w[2])} for w in wins],
                                   "recent": [{"game": r0[0], "payout": int(r0[1]), "name": r0[2]} for r0 in past],
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
            blocked = account_block(row[0])
            if blocked:
                return self.fail(403, blocked)
            token = new_session(row[0])
            record_activity(row[0], None, new_session=True)
            saved = q(f"select state, rev from {P_TABLE} where id = %s", (row[0],), "one")
            return self.json(200, {"ok": True, "token": token,
                                   "player": {"name": row[1]},
                                   "state": _json_out(saved[0]) if saved else None,
                                   "rev": (saved[1] or 0) if saved else 0,
                                   "now": int(time.time() * 1000)})

        if route == "coop":
            row = session_player(self.token())
            if not row:
                return self.fail(401, "Your session expired. Sign in again.")
            n = int(data.get("n") or 0)
            view = coop_add(row[0], n) if n else coop_view(row[0])
            return self.json(200, {"ok": True, "coop": view})

        if route == "coop-claim":
            row = session_player(self.token())
            if not row:
                return self.fail(401, "Your session expired. Sign in again.")
            reward = coop_claim(row[0])
            if not reward:
                return self.fail(409, "There is nothing to collect.")
            return self.json(200, {"ok": True, "reward": reward,
                                   "coop": coop_view(row[0])})

        if route == "battle-enter":
            row = session_player(self.token())
            if not row:
                return self.fail(401, "Your session expired. Sign in again.")
            game = str(data.get("game") or "")
            stake = int(data.get("stake") or 0)
            if game not in ("quiz", "memory", "scramble", "fault") or stake <= 0:
                return self.fail(400, "That is not a room.")
            settle_rooms()
            rid, room_stake = open_room(game, stake)
            existing = q(f"select ms from {E_TABLE} where room_id = %s and player_id = %s",
                         (rid, row[0]), "one")
            if existing:
                return self.fail(409, "You have already entered this room. Wait for it to settle.")
            q(f"""insert into {E_TABLE} (room_id, player_id, display, ms, played_at)
                  values (%s,%s,%s,null,%s)""", (rid, row[0], row[1], _now_iso()))
            return self.json(200, {"ok": True, "room": rid, "stake": int(room_stake)})

        if route == "battle-score":
            row = session_player(self.token())
            if not row:
                return self.fail(401, "Your session expired. Sign in again.")
            rid = int(data.get("room") or 0)
            ms = int(data.get("ms") or 0)
            if ms < 1000 or ms > 60 * 60 * 1000:
                return self.fail(400, "That run does not look real.")
            got = q(f"select ms from {E_TABLE} where room_id = %s and player_id = %s",
                    (rid, row[0]), "one")
            if not got:
                return self.fail(400, "You are not in that room.")
            if got[0] is not None:
                return self.fail(409, "You have already run this one.")
            q(f"update {E_TABLE} set ms = %s, played_at = %s where room_id = %s and player_id = %s",
              (ms, _now_iso(), rid, row[0]))
            settle_rooms()
            return self.json(200, {"ok": True})

        if route == "battle-claim":
            row = session_player(self.token())
            if not row:
                return self.fail(401, "Your session expired. Sign in again.")
            rid = int(data.get("room") or 0)
            r = q(f"""select payout from {R_TABLE}
                      where id = %s and winner_id = %s and settled = {TRUE} and paid = {FALSE}""",
                  (rid, row[0]), "one")
            if not r:
                return self.fail(409, "Nothing to collect there.")
            q(f"update {R_TABLE} set paid = {TRUE} where id = %s", (rid,))
            return self.json(200, {"ok": True, "payout": int(r[0])})

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
        blocked = account_block(row[0])
        if blocked:
            # a ban issued mid-session takes effect here, on their next write
            q(f"delete from {S_TABLE} where player_id = %s", (row[0],))
            return self.fail(403, blocked)
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


def _install_admin():
    admin.install(q, (P_TABLE, S_TABLE, A_TABLE), hash_password, check_password,
                  bool(_pg))


def _warm_database():
    """Prepare the schema in the background.

    Deliberately not on the startup path: a sleeping or slow Postgres used to
    block before the port was ever bound, so the host saw a service that never
    came up and killed the deploy. The web server can serve the game while the
    database wakes, and q() rebuilds the schema on first use anyway."""
    try:
        _ensure_schema()
        admin.ensure_schema()
        print(f"[db] schema ready ({'Postgres' if _pg else 'SQLite'})", flush=True)
    except Exception as exc:
        print(f"[db] not ready yet ({exc}) — will retry on first use", flush=True)


_install_admin()


def main():
    where = "Postgres" if _pg else f"SQLite ({_sqlite_path.name})"
    # Bind first, so the host can see the service is alive straight away.
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"IT Empire listening on 0.0.0.0:{PORT}  ·  saves in {where}", flush=True)
    threading.Thread(target=_warm_database, daemon=True).start()
    srv.serve_forever()


if __name__ == "__main__":
    main()
