import { MATCAP_IDS, THUMB_PATH, FULL_PATH } from './matcaps.js';

export class MatcapPicker {
  constructor(onSelect) {
    this._onSelect = onSelect; // (matcapId, layerIndex) => void
    this._layerIndex = 0;
    this._overlay = null;
    this._built = false;
  }

  open(layerIndex) {
    this._layerIndex = layerIndex;
    if (!this._built) this._build();
    this._overlay.classList.add('open');
    this._searchInput.value = '';
    this._filter('');
    this._searchInput.focus();
  }

  close() {
    if (this._overlay) this._overlay.classList.remove('open');
  }

  _build() {
    // Overlay
    const overlay = document.createElement('div');
    overlay.className = 'matcap-picker-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
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

    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'matcap-picker-search';
    search.placeholder = 'Filter...';
    search.addEventListener('input', () => this._filter(search.value));
    this._searchInput = search;

    header.appendChild(title);
    header.appendChild(search);

    // Grid
    const grid = document.createElement('div');
    grid.className = 'matcap-picker-grid';

    this._thumbs = [];
    for (let i = 0; i < MATCAP_IDS.length; i++) {
      const id = MATCAP_IDS[i];
      const btn = document.createElement('button');
      btn.className = 'matcap-thumb';
      btn.dataset.id = id;
      btn.title = `#${i + 1} ${id}`;

      const img = document.createElement('img');
      img.src = THUMB_PATH + id + '.jpg';
      img.alt = id;
      img.loading = 'lazy';
      btn.appendChild(img);

      const num = document.createElement('span');
      num.className = 'matcap-num';
      num.textContent = i + 1;
      btn.appendChild(num);

      btn.addEventListener('click', () => {
        this._onSelect(id, this._layerIndex);
        this.close();
      });

      grid.appendChild(btn);
      this._thumbs.push(btn);
    }

    modal.appendChild(header);
    modal.appendChild(grid);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Escape to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._overlay.classList.contains('open')) {
        this.close();
      }
    });

    this._overlay = overlay;
    this._built = true;
  }

  _filter(query) {
    const q = query.toLowerCase().trim();
    for (const btn of this._thumbs) {
      btn.style.display = !q || btn.dataset.id.toLowerCase().includes(q) ? '' : 'none';
    }
  }
}
