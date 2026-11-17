/* Original decorative artwork for this unofficial Fate-inspired fan experience.
 * All geometry is authored here; no official insignia or character art is used.
 * Each image inherits currentColor and is deliberately transparent.
 */

let instance = 0;

const escapeAttribute = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

const point = (radius, angle, center = 400) => {
  const radian = (angle - 90) * Math.PI / 180;
  return [center + Math.cos(radian) * radius, center + Math.sin(radian) * radius];
};
const coords = p => p.map(value => Number(value.toFixed(2))).join(',');
const polygon = (count, radius, step = 1, rotation = 0) => Array.from({ length: count }, (_, index) =>
  coords(point(radius, ((index * step) % count) * 360 / count + rotation))
).join(' ');

const iconPaths = {
  Saber: '<path d="M16 3l3 5-1 12h-4L13 8zM10 21h12M16 21v6M13 28h6"/><path d="M16 8v10" opacity=".5"/>',
  Archer: '<path d="M10 4c15 5 15 19 0 24M10 4l6 12-6 12M5 16h23m-4-4 4 4-4 4"/>',
  Lancer: '<path d="m16 2 4 8-4 5-4-5zM16 15v15M11 17h10M14 24h4"/><path d="M16 5v7" opacity=".5"/>',
  Rider: '<circle cx="16" cy="16" r="10"/><circle cx="16" cy="16" r="3"/><path d="M16 6V2m0 28v-4M6 16H2m28 0h-4M9 9l5 5m4 4 5 5m0-14-5 5m-4 4-5 5"/>',
  Caster: '<path d="M16 13v16m-4 0h8M16 3l5 5-5 5-5-5zM8 8H4m24 0h-4M16 1v2"/><path d="m6 20 2-3 2 3-2 3zm16-4 2-3 2 3-2 3z"/>',
  Assassin: '<path d="M5 3c10 0 17 7 20 20L14 12zM13 13l-4 4m5-1-4 4M9 17l-5 9 2 2 9-5M23 23l4 4"/>',
  Berserker: '<path d="M16 4v25M12 4h8M13 11C7 7 4 9 3 16c4-1 7 1 10 5M19 11c6-4 9-2 10 5-4-1-7 1-10 5M13 26h6"/>',
  Ruler: '<path d="M16 4v24M7 28h18M16 6 5 11m11-5 11 5M6 11l-4 8h8zM26 11l-4 8h8z"/><circle cx="16" cy="4" r="2"/>',
  Avenger: '<path d="m16 3 4 8 9 1-7 7 2 10-8-5-8 5 2-10-7-7 9-1zM10 12l12 12M22 12 10 24"/>',
  Shielder: '<path d="m16 3 11 4v9c0 6-6 11-11 14C11 27 5 22 5 16V7zM16 8v16M9 13h14"/>',
  Pretender: '<path d="M4 7c5 3 19 3 24 0v11c0 6-7 10-12 12C11 28 4 24 4 18zM4 7l12 7L28 7M16 14v16M8 16l5 2-5 1m16-3-5 2 5 1M11 24c3-2 7-2 10 0"/>'
};

/** Small, legible original class glyph. This is not a reproduction of the game icons. */
export function classIcon(className, size = 24) {
  const key = Object.keys(iconPaths).find(key => key.toLowerCase() === String(className).toLowerCase()) || 'Caster';
  const dimension = Number.isFinite(Number(size)) ? Math.max(12, Math.min(160, Number(size))) : 24;
  return `<svg class="class-icon" xmlns="http://www.w3.org/2000/svg" width="${dimension}" height="${dimension}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${iconPaths[key]}</svg>`;
}

