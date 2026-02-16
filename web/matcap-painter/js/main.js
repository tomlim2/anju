import { Brush } from './brush.js';
import { LayerSystem } from './layers.js';
import { TransformController } from './transform.js';
import { Painter } from './painter.js';
import { Preview } from './preview.js';
import { UI } from './ui.js';
import { getModel } from './models.js';
import { MATCAP_IDS, FULL_PATH } from './matcaps.js';

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
const preview = new Preview(previewCanvas);

// When layers composite, mark texture dirty
layers.onChange = () => preview.markTextureDirty();

async function init() {
  await preview.init(paintCanvas);

  // Load default model
  const model = await getModel('amongus');
  preview.setModel(model);

  // UI (must exist before matcap load so thumbnails update)
  const ui = new UI(brush, painter, layers, preview, transform);

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
