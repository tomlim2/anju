/**
 * ColorChip — Reusable color picker component.
 * Combines a visual swatch (with hidden native color input) and a hex text input.
 *
 * Callbacks:
 *   onStart()      — first input event in a drag session (use for undo snapshots)
 *   onChange(hex)   — every color change (during drag or hex commit)
 *   onCommit()      — change finalized (picker closed or hex input confirmed)
 */
export class ColorChip {
  constructor(color = '#000000', opts = {}) {
    this._color = color;
    this.onStart = null;
    this.onChange = null;
    this.onCommit = null;
    this._build(opts);
  }

  get el() { return this._wrap; }

  get value() { return this._color; }
  set value(hex) {
    this._color = hex;
    this._input.value = hex;
    this._swatch.style.background = hex;
    this._hex.value = hex.slice(1).toUpperCase();
  }

  _build(opts) {
    this._wrap = document.createElement('div');
    this._wrap.className = 'color-chip-wrap';

    // Swatch with hidden native color input
    this._swatch = document.createElement('div');
    this._swatch.className = 'gradient-swatch';
    this._swatch.style.background = this._color;

    this._input = document.createElement('input');
    this._input.type = 'color';
    this._input.value = this._color;
    if (opts.ariaLabel) this._input.setAttribute('aria-label', opts.ariaLabel);

    let dirty = false;
    this._input.addEventListener('input', (e) => {
      e.stopPropagation();
      if (!dirty) { dirty = true; if (this.onStart) this.onStart(); }
      this._color = this._input.value;
      this._swatch.style.background = this._color;
      this._hex.value = this._color.slice(1).toUpperCase();
      if (this.onChange) this.onChange(this._color);
    });
    this._input.addEventListener('change', (e) => {
      e.stopPropagation();
      dirty = false;
      if (this.onCommit) this.onCommit();
    });
    this._input.addEventListener('click', (e) => e.stopPropagation());
    this._swatch.appendChild(this._input);

    // Hex text input
    this._hex = document.createElement('input');
    this._hex.type = 'text';
    this._hex.className = 'gradient-hex';
    this._hex.value = this._color.slice(1).toUpperCase();
    this._hex.maxLength = 6;
    this._hex.addEventListener('change', () => {
      const val = this._hex.value.replace('#', '').trim();
      if (/^[0-9a-fA-F]{6}$/.test(val)) {
        this._color = '#' + val.toLowerCase();
        this._input.value = this._color;
        this._swatch.style.background = this._color;
        this._hex.value = val.toUpperCase();
        if (this.onStart) this.onStart();
        if (this.onChange) this.onChange(this._color);
        if (this.onCommit) this.onCommit();
      } else {
        this._hex.value = this._color.slice(1).toUpperCase();
      }
    });
    this._hex.addEventListener('click', (e) => e.stopPropagation());

    this._wrap.appendChild(this._swatch);
    this._wrap.appendChild(this._hex);
  }
}
