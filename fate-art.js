/* Original fan-project artwork and sound. These are newly drawn ritual motifs,
 * not copies of official command spells, class cards, or soundtrack material.
 * SVG decoration inherits currentColor. No network or media files are required.
 */

const escapeAttr = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

const xy = (radius, angle, cx = 150, cy = 244) => {
  const radians = (angle - 90) * Math.PI / 180;
  return `${(cx + Math.cos(radians) * radius).toFixed(2)},${(cy + Math.sin(radians) * radius).toFixed(2)}`;
};

/** Three independently addressable strokes. Set the containing element to red. */
export function commandSealSVG(className = '') {
  return `<svg class="command-seal ${escapeAttr(className)}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" fill="currentColor" aria-hidden="true" focusable="false">
    <path class="seal-stroke seal-stroke-1" fill-rule="evenodd" d="M80 9 97 40 91 66 84 58 80 88 76 58 69 66 63 40ZM80 27l-7 15 7 16 7-16Z M76 96l4-7 4 7-4 27Z"/>
    <path class="seal-stroke seal-stroke-2" fill-rule="evenodd" d="M18 41 46 52 63 86 57 100 74 119 73 144 51 122 46 102 31 101 33 80ZM34 60l8 24 11 7-14-29Z M27 109l15 2 7 17 12 13-23-12Z"/>
    <path class="seal-stroke seal-stroke-3" fill-rule="evenodd" d="m142 41-28 11-17 34 6 14-17 19 1 25 22-22 5-20 15-1-2-21Zm-16 19-8 24-11 7 14-29Z M133 109l-15 2-7 17-12 13 23-12Z"/>
  </svg>`;
}

const classDrawings = {
  Saber: '<path d="m16 2 3 6-1 12h-4L13 8zM9 21h14M16 21v7m-3 1h6M16 8v10"/>',
  Archer: '<path d="M10 3c16 6 16 20 0 26M10 3l6 13-6 13M3 16h27m-5-5 5 5-5 5"/>',
  Lancer: '<path d="m16 1 5 9-5 6-5-6ZM16 5v25M11 18h10m-7 7h4"/>',
  Rider: '<circle cx="16" cy="16" r="11"/><circle cx="16" cy="16" r="3"/><path d="M16 2v11m0 6v11M2 16h11m6 0h11M6 6l8 8m4 4 8 8m0-20-8 8m-4 4-8 8"/>',
  Caster: '<path d="M16 14v16M12 30h8M16 2l6 6-6 6-6-6ZM3 8h4m18 0h4M16 5v6"/><path d="m5 19 2-3 2 3-2 3zm18-1 2-3 2 3-2 3z"/>',
  Assassin: '<path d="M5 2c11 2 18 10 21 23L13 13ZM12 13l-3 4m5-1-3 4M9 17 3 27l2 2 10-6M23 24l5 5"/>',
  Berserker: '<path d="M16 2v28M12 3h8M12 11C6 7 3 11 2 18c4-2 7-1 10 3M20 11c6-4 9 0 10 7-4-2-7-1-10 3M12 27h8"/>',
  Shielder: '<path d="m16 2 12 5v9c0 6-7 12-12 15C11 28 4 22 4 16V7ZM16 7v18M9 13h14"/>',
  Ruler: '<path d="M16 3v26M8 29h16M5 11l11-6 11 6M6 11l-5 9h10Zm20 0-5 9h10Z"/><circle cx="16" cy="3" r="2"/>',
  Avenger: '<path d="m16 2 4 9 10 1-8 8 3 10-9-5-9 5 3-10-8-8 10-1ZM9 12l14 14M23 12 9 26"/>',
  Pretender: '<path d="m3 5 12 3v12c-5 2-10-1-11-6Zm14 3 12-3-1 9c-1 5-6 8-11 6ZM7 11l4 1m10 0 4-1M7 17l5-1m8 0 5 1M12 22l4 7 4-7"/>',
};

