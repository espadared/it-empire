/* ============================================================
   IT EMPIRE — BATTLE CONTENT
   Questions and puzzles for the competitive rooms. Pure data.
   ============================================================ */
const BATTLE = (() => {

  /* Four rooms, four different things to be good at. Stakes are what it costs
     to enter; the pot is every entry stake, and the best run takes it. */
  const GAMES = [
    { id:'quiz',     name:'Certification Exam', icon:'🎓', stake:5000,  rounds:10,
      blurb:'Ten questions from the CompTIA and ITIL papers. Wrong answers cost you five seconds.',
      unit:'time' },
    { id:'memory',   name:'Rack Memory Rush',   icon:'💡', stake:3000,  rounds:8,
      blurb:'The rack lights up. Repeat the sequence back. It gets longer every round.',
      unit:'time' },
    { id:'scramble', name:'Cable Scramble',     icon:'🔤', stake:3000,  rounds:8,
      blurb:'Unscramble the term before the next one lands. A wrong guess costs five seconds.',
      unit:'time' },
    { id:'fault',    name:'Spot The Fault',     icon:'🔍', stake:4000,  rounds:6,
      blurb:'Two configs, one difference. Find the line that changed.',
      unit:'time' },
  ];

  const PENALTY_MS = 5000;          // what a wrong answer costs, everywhere

  /* ---------- CERTIFICATION QUESTIONS ---------- */
  const QUIZ = [
    { q:'Which port does HTTPS use by default?', o:['80','443','8080','22'], a:1, src:'Network+' },
    { q:'What does RAID 1 provide?', o:['Striping for speed','Mirroring for redundancy','Parity across three disks','Compression'], a:1, src:'A+' },
    { q:'In ITIL, what is the goal of Incident Management?', o:['Find the root cause','Restore normal service as quickly as possible','Prevent all future incidents','Approve changes'], a:1, src:'ITIL' },
    { q:'Which record type maps a hostname to an IPv4 address?', o:['MX','CNAME','A','TXT'], a:2, src:'Network+' },
    { q:'What does the principle of least privilege mean?', o:['Everyone gets admin','Users get only the access their job needs','Passwords must be long','Only managers get accounts'], a:1, src:'Security+' },
    { q:'A laptop posts but shows no display on an external monitor only. First check?', o:['Reinstall the OS','The input source and cable','The BIOS battery','The hard drive'], a:1, src:'A+' },
    { q:'Which is a private IPv4 range?', o:['172.16.0.0/12','8.8.0.0/16','200.1.1.0/24','1.1.1.0/24'], a:0, src:'Network+' },
    { q:'In ITIL, a Problem is best described as:', o:['Any user complaint','The unknown cause of one or more incidents','A failed change','A service request'], a:1, src:'ITIL' },
    { q:'What does MFA add to a login?', o:['A longer password','A second, different kind of proof','Encryption of the session','A password manager'], a:1, src:'Security+' },
    { q:'Which command shows the route packets take to a host?', o:['ping','tracert','netstat','ipconfig'], a:1, src:'Network+' },
    { q:'A user reports "the internet is down" but can reach internal sites. Most likely?', o:['Their monitor','DNS or the gateway','Their keyboard','The printer'], a:1, src:'A+' },
    { q:'What is the purpose of a change advisory board?', o:['To fix incidents','To assess and authorise changes','To answer the phones','To buy hardware'], a:1, src:'ITIL' },
    { q:'Which of these is symmetric encryption?', o:['RSA','AES','ECC','Diffie-Hellman'], a:1, src:'Security+' },
    { q:'DHCP hands out which of the following?', o:['MAC addresses','IP configuration','Usernames','Certificates'], a:1, src:'Network+' },
    { q:'What does an SLA define?', o:['The hardware warranty','Agreed service targets between provider and customer','The password policy','The network topology'], a:1, src:'ITIL' },
    { q:'A phishing email is best described as:', o:['Unsolicited advertising','A message designed to trick you into giving up access','A virus attachment','A denial of service'], a:1, src:'Security+' },
    { q:'Which connector is used for standard twisted-pair Ethernet?', o:['RJ11','RJ45','BNC','SC'], a:1, src:'A+' },
    { q:'What is the first step of the ITIL service lifecycle?', o:['Service Design','Service Strategy','Service Transition','Service Operation'], a:1, src:'ITIL' },
    { q:'A switch operates primarily at which OSI layer?', o:['Layer 1','Layer 2','Layer 4','Layer 7'], a:1, src:'Network+' },
    { q:'What does BitLocker protect?', o:['Email in transit','Data at rest on the drive','The BIOS password','Network traffic'], a:1, src:'Security+' },
    { q:'Which memory type is used as system RAM in a modern desktop?', o:['DDR4','NAND','EEPROM','VRAM'], a:0, src:'A+' },
    { q:'A "known error" in ITIL is:', o:['An incident nobody logged','A problem with a documented root cause and workaround','A failed backup','An unauthorised change'], a:1, src:'ITIL' },
    { q:'What does VLAN segmentation primarily give you?', o:['Faster cables','Logical separation of traffic','More IP addresses','Better wifi range'], a:1, src:'Network+' },
    { q:'Which is the strongest wireless security option listed?', o:['WEP','WPA','WPA2','WPA3'], a:3, src:'Security+' },
    { q:'A user cannot print. Everyone else on the floor can. First check?', o:['Restart the print server','Their default printer and driver','Replace the printer','Reimage their laptop'], a:1, src:'A+' },
    { q:'What is the purpose of a CMDB?', o:['To store passwords','To record configuration items and their relationships','To log network traffic','To schedule backups'], a:1, src:'ITIL' },
    { q:'Which protocol securely replaces Telnet?', o:['FTP','SSH','SNMP','SMTP'], a:1, src:'Network+' },
    { q:'Ransomware most commonly enters an organisation through:', o:['The firewall','Email and compromised credentials','The printer','DNS'], a:1, src:'Security+' },
    { q:'What does a hypervisor do?', o:['Manages print queues','Runs and isolates virtual machines','Encrypts the disk','Routes packets'], a:1, src:'A+' },
    { q:'A service request differs from an incident because:', o:['It is more urgent','Nothing is broken — the user wants something','It affects more people','It is logged by IT'], a:1, src:'ITIL' },
    { q:'Which subnet mask matches a /24 network?', o:['255.255.0.0','255.255.255.0','255.255.255.128','255.0.0.0'], a:1, src:'Network+' },
    { q:'What is the main risk of shadow IT?', o:['Higher licence costs only','Unmanaged systems holding company data','Slower wifi','More helpdesk tickets'], a:1, src:'Security+' },
    { q:'Thermal paste is applied between:', o:['The PSU and the case','The CPU and its heatsink','The RAM and the board','The drive and the bay'], a:1, src:'A+' },
    { q:'What does RPO measure in a backup plan?', o:['How long recovery takes','How much data you can afford to lose','How many tapes you keep','How often you test'], a:1, src:'ITIL' },
    { q:'An IP address of 169.254.x.x usually means:', o:['A static address','DHCP failed and the host self-assigned','A public address','A VPN address'], a:1, src:'Network+' },
    { q:'Which is an example of social engineering?', o:['A port scan','Someone phoning the helpdesk pretending to be the CFO','A buffer overflow','A DDoS'], a:1, src:'Security+' },
    { q:'What does POST check when a PC starts?', o:['The network','Core hardware before the OS loads','The antivirus','User accounts'], a:1, src:'A+' },
    { q:'Continual Service Improvement is mainly about:', o:['Buying newer hardware','Measuring and improving services over time','Closing tickets faster','Hiring more staff'], a:1, src:'ITIL' },
    { q:'NAT primarily allows:', o:['Many private hosts to share a public address','Faster DNS','Encrypted email','Wireless roaming'], a:0, src:'Network+' },
    { q:'A certificate warning on an internal site most often means:', o:['The site is hacked','An expired, self-signed or mismatched certificate','The user typed the wrong password','The firewall is down'], a:1, src:'Security+' },
  ];

  /* ---------- CABLE SCRAMBLE ---------- */
  const SCRAMBLE = [
    { w:'FIREWALL',   hint:'Blocks traffic it does not like' },
    { w:'SUBNET',     hint:'A slice of a network' },
    { w:'PHISHING',   hint:'Arrives by email, wants your password' },
    { w:'BANDWIDTH',  hint:'How much you can push down the pipe' },
    { w:'ENCRYPTION', hint:'Makes it unreadable without the key' },
    { w:'LATENCY',    hint:'The delay everyone blames' },
    { w:'ROUTER',     hint:'Decides where packets go next' },
    { w:'BACKUP',     hint:'Worthless until you test the restore' },
    { w:'MALWARE',    hint:'Software nobody asked for' },
    { w:'PROTOCOL',   hint:'The agreed rules of a conversation' },
    { w:'DOMAIN',     hint:'Where your login lives' },
    { w:'PATCHING',   hint:'Tuesday is famous for it' },
    { w:'DOWNTIME',   hint:'The thing the SLA is about' },
    { w:'GATEWAY',    hint:'The way out of your network' },
    { w:'INCIDENT',   hint:'Something is broken, restore it' },
    { w:'HARDWARE',   hint:'The part you can drop' },
    { w:'PASSWORD',   hint:'Written on a sticky note somewhere' },
    { w:'SERVER',     hint:'It is always this, apparently' },
    { w:'VIRTUAL',    hint:'Not a real machine, but it runs' },
    { w:'DATABASE',   hint:'Where the records actually are' },
    { w:'TICKET',     hint:'Your whole day, in a queue' },
    { w:'NETWORK',    hint:'It is never this. Except when it is' },
    { w:'STORAGE',    hint:'Always nearly full' },
    { w:'MIGRATION',  hint:'A weekend you will not get back' },
  ];

  /* ---------- SPOT THE FAULT ----------
     Two configs, identical but for one line. Find the line that changed. */
  const FAULTS = [
    { title:'Firewall rule set', lines:[
      'allow tcp any -> 10.0.0.0/8 port 443',
      'allow tcp any -> 10.0.0.0/8 port 80',
      'deny  udp any -> any port 137',
      'allow tcp 10.0.5.0/24 -> any port 22',
      'deny  ip  any -> any log' ],
      bad:3, was:'allow tcp 10.0.5.0/24 -> any port 22', now:'allow tcp any -> any port 22' },
    { title:'DHCP scope', lines:[
      'scope 10.20.0.0 mask 255.255.255.0',
      'range 10.20.0.100 - 10.20.0.200',
      'option router 10.20.0.1',
      'option dns 10.20.0.5, 10.20.0.6',
      'lease 8 days' ],
      bad:2, was:'option router 10.20.0.1', now:'option router 10.20.1.1' },
    { title:'Backup job', lines:[
      'source  /srv/finance',
      'target  nas01:/backups/finance',
      'schedule daily 02:00',
      'retention 30 days',
      'verify  after each run' ],
      bad:4, was:'verify  after each run', now:'verify  disabled' },
    { title:'User account', lines:[
      'sAMAccountName  j.tan',
      'memberOf        Finance-Read',
      'passwordNeverExpires  false',
      'accountEnabled  true',
      'mfaRegistered   true' ],
      bad:1, was:'memberOf        Finance-Read', now:'memberOf        Domain Admins' },
    { title:'Switch port', lines:[
      'interface Gi1/0/12',
      ' description  Meeting Room 4 AP',
      ' switchport mode access',
      ' switchport access vlan 40',
      ' spanning-tree portfast' ],
      bad:3, was:' switchport access vlan 40', now:' switchport access vlan 1' },
    { title:'Web server TLS', lines:[
      'ssl_protocols        TLSv1.2 TLSv1.3',
      'ssl_certificate      /etc/ssl/live/fullchain.pem',
      'ssl_prefer_server_ciphers  on',
      'add_header  Strict-Transport-Security  max-age=31536000',
      'ssl_session_timeout  10m' ],
      bad:0, was:'ssl_protocols        TLSv1.2 TLSv1.3', now:'ssl_protocols        TLSv1 TLSv1.1' },
    { title:'Mail connector', lines:[
      'smarthost  smtp.corp.local',
      'port       587',
      'auth       required',
      'tls        required',
      'relay      authenticated only' ],
      bad:4, was:'relay      authenticated only', now:'relay      open' },
    { title:'VPN profile', lines:[
      'protocol   IKEv2',
      'split-tunnel  enabled',
      'dns        10.0.0.5',
      'idle-timeout  30m',
      'certificate  machine' ],
      bad:1, was:'split-tunnel  enabled', now:'split-tunnel  disabled' },
  ];

  return { GAMES, PENALTY_MS, QUIZ, SCRAMBLE, FAULTS };
})();
