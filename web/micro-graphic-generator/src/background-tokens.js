// Component background tokens — a full-bleed, low-ink layer drawn behind the
// block layout. This is the base of the background system: mode selection is
// seeded (like borderMode), rendering is parameter-free and deterministic, and
// every primitive uses the shared svg helpers so the stroke-weight validation
// that runs over the whole artwork keeps passing. Density is kept far below
// the foreground motifs so typography stays in charge; "none" carries the
// heaviest weight on purpose.
import { line, make } from "./svg.js";

const PHI = (1 + Math.sqrt(5)) / 2;

// Background tokens come in two scopes. A component background is one
// full-bleed field behind the whole plate — it reads as the paper's texture.
// A grid-cell background fills a single block's cell, so it reads as one
// panel of the composition being shaded rather than the sheet itself.
// Both scopes share the same pattern renderers; only the box differs.

// Every mode is built from one of two marks. The two scopes must not draw
// from the same family: dots behind dots (or lines behind lines) reads as one
// misaligned field rather than as two deliberate layers.
const BACKGROUND_MODE_FAMILIES = Object.freeze({
  graph: "lines",
  scanlines: "lines",
  "golden-rules": "lines",
  "dot-grid": "dots",
  "dot-stagger": "dots",
  "dot-fade": "dots",
  "dot-concentric": "dots"
});

export function backgroundModeFamily(mode) {
  return BACKGROUND_MODE_FAMILIES[mode] || null;
}

// Families the generator may draw from. The renderers and family map below
// stay complete so a family can be switched back on by editing this set
// alone — deactivation only removes modes from the random pools.
const ACTIVE_BACKGROUND_FAMILIES = new Set(["dots"]);

function activeModes(pool) {
  return Object.freeze(pool.filter(mode => {
    const family = backgroundModeFamily(mode);
    return family === null || ACTIVE_BACKGROUND_FAMILIES.has(family);
  }));
}

// keyedPick draws uniformly, so repetition is the weighting.
export const componentBackgroundModes = activeModes([
  "none", "none", "none", "none",
  "graph", "scanlines", "golden-rules",
  "dot-grid", "dot-stagger", "dot-fade", "dot-concentric"
]);

// Cell scope leans heavier on "none": a shaded panel is a strong accent, and
// golden-rules is excluded because φ sections need the full plate to read.
export const gridCellBackgroundModes = activeModes([
  "none", "none", "none", "none", "none", "none",
  "graph", "scanlines",
  "dot-grid", "dot-stagger", "dot-fade", "dot-concentric"
]);

