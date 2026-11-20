// Vice Sunset Cover Studio — cover renderer.
// Draws a multi-panel GTA-poster-style cover onto a canvas from plain state:
// layout, grade, title, subtitle and one photo per panel. Every decoration
// (sun, skyline, palms, birds) is drawn procedurally in code; nothing here
// loads Rockstar artwork, logos or fonts.

'use strict';

/** Export sizes the app offers, in pixels. */
export const EXPORT_SIZES = [
  { id: '1080x1080', w: 1080, h: 1080, label: 'Square 1080 × 1080' },
  { id: '1080x1350', w: 1080, h: 1350, label: 'Portrait 1080 × 1350' },
  { id: '1920x1080', w: 1920, h: 1080, label: 'Landscape 1920 × 1080' },
];

/** Panel layouts the cover can use. */
export const LAYOUTS = [
  { id: 'diagonal', label: 'Diagonal 3-panel' },
  { id: 'grid', label: 'Neon 2 × 2 grid' },
  { id: 'hero', label: 'Hero + 2 small' },
  { id: 'full', label: 'Full bleed' },
];

/** Colour grades applied over the photos. */
export const GRADES = [
  { id: 'sunset', label: 'Sunset duotone' },
  { id: 'neon', label: 'Neon magenta / cyan' },
  { id: 'noir', label: 'Noir' },
  { id: 'halftone', label: 'Halftone comic' },
];

/** Sky palettes per grade: [top, mid, low, sun core, sun rim]. */
const SKIES = {
  sunset: ['#2b1055', '#ff5e62', '#ff9a3d', '#ffe259', '#ff7e5f'],
  neon: ['#0d0221', '#ff2e88', '#00e5ff', '#ff5ce1', '#00f0ff'],
  noir: ['#101014', '#3a3a44', '#8a8a96', '#f2f2f2', '#c9c9d4'],
  halftone: ['#1a0533', '#e63b7a', '#ffb347', '#fff176', '#ff5e62'],
};

/** Deterministic pseudo-random from an integer seed (no Math.random). */
function seeded(index, salt) {
  const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Panel shapes for a layout, as polygons in cover space plus the photo's
 * fit rectangle. Returns [{ poly: [[x, y], ...], rect: {x, y, w, h} }, ...].
 */
export function panelShapes(layout, W, H) {
  const g = Math.max(6, Math.round(W * 0.012)); // gutter / border width
  if (layout === 'grid') {
    const cw = (W - g * 3) / 2;
    const ch = (H - g * 3) / 2;
    const cells = [
      [g, g], [g * 2 + cw, g],
      [g, g * 2 + ch], [g * 2 + cw, g * 2 + ch],
    ];
    return cells.map(([x, y]) => ({
      poly: [[x, y], [x + cw, y], [x + cw, y + ch], [x, y + ch]],
      rect: { x, y, w: cw, h: ch },
    }));
  }
  if (layout === 'hero') {
    const hh = Math.round(H * 0.6);
    const bw = (W - g * 3) / 2;
    const bh = H - hh - g * 2;
    return [
      { poly: [[g, g], [W - g, g], [W - g, hh], [g, hh]], rect: { x: g, y: g, w: W - g * 2, h: hh - g } },
      { poly: [[g, hh + g], [g + bw, hh + g], [g + bw, H - g], [g, H - g]], rect: { x: g, y: hh + g, w: bw, h: bh } },
      { poly: [[g * 2 + bw, hh + g], [W - g, hh + g], [W - g, H - g], [g * 2 + bw, H - g]], rect: { x: g * 2 + bw, y: hh + g, w: bw, h: bh } },
    ];
  }
  if (layout === 'full') {
    return [{ poly: [[0, 0], [W, 0], [W, H], [0, H]], rect: { x: 0, y: 0, w: W, h: H } }];
  }
  // diagonal: one tall slanted panel left, two stacked panels right.
  const xTop = W * 0.6;
  const xBot = W * 0.44;
  const yMidR = H * 0.46;
  const yMidL = H * 0.54;
  return [
    { poly: [[0, 0], [xTop, 0], [xBot, H], [0, H]], rect: { x: 0, y: 0, w: xTop, h: H } },
    { poly: [[xTop, 0], [W, 0], [W, yMidR], [xBot + (xTop - xBot) * 0.5, yMidL]], rect: { x: xTop - W * 0.08, y: 0, w: W - xTop + W * 0.08, h: yMidR } },
    { poly: [[xBot + (xTop - xBot) * 0.5, yMidL], [W, yMidR], [W, H], [xBot, H]], rect: { x: xBot, y: yMidL, w: W - xBot, h: H - yMidL } },
  ];
}

/** Fill the whole canvas with the grade's sunset sky gradient. */
function drawSky(ctx, W, H, grade) {
  const sky = SKIES[grade] || SKIES.sunset;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, sky[0]);
  grad.addColorStop(0.45, sky[1]);
  grad.addColorStop(0.8, sky[2]);
  grad.addColorStop(1, sky[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // faint horizontal haze bands
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 5; i += 1) {
    const y = H * (0.18 + i * 0.09);
    ctx.fillRect(0, y, W, H * 0.012);
  }
  ctx.globalAlpha = 1;
}

/** Scanline sun: a striped disc drawn on an offscreen canvas, then stamped. */
function drawSun(ctx, W, H, grade) {
  const sky = SKIES[grade] || SKIES.sunset;
  const r = Math.min(W, H) * 0.21;
  const cx = W * 0.5;
  const cy = H * 0.34;
  const off = document.createElement('canvas');
  off.width = Math.ceil(r * 2 + 4);
  off.height = Math.ceil(r * 2 + 4);
  const o = off.getContext('2d');
  const grad = o.createLinearGradient(0, 0, 0, off.height);
  grad.addColorStop(0, sky[3]);
  grad.addColorStop(1, sky[4]);
  o.fillStyle = grad;
  o.beginPath();
  o.arc(off.width / 2, off.height / 2, r, 0, Math.PI * 2);
  o.fill();
  // punch scanline gaps, widening toward the bottom half
  o.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i += 1) {
    const y = off.height / 2 + i * i * 1.15 + i * 6;
    o.fillRect(0, y, off.width, 2 + i * 1.6);
  }
  o.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.shadowColor = sky[4];
  ctx.shadowBlur = r * 0.55;
  ctx.drawImage(off, cx - off.width / 2, cy - off.height / 2);
  ctx.restore();
}

