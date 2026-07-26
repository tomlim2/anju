// Standalone preview of the proposed "Manga-Terminal" graphic set.
// Direction: pure monochrome pattern / line / screentone / radial-effect
// graphics only (no text bubbles, no typography, no object glyphs).
// Does NOT touch the locked composition pipeline. See GRAPHIC_REDESIGN_PLAN.md.

import { line, make, rect } from "./svg.js";

const MONO = '"Noto Sans Mono", monospace';
const DISPLAY = '"SUIT", "Glow Sans SC", sans-serif';

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

function txt(x, y, value, opts = {}) {
  const {
    size = 12, family = MONO, weight = 700, anchor = "start", opacity = 1
  } = opts;
  const node = make("text", {
    x, y, fill: "currentColor",
    "font-family": family, "font-size": size, "font-weight": weight,
    "text-anchor": anchor, opacity
  });
  node.textContent = value;
  return node;
}

function dot(cx, cy, r, opacity = 1) {
  return make("circle", { cx, cy, r, fill: "currentColor", stroke: "none", opacity });
}

function ring(cx, cy, r, strokeWidth = 1.5) {
  return make("circle", { cx, cy, r, fill: "none", stroke: "currentColor", "stroke-width": strokeWidth });
}

function poly(points, fill = true, opts = {}) {
  return make("polygon", {
    points: points.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" "),
    fill: fill ? "currentColor" : "none",
    stroke: fill ? "none" : "currentColor",
    "stroke-width": opts.strokeWidth ?? 2,
    "stroke-linejoin": "miter",
    opacity: opts.opacity ?? 1
  });
}

function path(d, opts = {}) {
  return make("path", {
    d, fill: "none", stroke: "currentColor",
    "stroke-width": opts.strokeWidth ?? 2,
    "stroke-linejoin": "round", "stroke-linecap": "round",
    opacity: opts.opacity ?? 1
  });
}

// ray from center to the perimeter of a box centered at (cx,cy)
function rayToBox(cx, cy, angle, hw, hh) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const tx = dx === 0 ? Infinity : hw / Math.abs(dx);
  const ty = dy === 0 ? Infinity : hh / Math.abs(dy);
  const t = Math.min(tx, ty);
  return [cx + dx * t, cy + dy * t];
}

const inBox = (px, py, x, y, w, h) => px >= x && px <= x + w && py >= y && py <= y + h;

// ---- motif renderers: each draws into group g within box (x,y,w,h) ----

// dot screentone with a linear density ramp; encodes a value in the caption
function halftoneMeter(g, x, y, w, h, r) {
  const cols = 14;
  const rows = 7;
  const cw = w / cols;
  const ch = h / rows;
  const level = 0.3 + r() * 0.6;
  for (let cx = 0; cx < cols; cx += 1) {
    const density = cx / (cols - 1);
    for (let cy = 0; cy < rows; cy += 1) {
      const radius = Math.min(cw, ch) * 0.5 * (0.15 + density * 0.85);
      g.appendChild(dot(x + cx * cw + cw / 2, y + cy * ch + ch / 2, radius));
    }
  }
  g.appendChild(rect(x, y, w, h, { strokeWeight: "hairline" }));
  g.appendChild(txt(x + w, y - 6, `${Math.round(level * 100)}%`, { anchor: "end", size: 12 }));
}

// dots on concentric rings, growing outward — radial screentone
function radialHalftone(g, x, y, w, h) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const maxR = Math.min(w, h) / 2 * 0.98;
  const rings = 9;
  const stepR = maxR / rings;
  for (let ri = 1; ri <= rings; ri += 1) {
    const rr = stepR * ri;
    const count = Math.max(6, Math.round((2 * Math.PI * rr) / stepR));
    const dotR = stepR * 0.5 * (0.22 + (ri / rings) * 0.82);
    for (let k = 0; k < count; k += 1) {
      const a = (k / count) * Math.PI * 2 + ri * 0.2;
      const px = cx + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr;
      if (inBox(px, py, x, y, w, h)) g.appendChild(dot(px, py, dotR));
    }
  }
}

// random stipple with a left->right density gradient
function stippleGradient(g, x, y, w, h, r) {
  const n = 520;
  for (let i = 0; i < n; i += 1) {
    const px = x + r() * w;
    const py = y + r() * h;
    const frac = (px - x) / w;
    if (r() < frac * 0.92 + 0.04) g.appendChild(dot(px, py, 0.7 + r() * 1.5));
  }
}

// grid of filled/empty squares
function dotMatrixField(g, x, y, w, h, r) {
  const cols = 10;
  const rows = 6;
  const cw = w / cols;
  const ch = h / rows;
  const fillRate = 0.35 + r() * 0.4;
  const s = Math.min(cw, ch) * 0.62;
  for (let cx = 0; cx < cols; cx += 1) {
    for (let cy = 0; cy < rows; cy += 1) {
      const px = x + cx * cw + (cw - s) / 2;
      const py = y + cy * ch + (ch - s) / 2;
      g.appendChild(r() < fillRate
        ? rect(px, py, s, s, { fill: "currentColor", stroke: false })
        : rect(px, py, s, s, { strokeWeight: "hairline" }));
    }
  }
}

