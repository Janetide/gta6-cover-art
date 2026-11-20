// Vice Sunset Cover Studio — editor.
// Owns state, the preview canvas, photo loading, panel pan/zoom, shot URL
// modes (?shot=cover / ?shot=editor) and PNG export. The cover itself is
// drawn by cover.js; this file only wires the UI around it.

import { EXPORT_SIZES, LAYOUTS, GRADES, drawCover, panelShapes } from './cover.js';

'use strict';

const $ = (id) => document.getElementById(id);
const previewCanvas = $('preview-canvas');
const previewCtx = previewCanvas.getContext('2d');
const params = new URLSearchParams(location.search);

/** The editor's whole state: one entry per panel, extras unused by a layout. */
const state = {
  layout: 'diagonal',
  grade: 'sunset',
  title: 'Sunset Heist',
  subtitle: 'Vice Sunset Story',
  sizeId: '1080x1080',
  selected: 0,
  panels: [
    { src: 'samples/boulevard.jpg', img: null, zoom: 1, ox: 0, oy: 0.25 },
    { src: 'samples/pier.jpg', img: null, zoom: 1, ox: 0, oy: 0.18 },
    { src: 'samples/boulevard.jpg', img: null, zoom: 1, ox: 0, oy: 0.32 },
    { src: 'samples/pier.jpg', img: null, zoom: 1, ox: 0, oy: 0 },
  ],
};

const SAMPLES = { boulevard: 'samples/boulevard.jpg', pier: 'samples/pier.jpg' };

function sizeOf(id) {
  return EXPORT_SIZES.find((s) => s.id === id) || EXPORT_SIZES[0];
}

function layoutLabel() {
  return LAYOUTS.find((l) => l.id === state.layout)?.label || state.layout;
}

function gradeLabel() {
  return GRADES.find((g) => g.id === state.grade)?.label || state.grade;
}

/** Load an image from a URL and resolve with the HTMLImageElement. */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

/** Paint the preview canvas from the current state. */
/** Set text only when the element exists (cover shot mode removes the UI). */
function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function renderPreview() {
  const size = sizeOf(state.sizeId);
  if (previewCanvas.width !== size.w) previewCanvas.width = size.w;
  if (previewCanvas.height !== size.h) previewCanvas.height = size.h;
  drawCover(previewCtx, size.w, size.h, state);
  setText('size-label', `${size.w} × ${size.h}`);
  setText('layout-badge', `${layoutLabel()} · ${gradeLabel()}`);
  const shapes = panelShapes(state.layout, size.w, size.h);
  setText('panel-count', String(shapes.length));
  setText('panel-name', String(Math.min(state.selected, shapes.length - 1) + 1));
  const panel = state.panels[state.selected] || state.panels[0];
  const name = panel.src.startsWith('data:') ? 'your uploaded photo'
    : panel.src.includes('pier') ? 'sample pier' : 'sample boulevard';
  setText('photo-note', `Photo: ${name}`);
  const slider = $('zoom-slider');
  if (slider) slider.value = String(Math.round((panel.zoom || 1) * 100));
  setText('zoom-value', `${Math.round((panel.zoom || 1) * 100)}%`);
}

/** Set a panel's photo from a URL (sample or data URL) and repaint.
 * Keeps the panel's pan/zoom: the crop the user (or the defaults) chose
 * still applies, and the renderer clamps it so the photo covers the panel. */
async function setPanelPhoto(index, src) {
  const panel = state.panels[index];
  panel.img = await loadImage(src);
  panel.src = src;
  renderPreview();
}

/** Fill every panel with the selected panel's photo. */
async function applyPhotoToAllPanels() {
  const src = state.panels[state.selected].src;
  const img = state.panels[state.selected].img;
  for (const panel of state.panels) {
    panel.src = src;
    panel.img = img;
  }
  renderPreview();
}

/** Read a user file into a panel as a data URL (never leaves the machine). */
function handleUpload(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = () => setPanelPhoto(state.selected, String(reader.result));
  reader.readAsDataURL(file);
}

