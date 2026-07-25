// Standalone preview of the proposed "Manga-Terminal" graphic set.
// Draws seed-varied mockups into a gallery board. Does NOT touch the
// locked composition pipeline (motifs.js / owner snapshot) — this is a
// design preview mode only. See GRAPHIC_REDESIGN_PLAN.md.

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
    size = 12, family = MONO, weight = 700,
    anchor = "start", opacity = 1, transform = ""
  } = opts;
  const node = make("text", {
    x, y, fill: "currentColor",
    "font-family": family, "font-size": size, "font-weight": weight,
    "text-anchor": anchor, "dominant-baseline": "alphabetic",
    opacity, transform
  });
  node.textContent = value;
  return node;
}

function dot(cx, cy, r, opacity = 1) {
  return make("circle", { cx, cy, r, fill: "currentColor", stroke: "none", opacity });
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
    d,
    fill: opts.fill ?? "none",
    stroke: opts.stroke ?? "currentColor",
    "stroke-width": opts.strokeWidth ?? 2,
    "stroke-linejoin": "round",
    "stroke-linecap": "round",
    opacity: opts.opacity ?? 1
  });
}

// ray from center to the perimeter of a box centered at (cx,cy) with half extents
function rayToBox(cx, cy, angle, hw, hh) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const tx = dx === 0 ? Infinity : hw / Math.abs(dx);
  const ty = dy === 0 ? Infinity : hh / Math.abs(dy);
  const t = Math.min(tx, ty);
  return [cx + dx * t, cy + dy * t];
}

// ---- motif renderers: each draws into group g within box (x,y,w,h) ----

function halftoneMeter(g, x, y, w, h, r) {
  const cols = 14;
  const rows = 7;
  const cw = w / cols;
  const ch = h / rows;
  const level = 0.3 + r() * 0.6; // encoded value
  for (let cx = 0; cx < cols; cx += 1) {
    const density = cx / (cols - 1); // gradient left->right
    for (let cy = 0; cy < rows; cy += 1) {
      const radius = Math.min(cw, ch) * 0.5 * (0.15 + density * 0.85);
      g.appendChild(dot(x + cx * cw + cw / 2, y + cy * ch + ch / 2, radius));
    }
  }
  g.appendChild(rect(x, y, w, h, { strokeWeight: "hairline" }));
  g.appendChild(txt(x + w, y - 6, `${Math.round(level * 100)}%`, { anchor: "end", size: 12 }));
}

function hatchField(g, x, y, w, h, r) {
  const gap = 7 + Math.floor(r() * 4);
  // 45deg hatch: diagonal offset o sweeps across, endpoints clamped to box edges
  for (let o = 0; o <= w + h; o += gap) {
    const p1 = [x + Math.min(o, w), y + Math.max(0, o - w)];
    const p2 = [x + Math.max(0, o - h), y + Math.min(o, h)];
    g.appendChild(line(p1[0], p1[1], p2[0], p2[1], { strokeWeight: "hairline" }));
  }
  g.appendChild(rect(x, y, w, h, { strokeWeight: "hairline" }));
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
      if (r() < fillRate) {
        g.appendChild(rect(px, py, s, s, { fill: "currentColor", stroke: false }));
      } else {
        g.appendChild(rect(px, py, s, s, { strokeWeight: "hairline" }));
      }
    }
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
    // clamp edge to box
    const ex = Math.max(x, Math.min(x + w, edge[0]));
    const ey = Math.max(y, Math.min(y + h, edge[1]));
    g.appendChild(line(ix, iy, ex, ey, { strokeWeight: i % 2 ? "hairline" : "thin" }));
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

function impactBurst(g, x, y, w, h, r) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const points = 12;
  const outer = Math.min(w, h) * 0.5;
  const pts = [];
  for (let i = 0; i < points * 2; i += 1) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 ? outer : outer * (0.42 + r() * 0.12);
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  g.appendChild(poly(pts, false, { strokeWidth: 3 }));
  g.appendChild(txt(cx, cy + 6, "!", { anchor: "middle", size: Math.min(w, h) * 0.28, family: DISPLAY, weight: 900 }));
}

