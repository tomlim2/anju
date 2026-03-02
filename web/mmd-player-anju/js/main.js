import { MMDScene } from './scene.js';
import { MMDModelLoader } from './loader.js';
import { MMDAnimation } from './animation.js';
import { MMDAudio } from './audio.js';
import { UI } from './ui.js';
import { BloomBurstEffect } from './effects/bloom-burst.js';
import { RisingLightEffect } from './effects/rising-light.js';
import { FallingLightEffect } from './effects/falling-light.js';

const canvas = document.getElementById('canvas');
const mmdScene = new MMDScene(canvas);
await mmdScene.init();

const loader = new MMDModelLoader(mmdScene);
const animation = new MMDAnimation(mmdScene);
const audio = new MMDAudio(animation);

// Hand FX: Bloom (precomputed — events set by UI on VMD load)
const bloomFx = new BloomBurstEffect(mmdScene.scene);

// BG FX
const riseFx = new RisingLightEffect(mmdScene.scene);
const fallFx = new FallingLightEffect(mmdScene.scene);
fallFx.enabled = false;

const ui = new UI({
  mmdScene, loader, animation, audio,
  bloomFx,
  riseFx, fallFx,
});

function animate() {
  requestAnimationFrame(animate);
  const delta = mmdScene.clock.getDelta();
  animation.update(delta);
  const animTime = animation.getCurrentTime();
  bloomFx.update(delta, animTime);
  riseFx.update(delta, animTime);
  fallFx.update(delta);
  mmdScene.render();
}
animate();
