// Glyph sampling.
//
// The word is drawn once to an offscreen 2D canvas and the lit pixels are kept
// as points. Going through the browser's own text rasteriser means Korean,
// Latin and CJK all sample identically with no typeface file to ship and no
// build step — the same reason the generator measures ink with canvas rather
// than trusting a precomputed table.

const RASTER_HEIGHT = 168;
const ALPHA_CUTOFF = 128;
const FONT_STACK = '"SUIT", "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", "Noto Sans SC", sans-serif';

let sampler = null;

function context() {
  if (sampler === null) {
    const canvas = document.createElement("canvas");
    sampler = canvas.getContext("2d", { willReadFrequently: true }) || false;
  }
  return sampler || null;
}

// Points are centred on the origin and normalised so the ink is `unitHeight`
// tall, whatever the script — a two-glyph hanzi word and a seven-letter latin
// one then occupy comparable space in the field.
export function sampleWord(text, { budget = 5200, unitHeight = 12 } = {}) {
  const ctx = context();
  const value = String(text ?? "").trim();
  if (!ctx || !value) return { points: [], pitch: 0.3 };

  const font = `900 ${RASTER_HEIGHT}px ${FONT_STACK}`;
  ctx.font = font;
  const metrics = ctx.measureText(value);
  const inkWidth = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
  const inkHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
  if (!(inkWidth > 0) || !(inkHeight > 0)) return { points: [], pitch: 0.3 };

  const pad = 6;
  const width = Math.ceil(inkWidth) + pad * 2;
  const height = Math.ceil(inkHeight) + pad * 2;
  ctx.canvas.width = width;
  ctx.canvas.height = height;

  // Resizing the canvas resets the context, so the font is set again here.
  ctx.font = font;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#000";
  ctx.fillText(value, pad + metrics.actualBoundingBoxLeft, pad + metrics.actualBoundingBoxAscent);

  const { data } = ctx.getImageData(0, 0, width, height);
  const scale = unitHeight / inkHeight;

  // Coarsen the grid until the word fits the instance budget. Subsampling a
  // denser cloud instead would drop cubes at random and shred the strokes;
  // a wider step keeps every stroke solid, just built from chunkier cubes.
  const collect = stride => {
    const found = [];
    for (let y = 0; y < height; y += stride) {
      for (let x = 0; x < width; x += stride) {
        if (data[(y * width + x) * 4 + 3] < ALPHA_CUTOFF) continue;
        found.push({ x: (x - width / 2) * scale, y: (height / 2 - y) * scale });
      }
    }
    return found;
  };

  let step = 2;
  let points = collect(step);
  while (points.length > budget && step < 16) {
    step += 1;
    points = collect(step);
  }
  // The pitch is what one sampling step is worth in world units. Cubes are
  // sized from it so they read as a lattice with air between them instead of
  // fusing into a solid slab.
  return { points, pitch: step * scale };
}

// Deterministic 0..1 from an integer, so the scatter and per-instance delays
// stay identical between reloads.
export function hash01(index) {
  let value = Math.imul(index ^ 0x9e3779b9, 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

// Lay a point cloud onto the fixed instance budget. A short word simply leaves
// the tail of the budget switched off — duplicating points to fill it would
// stack cubes on the same cell and fray the silhouette.
export function fitToBudget(points, budget) {
  const targets = new Array(budget);
  for (let i = 0; i < budget; i += 1) {
    if (i < points.length) {
      targets[i] = { x: points[i].x, y: points[i].y, active: 1 };
    } else {
      // Parked instances keep their last position so they shrink in place
      // rather than streaking back to the origin on every word change.
      targets[i] = { x: points.length ? points[i % points.length].x : 0, y: points.length ? points[i % points.length].y : 0, active: 0 };
    }
  }
  return targets;
}
