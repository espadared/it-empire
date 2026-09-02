/* ============================================================
   IT EMPIRE — DATA LAYER
   Pure content. No logic. Add rows here to extend the game.
   ============================================================ */
const DATA = (() => {

  /* ---------- RARITY ---------- */
  const RARITY = {
    COMMON:    { key:'COMMON',    label:'COMMON',    mult:1.00, color:'#8A93AD', order:0 },
    UNCOMMON:  { key:'UNCOMMON',  label:'UNCOMMON',  mult:1.15, color:'#5FD37A', order:1 },
    RARE:      { key:'RARE',      label:'RARE',      mult:1.35, color:'#4FA8FF', order:2 },
    EPIC:      { key:'EPIC',      label:'EPIC',      mult:1.60, color:'#B67CFF', order:3 },
    LEGENDARY: { key:'LEGENDARY', label:'LEGENDARY', mult:2.00, color:'#FFB347', order:4 },
    MYTHIC:    { key:'MYTHIC',    label:'MYTHIC',    mult:2.60, color:'#FF5A9E', order:5 },
  };

  /* ---------- STATS ---------- */
  const STATS = ['TECHNICAL','SPEED','COMMUNICATION','INVESTIGATION','PATIENCE','AUTOMATION','MANAGEMENT'];
  const STAT_ICON = {
    TECHNICAL:'🔧', SPEED:'⚡', COMMUNICATION:'💬', INVESTIGATION:'🔍',
    PATIENCE:'🧘', AUTOMATION:'🤖', MANAGEMENT:'📊'
  };

  /* ---------- CAREER TITLES ---------- */
  const TITLES = [
    { level:1,  name:'Junior IT Technician' },
    { level:5,  name:'IT Support Technician' },
    { level:12, name:'Senior Technician' },
    { level:20, name:'Team Lead' },
    { level:30, name:'IT Manager' },
    { level:42, name:'Regional IT Manager' },
    { level:55, name:'Global IT Director' },
    { level:70, name:'Chief Technology Officer' },
  ];

  /* ---------- REPUTATION RANKS ---------- */
  const RANKS = [
    { at:0,      name:'Nobody Knows You',        blurb:'People still ask you where the printer is.' },
    { at:100,    name:'Reliable Technician',     blurb:'Your name is written on a sticky note somewhere.' },
    { at:500,    name:'IT Hero',                 blurb:'Managers say your name in meetings. Fondly.' },
    { at:2000,   name:'Office Legend',           blurb:'People queue at your desk with snacks.' },
    { at:10000,  name:'The One Who Fixes Everything', blurb:'You are the escalation path. All of it.' },
    { at:100000, name:'IT God',                  blurb:'Servers reboot themselves out of respect.' },
  ];

  /* ---------- TICKETS ----------
     cat: hardware | display | network | software | access | security | vip
     stat: the stat that decides technical success
     clue: what you can actually see — the diagnosis is played off this
     causes: three candidates, exactly one right. Reading the clue beats
             guessing, which is the whole point.                           */
  const TICKETS = {
    EASY: [
      { name:'Printer Offline', cat:'hardware', stat:'PATIENCE', icon:'🖨️', user:'Reception',
        clue:'Queue has 31 jobs. The printer is showing a green light.',
        causes:[{t:"The print spooler has hung",ok:1},{t:"It is out of paper",ok:0},{t:"It needs a new toner cartridge",ok:0}],
        why:'A green light means the printer is fine. The jobs are stacking on the computer\'s side, so the fault is the queue, not the machine. Clear the spooler and all 31 jobs release at once.' },
      { name:'Wi-Fi Not Connected', cat:'network', stat:'TECHNICAL', icon:'📶', user:'Sales',
        clue:'Connects on their phone. Not on the laptop.',
        causes:[{t:"The laptop is clinging to a stale saved profile",ok:1},{t:"The router is broken",ok:0},{t:"They are out of mobile data",ok:0}],
        why:'The phone connects, so the Wi-Fi itself works. Only the laptop is wrong, and the usual reason is a saved network profile holding an old password or setting. Forget the network and rejoin.' },
      { name:'No Audio In Headset', cat:'hardware', stat:'INVESTIGATION', icon:'🎧', user:'Support',
        clue:'Green light on the headset. Silence in the app.',
        causes:[{t:"The app is pointed at the wrong output device",ok:1},{t:"The headset has died",ok:0},{t:"The volume is muted at the wall",ok:0}],
        why:'The headset has power, so it is not dead. Sound is going somewhere else — apps keep their own output setting, separate from the system\'s. Point the app at the headset.' },
      { name:'Monitor Not Detected', cat:'display', stat:'TECHNICAL', icon:'🖥️', user:'Finance',
        clue:'Second screen black since they moved desks.',
        causes:[{t:"The cable went back into the wrong port in the move",ok:1},{t:"The monitor died in the move",ok:0},{t:"Windows needs reinstalling",ok:0}],
        why:'It worked before the desk move and nothing else changed. When a fault starts right after someone unplugged and replugged things, suspect the cable and the port before the hardware.' },
      { name:'Keyboard Not Working', cat:'hardware', stat:'PATIENCE', icon:'⌨️', user:'HR',
        clue:'Every key works except the ones they need.',
        causes:[{t:"There is something under the keycaps",ok:1},{t:"The driver is out of date",ok:0},{t:"It needs charging",ok:0}],
        why:'Some keys work, so the keyboard is connected and the driver is fine. A fault that affects only certain keys is physical — crumbs, dust or a drink under those keycaps.' },
      { name:'Password Expired', cat:'access', stat:'COMMUNICATION', icon:'🔑', user:'Marketing',
        clue:'They have tried the old one eleven times.',
        causes:[{t:"Eleven attempts have now locked the account",ok:1},{t:"The keyboard layout changed",ok:0},{t:"The domain is down",ok:0}],
        why:'Eleven wrong attempts is the real story. Most systems lock an account after a handful of failures, so the lockout is now the problem, not the password. Unlock first, then reset.' },
      { name:'Screen Is Upside Down', cat:'display', stat:'COMMUNICATION', icon:'🙃', user:'Legal',
        clue:'They leaned on the keyboard. They deny leaning on the keyboard.',
        causes:[{t:"Ctrl+Alt+Arrow rotated the display",ok:1},{t:"The graphics card is failing",ok:0},{t:"The monitor is mounted wrong",ok:0}],
        why:'Windows rotates the display with Ctrl+Alt+Arrow, and it is very easy to hit by accident. A graphics card failing looks like artefacts or a black screen, not a neat 180-degree flip.' },
      { name:'Laptop "Very Slow"', cat:'software', stat:'PATIENCE', icon:'🐌', user:'Ops',
        clue:'Ninety-four browser tabs. Uptime: 61 days.',
        causes:[{t:"It has not been restarted since April",ok:1},{t:"It needs a bigger hard drive",ok:0},{t:"The wifi is slow",ok:0}],
        why:'Sixty-one days without a restart and ninety-four tabs. Memory fills up and never gets released. Restarting costs two minutes and fixes more slow laptops than any other single action.' },
      { name:'Mouse Battery Mystery', cat:'hardware', stat:'INVESTIGATION', icon:'🖱️', user:'Design',
        clue:'Works when held at a very specific angle.',
        causes:[{t:"The battery contact spring has lost its tension",ok:1},{t:"The desk is the wrong colour for the sensor",ok:0},{t:"The USB port is faulty",ok:0}],
        why:'Working at one specific angle is the clue. That is a physical contact problem — gravity is completing the circuit. A flat battery would not work at any angle.' },
      { name:'Cannot Find The Desktop', cat:'software', stat:'COMMUNICATION', icon:'🗂️', user:'Reception',
        clue:'They saved it "to the desktop". They were in a remote session.',
        causes:[{t:"It is on the remote desktop, not theirs",ok:1},{t:"The file was deleted",ok:0},{t:"Desktop icons are hidden",ok:0}],
        why:'Their files are fine; they are looking at a different computer. Remote desktop sessions have their own desktop, and it is easy to forget which machine you are actually looking at.' },
      { name:'Camera Shows Only Ceiling', cat:'display', stat:'COMMUNICATION', icon:'📹', user:'Marketing',
        clue:'A perfect view of the ceiling tiles. For the entire call.',
        causes:[{t:'The laptop is open on a stand behind them',ok:1},{t:'The camera has failed',ok:0},{t:'The driver is missing',ok:0}],
        why:'The camera works, it is just aimed wrong. A laptop propped on a stand points its camera upward. Move the laptop, not the settings.' },
      { name:'Everything Is In German', cat:'software', stat:'INVESTIGATION', icon:'🇩🇪', user:'Accounts',
        clue:'Menus changed language overnight. They insist they touched nothing.',
        causes:[{t:'The display language was switched in settings',ok:1},{t:'A virus',ok:0},{t:'The keyboard is German',ok:0}],
        why:'Nothing is broken — a setting was changed. Display language sits in system settings and can be changed with a stray click. Change it back and everything returns.' },
      { name:'Chair Will Not Go Up', cat:'hardware', stat:'PATIENCE', icon:'🪑', user:'Legal',
        clue:'Not strictly IT. They logged it anyway. It is under your desk now.',
        causes:[{t:'This is a facilities job, not yours',ok:1},{t:'The gas cylinder needs a driver',ok:0},{t:'It needs a firmware update',ok:0}],
        why:'Not every request that reaches IT is an IT problem. Recognising what belongs to facilities, HR or someone else — and handing it over politely — is part of the job.' },
      { name:'Printing To The Wrong Floor', cat:'hardware', stat:'COMMUNICATION', icon:'🖨️', user:'Ops',
        clue:'Everything comes out on the third floor. They sit on the first.',
        causes:[{t:'Their default printer is still the old floor',ok:1},{t:'The printer was moved',ok:0},{t:'Their account is wrong',ok:0}],
        why:'The pages are printing perfectly, just somewhere else. When someone moves desks, the default printer follows them until it is changed.' },
      { name:'The Cursor Has Vanished', cat:'hardware', stat:'INVESTIGATION', icon:'👻', user:'Design',
        clue:'The mouse moves. No cursor anywhere. Their second monitor is switched off.',
        causes:[{t:'The cursor is on the screen they turned off',ok:1},{t:'The mouse is dead',ok:0},{t:'The graphics driver crashed',ok:0}],
        why:'The mouse moves, so the mouse works. If the computer thinks a second screen is still attached, the cursor can sit on a monitor that is switched off.' },
      { name:'It Says I Am Away', cat:'software', stat:'COMMUNICATION', icon:'🟡', user:'Sales',
        clue:'They are very much at their desk, and slightly offended about it.',
        causes:[{t:'Status is stuck from a locked session elsewhere',ok:1},{t:'The app is broken',ok:0},{t:'The network is slow',ok:0}],
        why:'Presence status comes from the session, not the person. A session left locked on another machine keeps reporting away. Sign that session out.' },
    ],
    MEDIUM: [
      { name:'VPN Failure', cat:'network', stat:'TECHNICAL', icon:'🔐', user:'Remote Team',
        clue:'Connects, holds for four seconds, drops. Only from home.',
        causes:[{t:'MTU mismatch on the tunnel',ok:1},{t:'Their password expired',ok:0},{t:'The laptop needs more RAM',ok:0}],
        why:'The tunnel connects but large packets vanish. That is a classic MTU problem — the packet is too big to fit once the VPN adds its own wrapper, so it is silently dropped. Lower the MTU.' },
      { name:'Outlook Sync Problem', cat:'software', stat:'INVESTIGATION', icon:'📧', user:'Sales',
        clue:'Sent items still sync. The inbox stopped three days ago.',
        causes:[{t:'The mailbox is over quota',ok:1},{t:'The keyboard is faulty',ok:0},{t:'DNS is down company-wide',ok:0}],
        why:'Mail sends but does not arrive. A mailbox at its storage limit accepts nothing new. Check the quota before touching the client.' },
      { name:'Certificate Error', cat:'security', stat:'TECHNICAL', icon:'📜', user:'Finance',
        clue:'One machine only. Everyone else on the floor is fine.',
        causes:[{t:'Their clock is fourteen minutes fast',ok:1},{t:'The website has expired',ok:0},{t:'Their account is locked',ok:0}],
        why:'Certificates are only valid between two dates, so the computer\'s clock decides whether they look valid. A clock fourteen minutes out can make every secure site look untrustworthy.' },
      { name:'BitLocker Recovery', cat:'security', stat:'PATIENCE', icon:'🔒', user:'Field Staff',
        clue:'Asking for a 48-digit key right after a firmware update.',
        causes:[{t:'The TPM lost its seal in the BIOS update',ok:1},{t:'They typed the password wrong',ok:0},{t:'The disk has failed',ok:0}],
        why:'The drive is encrypted and the chip that holds the key checks the machine has not changed. A BIOS update looks like a change, so it asks for the recovery key.' },
      { name:'External Display Failure', cat:'display', stat:'TECHNICAL', icon:'📺', user:'Meeting Rm 3',
        clue:'Works at their desk. Dead in the meeting room.',
        causes:[{t:'Room cable is HDMI, the dock outputs DisplayPort',ok:1},{t:'The monitor is broken',ok:0},{t:'The graphics driver is old',ok:0}],
        why:'Both ends work, the connection between them does not. HDMI and DisplayPort are different shapes carrying different signals. An adapter, not a repair.' },
      { name:'Software Install Failure', cat:'software', stat:'INVESTIGATION', icon:'💿', user:'Engineering',
        clue:'Installer reaches 94%, rolls back, reports nothing.',
        causes:[{t:'An older version is still half-uninstalled',ok:1},{t:'They are offline',ok:0},{t:'They need a bigger monitor',ok:0}],
        why:'The installer refuses because it can see traces of an older version. A half-removed program blocks the new one. Clean out the remains first.' },
      { name:'Shared Drive Vanished', cat:'network', stat:'INVESTIGATION', icon:'📁', user:'Accounts',
        clue:'Gone for one person. Fine for the other six on the team.',
        causes:[{t:'They were dropped from the security group',ok:1},{t:'The whole file server is down',ok:0},{t:'Their laptop needs a restart',ok:0}],
        why:'The drive is there; they can no longer see it. Access to shared folders comes from group membership, and being removed from a group looks exactly like a folder disappearing.' },
      { name:'MFA Device Lost', cat:'access', stat:'COMMUNICATION', icon:'📱', user:'New Joiner',
        clue:'New phone. Old phone wiped and traded in on Saturday.',
        causes:[{t:'The authenticator seed went with the old phone',ok:1},{t:'Their password expired',ok:0},{t:'The wifi is blocking them',ok:0}],
        why:'The codes were never on the SIM — they come from a secret stored in the app on that specific phone. A new phone means re-enrolling, not restoring.' },
      { name:'Ghost Audio In Meetings', cat:'software', stat:'SPEED', icon:'👻', user:'Product',
        clue:'Everyone hears an echo, but only when this one person talks.',
        causes:[{t:'Laptop speakers and headset are both live',ok:1},{t:'A failing microphone',ok:0},{t:'Their internet is slow',ok:0}],
        why:'The echo is the room hearing itself. Two active outputs, one microphone. Turn one of them off.' },
      { name:'Docking Station Rebellion', cat:'hardware', stat:'TECHNICAL', icon:'🔌', user:'Consulting',
        clue:'Both monitors and the keyboard drop out, then return. Every ten minutes.',
        causes:[{t:'Dock firmware is three versions behind',ok:1},{t:'Both monitors are failing',ok:0},{t:'The user keeps unplugging it',ok:0}],
        why:'Docks run their own software, and they get updates like anything else. Odd, intermittent behaviour across screens, network and USB at once usually points at the dock\'s firmware.' },
      { name:'Cloud Sync Stuck For Days', cat:'software', stat:'PATIENCE', icon:'🔄', user:'Projects',
        clue:'Spinning for three days. Forty thousand files, one of them named "con".',
        causes:[{t:'A file name the filesystem refuses to accept',ok:1},{t:'Their internet is slow',ok:0},{t:'The disk is failing',ok:0}],
        why:'Sync stops on the file it cannot handle and stays stuck there. Characters that are fine on one system are forbidden on another. Rename the file and it moves.' },
      { name:'Scanner Will Not Scan To Email', cat:'hardware', stat:'TECHNICAL', icon:'📠', user:'Reception',
        clue:'Copies fine. Scan-to-email fails silently, and only since Tuesday.',
        causes:[{t:'The mail relay changed its auth on Tuesday',ok:1},{t:'The scanner glass is dirty',ok:0},{t:'The paper tray is empty',ok:0}],
        why:'The scanner has not changed — the mail server has. Devices that send mail need credentials, and a security change on the server leaves them unable to sign in.' },
      { name:'One Spreadsheet Kills The App', cat:'software', stat:'INVESTIGATION', icon:'📊', user:'Finance',
        clue:'Every other workbook opens fine. This one takes the whole application down.',
        causes:[{t:'A broken external link inside the workbook',ok:1},{t:'The software needs reinstalling',ok:0},{t:'Their laptop is too slow',ok:0}],
        why:'One file, not the program. A link to another workbook that no longer exists makes the app hang while it waits. Break the link.' },
      { name:'Calls Drop At Five, Every Day', cat:'network', stat:'INVESTIGATION', icon:'📞', user:'Support',
        clue:'Only at five. Only outbound. Every single weekday.',
        causes:[{t:'The nightly backup saturates the uplink at five',ok:1},{t:'The handsets are old',ok:0},{t:'People are hanging up',ok:0}],
        why:'A fault with a timetable has a scheduled cause. Something else is using all the bandwidth at exactly that hour. Find the schedule, move the job.' },
      { name:'New Starter Has No Access', cat:'access', stat:'MANAGEMENT', icon:'🆕', user:'HR',
        clue:'Started this morning. Has a desk, a laptop, and access to nothing at all.',
        causes:[{t:'HR raised the record after the sync had run',ok:1},{t:'They are typing it wrong',ok:0},{t:'The laptop is faulty',ok:0}],
        why:'Accounts are usually created by a sync that runs on a timer. If HR added the person after the last run, the account simply does not exist yet.' },
      { name:'Wi-Fi Dies In Room 4 Only', cat:'network', stat:'INVESTIGATION', icon:'📶', user:'Meeting Rm 4',
        clue:'Only room 4, and only once the room fills up.',
        causes:[{t:'The access point hits its client limit',ok:1},{t:'The walls are too thick',ok:0},{t:'The room is cursed',ok:0}],
        why:'One room, so it is that room\'s access point. Each one has a limit on how many devices it can hold, and a full meeting room hits it.' },
    ],
    HARD: [
      { name:'Network Outage — Floor 4', cat:'network', stat:'INVESTIGATION', icon:'🌐', user:'Floor 4',
        clue:'Floor 4 only. Started 09:02. Wired and wireless both dead.',
        causes:[{t:'A loop from the desk switch someone brought in',ok:1},{t:'The internet is down nationally',ok:0},{t:'Everyone expired at once',ok:0}],
        why:'A switch plugged into itself sends traffic round in circles until the network drowns. It usually starts with somebody bringing in their own switch to get more ports.' },
      { name:'Server Failure', cat:'network', stat:'TECHNICAL', icon:'🗄️', user:'Infrastructure',
        clue:'Service is running, the port answers, every request times out.',
        causes:[{t:'The disk is full and it cannot write its log',ok:1},{t:'Someone unplugged it',ok:0},{t:'The licence expired',ok:0}],
        why:'A full disk stops a server writing anything, including the log that would tell you what is wrong. Check free space first when a server behaves strangely for no clear reason.' },
      { name:'Cloud Service Failure', cat:'network', stat:'AUTOMATION', icon:'☁️', user:'Everyone',
        clue:'Vendor status page is green. Nobody here can sign in.',
        causes:[{t:'Our federation certificate rolled over last night',ok:1},{t:'The vendor is lying',ok:0},{t:'Everyone forgot their password',ok:0}],
        why:'Sign-in between your systems and a cloud provider depends on a shared certificate. When it rolls over and only one side knows, every login stops at once.' },
      { name:'Security Incident', cat:'security', stat:'INVESTIGATION', icon:'🛡️', user:'SecOps',
        clue:'One account sent 4,000 emails at 03:14, from two countries.',
        causes:[{t:'The account is compromised — kill the sessions',ok:1},{t:'The mail server is misconfigured',ok:0},{t:'Somebody is working very late',ok:0}],
        why:'When an account is being used by someone else, changing the password is not enough — existing sessions stay signed in. Kill the sessions, then reset.' },
      { name:'Executive Laptop Failure', cat:'vip', stat:'SPEED', icon:'💼', user:'The CFO',
        clue:'Black screen, fan spinning, power light on. Boarding in 40 minutes.',
        causes:[{t:'Drain the residual power and reseat',ok:1},{t:'Order a replacement now',ok:0},{t:'Reinstall Windows',ok:0}],
        why:'Completely dead with no lights is often trapped residual power rather than a fault. Disconnect everything, hold the power button, reseat the battery.' },
      { name:'Meeting Room AV Meltdown', cat:'vip', stat:'SPEED', icon:'📽️', user:'Board Room',
        clue:'Fifteen people, a client dialled in, and no picture.',
        causes:[{t:'The room PC woke on the wrong display profile',ok:1},{t:'The projector bulb has gone',ok:0},{t:'The internet is slow',ok:0}],
        why:'The PC is running, just drawing the picture on a display nobody can see. Machines remember screen arrangements and pick the wrong one after a restart.' },
      { name:'Domain Controller Down', cat:'network', stat:'TECHNICAL', icon:'🏛️', user:'All Sites',
        clue:'Nobody can log in anywhere. Replication stopped on Sunday.',
        causes:[{t:'A stale DC passed its tombstone lifetime',ok:1},{t:'The building lost power',ok:0},{t:'A cable is loose',ok:0}],
        why:'Domain controllers must talk to each other regularly. One offline too long is treated as gone for good and refuses to rejoin. Rebuild rather than reconnect.' },
      { name:'Suspicious Email Campaign', cat:'security', stat:'MANAGEMENT', icon:'🎣', user:'Whole Company',
        clue:'Forty staff got the same invoice PDF — from a real supplier address.',
        causes:[{t:"The supplier's mailbox is compromised — warn and block",ok:1},{t:'Our spam filter is switched off',ok:0},{t:'It is a marketing campaign',ok:0}],
        why:'The address is genuine, which is why it passes every check. The supplier\'s own mailbox has been taken over. Warn the staff and block the thread, not the sender.' },
      { name:'Storage Array Degraded', cat:'network', stat:'TECHNICAL', icon:'💽', user:'Infrastructure',
        clue:'One disk failed. The rebuild has been running for eleven hours.',
        causes:[{t:'A second disk is erroring mid-rebuild',ok:1},{t:'Rebuilds are just slow',ok:0},{t:'The controller needs a reboot',ok:0}],
        why:'Losing one disk is survivable. The array is rebuilding, and a second disk failing during that rebuild is the moment data is genuinely at risk. Stop and get the backup ready.' },
      { name:'Locked Out After The Patch', cat:'access', stat:'INVESTIGATION', icon:'🔐', user:'Everyone',
        clue:'The patch went out overnight. This morning nobody can sign in anywhere.',
        causes:[{t:'The update broke the auth agent\'s trust',ok:1},{t:'Everyone forgot their password',ok:0},{t:'The internet is down',ok:0}],
        why:'It started with the update and affects everyone, so look at what the update changed. The component that proves identity to the server lost its trust relationship.' },
      { name:'Finance Cannot Close The Month', cat:'software', stat:'MANAGEMENT', icon:'📅', user:'Finance',
        clue:'The reporting job has failed four nights running. Month-end is tomorrow.',
        causes:[{t:'A schema change upstream broke the job',ok:1},{t:'The server needs more memory',ok:0},{t:'Finance are running it wrong',ok:0}],
        why:'The job did not break by itself. Something it reads from changed shape upstream, and it is now looking for a column that no longer exists.' },
      { name:'The Backup Has Not Run Since June', cat:'security', stat:'INVESTIGATION', icon:'💾', user:'Everyone',
        clue:'Green ticks all the way down the dashboard. No actual data since June.',
        causes:[{t:'The job reports success but writes nothing',ok:1},{t:'The tapes are full',ok:0},{t:'Nobody was checking',ok:0}],
        why:'The most dangerous kind of failure: it reports success. A backup nobody has ever restored from is not a backup. Test restores, do not trust green ticks.' },
    ],
  };

  /* How long a ticket sits in the queue before it breaches. Five minutes each:
     long enough to read the symptom, think, and still choose what to work
     first, rather than being rushed by a stopwatch. */
  const SLA = { EASY: 300, MEDIUM: 300, HARD: 300 };

  /* A ticket counts as critical in its last half-minute, whatever its budget —
     an absolute threshold, so "urgent" always means the same thing. */
  const SLA_URGENT = 30;

  /* How often a ticket turns out to be a real puzzle rather than a known fix.
     Difficulty does not decide this — a printer can be baffling and a server
     outage can be routine. The rate flexes with how hard you are working:
     roughly one in ten at a steady pace, rarer when you are dipping in and
     out, more often when you are flying. See Game.diagnoseChance(). */
  /* Diagnosis is the only moment in the game where the player reads something
     and decides, rather than tapping. Everything else is a button. It was
     throttled to one ticket in ten, which made the thinking part a rarity in a
     game supposedly about diagnosing faults. */
  const DIAGNOSE_CHANCE = 0.24;      // the steady-pace baseline, ~1 in 4
  const DIAGNOSE_MIN = 0.16;         // when barely playing
  const DIAGNOSE_MAX = 0.32;         // when in full flow
  const DIAGNOSE_PITY = 8;           // never go longer than this without one

  /* How far a technician can be developed. Past this they are as good as the
     department can make them — bring somebody else on instead. */
  const MAX_CHAR_LEVEL = 70;   // the ceiling in the last chapter

  /* Your hands-on allowance. You can personally work this many tickets an
     hour; the hour starts when you work your first one, and when it is up the
     allowance comes back in full. Your team keeps the automated queue running
     the whole time, so there is something waiting when you return. */
  /* ---------- TABS ----------
     Six tabs on the first screen reads as complexity, not depth. They arrive
     one at a time instead, each as a small reward, which also means the guide
     for each one lands when the player has a reason to care about it. */
  const TABS = [
    { id:'hq',       label:'HQ' },
    { id:'staff',    label:'STAFF',    need:'tickets', n:5,
      hint:'Resolve 5 tickets', why:'Colleagues who work the queue while you are away.' },
    { id:'gear',     label:'GEAR',     need:'gear',    n:5,
      hint:'Collect 5 pieces of equipment', why:'Kit that makes the whole team better. You start with three; tickets drop the rest.' },
    { id:'missions', label:'MISSIONS', need:'level',   n:3,
      hint:'Reach level 3', why:'Bigger jobs with bigger payouts.' },
    { id:'rank',     label:'RANKING',  need:'level',   n:6,
      hint:'Reach level 6', why:'See how you compare with everyone else playing.' },
    { id:'battle',   label:'BATTLE',   need:'level',   n:10,
      hint:'Reach level 10', why:'Wager credits on IT puzzles against other players.' },
  ];

  const QUOTA = {
    perHour: 30,
    windowMs: 60 * 60 * 1000,
    perBreakRoom: 2,                 // the Break Room buys you a few more

    /* The hourly cap exists to bring people back. It works on somebody who has
       staff earning while they are away and a reason to return — and it is
       brutal on somebody who has neither. A brand-new player used to run out
       after thirty taps, about three minutes, before they had decided whether
       they liked the game.

       So the allowance starts generous and tightens as the player acquires the
       things that make coming back worth it. By level 15 they have colleagues,
       an office and a chapter to finish, and the standard thirty is a pace
       rather than a wall. */
    ramp: [
      { level: 1, per: 250 },        // the first evening: effectively open
      { level: 5, per: 120 },
      { level: 10, per: 60 },
      { level: 15, per: 30 },        // from here on, the real thing
    ],
  };

  /* Flavour lines shown while the ticket sits in the queue */
  const TICKET_FLAVOUR = [
    'User says it "worked yesterday".',
    'Ticket description is one word: "broken".',
    'User has already tried turning it off and on. Allegedly.',
    'Screenshot attached. It is a photo of the screen. Taken at an angle.',
    'User cc\'d the entire department.',
    'Marked URGENT by the user. Everything is urgent.',
    'User is standing behind you right now.',
    'Reported by someone who "knows a bit about computers".',
    'Third time this month. Same user. Same cable.',
    'User closed the ticket, then reopened it, then called.',
  ];

  /* Reasons a technically perfect fix still upsets the user */
  const SAT_FAILS = [
    'Technician told the user to restart the computer.',
    'Technician sighed audibly.',
    'Fix took 8 seconds. User feels their problem was not respected.',
    'Technician used the word "obviously".',
    'User wanted a new laptop, not a working one.',
    'Technician fixed it remotely. User wanted a visit and a chat.',
    'Ticket closed without a heartfelt apology.',
    'Technician explained the cause. In detail. For nine minutes.',
    'User was hoping the problem would justify going home early.',
  ];
  const SAT_WINS = [
    'Technician explained it kindly and drew a diagram.',
    'User was called by name. User was delighted.',
    'Technician pretended it was a hard problem. User felt important.',
    'Follow-up message sent. Unheard of.',
    'Technician also cleaned the sticky keyboard. Hero.',
    'User learned something and told their whole floor.',
  ];

  /* ---------- CRITICAL INCIDENTS ---------- */
  const INCIDENTS = [
    {
      id:'global_outage', title:'GLOBAL NETWORK OUTAGE', icon:'🌐',
      brief:'Every office just dropped off the network at once. The phones are already ringing.',
      time:30,
      steps:[
        { q:'First move?',            opts:[{t:'CHECK CORE SWITCH',ok:1},{t:'REBOOT A USER PC',ok:0},{t:'EMAIL EVERYONE',ok:0}] },
        { q:'Switch is up. Next?',    opts:[{t:'BUY A NEW ROUTER',ok:0},{t:'CHECK ISP UPLINK',ok:1},{t:'BLAME THE INTERN',ok:0}] },
        { q:'Uplink is flapping.',    opts:[{t:'CLEAR BROWSER CACHE',ok:0},{t:'CHECK DHCP SCOPE',ok:1},{t:'RESTART THE PRINTER',ok:0}] },
        { q:'Scope exhausted. Then?', opts:[{t:'CHECK VLAN CONFIG',ok:1},{t:'DEFRAG THE SERVER',ok:0},{t:'OPEN A VENDOR CASE',ok:0}] },
        { q:'Bring it home.',         opts:[{t:'WAIT AND HOPE',ok:0},{t:'FAILOVER + RESTORE NETWORK',ok:1},{t:'GO FOR COFFEE',ok:0}] },
      ]
    },
    {
      id:'ceo_board', title:'CEO CANNOT JOIN BOARD MEETING', icon:'🚨',
      brief:'The board is seated. The CEO is staring at a spinning circle. You have minutes.',
      time:25,
      steps:[
        { q:'They are in the room already.', opts:[{t:'CALL THE CEO CALMLY',ok:1},{t:'ASK FOR A TICKET',ok:0},{t:'REMOTE IN UNANNOUNCED',ok:0}] },
        { q:'Camera works, no audio.',       opts:[{t:'REINSTALL WINDOWS',ok:0},{t:'CHECK AUDIO DEVICE',ok:1},{t:'SUGGEST DIAL-IN LATER',ok:0}] },
        { q:'Wrong output selected.',        opts:[{t:'SWITCH TO ROOM SPEAKER',ok:1},{t:'TURN VOLUME TO 100',ok:0},{t:'RESTART LAPTOP NOW',ok:0}] },
        { q:'Audio is back. Finish it.',     opts:[{t:'LEAVE SILENTLY',ok:0},{t:'STAY ON MUTE UNTIL STABLE',ok:1},{t:'EXPLAIN THE ROOT CAUSE',ok:0}] },
      ]
    },
    {
      id:'ransom', title:'RANSOMWARE ALERT — FINANCE', icon:'🛡️',
      brief:'A finance workstation is encrypting shared folders. Every second counts.',
      time:26,
      steps:[
        { q:'Immediate action?',        opts:[{t:'ISOLATE THE MACHINE',ok:1},{t:'RUN A FULL SCAN',ok:0},{t:'ASK THE USER FIRST',ok:0}] },
        { q:'Machine isolated.',        opts:[{t:'DISABLE THE ACCOUNT',ok:1},{t:'DELETE THE FILES',ok:0},{t:'REBOOT THE SERVER',ok:0}] },
        { q:'Spread check.',            opts:[{t:'PAY NOTHING, PULL LOGS',ok:1},{t:'NEGOTIATE',ok:0},{t:'WAIT FOR MONDAY',ok:0}] },
        { q:'Recovery.',                opts:[{t:'RESTORE FROM BACKUP',ok:1},{t:'HOPE FOR A DECRYPTOR',ok:0},{t:'REBUILD BY HAND',ok:0}] },
        { q:'After action.',            opts:[{t:'BRIEF THE BUSINESS',ok:1},{t:'SAY NOTHING',ok:0},{t:'BLAME FINANCE',ok:0}] },
      ]
    },
    {
      id:'payday', title:'PAYROLL SERVER DOWN ON PAYDAY', icon:'💸',
      brief:'Payroll runs in 40 minutes. The server disagrees. HR is walking towards you.',
      time:24,
      steps:[
        { q:'Where do you start?',   opts:[{t:'CHECK DISK SPACE',ok:1},{t:'REINSTALL PAYROLL',ok:0},{t:'CALL THE VENDOR',ok:0}] },
        { q:'Disk full of logs.',    opts:[{t:'DELETE EVERYTHING',ok:0},{t:'ARCHIVE OLD LOGS',ok:1},{t:'ADD A SECOND SERVER',ok:0}] },
        { q:'Service still stopped.',opts:[{t:'RESTART THE SERVICE',ok:1},{t:'RESTART THE BUILDING',ok:0},{t:'ESCALATE AND WAIT',ok:0}] },
        { q:'Confirm payroll runs.', opts:[{t:'RUN A TEST BATCH',ok:1},{t:'ASSUME IT IS FINE',ok:0},{t:'CLOSE THE TICKET',ok:0}] },
      ]
    },
    {
      id:'overheat', title:'SERVER ROOM OVERHEATING', icon:'🔥',
      brief:'The server room is 41°C and climbing. The AC unit has opinions.',
      time:22,
      steps:[
        { q:'First response.',   opts:[{t:'PROP THE DOOR + FANS',ok:1},{t:'SHUT DOWN EVERYTHING',ok:0},{t:'IGNORE THE ALARM',ok:0}] },
        { q:'Load management.',  opts:[{t:'SHED NON-CRITICAL LOAD',ok:1},{t:'START A BACKUP JOB',ok:0},{t:'RUN MORE VMs',ok:0}] },
        { q:'Root cause.',       opts:[{t:'CHECK AC CONDENSER',ok:1},{t:'CHECK THE FIREWALL',ok:0},{t:'CHECK EMAIL',ok:0}] },
        { q:'Long term.',        opts:[{t:'RAISE A FACILITIES CASE',ok:1},{t:'BUY A DESK FAN',ok:0},{t:'DO NOTHING',ok:0}] },
      ]
    },
    {
      id:'replyall', title:'REPLY-ALL STORM', icon:'📧',
      brief:'Someone emailed four thousand people. Now four thousand people are replying "please remove me".',
      time:26,
      steps:[
        { q:'First move?',              opts:[{t:'DISABLE REPLY-ALL ON THE LIST',ok:1},{t:'EMAIL EVERYONE ASKING THEM TO STOP',ok:0},{t:'RESTART THE MAIL SERVER',ok:0}] },
        { q:'The queue is backing up.', opts:[{t:'DELETE ALL THE MESSAGES',ok:0},{t:'THROTTLE THE OUTBOUND QUEUE',ok:1},{t:'TURN OFF EMAIL ENTIRELY',ok:0}] },
        { q:'Where did it start?',      opts:[{t:'BLAME THE INTERN',ok:0},{t:'QUARANTINE THE ORIGINAL THREAD',ok:1},{t:'WAIT FOR IT TO PASS',ok:0}] },
        { q:'Stop the next one.',       opts:[{t:'CAP LIST SIZE, REQUIRE APPROVAL',ok:1},{t:'SEND A STRONGLY WORDED MEMO',ok:0},{t:'DO NOTHING',ok:0}] },
      ]
    },
    {
      id:'deleted', title:'A FOLDER HAS GONE MISSING', icon:'🗑️',
      brief:'Twelve years of finance records vanished at 14:20. The intern has gone very quiet.',
      time:28,
      steps:[
        { q:'Immediate action?',        opts:[{t:'STOP ALL WRITES TO THAT VOLUME',ok:1},{t:'ASK THEM TO UNDO IT',ok:0},{t:'RUN A VIRUS SCAN',ok:0}] },
        { q:'Recovery route.',          opts:[{t:'BUY RECOVERY SOFTWARE',ok:0},{t:'CHECK LAST NIGHT\'S SNAPSHOT',ok:1},{t:'REFORMAT AND START AGAIN',ok:0}] },
        { q:'Snapshot is 18h old.',     opts:[{t:'ACCEPT THE LOSS',ok:0},{t:'FILL THE GAP FROM THE JOURNAL',ok:1},{t:'BLAME THE INTERN PUBLICLY',ok:0}] },
        { q:'Afterwards.',              opts:[{t:'TURN ON VERSIONING, TIGHTEN RIGHTS',ok:1},{t:'FIRE THE INTERN',ok:0},{t:'SAY NOTHING',ok:0}] },
      ]
    },
    {
      id:'badges', title:'NOBODY CAN BADGE IN', icon:'🚪',
      brief:'Two hundred people are queued in the lobby. The door controller is not answering.',
      time:25,
      steps:[
        { q:'Start where?',             opts:[{t:'CHECK THE CONTROLLER\'S LINK',ok:1},{t:'REISSUE EVERYONE\'S BADGE',ok:0},{t:'CALL A LOCKSMITH',ok:0}] },
        { q:'Controller is offline.',   opts:[{t:'LEAVE THEM ALL LOCKED',ok:0},{t:'FAIL SAFE-OPEN WITH A GUARD',ok:1},{t:'FORCE THE DOORS',ok:0}] },
        { q:'Root cause.',              opts:[{t:'ITS CERTIFICATE EXPIRED OVERNIGHT',ok:1},{t:'THE BADGES DEMAGNETISED',ok:0},{t:'THE BUILDING LOST POWER',ok:0}] },
        { q:'Fix it properly.',         opts:[{t:'RENEW THE CERT AND RE-SYNC',ok:1},{t:'REINSTALL THE SOFTWARE',ok:0},{t:'REPLACE THE CONTROLLER',ok:0}] },
      ]
    },
    {
      id:'miner', title:'THE BUILD FARM IS AT 100%', icon:'⛏️',
      brief:'Every build agent is pinned at full CPU and not one build is running.',
      time:28,
      steps:[
        { q:'What is it doing?',        opts:[{t:'SEE WHAT PROCESS IS EATING CPU',ok:1},{t:'REBOOT EVERYTHING',ok:0},{t:'ADD MORE SERVERS',ok:0}] },
        { q:'Unknown binary, phoning out.', opts:[{t:'KILL IT AND MOVE ON',ok:0},{t:'ISOLATE THE AGENTS FROM THE NETWORK',ok:1},{t:'IGNORE IT',ok:0}] },
        { q:'How did it get in?',       opts:[{t:'AN UNPINNED BUILD DEPENDENCY',ok:1},{t:'THE FIREWALL LET IT THROUGH',ok:0},{t:'SOMEBODY INSIDE DID IT',ok:0}] },
        { q:'Clean up.',                opts:[{t:'REBUILD FROM A KNOWN GOOD IMAGE',ok:1},{t:'DELETE THE FILE',ok:0},{t:'RUN AN ANTIVIRUS SCAN',ok:0}] },
        { q:'Report it.',               opts:[{t:'TELL SECURITY, ROTATE CREDENTIALS',ok:1},{t:'KEEP IT QUIET',ok:0},{t:'POST ABOUT IT ONLINE',ok:0}] },
      ]
    },
    {
      id:'certweb', title:'THE WEBSITE SAYS "NOT SECURE"', icon:'🔓',
      brief:'Customers are staring at a big red warning. Sales noticed before you did.',
      time:24,
      steps:[
        { q:'Confirm it.',              opts:[{t:'CHECK THE CERT ON THE LIVE HOST',ok:1},{t:'CLEAR YOUR BROWSER CACHE',ok:0},{t:'ASK A CUSTOMER TO RETRY',ok:0}] },
        { q:'Expired at midnight.',     opts:[{t:'TELL PEOPLE TO CLICK THROUGH',ok:0},{t:'ISSUE AND INSTALL A RENEWAL',ok:1},{t:'TAKE THE SITE DOWN',ok:0}] },
        { q:'There are four load balancers.', opts:[{t:'DEPLOY TO EVERY NODE',ok:1},{t:'DO THE FIRST ONE AND HOPE',ok:0},{t:'RESTART THE SITE',ok:0}] },
        { q:'Never again.',             opts:[{t:'AUTOMATE RENEWAL WITH ALERTING',ok:1},{t:'PUT IT IN YOUR CALENDAR',ok:0},{t:'NOTHING',ok:0}] },
      ]
    },
    {
      id:'typhoon', title:'EVERYONE IS REMOTE AT ONCE', icon:'🌀',
      brief:'The office is shut for the storm. Two thousand people just hit a VPN built for four hundred.',
      time:26,
      steps:[
        { q:'First response.',          opts:[{t:'CHECK SESSION AND LICENCE LIMITS',ok:1},{t:'TELL THEM TO COME IN ANYWAY',ok:0},{t:'REBOOT THE FIREWALL',ok:0}] },
        { q:'Sessions are capped.',     opts:[{t:'ASK PEOPLE TO TAKE TURNS',ok:0},{t:'RAISE THE CAP, ADD THE SPARE NODE',ok:1},{t:'ORDER HARDWARE TODAY',ok:0}] },
        { q:'Bandwidth is saturated.',  opts:[{t:'SPLIT-TUNNEL WHAT DOES NOT NEED VPN',ok:1},{t:'BAN VIDEO CALLS',ok:0},{t:'THROTTLE EVERYONE EQUALLY',ok:0}] },
        { q:'Keep it steady.',          opts:[{t:'STATUS PAGE, STAGGER RECONNECTS',ok:1},{t:'SAY NOTHING',ok:0},{t:'REBOOT IT HOURLY',ok:0}] },
      ]
    },
    {
      id:'licence', title:'THE DESIGN TEAM IS DEAD IN THE WATER', icon:'🔑',
      brief:'Every design application says "no licence available". The deadline is at five.',
      time:25,
      steps:[
        { q:'Check what first?',        opts:[{t:'WHETHER THE LICENCE SERVICE RUNS',ok:1},{t:'WHETHER THEY ARE ON WIFI',ok:0},{t:'WHETHER THEY SAVED THEIR WORK',ok:0}] },
        { q:'Service is up, no seats.', opts:[{t:'RELEASE THE STALE CHECKED-OUT SEATS',ok:1},{t:'BUY MORE LICENCES NOW',ok:0},{t:'REINSTALL THE SOFTWARE',ok:0}] },
        { q:'Seats freed, still failing.', opts:[{t:'THE USERS ARE MISTAKEN',ok:0},{t:'THE LICENCE FILE EXPIRED TODAY',ok:1},{t:'THE DISK IS FULL',ok:0}] },
        { q:'Get them working.',        opts:[{t:'INSTALL THE RENEWAL, RESTART SERVICE',ok:1},{t:'HAND OUT PERSONAL LICENCES',ok:0},{t:'TELL THEM TO WAIT',ok:0}] },
      ]
    },
    {
      id:'chatbot', title:'THE CHATBOT KNOWS TOO MUCH', icon:'🧠',
      brief:'The new AI assistant just quoted next year\'s unreleased salary bands to a summer intern.',
      time:28,
      steps:[
        { q:'First move.',              opts:[{t:'TAKE THE ASSISTANT OFFLINE',ok:1},{t:'ASK THE INTERN TO FORGET IT',ok:0},{t:'DELETE THE CHAT LOG',ok:0}] },
        { q:'Contain it.',              opts:[{t:'TELL IT TO "BE MORE CAREFUL"',ok:0},{t:'FIND OUT WHAT ELSE IT INDEXED',ok:1},{t:'RESTART THE SERVER',ok:0}] },
        { q:'It indexed a whole HR share.', opts:[{t:'RE-SCOPE RIGHTS AT THE SOURCE',ok:1},{t:'FILTER THE RUDE WORDS',ok:0},{t:'TURN OFF LOGGING',ok:0}] },
        { q:'Who needs to know?',       opts:[{t:'HR AND SECURITY, NOW',ok:1},{t:'NOBODY',ok:0},{t:'ONLY YOUR MANAGER',ok:0}] },
        { q:'Bring it back.',           opts:[{t:'RE-INDEX WITH PERMISSION TRIMMING',ok:1},{t:'JUST SWITCH IT ON AGAIN',ok:0},{t:'LEAVE IT OFF FOREVER',ok:0}] },
      ]
    },
    {
      id:'officemove', title:'DAY ONE IN THE NEW OFFICE', icon:'📦',
      brief:'Three hundred desks, no network, and a managing director holding a laptop and a question.',
      time:27,
      steps:[
        { q:'Where do you start?',      opts:[{t:'CONFIRM THE BUILDING UPLINK IS LIVE',ok:1},{t:'UNBOX THE MONITORS',ok:0},{t:'SET UP THE COFFEE MACHINE',ok:0}] },
        { q:'Uplink fine, floor dark.', opts:[{t:'REPLACE EVERY CABLE',ok:0},{t:'CHECK THE FLOOR SWITCHES ARE PATCHED',ok:1},{t:'CALL THE LANDLORD',ok:0}] },
        { q:'Half the panel is unlabelled.', opts:[{t:'TONE AND LABEL AS YOU GO',ok:1},{t:'GUESS',ok:0},{t:'PLUG IT ALL IN AT RANDOM',ok:0}] },
        { q:'People are arriving.',     opts:[{t:'STAND UP A TEMPORARY WIRELESS BRIDGE',ok:1},{t:'SEND EVERYONE HOME',ok:0},{t:'DO NOTHING',ok:0}] },
      ]
    },
    {
      id:'ddos', title:'THE CUSTOMER PORTAL IS DROWNING', icon:'🌊',
      brief:'Traffic is forty times normal and none of it is buying anything.',
      time:26,
      steps:[
        { q:'Confirm what it is.',      opts:[{t:'CHECK IF THE PATTERN IS REAL USERS',ok:1},{t:'ADD MORE SERVERS NOW',ok:0},{t:'RESTART THE DATABASE',ok:0}] },
        { q:'It is not real users.',    opts:[{t:'BLOCK THE WHOLE COUNTRY',ok:0},{t:'TURN ON UPSTREAM DDOS PROTECTION',ok:1},{t:'TAKE THE SITE OFFLINE',ok:0}] },
        { q:'Some still gets through.', opts:[{t:'RATE-LIMIT BY FINGERPRINT AT THE EDGE',ok:1},{t:'BLOCK EVERY IP YOU SEE',ok:0},{t:'TURN OFF LOGGING',ok:0}] },
        { q:'Customers are calling.',   opts:[{t:'PUBLISH A STATUS PAGE, KEEP IT FRESH',ok:1},{t:'SAY THE SITE IS FINE',ok:0},{t:'BLAME THEIR INTERNET',ok:0}] },
      ]
    },
  ];

  /* ---------- RANDOM EVENTS ---------- */
  const EVENTS = [
    { id:'monday',  title:'MONDAY MORNING',        icon:'☕', dur:60,
      desc:'Every password expired over the weekend. Ticket rewards +200%.',
      mods:{ reward:3.0 } },
    { id:'coffee',  title:'COFFEE MACHINE FAILURE', icon:'🫖', dur:45,
      desc:'Productivity down 30% until someone brave fixes it. Idle output reduced.',
      mods:{ idle:0.7 } },
    { id:'deploy',  title:'NEW SOFTWARE ROLLOUT',   icon:'📦', dur:50,
      desc:'Everything is briefly worse. XP gain +150% while you learn it.',
      mods:{ xp:2.5 } },
    { id:'vip',     title:'VIP FLOOR VISIT',        icon:'🕴️', dur:40,
      desc:'Executives are watching the helpdesk. Reputation gain doubled.',
      mods:{ rep:2.0 } },
    { id:'quiet',   title:'SUSPICIOUSLY QUIET DAY', icon:'🌙', dur:45,
      desc:'Nobody has called in an hour. Idle output +80%. Enjoy it while it lasts.',
      mods:{ idle:1.8 } },
    { id:'audit',   title:'SURPRISE IT AUDIT',      icon:'📋', dur:40,
      desc:'Document everything. Credits +150%, satisfaction is harder to earn.',
      mods:{ credit:2.5, sat:0.8 } },
    { id:'patch',   title:'PATCH TUESDAY',          icon:'🩹', dur:55,
      desc:'Everything needs a restart and everyone wants to know why. Ticket rewards +150%.',
      mods:{ reward:2.5 } },
    { id:'leave',   title:'HALF THE TEAM IS ON LEAVE', icon:'🏝️', dur:50,
      desc:'The automated queue is limping, but anything you close yourself is worth double.',
      mods:{ idle:0.5, reward:2.0 } },
    { id:'board',   title:'BOARD MEETING WEEK',      icon:'📊', dur:45,
      desc:'Executives on every floor, watching. Reputation gain +150%.',
      mods:{ rep:2.5 } },
    { id:'intake',  title:'NEW STARTER INTAKE',      icon:'🎓', dur:50,
      desc:'Forty laptops to hand out and forty people to teach. XP +120%.',
      mods:{ xp:2.2 } },
    { id:'aircon',  title:'AIR CONDITIONING FAILURE', icon:'🥵', dur:45,
      desc:'The office is thirty-one degrees. Everyone is slower and considerably crosser.',
      mods:{ idle:0.75, sat:0.75 } },
    { id:'window',  title:'MAINTENANCE WINDOW',      icon:'🌙', dur:50,
      desc:'A quiet night shift with nobody to interrupt you. Idle output +120%.',
      mods:{ idle:2.2 } },
  ];

  /* ---------- CHARACTERS ---------- */
  /* base: stats at level 1. growth: gain per level. */
  const CHARACTERS = [
    {
      id:'hero', name:'JASON', role:'You', rarity:'RARE', roleKey:'TECHNICIAN', icon:'🧑‍💻',
      strength:'Learns from every single ticket',
      weakness:'Cannot be assigned to idle work — you do the tapping',
      personality:'Started on the helpdesk with a screwdriver and a dream. Still has the screwdriver.',
      quotes:['"I have a good feeling about this cable."','"It is always DNS. Always."','"Let me just check one thing..."'],
      base:{TECHNICAL:12,SPEED:10,COMMUNICATION:8,INVESTIGATION:10,PATIENCE:9,AUTOMATION:5,MANAGEMENT:5},
      growth:{TECHNICAL:2.2,SPEED:1.8,COMMUNICATION:1.6,INVESTIGATION:1.9,PATIENCE:1.7,AUTOMATION:1.1,MANAGEMENT:1.2},
      perks:{}, art:{ skin:'#F1C398', hair:'#3A2A22', hairStyle:'short', shirt:'#3D6FE0', accent:'#2B4EA8', glasses:true, headset:false, beard:false },
      cost:0, repReq:0, hireable:false
    },
    {
      id:'veteran', name:'THE VETERAN', role:'Hardware Specialist', rarity:'RARE', roleKey:'TECHNICIAN', icon:'🔧',
      strength:'+25% hardware ticket resolution',
      weakness:'-10% automation efficiency',
      personality:'Has been here longer than the building. Owns a screwdriver older than the intern.',
      quotes:['"We used to image these by hand. Uphill."','"That is not a fault, that is a feature from 2009."','"Do not touch that rack."'],
      base:{TECHNICAL:16,SPEED:7,COMMUNICATION:6,INVESTIGATION:13,PATIENCE:14,AUTOMATION:3,MANAGEMENT:8},
      growth:{TECHNICAL:2.6,SPEED:1.0,COMMUNICATION:1.0,INVESTIGATION:2.1,PATIENCE:2.2,AUTOMATION:0.5,MANAGEMENT:1.3},
      perks:{ cat_hardware:0.25, automation:-0.10 },
      art:{ skin:'#E8B888', hair:'#B9BFCB', hairStyle:'short', shirt:'#7A6B4F', accent:'#5C5039', glasses:false, headset:false, beard:true },
      cost:1200, repReq:0, hireable:true
    },
    {
      id:'people', name:'THE PEOPLE PERSON', role:'Customer Support', rarity:'UNCOMMON', roleKey:'SUPPORT', icon:'💬',
      strength:'+30% user satisfaction on every ticket',
      weakness:'Lower raw technical power',
      personality:'Remembers everyone\'s birthday and their laptop asset tag. Users request them by name.',
      quotes:['"How is your morning going, honestly?"','"That sounds really frustrating. Let us fix it."','"I will walk over. Kettle is on."'],
      base:{TECHNICAL:6,SPEED:9,COMMUNICATION:18,INVESTIGATION:8,PATIENCE:15,AUTOMATION:4,MANAGEMENT:10},
      growth:{TECHNICAL:0.9,SPEED:1.4,COMMUNICATION:2.8,INVESTIGATION:1.2,PATIENCE:2.4,AUTOMATION:0.7,MANAGEMENT:1.7},
      perks:{ sat:0.30, power:-0.10 },
      art:{ skin:'#8D5A3B', hair:'#241A18', hairStyle:'bun', shirt:'#E0715F', accent:'#B4503F', glasses:false, headset:true, beard:false },
      cost:900, repReq:0, hireable:true
    },
    {
      id:'automation', name:'THE AUTOMATION EXPERT', role:'Automation Specialist', rarity:'EPIC', roleKey:'AUTOMATION', icon:'🤖',
      strength:'+40% idle ticket resolution',
      weakness:'-15% user satisfaction — the script does not say hello',
      personality:'Has not manually closed a ticket since 2021 and considers that a personality.',
      quotes:['"I automated it. Then I automated the automation."','"Why click twice?"','"The script already fixed it. You are welcome."'],
      base:{TECHNICAL:12,SPEED:11,COMMUNICATION:4,INVESTIGATION:11,PATIENCE:6,AUTOMATION:20,MANAGEMENT:7},
      growth:{TECHNICAL:1.7,SPEED:1.6,COMMUNICATION:0.6,INVESTIGATION:1.7,PATIENCE:0.9,AUTOMATION:3.1,MANAGEMENT:1.1},
      perks:{ idle:0.40, sat:-0.15 },
      art:{ skin:'#F3D2AE', hair:'#5B4EE0', hairStyle:'spiky', shirt:'#2F3A57', accent:'#4FD6C9', glasses:true, headset:true, beard:false },
      cost:4500, repReq:250, hireable:true
    },
    {
      id:'firefighter', name:'THE FIREFIGHTER', role:'Incident Specialist', rarity:'EPIC', roleKey:'SPECIALIST', icon:'🚒',
      strength:'+50% critical incident rewards',
      weakness:'Runs hot — no use to you on the quiet days',
      personality:'Calm in a crisis, unbearable on a quiet Tuesday. Keeps a go-bag under the desk.',
      quotes:['"Everyone breathe. I have got this."','"Sev-1? Finally."','"Stop typing. Tell me what changed."'],
      base:{TECHNICAL:14,SPEED:18,COMMUNICATION:10,INVESTIGATION:15,PATIENCE:5,AUTOMATION:6,MANAGEMENT:11},
      growth:{TECHNICAL:2.1,SPEED:2.9,COMMUNICATION:1.4,INVESTIGATION:2.4,PATIENCE:0.7,AUTOMATION:0.9,MANAGEMENT:1.6},
      perks:{ incident:0.50, energy:0.35 },
      art:{ skin:'#C98A5E', hair:'#1E1A19', hairStyle:'fade', shirt:'#E04F4F', accent:'#8E2F2F', glasses:false, headset:true, beard:false },
      cost:6000, repReq:500, hireable:true
    },
    {
      id:'intern', name:'THE INTERN', role:'Trainee', rarity:'COMMON', roleKey:'TECHNICIAN', icon:'🐣',
      strength:'Gains 60% more XP from everything',
      weakness:'Low starting stats. Very low.',
      personality:'Enthusiastic. Asks "why" until you question your career. Will be terrifying in two years.',
      quotes:['"Should I write a knowledge base article about this?"','"Wait, why do we do it that way?"','"I fixed it! ...I think I fixed it."'],
      base:{TECHNICAL:5,SPEED:8,COMMUNICATION:9,INVESTIGATION:7,PATIENCE:11,AUTOMATION:5,MANAGEMENT:3},
      growth:{TECHNICAL:1.6,SPEED:1.5,COMMUNICATION:1.6,INVESTIGATION:1.5,PATIENCE:1.6,AUTOMATION:1.4,MANAGEMENT:0.9},
      perks:{ xp:0.60 },
      art:{ skin:'#F6D6B8', hair:'#C87F3A', hairStyle:'cap', shirt:'#5FD37A', accent:'#3E9455', glasses:true, headset:false, beard:false },
      cost:300, repReq:0, hireable:true
    },
    {
      id:'nightowl', name:'THE NIGHT OWL', role:'Infrastructure Engineer', rarity:'RARE', roleKey:'AUTOMATION', icon:'🦉',
      strength:'+35% idle credits — does the maintenance window nobody wants',
      weakness:'-20% on active tickets before 11am',
      personality:'Communicates entirely in change tickets. Has never been seen in daylight.',
      quotes:['"Change window is 02:00. See you never."','"It is stable. Do not look at it."','"Morning is a social construct."'],
      base:{TECHNICAL:15,SPEED:8,COMMUNICATION:3,INVESTIGATION:14,PATIENCE:12,AUTOMATION:13,MANAGEMENT:6},
      growth:{TECHNICAL:2.4,SPEED:1.1,COMMUNICATION:0.5,INVESTIGATION:2.2,PATIENCE:1.8,AUTOMATION:2.1,MANAGEMENT:1.0},
      perks:{ idleCredit:0.35, power:-0.08 },
      art:{ skin:'#D9A97E', hair:'#2C2438', hairStyle:'long', shirt:'#3B3357', accent:'#6B5FA8', glasses:true, headset:true, beard:false },
      cost:3200, repReq:150, hireable:true
    },
    {
      id:'hawk', name:'THE SECURITY HAWK', role:'Cybersecurity Lead', rarity:'LEGENDARY', roleKey:'SPECIALIST', icon:'🦅',
      strength:'+60% on security tickets, +25% incident success',
      weakness:'Blocks things. Constantly. -10% satisfaction.',
      personality:'Trusts nobody, including you, including this sentence. Loves a good log file.',
      quotes:['"That attachment is a crime scene."','"Who approved this? Nobody? Correct."','"I have already revoked it."'],
      base:{TECHNICAL:18,SPEED:12,COMMUNICATION:7,INVESTIGATION:20,PATIENCE:10,AUTOMATION:11,MANAGEMENT:12},
      growth:{TECHNICAL:2.8,SPEED:1.8,COMMUNICATION:1.0,INVESTIGATION:3.2,PATIENCE:1.5,AUTOMATION:1.8,MANAGEMENT:1.9},
      perks:{ cat_security:0.60, incidentSuccess:0.25, sat:-0.10 },
      art:{ skin:'#6E4630', hair:'#141414', hairStyle:'fade', shirt:'#1F2A44', accent:'#4FD6C9', glasses:true, headset:false, beard:true },
      cost:18000, repReq:2000, hireable:true
    },
    {
      id:'oracle', name:'THE ORACLE', role:'Principal Engineer', rarity:'MYTHIC', roleKey:'MANAGER', icon:'🔮',
      strength:'Every colleague learns 35% faster, +20% incident success, +15% reputation',
      weakness:'Does almost nothing themselves — and two Oracles do not manage each other',
      personality:'Nobody knows their job title. Nobody knows their manager. The outage stops when they arrive.',
      quotes:['"It was DNS. It was always DNS."','"Check the thing you did not check."','"I already fixed it. Yesterday."'],
      base:{TECHNICAL:16,SPEED:14,COMMUNICATION:14,INVESTIGATION:16,PATIENCE:14,AUTOMATION:14,MANAGEMENT:16},
      growth:{TECHNICAL:2.1,SPEED:1.9,COMMUNICATION:1.9,INVESTIGATION:2.1,PATIENCE:1.9,AUTOMATION:2.0,MANAGEMENT:2.2},
      perks:{ staffXp:0.35, incidentSuccess:0.20, rep:0.15 },
      art:{ skin:'#EBC49A', hair:'#E8ECF7', hairStyle:'long', shirt:'#4A2E70', accent:'#C08BFF', glasses:false, headset:false, beard:true },
      cost:90000, repReq:10000, hireable:true
    },
  ];

  /* ---------- EQUIPMENT ---------- */
  const SLOTS = [
    { key:'laptop',   label:'Laptop',    icon:'💻' },
    { key:'monitor',  label:'Monitor',   icon:'🖥️' },
    { key:'keyboard', label:'Keyboard',  icon:'⌨️' },
    { key:'mouse',    label:'Mouse',     icon:'🖱️' },
    { key:'headset',  label:'Headset',   icon:'🎧' },
    { key:'toolkit',  label:'IT Toolkit',icon:'🧰' },
    { key:'nettools', label:'Net Tools', icon:'🔌' },
    { key:'badge',    label:'Badge',     icon:'🪪' },
    { key:'backpack', label:'Backpack',  icon:'🎒' },
  ];

  const EQUIPMENT = [
    { id:'lap_basic',  slot:'laptop',   name:'Refurbished Fleet Laptop', rarity:'COMMON',
      stats:{TECHNICAL:3,SPEED:1}, effect:'Boots in under four minutes on a good day.' },
    { id:'lap_think',  slot:'laptop',   name:'ThinkBrick T-5000', rarity:'RARE',
      stats:{TECHNICAL:9,SPEED:5,PATIENCE:3}, effect:'Survived a coffee incident and a stairwell.' },
    { id:'lap_dev',    slot:'laptop',   name:'Unapproved Developer Laptop', rarity:'EPIC',
      stats:{TECHNICAL:16,SPEED:12,AUTOMATION:8}, effect:'+8% credits. Security does not know about it.', perks:{credit:0.08} },
    { id:'mon_ultra',  slot:'monitor',  name:'Ultrawide of Wisdom', rarity:'EPIC',
      stats:{INVESTIGATION:14,TECHNICAL:6}, effect:'+10% XP. You can see the whole log at last.', perks:{xp:0.10} },
    { id:'mon_old',    slot:'monitor',  name:'The 2011 Spare Monitor', rarity:'COMMON',
      stats:{INVESTIGATION:3}, effect:'Slight green tint. Everyone looks unwell.' },
    { id:'kb_mech',    slot:'keyboard', name:'Mechanical Keyboard of Mild Aggression', rarity:'RARE',
      stats:{SPEED:10,PATIENCE:-2,TECHNICAL:3}, effect:'Open plan colleagues have filed a complaint.' },
    { id:'kb_sticky',  slot:'keyboard', name:'Keyboard With A Sticky G', rarity:'COMMON',
      stats:{SPEED:2}, effect:'You have learned to type around it.' },
    { id:'mou_ergo',   slot:'mouse',    name:'Ergonomic Mouse of Wrist Salvation', rarity:'UNCOMMON',
      stats:{SPEED:5,PATIENCE:5}, effect:'Your future self says thank you.' },
    { id:'head_anc',   slot:'headset',  name:'Noise-Cancelling Sanity Preserver', rarity:'EPIC',
      stats:{PATIENCE:14,COMMUNICATION:8}, effect:'+12% user satisfaction. You can actually hear them.', perks:{sat:0.12} },
    { id:'head_cheap', slot:'headset',  name:'Reception Spare Headset', rarity:'COMMON',
      stats:{COMMUNICATION:3}, effect:'One ear works. It is enough.' },
    { id:'tool_dongle',slot:'toolkit',  name:'The Dongle of Destiny', rarity:'LEGENDARY',
      stats:{TECHNICAL:18,INVESTIGATION:10,SPEED:8},
      effect:'"Have you tried unplugging it?" Auto-resolves 12% of display tickets instantly.', perks:{autoDisplay:0.12, cat_display:0.50} },
    { id:'tool_screw', slot:'toolkit',  name:'Screwdriver of Last Resort', rarity:'UNCOMMON',
      stats:{TECHNICAL:6,PATIENCE:4}, effect:'Also a lever, a chisel and a letter opener.' },
    { id:'tool_usb',   slot:'toolkit',  name:'The Sacred USB Stick', rarity:'RARE',
      stats:{TECHNICAL:8,AUTOMATION:7}, effect:'Contains every installer ever made. Do not lose it.' },
    { id:'net_crimp',  slot:'nettools', name:'Crimping Tool of Doom', rarity:'RARE',
      stats:{TECHNICAL:9,INVESTIGATION:6}, effect:'+15% on network tickets.', perks:{cat_network:0.15} },
    { id:'net_tester', slot:'nettools', name:'Cable Tester That Actually Works', rarity:'EPIC',
      stats:{INVESTIGATION:15,TECHNICAL:7}, effect:'+25% on network tickets. Ends every argument.', perks:{cat_network:0.25} },
    { id:'badge_all',  slot:'badge',    name:'The Badge That Opens Every Door', rarity:'LEGENDARY',
      stats:{SPEED:16,MANAGEMENT:10}, effect:'+20% on VIP and executive tickets. Nobody has revoked it.', perks:{cat_vip:0.20} },
    { id:'badge_temp', slot:'badge',    name:'Temporary Visitor Badge', rarity:'COMMON',
      stats:{SPEED:2}, effect:'Expired in 2023. Still scans. Nobody asks.' },
    { id:'bag_cables', slot:'backpack', name:'Backpack of Infinite Cables', rarity:'EPIC',
      stats:{TECHNICAL:8,PATIENCE:10,INVESTIGATION:6}, effect:'+10% hardware tickets. It has the adapter. It always has the adapter.', perks:{cat_hardware:0.10} },
    { id:'bag_basic',  slot:'backpack', name:'Conference Freebie Bag', rarity:'COMMON',
      stats:{PATIENCE:3}, effect:'Branded by a vendor that no longer exists.' },
    { id:'mou_gaming', slot:'mouse',    name:'Twelve-Button Gaming Mouse', rarity:'RARE',
      stats:{SPEED:11,AUTOMATION:5}, effect:'Eleven buttons are unbound. One opens the calculator.' },
    { id:'kb_ergo',    slot:'keyboard', name:'Split Ergonomic Keyboard', rarity:'EPIC',
      stats:{SPEED:13,PATIENCE:9,COMMUNICATION:4}, effect:'Nobody else can use your desk. That is the feature.' },
    { id:'mon_curve',  slot:'monitor',  name:'Curved Executive Reject Monitor', rarity:'RARE',
      stats:{INVESTIGATION:8,MANAGEMENT:5}, effect:'Rescued from a director\'s desk during a refresh.' },

    /* ---- Legendary: the kit people ask to borrow ---- */
    { id:'lap_legend',  slot:'laptop',   name:'The Laptop That Survived The Flood', rarity:'LEGENDARY',
      stats:{TECHNICAL:22,SPEED:16,PATIENCE:10},
      effect:'+15% credits. Water damage, dropped twice, still the fastest machine in the building.', perks:{credit:0.15} },
    { id:'mon_legend',  slot:'monitor',  name:'The Four-Screen Command Wall', rarity:'LEGENDARY',
      stats:{INVESTIGATION:24,TECHNICAL:10,MANAGEMENT:8},
      effect:'+18% XP. You can see the whole incident at once, which changes everything.', perks:{xp:0.18} },
    { id:'kb_legend',   slot:'keyboard', name:'The Keyboard With No Legends Left', rarity:'LEGENDARY',
      stats:{SPEED:24,TECHNICAL:9},
      effect:'+15% on software tickets. The letters wore off years ago. You do not need them.', perks:{cat_software:0.15} },
    { id:'mou_legend',  slot:'mouse',    name:'The Mouse With Thirty Thousand Miles', rarity:'LEGENDARY',
      stats:{SPEED:20,INVESTIGATION:10,PATIENCE:6},
      effect:'+12% on display tickets. It has clicked through every problem this company has ever had.', perks:{cat_display:0.12} },
    { id:'head_legend', slot:'headset',  name:'The Headset That Hears The Real Problem', rarity:'LEGENDARY',
      stats:{COMMUNICATION:22,PATIENCE:20},
      effect:'+20% user satisfaction. Users say more than they mean to, and you catch it.', perks:{sat:0.20} },
    { id:'net_legend',  slot:'nettools', name:'The Tester That Ends All Arguments', rarity:'LEGENDARY',
      stats:{INVESTIGATION:22,TECHNICAL:14},
      effect:'+35% on network tickets. It is never the network. Now you can prove it.', perks:{cat_network:0.35} },
    { id:'bag_legend',  slot:'backpack', name:'The Bag With The Right Adapter', rarity:'LEGENDARY',
      stats:{TECHNICAL:14,PATIENCE:16,INVESTIGATION:12},
      effect:'+20% on hardware tickets. Whatever it is, it is in the front pocket.', perks:{cat_hardware:0.20} },

    /* ---- Mythic: the endgame set. One per slot, and nobody signs these off
           until you are genuinely running the place. ---- */
    { id:'lap_myth',    slot:'laptop',   name:'THE MACHINE THAT NEVER NEEDS REBOOTING', rarity:'MYTHIC',
      stats:{TECHNICAL:40,SPEED:32,AUTOMATION:24,INVESTIGATION:20},
      effect:'+25% to everything you earn. Uptime measured in years. Nobody knows what is running on it.',
      perks:{ all:0.25 } },
    { id:'mon_myth',    slot:'monitor',  name:'THE GLASS THAT SHOWS THE ROOT CAUSE', rarity:'MYTHIC',
      stats:{INVESTIGATION:46,TECHNICAL:22,MANAGEMENT:16},
      effect:'+40% XP and +25% incident success. Every dashboard you ever needed, already open.',
      perks:{ xp:0.40, incidentSuccess:0.25 } },
    { id:'kb_myth',     slot:'keyboard', name:'THE KEYBOARD THAT TYPES WHAT YOU MEANT', rarity:'MYTHIC',
      stats:{SPEED:44,TECHNICAL:26,AUTOMATION:18},
      effect:'+30% ticket rewards. No typos, no retries, no second attempt at the command.',
      perks:{ reward:0.30 } },
    { id:'mou_myth',    slot:'mouse',    name:'THE MOUSE THAT CLICKS FIRST', rarity:'MYTHIC',
      stats:{SPEED:42,INVESTIGATION:22,PATIENCE:14},
      effect:'+35% more time on every ticket. It gets there before you decide to move it.',
      perks:{ sla:0.35 } },
    { id:'head_myth',   slot:'headset',  name:'THE HEADSET THAT FILTERS OUT COMPLAINING', rarity:'MYTHIC',
      stats:{COMMUNICATION:44,PATIENCE:38},
      effect:'+45% user satisfaction. You hear the fault. You do not hear the sighing.',
      perks:{ sat:0.45 } },
    { id:'tool_myth',   slot:'toolkit',  name:'THE TOOLKIT OF LAST RESORT', rarity:'MYTHIC',
      stats:{TECHNICAL:44,INVESTIGATION:30,SPEED:20},
      effect:'Auto-resolves 30% of display tickets and +40% on hardware. There is nothing in here you have not fixed something with.',
      perks:{ autoDisplay:0.30, cat_hardware:0.40 } },
    { id:'net_myth',    slot:'nettools', name:'THE CABLE THAT KNOWS WHERE IT GOES', rarity:'MYTHIC',
      stats:{INVESTIGATION:40,TECHNICAL:30,AUTOMATION:16},
      effect:'+60% on network and +50% incident rewards. It has been in every riser in the building.',
      perks:{ cat_network:0.60, incident:0.50 } },
    { id:'badge_myth',  slot:'badge',    name:'THE BADGE NOBODY DARES QUESTION', rarity:'MYTHIC',
      stats:{SPEED:36,MANAGEMENT:34,COMMUNICATION:20},
      effect:'+50% on executive tickets and +40% reputation. Opens the server room, the boardroom and the good coffee.',
      perks:{ cat_vip:0.50, rep:0.40 } },
    { id:'bag_myth',    slot:'backpack', name:'THE BAG THAT CONTAINS EVERYTHING', rarity:'MYTHIC',
      stats:{TECHNICAL:32,PATIENCE:34,INVESTIGATION:26,AUTOMATION:14},
      effect:'+45% idle output. Whatever the job turns out to be, you already brought it.',
      perks:{ idle:0.45 } },
  ];

  /* ---------- PROCUREMENT ----------
     What the budget will stretch to. Better kit needs standing before finance
     will sign it off, which is exactly how it works in real life. */
  const PROCURE = {
    price: { COMMON: 400, UNCOMMON: 1600, RARE: 7000, EPIC: 34000, LEGENDARY: 160000, MYTHIC: 800000 },
    repReq: { COMMON: 0, UNCOMMON: 0, RARE: 250, EPIC: 1500, LEGENDARY: 8000, MYTHIC: 40000 },
    disposeShare: 0.45,        // of what it would cost to buy new
  };

  /* ---------- OFFICE / BUILDINGS ---------- */
  const BUILDINGS = [
    { id:'helpdesk',   name:'Helpdesk Counter',        icon:'🛎️', base:150,   growth:1.55, max:20, repReq:0,
      effect:'+8% ticket resolution rewards per level', key:'reward', per:0.08 },
    { id:'knowledge',  name:'Knowledge Base',          icon:'📚', base:400,   growth:1.58, max:20, repReq:0,
      effect:'+6% XP generation per level',            key:'xp', per:0.06 },
    { id:'hardware',   name:'Hardware Room',           icon:'🧰', base:900,   growth:1.60, max:15, repReq:100,
      effect:'+10% hardware ticket rewards per level', key:'cat_hardware', per:0.10 },
    { id:'break',      name:'Break Room',              icon:'☕', base:1400,  growth:1.62, max:15, repReq:150,
      effect:'+2 tickets an hour per level',           key:'quota', per:2 },
    { id:'training',   name:'Training Room',           icon:'🎓', base:2600,  growth:1.64, max:15, repReq:300,
      effect:'+10% employee XP per level',             key:'staffXp', per:0.10 },
    { id:'meeting',    name:'Meeting Room',            icon:'📽️', base:5000,  growth:1.66, max:12, repReq:500,
      effect:'+12% reputation gain per level',         key:'rep', per:0.12 },
    { id:'server',     name:'Server Room',             icon:'🗄️', base:11000, growth:1.68, max:12, repReq:800,
      effect:'+20% automation power per level',        key:'automation', per:0.20 },
    { id:'noc',        name:'Network Operations Centre',icon:'📡', base:26000, growth:1.70, max:12, repReq:1500,
      effect:'+18% idle income per level',             key:'idle', per:0.18 },
    { id:'soc',        name:'Security Operations Centre',icon:'🛡️',base:60000, growth:1.72, max:10, repReq:3000,
      effect:'+20% incident rewards per level',        key:'incident', per:0.20 },
    { id:'autolab',    name:'Automation Lab',          icon:'⚙️', base:140000,growth:1.74, max:10, repReq:6000,
      effect:'+25% idle income and +1h offline cap per level', key:'idle', per:0.25 },
    { id:'aicentre',   name:'AI Support Centre',       icon:'🧠', base:320000,growth:1.76, max:10, repReq:12000,
      effect:'+30% to all credits per level',          key:'credit', per:0.30 },
    { id:'reghq',      name:'Regional Headquarters',   icon:'🏙️', base:750000,growth:1.80, max:8,  repReq:25000,
      effect:'+25% to everything per level',           key:'all', per:0.25 },
  ];

  /* ---------- CAREER RANKS ----------
     A level is a number; a rank is a moment. Crossing one changes the title,
     bumps stats and is worth stopping to look at.                          */
  const RANKS_STAFF = [
    { at:1,  name:'Junior Technician', short:'JR',   colour:'#8A93AD' },
    { at:11, name:'Technician',        short:'TECH', colour:'#5FD37A' },
    { at:21, name:'Senior Technician', short:'SNR',  colour:'#4FA8FF' },
    { at:31, name:'Specialist',        short:'SPEC', colour:'#B67CFF' },
    { at:41, name:'Team Lead',         short:'LEAD', colour:'#FFB347' },
    { at:51, name:'Manager',           short:'MGR',  colour:'#FF9A5F' },
    { at:61, name:'Director',          short:'DIR',  colour:'#FF5A9E' },
  ];
  const staffRank = lvl => {
    let r = RANKS_STAFF[0];
    RANKS_STAFF.forEach(x => { if (lvl >= x.at) r = x; });
    return r;
  };
  const nextStaffRank = lvl => RANKS_STAFF.find(x => lvl < x.at) || null;

  /* ---------- ROLES ----------
     Five jobs, five reasons to hire. None is simply a better version of
     another: a team of five Specialists closes hard tickets and starves.   */
  const ROLES = {
    TECHNICIAN: { key:'TECHNICIAN', name:'Technician', icon:'🔧', colour:'#5FD37A',
      blurb:'The backbone. Gets through ordinary tickets faster than anyone.',
      perk:'+25% on easy and medium tickets' },
    SPECIALIST: { key:'SPECIALIST', name:'Specialist', icon:'🎯', colour:'#B67CFF',
      blurb:'Wasted on a printer. Worth their salary the moment something big breaks.',
      perk:'+35% on hard tickets and critical incidents' },
    SUPPORT:    { key:'SUPPORT',    name:'Support',    icon:'💬', colour:'#4FA8FF',
      blurb:'Keeps the department liked, which is worth more than it sounds.',
      perk:'+30% user satisfaction, and morale falls slower' },
    AUTOMATION: { key:'AUTOMATION', name:'Automation', icon:'🤖', colour:'#4FD6C9',
      blurb:'Works the queue while everybody sleeps.',
      perk:'+35% idle throughput' },
    MANAGER:    { key:'MANAGER',    name:'Manager',    icon:'📋', colour:'#FFB347',
      blurb:'Produces nothing alone. Makes everybody around them better.',
      perk:'+10% output to every other member of staff' },
  };

  /* ---------- DEPARTMENT CHAPTERS ----------
     The spine of the game. Each chapter caps how many people you can carry and
     how far they can be developed, so the question is never "how many can I
     collect" but "who are the best five".                                   */
  const CHAPTERS = [
    { n:1, name:'Small Helpdesk',  icon:'🛎️', capacity:5,  maxLevel:20,
      goal:'Build a helpdesk that can be relied on.',
      objectives:[
        { id:'tickets', text:'Resolve {n} tickets',        metric:'tickets',   target:400 },
        { id:'power',   text:'Reach {n} team power',       metric:'power',     target:6000 },
        { id:'sat',     text:'Hold morale at {n}%',        metric:'morale',    target:70 },
      ],
      unlocks:'Corporate IT — ten staff, and the Infrastructure department' },
    { n:2, name:'Corporate IT',    icon:'🏢', capacity:10, maxLevel:30,
      goal:'Support a company that keeps growing.',
      objectives:[
        { id:'tickets', text:'Resolve {n} tickets',        metric:'tickets',   target:2500 },
        { id:'power',   text:'Reach {n} team power',       metric:'power',     target:25000 },
        { id:'auto',    text:'Reach {n} tickets an hour on the automated queue', metric:'idle', target:1200 },
      ],
      unlocks:'Regional IT — twenty staff, and Cybersecurity' },
    { n:3, name:'Regional IT',     icon:'🏙️', capacity:20, maxLevel:40,
      goal:'Hold several offices together at once.',
      objectives:[
        { id:'tickets', text:'Resolve {n} tickets',        metric:'tickets',   target:12000 },
        { id:'power',   text:'Reach {n} team power',       metric:'power',     target:90000 },
        { id:'inc',     text:'Win {n} critical incidents', metric:'incidents', target:30 },
      ],
      unlocks:'Global IT — thirty staff, Cloud and Automation' },
    { n:4, name:'Global IT',       icon:'🌍', capacity:30, maxLevel:50,
      goal:'Run it everywhere, at every hour.',
      objectives:[
        { id:'tickets', text:'Resolve {n} tickets',        metric:'tickets',   target:60000 },
        { id:'power',   text:'Reach {n} team power',       metric:'power',     target:400000 },
        { id:'rep',     text:'Reach {n} reputation',       metric:'rep',       target:50000 },
      ],
      unlocks:'IT Empire — fifty staff, and the ceiling comes off at level 70' },
    { n:5, name:'IT Empire',       icon:'👑', capacity:50, maxLevel:70,
      goal:'An IT organisation that mostly runs itself.',
      objectives:[
        { id:'tickets', text:'Resolve {n} tickets',        metric:'tickets',   target:250000 },
        { id:'power',   text:'Reach {n} team power',       metric:'power',     target:2000000 },
        { id:'rep',     text:'Reach {n} reputation',       metric:'rep',       target:250000 },
      ],
      unlocks:null },
  ];

  /* A letter for the department, from team power against the chapter target. */
  const DEPT_GRADES = [
    { at:1.60, g:'S' }, { at:1.15, g:'A' }, { at:0.80, g:'B' },
    { at:0.50, g:'C' }, { at:0.25, g:'D' }, { at:0,    g:'E' },
  ];

  /* ---------- DEPARTMENTS ----------
     Where you post people decides what the automated queue produces. Each
     department leans on one stat, so posting the right person matters as much
     as posting anybody: a People Person on the front line is worth far more
     than an Automation Expert there, and the other way round.               */
  const DEPARTMENTS = [
    { id:'support',  name:'IT Support',     icon:'🛎️', stat:'COMMUNICATION',
      stats:['COMMUNICATION','PATIENCE'], repReq:0,
      effect:'credits', per:0.45,
      bonus:'+45% idle credits',
      blurb:'The front line. Steady money from a queue that never stops. Suits people skills or deep patience.' },
    { id:'infra',    name:'Infrastructure', icon:'🗄️',  stat:'TECHNICAL',
      stats:['TECHNICAL','SPEED'], repReq:400,
      effect:'rate', per:0.30,
      bonus:'+30% tickets an hour',
      blurb:'Keeps the lights on. More gets closed per hour.' },
    { id:'security', name:'Cybersecurity',  icon:'🛡️', stat:'INVESTIGATION',
      stats:['INVESTIGATION','MANAGEMENT'], repReq:1200,
      effect:'reputation', per:0.90,
      bonus:'+90% idle reputation',
      blurb:'Quietly making you look good upstairs.' },
    { id:'auto',     name:'Automation',     icon:'🤖', stat:'AUTOMATION',
      stats:['AUTOMATION'], repReq:2500,
      effect:'xp', per:0.85,
      bonus:'+85% experience from the queue',
      blurb:'Scripts that work all night, and a team that learns from every one of them.' },
  ];

  /* ---------- MISSIONS ---------- */
  /* Daily missions come in three weights. The hard ones are meant to take
     most of a day's allowance, not ten minutes. */
  const MISSION_POOL = [
    { id:'m_tickets',  text:'Resolve {n} tickets',                 metric:'tickets',    base:20, icon:'🎫' },
    { id:'m_hardware', text:'Resolve {n} hardware tickets',        metric:'cat_hardware',base:8, icon:'🧰' },
    { id:'m_network',  text:'Resolve {n} network tickets',         metric:'cat_network', base:6, icon:'📶' },
    { id:'m_credits',  text:'Earn {n} IT Credits',                 metric:'credits',    base:1500,icon:'💰' },
    { id:'m_xp',       text:'Earn {n} XP',                         metric:'xp',         base:900, icon:'⭐' },
    { id:'m_incident', text:'Complete {n} critical incidents',     metric:'incidents',  base:1,  icon:'🚨' },
    { id:'m_upgrade',  text:'Upgrade an employee {n} times',       metric:'levelups',   base:2,  icon:'📈' },
    { id:'m_build',    text:'Upgrade the office {n} times',        metric:'builds',     base:1,  icon:'🏢' },
    { id:'m_sat',      text:'Get {n} happy users',                 metric:'happy',      base:12, icon:'😊' },
    { id:'m_perfect',  text:'Resolve {n} tickets without a failure',metric:'streak',    base:10, icon:'🔥' },
    { id:'m_bigrun',   text:'Resolve {n} tickets',                  metric:'tickets',   base:90,  icon:'🎫', tier:'hard' },
    { id:'m_bigcred',  text:'Earn {n} IT Credits',                  metric:'credits',   base:25000,icon:'💰', tier:'hard' },
    { id:'m_bigxp',    text:'Earn {n} XP',                          metric:'xp',        base:12000,icon:'⭐', tier:'hard' },
    { id:'m_bigdiag',  text:'Name the right cause {n} times',       metric:'diagnosed', base:8,   icon:'🔍', tier:'hard' },
    { id:'m_bigincid', text:'Win {n} critical incidents',           metric:'incidents', base:4,   icon:'🚨', tier:'hard' },
    { id:'m_bigstreak',text:'Hit a {n}-ticket clean streak',        metric:'streak',    base:35,  icon:'🔥', tier:'hard' },
    { id:'m_bighappy', text:'Send {n} users away happy',            metric:'happy',     base:60,  icon:'😊', tier:'hard' },
    { id:'m_bigbuild', text:'Upgrade the office {n} times',         metric:'builds',    base:4,   icon:'🏢', tier:'hard' },
    { id:'m_diag',     text:'Name the right cause {n} times',        metric:'diagnosed', base:3,  icon:'🔍' },
    { id:'m_deleg',    text:'Hand {n} tickets to a colleague',       metric:'delegated', base:5,  icon:'👥' },
  ];

  /* ---------- ACHIEVEMENTS ---------- */
  const ACHIEVEMENTS = [
    { id:'a_first',    name:'FIRST TICKET',       desc:'Resolve your first ticket.',            metric:'tickets',   target:1,      rep:10 },
    { id:'a_hundred',  name:'CENTURION',          desc:'Resolve 100 tickets.',                  metric:'tickets',   target:100,    rep:50 },
    { id:'a_printer',  name:'PRINTER WHISPERER',  desc:'Resolve 100 hardware tickets.',         metric:'cat_hardware',target:100,  rep:80 },
    { id:'a_monitor',  name:'MONITOR WIZARD',     desc:'Resolve 100 display issues.',           metric:'cat_display',target:100,   rep:80 },
    { id:'a_monday',   name:'MONDAY SURVIVOR',    desc:'Live through a Monday Morning event.',  metric:'monday',    target:1,      rep:60 },
    { id:'a_incident', name:'CRISIS MANAGER',     desc:'Win 10 critical incidents.',            metric:'incidents', target:10,     rep:200 },
    { id:'a_legend',   name:'IT LEGEND',          desc:'Reach 10,000 reputation.',              metric:'rep',       target:10000,  rep:500 },
    { id:'a_army',     name:'ONE MAN ARMY',       desc:'Resolve 10,000 tickets.',               metric:'tickets',   target:10000,  rep:1000 },
    { id:'a_auto',     name:'AUTOMATION ADDICT',  desc:'Have 6 employees working the idle queue.',metric:'staff',   target:6,      rep:250 },
    { id:'a_rich',     name:'BUDGET APPROVED',    desc:'Hold 1,000,000 IT Credits at once.',    metric:'peak',      target:1000000,rep:400 },
    { id:'a_reorg',    name:'REORGANISED',        desc:'Complete your first IT Reorganisation.',metric:'reorgs',    target:1,      rep:1000 },
    { id:'a_gear',     name:'FULLY EQUIPPED',     desc:'Own 12 pieces of equipment.',           metric:'gear',      target:12,     rep:120 },
    { id:'a_diag',     name:'IT IS ALWAYS DNS',   desc:'Name the right cause 25 times.',        metric:'diagnosed', target:25,     rep:300 },
    { id:'a_deleg',    name:'THAT IS WHAT A TEAM IS FOR', desc:'Hand 100 tickets to colleagues.', metric:'delegated', target:100,   rep:200 },
    { id:'a_flow',     name:'IN THE ZONE',        desc:'Reach full momentum.',                  metric:'maxmomentum', target:100,  rep:150 },
    { id:'a_maxed',    name:'FULLY QUALIFIED',    desc:'Take a colleague all the way to level 80.', metric:'maxedstaff', target:1,  rep:600 },
  ];

  /* ---------- LEGACY (PRESTIGE) UPGRADES ---------- */
  const LEGACY = [
    { id:'l_xp',    name:'Institutional Memory', icon:'🧠', desc:'+10% XP generation per point',        per:0.10, max:20 },
    { id:'l_cred',  name:'Budget Authority',     icon:'💰', desc:'+10% ticket credits per point',       per:0.10, max:20 },
    { id:'l_idle',  name:'Runbook Library',      icon:'📗', desc:'+15% idle efficiency per point',      per:0.15, max:20 },
    { id:'l_growth',name:'Talent Pipeline',      icon:'🌱', desc:'+8% employee growth per point',       per:0.08, max:20 },
    { id:'l_auto',  name:'Self-Healing Systems', icon:'🤖', desc:'+12% automation per point',           per:0.12, max:20 },
  ];

  /* ---------- WORLD ---------- */
  const WORLD = [
    { id:'sg', name:'Singapore',      icon:'🇸🇬', repReq:0,      note:'Home office. Humid server room. Excellent food court.' },
    { id:'tk', name:'Tokyo',          icon:'🇯🇵', repReq:5000,   note:'Immaculate cable management. Zero tolerance for downtime.' },
    { id:'ln', name:'London',         icon:'🇬🇧', repReq:15000,  note:'Legacy systems from every decade, all still running.' },
    { id:'ny', name:'New York',       icon:'🇺🇸', repReq:40000,  note:'Trading floor. Every ticket is a Sev-1.' },
    { id:'sy', name:'Sydney',         icon:'🇦🇺', repReq:90000,  note:'On-call rota that ruins your timezone.' },
    { id:'db', name:'Dubai',          icon:'🇦🇪', repReq:200000, note:'Executive floor. Marble. Gold-plated dongles.' },
    { id:'sf', name:'San Francisco',  icon:'🇺🇸', repReq:500000, note:'Everyone is a developer with local admin. Good luck.' },
  ];

  return { TABS, RARITY, STATS, STAT_ICON, TITLES, RANKS, TICKETS, SLA, SLA_URGENT, DIAGNOSE_CHANCE, DIAGNOSE_MIN, DIAGNOSE_MAX, DIAGNOSE_PITY, QUOTA, MAX_CHAR_LEVEL, RANKS_STAFF, staffRank, nextStaffRank,
           ROLES, CHAPTERS, DEPT_GRADES, PROCURE, TICKET_FLAVOUR, SAT_FAILS, SAT_WINS,
           INCIDENTS, EVENTS, CHARACTERS, SLOTS, EQUIPMENT, BUILDINGS, DEPARTMENTS,
           MISSION_POOL, ACHIEVEMENTS, LEGACY, WORLD };
})();

