// Component background tokens — a full-bleed, low-ink layer drawn behind the
// block layout. This is the base of the background system: mode selection is
// seeded (like borderMode), rendering is parameter-free and deterministic, and
// every primitive uses the shared svg helpers so the stroke-weight validation
// that runs over the whole artwork keeps passing. Density is kept far below
// the foreground motifs so typography stays in charge; "none" carries the
// heaviest weight on purpose.
import { line, make } from "./svg.js";

const PHI = (1 + Math.sqrt(5)) / 2;

// keyedPick draws uniformly, so repetition is the weighting.
export const componentBackgroundModes = Object.freeze([
  "none", "none", "none",
  "graph", "dot-grid", "scanlines", "golden-rules"
]);

// box is the component's safe box: the background stays inside the block
// grid's bounds instead of bleeding to the component edge, so its lines end
// where the composition ends.
export function renderComponentBackground(mode, box) {
  if (mode === "none") return null;
  const { x: left, y: top, width, height } = box;
  const right = left + width;
  const bottom = top + height;
  const group = make("g", { "data-component-background": mode });
  if (mode === "graph") {
    const step = Math.max(48, Math.min(width, height) / 8);
    for (let x = left + step; x < right; x += step) group.appendChild(line(x, top, x, bottom));
    for (let y = top + step; y < bottom; y += step) group.appendChild(line(left, y, right, y));
  } else if (mode === "dot-grid") {
    const step = Math.max(56, Math.min(width, height) / 7);
    for (let x = left + step; x < right; x += step) {
      for (let y = top + step; y < bottom; y += step) {
        group.appendChild(make("circle", { cx: x, cy: y, r: 1.6, fill: "currentColor" }));
      }
    }
  } else if (mode === "scanlines") {
    const step = Math.max(36, height / 14);
    for (let y = top + step; y < bottom; y += step) {
      group.appendChild(line(left, y, right, y, { opacity: 0.45 }));
    }
  } else if (mode === "golden-rules") {
    // two golden-section rules per axis — structure without texture
    for (const x of [left + width / PHI, right - width / PHI]) {
      group.appendChild(line(x, top, x, bottom));
    }
    for (const y of [top + height / PHI, bottom - height / PHI]) {
      group.appendChild(line(left, y, right, y));
    }
  } else {
    throw new Error(`unknown component background mode: ${mode}`);
  }
  return group;
}