/** Procedural city skyline silhouette along the bottom of the cover. */
function drawSkyline(ctx, W, H, grade) {
  const baseY = H * 0.88;
  ctx.fillStyle = grade === 'noir' ? '#0a0a0e' : '#160a2e';
  ctx.globalAlpha = 0.92;
  let x = -W * 0.02;
  let i = 0;
  while (x < W * 1.02) {
    const bw = W * (0.05 + seeded(i, 3) * 0.06);
    const bh = H * (0.045 + seeded(i, 7) * 0.09);
    ctx.fillRect(x, baseY - bh, bw, bh + H - baseY);
    // rooftop antenna on some towers
    if (seeded(i, 11) > 0.6) {
      ctx.fillRect(x + bw / 2 - 1, baseY - bh - H * 0.05, 2, H * 0.05);
    }
    // lit windows
    ctx.fillStyle = grade === 'neon' ? '#00f0ff' : '#ffd76a';
    ctx.globalAlpha = 0.85;
    const rows = Math.floor(bh / (H * 0.035));
    const cols = Math.floor(bw / (W * 0.02));
    for (let rI = 0; rI < rows; rI += 1) {
      for (let cI = 0; cI < cols; cI += 1) {
        if (seeded(i * 31 + rI * 7 + cI, 5) > 0.62) {
          ctx.fillRect(x + 4 + cI * W * 0.02, baseY - bh + 6 + rI * H * 0.035, W * 0.008, H * 0.014);
        }
      }
    }
    ctx.fillStyle = grade === 'noir' ? '#0a0a0e' : '#160a2e';
    ctx.globalAlpha = 0.92;
    x += bw + W * 0.008;
    i += 1;
  }
  ctx.globalAlpha = 1;
}

/** One palm silhouette: curved trunk + drooping fronds. */
function drawPalm(ctx, x, y, s, lean, flip) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip ? -s : s, s);
  ctx.rotate(lean);
  ctx.strokeStyle = '#12061f';
  ctx.fillStyle = '#12061f';
  ctx.lineCap = 'round';
  // trunk
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(14, -70, 6, -150);
  ctx.stroke();
  // fronds
  const topX = 6;
  const topY = -150;
  for (let f = 0; f < 7; f += 1) {
    const ang = (-150 + f * 50) * (Math.PI / 180);
    const len = 95 - Math.abs(f - 3) * 12;
    const tipX = topX + Math.cos(ang) * len;
    const tipY = topY + Math.sin(ang) * len * 0.55 + 34;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + Math.cos(ang) * len * 0.5, topY + Math.sin(ang) * len * 0.4 - 18, tipX, tipY);
    ctx.stroke();
  }
  // coconuts
  ctx.beginPath();
  ctx.arc(topX - 4, topY + 8, 6, 0, Math.PI * 2);
  ctx.arc(topX + 6, topY + 10, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A few distant birds: simple two-stroke chevrons. */
function drawBirds(ctx, W, H) {
  ctx.save();
  ctx.strokeStyle = 'rgba(20, 8, 32, 0.85)';
  ctx.lineWidth = Math.max(2, W * 0.002);
  ctx.lineCap = 'round';
  const spots = [[0.2, 0.16, 1], [0.3, 0.11, 0.7], [0.78, 0.14, 1.2], [0.86, 0.2, 0.8], [0.62, 0.08, 0.6]];
  for (const [fx, fy, s] of spots) {
    const x = W * fx;
    const y = H * fy;
    const w = W * 0.022 * s;
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x - w * 0.4, y - w * 0.7, x, y);
    ctx.quadraticCurveTo(x + w * 0.4, y - w * 0.7, x + w, y);
    ctx.stroke();
  }
  ctx.restore();
}