/** Ornate original silver-blue class-card back. Second argument is a class name. */
export function servantCardBackSVG(className = '', classKey = 'Saber') {
  const key = Object.keys(classDrawings).find(key => key.toLowerCase() === String(classKey).toLowerCase()) || 'Saber';
  const star = Array.from({ length: 7 }, (_, i) => xy(103, i * 1080 / 7)).join(' ');
  const heptagon = Array.from({ length: 7 }, (_, i) => xy(103, i * 360 / 7)).join(' ');
  const marks = Array.from({ length: 56 }, (_, i) => `<path d="M${xy(i % 4 ? 117 : 113, i * 360 / 56)}L${xy(121, i * 360 / 56)}" opacity="${i % 4 ? '.24' : '.65'}"/>`).join('');
  const stations = Array.from({ length: 7 }, (_, i) => `<g transform="translate(${xy(103, i * 360 / 7)})"><path d="m0-5 4 5-4 5-4-5z" fill="currentColor" fill-opacity=".15" stroke-width=".8"/></g>`).join('');
  const corner = '<path d="M0 35V0h35M5 28V5h23M9 17l8-8 8 8-8 8zM17 12v10m-5-5h10M0 43l5-6 5 6-5 6zM43 0l-6 5 6 5 6-5z"/>';
  return `<svg class="servant-card-back ${escapeAttr(className)}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 500" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path d="M0 0h300v500H0z" fill="var(--card-back-bg,#10253d)" stroke="none"/>
    <g stroke-width=".8"><path d="M6 6h288v488H6z"/><path d="M12 12h276v476H12z" opacity=".45"/><path d="M23 45V23h254v22m0 410v22H23v-22" opacity=".7"/>
      <g transform="translate(17 17)">${corner}</g><g transform="translate(283 17) scale(-1 1)">${corner}</g><g transform="translate(17 483) scale(1 -1)">${corner}</g><g transform="translate(283 483) scale(-1 -1)">${corner}</g>
      <path d="M24 80v340m252-340v340M29 92v316m242-316v316" opacity=".4"/>
      <path d="m24 120-7 10 7 10 7-10zm0 240-7 10 7 10 7-10zm252-240-7 10 7 10 7-10zm0 240-7 10 7 10 7-10z"/>
    </g>
    <text x="150" y="60" fill="currentColor" stroke="none" text-anchor="middle" font-family="Georgia,serif" font-size="12" letter-spacing="5">SERVANT</text>
    <path d="M91 76h118m-78 7h38m-19-5v10" opacity=".55" stroke-width=".7"/>
    <g stroke-width=".65"><circle cx="150" cy="244" r="128" opacity=".4"/><circle cx="150" cy="244" r="123" opacity=".8"/>${marks}<circle cx="150" cy="244" r="110" opacity=".5"/><polygon points="${star}" opacity=".36"/><polygon points="${heptagon}" opacity=".38"/>${stations}<circle cx="150" cy="244" r="72" opacity=".7"/><circle cx="150" cy="244" r="67" stroke-dasharray="1 5" opacity=".4"/></g>
    <path d="m150 100 13 20-13 20-13-20Zm0 248 13 20-13 20-13-20Z" opacity=".65" stroke-width=".75"/>
    <g transform="translate(115 209) scale(2.1875)" stroke-width=".65">${classDrawings[key]}</g>
    <g stroke-width=".7" opacity=".6"><path d="M83 183c-35 15-43 70-9 101M217 183c35 15 43 70 9 101M63 199l-8-4 2 13m-1 8-8 3 5 10m-1 7-7 6 8 8m1 7-6 8 11 5M237 199l8-4-2 13m1 8 8 3-5 10m1 7 7 6-8 8m-1 7 6 8-11 5"/></g>
    <text x="150" y="416" fill="currentColor" stroke="none" text-anchor="middle" font-family="Georgia,serif" font-size="12" letter-spacing="4">${key.toUpperCase()}</text>
    <text x="150" y="440" fill="currentColor" stroke="none" text-anchor="middle" font-family="Georgia,serif" font-size="6.5" letter-spacing="2.1" opacity=".65">ONE SOUL · ONE COVENANT</text>
    <path d="M97 456h106m-58-5 5 5-5 5m10-10-5 5 5 5" opacity=".55" stroke-width=".7"/>
  </svg>`;
}

