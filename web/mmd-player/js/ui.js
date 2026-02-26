import { MMDLoader } from '../vendor/MMDLoader.js';

export class UI {
  constructor({ mmdScene, loader, animation, audio }) {
    this.mmdScene = mmdScene;
    this.loader = loader;
    this.animation = animation;
    this.audio = audio;
    this._ac = new AbortController();

    this._initControls();
    this._initFileInputs();
  }

  _initControls() {
    const btnPlay = document.getElementById('btn-play');
    btnPlay.addEventListener('click', () => {
      const playing = this.animation.togglePlay();
      btnPlay.textContent = playing ? 'Pause' : 'Play';
      if (playing) this.audio.play();
      else this.audio.pause();
    }, { signal: this._ac.signal });
  }

  _initFileInputs() {
    const inputMMD = document.getElementById('input-mmd');
    const inputVMD = document.getElementById('input-vmd');

    document.getElementById('btn-open-mmd-small').addEventListener('click', () => {
      inputMMD.click();
    }, { signal: this._ac.signal });

    document.getElementById('btn-open-vmd-small').addEventListener('click', () => {
      inputVMD.click();
    }, { signal: this._ac.signal });

    // File input handlers
    inputMMD.addEventListener('change', () => {
      if (inputMMD.files.length > 0) {
        this._handleMMDFiles(Array.from(inputMMD.files));
        inputMMD.value = '';
      }
    }, { signal: this._ac.signal });

    inputVMD.addEventListener('change', () => {
      if (inputVMD.files.length > 0) {
        this._handleVMDFile(inputVMD.files[0]);
        inputVMD.value = '';
      }
    }, { signal: this._ac.signal });
  }

  async _handleMMDFiles(files) {
    const pmxFile = files.find(f => /\.pmx$/i.test(f.name));
    if (!pmxFile) return;

    const statusEl = document.getElementById('status');
    statusEl.textContent = `Loading ${pmxFile.name}...`;

    try {
      const blobs = new Map();
      for (const f of files) {
        // webkitRelativePath: "FolderName/subfolder/file.png"
        const relPath = f.webkitRelativePath || f.name;
        blobs.set(relPath, f);
        blobs.set(f.name, f);
      }

      const mesh = await this.loader.loadPMXFromBlobs(pmxFile, blobs);
      statusEl.textContent = `Loaded: ${pmxFile.name}`;
      document.getElementById('drop-zone').style.display = 'none';
    } catch (err) {
      console.error('Load error:', err);
      statusEl.textContent = `Error: ${err.message}`;
    }
  }

  async _handleVMDFile(file) {
    if (!this.loader.mesh) {
      document.getElementById('status').textContent = 'Load a PMX model first';
      return;
    }

    const statusEl = document.getElementById('status');
    statusEl.textContent = `Loading animation...`;

    try {
      await this._loadVMD(this.loader.mesh, file);
      statusEl.textContent = `Animation: ${file.name}`;
      document.getElementById('btn-play').style.display = '';
    } catch (err) {
      console.error('VMD error:', err);
      statusEl.textContent = `Error: ${err.message}`;
    }
  }

  async _loadVMD(mesh, vmdFile) {
    const loader = new MMDLoader();
    const url = URL.createObjectURL(vmdFile);

    return new Promise((resolve, reject) => {
      loader.loadAnimation(url, mesh, (clip) => {
        URL.revokeObjectURL(url);
        this.animation.destroy();
        this.animation.initHelper(mesh, { vmd: clip, physics: false });
        resolve(clip);
      }, undefined, (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      });
    });
  }

  destroy() {
    this._ac.abort();
  }
}
