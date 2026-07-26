// Standalone preview of the proposed "Manga-Terminal" graphic set +
// an ink-snap alignment demo. Direction: pure monochrome pattern / line /
// screentone / radial-effect graphics (no text bubbles / typography / glyphs).
// Does NOT touch the locked composition pipeline. See GRAPHIC_REDESIGN_PLAN.md.

import { line, make, rect } from "./svg.js";
import { MOCKUP_METRICS } from "./mockup-metrics-data.js";

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

function rayToBox(cx, cy, angle, hw, hh) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const tx = dx === 0 ? Infinity : hw / Math.abs(dx);
  const ty = dy === 0 ? Infinity : hh / Math.abs(dy);
  const t = Math.min(tx, ty);
  return [cx + dx * t, cy + dy * t];
}

const inBox = (px, py, x, y, w, h) => px >= x && px <= x + w && py >= y && py <= y + h;

// =================== graphic motifs (pure pattern) ===================

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

function stippleGradient(g, x, y, w, h, r) {
  const n = 520;
  for (let i = 0; i < n; i += 1) {
    const px = x + r() * w;
    const py = y + r() * h;
    const frac = (px - x) / w;
    if (r() < frac * 0.92 + 0.04) g.appendChild(dot(px, py, 0.7 + r() * 1.5));
  }
}

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

function hatchField(g, x, y, w, h, r) {
  const gap = 7 + Math.floor(r() * 4);
  for (let o = 0; o <= w + h; o += gap) {
    const p1 = [x + Math.min(o, w), y + Math.max(0, o - w)];
    const p2 = [x + Math.max(0, o - h), y + Math.min(o, h)];
    g.appendChild(line(p1[0], p1[1], p2[0], p2[1], { strokeWeight: "hairline" }));
  }
  g.appendChild(rect(x, y, w, h, { strokeWeight: "hairline" }));
}

function lineScreen(g, x, y, w, h) {
  const n = 26;
  const step = w / n;
  for (let i = 0; i < n; i += 1) {
    const t = step * (0.08 + (i / (n - 1)) * 0.82);
    g.appendChild(rect(x + i * step + (step - t) / 2, y, t, h, { fill: "currentColor", stroke: false }));
  }
}

function scanlines(g, x, y, w, h, r) {
  let cy = y;
  while (cy < y + h) {
    const th = 0.6 + r() * 2.6;
    g.appendChild(rect(x, cy, w, th, { fill: "currentColor", stroke: false, opacity: 0.88 }));
    cy += th + 1.4 + r() * 3.2;
  }
}

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

// ============ alignment: ink-metric cases (offline, no getBBox) ============
// Approach B: position tokens using per-glyph ink metrics extracted offline
// (MOCKUP_METRICS via scripts/extract-mockup-metrics.py). No runtime getBBox —
// fully deterministic. (Chromium getBBox returns the advance/line box, not tight
// ink, so these analytic metrics give strictly tighter ink alignment.)

const isCjk = ch => /[㐀-鿿豈-﫿]/.test(ch);

// analytic ink bbox of a string, in local px (baseline at y=0, start at x=0)
function glyphInk(text, familyMode, weightKey, size) {
  let cursor = 0;
  let l = Infinity;
  let r = -Infinity;
  let t = -Infinity;
  let b = Infinity;
  for (const ch of [...text]) {
    const fam = familyMode === "MONO" ? "Mono" : (isCjk(ch) ? "Glow" : "SUIT");
    const m = MOCKUP_METRICS[fam]?.[weightKey]?.[ch] || { adv: 0.6, l: 0.05, r: 0.55, t: 0.72, b: 0 };
    l = Math.min(l, cursor + m.l);
    r = Math.max(r, cursor + m.r);
    t = Math.max(t, m.t);
    b = Math.min(b, m.b);
    cursor += m.adv;
  }
  return { x: l * size, y: -t * size, width: (r - l) * size, height: (t - b) * size };
}

