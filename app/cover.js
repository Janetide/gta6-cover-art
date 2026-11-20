// cover.js — the cover renderer for Vice Sunset Cover Studio.
//
// Pure canvas drawing: panel layouts, colour grades, procedural décor
// (sun, skyline, palms, scanlines, vignette, grain) and photo placement.
// No network, no external assets; the only font is the bundled Oswald
// (app/fonts/Oswald[wght].ttf, SIL Open Font License).

// ------------------------------------------------------------------ layouts

// Every layout is a function of the cover's width and height and returns
// the panel rectangles, in pixels, in the panels region above the title
// band. The gap between panels lets the sunset background show through.
export const LAYOUTS = {
  marquee: (W, H, g) => [
    { x: 0, y: 0, w: W, h: H * 0.58 },
    { x: 0, y: H * 0.58 + g, w: W * 0.5 - g / 2, h: H * 0.42 - g },
    { x: W * 0.5 + g / 2, y: H * 0.58 + g, w: W * 0.5 - g / 2, h: H * 0.42 - g },
  ],
  columns: (W, H, g) => [
    { x: 0, y: 0, w: W * 0.42, h: H },
    { x: W * 0.42 + g, y: 0, w: W * 0.58 - g, h: H * 0.5 - g / 2 },
    { x: W * 0.42 + g, y: H * 0.5 + g / 2, w: W * 0.58 - g, h: H * 0.5 - g / 2 },
  ],
  mosaic: (W, H, g) => [
    { x: 0, y: 0, w: W * 0.5 - g / 2, h: H * 0.5 - g / 2 },
    { x: W * 0.5 + g / 2, y: 0, w: W * 0.5 - g / 2, h: H * 0.5 - g / 2 },
    { x: 0, y: H * 0.5 + g / 2, w: W * 0.5 - g / 2, h: H * 0.5 - g / 2 },
    { x: W * 0.5 + g / 2, y: H * 0.5 + g / 2, w: W * 0.5 - g / 2, h: H * 0.5 - g / 2 },
  ],
  spotlight: (W, H) => [{ x: 0, y: 0, w: W, h: H }],
};

export const LAYOUT_NAMES = {
  marquee: 'Marquee',
  columns: 'Columns',
  mosaic: 'Mosaic',
  spotlight: 'Spotlight',
};

// ------------------------------------------------------------------- grades

// A grade is a palette: the sky behind the panels, the sun, the tint laid
// over each photo, the title band and the accent used for the subtitle.
export const GRADES = {
  'golden-hour': {
    sky: ['#2b1055', '#7597de', '#ff9a5a', '#ffd194'],
    sun: '#ffe259',
    sunCore: '#fff7ae',
    tint: 'rgba(255, 122, 26, 0.20)',
    band: '#1c0b2e',
    bandText: '#ffffff',
    accent: '#ffb347',
    silhouette: 'rgba(24, 8, 40, 0.88)',
  },
  'neon-nights': {
    sky: ['#0f0c29', '#302b63', '#ff2e88', '#00e5ff'],
    sun: '#ff2e88',
    sunCore: '#ff8ac2',
    tint: 'rgba(255, 46, 136, 0.18)',
    band: '#0d0221',
    bandText: '#ffffff',
    accent: '#00e5ff',
    silhouette: 'rgba(8, 4, 28, 0.88)',
  },
  'vice-glow': {
    sky: ['#240b36', '#7b2fbe', '#c642c3', '#f7b733'],
    sun: '#f7b733',
    sunCore: '#fff3b0',
    tint: 'rgba(123, 47, 190, 0.20)',
    band: '#160a24',
    bandText: '#ffffff',
    accent: '#e879f9',
    silhouette: 'rgba(18, 6, 32, 0.88)',
  },
  'mono-noir': {
    sky: ['#111111', '#3a3a3a', '#8a8a8a', '#e8e4d8'],
    sun: '#f5f0e1',
    sunCore: '#ffffff',
    tint: 'rgba(20, 20, 20, 0.16)',
    band: '#0d0d0d',
    bandText: '#f5f0e1',
    accent: '#d8c690',
    silhouette: 'rgba(10, 10, 10, 0.9)',
  },
};

export const GRADE_NAMES = {
  'golden-hour': 'Golden Hour',
  'neon-nights': 'Neon Nights',
  'vice-glow': 'Vice Glow',
  'mono-noir': 'Mono Noir',
};

// -------------------------------------------------------------------- random

// A tiny seeded generator so every render of the same state draws the
// same grain and the same skyline: two runs must write identical bytes.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ drawing

