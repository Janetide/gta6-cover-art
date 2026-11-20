// app.js — the editor for Vice Sunset Cover Studio.
// Wires the cover renderer (cover.js) to the page: photo loading, panel
// picking and panning, layout and grade switching, caption editing, PNG
// export, and the ?shot= / ?testExport= modes used for screenshots.
import {
  drawCover,
  exportCoverPNG,
  EXPORT_SIZES,
  GRADES,
  LAYOUTS,
} from './cover.js';

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') || 'editor';

const state = {
  layout: 'heroTrio',
  grade: 'sunset',
  title: params.get('caption') || 'Sunset Heist',
  subtitle: 'Vice City',
  panels: [
    { img: null, panX: 0, panY: 0, zoom: 1 },
    { img: null, panX: 0, panY: 0, zoom: 1 },
    { img: null, panX: 0, panY: 0, zoom: 1 },
    { img: null, panX: 0, panY: 0, zoom: 1 },
  ],
  selected: 0,
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('failed to load ' + src));
    img.src = src;
  });
}

function currentPanels() {
  return state.panels;
}

function draw() {
  drawCover(ctx, canvas.width, canvas.height, {
    layout: state.layout,
    grade: state.grade,
    panels: currentPanels(),
    title: state.title,
    subtitle: state.subtitle,
  });
}

function layoutRects() {
  return LAYOUTS[state.layout].panels(canvas.width, canvas.height);
}

function pointInPolygon(px, py, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function pickPanel(px, py) {
  const rects = layoutRects();
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (r.clip) {
      const pts = r.clip.map(([fx, fy]) => [fx * canvas.width, fy * canvas.height]);
      if (pointInPolygon(px, py, pts)) return i;
    } else if (
      px >= r.x * canvas.width &&
      px < (r.x + r.w) * canvas.width &&
      py >= r.y * canvas.height &&
      py < (r.y + r.h) * canvas.height
    ) {
      return i;
    }
  }
  return 0;
}

function clampPan(panel, rect) {
  const img = panel.img;
  if (!img || !img.naturalWidth) {
    panel.panX = 0;
    panel.panY = 0;
    return;
  }
  const rw = rect.w * canvas.width;
  const rh = rect.h * canvas.height;
  const base = Math.max(rw / img.naturalWidth, rh / img.naturalHeight);
  const scale = base * panel.zoom;
  const maxX = Math.max(0, (img.naturalWidth * scale - rw) / 2 / rw);
  const maxY = Math.max(0, (img.naturalHeight * scale - rh) / 2 / rh);
  panel.panX = Math.max(-maxX, Math.min(maxX, panel.panX));
  panel.panY = Math.max(-maxY, Math.min(maxY, panel.panY));
}

function syncZoomUI() {
  const panel = state.panels[state.selected];
  const slider = document.getElementById('zoom-slider');
  slider.value = String(panel.zoom);
  document.getElementById('zoom-readout').textContent =
    panel.zoom.toFixed(2) + 'x';
}

// ---- pointer: select, drag to pan, wheel to zoom ----
let dragging = false;
let dragStart = null;

canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const py = ((e.clientY - rect.top) / rect.height) * canvas.height;
  state.selected = pickPanel(px, py);
  syncZoomUI();
  dragging = true;
  dragStart = { px, py, panX: state.panels[state.selected].panX, panY: state.panels[state.selected].panY };
  canvas.classList.add('dragging');
  canvas.setPointerCapture(e.pointerId);
  draw();
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragging || !dragStart) return;
  const rect = canvas.getBoundingClientRect();
  const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const py = ((e.clientY - rect.top) / rect.height) * canvas.height;
  const panel = state.panels[state.selected];
  const panelRect = layoutRects()[state.selected];
  panel.panX = dragStart.panX + (px - dragStart.px) / (panelRect.w * canvas.width);
  panel.panY = dragStart.panY + (py - dragStart.py) / (panelRect.h * canvas.height);
  clampPan(panel, panelRect);
  draw();
});

function endDrag() {
  dragging = false;
  dragStart = null;
  canvas.classList.remove('dragging');
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[state.selected];
  panel.zoom = Math.max(1, Math.min(3, panel.zoom * Math.exp(-e.deltaY * 0.0012)));
  clampPan(panel, layoutRects()[state.selected]);
  syncZoomUI();
  draw();
}, { passive: false });

// ---- drag and drop a photo onto the cover ----
canvas.addEventListener('dragover', (e) => e.preventDefault());
canvas.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) loadFileIntoPanel(file, state.selected);
});

function loadFileIntoPanel(file, index) {
  const reader = new FileReader();
  reader.onload = () => {
    loadImage(reader.result)
      .then((img) => {
        state.panels[index] = { img, panX: 0, panY: 0, zoom: 1 };
        draw();
      })
      .catch(() => {});
  };
  reader.readAsDataURL(file);
}