/** Intricate seven-station summoning geometry, built from original line work. */
export function ritualSVG(id = 'ritual', className = '') {
  const uid = `${String(id).replace(/[^a-zA-Z0-9_-]/g, '') || 'ritual'}-${++instance}`;
  const classes = ['Saber', 'Lancer', 'Archer', 'Rider', 'Caster', 'Assassin', 'Berserker'];
  const ticks = Array.from({ length: 140 }, (_, index) => {
    const major = index % 5 === 0;
    const a = point(major ? 361 : 366, index * 360 / 140);
    const b = point(373, index * 360 / 140);
    return `<path d="M${coords(a)}L${coords(b)}" stroke-width="${major ? 1.35 : .65}" opacity="${major ? '.8' : '.35'}"/>`;
  }).join('');
  const innerTicks = Array.from({ length: 70 }, (_, index) => {
    const a = point(index % 5 === 0 ? 235 : 240, index * 360 / 70);
    const b = point(246, index * 360 / 70);
    return `<path d="M${coords(a)}L${coords(b)}" opacity="${index % 5 === 0 ? '.6' : '.25'}"/>`;
  }).join('');
  const stations = classes.map((name, index) => {
    const angle = index * 360 / 7;
    const [x, y] = point(294, angle);
    const [labelX, labelY] = point(335, angle);
    return `<g class="ritual-station" data-class="${name}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)})">
      <circle r="26" fill="var(--ritual-medallion, #111b2c)" stroke-width=".9"/>
      <circle r="21" stroke-width=".6" opacity=".45"/>
      <g transform="translate(-13 -13) scale(.8125)" stroke-width="1.3">${iconPaths[name]}</g>
      <path d="M-31 0h-5m67 0h5M0-31v-5m0 67v5" opacity=".7"/>
    </g><text x="${labelX.toFixed(2)}" y="${labelY.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${angle > 90 && angle < 270 ? angle + 180 : angle} ${labelX.toFixed(2)} ${labelY.toFixed(2)})" fill="currentColor" stroke="none" font-size="8" letter-spacing="2.4" opacity=".75">${name.toUpperCase()}</text>`;
  }).join('');
  const connections = classes.map((_, index) => {
    const [x, y] = point(262, index * 360 / 7);
    const [a, b] = point(250, index * 360 / 7);
    return `<path d="M${x.toFixed(2)} ${y.toFixed(2)}L${a.toFixed(2)} ${b.toFixed(2)}"/><circle cx="${a.toFixed(2)}" cy="${b.toFixed(2)}" r="2" fill="currentColor"/>`;
  }).join('');

  return `<svg class="ritual-svg ${escapeAttribute(className)}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <defs>
      <path id="${uid}-upper" d="M80 400a320 320 0 1 1 640 0"/>
      <path id="${uid}-lower" d="M80 400a320 320 0 1 0 640 0"/>
      <radialGradient id="${uid}-glow"><stop stop-color="currentColor" stop-opacity=".13"/><stop offset=".68" stop-color="currentColor" stop-opacity=".025"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></radialGradient>
    </defs>
    <circle cx="400" cy="400" r="320" fill="url(#${uid}-glow)" stroke="none"/>
    <g class="ritual-orbit">
      <circle cx="400" cy="400" r="384" stroke-width=".6" opacity=".3"/>
      <circle cx="400" cy="400" r="377" stroke-width="1.2" opacity=".65"/>
      ${ticks}
      <circle cx="400" cy="400" r="357" opacity=".7"/>
      <circle cx="400" cy="400" r="347" stroke-width=".6" opacity=".35"/>
      <text font-family="Georgia,serif" font-size="10" letter-spacing="5.3" fill="currentColor" stroke="none" opacity=".48"><textPath href="#${uid}-upper" startOffset="50%" text-anchor="middle">LET THE SOUL FIND ITS ANSWER · SEVEN VESSELS · ONE CONTRACT</textPath></text>
      <text font-family="Georgia,serif" font-size="9" letter-spacing="5.3" fill="currentColor" stroke="none" opacity=".48"><textPath href="#${uid}-lower" startOffset="50%" text-anchor="middle">THE STARS REMEMBER · THE THRONE RESPONDS</textPath></text>
    </g>
    <g class="ritual-orbit-inner">
      <polygon points="${polygon(7, 250, 2)}" opacity=".5" stroke-width="1.05"/>
      <polygon points="${polygon(7, 250, 3)}" opacity=".28" stroke-width=".7"/>
      <polygon points="${polygon(7, 250)}" opacity=".22" stroke-width=".7"/>
      <circle cx="400" cy="400" r="250" stroke-width="1.1" opacity=".65"/>
      <circle cx="400" cy="400" r="232" stroke-width=".5" opacity=".3"/>
      ${innerTicks}
      ${connections}
    </g>
    <g font-family="Georgia,serif">${stations}</g>
    <g class="ritual-core">
      <circle cx="400" cy="400" r="153" stroke-width=".6" opacity=".42"/>
      <circle cx="400" cy="400" r="146" stroke-width=".8" opacity=".5"/>
      <path d="M400 230v31m0 278v31M230 400h31m278 0h31" opacity=".45"/>
      <polygon points="${polygon(3, 135)}" opacity=".5"/>
      <polygon points="${polygon(3, 135, 1, 180)}" opacity=".5"/>
      <circle cx="400" cy="400" r="68" stroke-width=".7" opacity=".6"/>
      <circle cx="400" cy="400" r="62" stroke-width=".5" opacity=".35"/>
      <path d="m400 359 8 31 26 10-26 10-8 31-8-31-26-10 26-10z" fill="currentColor" fill-opacity=".05" stroke-width="1.25"/>
      <path d="m400 378 5 17 16 5-16 5-5 17-5-17-16-5 16-5z" fill="currentColor" fill-opacity=".18" stroke-width=".6"/>
      <circle cx="400" cy="400" r="3.5" fill="currentColor" stroke="none"/>
      <path d="M392 328h16m-8-8v16M392 472h16m-8-8v16M328 392v16m-8-8h16M472 392v16m-8-8h16" stroke-width=".7" opacity=".65"/>
      <g fill="currentColor" stroke="none" opacity=".8"><circle cx="400" cy="249" r="2.5"/><circle cx="551" cy="400" r="2.5"/><circle cx="400" cy="551" r="2.5"/><circle cx="249" cy="400" r="2.5"/></g>
    </g>
    <g opacity=".5" stroke-width=".65"><path d="M394 12h12m-6-6v12M394 788h12m-6-6v12M12 394v12m-6-6h12M788 394v12m-6-6h12"/></g>
  </svg>`;
}

