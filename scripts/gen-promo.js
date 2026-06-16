// Build-time generator for the 1024x1024 App Store IAP promotional image.
// Run: node scripts/gen-promo.js  (sharp must be installed)
const sharp = require('sharp');
const path = require('path');

const GREEN = '#1D9E75';
const LIGHT = '#D9F2E9';
const S = 1024;
const cx = S / 2;

function wheel(cy, r) {
  const sw = 20, hub = 24;
  const ulx = cx - 0.866 * r, uy = cy - 0.5 * r, urx = cx + 0.866 * r;
  return (
    `<g fill="none" stroke="#FFFFFF" stroke-width="${sw}" stroke-linecap="round">` +
      `<circle cx="${cx}" cy="${cy}" r="${r}"/>` +
      `<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy + r}"/>` +
      `<line x1="${cx}" y1="${cy}" x2="${ulx}" y2="${uy}"/>` +
      `<line x1="${cx}" y1="${cy}" x2="${urx}" y2="${uy}"/>` +
    `</g><circle cx="${cx}" cy="${cy}" r="${hub}" fill="#FFFFFF"/>`
  );
}

function perk(y, label) {
  // White check badge + label, as a left-aligned row in a centered column.
  const bx = 250;
  return (
    `<circle cx="${bx}" cy="${y}" r="22" fill="#FFFFFF"/>` +
    `<path d="M${bx - 10} ${y} L${bx - 3} ${y + 8} L${bx + 11} ${y - 9}" fill="none" stroke="${GREEN}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<text x="${bx + 42}" y="${y + 12}" font-family="Arial, sans-serif" font-size="36" fill="#FFFFFF">${label}</text>`
  );
}

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">` +
    `<rect width="${S}" height="${S}" fill="${GREEN}"/>` +
    wheel(210, 96) +
    `<text x="${cx}" y="400" font-family="Arial, sans-serif" font-size="76" font-weight="bold" fill="#FFFFFF" text-anchor="middle">CheckDrive Pro</text>` +
    `<text x="${cx}" y="450" font-family="Arial, sans-serif" font-size="30" fill="${LIGHT}" text-anchor="middle">A one-time unlock — yours forever</text>` +
    perk(560, 'Unlimited checklists') +
    perk(640, 'No ads, ever') +
    perk(720, 'Default checklist on connect') +
    perk(800, 'Support a solo developer') +
    `<text x="${cx}" y="930" font-family="Arial, sans-serif" font-size="28" fill="${LIGHT}" text-anchor="middle">One-time purchase · no subscription</text>` +
  `</svg>`;

const out = path.join(__dirname, '..', 'store-assets', 'iap-promo.png');
require('fs').mkdirSync(path.dirname(out), { recursive: true });
sharp(Buffer.from(svg)).png().toFile(out).then(() => console.log('wrote', out));