const catalysts = {
  scabbard: `<g transform="rotate(27 80 80)"><path d="m71 25 9-8 9 8-2 95-7 21-7-21Z" fill="currentColor" fill-opacity=".09"/><path d="M75 29v87l5 15 5-15V29M70 32h20M71 41h18M73 113h14M78 46v51m4-51v51M69 18h22m-17-7h12m-6 0v14M72 61l8 7 8-7m-16 25 8-7 8 7M76 107h8"/></g><path d="M37 39h10m-5-5v10m73 70h10m-5-5v10" opacity=".6"/>`,
  clay: `<path d="m44 31 66-3 11 10 6 84-11 9-72-3-9-12 2-74Z" fill="currentColor" fill-opacity=".055"/><path d="m45 37 61-2 9 7 5 75-7 7-65-3-7-9 2-66M49 52h60M49 111h60M99 34l-4 13 7 8-4 10m-59 39 11-6 5 4" opacity=".6"/><g fill="currentColor" stroke="none" opacity=".75">${[62,78,94].map((y,row)=>[50,68,86,104].map((x,i)=>`<path d="m${x} ${y} 8-2-3 6zm${x+4} ${y+5} 5 6-6-1Z" transform="rotate(${(i+row)%2?4:-4} ${x} ${y})"/>`).join('')).join('')}</g>`,
  arrow: `<g transform="rotate(35 80 80)"><path d="M80 31v104M79 28l-9 18 10-6 10 6Zm1 82-12 12 1 11 11-10 11 10 1-11Z" fill="currentColor" fill-opacity=".07"/><path d="M80 31v9M73 123l7-7 7 7M76 132h8M77 75h6m-6 4h6m-6 4h6"/></g><path d="M36 69c-2 30 13 50 38 56M124 88c3-28-10-48-34-56" opacity=".45"/>`,
  coin: `<circle cx="80" cy="80" r="43" fill="currentColor" fill-opacity=".07"/><circle cx="80" cy="80" r="38"/><circle cx="80" cy="80" r="33" opacity=".5" stroke-dasharray="1 4"/><path d="M69 98h26M73 95V70l12-12 13 15-4 5h-7v17M74 69l-6-2 1-10 10 6M87 81h8M67 104h31"/><path d="M58 99c-14-13-14-29-2-42M102 99c14-13 14-29 2-42M55 91l-7-2 4-7m1-2-6-4 6-5m2-1-4-6 7-3M105 91l7-2-4-7m-1-2 6-4-6-5m-2-1 4-6-7-3" opacity=".7"/><path d="M72 40h16m-8-7v14" opacity=".55"/>`,
  petal: `<path d="M83 24C48 35 36 68 58 90c17-7 30-29 25-66Z" fill="currentColor" fill-opacity=".1"/><path d="M123 59c-35-6-52 12-45 40 27 0 42-11 45-40Z" fill="currentColor" fill-opacity=".07"/><path d="M47 109c12-27 31-29 49-10-6 23-26 32-49 10Z" fill="currentColor" fill-opacity=".08"/><path d="M80 35C72 54 65 68 58 81m55-14L87 91M57 109l29-9M88 119c0 8-4 13-9 18m27-26 5 7m-69-30-7 4" opacity=".6"/>`,
  chess: `<path d="M50 129h60l-6-11H56Zm9-15h42M62 111c0-15 10-23 13-35-11-2-20 1-30 5l-6-8 24-26 2-18 14 10c23 3 31 21 30 41l-10 31Z" fill="currentColor" fill-opacity=".065"/><path d="M75 76 62 65M66 49l9 3m9-7c17 18 15 41 5 62M66 95c6 2 12 2 17 0M54 122h52M63 134v4h34v-4"/><circle cx="76" cy="52" r="2" fill="currentColor" stroke="none"/>`,
  none: `<circle cx="80" cy="80" r="36" stroke-dasharray="2 6" opacity=".55"/><path d="m80 47 7 24 24 9-24 9-7 24-7-24-24-9 24-9Z" fill="currentColor" fill-opacity=".045"/><circle cx="80" cy="80" r="5"/><path d="M80 26v12m0 84v12M26 80h12m84 0h12M43 43l7 7m60 60 7 7m0-74-7 7m-60 60-7 7" opacity=".65"/>`,
};

/** A physical catalyst, rather than a personality/tarot symbol. */
export function catalystSVG(key = 'none', className = '') {
  const name = Object.hasOwn(catalysts, String(key)) ? String(key) : 'none';
  return `<svg class="catalyst-svg catalyst-${name} ${escapeAttr(className)}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><g class="catalyst-aureole" stroke-width=".65" opacity=".23"><circle cx="80" cy="80" r="65"/><path d="M75 10h10m-5-5v10M75 150h10m-5-5v10M10 75v10m-5-5h10M150 75v10m-5-5h10"/></g><g class="catalyst-object">${catalysts[name]}</g></svg>`;
}

