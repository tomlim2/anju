import { MMDScene } from './scene.js';
import { MMDModelLoader } from './loader.js';
import { MMDAnimation } from './animation.js';
import { MMDAudio } from './audio.js';
import { UI } from './ui.js';
import { RisingLightEffect } from './effects/rising-light.js';
import { FallingLightEffect } from './effects/falling-light.js';
import { FootRippleEffect } from './effects/foot-ripple.js';
import { GroundReflectEffect } from './effects/ground-reflect.js';

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
const rippleFx = new FootRippleEffect(mmdScene.scene);
const mirrorFx = new GroundReflectEffect(mmdScene.scene);

const ui = new UI({
  mmdScene, loader, animation, audio,
  riseFx, fallFx, rippleFx, mirrorFx,
});

let _lastAudioTime = 0;

function animate() {
  requestAnimationFrame(animate);
  const wallDelta = mmdScene.clock.getDelta();

  if (audio.audioElement) {
    const audioTime = audio.currentTime;
    const audioDelta = audioTime - _lastAudioTime;
    if (audioDelta !== 0) {
      if (Math.abs(audioDelta) > 0.1) {
        animation.seekTo(audioTime);
        riseFx.seekTo(audioTime);
        rippleFx.seekTo(audioTime);
      } else {
        animation.update(audioDelta);
      }
      _lastAudioTime = audioTime;
    }
  } else {
    animation.update(wallDelta);
  }

  const animTime = animation.getCurrentTime();
  riseFx.update(wallDelta, animTime);
  fallFx.update(wallDelta);
  rippleFx.update(wallDelta, animTime);
  mmdScene.render();
}
animate();
