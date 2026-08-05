// Deck wiring. The text input rebuilds the phrase texture; everything else
// pokes a setter on the scene.

import { PALETTES, createTapeScene } from "./scene.js";

const canvas = document.getElementById("stage");
const status = document.getElementById("status");

let lab;
try {
  lab = createTapeScene(canvas);
} catch (error) {
  status.textContent = "NO WEBGL";
  throw error;
}

const textInput = document.getElementById("u-text");
let fontWeight = 900;

function applyText() {
  lab.setText(textInput.value, fontWeight);
}

// Rebuilding a texture per keystroke is cheap, but debounce so IME
// composition (Korean!) settles before the tape redraws.
let textTimer = 0;
textInput.addEventListener("input", () => {
  clearTimeout(textTimer);
  textTimer = setTimeout(applyText, 180);
});

const SLIDERS = {
  "u-flow": { apply: v => lab.setFlow(v), label: "v-flow", digits: 2 },
  "u-spin": { apply: v => lab.setSpin(v), label: "v-spin", digits: 2 },
  "u-repeat": { apply: v => lab.setRepeat(v), label: "v-repeat", digits: 0 },
  "u-tone": { apply: v => lab.setTone(v), label: "v-tone", digits: 2 },
  "u-edge": { apply: v => lab.setEdge(v), label: "v-edge", digits: 3 }
};

for (const [id, spec] of Object.entries(SLIDERS)) {
  const input = document.getElementById(id);
  const readout = document.getElementById(spec.label);
  const apply = () => {
    const value = Number(input.value);
    spec.apply(value);
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

wireSegment("surfaceSeg", data => lab.setSurface(data.surface));
wireSegment("paletteSeg", data => lab.setPalette(PALETTES[data.palette]));
wireSegment("weightSeg", data => {
  fontWeight = Number(data.weight);
  applyText();
});

window.addEventListener("resize", () => lab.resize());

// Redraw once webfonts land so the tape uses SUIT, not the fallback face.
document.fonts?.ready?.then(applyText);

let last = performance.now();
const start = last;
let frames = 0;
let stamp = last;

function frame(now) {
  lab.render(Math.min((now - last) / 1000, 0.05), (now - start) / 1000);
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
