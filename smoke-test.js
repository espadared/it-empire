/* Runtime smoke test: node smoke-test.js
   Exercises every game path, because `node --check` only catches syntax and a
   helper lost in a refactor will only show up on a rare code path. */
const fs = require('fs');
global.window = {}; global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const dir = require('path').join(__dirname, 'js') + '/';
const DATA = eval(fs.readFileSync(dir + 'data.js', 'utf8') + '; DATA'); global.DATA = DATA;
const Game = eval(fs.readFileSync(dir + 'game.js', 'utf8') + '; Game');

let fails = 0;
const check = (name, fn) => { try { fn(); console.log('  ok   ' + name); } catch (e) { fails++; console.log('  FAIL ' + name + ' -> ' + e.message); } };

Game.newGame(null, { name: 'SMOKE', spec: 'fixer', art: DATA.CHARACTERS[0].art });
const S = Game.state; S.level = 20; S.credits = 5e6; S.reputation = 30000;

const topUp = () => { S.quotaLeft = 999; S.quotaEnds = 0; };   // the allowance has its own test
check('resolve 400 tickets (drops included)', () => {
  for (let i = 0; i < 400; i++) { topUp(); Game.resolveTicket(S.queue[0].uid); }
  if (S.inventory.length < 3) throw new Error('no gear ever dropped');
});
check('gear actually dropped', () => { if (S.inventory.length <= 3) throw new Error('inventory never grew: ' + S.inventory.length); });
check('diagnosis path', () => {
  let done = 0;
  for (let i = 0; i < 300 && done < 5; i++) {
    const p = S.queue.find(t => Game.needsDiagnosis(t));
    topUp();
    if (p) { Game.resolveTicket(p.uid, { diag: 1 }); done++; }
    else Game.resolveTicket(S.queue[0].uid);
  }
  if (!done) throw new Error('never saw a puzzle in 300 tickets');
});
check('hire + delegate', () => {
  topUp();
  const c = Game.hire('veteran'); if (!c) throw new Error('hire failed');
  const r = Game.delegate(S.queue[0].uid, c.uid); if (!r) throw new Error('delegate failed');
});
check('escalate', () => { if (!Game.escalateTicket(S.queue[0].uid)) throw new Error('escalate failed'); });
check('breach', () => { S.queue[0].left = 0.01; if (!Game.tickQueue(1).length) throw new Error('no breach'); });
check('idle collect with gear', () => {
  S.idleAcc = { t: 500, c: 9000, x: 4000, r: 60, gear: 3, inc: 2 };
  const r = Game.collectIdle();
  if (!r.gear.length) throw new Error('no gear from collection');
});
check('incident full cycle', () => {
  const inc = Game.startIncident();
  for (let i = 0; i < inc.steps.length; i++) Game.incidentAnswer(0);
  if (!Game.incidentFinish(false)) throw new Error('incident finish failed');
});
check('incident win with drop', () => {
  for (let i = 0; i < 30; i++) {
    Game.startIncident(); Game.state.incident.chance = 1;
    const r = Game.incidentFinish(false);
    if (r.win && r.drop) return;
  }
  throw new Error('never got a win-with-drop in 30 tries');
});
check('buildings', () => { if (!Game.build('knowledge')) throw new Error('build failed'); });
check('character level up', () => { const c = S.roster[1]; c.xp = 1e9; if (!Game.levelUpChar(c.uid)) throw new Error('levelup failed'); });
check('standard issue: issue + upgrade + dispose', () => {
  const it = S.inventory[0];
  if (!Game.issueStandard(it.uid)) throw new Error('could not issue');
  if (!Game.isStandard(it.uid)) throw new Error('not marked as standard');
  Game.upgradeItem(it.uid);
  Game.disposeItem(it.uid);
  if (Game.isStandard(it.uid)) throw new Error('scrapped item still standard');
});
check('standard issue lifts every member of staff', () => {
  const other = S.roster[1] || S.roster[0];
  const before = Game.charPower(other);
  S.inventory.push(Game.mkItem('mon_ultra', 4));
  Game.issueStandard(S.inventory[S.inventory.length - 1].uid);
  if (Game.charPower(other) <= before) throw new Error('staff did not benefit from standard issue');
});
check('one item per slot, never stacking', () => {
  S.inventory.push(Game.mkItem('mon_old', 1));
  Game.issueStandard(S.inventory[S.inventory.length - 1].uid);
  if (Game.standardItems().filter(i => Game.eqDef(i.eid).slot === 'monitor').length !== 1)
    throw new Error('two items in one slot');
});
check('missions claim', () => { Game.rollMissions(); S.missions.forEach(m => { m.done = true; Game.claimMission(m.id); }); });
check('save + reload round trip', () => {
  const blob = JSON.parse(JSON.stringify(Game.serialize()));
  const r = Game.loadFrom(blob, Date.now());
  if (r.needsCharacter) throw new Error('round trip lost the save');
  Game.fillQueue();
  Game.state.quotaLeft = 999;
  if (!Game.resolveTicket(Game.state.queue[0].uid)) throw new Error('cannot work after reload');
});
check('procure and dispose', () => {
  const G = Game.state;            // re-read: an earlier reload swapped the state object
  G.credits = 5e6; G.reputation = 5e5;
  const target = DATA.EQUIPMENT.find(e => !Game.ownsItem(e.id));
  if (!target) throw new Error('nothing left unowned to test with');
  const n0 = G.inventory.length;
  const it = Game.procure(target.id);
  if (!it) throw new Error('procurement refused with plenty of credits');
  if (G.inventory.length !== n0 + 1) throw new Error('nothing arrived in the cupboard');
  if (Game.procure(target.id)) throw new Error('bought a duplicate — should be one of each');
  const back = Game.disposeValue(it);
  const c0 = G.credits;
  Game.disposeItem(it.uid);
  if (G.credits - c0 !== back) throw new Error('disposal paid the wrong amount');
  if (!Game.canProcure(target.id)) throw new Error('cannot re-buy after disposing');
});
check('chapters, capacity and retirement', () => {
  const G = Game.state;
  if (Game.capacity() < 5) throw new Error('no capacity');
  while (Game.hire('intern')) {}
  if (G.roster.length > Game.capacity()) throw new Error('hired past capacity');
  if (G.roster.length > 1 && !Game.retireStaff(G.roster[G.roster.length - 1].uid)) throw new Error('retire failed');
});
check('missions include a hard tier', () => {
  Game.rollMissions();
  if (!Game.state.missions.some(m => m.tier === 'hard')) throw new Error('no hard mission rolled');
});
check('the level buttons never promise what they will not spend', () => {
  const G = Game.state;
  const c = G.roster.find(x => x.defId !== 'hero') || G.roster[0];
  for (let l = 1; l < Game.maxStaffLevel(); l++) {
    c.level = l; c.xp = 1e9; G.credits = 1e12;
    const promised = Game.levelsReady(c);
    const delivered = (Game.levelUpMax(c.uid) || { gained: 0 }).gained;
    if (promised !== delivered)
      throw new Error(`L${l}: button offers ${promised} levels but spends ${delivered}`);
    if (Game.isPromotion(l) && promised !== 0)
      throw new Error(`L${l} is a rank wall but the bulk button still offered ${promised}`);
  }
});
check('reorganisation', () => { Game.state.level = 40; if (!Game.reorg()) throw new Error('reorg gave nothing'); });