/** Ray-casting point-in-polygon test against a panel's polygon. */
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Which panel (if any) contains canvas point x, y. */
function panelAt(x, y) {
  const size = sizeOf(state.sizeId);
  const shapes = panelShapes(state.layout, size.w, size.h);
  for (let i = shapes.length - 1; i >= 0; i -= 1) {
    if (pointInPoly(x, y, shapes[i].poly)) return i;
  }
  return -1;
}

/** Convert a pointer event to canvas pixel coordinates. */
function eventPoint(event) {
  const rect = previewCanvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (previewCanvas.width / rect.width),
    y: (event.clientY - rect.top) * (previewCanvas.height / rect.height),
  };
}

let dragging = null;

function onPointerDown(event) {
  const p = eventPoint(event);
  const hit = panelAt(p.x, p.y);
  if (hit < 0) return;
  state.selected = hit;
  const size = sizeOf(state.sizeId);
  const shapes = panelShapes(state.layout, size.w, size.h);
  dragging = { panel: hit, lastX: p.x, lastY: p.y, rect: shapes[hit].rect };
  previewCanvas.setPointerCapture(event.pointerId);
  renderPreview();
}

function onPointerMove(event) {
  if (!dragging) return;
  const p = eventPoint(event);
  const panel = state.panels[dragging.panel];
  panel.ox += (p.x - dragging.lastX) / dragging.rect.w;
  panel.oy += (p.y - dragging.lastY) / dragging.rect.h;
  panel.ox = Math.max(-0.6, Math.min(0.6, panel.ox));
  panel.oy = Math.max(-0.6, Math.min(0.6, panel.oy));
  dragging.lastX = p.x;
  dragging.lastY = p.y;
  renderPreview();
}

function onPointerUp() {
  dragging = null;
}

function onWheel(event) {
  event.preventDefault();
  const p = eventPoint(event);
  const hit = panelAt(p.x, p.y);
  if (hit < 0) return;
  state.selected = hit;
  const panel = state.panels[hit];
  panel.zoom = Math.max(1, Math.min(3, (panel.zoom || 1) * (event.deltaY < 0 ? 1.1 : 0.9)));
  renderPreview();
}

/** Render the cover at a size and return a PNG blob. */
function renderPngBlob(sizeId) {
  const size = sizeOf(sizeId);
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas.getContext('2d'), size.w, size.h, state);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/** Export the cover as a PNG download, in as few clicks as possible. */
async function exportPng() {
  const size = sizeOf(state.sizeId);
  const blob = await renderPngBlob(state.sizeId);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vice-sunset-cover-${size.w}x${size.h}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Wire every control in the editor. */
function wireControls() {
  $('title-input').addEventListener('input', (e) => { state.title = e.target.value; renderPreview(); });
  $('subtitle-input').addEventListener('input', (e) => { state.subtitle = e.target.value; renderPreview(); });
  $('layout-select').addEventListener('change', (e) => {
    state.layout = e.target.value;
    state.selected = 0;
    renderPreview();
  });
  $('grade-select').addEventListener('change', (e) => { state.grade = e.target.value; renderPreview(); });
  $('zoom-slider').addEventListener('input', (e) => {
    state.panels[state.selected].zoom = Number(e.target.value) / 100;
    renderPreview();
  });
  $('zoom-in-btn').addEventListener('click', () => {
    const p = state.panels[state.selected];
    p.zoom = Math.min(3, (p.zoom || 1) + 0.2);
    renderPreview();
  });
  $('zoom-out-btn').addEventListener('click', () => {
    const p = state.panels[state.selected];
    p.zoom = Math.max(1, (p.zoom || 1) - 0.2);
    renderPreview();
  });
  $('recenter-btn').addEventListener('click', () => {
    const p = state.panels[state.selected];
    p.zoom = 1; p.ox = 0; p.oy = 0;
    renderPreview();
  });
  $('upload-btn').addEventListener('click', () => $('file-input').click());
  $('file-input').addEventListener('change', (e) => handleUpload(e.target.files[0]));
  $('apply-all-btn').addEventListener('click', applyPhotoToAllPanels);
  $('sample-boulevard').addEventListener('click', () => {
    setPanelPhoto(state.selected, SAMPLES.boulevard);
    markSampleButton('boulevard');
  });
  $('sample-pier').addEventListener('click', () => {
    setPanelPhoto(state.selected, SAMPLES.pier);
    markSampleButton('pier');
  });
  const dropzone = $('dropzone');
  ['dragenter', 'dragover'].forEach((name) => dropzone.addEventListener(name, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragging');
  }));
  ['dragleave', 'drop'].forEach((name) => dropzone.addEventListener(name, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragging');
  }));
  dropzone.addEventListener('drop', (e) => handleUpload(e.dataTransfer.files[0]));
  $('size-row').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-size]');
    if (!btn) return;
    state.sizeId = btn.dataset.size;
    document.querySelectorAll('#size-row [data-size]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b === btn));
    });
    renderPreview();
  });
  $('export-btn').addEventListener('click', exportPng);
  previewCanvas.addEventListener('pointerdown', onPointerDown);
  previewCanvas.addEventListener('pointermove', onPointerMove);
  previewCanvas.addEventListener('pointerup', onPointerUp);
  previewCanvas.addEventListener('pointercancel', onPointerUp);
  previewCanvas.addEventListener('wheel', onWheel, { passive: false });
}

