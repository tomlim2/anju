// Deck wiring: sliders drive uniforms directly, segments swap model/palette.

import { PALETTES, createCelScene } from "./scene.js";

const canvas = document.getElementById("stage");
const status = document.getElementById("status");

let lab;
try {
  lab = createCelScene(canvas);
} catch (error) {
  status.textContent = "NO WEBGL";
  throw error;
}

// slider id → uniform name + display formatting
const SLIDERS = {
  "u-bands": { uniform: "uBands", label: "v-bands", digits: 0 },
  "u-threshold": { uniform: "uThreshold", label: "v-threshold", digits: 2 },
  "u-flat": { uniform: "uFlatWeight", label: "v-flat", digits: 2 },
  "u-tone": { uniform: "uToneScale", label: "v-tone", digits: 0 },
  "u-cover": { uniform: "uToneCover", label: "v-cover", digits: 2 },
  "u-spec": { uniform: "uSpecular", label: "v-spec", digits: 2 },
  "u-rim": { uniform: "uRim", label: "v-rim", digits: 2 },
  "u-line": { uniform: "uWidth", label: "v-line", digits: 3 }
};

for (const [id, spec] of Object.entries(SLIDERS)) {
  const input = document.getElementById(id);
  const readout = document.getElementById(spec.label);
  const apply = () => {
    const value = Number(input.value);
    lab.setUniform(spec.uniform, value);
    readout.textContent = value.toFixed(spec.digits);
  };
  input.addEventListener("input", apply);
  apply();
}

function wireSegment(rootId, apply) {
  const root = document.getElementById(rootId);
  root.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    root.querySelectorAll("button").forEach(b => b.classList.toggle("on", b === button));
    apply(button.dataset);
  });
}

wireSegment("modelSeg", data => lab.setModel(data.model));
wireSegment("paletteSeg", data => lab.setPalette(PALETTES[data.palette]));

window.addEventListener("resize", () => lab.resize());

let last = performance.now();
let frames = 0;
let stamp = last;

function frame(now) {
  lab.render(Math.min((now - last) / 1000, 0.05));
  last = now;
  frames += 1;
  if (now - stamp > 500) {
    status.textContent = `${Math.round((frames * 1000) / (now - stamp))} FPS`;
    frames = 0;
    stamp = now;
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
