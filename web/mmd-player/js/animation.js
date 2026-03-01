import { MMDAnimationHelper } from '../vendor/MMDAnimationHelper.js';

export class MMDAnimation {
  constructor(mmdScene) {
    this.mmdScene = mmdScene;
    this.helper = null;
    this.mesh = null;
    this.duration = 0;
    this.playing = false;
  }

  initHelper(mesh, opts = {}) {
    this.mesh = mesh;

    this.helper = new MMDAnimationHelper({
      afterglow: 2.0,
      pmxAnimation: true,
    });

    const params = {
      physics: opts.physics ?? false,
      animation: opts.vmd ?? undefined,
    };

    this.helper.add(mesh, params);

    if (opts.vmd) {
      this.duration = this._getVMDDuration(mesh);
    }

    this.playing = true;
  }

  _getVMDDuration(mesh) {
    if (!mesh.animations || mesh.animations.length === 0) return 0;
    return mesh.animations.reduce((max, clip) => Math.max(max, clip.duration), 0);
  }

  update(delta) {
    if (this.helper && this.playing) {
      this.helper.update(delta);
    }
  }

  togglePlay() {
    this.playing = !this.playing;
    return this.playing;
  }

  destroy() {
    if (this.helper && this.mesh) {
      this.helper.remove(this.mesh);
      // Reset skeleton to rest pose so the next animation starts clean
      if (this.mesh.skeleton) this.mesh.skeleton.pose();
      this.mesh.position.set(0, 0, 0);
      this.mesh.rotation.set(0, 0, 0);
    }
    this.helper = null;
    this.mesh = null;
    this.duration = 0;
    this.playing = false;
  }
}
