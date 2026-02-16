const SIZE = 1024;

export class TransformController {
  constructor(layerSystem) {
    this._layers = layerSystem;
    this._x = 0;
    this._y = 0;
    this._rotation = 0;
    this._scale = 100;
  }

  get x() { return this._x; }
  get y() { return this._y; }
  get rotation() { return this._rotation; }
  get scale() { return this._scale; }
  get hasTransform() {
    return this._x !== 0 || this._y !== 0 || this._rotation !== 0 || this._scale !== 100;
  }

  setX(v) { this._x = v; this._layers.composite(); }
  setY(v) { this._y = v; this._layers.composite(); }
  setRotation(v) { this._rotation = v; this._layers.composite(); }
  setScale(v) { this._scale = v; this._layers.composite(); }

  reset() { this._x = 0; this._y = 0; this._rotation = 0; this._scale = 100; }

  bake() {
    const layer = this._layers.getActiveLayer();
    if (!layer || !this.hasTransform) return;
    const temp = document.createElement('canvas');
    temp.width = SIZE; temp.height = SIZE;
    const ctx = temp.getContext('2d');
    const center = SIZE / 2;
    const scaleFactor = this._scale / 100;
    ctx.translate(this._x, this._y);
    ctx.translate(center, center);
    ctx.rotate(this._rotation * Math.PI / 180);
    ctx.scale(scaleFactor, scaleFactor);
    ctx.translate(-center, -center);
    ctx.drawImage(layer.canvas, 0, 0);
    layer.ctx.clearRect(0, 0, SIZE, SIZE);
    layer.ctx.drawImage(temp, 0, 0);
    this.reset();
    this._layers.composite();
  }

  applyToContext(ctx, layerIndex) {
    if (layerIndex !== this._layers.activeIndex || !this.hasTransform) return;
    const center = SIZE / 2;
    const scaleFactor = this._scale / 100;
    ctx.translate(this._x, this._y);
    ctx.translate(center, center);
    ctx.rotate(this._rotation * Math.PI / 180);
    ctx.scale(scaleFactor, scaleFactor);
    ctx.translate(-center, -center);
  }
}