function roundedBalloonPath(x, y, w, h, rad) {
  return `M${x + rad},${y} H${x + w - rad} Q${x + w},${y} ${x + w},${y + rad}`
    + ` V${y + h - rad} Q${x + w},${y + h} ${x + w - rad},${y + h}`
    + ` H${x + w * 0.42} L${x + w * 0.30},${y + h + h * 0.22} L${x + w * 0.34},${y + h}`
    + ` H${x + rad} Q${x},${y + h} ${x},${y + h - rad} V${y + rad} Q${x},${y} ${x + rad},${y} Z`;
}

function speechBalloon(g, x, y, w, h, r, word = "로드") {
  const bh = h * 0.72;
  g.appendChild(path(roundedBalloonPath(x, y, w, bh, 14), { strokeWidth: 2.5 }));
  g.appendChild(txt(x + w / 2, y + bh / 2 + 8, word, { anchor: "middle", size: bh * 0.4, family: DISPLAY, weight: 900 }));
}

function shoutBalloon(g, x, y, w, h, r, word = "ERROR") {
  const cx = x + w / 2;
  const cy = y + h * 0.42;
  const rw = w * 0.5;
  const rh = h * 0.34;
  const spikes = 14;
  const pts = [];
  for (let i = 0; i < spikes * 2; i += 1) {
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const k = i % 2 ? 1 : 0.74 + r() * 0.06;
    pts.push([cx + Math.cos(a) * rw * k, cy + Math.sin(a) * rh * k]);
  }
  g.appendChild(poly(pts, false, { strokeWidth: 2.5 }));
  g.appendChild(txt(cx, cy + rh * 0.28, word, { anchor: "middle", size: rh * 0.62, family: DISPLAY, weight: 900 }));
}

function thoughtCloud(g, x, y, w, h, r) {
  const cx = x + w / 2;
  const cy = y + h * 0.4;
  const bumps = 9;
  const rw = w * 0.42;
  const rh = h * 0.26;
  for (let i = 0; i < bumps; i += 1) {
    const a = (i / bumps) * Math.PI * 2;
    const bx = cx + Math.cos(a) * rw;
    const by = cy + Math.sin(a) * rh;
    g.appendChild(make("circle", { cx: bx, cy: by, r: Math.min(w, h) * (0.12 + r() * 0.03), fill: "none", stroke: "currentColor", "stroke-width": 2 }));
  }
  g.appendChild(make("circle", { cx: cx - w * 0.28, cy: cy + h * 0.4, r: 6, fill: "none", stroke: "currentColor", "stroke-width": 2 }));
  g.appendChild(make("circle", { cx: cx - w * 0.36, cy: cy + h * 0.5, r: 3.5, fill: "none", stroke: "currentColor", "stroke-width": 2 }));
  g.appendChild(txt(cx, cy + 6, "…", { anchor: "middle", size: rh, family: DISPLAY, weight: 900 }));
}

