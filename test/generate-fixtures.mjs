// Generates test/tmp/test-images.html with valid base64 PNG data URIs.
// - 3x 100x100 solid-color PNGs (red, green, blue) — above MIN_IMAGE_SIZE(50)
// - 1x 30x30 gray PNG — below MIN_IMAGE_SIZE, should be skipped
//
// Uses raw PNG construction (signature + IHDR + IDAT + IEND chunks)
// with zlib.deflateSync for the image data. No external deps needed.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, 'tmp');
mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function makePng(width, height, r, g, b) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: width, height, bit depth 8, color type 2 (RGB)
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type: RGB
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  // IDAT: raw pixel data with filter byte 0 (None) per row
  const rowBytes = 1 + width * 3; // filter byte + RGB per pixel
  const raw = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y++) {
    const offset = y * rowBytes;
    raw[offset] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const px = offset + 1 + x * 3;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
    }
  }
  const compressed = deflateSync(raw);
  const idat = makeChunk('IDAT', compressed);

  // IEND
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

const images = [
  { width: 100, height: 100, r: 255, g: 0, b: 0, label: 'red' },
  { width: 100, height: 100, r: 0, g: 255, b: 0, label: 'green' },
  { width: 100, height: 100, r: 0, g: 0, b: 255, label: 'blue' },
  { width: 30, height: 30, r: 128, g: 128, b: 128, label: 'gray-small' },
];

const imgTags = images.map(({ width, height, r, g, b, label }) => {
  const png = makePng(width, height, r, g, b);
  const dataUri = `data:image/png;base64,${png.toString('base64')}`;
  return `  <img src="${dataUri}" width="${width}" height="${height}" alt="${label}" data-testid="${label}">`;
});

const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Image Blocker Test</title></head>
<body>
${imgTags.join('\n')}
</body>
</html>
`;

writeFileSync(join(outDir, 'test-images.html'), html);
console.log('Generated test/tmp/test-images.html');
