import { MMDScene } from './scene.js';
import { MMDModelLoader } from './loader.js';
import { MMDAnimation } from './animation.js';
import { MMDAudio } from './audio.js';
import { UI } from './ui.js';
import { RisingLightEffect } from './effects/rising-light.js';
import { FallingLightEffect } from './effects/falling-light.js';

const canvas = document.getElementById('canvas');
const mmdScene = new MMDScene(canvas);
await mmdScene.init();

const loader = new MMDModelLoader(mmdScene);
const animation = new MMDAnimation(mmdScene);
const audio = new MMDAudio(animation);

// BG FX
const riseFx = new RisingLightEffect(mmdScene.scene, mmdScene.camera);
const fallFx = new FallingLightEffect(mmdScene.scene);
fallFx.enabled = false;

const ui = new UI({
  mmdScene, loader, animation, audio,
  riseFx, fallFx,
});

function animate() {
  requestAnimationFrame(animate);
  const delta = mmdScene.clock.getDelta();
  animation.update(delta);
  const animTime = animation.getCurrentTime();
  riseFx.update(delta, animTime);
  fallFx.update(delta);
  mmdScene.render();
}
animate();