let activeChimeCleanup = null;

/**
 * A quiet, original 3-second rising chime and breath of air.
 * Call synchronously in a click/touch/keyboard handler. No autoplay or looping.
 * @returns {() => void} Call to fade out and close its AudioContext early.
 */
export function playSummoningChime() {
  const noop = () => {};
  if (typeof window === 'undefined') return noop;
  if (typeof navigator !== 'undefined' && navigator.userActivation && !navigator.userActivation.isActive) return noop;
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return noop;
  if (activeChimeCleanup) activeChimeCleanup();

  let audio;
  try { audio = new Context(); } catch { return noop; }
  const sources = [];
  let ended = false;
  let disposalTimer;
  let finishedTimer;
  let output;

  const cleanup = () => {
    if (ended) return;
    ended = true;
    clearTimeout(finishedTimer);
    if (activeChimeCleanup === cleanup) activeChimeCleanup = null;
    try {
      const at = audio.currentTime;
      if (output) {
        output.gain.cancelScheduledValues(at);
        output.gain.setValueAtTime(Math.max(.0001, output.gain.value), at);
        output.gain.exponentialRampToValueAtTime(.0001, at + .045);
      }
      sources.forEach(source => { try { source.stop(at + .06); } catch { /* Already stopped. */ } });
    } catch { /* A browser may close its audio device while this is playing. */ }
    disposalTimer = setTimeout(() => {
      sources.forEach(source => { try { source.disconnect(); } catch { /* Already disconnected. */ } });
      try { output?.disconnect(); } catch { /* Already disconnected. */ }
      if (audio.state !== 'closed') audio.close().catch(() => {});
      clearTimeout(disposalTimer);
    }, 90);
  };

  try {
    const t = audio.currentTime + .015;
    output = audio.createGain();
    output.gain.setValueAtTime(.0001, t);
    output.gain.exponentialRampToValueAtTime(.16, t + .08);
    output.gain.setValueAtTime(.16, t + 2.45);
    output.gain.exponentialRampToValueAtTime(.0001, t + 3.18);
    output.connect(audio.destination);

    const voice = (frequency, delay, duration, strength, type = 'sine', detune = 0) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, t + delay);
      oscillator.detune.setValueAtTime(detune, t + delay);
      gain.gain.setValueAtTime(.0001, t + delay);
      gain.gain.exponentialRampToValueAtTime(strength, t + delay + .035);
      gain.gain.exponentialRampToValueAtTime(.0001, t + delay + duration);
      oscillator.connect(gain); gain.connect(output);
      oscillator.start(t + delay); oscillator.stop(t + delay + duration + .02);
      sources.push(oscillator);
    };

    // A slow fundamental and three glass-like rising arrivals, not a game melody.
    voice(146.832, 0, 2.95, .12, 'sine');
    voice(293.665, .06, 2.3, .2, 'sine');
    voice(440, .48, 2.2, .17, 'sine');
    voice(659.255, .98, 1.95, .13, 'sine');
    voice(880, .48, 1.25, .025, 'triangle', 4);
    voice(1318.51, .98, 1.65, .025, 'sine', -3);

    // Low-level filtered air makes the ring feel energized without a harsh hit.
    const length = Math.ceil(audio.sampleRate * 2.8);
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 0x31e5a;
    for (let i = 0; i < length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      samples[i] = (seed / 2147483648 - 1) * .3;
    }
    const noise = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const breath = audio.createGain();
    noise.buffer = buffer;
    filter.type = 'bandpass'; filter.Q.value = .45;
    filter.frequency.setValueAtTime(450, t);
    filter.frequency.exponentialRampToValueAtTime(1900, t + 1.5);
    filter.frequency.exponentialRampToValueAtTime(550, t + 2.75);
    breath.gain.setValueAtTime(.0001, t);
    breath.gain.exponentialRampToValueAtTime(.09, t + 1.3);
    breath.gain.exponentialRampToValueAtTime(.0001, t + 2.78);
    noise.connect(filter); filter.connect(breath); breath.connect(output);
    noise.start(t); noise.stop(t + 2.8); sources.push(noise);

    activeChimeCleanup = cleanup;
    if (audio.state === 'suspended') audio.resume().catch(cleanup);
    finishedTimer = setTimeout(cleanup, 3360);
    return cleanup;
  } catch {
    cleanup();
    return noop;
  }
}
