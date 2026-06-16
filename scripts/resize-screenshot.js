// Resize a screenshot to 750x1334 (iPhone 8 portrait) for App Store Connect IAP review.
// Usage: node scripts/resize-screenshot.js <input> [output]
//   input:  path to your screenshot (any size/format)
//   output: optional output path (defaults to store-assets/iap-review-screenshot.png)
const sharp = require('sharp');
const path = require('path');

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/resize-screenshot.js <input-image>');
  process.exit(1);
}

const output = process.argv[3] ?? path.join(__dirname, '..', 'store-assets', 'iap-review-screenshot.png');
require('fs').mkdirSync(path.dirname(output), { recursive: true });

sharp(input)
  .resize(750, 1334, { fit: 'contain', background: '#1D2630' })
  .png()
  .toFile(output)
  .then(() => console.log('wrote', output))
  .catch((e) => console.error(e));