/** Draw one photo into a panel clip, honouring zoom and pan offsets. */
function drawPanelPhoto(ctx, panel, shape, grade) {
  const img = panel.img;
  if (!img) return;
  const { x, y, w, h } = shape.rect;
  ctx.save();
  ctx.beginPath();
  shape.poly.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.closePath();
  ctx.clip();
  const zoom = panel.zoom || 1;
  const base = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * base;
  const dh = img.naturalHeight * base;
  let dx = x + (w - dw) / 2 + (panel.ox || 0) * w;
  let dy = y + (h - dh) / 2 + (panel.oy || 0) * h;
  // Clamp the pan so the photo always covers the whole panel (no sky gaps).
  if (dw >= w - 1) dx = Math.max(x + w - dw, Math.min(x, dx));
  if (dh >= h - 1) dy = Math.max(y + h - dh, Math.min(y, dy));
  if (grade === 'halftone') ctx.filter = 'contrast(1.35) saturate(1.5)';
  else if (grade === 'neon') ctx.filter = 'saturate(1.35) contrast(1.08)';
  else if (grade === 'sunset') ctx.filter = 'saturate(1.25) contrast(1.05)';
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.filter = 'none';
  // grade tint over the photo
  if (grade === 'sunset') {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, 'rgba(255, 110, 40, 0.24)');
    g.addColorStop(1, 'rgba(190, 20, 110, 0.38)');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'source-over';
  } else if (grade === 'neon') {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, 'rgba(255, 46, 136, 0.28)');
    g.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
    g.addColorStop(1, 'rgba(0, 229, 255, 0.30)');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'source-over';
  } else if (grade === 'noir') {
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = '#808080';
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  } else if (grade === 'halftone') {
    // comic dots: a sparse dot screen over the photo
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#000000';
    const step = Math.max(9, Math.round(w * 0.012));
    for (let yy = y + step / 2; yy < y + h; yy += step) {
      for (let xx = x + step / 2; xx < x + w; xx += step) {
        ctx.beginPath();
        ctx.arc(xx, yy, step * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, 'rgba(255, 60, 120, 0.10)');
    g.addColorStop(1, 'rgba(255, 180, 60, 0.22)');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }
  // vignette inside the panel
  const v = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.35, x + w / 2, y + h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = v;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** White frame + thin dark keyline around each panel polygon. */
function strokePanelFrame(ctx, shape, W) {
  ctx.save();
  ctx.beginPath();
  shape.poly.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(5, W * 0.008);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(10, 5, 25, 0.55)';
  ctx.lineWidth = Math.max(1.5, W * 0.002);
  ctx.stroke();
  ctx.restore();
}

/** Split a title into lines that fit maxWidth at the given font. */
function wrapTitle(ctx, title, maxWidth) {
  const words = title.toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines = [];
  let line = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const test = `${line} ${words[i]}`;
    if (ctx.measureText(test).width <= maxWidth || lines.length >= 1) {
      if (ctx.measureText(test).width <= maxWidth) line = test;
      else { lines.push(line); line = words[i]; }
    } else line = test;
  }
  lines.push(line);
  return lines.slice(0, 3);
}

/** Big condensed title with gradient fill, outline and offset shadow. */
function drawTitle(ctx, W, H, title, subtitle, grade) {
  const sky = SKIES[grade] || SKIES.sunset;
  const margin = W * 0.045;
  const hasSub = Boolean(subtitle && subtitle.trim());
  const subSize = Math.max(14, Math.round(W * 0.026));
  const bottom = H * 0.965 - (hasSub ? subSize * 1.35 : 0);
  let size = Math.round(W * 0.125);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const setFont = (s) => { ctx.font = `${s}px Anton, Impact, 'Arial Narrow', sans-serif`; };
  setFont(size);
  try { ctx.letterSpacing = `${Math.round(size * 0.01)}px`; } catch { /* older canvas */ }
  // measureText may not count letter-spacing, so add it by hand.
  const lineWidth = (ln) => ctx.measureText(ln).width + size * 0.01 * ln.length;
  const maxWidth = W - margin * 2 - size * 0.1;
  let lines = wrapTitle(ctx, title, maxWidth);
  let widest = Math.max(...lines.map(lineWidth), 0);
  while ((widest > maxWidth || lines.length > 2) && size > W * 0.055) {
    size = Math.round(size * 0.93);
    setFont(size);
    lines = wrapTitle(ctx, title, maxWidth);
    widest = Math.max(...lines.map(lineWidth), 0);
  }
  const lineH = size * 0.94;
  const blockH = lines.length * lineH;
  const grad = ctx.createLinearGradient(0, bottom - blockH, 0, bottom);
  if (grade === 'neon') { grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.55, '#ff5ce1'); grad.addColorStop(1, '#00e5ff'); }
  else if (grade === 'noir') { grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, '#c9c9d4'); }
  else if (grade === 'halftone') { grad.addColorStop(0, '#fff176'); grad.addColorStop(0.6, '#ffffff'); grad.addColorStop(1, '#ff5e62'); }
  else { grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.55, '#ffe259'); grad.addColorStop(1, '#ff7e5f'); }

  ctx.save();
  ctx.translate(W / 2, bottom - blockH / 2);
  ctx.rotate(-0.028);
  ctx.translate(-W / 2, -(bottom - blockH / 2));
  ctx.lineJoin = 'round';
  lines.forEach((ln, i) => {
    const y = bottom - (lines.length - 1 - i) * lineH;
    const tw = ctx.measureText(ln).width;
    const x = (W - tw) / 2;
    // offset drop shadow
    ctx.fillStyle = 'rgba(12, 4, 28, 0.9)';
    ctx.fillText(ln, x + size * 0.045, y + size * 0.05);
    // outline
    ctx.strokeStyle = '#14081f';
    ctx.lineWidth = Math.max(4, size * 0.085);
    ctx.strokeText(ln, x, y);
    // gradient fill
    ctx.fillStyle = grad;
    ctx.fillText(ln, x, y);
    // hot top edge
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(1, size * 0.012);
    ctx.strokeText(ln, x, y);
  });
  ctx.restore();

  // subtitle / tagline with flanking rules
  if (hasSub) {
    const sub = subtitle.toUpperCase();
    ctx.font = `700 ${subSize}px 'Arial Narrow', Arial, sans-serif`;
    try { ctx.letterSpacing = `${Math.round(subSize * 0.32)}px`; } catch { /* ignore */ }
    const sw = ctx.measureText(sub).width;
    const sy = bottom + subSize * 1.15;
    if (sy < H - 4) {
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(sub, W / 2, sy);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = Math.max(1.5, W * 0.002);
      const rule = Math.min(W * 0.1, (W - sw) / 2 - W * 0.03);
      if (rule > 8) {
        const y = sy - subSize * 0.32;
        ctx.beginPath();
        ctx.moveTo(W / 2 - sw / 2 - W * 0.02 - rule, y);
        ctx.lineTo(W / 2 - sw / 2 - W * 0.02, y);
        ctx.moveTo(W / 2 + sw / 2 + W * 0.02, y);
        ctx.lineTo(W / 2 + sw / 2 + W * 0.02 + rule, y);
        ctx.stroke();
      }
    }
  }
  try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
}

