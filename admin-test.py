"""Admin console test: python3 admin-test.py

Runs a real server against a scratch SQLite file and drives it over HTTP, so
what is tested is the same path an administrator's browser takes — routing,
cookies, permission checks and all.

The checks that matter most are the negative ones: that a role cannot do what
it must not do, that a ban actually stops a player, and that nothing changes a
save without leaving a snapshot and an audit line behind.
"""

import json
import os
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

PORT = 8899
BASE = f"http://127.0.0.1:{PORT}"
BOOT_PW = "BootstrapPass99x"

fails = []


def check(name, cond, detail=""):
    if cond:
        print(f"  ok   {name}")
    else:
        fails.append(name)
        print(f"  FAIL {name}" + (f" -> {detail}" if detail else ""))


class Client:
    """One browser. Keeps its own cookie, like a separate person signed in."""

    def __init__(self):
        self.cookie = ""

    def __call__(self, method, path, body=None, bearer=None, header=True):
        req = urllib.request.Request(
            BASE + path, method=method,
            data=json.dumps(body).encode() if body is not None else None)
        req.add_header("Content-Type", "application/json")
        if method != "GET" and header:
            req.add_header("X-Admin-Request", "1")
        if self.cookie:
            req.add_header("Cookie", self.cookie)
        if bearer:
            req.add_header("Authorization", "Bearer " + bearer)
        try:
            r = urllib.request.urlopen(req, timeout=10)
            sc = r.headers.get("Set-Cookie")
            if sc:
                self.cookie = sc.split(";")[0]
            return r.status, json.loads(r.read() or b"{}")
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b"{}")

    def login(self, email, pw, new_pw=None):
        s, d = self("POST", "/admin/api/session", {"email": email, "password": pw})
        if new_pw and d.get("must_change"):
            self("POST", "/admin/api/password", {"current": pw, "new": new_pw})
            s, d = self("POST", "/admin/api/session", {"email": email, "password": new_pw})
        return s, d