// Paints one pattern into `box`. Patterns are centre-origin: rows and columns
// sit symmetrically at ±step/2, ±3·step/2, … from the box centre, so the box
// always has a whole cell centred in it. Phase variation would break that
// symmetry, so only the step varies. `random` is a seeded source, so the same
// seed always draws the same field. Variation ranges stay narrow: the layer
// should stop repeating itself, not get louder.
// `scale` shrinks the pattern for small boxes — a cell-scoped field needs a
// finer step than a full plate to read as texture rather than as a few stray
// lines.
function paintBackgroundPattern(group, mode, box, random, scale = 1) {
  const { x: left, y: top, width, height } = box;
  const right = left + width;
  const bottom = top + height;
  if (mode === "graph") {
    const step = Math.max(44 * scale, (Math.min(width, height) / 8) * random.range(0.8, 1.45));
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    for (let x = centerX - step / 2; x > left; x -= step) group.appendChild(line(x, top, x, bottom));
    for (let x = centerX + step / 2; x < right; x += step) group.appendChild(line(x, top, x, bottom));
    for (let y = centerY - step / 2; y > top; y -= step) group.appendChild(line(left, y, right, y));
    for (let y = centerY + step / 2; y < bottom; y += step) group.appendChild(line(left, y, right, y));
  } else if (mode === "dot-grid") {
    const step = Math.max(50 * scale, (Math.min(width, height) / 7) * random.range(0.8, 1.5));
    const radius = random.range(1.3, 2.2) * (scale < 1 ? 0.8 : 1);
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const xs = [];
    for (let x = centerX - step / 2; x > left; x -= step) xs.push(x);
    for (let x = centerX + step / 2; x < right; x += step) xs.push(x);
    const ys = [];
    for (let y = centerY - step / 2; y > top; y -= step) ys.push(y);
    for (let y = centerY + step / 2; y < bottom; y += step) ys.push(y);
    for (const x of xs) {
      for (const y of ys) {
        group.appendChild(make("circle", { cx: x, cy: y, r: radius, fill: "currentColor" }));
      }
    }
  } else if (mode === "dot-stagger") {
    // Brick lattice: alternate rows shift by half a step. Rows are indexed by
    // their distance from the centre so mirrored rows share a parity and the
    // field stays symmetric about the centre.
    const step = Math.max(50 * scale, (Math.min(width, height) / 7) * random.range(0.8, 1.5));
    const radius = random.range(1.3, 2.2) * (scale < 1 ? 0.8 : 1);
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    for (let index = 0; ; index += 1) {
      const up = centerY - (index + 0.5) * step;
      const down = centerY + (index + 0.5) * step;
      const rows = [];
      if (up > top) rows.push(up);
      if (down < bottom) rows.push(down);
      if (!rows.length) break;
      const shift = index % 2 ? step / 2 : 0;
      for (const y of rows) {
        for (let x = centerX - step / 2 + shift; x > left; x -= step) {
          group.appendChild(make("circle", { cx: x, cy: y, r: radius, fill: "currentColor" }));
        }
        for (let x = centerX + step / 2 + shift; x < right; x += step) {
          group.appendChild(make("circle", { cx: x, cy: y, r: radius, fill: "currentColor" }));
        }
      }
    }
  } else if (mode === "dot-fade") {
    // Halftone falloff on the centre-origin lattice: dot size ramps with
    // distance from the centre, inward or outward by seed.
    const step = Math.max(50 * scale, (Math.min(width, height) / 7) * random.range(0.8, 1.5));
    const maxRadius = random.range(1.8, 2.8) * (scale < 1 ? 0.8 : 1);
    const outward = random.chance(0.5);
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const xs = [];
    for (let x = centerX - step / 2; x > left; x -= step) xs.push(x);
    for (let x = centerX + step / 2; x < right; x += step) xs.push(x);
    const ys = [];
    for (let y = centerY - step / 2; y > top; y -= step) ys.push(y);
    for (let y = centerY + step / 2; y < bottom; y += step) ys.push(y);
    for (const x of xs) {
      for (const y of ys) {
        const spread = Math.min(1, Math.hypot(
          (x - centerX) / (width / 2),
          (y - centerY) / (height / 2)
        ) / Math.SQRT2);
        const strength = outward ? spread : 1 - spread;
        group.appendChild(make("circle", {
          cx: x, cy: y, r: maxRadius * (0.18 + strength * 0.82), fill: "currentColor"
        }));
      }
    }
  } else if (mode === "dot-concentric") {
    // Rings of dots stepping out from the centre — the centre-origin rule in
    // polar form. Spacing along each ring matches the ring spacing. The step
    // runs tighter than the square lattices: outer rings are clipped by the
    // box corners, so a wide step leaves too few whole rings to read as one.
    const step = Math.max(34 * scale, (Math.min(width, height) / 11) * random.range(0.85, 1.35));
    const radius = random.range(1.3, 2.2) * (scale < 1 ? 0.8 : 1);
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const reach = Math.hypot(width / 2, height / 2);
    group.appendChild(make("circle", { cx: centerX, cy: centerY, r: radius, fill: "currentColor" }));
    for (let ring = step / 2; ring < reach; ring += step) {
      const count = Math.max(6, Math.round((2 * Math.PI * ring) / step));
      for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * Math.PI * 2;
        const x = centerX + Math.cos(angle) * ring;
        const y = centerY + Math.sin(angle) * ring;
        if (x < left || x > right || y < top || y > bottom) continue;
        group.appendChild(make("circle", { cx: x, cy: y, r: radius, fill: "currentColor" }));
      }
    }
  } else if (mode === "scanlines") {
    const step = Math.max(32 * scale, (height / 14) * random.range(0.75, 1.5));
    const centerY = top + height / 2;
    for (let y = centerY - step / 2; y > top; y -= step) {
      group.appendChild(line(left, y, right, y, { opacity: 0.45 }));
    }
    for (let y = centerY + step / 2; y < bottom; y += step) {
      group.appendChild(line(left, y, right, y, { opacity: 0.45 }));
    }
  } else if (mode === "golden-rules") {
    // golden-section rules — structure without texture. The seed varies which
    // axes participate, never where the sections sit: the φ positions are the
    // point of the mode.
    const axes = random.pick(["both", "both", "vertical", "horizontal"]);
    if (axes !== "horizontal") {
      for (const x of [left + width / PHI, right - width / PHI]) {
        group.appendChild(line(x, top, x, bottom));
      }
    }
    if (axes !== "vertical") {
      for (const y of [top + height / PHI, bottom - height / PHI]) {
        group.appendChild(line(left, y, right, y));
      }
    }
  } else {
    throw new Error(`unknown background mode: ${mode}`);
  }
}

// Component scope: one full-bleed field behind the whole plate. box is the
// canonical component box, not the block grid's safe box — backgrounds ignore
// grid padding so they read as the paper's own texture.
export function renderComponentBackground(mode, box, random) {
  if (mode === "none") return null;
  const group = make("g", { "data-component-background": mode });
  paintBackgroundPattern(group, mode, box, random);
  return group;
}

// Cell scope: the field is clipped to one block's cell, so it shades a single
// panel instead of the sheet. Drawn under that block's token.
export function renderGridCellBackground(mode, box, random) {
  if (mode === "none") return null;
  const group = make("g", { "data-cell-background": mode });
  paintBackgroundPattern(group, mode, box, random, 0.5);
  return group;
}