// analytic ink bbox of a node (single token, or a group of stacked tokens)
function nodeInk(node) {
  if (node.hasAttribute("data-text")) {
    return glyphInk(node.getAttribute("data-text"), node.getAttribute("data-fam"), node.getAttribute("data-wt"), Number(node.getAttribute("data-size")));
  }
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  node.querySelectorAll("text[data-text]").forEach(child => {
    const bb = glyphInk(child.getAttribute("data-text"), child.getAttribute("data-fam"), child.getAttribute("data-wt"), Number(child.getAttribute("data-size")));
    const ox = Number(child.getAttribute("x") || 0);
    const oy = Number(child.getAttribute("y") || 0);
    x0 = Math.min(x0, ox + bb.x);
    y0 = Math.min(y0, oy + bb.y);
    x1 = Math.max(x1, ox + bb.x + bb.width);
    y1 = Math.max(y1, oy + bb.y + bb.height);
  });
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

// place every tagged token by its precomputed ink box (no getBBox)
export function applyAnalyticSnap(root) {
  root.querySelectorAll("[data-asnap]").forEach(node => {
    const tx = Number(node.getAttribute("data-tx"));
    const ty = Number(node.getAttribute("data-ty"));
    const h = node.getAttribute("data-h");
    const v = node.getAttribute("data-v");
    const spin = Number(node.getAttribute("data-spin") || 0);
    const fitW = node.getAttribute("data-fit-w");
    const fitH = node.getAttribute("data-fit-h");
    const b = nodeInk(node);
    if (!b.width || !b.height) return;
    const s = (fitW && fitH) ? Math.min(Number(fitW) / b.width, Number(fitH) / b.height) : 1;
    const bx = b.x * s;
    const by = b.y * s;
    const bw = b.width * s;
    const bh = b.height * s;
    const desiredX = h === "left" ? tx : h === "right" ? tx - bw : tx - bw / 2;
    const desiredY = v === "top" ? ty : v === "bottom" ? ty - bh : ty - bh / 2;
    let tr = `translate(${(desiredX - bx).toFixed(2)} ${(desiredY - by).toFixed(2)})`;
    if (s !== 1) tr += ` scale(${s.toFixed(4)})`;
    if (spin) tr = `rotate(${spin} ${tx} ${ty}) ${tr}`;
    node.setAttribute("transform", tr);
  });
}

function glyph(value, size, opts = {}) {
  const familyMode = opts.family === MONO ? "MONO" : "DISPLAY";
  const weight = opts.weight || 900;
  const node = make("text", {
    x: 0, y: 0, fill: "currentColor",
    "font-family": opts.family || DISPLAY, "font-size": size, "font-weight": weight,
    "text-anchor": "start", "dominant-baseline": "alphabetic"
  });
  node.textContent = value;
  node.setAttribute("data-text", value);
  node.setAttribute("data-fam", familyMode);
  node.setAttribute("data-wt", String(weight));
  node.setAttribute("data-size", size);
  return node;
}

function snap(node, tx, ty, h, v, opts = {}) {
  node.setAttribute("data-asnap", "1");
  node.setAttribute("data-tx", tx);
  node.setAttribute("data-ty", ty);
  node.setAttribute("data-h", h);
  node.setAttribute("data-v", v);
  if (opts.spin) node.setAttribute("data-spin", opts.spin);
  if (opts.fitW) node.setAttribute("data-fit-w", opts.fitW);
  if (opts.fitH) node.setAttribute("data-fit-h", opts.fitH);
  return node;
}

function cross(g, x, y, s = 7, op = 0.7) {
  g.appendChild(line(x - s, y, x + s, y, { strokeWeight: "hairline", opacity: op }));
  g.appendChild(line(x, y - s, x, y + s, { strokeWeight: "hairline", opacity: op }));
}

// case 1: five anchors — corners + center, mixed scripts
function caseCorners(g, x, y, w, h) {
  const inset = Math.min(w, h) * 0.18;
  const size = Math.min(w, h) * 0.14;
  const pts = [
    { h: "left", v: "top", t: "系统" },
    { h: "right", v: "top", t: "OK" },
    { h: "center", v: "middle", t: "출력" },
    { h: "left", v: "bottom", t: "2026" },
    { h: "right", v: "bottom", t: "林" }
  ];
  pts.forEach(p => {
    const tx = p.h === "left" ? x + inset : p.h === "right" ? x + w - inset : x + w / 2;
    const ty = p.v === "top" ? y + inset : p.v === "bottom" ? y + h - inset : y + h / 2;
    cross(g, tx, ty);
    g.appendChild(snap(glyph(p.t, size), tx, ty, p.h, p.v));
  });
}

// case 2: mixed scripts sharing one visual top-line
function caseTopline(g, x, y, w, h) {
  const size = Math.min(w * 0.15, h * 0.34);
  const ty = y + h * 0.34;
  g.appendChild(line(x + w * 0.04, ty, x + w * 0.96, ty, { strokeWeight: "hairline", opacity: 0.6 }));
  const toks = ["系", "가", "A", "7", "林"];
  const inset = w * 0.1;
  const step = (w - inset * 2) / toks.length;
  toks.forEach((t, i) => {
    g.appendChild(snap(glyph(t, size), x + inset + step * i, ty, "left", "top"));
  });
}

// case 3: center align, then spin about the center
function caseSpin(g, x, y, w, h) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  cross(g, cx, cy, 9);
  g.appendChild(snap(glyph("系统", Math.min(w, h) * 0.2), cx, cy, "center", "middle", { spin: -12 }));
}

