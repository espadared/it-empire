# IT Empire

A mobile-first idle RPG / management game. You start as a junior helpdesk
technician with one desk and one screwdriver, and build a global IT organisation.

## Run it

```
python3 server.py          # then open http://localhost:8480
```

That is the full game with accounts: everyone signs in, builds their own
technician and their progress is saved server-side, so it follows them to any
device and they all appear on the company leaderboard. Saves go to Postgres
when `DATABASE_URL` is set (that is how the hosted copy survives restarts) and
to a local `it-empire.db` SQLite file otherwise, so there is nothing to set up
to run it on your laptop.

Opened as a plain file instead (`index.html`, or the one-file bundle in
`dist/`), the same build detects there is no backend and runs solo, saving to
that browser. Character creation happens either way.

## Layout

| File | What lives there |
|---|---|
| `js/data.js` | All content: tickets, characters, equipment, buildings, incidents, events, missions, achievements, ranks, world. **Add rows here to extend the game — no other file needs to change.** |
| `js/art.js`  | Hand-built SVG: the office diorama and the parametric character illustrator (`Art.person`, `Art.hero`, `Art.portrait`). |
| `js/game.js` | State, economy, ticket loop, idle engine, save/load. No DOM. Emits events via `Game.on()`. |
| `js/ui.js`   | Screen rendering, bottom sheets, floating numbers, coin bursts, sparks, shake. |
| `js/main.js` | Boot, delegated input handling, the tick loop, synthesised sound. |
| `js/net.js` | Accounts, cloud saves and the leaderboard. Detects whether there is a backend and picks solo or signed-in mode. |
| `js/onboard.js` | The sign-in gate and the character creator. |
| `server.py` | Accounts, cloud saves, leaderboard, time-played tracking. Stores the save blob and nothing else — every game rule lives in the browser. |
| `owner.py` | The private owner dashboard at `/owner?key=…`. |
| `css/style.css` | One committed visual world: the office at dusk. |

## Adding content

- **A new ticket**: add an object to `DATA.TICKETS.EASY/MEDIUM/HARD` with
  `{name, cat, stat, icon, user}`. It enters the pool immediately.
- **A new character**: add to `DATA.CHARACTERS` with `base`/`growth` stats, an
  `art` config (skin, hair, hairStyle, shirt, accent, glasses, headset, beard)
  and a `perks` map. Perk keys are the same keys `Game.bonus()` reads.
- **New equipment**: add to `DATA.EQUIPMENT` with a `slot` from `DATA.SLOTS`.
- **A new office facility**: add to `DATA.BUILDINGS` with a bonus `key` + `per`.
- **A new incident**: add to `DATA.INCIDENTS` — an array of steps, each with
  three options, exactly one marked `ok: 1`.

## Bonus keys

`Game.bonus(key)` aggregates buildings + staff perks + equipment perks + the
active random event + legacy upgrades into one multiplier. Keys in use:
`reward, credit, xp, rep, idle, idleCredit, energy, energyRegen, staffXp,
incident, incidentSuccess, sat, automation, power, autoDisplay, all,
cat_<category>`.

## Save

The game writes through `Game.setStore()`, so it does not care where the save
lives. Solo play uses `localStorage['it-empire-save-v1']`; signed in, `net.js`
swaps in a store that keeps the same blob on the server (and mirrors it to
localStorage as a fallback). Autosaved every 10s, on tab-hide, and on the way
out via `navigator.sendBeacon`.

Offline progress is capped at 8h + 1h per Automation Lab level and pays out at
75% of the live rate. Signed in, the *server's* clock decides how long you were
away, so changing the device clock does nothing.

## Accounts

Passwords are hashed with PBKDF2-SHA256 (200k rounds, per-user salt) and never
stored or logged in the clear. Sessions are random 32-byte tokens. Login is
throttled to 12 attempts per IP per 5 minutes. The server serves only
`index.html`, `css/` and `js/` — nothing else is reachable.

## Hosting

`render.yaml` describes the Render service. Push to `main` and Render deploys.
The one thing that must be set in the dashboard is `DATABASE_URL`.

## The core loop

Three tickets sit in the queue at once, each with its own SLA clock. You cannot
work them all, so every few seconds you are choosing who waits:

- **Fix it yourself** — spends one of your hourly allowance. Roughly one ticket
  in ten turns out to be **tricky** and opens a **diagnosis**: the symptom is shown with three candidate causes, and naming
  the right one is worth ~1.6× and a big momentum boost. Guessing costs you.
- **Delegate** — free of energy and worth 70%, but that colleague is then busy
  for 18–42 seconds, and their stats decide the odds. A hardware specialist is
  a poor choice for an MFA ticket, and the picker shows you that.
- **Escalate** — drop it for a small reputation cost. Sometimes the right call.

**Your allowance is thirty tickets an hour.** The hour starts when you work
your first one; when it is up you get all thirty back. Delegating spends it too
(it is still your department's hands-on time), escalating does not (you did not
work it). Crucially the **queue freezes while your allowance is spent** — you
cannot work the tickets, so it would be unfair to breach them. The automated
queue keeps earning the whole time, which is the reason to come back. Claimed
missions give a few tickets back, and each Break Room level adds two an hour.

Two meters run underneath:

- **Momentum** builds with every good call (more for a correct diagnosis) and
  bleeds away when you stop. It multiplies credits and XP up to ×2.5.
- **Morale** is what the office thinks of you. Breaches and botched fixes cost
  it; it scales *everything* you earn, idle income included, from ×0.55 to
  ×1.45. It drifts slowly back toward 60 so one bad session is not permanent.

The queue only ticks while the HQ screen is open and the tab is visible, so
nothing ever breaches behind your back. A ticket that goes critical scrolls
itself into view.

## Owner dashboard

`/owner?key=…`, gated on the `OWNER_KEY` env var. Any wrong key — or no key
configured — returns a bare 404, so the page never announces itself. It shows
who is playing, how long they actually played, how many days they came back,
and how many tickets they are losing to the clock. Time played is derived from
the gaps between autosaves (gaps over 90s are not counted), so it measures
attention rather than tabs left open. Locally the key is `localtest`.

## Departments

Where you post people decides what the automated queue produces. Each
department leans on one stat, and a posting is worth what the person brings to
it: `deptFit()` compares their department stat against their own average, so a
specialist in the right place is worth roughly double someone merely present.

| Department | Leans on | Gives |
|---|---|---|
| IT Support | Communication | +35% idle credits |
| Infrastructure | Technical | +30% tickets an hour |
| Cybersecurity | Investigation | +60% idle reputation |
| Automation | Automation | +50% tickets an hour |

Posting well roughly doubles idle output against leaving everyone unassigned,
and posting badly gives back most of that. The STAFF tab has two views — a
sortable roster (power / output / level / department / name) and a department
board showing who is posted where with their fit — and you can post from
either direction.

## Not built yet

The world map and the skill tree are present as UI and data but are not yet
wired to gameplay effects — they unlock by reputation and are the natural next
systems.
