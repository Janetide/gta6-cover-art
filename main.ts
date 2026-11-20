// main.ts — hands Vice Sunset Cover Studio in for gta6-cover-art-01.
//
// Node 22, standard library only. It copies app/ and screenshots/ from
// beside this file into the output directory and writes dossier.json
// with the vendored make.fun library.
//
// The grader runs this program as an unprivileged user on a read-only
// filesystem with a writable output mount, so it must never delete the
// output directory itself: it only clears the directory's contents, and
// it makes children writable first, because copied files arrive
// read-only and a second run could not remove them otherwise.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Remove one entry and everything under it, making each child writable
// first so read-only copies from an earlier run do not block the removal.
// A directory is made writable BEFORE its children are removed: deleting
// a file needs write permission on its parent directory, not just on the
// file itself. The entry itself is removed; the caller keeps the parent.
function removeWritable(path: string): void {
  const st = lstatSync(path);
  if (st.isDirectory()) {
    chmodSync(path, 0o755);
    for (const name of readdirSync(path)) removeWritable(join(path, name));
  } else {
    chmodSync(path, 0o644);
  }
  rmSync(path, { recursive: true, force: true });
}

// Empty a directory without deleting the directory itself.
function clearContents(dir: string): void {
  for (const name of readdirSync(dir)) removeWritable(join(dir, name));
}

mkdirSync(out, { recursive: true });
clearContents(out);
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse (more
// than 4 screenshots or one over 256 KiB; more than 993 files in app/
// or 48 MiB of app files, in all, or a path under app/ over 1000 bytes:
// app/ counts beside /output's own 1000-entry cap, its screenshots/ and
// dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
