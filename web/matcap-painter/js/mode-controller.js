const SIZE = 1024;

export class ModeController {
  constructor(canvas) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._mode = 'shader';
    this._sections = { paint: [], shader: [] };
    this._snapshots = {};
    this._onModeChange = null;
  }

  set onModeChange(fn) { this._onModeChange = fn; }

  get mode() { return this._mode; }

  registerSection(mode, elements) {
    this._sections[mode] = elements;
  }

  setMode(mode) {
    if (mode === this._mode) return;

    // Save current canvas snapshot
    this._snapshots[this._mode] = this._ctx.getImageData(0, 0, SIZE, SIZE);

    const prev = this._mode;
    this._mode = mode;

    // Show/hide sections
    for (const [m, elements] of Object.entries(this._sections)) {
      const visible = m === mode;
      for (const el of elements) {
        if (el) el.style.display = visible ? '' : 'none';
      }
    }

    // Restore snapshot if exists
    if (this._snapshots[mode]) {
      this._ctx.putImageData(this._snapshots[mode], 0, 0);
    }

    if (this._onModeChange) this._onModeChange(mode, prev);
  }
}
