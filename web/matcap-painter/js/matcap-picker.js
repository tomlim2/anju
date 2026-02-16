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
    this._overlay.classList.add('open');
  }

  close() {
    if (this._overlay) this._overlay.classList.remove('open');
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

    // Header
    const header = document.createElement('div');
    header.className = 'matcap-picker-header';

    const title = document.createElement('span');
    title.className = 'matcap-picker-title';
    title.textContent = `Matcap Presets (${MATCAP_IDS.length})`;

    header.appendChild(title);

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

    // Escape to close
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this._overlay.classList.contains('open')) {
        this.close();
      }
    }, { signal: this._ac.signal });

    this._overlay = overlay;
    this._built = true;
  }
}