// uniform 45deg hatch
function hatchField(g, x, y, w, h, r) {
  const gap = 7 + Math.floor(r() * 4);
  for (let o = 0; o <= w + h; o += gap) {
    const p1 = [x + Math.min(o, w), y + Math.max(0, o - w)];
    const p2 = [x + Math.max(0, o - h), y + Math.min(o, h)];
    g.appendChild(line(p1[0], p1[1], p2[0], p2[1], { strokeWeight: "hairline" }));
  }
  g.appendChild(rect(x, y, w, h, { strokeWeight: "hairline" }));
}

// parallel bars whose thickness ramps across the box — line-screen tone
function lineScreen(g, x, y, w, h) {
  const n = 26;
  const step = w / n;
  for (let i = 0; i < n; i += 1) {
    const t = step * (0.08 + (i / (n - 1)) * 0.82);
    g.appendChild(rect(x + i * step + (step - t) / 2, y, t, h, { fill: "currentColor", stroke: false }));
  }
}

// horizontal raster lines with irregular band density
function scanlines(g, x, y, w, h, r) {
  let cy = y;
  while (cy < y + h) {
    const th = 0.6 + r() * 2.6;
    g.appendChild(rect(x, cy, w, th, { fill: "currentColor", stroke: false, opacity: 0.88 }));
    cy += th + 1.4 + r() * 3.2;
  }
}

// horizontal motion streaks of varying length
function speedLines(g, x, y, w, h, r) {
  const count = 12;
  for (let i = 0; i < count; i += 1) {
    const ly = y + (i + 0.5) * (h / count) + (r() - 0.5) * 4;
    const len = w * (0.35 + r() * 0.6);
    const fromRight = r() < 0.5;
    const x1 = fromRight ? x + w - len : x;
    const x2 = fromRight ? x + w : x + len;
    g.appendChild(line(x1, ly, x2, ly, { strokeWeight: i % 3 ? "hairline" : "thin" }));
  }
}

// rows of chevrons — directional motion field
function chevronStream(g, x, y, w, h) {
  const rows = 6;
  const rh = h / rows;
  const cw = Math.max(14, w / 12);
  for (let ri = 0; ri < rows; ri += 1) {
    const cy = y + ri * rh + rh / 2;
    for (let cx = x; cx < x + w - cw; cx += cw * 0.9) {
      g.appendChild(path(`M${cx},${cy + rh * 0.26} L${cx + cw / 2},${cy - rh * 0.26} L${cx + cw},${cy + rh * 0.26}`, { strokeWidth: 1.6 }));
    }
  }
}

// vanishing-point floor grid
function perspectiveGrid(g, x, y, w, h) {
  const vpx = x + w / 2;
  const vpy = y + h * 0.14;
  const bottom = y + h;
  const cols = 8;
  const rows = 7;
  for (let i = 0; i <= cols; i += 1) {
    g.appendChild(line(x + (i / cols) * w, bottom, vpx, vpy, { strokeWeight: "hairline" }));
  }
  for (let j = 1; j <= rows; j += 1) {
    const ly = vpy + (bottom - vpy) * Math.pow(j / rows, 1.9);
    const p = (bottom - ly) / (bottom - vpy);
    const xl = x + p * (vpx - x);
    const xr = (x + w) + p * (vpx - (x + w));
    g.appendChild(line(xl, ly, xr, ly, { strokeWeight: "hairline" }));
  }
}

// nested rings — ripple / target
function concentricRings(g, x, y, w, h, r) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const maxR = Math.min(w, h) / 2 * 0.98;
  const rings = 8;
  for (let i = 1; i <= rings; i += 1) {
    const rr = (maxR * i) / rings * (1 + (r() - 0.5) * 0.03);
    g.appendChild(ring(cx, cy, rr, i % 3 ? 1.3 : 2.4));
  }
}

// radial lines converging to an off-center focus — 集中線
function focusLines(g, x, y, w, h, r) {
  const cx = x + w * (0.4 + r() * 0.2);
  const cy = y + h * (0.4 + r() * 0.2);
  const hw = Math.max(cx - x, x + w - cx);
  const hh = Math.max(cy - y, y + h - cy);
  const clear = Math.min(w, h) * 0.14;
  const count = 34;
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2 + (r() - 0.5) * 0.12;
    const edge = rayToBox(cx, cy, a, hw, hh);
    const ix = cx + Math.cos(a) * clear;
    const iy = cy + Math.sin(a) * clear;
    const ex = Math.max(x, Math.min(x + w, edge[0]));
    const ey = Math.max(y, Math.min(y + h, edge[1]));
    g.appendChild(line(ix, iy, ex, ey, { strokeWeight: i % 2 ? "hairline" : "thin" }));
  }
}

