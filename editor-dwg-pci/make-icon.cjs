const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const W = 256;
const H = 256;
const raw = Buffer.alloc(H * (1 + W * 4));

function insideRoundedRect(x, y, x0, y0, x1, y1, r) {
  const cx = Math.max(x0 + r, Math.min(x1 - r, x));
  const cy = Math.max(y0 + r, Math.min(y1 - r, y));
  return Math.hypot(x - cx, y - cy) <= r;
}

function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

for (let y = 0; y < H; y++) {
  const rowStart = y * (1 + W * 4);
  raw[rowStart] = 0; // filter None
  for (let x = 0; x < W; x++) {
    const idx = rowStart + 1 + x * 4;
    if (!insideRoundedRect(x, y, 12, 12, 243, 243, 48)) {
      raw[idx] = 0;
      raw[idx + 1] = 0;
      raw[idx + 2] = 0;
      raw[idx + 3] = 0;
      continue;
    }

    // Fondo degradado rojo corporativo PCI (#dc2626 -> #991b1b)
    const grad = y / H;
    let r = Math.round(225 - grad * 58);
    let g = Math.round(38 - grad * 16);
    let b = Math.round(38 - grad * 16);

    // Marco técnico CAD blanco interior (plano arquitectónico)
    const onPlanFrame =
      (Math.abs(x - 42) <= 3.2 && y >= 42 && y <= 186) ||
      (Math.abs(x - 214) <= 3.2 && y >= 42 && y <= 186) ||
      (Math.abs(y - 42) <= 3.2 && x >= 42 && x <= 214) ||
      (Math.abs(y - 186) <= 3.2 && x >= 42 && x <= 214);

    // Símbolo central: Círculo Detector con Y griega blanca brillante
    const cx = 128;
    const cy = 114;
    const distC = Math.hypot(x - cx, y - cy);
    const onCircle = Math.abs(distC - 46) <= 5.2;
    const onYStem = distToSeg(x, y, cx, cy + 2, cx, cy + 28) <= 5.0;
    const onYLeft = distToSeg(x, y, cx, cy + 2, cx - 22, cy - 23) <= 5.0;
    const onYRight = distToSeg(x, y, cx, cy + 2, cx + 22, cy - 23) <= 5.0;

    // Pastilla inferior blanca con letras "DWG"
    const inBadge = insideRoundedRect(x, y, 64, 198, 192, 228, 10);

    if (onPlanFrame || onCircle || onYStem || onYLeft || onYRight || inBadge) {
      r = 255;
      g = 255;
      b = 255;
    }

    // Letras "DWG" recortadas en rojo dentro de la pastilla blanca (198..228)
    if (inBadge) {
      const ly = y - 204; // 0..18
      const isD =
        x >= 84 &&
        x <= 102 &&
        ly >= 0 &&
        ly <= 18 &&
        (x <= 88 ||
          (ly <= 3 && x <= 98) ||
          (ly >= 15 && x <= 98) ||
          (x >= 98 && ly >= 3 && ly <= 15));
      const isW =
        x >= 110 &&
        x <= 142 &&
        ly >= 0 &&
        ly <= 18 &&
        (distToSeg(x, ly, 112, 1, 118, 17) <= 2.2 ||
          distToSeg(x, ly, 118, 17, 126, 6) <= 2.1 ||
          distToSeg(x, ly, 126, 6, 134, 17) <= 2.1 ||
          distToSeg(x, ly, 134, 17, 140, 1) <= 2.2);
      const isG =
        x >= 150 &&
        x <= 170 &&
        ly >= 0 &&
        ly <= 18 &&
        (x <= 154 ||
          ly <= 3 ||
          ly >= 15 ||
          (x >= 166 && ly >= 9) ||
          (ly >= 8 && ly <= 11 && x >= 160));

      if (isD || isW || isG) {
        r = 185;
        g = 28;
        b = 28;
      }
    }

    raw[idx] = r;
    raw[idx + 1] = g;
    raw[idx + 2] = b;
    raw[idx + 3] = 255;
  }
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const idat = zlib.deflateSync(raw, { level: 9 });
const pngSig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const pngBuf = Buffer.concat([
  pngSig,
  pngChunk('IHDR', ihdr),
  pngChunk('IDAT', idat),
  pngChunk('IEND', Buffer.alloc(0))
]);

// ICO header (1 image, 256x256 -> width=0, height=0 in ICONDIRENTRY)
const icoHeader = Buffer.alloc(6 + 16);
icoHeader.writeUInt16LE(0, 0); // reserved
icoHeader.writeUInt16LE(1, 2); // type 1 = ICO
icoHeader.writeUInt16LE(1, 4); // count = 1
icoHeader[6] = 0; // 256 px
icoHeader[7] = 0; // 256 px
icoHeader[8] = 0;
icoHeader[9] = 0;
icoHeader.writeUInt16LE(1, 10); // planes
icoHeader.writeUInt16LE(32, 12); // bpp
icoHeader.writeUInt32LE(pngBuf.length, 14);
icoHeader.writeUInt32LE(22, 18); // offset

const icoPath = path.join(__dirname, 'editor-dwg-pci.ico');
fs.writeFileSync(icoPath, Buffer.concat([icoHeader, pngBuf]));
console.log('Icon created:', icoPath, pngBuf.length, 'bytes');