const sword = `
  <path d="m100 15 12 22-5 113H93L88 37z" fill="currentColor" fill-opacity=".07"/>
  <path d="m100 15 1 135M93 41h14M86 151c-11-7-18-4-24 3 16-1 24 6 38 6s22-7 38-6c-6-7-13-10-24-3M95 160v37h10v-37M96 170h8m-8 7h8m-8 7h8m-10 13-5 8 11 9 11-9-5-8"/>
  <path d="m100 106 4 9-4 10-4-10zM75 153l-3 8m53-8 3 8" opacity=".65"/>`;
const bow = `
  <path d="M69 23c67 25 84 72 65 119-11 28-35 52-65 70M69 23c37 42 42 66 42 95s-5 52-42 94M69 23l11 95-11 94M27 118h133m-16-12 16 12-16 12M34 111l12 7-12 7M39 108l13 10-13 10"/>
  <path d="M77 43c46 27 62 69 36 112M81 118h28M85 109v18m6-20v22m6-23v24m6-24v24" opacity=".55"/>
  <path d="m156 118 15-4-5 4 5 4z" fill="currentColor" fill-opacity=".3"/>`;
const spear = `
  <path d="M100 10c-2 19-17 27-17 43 0 10 8 15 17 22 9-7 17-12 17-22 0-16-15-24-17-43Z" fill="currentColor" fill-opacity=".08"/>
  <path d="M100 20v209M94 78h12M94 83h12M95 214h10M91 44l9 15 9-15M100 75c-20 9-13 25-29 33 20-2 29-10 29-25M104 82c16 9 12 28 27 38-19-7-22-15-27-24"/>
  <path d="M97 115h6m-6 9h6m-6 9h6m-6 9h6m-6 9h6M100 222l-4 7 4 5 4-5z" opacity=".6"/>`;
const shield = `
  <path d="m100 20 62 26v65c0 50-31 78-62 104-31-26-62-54-62-104V46z" fill="currentColor" fill-opacity=".04"/>
  <path d="m100 30 52 22v59c0 42-25 69-52 91-27-22-52-49-52-91V52zM100 39v151M54 80h92M55 135h90" opacity=".6"/>
  <circle cx="100" cy="107" r="26"/><circle cx="100" cy="107" r="21" opacity=".45"/>
  <path d="m100 83 6 17 18 7-18 7-6 17-6-17-18-7 18-7z"/>
  <path d="M66 58h9m-4.5-4.5v9M125 58h9m-4.5-4.5v9M73 158l6 8m42-8-6 8M95 172h10m-5-5v10" opacity=".6"/>`;
