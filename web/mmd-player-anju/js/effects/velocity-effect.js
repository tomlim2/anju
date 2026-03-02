export class VelocityEffect {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.enabled = true;
  }

  trigger(boneName, position, velocity, speed) {}

  update(delta) {}

  dispose() {}
}
