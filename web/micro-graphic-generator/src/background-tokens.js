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
// where the composition ends. `random` is a seeded source derived from the
// generation's layout seed — spacing and phase vary per seed, but the same
// seed always draws the same background. Variation ranges are narrow on
// purpose: the layer should stop repeating itself, not get louder.
export function renderComponentBackground(mode, box, random) {
  if (mode === "none") return null;
  const { x: left, y: top, width, height } = box;
  const right = left + width;
  const bottom = top + height;
  const group = make("g", { "data-component-background": mode });
  if (mode === "graph") {
    const step = Math.max(44, (Math.min(width, height) / 8) * random.range(0.8, 1.45));
    const phaseX = random.range(0, step);
    const phaseY = random.range(0, step);
    for (let x = left + phaseX; x < right; x += step) group.appendChild(line(x, top, x, bottom));
    for (let y = top + phaseY; y < bottom; y += step) group.appendChild(line(left, y, right, y));
  } else if (mode === "dot-grid") {
    const step = Math.max(50, (Math.min(width, height) / 7) * random.range(0.8, 1.5));
    const phaseX = random.range(0, step);
    const phaseY = random.range(0, step);
    const radius = random.range(1.3, 2.2);
    for (let x = left + phaseX; x < right; x += step) {
      for (let y = top + phaseY; y < bottom; y += step) {
        group.appendChild(make("circle", { cx: x, cy: y, r: radius, fill: "currentColor" }));
      }
    }
  } else if (mode === "scanlines") {
    const step = Math.max(32, (height / 14) * random.range(0.75, 1.5));
    const phase = random.range(0, step);
    for (let y = top + phase; y < bottom; y += step) {
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
    throw new Error(`unknown component background mode: ${mode}`);
  }
  return group;
}