// ---- controls ----
function buildButtons(rowId, entries, current, onPick) {
  const row = document.getElementById(rowId);
  entries.forEach(([key, label]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.dataset.key = key;
    if (key === current) btn.classList.add('active');
    btn.addEventListener('click', () => {
      row.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      onPick(key);
      draw();
    });
    row.appendChild(btn);
  });
}

buildButtons(
  'layout-row',
  Object.entries(LAYOUTS).map(([k, v]) => [k, v.label]),
  state.layout,
  (key) => {
    state.layout = key;
    state.selected = 0;
    syncZoomUI();
  },
);

buildButtons(
  'grade-row',
  Object.entries(GRADES).map(([k, v]) => [k, v.label]),
  state.grade,
  (key) => {
    state.grade = key;
  },
);

document.getElementById('title-input').addEventListener('input', (e) => {
  state.title = e.target.value || 'VICE SUNSET';
  draw();
});
document.getElementById('subtitle-input').addEventListener('input', (e) => {
  state.subtitle = e.target.value || 'VICE CITY';
  draw();
});

document.getElementById('zoom-slider').addEventListener('input', (e) => {
  const panel = state.panels[state.selected];
  panel.zoom = Number(e.target.value);
  clampPan(panel, layoutRects()[state.selected]);
  syncZoomUI();
  draw();
});
document.getElementById('zoom-in').addEventListener('click', () => {
  const panel = state.panels[state.selected];
  panel.zoom = Math.min(3, panel.zoom + 0.25);
  syncZoomUI();
  draw();
});
document.getElementById('zoom-out').addEventListener('click', () => {
  const panel = state.panels[state.selected];
  panel.zoom = Math.max(1, panel.zoom - 0.25);
  clampPan(panel, layoutRects()[state.selected]);
  syncZoomUI();
  draw();
});
document.getElementById('recenter').addEventListener('click', () => {
  const panel = state.panels[state.selected];
  panel.panX = 0;
  panel.panY = 0;
  panel.zoom = 1;
  syncZoomUI();
  draw();
});

function setSample(name) {
  loadImage('samples/' + name + '.jpg')
    .then((img) => {
      state.panels[state.selected] = { img, panX: 0, panY: 0, zoom: 1 };
      draw();
    })
    .catch(() => {});
}
document.getElementById('sample-boulevard').addEventListener('click', () => setSample('boulevard'));
document.getElementById('sample-pier').addEventListener('click', () => setSample('pier'));

const fileInput = document.getElementById('file-input');
document.getElementById('upload-btn').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  if (fileInput.files && fileInput.files[0]) {
    loadFileIntoPanel(fileInput.files[0], state.selected);
  }
  fileInput.value = '';
});

document.querySelectorAll('[data-export]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const size = EXPORT_SIZES[Number(btn.dataset.export)];
    const blob = await exportCoverPNG(
      {
        layout: state.layout,
        grade: state.grade,
        panels: currentPanels(),
        title: state.title,
        subtitle: state.subtitle,
      },
      size.w,
      size.h,
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-sunset-cover-${size.w}x${size.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
});

// ---- export self-test (?testExport=1) ----
async function runSelfTest() {
  const results = [];
  for (const size of EXPORT_SIZES) {
    const blob = await exportCoverPNG(
      {
        layout: state.layout,
        grade: state.grade,
        panels: currentPanels(),
        title: state.title,
        subtitle: state.subtitle,
      },
      size.w,
      size.h,
    );
    const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    const png = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
    results.push({ size: `${size.w}x${size.h}`, bytes: blob.size, png });
  }
  const ok = results.every((r) => r.png);
  const pre = document.getElementById('test-result');
  pre.style.display = 'block';
  pre.textContent = JSON.stringify({ ok, results }, null, 2);
  window.__testDone = ok;
  return ok;
}

// ---- boot ----
async function boot() {
  if (SHOT === 'cover') {
    document.body.classList.add('shot-cover');
    const fit = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      draw();
    };
    window.addEventListener('resize', fit);
    fit();
  }
  try {
    await document.fonts.load('40px "Archivo Black"');
    await document.fonts.ready;
  } catch (e) {
    // the generic sans-serif fallback still draws the caption
  }
  const photo = params.get('photo') || 'boulevard';
  const first = await loadImage('samples/' + photo + '.jpg').catch(() => null);
  const second = await loadImage('samples/' + (photo === 'pier' ? 'boulevard' : 'pier') + '.jpg').catch(() => null);
  state.panels[0].img = first;
  state.panels[1].img = second || first;
  state.panels[2].img = first;
  state.panels[3].img = second || first;
  if (SHOT === 'cover') {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  draw();
  if (params.get('testExport') === '1') {
    await runSelfTest();
  }
  window.__bootDone = true;
}

boot();
