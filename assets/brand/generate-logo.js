// Generates the Dragon Boat logo — a family of three (two parents and a baby) on a dragon boat —
// as SVG, plus every PNG the app needs.
// Usage: node generate-logo.js <out-dir>   (needs @resvg/resvg-js)
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const BRAND = { from: '#9BE8BF', to: '#34B97A' };
const DECK = 600;

const f = (n) => n.toFixed(1);
const rad = (d) => (d * Math.PI) / 180;
const seg = (a, b, w, color) =>
  `<path d="M ${f(a[0])} ${f(a[1])} L ${f(b[0])} ${f(b[1])}" stroke="${color}" stroke-width="${f(w)}" stroke-linecap="round" fill="none"/>`;

function boat(color, eyeId) {
  const hull = `M 214 ${DECK} H 812 C 794 690 676 736 512 736 C 352 736 234 692 214 ${DECK} Z`;
  const neck = 'M 246 650 C 204 566 208 474 270 428';
  const head = 'M 340 414 C 344 374 310 356 276 372 L 180 418 L 286 444 C 318 448 338 440 340 414 Z';
  const horn = 'M 310 376 C 328 342 352 322 382 314 C 372 342 360 366 348 392 Z';
  const tail = `M 784 ${DECK + 34} C 842 ${DECK + 4} 862 548 840 496`;
  // The eye is cut out of the head so the mark stays a single colour.
  return `
    <mask id="${eyeId}"><rect width="1024" height="1024" fill="#fff"/><circle cx="300" cy="410" r="13" fill="#000"/></mask>
    <g mask="url(#${eyeId})">
      <path d="${neck}" stroke="${color}" stroke-width="58" stroke-linecap="round" fill="none"/>
      <path d="${head}" fill="${color}"/>
      <path d="${horn}" fill="${color}" stroke="${color}" stroke-width="10" stroke-linejoin="round"/>
    </g>
    <path d="${tail}" stroke="${color}" stroke-width="46" stroke-linecap="round" fill="none"/>
    <path d="${hull}" fill="${color}"/>`;
}

/** A parent paddles; the baby sits between them. Both parents pull at the same angle and depth. */
function person(x, color, baby = false) {
  const dir = [-Math.sin(rad(8)), -Math.cos(rad(8))];
  const seat = [x, DECK + 6];
  const len = baby ? 69 : 132;
  const shoulder = [seat[0] + dir[0] * len, seat[1] + dir[1] * len];
  const r = baby ? 34 : 46;
  const gap = r + (baby ? 22 : 32);
  const head = [shoulder[0] + dir[0] * gap, shoulder[1] + dir[1] * gap];
  const paddle = [];
  if (!baby) {
    const hand = [shoulder[0] + 10, shoulder[1] + 30];
    const endY = DECK + 190;
    const end = [hand[0] + (endY - hand[1]) / Math.tan(rad(62)), endY];
    const deg = (Math.atan2(end[1] - hand[1], end[0] - hand[0]) * 180) / Math.PI;
    paddle.push(
      seg(hand, end, 20, color),
      `<rect x="${f(end[0] - 19)}" y="${f(end[1] - 38)}" width="38" height="86" rx="19" fill="${color}" transform="rotate(${f(deg - 90)} ${f(end[0])} ${f(end[1])})"/>`,
    );
  }
  return { paddle: paddle.join(''), body: seg(seat, shoulder, baby ? 50 : 70, color) + `<circle cx="${f(head[0])}" cy="${f(head[1])}" r="${r}" fill="${color}"/>` };
}

function mark(color = '#FFFFFF', id = 'm') {
  const crew = [person(470, color), person(582, color, true), person(690, color)];
  return `<g transform="translate(0 -24)">${crew.map((c) => c.paddle + c.body).join('')}${boat(color, `eye-${id}`)}${crew.map((c) => c.body).join('')}</g>`;
}

const defs = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BRAND.from}"/>
      <stop offset="1" stop-color="${BRAND.to}"/>
    </linearGradient>
  </defs>`;

const bg = `<rect width="1024" height="1024" fill="url(#bg)"/>`;
const fit = (scale, body) => `<g transform="translate(${512 * (1 - scale)} ${512 * (1 - scale)}) scale(${scale})">${body}</g>`;
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs}${body}</svg>`;

const variants = {
  // Full-bleed square icon (iOS, web, stores). No transparency, no rounded corners.
  icon: { svg: svg(`${bg}${fit(0.92, mark())}`), size: 1024 },
  // Android adaptive: gradient background layer; the mark stays inside the 66% safe zone.
  'android-icon-background': { svg: svg(bg), size: 512 },
  'android-icon-foreground': { svg: svg(fit(0.64, mark())), size: 512 },
  'android-icon-monochrome': { svg: svg(fit(0.64, mark())), size: 432 },
  // Splash: the white mark, shown on the brand colour.
  'splash-icon': { svg: svg(fit(0.95, mark())), size: 1024 },
  favicon: { svg: svg(`<rect width="1024" height="1024" rx="220" fill="url(#bg)"/>${fit(1.02, mark())}`), size: 48 },
  // In-app logo: the mark in brand green on a transparent background.
  'logo-mark': { svg: svg(fit(1.02, mark('#2FAE72'))), size: 512 },
  // Web app icons (copied to public/): iPhone home screen and the web manifest.
  'apple-touch-icon': { svg: svg(`${bg}${fit(0.92, mark())}`), size: 180 },
  'icon-192': { svg: svg(`${bg}${fit(0.92, mark())}`), size: 192 },
  'icon-512': { svg: svg(`${bg}${fit(0.92, mark())}`), size: 512 },
  // Preview of the final look with an iOS-style rounded mask.
  preview: { svg: svg(`<rect width="1024" height="1024" rx="230" fill="url(#bg)"/>${fit(0.92, mark())}`), size: 512 },
};

const out = process.argv[2] ?? path.join(__dirname, 'out');
fs.mkdirSync(out, { recursive: true });
for (const [name, { svg: s, size }] of Object.entries(variants)) {
  fs.writeFileSync(path.join(out, `${name}.svg`), s);
  const png = new Resvg(s, { fitTo: { mode: 'width', value: size } }).render().asPng();
  fs.writeFileSync(path.join(out, `${name}.png`), png);
}
console.log('rendered', Object.keys(variants).length, 'variants');
