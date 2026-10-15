import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPng(width, height, r, g, b, hasCenterGlyph = true, isMaskable = false) {
  // Simple solid rounded square icon with inner circular orbit and clock face
  const rawData = Buffer.alloc(height * (width * 4 + 1));
  const cx = width / 2;
  const cy = height / 2;
  const outerR = width * 0.46;
  const innerR = width * 0.22;
  const orbitR = width * 0.35;

  let pos = 0;
  for (let y = 0; y < height; y++) {
    rawData[pos++] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Maskable icons fill entire background
      if (isMaskable) {
        if (dist > innerR + 10 && dist < innerR + 18) {
          // Inner orbit ring
          rawData[pos++] = 129; // R
          rawData[pos++] = 140; // G
          rawData[pos++] = 248; // B
          rawData[pos++] = 255; // A
        } else if (dist <= innerR) {
          // Clock center
          rawData[pos++] = 15;
          rawData[pos++] = 23;
          rawData[pos++] = 42;
          rawData[pos++] = 255;
        } else {
          // Background indigo
          rawData[pos++] = 79;
          rawData[pos++] = 70;
          rawData[pos++] = 229;
          rawData[pos++] = 255;
        }
      } else {
        // Standard icon with rounded corners
        const cornerDist = Math.max(Math.abs(dx) - (width / 2 - 24), 0);
        const cornerDistY = Math.max(Math.abs(dy) - (height / 2 - 24), 0);
        const cDist = Math.sqrt(cornerDist * cornerDist + cornerDistY * cornerDistY);

        if (cDist > 24) {
          // Transparent outside rounded corners
          rawData[pos++] = 0;
          rawData[pos++] = 0;
          rawData[pos++] = 0;
          rawData[pos++] = 0;
        } else if (dist <= innerR) {
          // Center core
          rawData[pos++] = 15;
          rawData[pos++] = 23;
          rawData[pos++] = 42;
          rawData[pos++] = 255;
        } else if (dist >= orbitR - 4 && dist <= orbitR + 4) {
          // Orbit ring
          rawData[pos++] = 56;
          rawData[pos++] = 189;
          rawData[pos++] = 248;
          rawData[pos++] = 255;
        } else {
          // Base gradient
          rawData[pos++] = 79;
          rawData[pos++] = 70;
          rawData[pos++] = 229;
          rawData[pos++] = 255;
        }
      }
    }
  }

  // Compress IDAT
  const compressed = zlib.deflateSync(rawData);

  // Helper for CRC32
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    crcTable[n] = c;
  }
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const chunkData = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(chunkData), 0);
    return Buffer.concat([len, chunkData, crcBuf]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type (RGBA)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write PNG files
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPng(192, 192, 79, 70, 229, true, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPng(512, 512, 79, 70, 229, true, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPng(512, 512, 79, 70, 229, true, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180, 79, 70, 229, true, false));

console.log('Successfully generated PWA PNG icons in public/');
