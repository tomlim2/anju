import { MATCAP_IDS, THUMB_PATH, FULL_PATH } from './matcaps.js';

export class MatcapPicker {
  constructor(onSelect) {
    this._onSelect = onSelect; // (matcapId, layerIndex) => void
    this._layerIndex = 0;
    this._overlay = null;
    this._built = false;
    this._ac = new AbortController();
  }

  open(layerIndex) {
    this._layerIndex = layerIndex;
    if (!this._built) this._build();
    this._triggerElement = document.activeElement;
    this._overlay.classList.add('open');
    // Focus the close button so keyboard users land inside the modal
    const closeBtn = this._overlay.querySelector('.matcap-picker-close');
    if (closeBtn) closeBtn.focus();
  }

  close() {
    if (this._overlay) this._overlay.classList.remove('open');
    if (this._triggerElement && this._triggerElement.focus) {
      this._triggerElement.focus();
      this._triggerElement = null;
    }
  }

  destroy() {
    this._ac.abort();
    if (this._overlay) {
      this._overlay.remove();
      this._overlay = null;
    }
    this._built = false;
  }

  _build() {
    // Overlay
    const overlay = document.createElement('div');
    overlay.className = 'matcap-picker-overlay';
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) this.close();
    });

    // Modal
    const modal = document.createElement('div');
    modal.className = 'matcap-picker';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Matcap Presets');

    // Header
    const header = document.createElement('div');
    header.className = 'matcap-picker-header';

    const title = document.createElement('span');
    title.className = 'matcap-picker-title';
    title.textContent = `Matcap Presets (${MATCAP_IDS.length})`;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'matcap-picker-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.style.cssText = 'background:none;border:none;color:inherit;cursor:pointer;font-size:18px;padding:4px 8px;border-radius:4px;';
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', () => this.close());

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Grid
    const grid = document.createElement('div');
    grid.className = 'matcap-picker-grid';

    for (let matcapIndex = 0; matcapIndex < MATCAP_IDS.length; matcapIndex++) {
      const id = MATCAP_IDS[matcapIndex];
      const thumbButton = document.createElement('button');
      thumbButton.className = 'matcap-thumb';
      thumbButton.title = `#${matcapIndex + 1} ${id}`;

      const img = document.createElement('img');
      img.src = THUMB_PATH + id + '.jpg';
      img.alt = id;
      img.loading = 'lazy';
      thumbButton.appendChild(img);

      const indexLabel = document.createElement('span');
      indexLabel.className = 'matcap-num';
      indexLabel.textContent = matcapIndex + 1;
      thumbButton.appendChild(indexLabel);

      thumbButton.addEventListener('click', () => {
        this._onSelect(id, this._layerIndex);
        this.close();
      });

      grid.appendChild(thumbButton);
    }

    modal.appendChild(header);
    modal.appendChild(grid);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Escape to close + focus trap
    document.addEventListener('keydown', (event) => {
      if (!this._overlay.classList.contains('open')) return;
      if (event.key === 'Escape') {
        this.close();
        return;
      }
      if (event.key === 'Tab') {
        const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }, { signal: this._ac.signal });

    this._overlay = overlay;
    this._built = true;
  }
}
