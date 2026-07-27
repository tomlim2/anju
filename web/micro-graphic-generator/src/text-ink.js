// True glyph-ink extents for a rendered string.
//
// SVG getBBox() on <text> reports the advance/line box, which sits outside the
// ink on every side: above the cap line, below the baseline, and inside the
// left/right side bearings. Anchoring or fitting against it leaves an
// edge-anchored token visibly floating off the grid line — worst on CJK, where
// the side bearings are widest. Canvas measureText() reports the actual ink
// box for the exact string, including kerning and font fallback.

const INK_X = "data-ink-x";
const INK_Y = "data-ink-y";
const INK_WIDTH = "data-ink-width";
const INK_HEIGHT = "data-ink-height";

let measuringContext = null;

function context() {
  if (measuringContext === null) {
    measuringContext = document.createElement("canvas").getContext("2d") || false;
  }
  return measuringContext || null;
}

// Ink box relative to the text origin: x=0 at the anchor, y=0 on the baseline.
export function measureTextInk({ text, fontFamily, fontSize, fontWeight }) {
  const value = String(text ?? "");
  if (!value || !fontFamily || !Number.isFinite(fontSize) || fontSize <= 0) return null;
  const ctx = context();
  if (!ctx) return null;
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const metrics = ctx.measureText(value);
  const left = -metrics.actualBoundingBoxLeft;
  const right = metrics.actualBoundingBoxRight;
  const top = -metrics.actualBoundingBoxAscent;
  const bottom = metrics.actualBoundingBoxDescent;
  if (![left, right, top, bottom].every(Number.isFinite)) return null;
  if (!(right > left) || !(bottom > top)) return null;
  return Object.freeze({ left, right, top, bottom, width: right - left, height: bottom - top });
}

export function setInkBounds(node, box) {
  node.setAttribute(INK_X, String(box.x));
  node.setAttribute(INK_Y, String(box.y));
  node.setAttribute(INK_WIDTH, String(box.width));
  node.setAttribute(INK_HEIGHT, String(box.height));
}

export function clearInkBounds(node) {
  [INK_X, INK_Y, INK_WIDTH, INK_HEIGHT].forEach(name => node.removeAttribute(name));
}

// Ink box in the node's own user space, matching what getBBox() would return.
export function inkBounds(node) {
  if (!node?.hasAttribute?.(INK_X)) return null;
  const box = {
    x: Number(node.getAttribute(INK_X)),
    y: Number(node.getAttribute(INK_Y)),
    width: Number(node.getAttribute(INK_WIDTH)),
    height: Number(node.getAttribute(INK_HEIGHT))
  };
  return Object.values(box).every(Number.isFinite) && box.width > 0 && box.height > 0 ? box : null;
}
