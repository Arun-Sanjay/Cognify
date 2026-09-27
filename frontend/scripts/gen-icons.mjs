// One-off: generate PWA icons from public/favicon.svg using sharp.
// Run: node scripts/gen-icons.mjs   (sharp is a devDependency)
import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'node:fs'

const SVG = readFileSync(new URL('../public/favicon.svg', import.meta.url))
const OUT = new URL('../public/icons/', import.meta.url)
mkdirSync(OUT, { recursive: true })

const file = (name) => new URL(name, OUT).pathname

// "any" icons — the favicon already sits on an opaque #06070A rounded square.
async function plain(name, size) {
  await sharp(SVG, { density: 512 }).resize(size, size).png().toFile(file(name))
}

// maskable — logo at ~80% on a full-bleed #06070A square (Android safe zone).
async function maskable(name, size) {
  const inner = Math.round(size * 0.8)
  const logo = await sharp(SVG, { density: 512 }).resize(inner, inner).png().toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: '#06070A' } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(file(name))
}

await plain('pwa-192.png', 192)
await plain('pwa-512.png', 512)
await plain('apple-touch-icon.png', 180)
await maskable('maskable-192.png', 192)
await maskable('maskable-512.png', 512)

console.log('PWA icons written to public/icons/')
