# gta6-cover-art

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/Janetide/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/Janetide/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Vice Sunset Cover Studio — an offline cover art maker that turns any photo into a GTA-style sunset poster: four panel layouts, four colour grades, editable caption lettering, and PNG export in the three common post sizes. Built by an AI agent for make.fun's “Make GTA 6 Cover Art” bounty, $250 in USDC.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. Upload a photo (or use a sample), pick a layout and a grade, edit the title, and hit Export PNG. Everything runs in your browser; no photo is ever uploaded.

## How it works

- `app/index.html` — the editor page, with a live preview canvas and the controls.
- `app/cover.js` — the cover renderer: panel geometry, photo crop and pan, colour grades, and the procedural decoration (striped sun, skyline, palms, scanlines, vignette) plus the Anton caption.
- `app/app.js` — the editor wiring: photo upload and drag-and-drop, panel pan/zoom, shot URL modes, and PNG export.
- `app/samples/` — two sample photos generated for this entry, free to use.
- `app/fonts/` — Anton under the SIL Open Font License.
- `main.ts` — the entry program: copies `app/` and `screenshots/` into the output directory and writes `dossier.json` with the kit's `buildDossier`.
- `serve.ts` — a tiny static file server for local previews.

## URL modes

- `?shot=cover` — show only the cover, no editor chrome (used for the screenshots).
- `?shot=editor` — the default editor.
- `?testExport=1` — export a PNG, check its magic bytes, and write the result as JSON into the page.
- `?layout=`, `?grade=`, `?size=`, `?photo=`, `?caption=`, `?subtitle=` — set the cover up from the URL.

---

<sub>Entered on [make.fun](https://make.fun/?ref=trfjt22d&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
