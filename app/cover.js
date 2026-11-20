// cover.js — the cover renderer for Vice Sunset Cover Studio.
// Pure canvas drawing: no DOM, no network. A cover is a set of photo
// panels (each with its own pan and zoom), a colour grade, procedural
// sunset decor, and a bold caption in Archivo Black.
//
// A panel is { img, panX, panY, zoom } where panX/panY shift the photo's
// centre by a fraction of the panel (-0.5 .. 0.5) and zoom is 1 .. 3.
// A layout is a list of panel rects { x, y, w, h, clip } in fractions of
// the cover; clip is an optional polygon (fraction points) for
// non-rectangular panels such as the diagonal split.

export const GRADES = {
  sunset: {
    label: 'Sunset',
    tint: 'rgba(255, 110, 60, 0.13)',
    sun: '#ffd678',
    sunCore: '#fff3c4',
    title: '#fff3d6',
    sub: '#ffd9a0',
    band: 'rgba(24, 8, 40, 0.74)',
    accent: '#ff5e3c',
    sky: ['#1c0a38', '#7a2060', '#ff5e3c', '#ffaa50'],
  },
  neon: {
    label: 'Neon',
    tint: 'rgba(0, 229, 255, 0.11)',
    sun: '#ff4fd8',
    sunCore: '#ffe3f8',
    title: '#eafcff',
    sub: '#8ef2ff',
    band: 'rgba(8, 10, 40, 0.74)',
    accent: '#00e5ff',
    sky: ['#0a1030', '#1a2a6e', '#c2188b', '#00e5ff'],
  },
  vice: {
    label: 'Vice',
    tint: 'rgba(255, 79, 216, 0.11)',
    sun: '#ffb347',
    sunCore: '#fff0c8',
    title: '#ffe9f8',
    sub: '#ff9fe2',
    band: 'rgba(30, 6, 34, 0.74)',
    accent: '#ff4fd8',
    sky: ['#20062a', '#6e1a6e', '#ff4f9e', '#ff9f5e'],
  },
  noir: {
    label: 'Noir',
    tint: 'rgba(8, 8, 18, 0.30)',
    sun: '#f5f0e6',
    sunCore: '#ffffff',
    title: '#ffffff',
    sub: '#d8d8d8',
    band: 'rgba(0, 0, 0, 0.80)',
    accent: '#e8e8e8',
    sky: ['#0a0a12', '#1c1c28', '#3a3a4a', '#6a6a7a'],
  },
};

export const LAYOUTS = {
  heroTrio: {
    label: 'Hero Trio',
    panels(W, H) {
      return [
        { x: 0, y: 0, w: 0.62, h: 0.78 },
        { x: 0.62, y: 0, w: 0.38, h: 0.39 },
        { x: 0.62, y: 0.39, w: 0.38, h: 0.39 },
      ];
    },
  },
  diagonal: {
    label: 'Diagonal',
    panels(W, H) {
      return [
        {
          x: 0, y: 0, w: 1, h: 0.78,
          clip: [[0, 0], [1, 0], [1, 0.42], [0, 0.78]],
        },
        {
          x: 0, y: 0.42, w: 1, h: 0.58,
          clip: [[0, 0.78], [1, 0.42], [1, 1], [0, 1]],
        },
      ];
    },
  },
  quad: {
    label: 'Quad',
    panels(W, H) {
      return [
        { x: 0, y: 0, w: 0.5, h: 0.39 },
        { x: 0.5, y: 0, w: 0.5, h: 0.39 },
        { x: 0, y: 0.39, w: 0.5, h: 0.39 },
        { x: 0.5, y: 0.39, w: 0.5, h: 0.39 },
      ];
    },
  },
  fullbleed: {
    label: 'Full Bleed',
    panels(W, H) {
      return [
        { x: 0, y: 0, w: 1, h: 0.8 },
        { x: 0, y: 0.8, w: 1, h: 0.2 },
      ];
    },
  },
};

