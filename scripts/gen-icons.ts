import sharp from "sharp";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(resolve(__dirname, "icon.svg"));
const pub = resolve(__dirname, "..", "public");

// Standard icons (with the rounded-corner art baked in).
await sharp(svg).resize(192, 192).png().toFile(resolve(pub, "icon-192.png"));
await sharp(svg).resize(512, 512).png().toFile(resolve(pub, "icon-512.png"));

// Maskable icon: full-bleed navy background with the monogram centered inside
// the safe zone (so platform-applied masks don't clip the glyph).
const maskable = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0e1320"/>
        <stop offset="1" stop-color="#060912"/>
      </linearGradient>
      <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f4dd92"/>
        <stop offset="1" stop-color="#d4af37"/>
      </linearGradient>
    </defs>
    <rect width="512" height="512" fill="url(#bg)"/>
    <g transform="translate(128 128) scale(0.5)">
      <path d="M256 118 L356 394 L312 394 L290 330 L222 330 L200 394 L156 394 Z M236 290 L276 290 L256 226 Z" fill="url(#gold)"/>
    </g>
  </svg>`,
);
await sharp(maskable).resize(512, 512).png().toFile(resolve(pub, "icon-maskable-512.png"));

console.log("Icons generated.");
