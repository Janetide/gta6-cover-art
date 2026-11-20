// Vice Sunset Cover Studio — cover renderer.
// Draws the multi-panel GTA-style cover onto a 2D canvas: a sunset sky
// with a procedural sun, skyline and palm silhouettes, photo panels the
// user can crop and position, a colour grade, and a title block in Bebas
// Neue. Pure canvas, no network, no assets outside app/. Every random
// choice comes from a seeded generator, so the same state always draws
// the same pixels.

export const EXPORT_SIZES = [
  { id: '1080x1080', w: 1080, h: 1080, label: '1080 × 1080' },
  { id: '1080x1350', w: 1080, h: 1350, label: '1080 × 1350' },
  { id: '1920x1080', w: 1920, h: 1080, label: '1920 × 1080' },
];

export const LAYOUTS = [
  { id: 'hero-trio', label: 'Hero + Trio' },
  { id: 'diagonal', label: 'Diagonal Bands' },
  { id: 'quad', label: 'Four Corners' },
  { id: 'fullbleed', label: 'Full Bleed' },
];

export const GRADES = [
  {
    id: 'sunset', label: 'Sunset',
    sky: ['#ff9a3d', '#ff5e78', '#7b2fbe'],
    tint: '#ff7a1a', tintAlpha: 0.14,
    title: '#ffffff', accent: '#ffb347', frame: '#ffffff',
  },
  {
    id: 'neon', label: 'Neon Night',
    sky: ['#2b0a4a', '#7a1fa2', '#0f2a4a'],
    tint: '#ff2ea6', tintAlpha: 0.16,
    title: '#ffffff', accent: '#39d5ff', frame: '#f5f0ff',
  },
  {
    id: 'vice', label: 'Vice Gold',
    sky: ['#0f766e', '#f59e0b', '#7c2d12'],
    tint: '#fbbf24', tintAlpha: 0.12,
    title: '#fff7d6', accent: '#fde68a', frame: '#fff7d6',
  },
  {
    id: 'noir', label: 'Noir',
    sky: ['#1f2937', '#374151', '#0f172a'],
    tint: '#ef4444', tintAlpha: 0.10,
    title: '#f8fafc', accent: '#ef4444', frame: '#e5e7eb',
  },
];

/** A tiny deterministic generator: the same seed always gives the same stream. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The panel shapes of a layout: each a polygon and its bounding box. */
export function panelShapes(layoutId, w, h) {
  const m = Math.max(8, Math.round(Math.min(w, h) * 0.02));
  const skyH = Math.round(h * 0.11);
  const titleH = Math.round(h * 0.17);
  const g = Math.max(4, Math.round(Math.min(w, h) * 0.012));
  const x0 = m;
  const y0 = m + skyH;
  const x1 = w - m;
  const y1 = h - m - titleH;
  const pw = x1 - x0;
  const ph = y1 - y0;
  const rect = (x, y, rw, rh) => ({
    poly: [[x, y], [x + rw, y], [x + rw, y + rh], [x, y + rh]],
    rect: { x, y, w: rw, h: rh },
  });
  switch (layoutId) {
    case 'diagonal': {
      const bh = ph / 3;
      const slant = Math.round(pw * 0.05);
      const bands = [];
      for (let k = 0; k < 3; k++) {
        const top = y0 + k * bh + (k > 0 ? g / 2 : 0);
        const bottom = y0 + (k + 1) * bh - (k < 2 ? g / 2 : 0);
        bands.push({
          poly: [[x0, top + slant], [x1, top], [x1, bottom], [x0, bottom + slant]],
          rect: { x: x0, y: top, w: pw, h: bottom - top },
        });
      }
      return bands;
    }
    case 'quad': {
      const cw = (pw - g) / 2;
      const ch = (ph - g) / 2;
      return [
        rect(x0, y0, cw, ch),
        rect(x0 + cw + g, y0, cw, ch),
        rect(x0, y0 + ch + g, cw, ch),
        rect(x0 + cw + g, y0 + ch + g, cw, ch),
      ];
    }
    case 'fullbleed':
      return [rect(x0, y0, pw, ph)];
    case 'hero-trio':
    default: {
      const heroW = pw * 0.6 - g / 2;
      const sideX = x0 + heroW + g;
      const sideW = pw - heroW - g;
      const rh = (ph - 2 * g) / 3;
      return [
        rect(x0, y0, heroW, ph),
        rect(sideX, y0, sideW, rh),
        rect(sideX, y0 + rh + g, sideW, rh),
        rect(sideX, y0 + 2 * (rh + g), sideW, rh),
      ];
    }
  }
}