// Deterministic PRNG so the grain is identical on every render.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clipPanel(ctx, W, H, rect) {
  ctx.beginPath();
  if (rect.clip) {
    rect.clip.forEach(([fx, fy], i) => {
      const px = fx * W;
      const py = fy * H;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
  } else {
    ctx.rect(rect.x * W, rect.y * H, rect.w * W, rect.h * H);
  }
  ctx.clip();
}

function drawPhoto(ctx, W, H, rect, panel) {
  const img = panel.img;
  if (!img || !img.naturalWidth) return;
  const rx = rect.x * W;
  const ry = rect.y * H;
  const rw = rect.w * W;
  const rh = rect.h * H;
  const base = Math.max(rw / img.naturalWidth, rh / img.naturalHeight);
  const scale = base * (panel.zoom || 1);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const cx = rx + rw / 2 + (panel.panX || 0) * rw;
  const cy = ry + rh / 2 + (panel.panY || 0) * rh;
  ctx.save();
  clipPanel(ctx, W, H, rect);
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.restore();
}

function drawPanelEdge(ctx, W, H, rect) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = Math.max(2, W * 0.003);
  ctx.beginPath();
  if (rect.clip) {
    rect.clip.forEach(([fx, fy], i) => {
      const px = fx * W;
      const py = fy * H;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
  } else {
    ctx.rect(rect.x * W, rect.y * H, rect.w * W, rect.h * H);
  }
  ctx.stroke();
  ctx.restore();
}

function drawSun(ctx, W, H, grade) {
  const cx = W * 0.8;
  const cy = H * 0.24;
  const r = Math.min(W, H) * 0.17;
  ctx.save();
  for (let k = 10; k >= 1; k--) {
    const rr = (r * k) / 10;
    ctx.globalAlpha = 0.05 + 0.1 * (1 - k / 10);
    ctx.fillStyle = grade.sun;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = grade.sunCore;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
  ctx.fill();
  // synthwave slats cut across the lower half of the sun
  ctx.fillStyle = 'rgba(20, 8, 40, 0.9)';
  for (let i = 0; i < 5; i++) {
    const y = cy + r * (0.08 + i * 0.16);
    const th = 2 + i * 2.4;
    ctx.fillRect(cx - r - 6, y, r * 2 + 12, th);
  }
  ctx.restore();
}

function drawSkyline(ctx, W, H, yBase) {
  const rnd = mulberry32(20261120);
  ctx.save();
  ctx.fillStyle = 'rgba(10, 4, 24, 0.92)';
  let x = -10;
  while (x < W + 10) {
    const bw = 40 + rnd() * 90;
    const bh = H * (0.05 + rnd() * 0.11);
    ctx.fillRect(x, yBase - bh, bw, bh);
    if (rnd() < 0.3) {
      ctx.fillRect(x + bw / 2 - 2, yBase - bh - 26, 4, 26);
    }
    // a few lit windows
    ctx.fillStyle = 'rgba(255, 214, 130, 0.9)';
    for (let i = 0; i < bw * bh / 2600; i++) {
      ctx.fillRect(
        x + 6 + rnd() * (bw - 14),
        yBase - bh + 8 + rnd() * (bh - 16),
        4,
        5,
      );
    }
    ctx.fillStyle = 'rgba(10, 4, 24, 0.92)';
    x += bw + 6 + rnd() * 14;
  }
  ctx.restore();
}

function drawPalm(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  let px = x;
  let py = y;
  for (let i = 0; i < 8; i++) {
    const nx = px + (5 + i * 2);
    const ny = py - s * 0.11;
    ctx.lineWidth = Math.max(3, s * 0.035);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(nx, ny);
    ctx.stroke();
    px = nx;
    py = ny;
  }
  for (let a = -160; a < 25; a += 24) {
    const ang = (a * Math.PI) / 180;
    const ex = px + Math.cos(ang) * s * 0.42;
    const ey = py + Math.sin(ang) * s * 0.3 + s * 0.1;
    ctx.lineWidth = Math.max(2, s * 0.02);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex + 8, ey + s * 0.12);
    ctx.stroke();
  }
  ctx.restore();
}

function drawScanlines(ctx, W, H) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.10)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  ctx.restore();
}

