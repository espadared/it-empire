"""The owner's dashboard — private to whoever holds the key.

Reachable only at /owner?key=… and only when OWNER_KEY is set. Any wrong key
gets a bare 404, so the page does not announce that it exists.

It answers the questions you actually have about a game you have shared with
friends: who is playing, how long they stay, who came back, and who quietly
stopped. Time played is measured from the gap between autosaves, so it counts
attention rather than tabs left open.
"""

import html
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

SG = ZoneInfo("Asia/Singapore")


# --- helpers ---------------------------------------------------------------

def _ts(value):
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromisoformat(str(value))
    except Exception:
        return None


def _dur(seconds):
    seconds = int(seconds or 0)
    if seconds < 60:
        return f"{seconds}s"
    if seconds < 3600:
        return f"{seconds // 60}m"
    h, m = divmod(seconds // 60, 60)
    return f"{h}h {m:02d}m" if m else f"{h}h"


def _ago(when):
    if not when:
        return "never"
    delta = (datetime.now(timezone.utc) - when).total_seconds()
    if delta < 120:
        return "just now"
    if delta < 3600:
        return f"{int(delta // 60)} min ago"
    if delta < 86400:
        return f"{int(delta // 3600)}h ago"
    days = int(delta // 86400)
    return "yesterday" if days == 1 else f"{days} days ago"


def _num(n):
    return f"{int(n or 0):,}"


PATHS = {"fixer": "The Fixer", "diplomat": "The Diplomat",
         "scripter": "The Scripter", "analyst": "The Analyst"}


def _life(state):
    """Pull the lifetime counters out of a save, whatever shape it arrived in."""
    if isinstance(state, str):
        try:
            state = __import__("json").loads(state)
        except Exception:
            return {}
    if not isinstance(state, dict):
        return {}
    return state.get("lifetime") or {}


def _avatar(name, art):
    """A cheap stand-in for the player's illustrated portrait: their own
    chosen shirt colour, with their initial on it."""
    shirt = "#3D6FE0"
    if isinstance(art, dict) and art.get("shirt"):
        shirt = str(art["shirt"])[:7]
    letter = html.escape((name or "?")[0].upper())
    return (f'<span class="ava" style="background:{html.escape(shirt)}">{letter}</span>')


# --- page ------------------------------------------------------------------

def page(q, p_table, a_table):
    players = q(f"""select id, display, level, reputation, tickets, spec, art,
                           created_at, updated_at, state
                    from {p_table} order by updated_at desc limit 200""", (), "all") or []
    activity = q(f"select player_id, day, seconds, saves, sessions from {a_table}",
                 (), "all") or []

    by_player = defaultdict(lambda: {"seconds": 0, "days": set(), "sessions": 0})
    by_day = defaultdict(lambda: {"seconds": 0, "players": set()})
    for pid, day, seconds, saves, sessions in activity:
        d = str(day)[:10]
        by_player[pid]["seconds"] += seconds or 0
        by_player[pid]["sessions"] += sessions or 0
        if (seconds or 0) > 0:
            by_player[pid]["days"].add(d)
        by_day[d]["seconds"] += seconds or 0
        if (seconds or 0) > 0:
            by_day[d]["players"].add(pid)

    today = datetime.now(SG).date()
    days14 = [(today - timedelta(days=i)).isoformat() for i in range(13, -1, -1)]
    week = set(days14[-7:])

    total_seconds = sum(v["seconds"] for v in by_player.values())
    total_tickets = sum((p[4] or 0) for p in players)
    active_today = len(by_day.get(today.isoformat(), {}).get("players", set()))
    active_week = len({pid for d in week for pid in by_day.get(d, {}).get("players", set())})
    returners = sum(1 for v in by_player.values() if len(v["days"]) > 1)
    stuck = sum(1 for v in by_player.values() if v["seconds"] < 300)

    # --- rows
    rows = []
    total_breaches = 0
    for pid, name, level, rep, tickets, spec, art, created, updated, state in players:
        a = by_player.get(pid, {"seconds": 0, "days": set(), "sessions": 0})
        last = _ts(updated)
        first = _ts(created)
        life = _life(state)
        breaches = int(life.get("breaches") or 0)
        total_breaches += breaches
        # how often they are losing tickets to the clock: the difficulty signal
        rate = (breaches / (breaches + (tickets or 0)) * 100) if (breaches or tickets) else 0
        fresh = last and (datetime.now(timezone.utc) - last).total_seconds() < 900
        rows.append(f"""<tr>
          <td class="who">{_avatar(name, art)}
            <div><b>{html.escape(str(name))}</b>
              <span class="sub">{html.escape(PATHS.get(spec, '—'))}</span></div>
            {'<span class="live">LIVE</span>' if fresh else ''}</td>
          <td class="n">{_num(level)}</td>
          <td class="n">{_num(rep)}</td>
          <td class="n">{_num(tickets)}</td>
          <td class="n hi">{_dur(a['seconds'])}</td>
          <td class="n">{len(a['days'])}</td>
          <td class="n">{a['sessions']}</td>
          <td class="n {'warn' if rate > 25 else ''}">{_num(breaches)}{f' <span class="sub">{rate:.0f}%</span>' if breaches else ''}</td>
          <td class="sub">{_ago(first)}</td>
          <td class="sub">{_ago(last)}</td>
        </tr>""")

    # --- 14 day chart
    peak = max([by_day.get(d, {}).get("seconds", 0) for d in days14] + [1])
    bars = []
    for d in days14:
        secs = by_day.get(d, {}).get("seconds", 0)
        ppl = len(by_day.get(d, {}).get("players", set()))
        h = max(2, round(secs / peak * 100))
        label = datetime.fromisoformat(d).strftime("%-d %b")
        bars.append(f"""<div class="bar-col" title="{label}: {_dur(secs)} across {ppl} player(s)">
            <div class="bar-val">{_dur(secs) if secs else ''}</div>
            <div class="bar" style="height:{h}%"></div>
            <div class="bar-lbl">{datetime.fromisoformat(d).strftime('%-d')}</div>
          </div>""")

    # --- plain English summary
    if not players:
        headline = "Nobody has signed up yet. Send the link to someone."
    elif active_today:
        headline = (f"{active_today} of your {len(players)} players "
                    f"{'has' if active_today == 1 else 'have'} played today.")
    elif active_week:
        headline = f"Nobody today, but {active_week} played in the last week."
    else:
        headline = "Nobody has played in the last week."

    feed = []
    for pid, name, level, rep, tickets, spec, art, created, updated, state in players[:8]:
        a = by_player.get(pid, {"seconds": 0, "days": set(), "sessions": 0})
        if a["seconds"] < 60:
            feed.append(f"<li><b>{html.escape(str(name))}</b> signed up "
                        f"{_ago(_ts(created))} but has barely played — under a minute so far.</li>")
        else:
            feed.append(
                f"<li><b>{html.escape(str(name))}</b> has played {_dur(a['seconds'])} "
                f"across {a['sessions']} visit{'s' if a['sessions'] != 1 else ''} on "
                f"{len(a['days'])} day{'s' if len(a['days']) != 1 else ''}, reached level "
                f"{_num(level)} and resolved {_num(tickets)} tickets. Last seen {_ago(_ts(updated))}.</li>")

    return f"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>IT Empire · Owner</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Nunito:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
:root{{--ink:#0E1220;--ink2:#0A0E1A;--panel:#1A2136;--panel2:#232C46;--line:#333D5E;
--lamp:#FFB347;--crt:#4FD6C9;--alarm:#FF5A5F;--rep:#C08BFF;--good:#5FD37A;
--text:#E8ECF7;--muted:#8A93AD;--disp:'Baloo 2',system-ui,sans-serif;
--body:'Nunito',system-ui,sans-serif;--mono:'IBM Plex Mono',ui-monospace,monospace}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--ink2);color:var(--text);font-family:var(--body);font-size:15px;line-height:1.5}}
.wrap{{max-width:1080px;margin:0 auto;padding:26px 18px 60px}}
header{{display:flex;align-items:center;gap:13px;margin-bottom:6px}}
.mark{{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;font-size:22px;
  background:linear-gradient(160deg,var(--lamp),#E07C2B);box-shadow:0 3px 0 #8A4E17}}
h1{{font-family:var(--disp);font-size:22px;margin:0;letter-spacing:.02em}}
header .sub{{font-size:12px;color:var(--muted)}}
.headline{{font-family:var(--disp);font-size:17px;color:var(--lamp);margin:14px 0 20px}}
h2{{font-family:var(--disp);font-size:14px;letter-spacing:.06em;color:var(--muted);
  margin:30px 0 10px;text-transform:uppercase}}
.tiles{{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:11px}}
.tile{{background:linear-gradient(180deg,var(--panel2),var(--panel));border:1px solid var(--line);
  border-radius:16px;padding:13px 15px}}
.tile b{{display:block;font-family:var(--mono);font-size:25px;font-variant-numeric:tabular-nums;line-height:1.1}}
.tile span{{font-size:11px;color:var(--muted);letter-spacing:.05em;text-transform:uppercase}}
.tile.lamp b{{color:var(--lamp)}} .tile.crt b{{color:var(--crt)}} .tile.rep b{{color:var(--rep)}} .tile.warn b{{color:var(--alarm)}}
td.n.warn{{color:var(--alarm)}}
.card{{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:16px}}
.chart{{display:flex;align-items:flex-end;gap:5px;height:170px}}
.bar-col{{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:5px}}
.bar{{width:100%;max-width:44px;border-radius:6px 6px 2px 2px;
  background:linear-gradient(180deg,var(--lamp),#B4661E);min-height:2px}}
.bar-val{{font-family:var(--mono);font-size:9px;color:var(--muted);height:12px}}
.bar-lbl{{font-family:var(--mono);font-size:10px;color:var(--muted)}}
.scroll{{overflow-x:auto}}
table{{width:100%;border-collapse:collapse;min-width:760px}}
th{{text-align:left;font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--muted);
  text-transform:uppercase;padding:0 10px 9px;font-weight:500;white-space:nowrap}}
th.n,td.n{{text-align:right}}
td{{padding:11px 10px;border-top:1px solid var(--line);vertical-align:middle;white-space:nowrap}}
td.n{{font-family:var(--mono);font-variant-numeric:tabular-nums;font-size:13px}}
td.n.hi{{color:var(--lamp)}}
td.sub,.sub{{color:var(--muted);font-size:12px}}
td.who{{display:flex;align-items:center;gap:9px}}
td.who b{{font-family:var(--disp);font-size:15px;display:block;line-height:1.15}}
td.who .sub{{display:block}}
.ava{{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;flex:0 0 auto;
  font-family:var(--disp);font-weight:800;color:#0E1220;font-size:15px}}
.live{{font-family:var(--mono);font-size:9px;color:var(--good);border:1px solid #2F6B41;
  background:rgba(95,211,122,.1);border-radius:6px;padding:2px 6px}}
ul.feed{{list-style:none;padding:0;margin:0}}
ul.feed li{{padding:10px 0;border-top:1px solid var(--line);font-size:13.5px;color:var(--muted)}}
ul.feed li:first-child{{border-top:0}}
ul.feed b{{color:var(--text)}}
.empty{{text-align:center;color:var(--muted);padding:30px}}
footer{{margin-top:34px;font-size:11.5px;color:var(--muted);text-align:center;line-height:1.6}}
</style></head><body><div class="wrap">

<header>
  <div class="mark">🔧</div>
  <div><h1>IT Empire · Owner</h1>
    <div class="sub">{datetime.now(SG).strftime('%A %-d %B %Y, %H:%M')} Singapore · private page</div></div>
</header>

<p class="headline">{html.escape(headline)}</p>

<div class="tiles">
  <div class="tile"><b>{_num(len(players))}</b><span>Players</span></div>
  <div class="tile good"><b>{_num(active_today)}</b><span>Played today</span></div>
  <div class="tile"><b>{_num(active_week)}</b><span>Played this week</span></div>
  <div class="tile lamp"><b>{_dur(total_seconds)}</b><span>Total time played</span></div>
  <div class="tile crt"><b>{_num(total_tickets)}</b><span>Tickets resolved</span></div>
  <div class="tile rep"><b>{_num(returners)}</b><span>Came back another day</span></div>
  <div class="tile warn"><b>{_num(total_breaches)}</b><span>Tickets lost to the clock</span></div>
</div>

<h2>Time played · last 14 days</h2>
<div class="card"><div class="chart">{''.join(bars)}</div></div>

<h2>Players</h2>
<div class="card scroll">
{'<table><thead><tr><th>Player</th><th class="n">Level</th><th class="n">Reputation</th>'
 '<th class="n">Tickets</th><th class="n">Time played</th><th class="n">Days</th>'
 '<th class="n">Visits</th><th class="n">Breached</th><th>Joined</th><th>Last seen</th></tr></thead><tbody>'
 + ''.join(rows) + '</tbody></table>' if rows else '<div class="empty">No players yet.</div>'}
</div>

<h2>What is actually happening</h2>
<div class="card">
{'<ul class="feed">' + ''.join(feed) + '</ul>' if feed else '<div class="empty">Nothing to report yet.</div>'}
{f'<p class="sub" style="margin:14px 0 0">{stuck} player{"" if stuck == 1 else "s"} '
 f'{"has" if stuck == 1 else "have"} played under five minutes — they signed up and did not get going.</p>'
 if stuck else ''}
</div>

<footer>
  Time played counts the gaps between autosaves, so it measures attention rather than open tabs.<br>
  Only what players typed or earned is shown here — no device details, no locations, no addresses.
</footer>
</div></body></html>"""