// Draw one photo into a panel, cover-fit, with the panel's zoom and pan.
// ox and oy are in [-1, 1]: 0 centres the photo, +/-1 pushes it to an edge.
export function drawPhotoPanel(ctx, img, rect, zoom, ox, oy) {
  if (!img || !img.naturalWidth) return;
  const s = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * zoom;
  const sw = img.naturalWidth * s;
  const sh = img.naturalHeight * s;
  const dx = rect.x + (rect.w - sw) / 2 + ox * Math.max(0, (sw - rect.w) / 2);
  const dy = rect.y + (rect.h - sh) / 2 + oy * Math.max(0, (sh - rect.h) / 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, sw, sh);
  ctx.restore();
}

// The retro sun: a gradient disc with three dark slats across its lower half.
function drawSun(ctx, x, y, r, grade) {
  const glow = ctx.createRadialGradient(x, y, r * 0.1, x, y, r * 1.7);
  glow.addColorStop(0, grade.sun);
  glow.addColorStop(0.55, grade.sun);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const disc = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r);
  disc.addColorStop(0, grade.sunCore);
  disc.addColorStop(0.7, grade.sun);
  disc.addColorStop(1, grade.sun);
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(10, 4, 20, 0.45)';
  for (let i = 0; i < 3; i++) {
    const sy = y + r * (0.08 + i * 0.26);
    const half = Math.sqrt(Math.max(0, r * r - (sy - y) * (sy - y)));
    ctx.fillRect(x - half, sy, half * 2, r * 0.07);
  }
}

// A city skyline along the bottom of a rectangle: dark towers with a few
// lit windows, drawn from a seeded generator so it never changes.
function drawSkyline(ctx, rect, grade, seed) {
  const rnd = mulberry32(seed);
  const base = rect.y + rect.h;
  ctx.fillStyle = grade.silhouette;
  let x = rect.x;
  while (x < rect.x + rect.w) {
    const bw = rect.w * (0.05 + rnd() * 0.07);
    const bh = rect.h * (0.18 + rnd() * 0.42);
    ctx.fillRect(x, base - bh, bw, bh);
    if (rnd() > 0.55) ctx.fillRect(x + bw * 0.3, base - bh - rect.h * 0.08, bw * 0.4, rect.h * 0.08);
    x += bw + rect.w * 0.012;
  }
  // Lit windows: a sparse scatter of small accent dots.
  ctx.fillStyle = grade.accent;
  for (let i = 0; i < 26; i++) {
    const wx = rect.x + rnd() * rect.w;
    const wy = base - rect.h * (0.06 + rnd() * 0.5);
    ctx.globalAlpha = 0.35 + rnd() * 0.55;
    ctx.fillRect(wx, wy, Math.max(2, rect.w * 0.004), Math.max(2, rect.h * 0.008));
  }
  ctx.globalAlpha = 1;
}

// One palm silhouette: a curved trunk, a crown of full drooping fronds
// drawn as tapered blades (not thin strokes, which read as sticks at
// cover size), and a small cluster of coconuts under the crown.
function drawPalm(ctx, x, y, h, lean, grade) {
  ctx.strokeStyle = grade.silhouette;
  ctx.fillStyle = grade.silhouette;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(4, h * 0.055);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean * h * 0.25, y - h * 0.55, x + lean * h * 0.42, y - h);
  ctx.stroke();
  const topX = x + lean * h * 0.42;
  const topY = y - h;
  // Eight fronds fanning from the crown: each is a filled blade that
  // starts wide at the crown, arcs outward and tapers to a drooping tip.
  for (let i = 0; i < 8; i++) {
    const a = (-Math.PI / 5) - (i * Math.PI) / 9 + (lean > 0 ? 0.3 : -0.3);
    const len = h * (0.5 + (i % 3) * 0.08);
    const tipX = topX + Math.cos(a) * len;
    const tipY = topY + Math.sin(a) * len * 0.6 + h * 0.26;
    const midX = topX + Math.cos(a) * len * 0.55;
    const midY = topY + Math.sin(a) * len * 0.4 - h * 0.1;
    const spread = h * 0.045;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(midX - spread, midY - spread, tipX, tipY);
    ctx.quadraticCurveTo(midX + spread, midY + spread, topX, topY);
    ctx.fill();
  }
  // Coconuts: three small discs tucked under the crown.
  ctx.beginPath();
  ctx.arc(topX - h * 0.03, topY + h * 0.04, h * 0.035, 0, Math.PI * 2);
  ctx.arc(topX + h * 0.04, topY + h * 0.05, h * 0.03, 0, Math.PI * 2);
  ctx.arc(topX + h * 0.005, topY + h * 0.085, h * 0.028, 0, Math.PI * 2);
  ctx.fill();
}