function stateMarks(g, x, y, w, h) {
  const cell = w / 4;
  const cy = y + h * 0.42;
  const s = Math.min(cell, h) * 0.3;
  // sweat drop
  let cx = x + cell * 0.5;
  g.appendChild(path(`M${cx},${cy - s} C${cx + s * 0.9},${cy} ${cx + s * 0.6},${cy + s} ${cx},${cy + s} C${cx - s * 0.6},${cy + s} ${cx - s * 0.9},${cy} ${cx},${cy - s} Z`, { strokeWidth: 2.5 }));
  g.appendChild(txt(cx, y + h - 4, "汗", { anchor: "middle", size: 11, family: DISPLAY }));
  // anger vein 💢
  cx = x + cell * 1.5;
  const v = s * 0.9;
  for (const [dx1, dy1, dx2, dy2] of [[-v, 0, 0, -v], [0, -v, v, 0], [v, 0, 0, v], [0, v, -v, 0]]) {
    g.appendChild(line(cx + dx1 * 0.5, cy + dy1 * 0.5, cx + dx2 * 0.5, cy + dy2 * 0.5, { strokeWeight: "thin" }));
  }
  g.appendChild(line(cx - v * 0.5, cy, cx + v * 0.5, cy, { strokeWeight: "thin" }));
  g.appendChild(line(cx, cy - v * 0.5, cx, cy + v * 0.5, { strokeWeight: "thin" }));
  g.appendChild(txt(cx, y + h - 4, "怒", { anchor: "middle", size: 11, family: DISPLAY }));
  // sparkle
  cx = x + cell * 2.5;
  g.appendChild(poly([[cx, cy - s], [cx + s * 0.22, cy - s * 0.22], [cx + s, cy], [cx + s * 0.22, cy + s * 0.22], [cx, cy + s], [cx - s * 0.22, cy + s * 0.22], [cx - s, cy], [cx - s * 0.22, cy - s * 0.22]], true));
  g.appendChild(txt(cx, y + h - 4, "OK", { anchor: "middle", size: 11 }));
  // ?!
  cx = x + cell * 3.5;
  g.appendChild(txt(cx, cy + s * 0.7, "!?", { anchor: "middle", size: s * 2.2, family: DISPLAY, weight: 900 }));
  g.appendChild(txt(cx, y + h - 4, "QRY", { anchor: "middle", size: 11 }));
}

function onomatopoeia(g, x, y, w, h, r) {
  // vertical dread stack + slanted impact word (Korean, renders with SUIT)
  const stack = ["두", "근", "두", "근"];
  const fs = Math.min(h / stack.length * 0.9, w * 0.28);
  stack.forEach((ch, i) => {
    g.appendChild(txt(x + w * 0.2, y + fs * (i + 0.9), ch, { anchor: "middle", size: fs, family: DISPLAY, weight: 900 }));
  });
  const bx = x + w * 0.62;
  const by = y + h * 0.6;
  g.appendChild(txt(bx, by, "번쩍", {
    anchor: "middle", size: w * 0.24, family: DISPLAY, weight: 900,
    transform: `rotate(${-8 + r() * 6} ${bx} ${by}) skewX(-6)`
  }));
}

const MOTIFS = [
  { id: "halftone-meter", note: "톤=값", draw: halftoneMeter },
  { id: "hatch-field", note: "load", draw: hatchField },
  { id: "dot-matrix-field", note: "unit", draw: dotMatrixField },
  { id: "focus-lines", note: "集中線", draw: focusLines },
  { id: "speed-lines", note: "stream", draw: speedLines },
  { id: "beta-flash", note: "flash", draw: betaFlash },
  { id: "impact-burst", note: "impact", draw: impactBurst },
  { id: "speech-balloon", note: "吹き出し", draw: (g, x, y, w, h, r) => speechBalloon(g, x, y, w, h, r) },
  { id: "shout-balloon", note: "叫び", draw: (g, x, y, w, h, r) => shoutBalloon(g, x, y, w, h, r) },
  { id: "thought-cloud", note: "predict", draw: thoughtCloud },
  { id: "state-mark", note: "state", draw: (g, x, y, w, h) => stateMarks(g, x, y, w, h) },
  { id: "onomatopoeia", note: "描き文字", draw: onomatopoeia }
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
    const bx = cx + pad;
    const by = cy + pad;
    const bw = cellW - pad * 2;
    const bh = cellH - captionH - pad * 2;
    const inner = make("g", {});
    const rnd = mulberry32((seed ^ (i * 0x9e3779b1)) >>> 0);
    motif.draw(inner, bx, by, bw, bh, rnd);
    cell.appendChild(inner);
    cell.appendChild(txt(cx, cy + cellH - 8, motif.id, { size: 11 }));
    cell.appendChild(txt(cx + cellW, cy + cellH - 8, motif.note, { size: 11, anchor: "end", opacity: 0.6 }));
    board.appendChild(cell);
  });
  return board;
}
