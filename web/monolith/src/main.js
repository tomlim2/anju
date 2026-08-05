// Page wiring: which panel is on screen decides the word, the pointer tilts
// the field, and everything else stays out of the way.

import { createTypeScene } from "./scene.js";

const canvas = document.getElementById("stage");
const status = document.getElementById("status");
const panels = [...document.querySelectorAll(".panel")];

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function fail(message) {
  status.textContent = "NO WEBGL";
  const notice = document.createElement("p");
  notice.className = "noscript";
  notice.textContent = message;
  document.body.appendChild(notice);
}

let scene;
try {
  scene = createTypeScene(canvas, { reducedMotion });
} catch (error) {
  fail("이 브라우저에서 WebGL을 시작할 수 없습니다.");
  throw error;
}

const specCount = document.getElementById("specCount");
if (specCount) specCount.textContent = `${scene.instances.toLocaleString("en-US")} CUBES`;

// The panel closest to the middle of the viewport owns the field, so a word
// only changes once its copy is actually the thing being read.
function activePanel() {
  const centre = window.innerHeight / 2;
  let best = panels[0];
  let bestDistance = Infinity;
  for (const panel of panels) {
    const rect = panel.getBoundingClientRect();
    const distance = Math.abs(rect.top + rect.height / 2 - centre);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = panel;
    }
  }
  return best;
}

let currentPanel = null;
function syncWord() {
  const panel = activePanel();
  if (!panel || panel === currentPanel) return;
  currentPanel = panel;
  scene.setWord(panel.dataset.word);
  status.textContent = panel.dataset.latin || "LIVE";
  status.dataset.state = "live";
}

function pointerFromEvent(clientX, clientY) {
  scene.setPointer(
    (clientX / window.innerWidth) * 2 - 1,
    (clientY / window.innerHeight) * 2 - 1
  );
}

window.addEventListener("pointermove", event => pointerFromEvent(event.clientX, event.clientY), { passive: true });
window.addEventListener("pointerleave", () => scene.setPointer(0, 0), { passive: true });
window.addEventListener("scroll", syncWord, { passive: true });
window.addEventListener("resize", () => {
  scene.resize();
  syncWord();
});

const start = performance.now();
function frame(time) {
  scene.render((time - start) / 1000);
  requestAnimationFrame(frame);
}

// Wait for the webfont before sampling: the raster is the geometry here, so
// falling back to a system face would quietly change the shape of every word.
const ready = document.fonts?.ready ?? Promise.resolve();
ready.then(() => {
  currentPanel = null;
  syncWord();
});

scene.resize();
syncWord();
requestAnimationFrame(frame);