function drawVignette(ctx, W, H) {
  const g = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.42,
    W / 2, H / 2, Math.max(W, H) * 0.75,
  );
  g.addColorStop(0, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawGrain(ctx, W, H, seed) {
  const rnd = mulberry32(seed);
  ctx.save();
  const n = Math.floor((W * H) / 900);
  for (let i = 0; i < n; i++) {
    const a = 0.03 + rnd() * 0.08;
    ctx.fillStyle = rnd() < 0.5
      ? `rgba(255, 255, 255, ${a})`
      : `rgba(0, 0, 0, ${a})`;
    ctx.fillRect(rnd() * W, rnd() * H, 1.6, 1.6);
  }
  ctx.restore();
}

function drawTitleBand(ctx, W, H, grade, title, subtitle) {
  const bandH = H * 0.22;
  const bandY = H - bandH;
  ctx.save();
  ctx.fillStyle = grade.band;
  ctx.fillRect(0, bandY, W, bandH);
  ctx.fillStyle = grade.accent;
  ctx.fillRect(0, bandY, W, Math.max(3, H * 0.006));
  const pad = W * 0.045;
  let titleSize = Math.min(H * 0.085, (W - pad * 2) / Math.max(4, title.length) * 1.9);
  ctx.fillStyle = grade.title;
  ctx.font = `${titleSize}px "Archivo Black", "Arial Black", sans-serif`;
  // Archivo Black runs wide: measure the title and shrink it until it
  // fits the cover instead of running off the right edge.
  const titleText = title.toUpperCase();
  const titleWidth = ctx.measureText(titleText).width;
  if (titleWidth > W - pad * 2) {
    titleSize *= (W - pad * 2) / titleWidth;
    ctx.font = `${titleSize}px "Archivo Black", "Arial Black", sans-serif`;
  }
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = titleSize * 0.12;
  ctx.shadowOffsetY = titleSize * 0.04;
  ctx.fillText(titleText, pad, bandY + bandH * 0.42);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  const subSize = Math.max(12, H * 0.028);
  ctx.fillStyle = grade.sub;
  ctx.font = `600 ${subSize}px "Arial", sans-serif`;
  const spaced = subtitle.toUpperCase().split('').join('\u2009');
  ctx.fillText(spaced, pad, bandY + bandH * 0.78);
  ctx.restore();
}

// Draw a cover into a 2d context of size W x H.
// state: { layout, grade, panels: [{img, panX, panY, zoom}], title, subtitle }
export function drawCover(ctx, W, H, state) {
  const grade = GRADES[state.grade] || GRADES.sunset;
  const layout = LAYOUTS[state.layout] || LAYOUTS.heroTrio;
  const rects = layout.panels(W, H);
  ctx.save();
  ctx.fillStyle = '#12061f';
  ctx.fillRect(0, 0, W, H);
  rects.forEach((rect, i) => {
    const panel = state.panels[i] || state.panels[0];
    if (!panel) return;
    // shrink each panel by a hair so a dark gap reads between panels
    const gap = Math.max(2, W * 0.004);
    const inset = {
      ...rect,
      x: rect.x + (rect.w > 0.02 ? gap / W : 0),
      y: rect.y + (rect.h > 0.02 ? gap / H : 0),
      w: rect.w - (rect.w > 0.02 ? (gap * 2) / W : 0),
      h: rect.h - (rect.h > 0.02 ? (gap * 2) / H : 0),
    };
    if (rect.clip) {
      // for clipped panels keep the clip but draw the photo through it
      ctx.save();
      clipPanel(ctx, W, H, rect);
      drawPhoto(ctx, W, H, rect, panel);
      ctx.restore();
      drawPanelEdge(ctx, W, H, rect);
    } else {
      drawPhoto(ctx, W, H, inset, panel);
      drawPanelEdge(ctx, W, H, inset);
    }
  });
  // grade tint over the photos
  ctx.fillStyle = grade.tint;
  ctx.fillRect(0, 0, W, H);
  drawSun(ctx, W, H, grade);
  drawSkyline(ctx, W, H, H * 0.78);
  drawPalm(ctx, W * 0.03, H * 0.79, Math.min(W, H) * 0.3, 'rgba(8, 3, 20, 0.95)');
  drawPalm(ctx, W * 0.97, H * 0.79, Math.min(W, H) * 0.26, 'rgba(8, 3, 20, 0.95)');
  drawScanlines(ctx, W, H);
  drawVignette(ctx, W, H);
  drawGrain(ctx, W, H, 20261120);
  drawTitleBand(ctx, W, H, grade, state.title || 'VICE SUNSET', state.subtitle || 'VICE CITY');
  ctx.restore();
}

// Render a cover to a fresh canvas of the given size.
export function renderCover(state, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawCover(canvas.getContext('2d'), w, h, state);
  return canvas;
}

// Export a cover PNG of the given size; resolves with a Blob.
export function exportCoverPNG(state, w, h) {
  return new Promise((resolve, reject) => {
    const canvas = renderCover(state, w, h);
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('canvas.toBlob returned null'));
    }, 'image/png');
  });
}

export const EXPORT_SIZES = [
  { label: '1080 x 1080', w: 1080, h: 1080 },
  { label: '1080 x 1350', w: 1080, h: 1350 },
  { label: '1920 x 1080', w: 1920, h: 1080 },
];