/* ============================================================
   CHARACTER CREATION — the choices that make your technician yours.
   ============================================================ */
const CREATOR = {
  skin:  ['#F6D6B8', '#F1C398', '#E0A870', '#C98A5E', '#8D5A3B', '#6E4630'],
  hair:  ['#241A18', '#3A2A22', '#6B4A2F', '#C87F3A', '#E3C88A', '#B9BFCB', '#5B4EE0', '#E0715F'],
  shirt: ['#3D6FE0', '#E0715F', '#5FD37A', '#B67CFF', '#4FD6C9', '#F0A93C', '#2F3A57', '#D14D8B'],
  styles: [
    { key: 'short', label: 'Short' }, { key: 'spiky', label: 'Spiky' },
    { key: 'fade',  label: 'Fade'  }, { key: 'bun',   label: 'Bun'   },
    { key: 'long',  label: 'Long'  }, { key: 'cap',   label: 'Cap'   },
  ],

  /* Your starting path. Permanent, and different enough that two friends
     playing side by side end up with genuinely different departments. */
  specs: [
    {
      id: 'fixer', name: 'THE FIXER', icon: '🔧',
      tag: 'Hands-on hardware',
      blurb: 'You would rather open the laptop than read the ticket. Cables fear you.',
      strength: '+20% on hardware and display tickets',
      weakness: 'Automation comes slowly to you (−10% idle)',
      perks: { cat_hardware: 0.20, cat_display: 0.20, idle: -0.10 },
      stats: { TECHNICAL: 4, PATIENCE: 3 },
      kit: 'tool_screw',
    },
    {
      id: 'diplomat', name: 'THE DIPLOMAT', icon: '💬',
      tag: 'Service desk',
      blurb: 'You calm people down before you fix anything. Users ask for you by name.',
      strength: '+25% user satisfaction, +15% reputation',
      weakness: 'Raw technical power comes later (−8% power)',
      perks: { sat: 0.25, rep: 0.15, power: -0.08 },
      stats: { COMMUNICATION: 5, PATIENCE: 3 },
      kit: 'head_cheap',
    },
    {
      id: 'scripter', name: 'THE SCRIPTER', icon: '🤖',
      tag: 'Automation',
      blurb: 'You solved it once, then made sure you never have to solve it again.',
      strength: '+30% idle output, +15% XP',
      weakness: 'The script never says good morning (−12% satisfaction)',
      perks: { idle: 0.30, xp: 0.15, sat: -0.12 },
      stats: { AUTOMATION: 5, TECHNICAL: 2 },
      kit: 'tool_usb',
    },
    {
      id: 'analyst', name: 'THE ANALYST', icon: '🔍',
      tag: 'Network & security',
      blurb: 'You read the logs. All of them. You have opinions about the firewall.',
      strength: '+20% network and security tickets, +20% incident success',
      weakness: 'Slower on the simple stuff (−8% speed)',
      perks: { cat_network: 0.20, cat_security: 0.20, incidentSuccess: 0.20 },
      stats: { INVESTIGATION: 5, TECHNICAL: 2 },
      kit: 'net_crimp',
    },
  ],
};
DATA.CREATOR = CREATOR;
DATA.spec = id => CREATOR.specs.find(s => s.id === id) || CREATOR.specs[0];
