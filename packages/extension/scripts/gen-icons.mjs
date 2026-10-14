// Minimal pure-Node PNG icon generator (no deps). Produces 16/48/128 icons:
// indigo gradient background with a white circular dot in the center.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function png(width, height, rgba) {
  // signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const ihdrChunk = chunk("IHDR", ihdr);
  // IDAT (filtered scanlines)
  const raw = Buffer.alloc(height * (1 + width * 4));
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      rgba(x, y, raw, o);
      o += 4;
    }
  }
  const idat = chunk("IDAT", deflateSync(raw));
  const iend = chunk("IEND", Buffer.alloc(0));
  return Buffer.concat([sig, ihdrChunk, idat, iend]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function make(size) {
  return png(size, size, (x, y, buf, o) => {
    // diagonal indigo gradient
    const t = (x + y) / (2 * size);
    const r = Math.round(99 + t * 30);
    const g = Math.round(102 + t * 20);
    const b = Math.round(241 + t * 14);
    // white circle in center
    const dx = x - size / 2;
    const dy = y - size / 2;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const radius = size * 0.26;
    if (dist < radius) {
      // dot: white with a small indigo hole -> ring
      buf[o] = 255;
      buf[o + 1] = 255;
      buf[o + 2] = 255;
      buf[o + 3] = 255;
    } else {
      buf[o] = r;
      buf[o + 1] = g;
      buf[o + 2] = b;
      buf[o + 3] = 255;
    }
  });
}

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "public", "icon");
mkdirSync(out, { recursive: true });
for (const s of [16, 48, 128]) {
  writeFileSync(join(out, `${s}.png`), make(s));
  console.log("wrote", s + ".png");
}
