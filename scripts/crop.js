// Crop a PNG to a rectangle. Pure-JS (pngjs) so it needs no native deps.
// Usage: node scripts/crop.js <in> <out> <left> <top> <width> <height>
const { PNG } = require('pngjs');
const fs = require('fs');

const [inp, out] = [process.argv[2], process.argv[3]];
const [L, T, W, H] = [4, 5, 6, 7].map((i) => parseInt(process.argv[i], 10));

const src = PNG.sync.read(fs.readFileSync(inp));
const l = Math.max(0, L);
const t = Math.max(0, T);
const w = Math.min(W, src.width - l);
const h = Math.min(H, src.height - t);
const dst = new PNG({ width: w, height: h });
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const si = ((t + y) * src.width + (l + x)) << 2;
    const di = (y * w + x) << 2;
    dst.data[di] = src.data[si];
    dst.data[di + 1] = src.data[si + 1];
    dst.data[di + 2] = src.data[si + 2];
    dst.data[di + 3] = src.data[si + 3];
  }
}
fs.writeFileSync(out, PNG.sync.write(dst));
console.log('wrote', out, w + 'x' + h);
