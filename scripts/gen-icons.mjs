// Gera ícones PNG placeholder do MeetSync (16/48/128) sem dependências externas.
// Desenho: fundo dark arredondado (#202124) + glifo "M" em azul do tema (#8AB4F8).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const BG = [0x20, 0x21, 0x24]; // --ms-bg-surface
const FG = [0x8a, 0xb4, 0xf8]; // --ms-accent-blue

function px(size) {
  const buf = Buffer.alloc(size * size * 4);
  const r = size * 0.18; // raio do canto
  const stroke = Math.max(2, Math.round(size * 0.12));
  const inset = size * 0.26;
  const w = size - inset * 2;

  const inRounded = (x, y) => {
    const cx = Math.min(Math.max(x, r), size - r);
    const cy = Math.min(Math.max(y, r), size - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r || (x >= r && x <= size - r) || (y >= r && y <= size - r);
  };

  // Glifo "M": duas verticais + dois diagonais até o centro.
  const onM = (x, y) => {
    const lx = inset, rx = size - inset, top = inset, bot = size - inset, mid = size / 2;
    const near = (a, b) => Math.abs(a - b) <= stroke / 2;
    if (y < top || y > bot) return false;
    if (near(x, lx) || near(x, rx)) return true;
    const t = (y - top) / (bot - top); // 0..1 descendo
    const dLeft = lx + t * (mid - lx);
    const dRight = rx - t * (rx - mid);
    return near(x, dLeft) || near(x, dRight);
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const inside = inRounded(x + 0.5, y + 0.5);
      if (!inside) {
        buf[i + 3] = 0; // transparente fora do quadrado arredondado
        continue;
      }
      const isM = onM(x + 0.5, y + 0.5);
      const c = isM ? FG : BG;
      buf[i] = c[0];
      buf[i + 1] = c[1];
      buf[i + 2] = c[2];
      buf[i + 3] = 255;
    }
  }
  return buf;
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function png(size) {
  const raw = px(size);
  // adiciona filtro byte (0) por linha
  const stride = size * 4;
  const filtered = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    filtered[y * (stride + 1)] = 0;
    raw.copy(filtered, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(filtered)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [16, 48, 128]) {
  writeFileSync(resolve(outDir, `icon-${size}.png`), png(size));
  console.log(`✓ icon-${size}.png`);
}
