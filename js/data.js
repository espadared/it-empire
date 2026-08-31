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
     stat: the stat that decides technical success                       */
  const TICKETS = {
    EASY: [
      { name:'Printer Offline',            cat:'hardware', stat:'PATIENCE',      icon:'🖨️', user:'Reception' },
      { name:'Wi-Fi Not Connected',        cat:'network',  stat:'TECHNICAL',     icon:'📶', user:'Sales' },
      { name:'No Audio In Headset',        cat:'hardware', stat:'INVESTIGATION', icon:'🎧', user:'Support' },
      { name:'Monitor Not Detected',       cat:'display',  stat:'TECHNICAL',     icon:'🖥️', user:'Finance' },
      { name:'Keyboard Not Working',       cat:'hardware', stat:'PATIENCE',      icon:'⌨️', user:'HR' },
      { name:'Password Expired',           cat:'access',   stat:'COMMUNICATION', icon:'🔑', user:'Marketing' },
      { name:'Screen Is Upside Down',      cat:'display',  stat:'COMMUNICATION', icon:'🙃', user:'Legal' },
      { name:'Laptop "Very Slow"',         cat:'software', stat:'PATIENCE',      icon:'🐌', user:'Ops' },
      { name:'Mouse Battery Mystery',      cat:'hardware', stat:'INVESTIGATION', icon:'🖱️', user:'Design' },
      { name:'Cannot Find The Desktop',    cat:'software', stat:'COMMUNICATION', icon:'🗂️', user:'Reception' },
    ],
    MEDIUM: [
      { name:'VPN Failure',                cat:'network',  stat:'TECHNICAL',     icon:'🔐', user:'Remote Team' },
      { name:'Outlook Sync Problem',       cat:'software', stat:'INVESTIGATION', icon:'📧', user:'Sales' },
      { name:'Certificate Error',          cat:'security', stat:'TECHNICAL',     icon:'📜', user:'Finance' },
      { name:'BitLocker Recovery',         cat:'security', stat:'PATIENCE',      icon:'🔒', user:'Field Staff' },
      { name:'External Display Failure',   cat:'display',  stat:'TECHNICAL',     icon:'📺', user:'Meeting Rm 3' },
      { name:'Software Install Failure',   cat:'software', stat:'INVESTIGATION', icon:'💿', user:'Engineering' },
      { name:'Shared Drive Vanished',      cat:'network',  stat:'INVESTIGATION', icon:'📁', user:'Accounts' },
      { name:'MFA Device Lost',            cat:'access',   stat:'COMMUNICATION', icon:'📱', user:'New Joiner' },
      { name:'Ghost Audio In Meetings',    cat:'software', stat:'SPEED',         icon:'👻', user:'Product' },
      { name:'Docking Station Rebellion',  cat:'hardware', stat:'TECHNICAL',     icon:'🔌', user:'Consulting' },
    ],
    HARD: [
      { name:'Network Outage — Floor 4',   cat:'network',  stat:'INVESTIGATION', icon:'🌐', user:'Floor 4' },
      { name:'Server Failure',             cat:'network',  stat:'TECHNICAL',     icon:'🖴', user:'Infrastructure' },
      { name:'Cloud Service Failure',      cat:'network',  stat:'AUTOMATION',    icon:'☁️', user:'Everyone' },
      { name:'Security Incident',          cat:'security', stat:'INVESTIGATION', icon:'🛡️', user:'SecOps' },
      { name:'Executive Laptop Failure',   cat:'vip',      stat:'SPEED',         icon:'💼', user:'The CFO' },
      { name:'Meeting Room AV Meltdown',   cat:'vip',      stat:'SPEED',         icon:'📽️', user:'Board Room' },
      { name:'Domain Controller Down',     cat:'network',  stat:'TECHNICAL',     icon:'🏛️', user:'All Sites' },
      { name:'Suspicious Email Campaign',  cat:'security', stat:'MANAGEMENT',    icon:'🎣', user:'Whole Company' },
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
  ];

  /* ---------- CHARACTERS ---------- */
  /* base: stats at level 1. growth: gain per level. */
  const CHARACTERS = [
    {
      id:'hero', name:'JASON', role:'You', rarity:'RARE', icon:'🧑‍💻',
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
      id:'veteran', name:'THE VETERAN', role:'Hardware Specialist', rarity:'RARE', icon:'🔧',
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
      id:'people', name:'THE PEOPLE PERSON', role:'Customer Support', rarity:'UNCOMMON', icon:'💬',
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
      id:'automation', name:'THE AUTOMATION EXPERT', role:'Automation Specialist', rarity:'EPIC', icon:'🤖',
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
      id:'firefighter', name:'THE FIREFIGHTER', role:'Incident Specialist', rarity:'EPIC', icon:'🚒',
      strength:'+50% critical incident rewards',
      weakness:'Burns energy fast — high energy consumption',
      personality:'Calm in a crisis, unbearable on a quiet Tuesday. Keeps a go-bag under the desk.',
      quotes:['"Everyone breathe. I have got this."','"Sev-1? Finally."','"Stop typing. Tell me what changed."'],
      base:{TECHNICAL:14,SPEED:18,COMMUNICATION:10,INVESTIGATION:15,PATIENCE:5,AUTOMATION:6,MANAGEMENT:11},
      growth:{TECHNICAL:2.1,SPEED:2.9,COMMUNICATION:1.4,INVESTIGATION:2.4,PATIENCE:0.7,AUTOMATION:0.9,MANAGEMENT:1.6},
      perks:{ incident:0.50, energy:0.35 },
      art:{ skin:'#C98A5E', hair:'#1E1A19', hairStyle:'fade', shirt:'#E04F4F', accent:'#8E2F2F', glasses:false, headset:true, beard:false },
      cost:6000, repReq:500, hireable:true
    },
    {
      id:'intern', name:'THE INTERN', role:'Trainee', rarity:'COMMON', icon:'🐣',
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
      id:'nightowl', name:'THE NIGHT OWL', role:'Infrastructure Engineer', rarity:'RARE', icon:'🦉',
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
      id:'hawk', name:'THE SECURITY HAWK', role:'Cybersecurity Lead', rarity:'LEGENDARY', icon:'🦅',
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
      id:'oracle', name:'THE ORACLE', role:'Principal Engineer', rarity:'MYTHIC', icon:'🔮',
      strength:'+25% to absolutely everything',
      weakness:'Costs a fortune and answers only in riddles',
      personality:'Nobody knows their job title. Nobody knows their manager. The outage stops when they arrive.',
      quotes:['"It was DNS. It was always DNS."','"Check the thing you did not check."','"I already fixed it. Yesterday."'],
      base:{TECHNICAL:22,SPEED:18,COMMUNICATION:16,INVESTIGATION:22,PATIENCE:18,AUTOMATION:20,MANAGEMENT:20},
      growth:{TECHNICAL:3.2,SPEED:2.6,COMMUNICATION:2.4,INVESTIGATION:3.2,PATIENCE:2.6,AUTOMATION:3.0,MANAGEMENT:3.0},
      perks:{ all:0.25 },
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
  ];

  /* ---------- OFFICE / BUILDINGS ---------- */
  const BUILDINGS = [
    { id:'helpdesk',   name:'Helpdesk Counter',        icon:'🛎️', base:150,   growth:1.55, max:20, repReq:0,
      effect:'+8% ticket resolution rewards per level', key:'reward', per:0.08 },
    { id:'knowledge',  name:'Knowledge Base',          icon:'📚', base:400,   growth:1.58, max:20, repReq:0,
      effect:'+6% XP generation per level',            key:'xp', per:0.06 },
    { id:'hardware',   name:'Hardware Room',           icon:'🧰', base:900,   growth:1.60, max:15, repReq:100,
      effect:'+10% hardware ticket rewards per level', key:'cat_hardware', per:0.10 },
    { id:'break',      name:'Break Room',              icon:'☕', base:1400,  growth:1.62, max:15, repReq:150,
      effect:'+15% energy recovery per level',         key:'energyRegen', per:0.15 },
    { id:'training',   name:'Training Room',           icon:'🎓', base:2600,  growth:1.64, max:15, repReq:300,
      effect:'+10% employee XP per level',             key:'staffXp', per:0.10 },
    { id:'meeting',    name:'Meeting Room',            icon:'📽️', base:5000,  growth:1.66, max:12, repReq:500,
      effect:'+12% reputation gain per level',         key:'rep', per:0.12 },
    { id:'server',     name:'Server Room',             icon:'🖴', base:11000, growth:1.68, max:12, repReq:800,
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

  /* ---------- DEPARTMENTS (assignment targets) ---------- */
  const DEPARTMENTS = [
    { id:'support',  name:'IT Support',     icon:'🛎️', cats:['hardware','display','access'], repReq:0,    bonus:'Front line. Steady credits.' },
    { id:'infra',    name:'Infrastructure', icon:'🖴', cats:['network'],                     repReq:400,  bonus:'+20% idle credits for assigned staff.' },
    { id:'security', name:'Cybersecurity',  icon:'🛡️', cats:['security'],                    repReq:1200, bonus:'+25% incident contribution.' },
    { id:'auto',     name:'Automation',     icon:'🤖', cats:['software'],                    repReq:2500, bonus:'+35% idle ticket throughput.' },
  ];

  /* ---------- MISSIONS ---------- */
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

  return { RARITY, STATS, STAT_ICON, TITLES, RANKS, TICKETS, TICKET_FLAVOUR, SAT_FAILS, SAT_WINS,
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