function markSampleButton(which) {
  $('sample-boulevard').setAttribute('aria-pressed', String(which === 'boulevard'));
  $('sample-pier').setAttribute('aria-pressed', String(which === 'pier'));
}

/** Apply ?shot= parameters (photo, caption, subtitle, layout, grade, size). */
async function applyShotParams() {
  const photo = params.get('photo');
  const caption = params.get('caption');
  const subtitle = params.get('subtitle');
  const layout = params.get('layout');
  const grade = params.get('grade');
  const size = params.get('size');
  if (caption) {
    state.title = caption;
    $('title-input').value = caption;
  }
  if (subtitle) {
    state.subtitle = subtitle;
    $('subtitle-input').value = subtitle;
  }
  if (layout && LAYOUTS.some((l) => l.id === layout)) {
    state.layout = layout;
    $('layout-select').value = layout;
  }
  if (grade && GRADES.some((g) => g.id === grade)) {
    state.grade = grade;
    $('grade-select').value = grade;
  }
  if (size && EXPORT_SIZES.some((s) => s.id === size)) {
    state.sizeId = size;
    document.querySelectorAll('#size-row [data-size]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.size === size));
    });
  }
  if (photo && SAMPLES[photo]) {
    await setPanelPhoto(0, SAMPLES[photo]);
    markSampleButton(photo);
  }
}

/** In ?shot=cover mode, hide the editor chrome and show only the cover. */
function enterCoverShotMode() {
  document.body.classList.add('shot-cover');
  document.querySelector('header.app-header').remove();
  document.querySelector('main.workspace').replaceWith(previewCanvas);
  document.querySelector('footer.app-footer').remove();
  previewCanvas.style.maxHeight = '100vh';
}

/** Self-test hook: export the current cover, check the PNG bytes, report. */
async function runExportSelfTest() {
  const size = sizeOf(state.sizeId);
  const blob = await renderPngBlob(state.sizeId);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const isPng = magic.every((b, i) => bytes[i] === b);
  $('test-result').textContent = JSON.stringify({
    testExport: true, isPng, bytes: bytes.length, w: size.w, h: size.h,
  });
}

window.addEventListener('error', (event) => {
  const el = $('test-result');
  el.textContent = JSON.stringify({ pageError: String(event.message || event.error || 'unknown') });
});

/** Boot: load the sample photos, apply shot params, paint, signal ready. */
async function boot() {
  wireControls();
  const loads = state.panels.map((panel) => loadImage(panel.src).then((img) => { panel.img = img; }));
  await Promise.all(loads);
  await applyShotParams();
  if (params.get('shot') === 'cover') enterCoverShotMode();
  renderPreview();
  try {
    await document.fonts.load('400 100px Anton');
    await document.fonts.ready;
    renderPreview();
  } catch { /* Anton is decorative; the Impact fallback still draws */ }
  if (params.get('testExport') === '1') await runExportSelfTest();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}

boot();
