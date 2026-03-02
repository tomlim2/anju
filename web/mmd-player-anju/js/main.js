import { MMDScene } from './scene.js';
import { MMDModelLoader } from './loader.js';
import { MMDAnimation } from './animation.js';
import { MMDAudio } from './audio.js';
import { UI } from './ui.js';
import { BoneVelocityTracker } from './bone-velocity.js';
import { BoneDecelerationTracker } from './bone-decel.js';
import { SparkBurstEffect } from './effects/spark-burst.js';
import { BloomBurstEffect } from './effects/bloom-burst.js';
import { RisingLightEffect } from './effects/rising-light.js';
import { FallingLightEffect } from './effects/falling-light.js';

const canvas = document.getElementById('canvas');
const mmdScene = new MMDScene(canvas);
await mmdScene.init();

const loader = new MMDModelLoader(mmdScene);
const animation = new MMDAnimation(mmdScene);
const audio = new MMDAudio(animation);

// Hand FX: Spark
const tracker = new BoneVelocityTracker({
  boneNames: ['左手首', '右手首'],
  threshold: 15.0,
});
tracker.enabled = false;
const sparkFx = new SparkBurstEffect(mmdScene.scene, mmdScene.renderer);
sparkFx.enabled = false;
tracker.onTrigger((name, pos, vel, speed) => sparkFx.trigger(name, pos, vel, speed));

// Hand FX: Bloom
const decelTracker = new BoneDecelerationTracker({
  boneNames: ['左手首', '右手首'],
  highThreshold: 20,
  lowThreshold: 3,
});
const bloomFx = new BloomBurstEffect(mmdScene.scene);
decelTracker.onTrigger((name, pos, dir, speed) => bloomFx.trigger(name, pos, dir, speed));

// BG FX
const riseFx = new RisingLightEffect(mmdScene.scene);
riseFx.enabled = false;
const fallFx = new FallingLightEffect(mmdScene.scene);
fallFx.enabled = false;

const ui = new UI({
  mmdScene, loader, animation, audio,
  tracker, sparkFx, decelTracker, bloomFx,
  riseFx, fallFx,
});

function animate() {
  requestAnimationFrame(animate);
  const delta = mmdScene.clock.getDelta();
  animation.update(delta);
  tracker.update(delta);
  decelTracker.update(delta);
  sparkFx.update(delta);
  bloomFx.update(delta);
  riseFx.update(delta);
  fallFx.update(delta);
  mmdScene.render();
}
animate();
