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
  Clock,
  AnimationMixer,
  Box3,
  Vector3,
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
    this._ac = new AbortController();
    this._clock = new Clock();
    this._mixer = null;
  }

  destroy() {
    this._ac.abort();
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
    if (this.matcapTexture) this.matcapTexture.dispose();
    if (this.renderer) this.renderer.dispose();
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
    window.addEventListener('resize', () => this._resize(), { signal: this._ac.signal });
  }

  _resize() {
    const parent = this.canvas.parentElement;
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  setGeometry(geometry) {
    this._clearModel();
    this.mesh = new Mesh(geometry, this.material);
    this.scene.add(this.mesh);
  }

  setModel(model) {
    this._clearModel();

    if (model.scene && model.animations.length > 0) {
      // Animated model — add full scene, apply matcap material to all meshes
      this._modelRoot = model.scene;
      model.scene.traverse((child) => {
        if (child.isMesh) child.material = this.material;
      });
      this._centerObject(model.scene);
      this.scene.add(model.scene);

      this._mixer = new AnimationMixer(model.scene);
      const runClip = model.animations.find(c => c.name === 'run') || model.animations[0];
      if (runClip) this._mixer.clipAction(runClip).play();
    } else if (model.geometry) {
      this.mesh = new Mesh(model.geometry, this.material);
      this._centerObject(this.mesh);
      this.scene.add(this.mesh);
    }
  }

  _centerObject(obj) {
    const box = new Box3().setFromObject(obj);
    const center = box.getCenter(new Vector3());
    obj.position.sub(center);
  }

  _clearModel() {
    if (this._mixer) {
      this._mixer.stopAllAction();
      this._mixer = null;
    }
    if (this._modelRoot) {
      this.scene.remove(this._modelRoot);
      this._modelRoot = null;
    }
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
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
    const delta = this._clock.getDelta();
    if (this._mixer) this._mixer.update(delta);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