const staff = `
  <path d="M100 100v124M94 224h12M97 111h6m-6 8h6m-6 8h6m-6 8h6m-6 8h6"/>
  <circle cx="100" cy="60" r="38"/><ellipse cx="100" cy="60" rx="17" ry="38" transform="rotate(35 100 60)"/>
  <ellipse cx="100" cy="60" rx="38" ry="14" transform="rotate(-25 100 60)"/>
  <path d="m100 35 7 18 18 7-18 7-7 18-7-18-18-7 18-7z" fill="currentColor" fill-opacity=".06"/>
  <path d="M100 11v11M100 98v9M51 60h11m76 0h11M65 25l8 8m54 54 8 8M65 95l8-8m54-54 8-8M88 155c-19 6-19 24 0 30m24-18c19 6 19 24 0 30" opacity=".65"/>
  <circle cx="100" cy="60" r="4" fill="currentColor" stroke="none"/>`;
const chain = `
  <g transform="rotate(-24 100 120)"><rect x="88" y="17" width="24" height="42" rx="12"/><rect x="94" y="23" width="12" height="30" rx="6"/><path d="M100 51v22"/><rect x="88" y="65" width="24" height="42" rx="12"/><rect x="94" y="71" width="12" height="30" rx="6"/><path d="M100 99v22"/><rect x="88" y="113" width="24" height="42" rx="12"/><rect x="94" y="119" width="12" height="30" rx="6"/><path d="M100 147v22"/><rect x="88" y="161" width="24" height="42" rx="12"/><rect x="94" y="167" width="12" height="30" rx="6"/><path d="M100 195v18m-8 0h16l-8 18z"/></g>
  <path d="M42 66c17 4 22 17 19 36M155 138c-17 4-22 17-19 36M33 111h13m-6.5-6.5v13M154 54h13m-6.5-6.5v13" opacity=".6"/>`;
const dagger = `
  <g transform="rotate(-29 100 120)"><path d="m86 25 9 17-4 94H81l-4-94z" fill="currentColor" fill-opacity=".06"/><path d="M86 29v107M69 138h34M82 140v40h8v-40M82 150h8m-8 8h8m-8 8h8M80 180l6 10 6-10"/></g>
  <g transform="rotate(29 100 120)"><path d="m114 25 9 17-4 94h-10l-4-94z" fill="currentColor" fill-opacity=".06"/><path d="M114 29v107M97 138h34M110 140v40h8v-40M110 150h8m-8 8h8m-8 8h8M108 180l6 10 6-10"/></g>
  <path d="m100 187 4 11 11 4-11 4-4 11-4-11-11-4 11-4z" opacity=".6"/>`;
const axe = `
  <path d="M95 31h10v194H95zM92 24h16v8H92z"/>
  <path d="M93 56C67 35 48 47 34 85c24-11 35 4 59 18M107 56c26-21 45-9 59 29-24-11-35 4-59 18" fill="currentColor" fill-opacity=".06"/>
  <path d="M90 64c-20-16-36-8-44 11 16-3 26 5 44 16M110 64c20-16 36-8 44 11-16-3-26 5-44 16M95 167h10m-10 9h10m-10 9h10m-10 9h10m-10 9h10M91 216h18" opacity=".55"/>
  <path d="m100 114 5 10-5 10-5-10z"/>`;
const crown = `
  <path d="m37 77 17 69h92l17-69-35 27-28-51-28 51z" fill="currentColor" fill-opacity=".07"/>
  <path d="M55 146v20c27 8 63 8 90 0v-20M58 156c28 7 56 7 84 0M100 57v82M56 113l13 25m62 0 13-25M72 105l12 33m32 0 12-33"/>
  <circle cx="100" cy="44" r="8"/><circle cx="33" cy="69" r="5"/><circle cx="167" cy="69" r="5"/>
  <path d="m100 108 6 10-6 10-6-10zM59 151l4 5-4 5m82-10-4 5 4 5M79 152l4 7-4 7m42-14-4 7 4 7M100 172v34m-19-17 19 19 19-19M83 215h34" opacity=".65"/>`;
const chariot = `
  <path d="M51 82h88l-12 65H65zM55 98h80M64 121h66M77 83l9 64m27-64-7 64M137 96l17-36h19M70 81V59h34V37m-9 0h18M127 147l20 15h23M64 147l-8 16"/>
  <circle cx="75" cy="173" r="24"/><circle cx="75" cy="173" r="18" opacity=".55"/><circle cx="75" cy="173" r="4"/><path d="M75 153v16m0 8v16M55 173h16m8 0h16M61 159l11 11m6 6 11 11m0-28-11 11m-6 6-11 11"/>
  <circle cx="143" cy="173" r="17"/><circle cx="143" cy="173" r="3"/><path d="M143 159v11m0 6v11m-14-14h11m6 0h11" opacity=".65"/>`;