/** Ray-casting point-in-polygon test. */
export function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Which panel shape (if any) contains the point. */
export function panelAt(shapes, x, y) {
  for (let i = shapes.length - 1; i >= 0; i -= 1) {
    if (pointInPoly(x, y, shapes[i].poly)) return i;
  }
  return -1;
}

/** Draw one palm silhouette: a leaning trunk and five fronds. */
function drawPalm(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, s * 0.06);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + s * 0.08, y - s * 0.55, x + s * 0.22, y - s * 0.95);
  ctx.stroke();
  const topX = x + s * 0.22;
  const topY = y - s * 0.95;
  ctx.lineWidth = Math.max(1.5, s * 0.035);
  for (let k = 0; k < 5; k++) {
    const angle = Math.PI * (0.08 + k * 0.21);
    const len = s * (0.42 + (k % 2) * 0.1);
    const ex = topX + Math.cos(angle) * len;
    const ey = topY - Math.sin(angle) * len * 0.55 + len * 0.22;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + Math.cos(angle) * len * 0.5, topY - Math.sin(angle) * len * 0.7, ex, ey);
    ctx.stroke();
  }
  ctx.restore();
}

/** Draw a dark skyline silhouette with a few lit windows along a baseline. */
function drawSkyline(ctx, x0, x1, baseY, maxH, color, seed) {
  const rnd = mulberry32(seed);
  ctx.save();
  ctx.fillStyle = color;
  let x = x0;
  while (x < x1) {
    const bw = 14 + rnd() * (x1 - x0) * 0.09;
    const bh = maxH * (0.35 + rnd() * 0.65);
    ctx.fillRect(x, baseY - bh, bw, bh);
    if (rnd() > 0.45) {
      ctx.fillStyle = 'rgba(255, 214, 120, 0.85)';
      const wx = x + bw * 0.25 + rnd() * bw * 0.4;
      const wy = baseY - bh + 4 + rnd() * Math.max(4, bh * 0.4);
      ctx.fillRect(wx, wy, 3, 4);
      ctx.fillStyle = color;
    }
    x += bw + 2 + rnd() * 6;
  }
  ctx.restore();
}

/** Draw a photo into a panel rect with cover fit, pan and zoom, clamped. */
function drawPanelImage(ctx, img, shape, panel) {
  const { x, y, w, h } = shape.rect;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const zoom = Math.max(1, Math.min(3, panel.zoom || 1));
  const scale = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const ox = Math.max(-0.6, Math.min(0.6, panel.ox || 0));
  const oy = Math.max(-0.6, Math.min(0.6, panel.oy || 0));
  let dx = x + (w - dw) / 2 + (ox * w) / 2;
  let dy = y + (h - dh) / 2 + (oy * h) / 2;
  dx = Math.max(x + w - dw, Math.min(x, dx));
  dy = Math.max(y + h - dh, Math.min(y, dy));
  ctx.drawImage(img, dx, dy, dw, dh);
}

