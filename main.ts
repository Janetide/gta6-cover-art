// Vice Sunset Cover Studio — entry program (Node 22, standard library only).
// Copies app/ and screenshots/ from beside this file into the output
// directory and writes /output/dossier.json with buildDossier. Two runs
// write byte-identical output: no timestamps, no randomness, files copied
// in sorted order.
//
// Usage: MAKEFUN_OUTPUT_DIR=out node main.ts   (defaults to /output)
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// Copy app/ and screenshots/ in deterministic (sorted) order.
for (const name of ['app', 'screenshots']) {
  const src = join(here, name);
  const dest = join(out, name);
  mkdirSync(dest, { recursive: true });
  const entries = readdirSync(src, { withFileTypes: true }).sort((a, b) =>
    (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    cpSync(join(src, entry.name), join(dest, entry.name), { recursive: true });
  }
}

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`wrote ${out} (dossier.json: ${dossier.length} bytes)`);