// filled radial burst — ベタフラッシュ
function betaFlash(g, x, y, w, h, r) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const hw = w / 2;
  const hh = h / 2;
  const spikes = 22;
  const innerR = Math.min(w, h) * 0.1;
  for (let i = 0; i < spikes; i += 1) {
    const a = (i / spikes) * Math.PI * 2;
    const reach = 0.55 + (i % 2 ? 0.45 : 0.15) + r() * 0.05;
    const edge = rayToBox(cx, cy, a, hw * reach, hh * reach);
    const e = 0.06;
    const i1 = [cx + Math.cos(a - e) * innerR, cy + Math.sin(a - e) * innerR];
    const i2 = [cx + Math.cos(a + e) * innerR, cy + Math.sin(a + e) * innerR];
    g.appendChild(poly([i1, edge, i2], true));
  }
  g.appendChild(make("circle", { cx, cy, r: innerR * 0.9, fill: "var(--bg)", stroke: "none" }));
}

// concentric jagged rings — shockwave
function burstRings(g, x, y, w, h, r) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const maxR = Math.min(w, h) / 2 * 0.95;
  const rings = 4;
  for (let i = 1; i <= rings; i += 1) {
    const base = (maxR * i) / rings;
    const spikes = 16 + i * 4;
    const pts = [];
    for (let k = 0; k < spikes; k += 1) {
      const a = (k / spikes) * Math.PI * 2;
      const rr = base * (k % 2 ? 1 : 0.85) * (1 + (r() - 0.5) * 0.05);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    g.appendChild(poly(pts, false, { strokeWidth: i === 1 ? 2.4 : 1.5 }));
  }
}

const MOTIFS = [
  { id: "halftone-meter", note: "톤=값", draw: halftoneMeter },
  { id: "radial-halftone", note: "radial", draw: radialHalftone },
  { id: "stipple-gradient", note: "stipple", draw: stippleGradient },
  { id: "dot-matrix-field", note: "unit", draw: dotMatrixField },
  { id: "hatch-field", note: "load", draw: hatchField },
  { id: "line-screen", note: "screen", draw: lineScreen },
  { id: "scanlines", note: "raster", draw: scanlines },
  { id: "speed-lines", note: "stream", draw: speedLines },
  { id: "chevron-stream", note: "arrow", draw: chevronStream },
  { id: "perspective-grid", note: "grid", draw: perspectiveGrid },
  { id: "concentric-rings", note: "ripple", draw: concentricRings },
  { id: "focus-lines", note: "集中線", draw: focusLines },
  { id: "beta-flash", note: "flash", draw: betaFlash },
  { id: "burst-rings", note: "shock", draw: burstRings }
];

export function renderMockupGallery(width, height, seed) {
  const board = make("g", { "data-mockup": "manga-terminal" });
  const margin = Math.max(28, Math.min(56, width * 0.03));
  const titleH = 66;
  board.appendChild(txt(margin, 40, "MOCKUP / MANGA-TERMINAL GRAPHIC SET", { size: 18, weight: 900, family: DISPLAY }));
  board.appendChild(txt(width - margin, 40, `${MOTIFS.length} MOTIFS`, { size: 13, anchor: "end" }));
  board.appendChild(line(margin, 52, width - margin, 52, { strokeWeight: "hairline" }));

  const cols = width > 1180 ? 4 : width > 780 ? 3 : 2;
  const rows = Math.ceil(MOTIFS.length / cols);
  const gap = 18;
  const cellW = (width - margin * 2 - (cols - 1) * gap) / cols;
  const cellH = (height - titleH - margin - (rows - 1) * gap) / rows;
  const captionH = 26;
  const pad = Math.min(cellW, cellH) * 0.12;

  MOTIFS.forEach((motif, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = margin + col * (cellW + gap);
    const cy = titleH + row * (cellH + gap);
    const cell = make("g", { "data-motif-mockup": motif.id });
    cell.appendChild(rect(cx, cy, cellW, cellH - captionH, { strokeWeight: "hairline", opacity: 0.55 }));
    const inner = make("g", {});
    const rnd = mulberry32((seed ^ (i * 0x9e3779b1)) >>> 0);
    motif.draw(inner, cx + pad, cy + pad, cellW - pad * 2, cellH - captionH - pad * 2, rnd);
    cell.appendChild(inner);
    cell.appendChild(txt(cx, cy + cellH - 8, motif.id, { size: 11 }));
    cell.appendChild(txt(cx + cellW, cy + cellH - 8, motif.note, { size: 11, anchor: "end", opacity: 0.6 }));
    board.appendChild(cell);
  });
  return board;
}
