// Vice Sunset Cover Studio — cover renderer.
// Draws a GTA-style multi-panel sunset cover on a 2D canvas from the
// editor state: photo panels, a colour grade, procedural decoration
// (striped sun, skyline, palms, scanlines, vignette) and the caption.
// Everything is drawn in code; no image is fetched at run time.

/** The post sizes the app exports. */
export const EXPORT_SIZES = [
  { id: '1080x1080', w: 1080, h: 1080, label: 'Square · 1080 × 1080' },
  { id: '1080x1350', w: 1080, h: 1350, label: 'Portrait · 1080 × 1350' },
  { id: '1920x1080', w: 1920, h: 1080, label: 'Wide · 1920 × 1080' },
];

/** The four panel layouts, each with its own geometry. */
export const LAYOUTS = [
  { id: 'sunset-stack', label: 'Sunset Stack' },
  { id: 'diagonal', label: 'Diagonal Cut' },
  { id: 'grid-four', label: 'Four Corners' },
  { id: 'hero-side', label: 'Hero & Strip' },
];

/** The four colour grades. */
export const GRADES = [
  { id: 'sunset', label: 'Vice Sunset' },
  { id: 'neon', label: 'Neon Nights' },
  { id: 'noir', label: 'Midnight Noir' },
  { id: 'gold', label: 'Golden Hour' },
];

/** A panel's shape: the polygon to clip to and its bounding box. */
export function panelShapes(layout, w, h) {
  const rect = (x, y, pw, ph) => ({
    poly: [[x, y], [x + pw, y], [x + pw, y + ph], [x, y + ph]],
    rect: { x, y, w: pw, h: ph },
  });
  if (layout === 'diagonal') {
    return [
      { poly: [[0, 0], [w, 0], [0, h]], rect: { x: 0, y: 0, w, h } },
      { poly: [[w, 0], [w, h], [0, h]], rect: { x: 0, y: 0, w, h } },
    ];
  }
  if (layout === 'grid-four') {
    return [
      rect(0, 0, w / 2, h / 2),
      rect(w / 2, 0, w / 2, h / 2),
      rect(0, h / 2, w / 2, h / 2),
      rect(w / 2, h / 2, w / 2, h / 2),
    ];
  }
  if (layout === 'hero-side') {
    return [
      rect(0, 0, w * 0.68, h),
      rect(w * 0.68, 0, w * 0.32, h / 2),
      rect(w * 0.68, h / 2, w * 0.32, h / 2),
    ];
  }
  // sunset-stack: one hero panel over two small ones.
  return [
    rect(0, 0, w, h * 0.62),
    rect(0, h * 0.62, w / 2, h * 0.38),
    rect(w / 2, h * 0.62, w / 2, h * 0.38),
  ];
}

function tracePoly(ctx, poly) {
  ctx.beginPath();
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
  ctx.closePath();
}

/** Draw a photo cover-fitting a rectangle, panned by ox/oy, clamped so it always covers. */
function drawPhoto(ctx, img, rect, panel) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const zoom = Math.max(1, panel.zoom || 1);
  const scale = Math.max(rect.w / iw, rect.h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  let dx = rect.x + (rect.w - dw) / 2 + (panel.ox || 0) * rect.w;
  let dy = rect.y + (rect.h - dh) / 2 + (panel.oy || 0) * rect.h;
  dx = Math.min(rect.x, Math.max(rect.x + rect.w - dw, dx));
  dy = Math.min(rect.y, Math.max(rect.y + rect.h - dh, dy));
  ctx.drawImage(img, dx, dy, dw, dh);
}

/** A placeholder gradient for a panel whose photo has not loaded yet. */
function drawPlaceholder(ctx, rect) {
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  g.addColorStop(0, '#3a1654');
  g.addColorStop(0.55, '#ff2e88');
  g.addColorStop(1, '#ff9a3d');
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

/** Tint one panel with the chosen grade. */
function gradePanel(ctx, shape, grade) {
  const { rect } = shape;
  ctx.save();
  tracePoly(ctx, shape.poly);
  ctx.clip();
  if (grade === 'noir') {
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = '#808080';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalCompositeOperation = 'source-over';
  }
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  if (grade === 'neon') {
    g.addColorStop(0, 'rgba(255, 0, 170, 0.30)');
    g.addColorStop(1, 'rgba(0, 210, 255, 0.30)');
    ctx.globalCompositeOperation = 'overlay';
  } else if (grade === 'gold') {
    g.addColorStop(0, 'rgba(255, 200, 80, 0.30)');
    g.addColorStop(1, 'rgba(255, 120, 20, 0.35)');
    ctx.globalCompositeOperation = 'soft-light';
  } else if (grade === 'noir') {
    g.addColorStop(0, 'rgba(30, 30, 46, 0.45)');
    g.addColorStop(1, 'rgba(8, 8, 18, 0.60)');
    ctx.globalCompositeOperation = 'overlay';
  } else {
    g.addColorStop(0, 'rgba(255, 140, 60, 0.32)');
    g.addColorStop(1, 'rgba(200, 40, 140, 0.38)');
    ctx.globalCompositeOperation = 'overlay';
  }
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** A striped retro sun in the top-right corner, with a soft glow. */
function drawSun(ctx, w, h) {
  const cx = w * 0.86;
  const cy = h * 0.13;
  const r = Math.min(w, h) * 0.085;
  const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.2);
  glow.addColorStop(0, 'rgba(255, 150, 60, 0.35)');
  glow.addColorStop(1, 'rgba(255, 150, 60, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - r * 2.2, cy - r * 2.2, r * 4.4, r * 4.4);
  const disc = ctx.createRadialGradient(cx, cy - r * 0.25, r * 0.1, cx, cy, r);
  disc.addColorStop(0, '#ffe066');
  disc.addColorStop(0.55, '#ff9a3d');
  disc.addColorStop(1, '#ff2e88');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(20, 9, 31, 0.55)';
  for (let i = 0; i < 4; i++) {
    const y = cy + r * (0.05 + i * 0.22);
    const half = Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy)));
    ctx.fillRect(cx - half, y, half * 2, r * 0.07);
  }
}

