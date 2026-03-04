import { Mesh, PlaneGeometry, MeshBasicNodeMaterial } from 'three/webgpu';
import { reflector, color } from 'three/tsl';

export class GroundReflectEffect {
  constructor(scene) {
    this.scene = scene;

    const geo = new PlaneGeometry(200, 200);

    const reflect = reflector();
    const mat = new MeshBasicNodeMaterial();
    mat.colorNode = reflect;

    this._mesh = new Mesh(geo, mat);
    this._mesh.rotateX(-Math.PI / 2);
    this._mesh.add(reflect.target);

    this.scene.add(this._mesh);
  }

  get enabled() { return this._mesh.visible; }
  set enabled(v) { this._mesh.visible = v; }

  dispose() {
    this.scene.remove(this._mesh);
    this._mesh.geometry.dispose();
    this._mesh.material.dispose();
  }
}
