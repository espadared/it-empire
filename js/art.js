/* ============================================================
   IT EMPIRE — ART LAYER
   Hand-built SVG: the office diorama and the illustrated staff.
   ============================================================ */
const Art = (() => {

  const shade = (hex, amt) => {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r + amt)));
    g = Math.max(0, Math.min(255, Math.round(g + amt)));
    b = Math.max(0, Math.min(255, Math.round(b + amt)));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  };

  /* ---------------- HAIR ---------------- */
  function hair(style, c) {
    const d = shade(c, -28), l = shade(c, 26);
    switch (style) {
      case 'bun': return `
        <circle cx="80" cy="24" r="13" fill="${d}"/>
        <path d="M52 60c-2-24 12-34 28-34s30 10 28 34c-3-13-9-19-15-21-8 5-27 6-33 1-4 4-6 11-8 20z" fill="${c}"/>
        <path d="M56 40c8-9 22-12 34-8" stroke="${l}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>`;
      case 'spiky': return `
        <path d="M52 58c-4-20 8-34 28-34s32 14 28 34c-4-8-6-14-10-16l-2 9-6-12-6 11-6-13-7 12-5-9c-5 3-8 10-14 18z" fill="${c}"/>
        <path d="M62 34l4 8 5-9" stroke="${l}" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".8"/>`;
      case 'fade': return `
        <path d="M53 54c0-20 12-30 27-30s27 10 27 30c-4-6-6-9-9-11-9 4-31 4-38-1-3 3-5 6-7 12z" fill="${c}"/>
        <path d="M53 54c1-6 3-9 5-12 8 5 30 5 38 1 3 2 5 5 9 11" stroke="${d}" stroke-width="2" fill="none" opacity=".8"/>`;
      case 'long': return `
        <path d="M48 96c-4-16-3-32 0-44 4-18 16-28 32-28s28 10 32 28c3 12 4 28 0 44-4-4-7-14-8-26-10 6-38 6-48 0-1 12-4 22-8 26z" fill="${c}"/>
        <path d="M60 36c8-8 24-10 34-4" stroke="${l}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/>`;
      case 'cap': return `
        <path d="M52 46c0-16 12-24 28-24s28 8 28 24z" fill="${c}"/>
        <path d="M52 46h56v6H52z" fill="${d}"/>
        <path d="M106 46c14 0 22 4 24 9-10 3-20 3-24 1z" fill="${d}"/>
        <circle cx="80" cy="26" r="3" fill="${l}"/>`;
      default: return `
        <path d="M52 56c0-22 12-32 28-32s28 10 28 32c-4-8-6-12-9-14-9 5-31 5-39 0-3 2-5 6-8 14z" fill="${c}"/>
        <path d="M60 34c9-7 24-8 33-2" stroke="${l}" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".65"/>`;
    }
  }

  /* ---------------- PERSON ---------------- */
  /* a = art config; opts.pose = 'idle' | 'work'; opts.id for unique gradient ids */
  function person(a, opts = {}) {
    const id = opts.id || ('p' + Math.random().toString(36).slice(2, 7));
    const skinD = shade(a.skin, -34), skinL = shade(a.skin, 20);
    const shirtD = shade(a.shirt, -34), shirtL = shade(a.shirt, 22);
    const work = opts.pose === 'work';

    return `
    <defs>
      <linearGradient id="sh_${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${shirtL}"/><stop offset="1" stop-color="${shirtD}"/>
      </linearGradient>
      <radialGradient id="fc_${id}" cx=".4" cy=".35" r=".8">
        <stop offset="0" stop-color="${skinL}"/><stop offset="1" stop-color="${a.skin}"/>
      </radialGradient>
    </defs>

    <!-- legs -->
    <g>
      <path d="M64 162h14v72c0 4-2 6-7 6s-7-2-7-6z" fill="#2A3149"/>
      <path d="M82 162h14v72c0 4-2 6-7 6s-7-2-7-6z" fill="#232941"/>
      <rect x="60" y="238" width="22" height="10" rx="5" fill="#171C2E"/>
      <rect x="80" y="238" width="22" height="10" rx="5" fill="#121726"/>
    </g>

    <!-- torso -->
    <path d="M80 88c-16 0-26 5-31 12-4 6-6 20-7 36-1 12-1 22 0 30h76c1-8 1-18 0-30-1-16-3-30-7-36-5-7-15-12-31-12z" fill="url(#sh_${id})"/>
    <path d="M66 90l14 16 14-16c-4-3-8-4-14-4s-10 1-14 4z" fill="${shade(a.skin,-6)}"/>
    <path d="M66 90l14 16-6 8-12-22z" fill="${shirtD}" opacity=".55"/>
    <path d="M94 90L80 106l6 8 12-22z" fill="${shirtD}" opacity=".55"/>
    <!-- lanyard + badge -->
    <path d="M68 92c4 18 8 26 12 30" stroke="${a.accent}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M92 92c-4 18-8 26-12 30" stroke="${a.accent}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <rect x="72" y="120" width="16" height="21" rx="3" fill="#EDF1FB" stroke="${shade(a.accent,-30)}" stroke-width="1.5"/>
    <rect x="75" y="124" width="10" height="6" rx="1.5" fill="${a.accent}" opacity=".65"/>
    <rect x="75" y="133" width="10" height="2" rx="1" fill="#9AA4BE"/>

    <!-- arms -->
    <g class="${work ? 'arm-work-l' : 'arm-idle-l'}" style="transform-origin:48px 100px">
      <path d="M50 92c-9 3-13 12-14 24-1 10-1 20 1 28 1 5 8 5 9 0 2-9 2-18 3-26 1-9 4-16 9-20z" fill="${a.shirt}"/>
      <circle cx="41" cy="146" r="8" fill="url(#fc_${id})"/>
    </g>
    <g class="${work ? 'arm-work-r' : 'arm-idle-r'}" style="transform-origin:112px 100px">
      <path d="M110 92c9 3 13 12 14 24 1 10 1 20-1 28-1 5-8 5-9 0-2-9-2-18-3-26-1-9-4-16-9-20z" fill="${a.shirt}"/>
      <circle cx="119" cy="146" r="8" fill="url(#fc_${id})"/>
    </g>

    <!-- neck -->
    <path d="M71 74h18v18c0 4-18 4-18 0z" fill="${skinD}"/>

    <!-- head -->
    <g class="head-bob">
      <ellipse cx="80" cy="58" rx="26" ry="29" fill="url(#fc_${id})"/>
      <ellipse cx="54" cy="60" rx="4.5" ry="6" fill="${a.skin}"/>
      <ellipse cx="106" cy="60" rx="4.5" ry="6" fill="${a.skin}"/>
      ${hair(a.hairStyle, a.hair)}
      <!-- brows -->
      <path d="M63 52c4-3 10-3 13 0" stroke="${shade(a.hair,-20)}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <path d="M84 52c3-3 9-3 13 0" stroke="${shade(a.hair,-20)}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <!-- eyes -->
      <g class="eyes">
        <ellipse cx="70" cy="61" rx="4.2" ry="4.6" fill="#FFFFFF"/>
        <ellipse cx="90" cy="61" rx="4.2" ry="4.6" fill="#FFFFFF"/>
        <circle cx="70.8" cy="61.6" r="2.4" fill="#1B2033"/>
        <circle cx="90.8" cy="61.6" r="2.4" fill="#1B2033"/>
        <circle cx="69.8" cy="60.4" r=".9" fill="#fff"/>
        <circle cx="89.8" cy="60.4" r=".9" fill="#fff"/>
      </g>
      <!-- nose + mouth -->
      <path d="M80 63c1.5 4 1.5 6-1 7" stroke="${skinD}" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M73 74c4 4 10 4 14 0" stroke="#8C4A44" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      ${a.beard ? `<path d="M56 60c1 16 10 27 24 27s23-11 24-27c2 12-2 30-24 30S54 72 56 60z" fill="${shade(a.hair,10)}" opacity=".92"/>
        <path d="M73 74c4 4 10 4 14 0" stroke="#7A3E39" stroke-width="2.4" fill="none" stroke-linecap="round"/>` : ''}
      ${a.glasses ? `<g fill="none" stroke="#20263C" stroke-width="2.4" opacity=".92">
        <rect x="62" y="54.5" width="17" height="14" rx="6"/>
        <rect x="81" y="54.5" width="17" height="14" rx="6"/>
        <path d="M79 60h2"/><path d="M62 58l-7-2"/><path d="M98 58l7-2"/>
        </g><rect x="63.5" y="56" width="14" height="11" rx="5" fill="#8FD9FF" opacity=".2"/>
        <rect x="82.5" y="56" width="14" height="11" rx="5" fill="#8FD9FF" opacity=".2"/>` : ''}
      ${a.headset ? `<path d="M52 58c0-18 12-30 28-30s28 12 28 30" stroke="#20263C" stroke-width="5" fill="none" stroke-linecap="round"/>
        <rect x="45" y="52" width="12" height="19" rx="6" fill="#2C3550"/>
        <rect x="103" y="52" width="12" height="19" rx="6" fill="#2C3550"/>
        <path d="M105 68c-6 6-12 8-18 8" stroke="#2C3550" stroke-width="3" fill="none" stroke-linecap="round"/>
        <circle cx="86" cy="76" r="3" fill="${a.accent}"/>` : ''}
    </g>`;
  }

  const hero = (a, pose) =>
    `<svg class="hero-svg" viewBox="0 0 160 250" xmlns="http://www.w3.org/2000/svg">${person(a, { pose, id: 'hero' })}</svg>`;

  const portrait = (a, id) =>
    `<svg class="portrait-svg" viewBox="30 22 100 92" xmlns="http://www.w3.org/2000/svg">${person(a, { id: 'pt' + id })}</svg>`;

  /* ---------------- OFFICE DIORAMA ---------------- */
  function office() {
    const led = (x, y, c, d) => `<rect class="led" style="animation-delay:${d}s" x="${x}" y="${y}" width="3" height="2.4" rx="1" fill="${c}"/>`;
    let leds = '';
    const cols = ['#5FD37A', '#4FD6C9', '#FFB347', '#5FD37A', '#4FA8FF'];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 3; c++)
      leds += led(20 + c * 6, 78 + r * 11, cols[(r + c) % 5], ((r * 3 + c) % 11) * 0.31);

    let skyline = '';
    const bl = [[236, 96, 16, 60], [254, 78, 22, 78], [280, 104, 14, 52], [297, 88, 20, 68], [320, 110, 16, 46], [339, 92, 18, 64]];
    bl.forEach((b, i) => {
      skyline += `<rect x="${b[0]}" y="${b[1]}" width="${b[2]}" height="${b[3]}" rx="1.5" fill="#2A2E52" opacity=".9"/>`;
      for (let wy = b[1] + 5; wy < b[1] + b[3] - 4; wy += 8)
        for (let wx = b[0] + 3; wx < b[0] + b[2] - 3; wx += 6)
          if ((wx + wy + i) % 3) skyline += `<rect x="${wx}" y="${wy}" width="2.6" height="3.4" fill="#FFC97A" opacity="${0.25 + ((wx + wy) % 4) * 0.16}"/>`;
    });

    return `
<svg class="office-svg" viewBox="0 0 400 230" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#232B47"/><stop offset="1" stop-color="#161C31"/>
    </linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1B2138"/><stop offset="1" stop-color="#0D1120"/>
    </linearGradient>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3A2E63"/><stop offset=".55" stop-color="#6B3E63"/><stop offset="1" stop-color="#D97A4E"/>
    </linearGradient>
    <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFC97A" stop-opacity=".30"/><stop offset="1" stop-color="#FFC97A" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="scr" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4FD6C9"/><stop offset="1" stop-color="#2E7FA8"/>
    </linearGradient>
    <radialGradient id="glow" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#FFC97A" stop-opacity=".55"/><stop offset="1" stop-color="#FFC97A" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="400" height="230" fill="url(#wall)"/>
  <rect y="150" width="400" height="80" fill="url(#floor)"/>
  <path d="M0 150h400v3H0z" fill="#0A0E1A" opacity=".7"/>

  <!-- window -->
  <rect x="228" y="52" width="136" height="92" rx="4" fill="#141A2E"/>
  <rect x="232" y="56" width="128" height="84" fill="url(#sky)"/>
  ${skyline}
  <rect x="232" y="56" width="128" height="84" fill="none" stroke="#0E1220" stroke-width="0"/>
  <path d="M296 56v84M232 98h128" stroke="#141A2E" stroke-width="5"/>
  <rect x="228" y="52" width="136" height="92" rx="4" fill="none" stroke="#2E3757" stroke-width="4"/>
  <path d="M232 56h128v84z" fill="#FFD9A0" opacity=".07"/>

  <!-- ceiling lamps + beams -->
  <g>
    <path d="M96 0v16" stroke="#39415F" stroke-width="2"/>
    <ellipse cx="96" cy="20" rx="18" ry="6" fill="#39415F"/>
    <ellipse class="lamp" cx="96" cy="24" rx="14" ry="4" fill="#FFD9A0"/>
    <path d="M82 24L58 150h76L110 24z" fill="url(#beam)"/>
    <path d="M186 0v10" stroke="#39415F" stroke-width="2"/>
    <ellipse cx="186" cy="14" rx="14" ry="5" fill="#39415F"/>
    <ellipse class="lamp" style="animation-delay:1.4s" cx="186" cy="17" rx="11" ry="3.4" fill="#FFD9A0"/>
    <path d="M175 17L157 150h58L197 17z" fill="url(#beam)" opacity=".7"/>
  </g>

  <!-- server rack -->
  <g>
    <rect x="10" y="60" width="40" height="94" rx="4" fill="#20273F" stroke="#38415F" stroke-width="2"/>
    <rect x="14" y="64" width="32" height="86" rx="2" fill="#151B2D"/>
    ${Array.from({ length: 9 }, (_, r) => `<rect x="15" y="${75 + r * 11}" width="30" height="9" rx="1.5" fill="#252D48"/>`).join('')}
    ${leds}
    <ellipse cx="30" cy="66" rx="26" ry="12" fill="url(#glow)" opacity=".5"/>
  </g>

  <!-- back desk with monitors -->
  <g>
    <rect x="60" y="112" width="92" height="6" rx="2" fill="#3B3327"/>
    <rect x="66" y="118" width="5" height="32" fill="#2A3149"/>
    <rect x="141" y="118" width="5" height="32" fill="#2A3149"/>
    <g>
      <rect x="72" y="82" width="40" height="27" rx="3" fill="#161C2E" stroke="#39415F" stroke-width="2"/>
      <rect x="75" y="85" width="34" height="21" rx="1.5" fill="url(#scr)" opacity=".85"/>
      <g fill="#0E1220" opacity=".45">
        <rect x="78" y="88" width="18" height="2"/><rect x="78" y="92" width="26" height="2"/>
        <rect x="78" y="96" width="14" height="2"/><rect x="78" y="100" width="22" height="2"/>
      </g>
      <rect class="scan" x="75" y="85" width="34" height="4" fill="#DFFCF7" opacity=".18"/>
      <rect x="88" y="109" width="8" height="4" fill="#39415F"/>
    </g>
    <g>
      <rect x="114" y="86" width="34" height="23" rx="3" fill="#161C2E" stroke="#39415F" stroke-width="2"/>
      <rect x="117" y="89" width="28" height="17" rx="1.5" fill="#2B6E5F"/>
      <g fill="#7BF0D8" opacity=".65">
        <rect x="119" y="92" width="14" height="1.6"/><rect x="119" y="96" width="20" height="1.6"/>
        <rect x="119" y="100" width="10" height="1.6"/>
      </g>
      <rect x="127" y="109" width="8" height="4" fill="#39415F"/>
    </g>
    <rect x="80" y="113" width="30" height="3" rx="1.5" fill="#4A5372"/>
  </g>

  <!-- foreground desk (right) -->
  <g>
    <rect x="240" y="150" width="150" height="8" rx="3" fill="#4A3E2C"/>
    <rect x="246" y="158" width="6" height="40" fill="#2A3149"/>
    <rect x="378" y="158" width="6" height="40" fill="#2A3149"/>
    <rect x="262" y="118" width="46" height="30" rx="3" fill="#161C2E" stroke="#39415F" stroke-width="2"/>
    <rect x="265" y="121" width="40" height="24" rx="1.5" fill="#26496E"/>
    <g fill="#8FD9FF" opacity=".7">
      <rect x="268" y="124" width="20" height="2"/><rect x="268" y="129" width="30" height="2"/>
      <rect x="268" y="134" width="16" height="2"/><rect x="268" y="139" width="26" height="2"/>
    </g>
    <rect class="scan" style="animation-delay:1.1s" x="265" y="121" width="40" height="5" fill="#DFFCF7" opacity=".14"/>
    <rect x="280" y="148" width="10" height="4" fill="#39415F"/>
    <!-- laptop -->
    <path d="M320 128h40v20h-40z" fill="#232B45" stroke="#39415F" stroke-width="1.5"/>
    <rect x="323" y="131" width="34" height="14" fill="#3E7C8F" opacity=".8"/>
    <path d="M314 148h52l4 6h-60z" fill="#2E3853"/>
    <!-- mug -->
    <rect x="252" y="138" width="9" height="11" rx="2" fill="#E0715F"/>
    <path d="M261 141c4 0 4 5 0 5" stroke="#E0715F" stroke-width="2" fill="none"/>
    <path class="steam" d="M256 136c-2-3 2-4 0-7" stroke="#C9D2EA" stroke-width="1.4" fill="none" opacity=".5" stroke-linecap="round"/>
  </g>

  <!-- printer -->
  <g>
    <rect x="160" y="122" width="42" height="28" rx="3" fill="#2C3450" stroke="#404A6B" stroke-width="2"/>
    <rect x="166" y="116" width="30" height="8" rx="2" fill="#39415F"/>
    <rect x="166" y="140" width="30" height="7" rx="1" fill="#E8ECF7" opacity=".85"/>
    <circle class="led" cx="196" cy="128" r="2" fill="#FF5A5F"/>
  </g>

  <!-- plant -->
  <g>
    <path d="M366 176h20l-3 22h-14z" fill="#A0562F"/>
    <path d="M376 176c-12-4-18-16-14-28 10 2 15 12 14 28z" fill="#3E8F5C"/>
    <path d="M376 176c12-6 16-18 11-29-9 3-13 13-11 29z" fill="#4FA86B"/>
    <path d="M376 176c-2-14 2-26 10-32 3 12-1 24-10 32z" fill="#357A4E"/>
  </g>

  <!-- cable spaghetti -->
  <path d="M60 150c20 8 40-6 60 4s30 0 44 6" stroke="#151A2B" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>
  <path d="M240 158c-18 6-30 0-44 6" stroke="#151A2B" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>

  <!-- floor pools of light -->
  <ellipse cx="96" cy="176" rx="70" ry="16" fill="url(#glow)" opacity=".38"/>
  <ellipse cx="196" cy="196" rx="60" ry="14" fill="url(#glow)" opacity=".22"/>
</svg>`;
  }

  return { office, hero, portrait, person, shade };
})();
