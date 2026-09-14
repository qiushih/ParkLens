// Generates the extension icons (a white "P" on a teal rounded square) as PNGs.
// Dependency-free: shapes are rasterized with 4×4 supersampling and written with zlib.
// Usage: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT_DIR = new URL('../src/assets/icons/', import.meta.url);
const BACKGROUND = [0x0f, 0x76, 0x6e];
const SAMPLES = 4;

const inRect = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

function inRoundedSquare(x, y, radius) {
  const cx = Math.min(Math.max(x, radius), 1 - radius);
  const cy = Math.min(Math.max(y, radius), 1 - radius);
  return inRect(x, y, 0, 0, 1, 1) && (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius;
}

// Coordinates are normalized to the artwork box (0..1).
function inGlyph(x, y) {
  const stem = inRect(x, y, 0.3, 0.2, 0.44, 0.8);
  const bowl = inRect(x, y, 0.3, 0.2, 0.53, 0.58) || inCircle(x, y, 0.53, 0.39, 0.19);
  const counter = inRect(x, y, 0.44, 0.32, 0.53, 0.46) || inCircle(x, y, 0.53, 0.39, 0.07);
  return stem || (bowl && !counter);
}

function renderIcon(size) {
  // Chrome's guidance: 128px icons keep a 16px transparent margin; small sizes use the full box.
  const margin = size >= 128 ? 16 : size >= 48 ? 2 : 0;
  const art = size - margin * 2;
  const pixels = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let shape = 0;
      let glyph = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = (px - margin + (sx + 0.5) / SAMPLES) / art;
          const y = (py - margin + (sy + 0.5) / SAMPLES) / art;
          if (!inRoundedSquare(x, y, 0.22)) continue;
          shape++;
          if (inGlyph(x, y)) glyph++;
        }
      }
      const i = (py * size + px) * 4;
      const whiteShare = shape === 0 ? 0 : glyph / shape;
      for (let c = 0; c < 3; c++) {
        pixels[i + c] = Math.round(BACKGROUND[c] + (255 - BACKGROUND[c]) * whiteShare);
      }
      pixels[i + 3] = Math.round((255 * shape) / SAMPLES ** 2);
    }
  }
  return encodePng(size, size, pixels);
}

function encodePng(width, height, rgba) {
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    rgba.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  let crc = 0xffffffff;
  for (const byte of body) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, body.length + 4);
  return out;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  writeFileSync(new URL(`icon-${size}.png`, OUT_DIR), renderIcon(size));
  console.log(`icon-${size}.png`);
}
