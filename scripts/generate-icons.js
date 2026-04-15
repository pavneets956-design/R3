const sharp = require('sharp');
const path = require('path');

const svgPath = path.join(__dirname, 'icon.svg');
const outDir = path.join(__dirname, '..', 'icons');

const sizes = [16, 48, 128];

async function generate() {
  for (const size of sizes) {
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(path.join(outDir, `icon${size}.png`));
    console.log(`icon${size}.png`);
  }
}

generate().catch(console.error);