/** Fill a panel that has no photo yet: deep gradient and diagonal stripes. */
function drawPanelEmpty(ctx, shape) {
  const { x, y, w, h } = shape.rect;
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, '#3b1d5e');
  grad.addColorStop(1, '#12081f');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(6, w * 0.02);
  for (let d = -h; d < w; d += 46) {
    ctx.beginPath();
    ctx.moveTo(x + d, y + h);
    ctx.lineTo(x + d + h, y);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draw the whole cover onto ctx at size w x h from the editor state:
 * { layout, grade, title, subtitle, panels: [{ img, zoom, ox, oy }] }.
 */
export function drawCover(ctx, w, h, state) {
  const grade = GRADES.find((g) => g.id === state.grade) || GRADES[0];
  const shapes = panelShapes(state.layout, w, h);
  const m = Math.max(8, Math.round(Math.min(w, h) * 0.02));
  const skyH = Math.round(h * 0.11);
  const titleH = Math.round(h * 0.17);

  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, grade.sky[0]);
  sky.addColorStop(0.55, grade.sky[1]);
  sky.addColorStop(1, grade.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Sun with a soft halo, high in the sky band.
  const sunX = w * 0.76;
  const sunY = m + skyH * 0.42;
  const sunR = Math.min(w, h) * 0.075;
  const halo = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 2.4);
  halo.addColorStop(0, 'rgba(255, 240, 180, 0.85)');
  halo.addColorStop(0.4, 'rgba(255, 180, 90, 0.28)');
  halo.addColorStop(1, 'rgba(255, 180, 90, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(sunX - sunR * 2.4, sunY - sunR * 2.4, sunR * 4.8, sunR * 4.8);
  const disc = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR);
  disc.addColorStop(0, '#fffbe8');
  disc.addColorStop(0.75, '#ffd76a');
  disc.addColorStop(1, '#ff9a3d');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  // Skyline and palms along the bottom of the sky band.
  const baseY = m + skyH;
  drawSkyline(ctx, m, w * 0.62, baseY, skyH * 0.72, 'rgba(24, 8, 44, 0.9)', 20261120);
  drawPalm(ctx, w * 0.08, baseY, skyH * 1.05, 'rgba(20, 6, 36, 0.95)');
  drawPalm(ctx, w * 0.93, baseY, skyH * 0.9, 'rgba(20, 6, 36, 0.95)');

  // Photo panels.
  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i];
    const panel = state.panels[i] || state.panels[0];
    ctx.save();
    ctx.beginPath();
    shape.poly.forEach(([px, py], k) => (k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.closePath();
    ctx.clip();
    if (panel && panel.img) drawPanelImage(ctx, panel.img, shape, panel);
    else drawPanelEmpty(ctx, shape);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = grade.frame;
    ctx.lineWidth = Math.max(2, w * 0.003);
    ctx.beginPath();
    shape.poly.forEach(([px, py], k) => (k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  // Colour grade tint over the panels, plus a fade into the title block.
  ctx.save();
  ctx.globalAlpha = grade.tintAlpha;
  ctx.fillStyle = grade.tint;
  ctx.fillRect(m, m + skyH, w - 2 * m, h - 2 * m - skyH - titleH);
  ctx.restore();
  const fade = ctx.createLinearGradient(0, h - m - titleH - 40, 0, h - m - titleH);
  fade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  fade.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
  ctx.fillStyle = fade;
  ctx.fillRect(m, h - m - titleH - 40, w - 2 * m, 40);

  // Title block.
  const blockY = h - m - titleH;
  const block = ctx.createLinearGradient(0, blockY, 0, blockY + titleH);
  block.addColorStop(0, 'rgba(18, 8, 32, 0.96)');
  block.addColorStop(1, 'rgba(0, 0, 0, 0.98)');
  ctx.fillStyle = block;
  ctx.fillRect(m, blockY, w - 2 * m, titleH);
  ctx.fillStyle = grade.accent;
  ctx.fillRect(m + titleH * 0.22, blockY + titleH * 0.14, w * 0.09, Math.max(3, titleH * 0.045));
  const titleText = (state.title || 'Untitled').toUpperCase();
  let titleSize = titleH * 0.46;
  ctx.textBaseline = 'middle';
  const fitTitle = (size) => {
    ctx.font = `400 ${Math.round(size)}px "Bebas Neue", "Arial Narrow", sans-serif`;
    return ctx.measureText(titleText).width;
  };
  while (titleSize > titleH * 0.2 && fitTitle(titleSize) > w - 2 * m - titleH * 0.44) titleSize *= 0.92;
  ctx.font = `400 ${Math.round(titleSize)}px "Bebas Neue", "Arial Narrow", sans-serif`;
  try { ctx.letterSpacing = '2px'; } catch { /* letterSpacing is optional */ }
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
  ctx.shadowBlur = Math.round(titleSize * 0.1);
  ctx.shadowOffsetY = Math.round(titleSize * 0.05);
  ctx.fillStyle = grade.title;
  ctx.fillText(titleText, m + titleH * 0.22, blockY + titleH * 0.48);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  try { ctx.letterSpacing = '0px'; } catch { /* reset */ }
  ctx.font = `600 ${Math.round(titleH * 0.17)}px system-ui, sans-serif`;
  ctx.fillStyle = grade.accent;
  ctx.fillText(state.subtitle || '', m + titleH * 0.22, blockY + titleH * 0.82);

  // Outer frame.
  ctx.save();
  ctx.strokeStyle = grade.frame;
  ctx.lineWidth = Math.max(3, Math.round(w * 0.004));
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  ctx.restore();

  // Scanlines, vignette and grain, all subtle and deterministic.
  ctx.save();
  ctx.globalAlpha = 0.035;
  ctx.fillStyle = '#000000';
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
  ctx.restore();
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  const grain = mulberry32(7);
  const dots = Math.floor((w * h) / 1400);
  ctx.save();
  for (let i = 0; i < dots; i++) {
    const gx = Math.floor(grain() * w);
    const gy = Math.floor(grain() * h);
    ctx.globalAlpha = 0.04 + grain() * 0.03;
    ctx.fillStyle = grain() > 0.5 ? '#ffffff' : '#000000';
    ctx.fillRect(gx, gy, 1, 1);
  }
  ctx.restore();
}
