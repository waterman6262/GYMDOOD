// Builds the PWA icons in public/icons from SVG. Run: npm run icons
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const BRAND = "#4f46e5";

// A white dumbbell; `scale` shrinks it for the maskable icon's safe zone.
function dumbbell(scale) {
  const s = (n) => 256 + (n - 256) * scale;
  const bar = `<rect x="${s(150)}" y="${s(240)}" width="${s(362) - s(150)}" height="${s(272) - s(240)}" rx="${8 * scale}" fill="#fff"/>`;
  const plates = [
    [96, 176, 48, 160],
    [140, 200, 32, 112],
    [340, 200, 32, 112],
    [368, 176, 48, 160],
  ]
    .map(([x, y, w, h]) => `<rect x="${s(x)}" y="${s(y)}" width="${w * scale}" height="${h * scale}" rx="${12 * scale}" fill="#fff"/>`)
    .join("");
  return bar + plates;
}

const regular = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${BRAND}"/>${dumbbell(1)}
</svg>`;

// Maskable: full-bleed background, artwork inside the central 80% safe zone.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BRAND}"/>${dumbbell(0.8)}
</svg>`;

await mkdir("public/icons", { recursive: true });
await writeFile("public/icons/icon.svg", regular);

const outputs = [
  ["public/icons/icon-192.png", regular, 192],
  ["public/icons/icon-512.png", regular, 512],
  ["public/icons/icon-maskable-512.png", maskable, 512],
  // iOS draws its own rounded corners, so use the full-bleed artwork.
  ["public/icons/apple-touch-icon.png", maskable, 180],
];
for (const [file, svg, size] of outputs) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(file);
  console.log("wrote", file);
}