def main():
    tmp = Path(tempfile.mkdtemp()) / "admin-test.db"
    os.environ.update({"PORT": str(PORT), "ADMIN_EMAIL": "owner@test.local",
                       "ADMIN_PASSWORD": BOOT_PW})
    # DATABASE_URL in the environment runs the whole suite against Postgres,
    # which is what production uses. Without it the run falls back to SQLite.
    if os.environ.get("DATABASE_URL"):
        print(f"(running against Postgres)\n")
    sys.path.insert(0, str(Path(__file__).parent))
    import server
    server._sqlite_path = tmp                 # never touch the developer's own database
    import admin
    threading.Thread(target=server.main, daemon=True).start()
    time.sleep(1.5)

    sup, cs, ana, anon = Client(), Client(), Client(), Client()

    print("AUTHENTICATION")
    s, _ = anon("GET", "/admin/api/dashboard")
    check("an unauthenticated request is refused", s == 401, f"got {s}")
    s, _ = anon("POST", "/admin/api/session",
                {"email": "owner@test.local", "password": "wrong"})
    check("a wrong password is refused", s == 401, f"got {s}")
    s, d = anon("POST", "/admin/api/session",
                {"email": "nobody@test.local", "password": "wrong"})
    check("an unknown address fails identically to a wrong password",
          s == 401 and "not recognised" in d.get("error", ""))

    s, d = sup("POST", "/admin/api/session",
               {"email": "owner@test.local", "password": BOOT_PW})
    check("the bootstrap admin signs in", s == 200 and d.get("must_change"))
    s, d = sup("GET", "/admin/api/dashboard")
    check("everything is blocked until the temporary password is replaced",
          s == 403 and d.get("must_change"), f"got {s}")
    s, _ = sup("POST", "/admin/api/password", {"current": BOOT_PW, "new": "short1"})
    check("a weak replacement password is refused", s == 400)
    # The first rotation is exactly what the browser sends: no current password,
    # because on a page reload there is no sign-in form on screen to read it
    # from. This shipped broken once — the console sent an empty string and the
    # account could never be finished, so the whole console was unreachable.
    s, _ = Client()("POST", "/admin/api/password", {"new": "Hijacked2026x"})
    check("a forced rotation still needs a session", s == 401, f"got {s}")
    s, _ = sup("POST", "/admin/api/password", {"new": "GoodPass2026x"})
    check("the forced first rotation works with no current password", s == 200, f"got {s}")
    s, _ = sup("POST", "/admin/api/session",
               {"email": "owner@test.local", "password": BOOT_PW})
    check("the temporary password stops working", s == 401, f"got {s}")
    s, d = sup("POST", "/admin/api/session",
               {"email": "owner@test.local", "password": "GoodPass2026x"})
    check("the new password signs in and is no longer flagged",
          s == 200 and not d.get("must_change"), f"got {s}")
    s, _ = sup("POST", "/admin/api/password", {"new": "SneakyPass2026x"})
    check("a later change still demands the current password", s == 401, f"got {s}")
    sup.login("owner@test.local", "GoodPass2026x")
    s, d = sup("GET", "/admin/api/me")
    check("super admin holds every permission",
          s == 200 and len(d["me"]["perms"]) == len(admin.PERMISSIONS))

    print("\nBRUTE FORCE")
    victim = Client()
    for _ in range(admin.LOCKOUT_AFTER):
        victim("POST", "/admin/api/session",
               {"email": "owner@test.local", "password": "nope"})
    s, d = victim("POST", "/admin/api/session",
                  {"email": "owner@test.local", "password": "GoodPass2026x"})
    check("the account locks after repeated failures, even with the right password",
          s == 423, f"got {s} {d}")
    sup("POST", "/admin/api/admins/1", {"unlock": True, "reason": "test"})
    s, _ = Client().login("owner@test.local", "GoodPass2026x")
    check("an unlock restores access", s == 200, f"got {s}")

    print("\nCSRF")
    s, _ = sup("POST", "/admin/api/players", {}, header=False)
    check("a POST without the console's own header is refused", s == 403, f"got {s}")

    print("\nA PLAYER TO WORK ON")
    game = Client()
    s, d = game("POST", "/api/signup", {"name": "Subject", "password": "playerpw123",
                                        "profile": {"spec": "fixer", "art": {}}})
    ptok = d.get("token")
    game("PUT", "/api/state", {"state": {
        "level": 30, "reputation": 9000, "credits": 1_000_000, "xp": 400,
        "energy": 10, "energyMax": 50, "chapter": 3,
        "lifetime": {"tickets": 1200, "credits": 5_000_000, "xp": 90_000},
        "roster": [{"uid": "a", "defId": "veteran", "level": 25, "xp": 5,
                    "rarity": "EPIC", "equip": {}, "dept": "infra"}],
        "inventory": [{"uid": "i", "eid": "lap_basic", "level": 2, "on": None}],
        "missions": [1, 2, 3]}, "rev": 0}, bearer=ptok)
    s, d = sup("GET", "/admin/api/players?q=Subject")
    pid = d["players"][0]["id"]
    check("the player is searchable", s == 200 and d["players"][0]["level"] == 30)
    s, d = sup("GET", f"/admin/api/player/{pid}")
    check("the profile reads the save",
          d["progression"]["credits"] == 1_000_000 and len(d["staff"]) == 1)

    print("\nRESOURCE CHANGES")
    s, d = sup("POST", f"/admin/api/player/{pid}/resource",
               {"resource": "credits", "mode": "add", "amount": 5000})
    check("a change without a reason is refused", s == 400)
    s, d = sup("POST", f"/admin/api/player/{pid}/resource",
               {"resource": "credits", "mode": "add", "amount": 5000, "reason": "Missing reward"})
    check("add applies and reports both values",
          s == 200 and d["old"] == 1_000_000 and d["new"] == 1_005_000)
    s, d = sup("POST", f"/admin/api/player/{pid}/resource",
               {"resource": "credits", "mode": "remove", "amount": 10 ** 12, "reason": "x"})
    check("remove floors at zero rather than going negative", s == 200 and d["new"] == 0)
    s, d = sup("POST", f"/admin/api/player/{pid}/resource",
               {"resource": "credits", "mode": "set", "amount": 700, "reason": "x"})
    check("set demands the typed phrase", s == 400 and "SET RESOURCE" in d["error"])
    s, d = sup("POST", f"/admin/api/player/{pid}/resource",
               {"resource": "credits", "mode": "set", "amount": 700, "reason": "x",
                "confirm": "SET RESOURCE"})
    check("set applies with the phrase", s == 200 and d["new"] == 700)
    s, d = sup("POST", f"/admin/api/player/{pid}/resource",
               {"resource": "credits", "mode": "add", "amount": 10 ** 16, "reason": "x"})
    check("an absurd amount is refused", s == 400)
    s, d = sup("POST", f"/admin/api/player/{pid}/resource",
               {"resource": "wallet", "mode": "add", "amount": 1, "reason": "x"})
    check("an unknown resource is refused", s == 400)

    print("\nSNAPSHOTS AND RESTORE")
    s, d = sup("GET", f"/admin/api/player/{pid}")
    snaps = d["snapshots"]
    check("a snapshot was taken before every change", len(snaps) >= 3, f"{len(snaps)}")
    oldest = snaps[-1]
    check("the earliest snapshot still holds the original balance",
          oldest["credits"] == 1_000_000, str(oldest))
    s, d = sup("POST", f"/admin/api/player/{pid}/restore",
               {"snapshot_id": oldest["id"], "reason": "test"})
    check("restore demands the typed phrase", s == 400)
    s, d = sup("POST", f"/admin/api/player/{pid}/restore",
               {"snapshot_id": 999999, "reason": "x", "confirm": "RESTORE PROGRESS"})
    check("a snapshot belonging to nobody is refused", s == 404)
    s, d = sup("POST", f"/admin/api/player/{pid}/restore",
               {"snapshot_id": oldest["id"], "reason": "Lost progress",
                "confirm": "RESTORE PROGRESS"})
    check("restore is accepted", s == 200, str(d))
    s, d = sup("GET", f"/admin/api/player/{pid}")
    check("the balance is back to where it was", d["progression"]["credits"] == 1_000_000)
    check("the restore is itself undoable",
          any("before restoring" in (x["reason"] or "") for x in d["snapshots"]))

    print("\nRESETS")
    s, d = sup("POST", f"/admin/api/player/{pid}/reset", {"kind": "password"})
    check("a password reset returns a one-time code, never a password",
          s == 200 and len(d.get("code", "")) == 6 and "password" not in str(d.get("code")))
    s, d = sup("POST", f"/admin/api/player/{pid}/reset", {"kind": "energy"})
    check("energy refills", s == 200)
    s, d = sup("GET", f"/admin/api/player/{pid}")
    check("energy is at the maximum", d["progression"]["energy"] == 50)
    s, d = sup("POST", f"/admin/api/player/{pid}/reset", {"kind": "wipe"})
    check("an unknown reset is refused", s == 400)

    print("\nROLES")
    sup("POST", "/admin/api/admins", {"name": "Sam", "email": "sam@test.local",
                                      "role": "CUSTOMER_SUPPORT", "password": "SamPass2026x"})
    sup("POST", "/admin/api/admins", {"name": "Ana", "email": "ana@test.local",
                                      "role": "ANALYST", "password": "AnaPass2026x"})
    cs.login("sam@test.local", "SamPass2026x", "SamReal2026x")
    ana.login("ana@test.local", "AnaPass2026x", "AnaReal2026x")

    s, _ = cs("GET", f"/admin/api/player/{pid}")
    check("support may view a player", s == 200)
    s, _ = cs("POST", f"/admin/api/player/{pid}/resource",
              {"resource": "credits", "mode": "add", "amount": 100, "reason": "goodwill"})
    check("support may add credits", s == 200)
    for name, path, body in [
        ("set an absolute value", "resource",
         {"resource": "credits", "mode": "set", "amount": 0, "reason": "x",
          "confirm": "SET RESOURCE"}),
        ("ban permanently", "ban",
         {"kind": "permanent", "reason": "x", "confirm": "PERMANENT BAN"}),
        ("deactivate an account", "deactivate", {"reason": "x"}),
    ]:
        s, _ = cs("POST", f"/admin/api/player/{pid}/{path}", body)
        check(f"support may NOT {name}", s == 403, f"got {s}")
    s, _ = cs("GET", "/admin/api/admins")
    check("support may NOT manage administrators", s == 403)
    s, _ = cs("GET", "/admin/api/audit")
    check("support may NOT read the audit log", s == 403)

    s, _ = ana("GET", "/admin/api/dashboard")
    check("an analyst may read the dashboard", s == 200)
    s, _ = ana("POST", f"/admin/api/player/{pid}/resource",
               {"resource": "credits", "mode": "add", "amount": 1, "reason": "x"})
    check("an analyst may NOT change anything", s == 403)

    sup("POST", "/admin/api/admins/2",
        {"grants": ["players.ban.perm", "admins.manage"], "reason": "test"})
    s, d = cs("GET", "/admin/api/me")
    check("a grant cannot lift a role above its ceiling",
          "players.ban.perm" not in d["me"]["perms"]
          and "admins.manage" not in d["me"]["perms"])

    print("\nBANS REACH THE GAME")
    s, _ = sup("POST", f"/admin/api/player/{pid}/ban",
               {"kind": "temporary", "hours": 24, "reason": "Exploiting"})
    check("a temporary ban is issued", s == 200)
    s, d = Client()("POST", "/api/login", {"name": "Subject", "password": "playerpw123"})
    check("the banned player cannot sign in", s == 403, f"got {s}")
    # Issuing the ban already deleted their sessions, so that alone proves
    # little. The property worth proving is that a session which survives
    # alongside a ban — a race, or one opened a moment before — still cannot
    # write. Put one back by hand and try to save through it.
    server.q(f"insert into {server.S_TABLE} (token, player_id, created_at) "
             f"values (%s, %s, %s)", ("ghost-token", pid, server._now_iso()))
    s, d = game("PUT", "/api/state", {"state": {"level": 99}, "rev": 99},
                bearer="ghost-token")
    check("a session that outlives the ban still cannot save",
          s == 403 and "Exploiting" in json.dumps(d), f"got {s} {d}")
    left = server.q(f"select count(*) from {server.S_TABLE} where player_id = %s",
                    (pid,), "one")[0]
    check("and that session is cleared out on the way", left == 0, f"{left} left")
    s, _ = sup("POST", f"/admin/api/player/{pid}/unban", {"reason": "Appeal upheld"})
    check("the ban is lifted", s == 200)
    s, _ = Client()("POST", "/api/login", {"name": "Subject", "password": "playerpw123"})
    check("the player can sign in again", s == 200)

    print("\nSOFT DELETE")
    s, _ = sup("POST", f"/admin/api/player/{pid}/deactivate", {"reason": "Requested"})
    check("an account can be deactivated", s == 200)
    s, _ = Client()("POST", "/api/login", {"name": "Subject", "password": "playerpw123"})
    check("a deactivated account cannot sign in", s == 403)
    s, d = sup("GET", f"/admin/api/player/{pid}")
    check("the save survives deactivation untouched",
          d["progression"]["credits"] is not None and d["has_state"])
    s, _ = sup("POST", f"/admin/api/player/{pid}/reactivate", {"reason": "Changed mind"})
    s, _ = Client()("POST", "/api/login", {"name": "Subject", "password": "playerpw123"})
    check("reactivation restores access", s == 200)

    print("\nAUDIT")
    s, d = sup("GET", "/admin/api/audit")
    actions = [e["action"] for e in d["entries"]]
    check("entries are recorded", s == 200 and len(d["entries"]) > 15, f"{len(d['entries'])}")
    for want in ["Add IT Credits", "Set IT Credits", "Temporary ban issued", "Ban lifted",
                 "Restored progress from snapshot", "Created administrator",
                 "Deactivated account", "Failed sign-in"]:
        check(f"logged: {want}", any(want in a for a in actions))
    entry = next(e for e in d["entries"] if "Add IT Credits" in e["action"])
    check("an entry carries admin, before, after and reason",
          entry["admin"] and entry["old"] and entry["new"] and entry["reason"])
    check("no route exists to edit or delete an audit entry",
          not any(k in dir(admin) for k in ("audit_update", "audit_delete", "_audit_edit")))
    sql = Path("admin.py").read_text()
    check("the module contains no update or delete against the audit table",
          f"update {admin.AU_TABLE}" not in sql and f"delete from {admin.AU_TABLE}" not in sql)

    print("\nSESSIONS")
    s, _ = sup("DELETE", "/admin/api/session")
    check("signing out is accepted", s == 200)
    s, _ = sup("GET", "/admin/api/dashboard")
    check("the cookie is dead after signing out", s == 401, f"got {s}")

    expired = Client()
    expired.login("owner@test.local", "GoodPass2026x")
    tok = expired.cookie.split("=", 1)[1]
    admin.q(f"update {admin.AS_TABLE} set expires_at = %s where token = %s",
            ("2000-01-01T00:00:00+00:00", tok))
    s, _ = expired("GET", "/admin/api/dashboard")
    check("an expired session is refused", s == 401, f"got {s}")

    idle = Client()
    idle.login("owner@test.local", "GoodPass2026x")
    tok = idle.cookie.split("=", 1)[1]
    admin.q(f"update {admin.AS_TABLE} set seen_at = %s where token = %s",
            ("2000-01-01T00:00:00+00:00", tok))
    s, _ = idle("GET", "/admin/api/dashboard")
    check("a session idle past the limit is refused", s == 401, f"got {s}")

    disabled = Client()
    disabled.login("sam@test.local", "SamReal2026x")
    sup.login("owner@test.local", "GoodPass2026x")
    sup("POST", "/admin/api/admins/2", {"active": False, "reason": "test"})
    s, _ = disabled("GET", "/admin/api/dashboard")
    check("disabling an admin ends their live session immediately", s == 401, f"got {s}")

    print("\nDASHBOARD")
    s, d = sup("GET", "/admin/api/dashboard")
    check("the dashboard answers", s == 200)
    check("it names what it cannot measure rather than guessing",
          len(d.get("not_captured", [])) >= 4)
    check("player counts are real", d["players"]["total"] >= 1)

    print()
    if fails:
        print(f"{len(fails)} FAILURES")
        for f in fails:
            print("  -", f)
        sys.exit(1)
    print("all admin paths clean")


if __name__ == "__main__":
    main()
