import { Brush } from './brush.js';
import { LayerSystem } from './layers.js';
import { TransformController } from './transform.js';
import { Painter } from './painter.js';
import { Preview } from './preview.js';
import { UI } from './ui.js';
import { getModel } from './models.js';
import { MATCAP_IDS, FULL_PATH } from './matcaps.js';
import { ModeController } from './mode-controller.js';
import { ToonGenerator } from './toon-generator.js';

const paintCanvas = document.getElementById('paint-canvas');
const previewCanvas = document.getElementById('preview-canvas');
const modelSelect = document.getElementById('model-select');
const btnExport = document.getElementById('btn-export');

// Initialize modules
const brush = new Brush();
const layers = new LayerSystem(paintCanvas);
const transform = new TransformController(layers);
layers.transform = transform;
const painter = new Painter(paintCanvas, brush, layers);
painter.enabled = false; // Shader mode is default
const preview = new Preview(previewCanvas);
const modeController = new ModeController(layers.outputCanvas);
const toonGenerator = new ToonGenerator(layers.outputCanvas);

// When layers composite, mark texture dirty
layers.onChange = () => preview.markTextureDirty();

// Toon generator updates preview
toonGenerator.onChange = () => preview.markTextureDirty();

// Mode change callbacks
modeController.onModeChange = (mode) => {
  painter.enabled = (mode === 'paint');

  if (mode === 'paint') {
    layers.composite();
  } else if (mode === 'shader') {
    toonGenerator.render();
  }

  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  });

  preview.markTextureDirty();
};

async function init() {
  await preview.init(paintCanvas);

  // Load default model
  const model = await getModel('amongus');
  preview.setModel(model);

  // Register mode sections
  modeController.registerSection('paint', [
    document.getElementById('mode-paint-controls'),
    document.getElementById('mode-paint-layers'),
  ]);
  modeController.registerSection('shader', [
    document.getElementById('mode-shader-controls'),
  ]);

  // UI (must exist before matcap load so thumbnails update)
  const ui = new UI(brush, painter, layers, preview, transform, modeController, toonGenerator);

  // Tab click events
  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      modeController.setMode(tab.dataset.mode);
    });
  });

  // Initial toon render (shader is default mode)
  toonGenerator.render();

  // Load random matcap preset
  const randomId = MATCAP_IDS[Math.floor(Math.random() * MATCAP_IDS.length)];
  await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ctx = layers.getActiveCtx();
      if (ctx) {
        ctx.drawImage(img, 0, 0, 1024, 1024);
        layers.composite();
        preview.markTextureDirty();
      }
      resolve();
    };
    img.onerror = () => { console.warn('Failed to load matcap:', randomId); resolve(); };
    img.src = FULL_PATH + randomId + '.png';
  });

  // Model selector
  modelSelect.addEventListener('change', async (event) => {
    const model = await getModel(event.target.value);
    preview.setModel(model);
    ui._refreshAnimSelect();
  });

  // Export
  btnExport.addEventListener('click', () => {
    const dataURL = painter.exportPNG();
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = 'matcap.png';
    link.click();
  });


  // Render loop
  function animate() {
    requestAnimationFrame(animate);
    preview.render();
  }
  animate();
}

init().catch(console.error);
