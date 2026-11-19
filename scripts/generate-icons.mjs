import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const outDir = path.resolve('public/icons');
fs.mkdirSync(outDir, { recursive: true });

// CRC32 lookup table for PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter None
    rgba.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function clamp(v, min = 0, max = 1) {
  return v < min ? min : v > max ? max : v;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const c1 = wx * vx + wy * vy;
  if (c1 <= 0) return Math.hypot(px - ax, py - ay);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(px - bx, py - by);
  const b = c1 / c2;
  return Math.hypot(px - (ax + b * vx), py - (ay + b * vy));
}

function pointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function signedDistRoundedBox(px, py, halfSize, cornerRadius) {
  const qx = Math.abs(px) - (halfSize - cornerRadius);
  const qy = Math.abs(py) - (halfSize - cornerRadius);
  return (
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
    Math.min(Math.max(qx, qy), 0) -
    cornerRadius
  );
}

function blendPixel(r1, g1, b1, r2, g2, b2, t) {
  return [
    r1 + (r2 - r1) * t,
    g1 + (g2 - g1) * t,
    b1 + (b2 - b1) * t,
  ];
}

function renderIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const aa = 1.35 / size;

  // Scale emblem slightly smaller inside maskable safe-zone (~66% diameter)
  const scale = maskable ? 0.68 : 0.82;
  const ringRadius = 0.36 * scale;
  const ringThickness = 0.045 * scale;

  // Play triangle vertices in normalized [-0.5, 0.5] coords (shifted right slightly for optical balance)
  const triScale = scale * 0.22;
  const ax = -0.34 * triScale;
  const ay = -0.62 * triScale;
  const bx = -0.34 * triScale;
  const by = 0.62 * triScale;
  const tx = 0.72 * triScale;
  const ty = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x + 0.5 - cx) / size;
      const ny = (y + 0.5 - cy) / size;

      // Alpha mask for rounded icon (or full opaque square for maskable)
      let bgAlpha = 1;
      if (!maskable) {
        const sdf = signedDistRoundedBox(nx, ny, 0.48, 0.115);
        bgAlpha = 1 - smoothstep(-aa, aa, sdf);
      }

      const dCenter = Math.hypot(nx, ny);

      // Base dark obsidian #09090B with subtle emerald ambient glow in center
      const glow = Math.exp(-dCenter * dCenter * (maskable ? 12 : 9)) * 0.24;
      let r = 9 + glow * 20;
      let g = 9 + glow * 176;
      let b = 11 + glow * 73;

      // Subtle inner surface disc inside ring
      const innerDisc = 1 - smoothstep(ringRadius - aa, ringRadius + aa, dCenter);
      [r, g, b] = blendPixel(r, g, b, 20, 22, 26, innerDisc * 0.75);

      // Emerald circular ring #1DB954 -> #22DF66 highlight gradient
      const ringDist = Math.abs(dCenter - ringRadius);
      const ringAlpha = 1 - smoothstep(ringThickness - aa, ringThickness + aa, ringDist);
      if (ringAlpha > 0) {
        const grad = clamp(0.5 - ny * 1.2 + nx * 0.5);
        const er = 24 + grad * 12;
        const eg = 175 + grad * 48;
        const eb = 80 + grad * 22;
        [r, g, b] = blendPixel(r, g, b, er, eg, eb, ringAlpha);
      }

      // Centered crisp Play triangle
      const insideTri = pointInTriangle(nx, ny, ax, ay, bx, by, tx, ty);
      const edgeDist = Math.min(
        distToSegment(nx, ny, ax, ay, bx, by),
        distToSegment(nx, ny, bx, by, tx, ty),
        distToSegment(nx, ny, tx, ty, ax, ay)
      );
      const triSigned = insideTri ? -edgeDist : edgeDist;
      const triAlpha = 1 - smoothstep(-aa * 0.9, aa * 0.9, triSigned);
      if (triAlpha > 0) {
        [r, g, b] = blendPixel(r, g, b, 250, 250, 250, triAlpha);
      }

      const idx = (y * size + x) * 4;
      rgba[idx] = Math.round(clamp(r, 0, 255));
      rgba[idx + 1] = Math.round(clamp(g, 0, 255));
      rgba[idx + 2] = Math.round(clamp(b, 0, 255));
      rgba[idx + 3] = Math.round(bgAlpha * 255);
    }
  }

  return encodePng(size, size, rgba);
}

const targets = [
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
  { name: 'apple-touch-icon.png', size: 180, maskable: true },
];

for (const t of targets) {
  const png = renderIcon(t.size, { maskable: t.maskable });
  const filePath = path.join(outDir, t.name);
  fs.writeFileSync(filePath, png);
  console.log(`Generated ${t.name} (${png.length} bytes)`);
}
