import { MMDScene } from './scene.js';
import { MMDModelLoader } from './loader.js';
import { MMDAnimation } from './animation.js';
import { MMDAudio } from './audio.js';
import { UI } from './ui.js';

const canvas = document.getElementById('canvas');
const mmdScene = new MMDScene(canvas);
await mmdScene.init();

const loader = new MMDModelLoader(mmdScene);
const animation = new MMDAnimation(mmdScene);
const audio = new MMDAudio(animation);
const ui = new UI({ mmdScene, loader, animation, audio });

function animate() {
  requestAnimationFrame(animate);
  const delta = mmdScene.clock.getDelta();
  animation.update(delta);
  mmdScene.render();
}
animate();
