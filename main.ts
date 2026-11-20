// Vice Sunset Cover Studio — entry program for make.fun's gta6-cover-art-01.
// Copies app/ and screenshots/ into the output directory and writes
// dossier.json with the kit's buildDossier.
//
// The grader runs this as user 65534 on a read-only filesystem with a
// writable output mount, twice, each time in a fresh sandbox. Two rules
// follow from that and are the whole point of the helpers below:
//   1. The output directory itself is never removed — only its contents.
//      Removing the directory itself fails with EACCES on the read-only
//      parent, so clearContents() empties it instead.
//   2. Files copied into the output arrive read-only, so a second run
//      cannot unlink them unless they are made writable first.
//      makeWritableDeep() chmods every child before it is removed.
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Walk a path and give every directory and file write permission, so a
// later rmSync can remove it even when it arrived read-only.
function makeWritableDeep(path: string): void {
  const st = statSync(path);
  if (st.isDirectory()) {
    for (const entry of readdirSync(path)) makeWritableDeep(join(path, entry));
    chmodSync(path, 0o755);
  } else {
    chmodSync(path, 0o644);
  }
}

// Remove everything inside a directory, never the directory itself.
function clearContents(dir: string): void {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    makeWritableDeep(path);
    rmSync(path, { recursive: true, force: true });
  }
}

mkdirSync(out, { recursive: true });
clearContents(out);
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), {
    recursive: true,
  });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse (more than
// 4 screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB
// of app files, in all, or a path under app/ over 1000 bytes).
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
