import {
  Scene,
  PerspectiveCamera,
  WebGPURenderer,
  Color,
  AmbientLight,
  DirectionalLight,
  Clock,
} from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class MMDScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = null;
    this.scene = new Scene();
    this.camera = null;
    this.controls = null;
    this.clock = new Clock();
    this._ac = new AbortController();
  }

  async init() {
    this.renderer = new WebGPURenderer({
      canvas: this.canvas,
      antialias: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.scene.background = new Color(0x1a1a1a);

    await this.renderer.init();

    // Camera
    this.camera = new PerspectiveCamera(45, 1, 0.1, 200);
    this.camera.position.set(0, 10, 25);

    // Controls
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 10, 0);
    this.controls.update();

    // Lights
    const ambient = new AmbientLight(0xffffff, 0.7);
    this.scene.add(ambient);

    const directional = new DirectionalLight(0xffffff, 1.0);
    directional.position.set(5, 15, 10);
    this.scene.add(directional);

    this._resize();
    window.addEventListener('resize', () => this._resize(), { signal: this._ac.signal });
  }

  _resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this._ac.abort();
    if (this.renderer) this.renderer.dispose();
  }
}
