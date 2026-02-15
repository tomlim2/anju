import {
  Scene,
  PerspectiveCamera,
  Mesh,
  CanvasTexture,
  MeshMatcapMaterial,
  WebGPURenderer,
  SRGBColorSpace,
  Color,
  DoubleSide,
} from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Preview {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = null;
    this.scene = new Scene();
    this.camera = null;
    this.controls = null;
    this.mesh = null;
    this.matcapTexture = null;
    this.material = null;
    this._textureDirty = false;
    this._animId = null;
  }

  async init(matcapCanvas) {
    // Renderer
    this.renderer = new WebGPURenderer({
      canvas: this.canvas,
      antialias: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.scene.background = new Color(0x111111);

    await this.renderer.init();

    // Camera
    this.camera = new PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(0, 0, 5);

    // Controls
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 2.0;

    // Matcap texture from 2D canvas
    this.matcapTexture = new CanvasTexture(matcapCanvas);
    this.matcapTexture.colorSpace = SRGBColorSpace;

    // Matcap material
    this.material = new MeshMatcapMaterial({ matcap: this.matcapTexture, flatShading: false, side: DoubleSide });

    // Resize
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const parent = this.canvas.parentElement;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setGeometry(geometry) {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
    }
    this.mesh = new Mesh(geometry, this.material);
    this.scene.add(this.mesh);
  }

  markTextureDirty() {
    this._textureDirty = true;
  }

  toggleAutoRotate() {
    this.controls.autoRotate = !this.controls.autoRotate;
    return this.controls.autoRotate;
  }

  resetView() {
    this.controls.reset();
  }

  render() {
    if (this._textureDirty) {
      this.matcapTexture.needsUpdate = true;
      this._textureDirty = false;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
