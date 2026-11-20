// Vice Sunset Cover Studio — entry program (Node 22, standard library only).
// Copies app/ and screenshots/ from beside this file into the output
// directory and writes dossier.json with buildDossier. Two runs write
// byte-identical output: no timestamps, no randomness, files copied as
// they are, and the dossier is deterministic.
//
// The output directory itself is never deleted: the grader mounts it as a
// writable directory under a read-only filesystem, so removing it fails
// with EACCES. Only its contents are removed, and every child is made
// writable first, because files copied from a read-only repository
// arrive read-only and a read-only directory cannot be emptied.
//
// Usage: MAKEFUN_OUTPUT_DIR=out node main.ts   (defaults to /output)
import { chmodSync, cpSync, lstatSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

/** Make a path and everything under it writable, so it can be removed. */
function makeWritable(path: string): void {
  try {
    const st = lstatSync(path);
    if (st.isDirectory()) {
      chmodSync(path, 0o700);
      for (const name of readdirSync(path)) makeWritable(join(path, name));
    } else {
      chmodSync(path, 0o600);
    }
  } catch {
    // A file we cannot chmod can still be removed while its parent is writable.
  }
}

/** Empty a directory without removing the directory itself. */
function emptyDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    makeWritable(path);
    rmSync(path, { recursive: true, force: true });
  }
}

emptyDir(out);
for (const name of ['app', 'screenshots']) {
  cpSync(join(here, name), join(out, name), { recursive: true });
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
