// Build-time icon generator (not shipped). Renders the CheckDrive steering-wheel
// logo to the PNG assets via sharp. Run: node scripts/gen-icons.js
const sharp = require('sharp');
const path = require('path');

const GREEN = '#1D9E75';
const WHITE = '#FFFFFF';

// Steering wheel SVG. `ratio` controls wheel size relative to canvas (smaller for
// adaptive/splash so it stays inside the launcher safe zone). `bg` null = transparent.
function wheelSvg(size, { bg = null, ratio = 0.244 } = {}) {
  const c = size / 2;
  const R = ratio * size;
  const sw = 0.058 * size;
  const hub = 0.072 * size;
  const ulx = c - 0.866 * R, uy = c - 0.5 * R, urx = c + 0.866 * R;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      (bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : '') +
      `<g fill="none" stroke="${WHITE}" stroke-width="${sw}" stroke-linecap="round">` +
        `<circle cx="${c}" cy="${c}" r="${R}"/>` +
        `<line x1="${c}" y1="${c}" x2="${c}" y2="${c + R}"/>` +
        `<line x1="${c}" y1="${c}" x2="${ulx}" y2="${uy}"/>` +
        `<line x1="${c}" y1="${c}" x2="${urx}" y2="${uy}"/>` +
      `</g>` +
      `<circle cx="${c}" cy="${c}" r="${hub}" fill="${WHITE}"/>` +
    `</svg>`
  );
}

const A = (f) => path.join(__dirname, '..', 'assets', f);

async function out(svg, size, file) {
  await sharp(svg).resize(size, size).png().toFile(A(file));
  console.log('wrote', file, size + 'x' + size);
}

(async () => {
  // Full-bleed app icon (iOS masks it) + web favicon: green background, fuller wheel.
  await out(wheelSvg(1024, { bg: GREEN, ratio: 0.265 }), 1024, 'icon.png');
  await out(wheelSvg(196, { bg: GREEN, ratio: 0.265 }), 196, 'favicon.png');
  // Android adaptive foreground: transparent, wheel inside safe zone (bg is set
  // by app.json adaptiveIcon.backgroundColor).
  await out(wheelSvg(1024, { bg: null, ratio: 0.244 }), 1024, 'adaptive-icon.png');
  // Splash: transparent wheel, smaller (splash bg is green via app.json).
  await out(wheelSvg(1024, { bg: null, ratio: 0.20 }), 1024, 'splash.png');
})();
