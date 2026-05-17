// Generate PNG variants of the source SVGs in public/. Run via
// `npm run gen-rasters`. The PNGs are checked into the repo (small,
// stable, and we want them in production immediately without a build
// step). Re-run + commit whenever favicon.svg or og-image.svg change.
//
// Outputs:
//   favicon-32x32.png       (browser tab)
//   apple-touch-icon.png    (iOS home screen, 180×180)
//   icon-192.png            (PWA / Android home screen)
//   icon-512.png            (PWA large icon)
//   og-image.png            (social unfurls, 1200×630)

import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

interface Job {
  source: string;
  outName: string;
  width: number;
  height: number;
}

const JOBS: Job[] = [
  { source: 'favicon.svg',  outName: 'favicon-32x32.png',    width: 32,   height: 32 },
  { source: 'favicon.svg',  outName: 'apple-touch-icon.png', width: 180,  height: 180 },
  { source: 'favicon.svg',  outName: 'icon-192.png',         width: 192,  height: 192 },
  { source: 'favicon.svg',  outName: 'icon-512.png',         width: 512,  height: 512 },
  { source: 'og-image.svg', outName: 'og-image.png',         width: 1200, height: 630 },
];

async function run(job: Job): Promise<void> {
  const srcPath = path.join(PUBLIC, job.source);
  const outPath = path.join(PUBLIC, job.outName);
  const svg = await fs.readFile(srcPath);
  await sharp(svg, { density: 384 })
    .resize(job.width, job.height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  const stat = await fs.stat(outPath);
  const kb = (stat.size / 1024).toFixed(1);
  console.log(`✓ ${job.outName.padEnd(24)} ${job.width}×${job.height}  (${kb} kB)`);
}

(async () => {
  console.log(`Generating PNGs from public/*.svg → ${PUBLIC}`);
  try {
    for (const job of JOBS) await run(job);
    console.log('Done.');
  } catch (err) {
    console.error('Failed:', err);
    process.exit(1);
  }
})();