const flag = `
  <path d="M67 24v202M63 226h8M67 33c28-26 58 23 90-1v99c-32 24-62-26-90 0M77 43v76M147 44v76"/>
  <path d="M109 58v45M91 79h36m-23-20 5-8 5 8m-23 15-8 5 8 5m36-10 8 5-8 5m-23 19 5 8 5-8"/>
  <circle cx="67" cy="18" r="5" fill="currentColor" fill-opacity=".1"/>
  <path d="M61 151h12m-12 7h12m-12 7h12M67 38c-19 6-22 24-12 40M67 45c-10 15-4 35-22 49" opacity=".65"/>`;
const katana = `
  <g transform="rotate(24 100 120)"><path d="M108 16c-14 41-17 78-13 125h11c-7-45-7-83 2-125Z" fill="currentColor" fill-opacity=".08"/><path d="M108 16c-8 51-9 90-7 125M83 145h35m-37 4h40M95 150v58h12v-58M95 156l12 10-12 10 12 10-12 10 12 10M107 156l-12 10 12 10-12 10 12 10-12 10M95 210l6 9 6-9"/></g>
  <path d="M139 56h12m-6-6v12M49 135h12m-6-6v12" opacity=".55"/>`;
const book = `
  <path d="M100 59C80 39 53 41 32 48v128c23-8 46-7 68 10 22-17 45-18 68-10V48c-21-7-48-9-68 11Z" fill="currentColor" fill-opacity=".04"/>
  <path d="M100 59v127M40 57v108c20-4 37-3 52 6M160 57v108c-20-4-37-3-52 6M100 186v13l-8-6-8 6v-21M47 77c14-2 26-1 38 4M47 86c14-2 26-1 38 4M47 112c14-2 26-1 38 4M47 121c14-2 26-1 38 4M47 130c14-2 26-1 38 4M47 139c14-2 26-1 38 4" opacity=".7"/>
  <circle cx="132" cy="101" r="19"/><path d="m132 82 13 32h-26zM132 120V82"/>
  <path d="M118 141h29m-29 8h29" opacity=".6"/>`;
const flower = `
  <path d="M100 220V124m-2 43c-26 3-41-12-45-29 22-3 38 7 45 22m3 29c26 3 41-12 45-29-22-3-38 7-45 22"/>
  <g transform="translate(100 82)">${Array.from({length: 5}, (_, i) => `<path transform="rotate(${i * 72})" d="M0-9C-28-18-27-47 0-53 27-47 28-18 0-9Z" fill="currentColor" fill-opacity=".035"/>`).join('')}</g>
  <circle cx="100" cy="82" r="12"/><path d="m100 71 3 8 8 3-8 3-3 8-3-8-8-3 8-3z" opacity=".65"/>`;
const crestPaths = { sword, bow, spear, shield, staff, chain, dagger, axe, crown, chariot, flag, katana, book, flower };
const aliases = { lance: 'spear', blade: 'sword', excalibur: 'sword', dualswords: 'dagger', daggers: 'dagger', gate: 'crown', chalice: 'staff', fox: 'staff', anchor: 'chain', sun: 'crown', moon: 'staff', fire: 'axe', lightning: 'spear', scales: 'flag' };

/** A relic-like line illustration, designed to remain identifiable at card scale. */
export function crestSVG(key = 'sword', className = '') {
  const normalized = String(key).toLowerCase();
  const name = crestPaths[normalized] ? normalized : aliases[normalized] || 'sword';
  return `<svg class="crest-svg ${escapeAttribute(className)}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <g class="crest-aureole" stroke-width=".65" opacity=".28"><circle cx="100" cy="112" r="82"/><circle cx="100" cy="112" r="75" stroke-dasharray="1 7"/><path d="M100 20v-8m0 192v-8M8 112h8m168 0h8M35 47l6 6m118 118 6 6M35 177l6-6M159 53l6-6"/></g>
    <g class="crest-object">${crestPaths[name]}</g>
    <g stroke-width=".65" opacity=".55"><path d="M15 219h53m64 0h53M89 226h22m-11-5v10"/><path d="m74 219 5-3 5 3-5 3zm42 0 5-3 5 3-5 3z"/></g>
  </svg>`;
}

