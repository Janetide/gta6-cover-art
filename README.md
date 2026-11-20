# gta6-cover-art

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/Janetide/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/Janetide/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Vice Sunset Cover Studio — an offline, canvas-based cover art maker in the style of a GTA 6 poster. Load any photo (or use the two built-in sunset samples), arrange it across four multi-panel layouts, pick one of four colour grades, write your title in tall Bebas Neue lettering over a procedural sunset skyline, and export a PNG in the common post sizes. Everything runs from static files in the browser: your photos never leave your machine.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080.

## What it does

- **Any photo**: upload your own (file picker or drag-and-drop) or use the built-in boulevard and pier samples. Fill several panels with one photo or several.
- **Crop and position per panel**: click a panel, drag to pan, scroll to zoom (1×–3×), or use the zoom slider, zoom buttons and recenter.
- **Four layouts**: Hero + Trio, Diagonal Bands, Four Corners and Full Bleed.
- **Four grades**: Sunset, Neon Night, Vice Gold and Noir — each with its own sky, tint, title colour and frame.
- **Procedural art**: a gradient sunset sky, a glowing sun, a skyline silhouette with lit windows, palm silhouettes, scanlines, vignette and grain — all drawn in code, no stock art.
- **Editable caption**: title and subtitle, lettered in Bebas Neue (bundled under the SIL Open Font License) with a sans-serif fallback.
- **Export**: PNG at 1080 × 1080, 1080 × 1350 and 1920 × 1080, one click.

## URL modes

- `?shot=cover` shows only the cover, no editor chrome — handy for screenshots.
- `?shot=editor` is the default editor (also `?photo=boulevard|pier&caption=…&subtitle=…&layout=…&grade=…&size=…` to pre-fill a scene).
- `?testExport=1` exports all three sizes, checks the PNG magic bytes and writes the result as JSON into the page.

## Files

- `app/` — the web app as static files: `index.html`, `style.css`, `cover.js` (the renderer), `app.js` (the editor), `samples/` (two procedural sunset photos), `fonts/` (Bebas Neue + its OFL text).
- `screenshots/` — four captures of the app running in a browser.
- `main.ts` — the entry program: copies `app/` and `screenshots/` to the output directory and writes `dossier.json` with the kit's `vendor/makefun-app.ts`.
- `serve.ts` — a tiny static file server for trying the app locally.

---

<sub>Entered on [make.fun](https://make.fun/?ref=trfjt22d&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