// case 4: vertical stack snapped to top-center as one group
function caseVertical(g, x, y, w, h) {
  const cx = x + w / 2;
  const top = y + h * 0.16;
  const size = Math.min(w, h) * 0.2;
  g.appendChild(line(cx, y + h * 0.08, cx, y + h * 0.92, { strokeWeight: "hairline", opacity: 0.3 }));
  g.appendChild(line(x + w * 0.2, top, x + w * 0.8, top, { strokeWeight: "hairline", opacity: 0.6 }));
  const col = make("g", {});
  ["시", "스", "템"].forEach((ch, i) => {
    const t = glyph(ch, size);
    t.setAttribute("y", i * size * 1.02);
    col.appendChild(t);
  });
  g.appendChild(snap(col, cx, top, "center", "top"));
}

// case 5: labels aligned to the corners of a graphic frame
function caseFrame(g, x, y, w, h) {
  const fx = x + w * 0.14;
  const fy = y + h * 0.18;
  const fw = w * 0.72;
  const fh = h * 0.6;
  g.appendChild(rect(fx, fy, fw, fh, { strokeWeight: "thin" }));
  const pad = Math.min(fw, fh) * 0.12;
  cross(g, fx + pad, fy + pad, 5, 0.4);
  cross(g, fx + fw - pad, fy + fh - pad, 5, 0.4);
  g.appendChild(snap(glyph("MODULE", Math.min(fw, fh) * 0.13, { family: MONO, weight: 700 }), fx + pad, fy + pad, "left", "top"));
  g.appendChild(snap(glyph("系统", Math.min(fw, fh) * 0.34), fx + fw / 2, fy + fh / 2, "center", "middle"));
  g.appendChild(snap(glyph("REV 07", Math.min(fw, fh) * 0.11, { family: MONO, weight: 700 }), fx + fw - pad, fy + fh - pad, "right", "bottom"));
}

// case 6: fit a long word to a box, then center by ink
function caseFit(g, x, y, w, h) {
  const bx = x + w * 0.12;
  const by = y + h * 0.32;
  const bw = w * 0.76;
  const bh = h * 0.36;
  g.appendChild(line(bx, by, bx, by + bh, { strokeWeight: "hairline", opacity: 0.55 }));
  g.appendChild(line(bx + bw, by, bx + bw, by + bh, { strokeWeight: "hairline", opacity: 0.55 }));
  g.appendChild(line(bx, by + bh / 2, bx + bw, by + bh / 2, { strokeWeight: "hairline", opacity: 0.16 }));
  g.appendChild(snap(glyph("RUNNING", 120, { weight: 900 }), bx + bw / 2, by + bh / 2, "center", "middle", { fitW: bw, fitH: bh }));
}

const ALIGN_CASES = [
  { id: "corners", cap: "5-anchor 코너+중앙", draw: caseCorners },
  { id: "shared-topline", cap: "혼합 스크립트 상단선", draw: caseTopline },
  { id: "center-spin", cap: "중앙 정렬 + 회전", draw: caseSpin },
  { id: "vertical-stack", cap: "세로 조판 그룹", draw: caseVertical },
  { id: "in-frame", cap: "그래픽 프레임 내부", draw: caseFrame },
  { id: "fit-to-box", cap: "박스 맞춤 + 중앙", draw: caseFit }
];

export function renderAlignmentDemo(width, height) {
  const board = make("g", { "data-mockup": "alignment" });
  const margin = Math.max(28, Math.min(56, width * 0.03));
  const titleH = 66;
  board.appendChild(txt(margin, 40, "ALIGNMENT — ink-metric (offline, no getBBox)", { size: 18, weight: 900, family: DISPLAY }));
  board.appendChild(txt(width - margin, 40, "가이드=목표 / 잉크가 맞아야 함", { size: 12, anchor: "end", family: DISPLAY }));
  board.appendChild(line(margin, 52, width - margin, 52, { strokeWeight: "hairline" }));

  const cols = width > 1000 ? 3 : 2;
  const rows = Math.ceil(ALIGN_CASES.length / cols);
  const gap = 18;
  const captionH = 26;
  const cellW = (width - margin * 2 - (cols - 1) * gap) / cols;
  const cellH = (height - titleH - margin - (rows - 1) * gap) / rows;

  ALIGN_CASES.forEach((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = margin + col * (cellW + gap);
    const cy = titleH + row * (cellH + gap);
    const cell = make("g", { "data-align-case": c.id });
    cell.appendChild(rect(cx, cy, cellW, cellH - captionH, { strokeWeight: "hairline", opacity: 0.5 }));
    c.draw(cell, cx, cy, cellW, cellH - captionH);
    cell.appendChild(txt(cx, cy + cellH - 8, c.id, { size: 11 }));
    cell.appendChild(txt(cx + cellW, cy + cellH - 8, c.cap, { size: 10, anchor: "end", opacity: 0.55, family: DISPLAY }));
    board.appendChild(cell);
  });
  return board;
}