/** A dark skyline silhouette along the bottom band, with lit windows. */
function drawSkyline(ctx, w, h) {
  const base = h * 0.985;
  const top = h * 0.76;
  ctx.fillStyle = 'rgba(12, 5, 22, 0.92)';
  let x = 0;
  let seed = 7;
  const next = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  while (x < w) {
    const bw = w * (0.03 + next() * 0.05);
    const bh = (base - top) * (0.35 + next() * 0.65);
    ctx.fillRect(x, base - bh, bw, bh);
    if (next() > 0.5) ctx.fillRect(x + bw * 0.2, base - bh - h * 0.02, bw * 0.25, h * 0.02);
    x += bw + w * 0.004;
  }
  ctx.fillStyle = 'rgba(255, 209, 102, 0.85)';
  for (let i = 0; i < 46; i++) {
    const wx = next() * w;
    const wy = top + next() * (base - top - h * 0.02);
    ctx.fillRect(wx, wy, Math.max(2, w * 0.002), Math.max(2, h * 0.003));
  }
}

/** One palm silhouette: a curved trunk and six drooping fronds. */
function drawPalm(ctx, x, y, size, lean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(lean, 1);
  ctx.strokeStyle = 'rgba(12, 5, 22, 0.95)';
  ctx.lineCap = 'round';
  ctx.lineWidth = size * 0.045;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(size * 0.08, -size * 0.55, size * 0.22, -size * 0.95);
  ctx.stroke();
  const topX = size * 0.22;
  const topY = -size * 0.95;
  ctx.lineWidth = size * 0.03;
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI * (0.08 + i * 0.16);
    const len = size * (0.42 - Math.abs(i - 2.5) * 0.04);
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(
      topX + Math.cos(angle) * len * 0.6,
      topY - Math.sin(angle) * len * 0.55,
      topX + Math.cos(angle) * len,
      topY - Math.sin(angle) * len * 0.35 + size * 0.18,
    );
    ctx.stroke();
  }
  ctx.restore();
}

/** Faint horizontal scanlines over the whole cover. */
function drawScanlines(ctx, w, h) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
  for (let y = 0; y < h; y += 5) ctx.fillRect(0, y, w, 1);
}

/** A dark vignette around the edges. */
function drawVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** The caption: subtitle above a big Anton title, over the bottom band. */
function drawCaption(ctx, w, h, title, subtitle) {
  const band = ctx.createLinearGradient(0, h * 0.78, 0, h);
  band.addColorStop(0, 'rgba(10, 5, 20, 0)');
  band.addColorStop(0.3, 'rgba(10, 5, 20, 0.55)');
  band.addColorStop(1, 'rgba(10, 5, 20, 0.88)');
  ctx.fillStyle = band;
  ctx.fillRect(0, h * 0.78, w, h * 0.22);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const subSize = Math.round(h * 0.03);
  ctx.font = `600 ${subSize}px 'Segoe UI', system-ui, sans-serif`;
  try { ctx.letterSpacing = '5px'; } catch { /* letterSpacing is optional */ }
  ctx.fillStyle = '#ffd166';
  ctx.fillText((subtitle || '').toUpperCase(), w / 2, h * 0.815);
  try { ctx.letterSpacing = '0px'; } catch { /* reset is optional */ }

  const titleSize = Math.round(h * 0.105);
  ctx.font = `${titleSize}px Anton, 'Arial Narrow', sans-serif`;
  ctx.shadowColor = 'rgba(20, 5, 30, 0.9)';
  ctx.shadowBlur = titleSize * 0.12;
  ctx.shadowOffsetY = titleSize * 0.03;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(20, 5, 30, 0.9)';
  ctx.lineWidth = titleSize * 0.09;
  const text = (title || '').toUpperCase();
  ctx.strokeText(text, w / 2, h * 0.905);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, w / 2, h * 0.905);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

/** Draw the whole cover at w by h from the editor state. */
export function drawCover(ctx, w, h, state) {
  ctx.fillStyle = '#14091f';
  ctx.fillRect(0, 0, w, h);
  const shapes = panelShapes(state.layout, w, h);
  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i];
    const panel = state.panels[i] || { img: null, zoom: 1, ox: 0, oy: 0 };
    ctx.save();
    tracePoly(ctx, shape.poly);
    ctx.clip();
    if (panel.img) drawPhoto(ctx, panel.img, shape.rect, panel);
    else drawPlaceholder(ctx, shape.rect);
    ctx.restore();
    gradePanel(ctx, shape, state.grade);
  }
  ctx.lineWidth = Math.max(2, w * 0.004);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  for (const shape of shapes) {
    tracePoly(ctx, shape.poly);
    ctx.stroke();
  }
  drawSun(ctx, w, h);
  drawSkyline(ctx, w, h);
  drawPalm(ctx, w * 0.02, h * 0.99, h * 0.16, 1);
  drawPalm(ctx, w * 0.98, h * 0.99, h * 0.13, -1);
  drawScanlines(ctx, w, h);
  drawCaption(ctx, w, h, state.title, state.subtitle);
  drawVignette(ctx, w, h);
  ctx.lineWidth = Math.max(3, w * 0.005);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.strokeRect(w * 0.008, h * 0.008, w * 0.984, h * 0.984);
}
