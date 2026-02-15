import { Brush } from './brush.js';
import { LayerSystem } from './layers.js';
import { Painter } from './painter.js';
import { Preview } from './preview.js';
import { UI } from './ui.js';
import { getGeometry } from './models.js';

const paintCanvas = document.getElementById('paint-canvas');
const previewCanvas = document.getElementById('preview-canvas');
const modelSelect = document.getElementById('model-select');
const btnExport = document.getElementById('btn-export');

// Initialize modules
const brush = new Brush();
const layers = new LayerSystem(paintCanvas);
const painter = new Painter(paintCanvas, brush, layers);
const preview = new Preview(previewCanvas);

// When layers composite, mark texture dirty
layers.onChange = () => preview.markTextureDirty();

// Fill default matcap: soft gray gradient
const defaultCtx = layers.getActiveCtx();
if (defaultCtx) {
  const grad = defaultCtx.createRadialGradient(256, 200, 20, 256, 300, 350);
  grad.addColorStop(0, '#e8e8e8');
  grad.addColorStop(0.5, '#a0a0a0');
  grad.addColorStop(1, '#303030');
  defaultCtx.fillStyle = grad;
  defaultCtx.fillRect(0, 0, 512, 512);
  layers.composite();
}

async function init() {
  await preview.init(paintCanvas);

  // Load default model
  const geo = await getGeometry('agus');
  preview.setGeometry(geo);

  // UI
  new UI(brush, painter, layers, preview);

  // Model selector
  modelSelect.addEventListener('change', async (e) => {
    const geo = await getGeometry(e.target.value);
    preview.setGeometry(geo);
  });

  // Export
  btnExport.addEventListener('click', () => {
    const dataURL = painter.exportPNG();
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = 'matcap.png';
    a.click();
  });


  // Render loop
  function animate() {
    requestAnimationFrame(animate);
    preview.render();
  }
  animate();
}

init().catch(console.error);
