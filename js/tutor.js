/* ============================================================
   IT EMPIRE — GUIDE
   What every screen is for, in words that assume no IT knowledge.

   Two rules for the copy here. Say what the player DOES, not what
   the system IS. And never use a game word — reputation, morale,
   idle, power — without saying in the same breath what it buys.

   Each screen explains itself the first time it is opened. After
   that it is on the ? button, because a tutorial you cannot get
   back is a tutorial you have to remember.
   ============================================================ */
const Tutor = (() => {

  const GUIDES = {
    hq: {
      icon: '🏢',
      title: 'HQ — your desk',
      lead: 'This is where you work. Everything else in the game is paid for from here.',
      points: [
        ['Tickets are people asking for help',
         'Each card is one colleague with a broken thing. Tap FIX IT and you deal with it.'],
        ['You get three things for fixing one',
         '💰 credits to spend, ⭐ experience to level up, and 🏆 reputation, which is how much the company trusts you. Reputation is what unlocks new parts of the game.'],
        ['The clock is a promise, not a threat',
         'Each ticket has five minutes. Miss it and you lose a little reputation. Nothing expires while you are away from the game.'],
        ['🎫 is your allowance',
         'Thirty tickets an hour. When it runs out, your staff keep earning without you — come back later and collect.'],
      ],
      tip: 'Stuck on one? DELEGATE hands it to a colleague, or ✕ gives up for a small reputation cost.',
    },

    staff: {
      icon: '👥',
      title: 'Staff — people who work while you sleep',
      lead: 'You cannot fix every ticket yourself. This is how the game keeps earning when your phone is in your pocket.',
      points: [
        ['Hire people with credits',
         'Each one earns money on their own, around the clock, whether the game is open or not.'],
        ['Post them to a department',
         'A posting is a job. The card shows what that person produces there per hour. Tap it to see every option with real numbers.'],
        ['Cover all four departments',
         'Having somebody in every department is a bonus for the whole team — usually worth more than crowding your best people into one place.'],
        ['Chapters are the main goal',
         'The GOALS tab lists what to finish. Completing a chapter gives you more desks and lets your people reach higher levels.'],
      ],
      tip: 'If you are not sure, use the suggestion on the NEXT MOVE card. It is calculated, not decorative.',
    },

    gear: {
      icon: '🎒',
      title: 'Gear — equipment for the whole team',
      lead: 'Better laptops and headsets make everyone faster. Gear is shared, not personal.',
      points: [
        ['Standard issue goes to everybody',
         'One item per slot, and every member of staff gets the benefit. You are equipping the department, not one person.'],
        ['Level gear up with credits',
         'Usually a better use of money than buying more of it.'],
        ['Procure buys one of each',
         'You cannot buy the same item twice. If you dispose of something you can buy it again.'],
        ['Dispose gives money back',
         'Select several at once. Nothing is wasted.'],
      ],
      tip: 'Rarer gear is stronger but costs more to level. Early on, a levelled common item beats an unlevelled rare one.',
    },

    missions: {
      icon: '📋',
      title: 'Missions — jobs with a bigger payout',
      lead: 'Short goals that pay much more than an ordinary ticket.',
      points: [
        ['They refresh regularly',
         'Come back and there will be new ones.'],
        ['Some are hard on purpose',
         'Those pay the most. Send your strongest team.'],
        ['Claim the reward yourself',
         'Finished missions wait for you to collect. Nothing expires.'],
      ],
      tip: 'Missions are the fastest way to afford your first few colleagues.',
    },

    rank: {
      icon: '🏆',
      title: 'Ranking — how you compare',
      lead: 'Everyone playing, in order of reputation.',
      points: [
        ['Reputation is the score',
         'It goes up when you fix things well and down when you let a ticket lapse.'],
        ['It updates as people play',
         'Your friends appear here as they sign in.'],
      ],
      tip: 'Nothing here costs anything. It is a scoreboard, not a mode.',
    },

    battle: {
      icon: '⚔️',
      title: 'Battle — a wager on your own speed',
      lead: 'Pay credits to enter a room, play a short IT puzzle, and the best time when the room closes takes the whole pot.',
      points: [
        ['You are not playing live',
         'You play whenever suits you. Others do the same, and the room settles later. Nobody is waiting on you.'],
        ['Four games',
         'An IT quiz, a memory game, a word scramble and a fault-finding puzzle. The quiz is real CompTIA and ITIL material.'],
        ['A room with one entrant refunds',
         'You are never charged for playing yourself.'],
        ['Winnings are claimed, not pushed',
         'Come back after the room closes and collect.'],
      ],
      tip: 'The quiz adds five seconds for a wrong answer, so reading the question beats guessing fast.',
    },
  };

  /* Which screens have been seen. Kept on the save so a player who moves to
     another device is not taught the game a second time. */
  const seenSet = () => {
    const S = typeof Game !== 'undefined' && Game.state;
    if (!S) return null;
    if (!S.taught || typeof S.taught !== 'object') S.taught = {};
    return S.taught;
  };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function html(g, first) {
    return `<span class="big-emoji">${g.icon}</span>
      <h3>${esc(g.title)}</h3>
      <p class="sub">${esc(g.lead)}</p>
      <div class="guide">
        ${g.points.map(([h, b]) => `<div class="guide-row">
          <b>${esc(h)}</b><span>${esc(b)}</span></div>`).join('')}
      </div>
      ${g.tip ? `<p class="guide-tip">💡 ${esc(g.tip)}</p>` : ''}
      <button class="btn gold cta" data-close="1">${first ? 'GOT IT' : 'CLOSE'}</button>
      ${first ? '<p class="tiny muted" style="text-align:center;margin:8px 0 0">'
        + 'You can read this again any time from the ? at the top.</p>' : ''}`;
  }

  /* Called every time a screen opens. Teaches it once, silently after that. */
  function visit(name, sheet) {
    const g = GUIDES[name]; if (!g) return false;
    const seen = seenSet(); if (!seen) return false;
    if (seen[name]) return false;
    seen[name] = 1;
    if (typeof Game !== 'undefined' && Game.save) Game.save();
    sheet(html(g, true));
    return true;
  }

  /* The ? button: always available, never assumes you remember. */
  function explain(name, sheet) {
    const g = GUIDES[name] || GUIDES.hq;
    sheet(html(g, false));
  }

  const known = name => !!GUIDES[name];

  return { visit, explain, known, GUIDES };
})();