/**
 * Render the whole cover.
 * cover: { layout, grade, title, subtitle, panels: [{img, zoom, ox, oy}] }
 */
export function drawCover(ctx, W, H, cover) {
  const grade = cover.grade || 'sunset';
  const layout = cover.layout || 'diagonal';
  ctx.clearRect(0, 0, W, H);
  drawSky(ctx, W, H, grade);
  drawSun(ctx, W, H, grade);
  drawBirds(ctx, W, H);
  const shapes = panelShapes(layout, W, H);
  const panels = cover.panels || [];
  shapes.forEach((shape, i) => {
    drawPanelPhoto(ctx, panels[i] || {}, shape, grade);
  });
  // skyline peeks over the bottom of the panels, palms frame the corners
  drawSkyline(ctx, W, H, grade);
  const palmScale = Math.min(W, H) / 1080;
  drawPalm(ctx, W * 0.015, H * 0.99, palmScale * 1.15, -0.1, false);
  drawPalm(ctx, W * 0.985, H * 0.99, palmScale * 0.95, 0.12, true);
  shapes.forEach((shape) => strokePanelFrame(ctx, shape, W));
  // bottom scrim so the title always reads
  const scrim = ctx.createLinearGradient(0, H * 0.68, 0, H);
  scrim.addColorStop(0, 'rgba(10, 4, 24, 0)');
  scrim.addColorStop(1, 'rgba(10, 4, 24, 0.55)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, H * 0.68, W, H * 0.32);
  drawTitle(ctx, W, H, cover.title || '', cover.subtitle || '', grade);
}