// The title band across the bottom: solid band, big display title with a
// dark outline, letter-spaced subtitle, accent rule underneath.
function drawTitleBand(ctx, W, H, bandY, bandH, grade, title, subtitle) {
  ctx.fillStyle = grade.band;
  ctx.fillRect(0, bandY, W, bandH);
  ctx.fillStyle = grade.accent;
  ctx.fillRect(W * 0.06, bandY, W * 0.1, Math.max(3, H * 0.006));
  const titleSize = Math.min(bandH * 0.52, W * 0.085);
  ctx.font = `600 ${titleSize}px Oswald, 'Arial Narrow', sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, titleSize * 0.09);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.strokeText(title.toUpperCase(), W * 0.06, bandY + bandH * 0.42);
  ctx.fillStyle = grade.bandText;
  ctx.fillText(title.toUpperCase(), W * 0.06, bandY + bandH * 0.42);
  const subSize = Math.max(12, bandH * 0.17);
  ctx.font = `500 ${subSize}px Oswald, 'Arial Narrow', sans-serif`;
  ctx.fillStyle = grade.accent;
  const spaced = subtitle.toUpperCase().split('').join('  ');
  ctx.fillText(spaced, W * 0.06, bandY + bandH * 0.82);
}

// Scanlines, vignette and grain over the whole cover.
function drawFinish(ctx, W, H) {
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = '#000000';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  ctx.restore();
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vg.addColorStop(1, 'rgba(0, 0, 0, 0.26)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  const rnd = mulberry32(20261120);
  const n = Math.floor((W * H) / 900);
  for (let i = 0; i < n; i++) {
    const gx = rnd() * W;
    const gy = rnd() * H;
    ctx.globalAlpha = 0.03 + rnd() * 0.05;
    ctx.fillStyle = rnd() > 0.5 ? '#ffffff' : '#000000';
    ctx.fillRect(gx, gy, 1.4, 1.4);
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------- export

// The cover's geometry for a render: the panels region, the title band
// and the panel rectangles for the chosen layout.
export function coverGeometry(W, H, layout) {
  const bandH = Math.round(H * 0.18);
  const panelsH = H - bandH;
  const gap = Math.max(6, Math.round(W * 0.022));
  const frame = Math.max(8, Math.round(W * 0.02));
  const inner = { x: frame, y: frame, w: W - frame * 2, h: panelsH - frame };
  const rects = LAYOUTS[layout](inner.w, inner.h, gap).map((r) => ({
    x: r.x + inner.x,
    y: r.y + inner.y,
    w: r.w,
    h: r.h,
  }));
  return { bandH, bandY: panelsH, gap, frame, rects };
}

// Draw the whole cover into ctx at W x H.
// state: { layout, grade, title, subtitle, panels: [{ photo, zoom, ox, oy }] }
// photos: an array of loaded Image objects; panels[i].photo indexes it.
export function drawCover(ctx, W, H, state, photos) {
  const grade = GRADES[state.grade] ?? GRADES['golden-hour'];
  const geo = coverGeometry(W, H, state.layout);
  // Sunset sky behind the panels, showing through the gaps and frame.
  const sky = ctx.createLinearGradient(0, 0, 0, geo.bandY);
  sky.addColorStop(0, grade.sky[0]);
  sky.addColorStop(0.45, grade.sky[1]);
  sky.addColorStop(0.75, grade.sky[2]);
  sky.addColorStop(1, grade.sky[3]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, geo.bandY);
  // Photos, one per panel, with the grade's tint over each.
  geo.rects.forEach((rect, i) => {
    const slot = state.panels[i] ?? { photo: 0, zoom: 1, ox: 0, oy: 0 };
    const img = photos[slot.photo];
    drawPhotoPanel(ctx, img, rect, slot.zoom ?? 1, slot.ox ?? 0, slot.oy ?? 0);
    ctx.fillStyle = grade.tint;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  });
  // Décor over the hero panel: sun top-right, skyline and palms low.
  const hero = geo.rects[0];
  if (hero) {
    drawSun(ctx, hero.x + hero.w * 0.8, hero.y + hero.h * 0.26, Math.min(hero.w, hero.h) * 0.17, grade);
    drawSkyline(ctx, { x: hero.x, y: hero.y + hero.h * 0.62, w: hero.w, h: hero.h * 0.38 }, grade, 7);
    drawPalm(ctx, hero.x + hero.w * 0.06, hero.y + hero.h * 0.98, hero.h * 0.34, -1, grade);
    drawPalm(ctx, hero.x + hero.w * 0.94, hero.y + hero.h * 0.98, hero.h * 0.28, 1, grade);
  }
  drawTitleBand(ctx, W, H, geo.bandY, geo.bandH, grade, state.title, state.subtitle);
  drawFinish(ctx, W, H);
}

// Render the cover at W x H onto a fresh canvas and return it.
export function renderCover(W, H, state, photos) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  drawCover(canvas.getContext('2d'), W, H, state, photos);
  return canvas;
}