check('the posting advice never makes a player worse off', () => {
  const assert = (c, m) => { if (!c) throw new Error(m); };
  const keep = { rep: S.reputation, chapter: S.chapter, roster: S.roster.slice() };
  S.credits = 1e12; S.reputation = 1e6; S.chapter = 5;
  try {
  ['veteran', 'people-person', 'security-hawk', 'automation-expert', 'oracle']
    .filter(id => DATA.CHARACTERS.some(x => x.id === id))
    .forEach(id => {
      const c = Game.hire(id); if (!c) return;
      [12, 30, 55].forEach(lv => {
        c.level = lv;
        const opts = Game.postingOptions(c);
        const best = Game.bestDept(c);
        assert(best && best.dept.id === opts[0].dept.id,
          id + ' L' + lv + ': the arrow points somewhere other than the best posting');
        // whatever it recommends must beat every alternative on the same measure
        opts.forEach(o => assert(best.value >= o.value - 1,
          id + ' L' + lv + ': ' + o.dept.name + ' is worth more than the recommendation'));
        // and anyone flagged as misplaced must really gain by moving
        DATA.DEPARTMENTS.forEach(d => {
          if (S.reputation < d.repReq) return;
          c.dept = d.id;
          if (Game.misplaced().some(x => x.uid === c.uid))
            assert(Game.postingValue(c, best.dept.id) > Game.postingValue(c, d.id),
              id + ' L' + lv + ': flagged as misplaced in ' + d.name + ' but moving gains nothing');
        });
        c.dept = null;
      });
    });
  } finally { S.reputation = keep.rep; S.chapter = keep.chapter; S.roster = keep.roster; }
});

console.log(fails ? "\n" + fails + " FAILURES" : "\nall paths clean");
process.exit(fails ? 1 : 0);
