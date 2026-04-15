const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

// CRC32 table
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) | 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.concat([t, data]);
  const crc = crc32(crcBuf);
  const crcOut = Buffer.alloc(4);
  crcOut.writeInt32BE(crc);
  return Buffer.concat([len, t, data, crcOut]);
}

function createPNG(size, r, g, b) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB color type
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Raw image data (RGB, filter byte 0 per row)
  const rowSize = 1 + size * 3;
  const raw = Buffer.alloc(size * rowSize);
  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0; // filter type: None
    for (let x = 0; x < size; x++) {
      const i = y * rowSize + 1 + x * 3;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b;
    }
  }

  const compressed = zlib.deflateSync(raw);

  const ihdrChunk = chunk('IHDR', ihdr);
  const idatChunk = chunk('IDAT', compressed);
  const iendChunk = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const sizes = [16, 48, 128];
const outDir = path.join(__dirname, '..', 'icons');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

for (const size of sizes) {
  // R3 orange: #ff4500 = rgb(255, 69, 0)
  const png = createPNG(size, 255, 69, 0);
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), png);
  console.log(`icon${size}.png (${size}x${size})`);
}
