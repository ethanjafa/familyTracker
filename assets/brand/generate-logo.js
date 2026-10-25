// Generates the FamilyWeek logo — two parents and a child standing on the week, with its seven
// days below (today highlighted) — as SVG, plus every PNG the app needs.
// Usage: node generate-logo.js <out-dir>   (needs @resvg/resvg-js)
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const BRAND = { from: '#9BE8BF', to: '#34B97A' };

/** A person: a round head over a rounded body that stands on the week line. */
function person(cx, headY, r, width, top, color) {
  const half = width / 2;
  return (
    `<circle cx="${cx}" cy="${headY}" r="${r}" fill="${color}"/>` +
    `<path d="M ${cx - half} 690 V ${top + half} a ${half} ${half} 0 0 1 ${width} 0 V 690 Z" fill="${color}"/>`
  );
}

function mark(color = '#FFFFFF') {
  const family = [person(318, 318, 72, 168, 428, color), person(706, 318, 72, 168, 428, color), person(512, 470, 54, 124, 552, color)];
  const line = `<rect x="160" y="690" width="704" height="34" rx="17" fill="${color}"/>`;
  // The seven days of the week; the middle one (today) stands out.
  const days = [0, 1, 2, 3, 4, 5, 6]
    .map((d) => `<circle cx="${212 + d * 100}" cy="800" r="${d === 3 ? 26 : 20}" fill="${color}" opacity="${d === 3 ? 1 : 0.55}"/>`)
    .join('');
  // Centred vertically: the artwork spans y 246–826.
  return `<g transform="translate(0 -24)">${family.join('')}${line}${days}</g>`;
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
  favicon: { svg: svg(`<rect width="1024" height="1024" rx="220" fill="url(#bg)"/>${fit(0.98, mark())}`), size: 48 },
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
