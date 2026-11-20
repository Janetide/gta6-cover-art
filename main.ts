// Vice Sunset Cover Studio — entry program (Node 22, standard library only).
// Copies app/ and screenshots/ from beside this file into the output
// directory and writes /output/dossier.json with buildDossier. Two runs
// write byte-identical output: the copy order is sorted, no timestamps and
// no randomness are written anywhere.
//
// The output directory itself is never removed: in the grader it is a
// mount point whose parent is read-only, so deleting it fails. Only its
// contents are cleared, and every child is made writable first, because
// files copied from a read-only repository arrive read-only.
//
// Usage: MAKEFUN_OUTPUT_DIR=out node main.ts   (defaults to /output)
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

/** Make a path and everything under it writable, so it can be removed. */
function makeWritable(path: string): void {
  const st = lstatSync(path);
  if (st.isDirectory()) {
    chmodSync(path, 0o777);
    for (const name of readdirSync(path).sort()) makeWritable(join(path, name));
  } else {
    chmodSync(path, 0o666);
  }
}

/** Empty a directory without removing the directory itself. */
function clearContents(dir: string): void {
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(dir).sort()) {
    const child = join(dir, name);
    makeWritable(child);
    rmSync(child, { recursive: true, force: true });
  }
}

clearContents(out);

// Copy app/ and screenshots/ in deterministic (sorted) order.
for (const name of ['app', 'screenshots']) {
  const src = join(here, name);
  if (!existsSync(src)) continue;
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
