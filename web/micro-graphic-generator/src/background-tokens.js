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

// box is the full component box, not the block grid's safe box: backgrounds
// ignore grid padding and bleed to the component edge so they read as the
// paper's own texture rather than as a composition element. `random` is a
// seeded source derived from the generation's layout seed — spacing varies
// per seed, but the same seed always draws the same background. Variation
// ranges are narrow on purpose: the layer should stop repeating itself, not
// get louder.
export function renderComponentBackground(mode, box, random) {
  if (mode === "none") return null;
  const { x: left, y: top, width, height } = box;
  const right = left + width;
  const bottom = top + height;
  const group = make("g", { "data-component-background": mode });
  if (mode === "graph") {
    // Centre-origin lattice: lines sit symmetrically at ±step/2, ±3·step/2, …
    // from the component centre, so one grid square is always centred on the
    // component. Phase variation would break this symmetry, so graph varies
    // only its step.
    const step = Math.max(44, (Math.min(width, height) / 8) * random.range(0.8, 1.45));
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    for (let x = centerX - step / 2; x > left; x -= step) group.appendChild(line(x, top, x, bottom));
    for (let x = centerX + step / 2; x < right; x += step) group.appendChild(line(x, top, x, bottom));
    for (let y = centerY - step / 2; y > top; y -= step) group.appendChild(line(left, y, right, y));
    for (let y = centerY + step / 2; y < bottom; y += step) group.appendChild(line(left, y, right, y));
  } else if (mode === "dot-grid") {
    // Centre-origin like graph: dots sit at ±step/2, ±3·step/2, … so four
    // dots always frame a square centred on the component.
    const step = Math.max(50, (Math.min(width, height) / 7) * random.range(0.8, 1.5));
    const radius = random.range(1.3, 2.2);
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
  } else if (mode === "scanlines") {
    // Centre-origin: the middle band straddles the component centre.
    const step = Math.max(32, (height / 14) * random.range(0.75, 1.5));
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
    throw new Error(`unknown component background mode: ${mode}`);
  }
  return group;
}
