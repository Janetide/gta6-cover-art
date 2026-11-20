// Vice Sunset Cover Studio — entry program (Node 22, standard library only).
// Stages app/ and screenshots/ into the output directory and writes
// dossier.json there with buildDossier. Runs are deterministic: files are
// copied in sorted order and nothing time-stamped or random is written, so
// two runs produce byte-identical output.
//
// The output directory itself is never removed. On the grader it is a
// writable mount whose parent is read-only, so deleting the directory
// itself fails with EACCES; only the things inside it are cleared. And
// staged copies inherit the source tree's read-only modes, so each child
// is made writable before it is removed — without write permission on a
// directory, the entries inside it cannot be unlinked, and a second run
// would fail on the leftovers of the first.
//
// Usage: MAKEFUN_OUTPUT_DIR=out node main.ts   (defaults to /output)
import { chmodSync, cpSync, lstatSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

// Recursively add owner-write to a tree so it can be removed. Symlinks
// are left alone: unlinking a link needs no write permission on its target.
function makeWritable(path) {
  const st = lstatSync(path);
  if (st.isSymbolicLink()) return;
  if (st.isDirectory()) {
    for (const child of readdirSync(path)) makeWritable(join(path, child));
  }
  chmodSync(path, (st.mode & 0o777) | 0o200);
}

// Make sure the output directory exists, then empty it without removing it.
mkdirSync(out, { recursive: true });
for (const child of readdirSync(out)) {
  const p = join(out, child);
  makeWritable(p);
  rmSync(p, { recursive: true, force: true });
}

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
