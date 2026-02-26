import { MMDLoader } from '../vendor/MMDLoader.js';

export class UI {
  constructor({ mmdScene, loader, animation, audio }) {
    this.mmdScene = mmdScene;
    this.loader = loader;
    this.animation = animation;
    this.audio = audio;
    this._ac = new AbortController();

    this._initDropZone();
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

    // Open MMD buttons (drop-zone + controls bar)
    for (const id of ['btn-open-mmd', 'btn-open-mmd-small']) {
      document.getElementById(id).addEventListener('click', () => {
        inputMMD.click();
      }, { signal: this._ac.signal });
    }

    // Open VMD buttons
    for (const id of ['btn-open-vmd', 'btn-open-vmd-small']) {
      document.getElementById(id).addEventListener('click', () => {
        inputVMD.click();
      }, { signal: this._ac.signal });
    }

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

  _initDropZone() {
    const dropZone = document.getElementById('drop-zone');

    const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };

    document.body.addEventListener('dragover', (e) => {
      prevent(e);
      dropZone.classList.add('active');
    }, { signal: this._ac.signal });

    document.body.addEventListener('dragleave', (e) => {
      if (e.relatedTarget === null) dropZone.classList.remove('active');
    }, { signal: this._ac.signal });

    document.body.addEventListener('drop', (e) => {
      prevent(e);
      dropZone.classList.remove('active');
      this._handleDrop(e.dataTransfer);
    }, { signal: this._ac.signal });
  }

  async _handleDrop(dataTransfer) {
    const items = dataTransfer.items;
    const files = [];

    if (items && items.length > 0 && items[0].webkitGetAsEntry) {
      const entries = [];
      for (const item of items) {
        const entry = item.webkitGetAsEntry();
        if (entry) entries.push(entry);
      }
      await this._collectFiles(entries, files, '');
    } else {
      for (const f of dataTransfer.files) {
        files.push({ file: f, path: f.name });
      }
    }

    const pmxFiles = files.filter(f => /\.pmx$/i.test(f.path));
    const vmdFiles = files.filter(f => /\.vmd$/i.test(f.path));
    const audioFiles = files.filter(f => /\.(wav|mp3|ogg)$/i.test(f.path));
    const statusEl = document.getElementById('status');

    if (pmxFiles.length > 0) {
      const pmx = pmxFiles[0];
      statusEl.textContent = `Loading ${pmx.path}...`;
      try {
        const blobs = new Map();
        for (const { file, path } of files) {
          blobs.set(path, file);
          blobs.set(file.name, file);
        }

        const mesh = await this.loader.loadPMXFromBlobs(pmx.file, blobs);
        statusEl.textContent = `Loaded: ${pmx.path}`;
        document.getElementById('drop-zone').style.display = 'none';

        if (vmdFiles.length > 0) {
          statusEl.textContent = `Loading animation...`;
          await this._loadVMD(mesh, vmdFiles[0].file);
          statusEl.textContent = `Playing: ${pmx.path} + ${vmdFiles[0].path}`;
          document.getElementById('btn-play').style.display = '';
        }

        if (audioFiles.length > 0) {
          this.audio.loadFromFile(audioFiles[0].file);
        }
      } catch (err) {
        console.error('Load error:', err);
        statusEl.textContent = `Error: ${err.message}`;
      }
    } else if (vmdFiles.length > 0 && this.loader.mesh) {
      await this._handleVMDFile(vmdFiles[0].file);
    } else if (audioFiles.length > 0) {
      this.audio.loadFromFile(audioFiles[0].file);
      statusEl.textContent = `Audio: ${audioFiles[0].path}`;
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

  async _collectFiles(entries, files, basePath) {
    const promises = entries.map(entry => this._readEntry(entry, files, basePath));
    await Promise.all(promises);
  }

  _readEntry(entry, files, basePath) {
    return new Promise((resolve) => {
      if (entry.isFile) {
        entry.file((f) => {
          const path = basePath ? `${basePath}/${f.name}` : f.name;
          files.push({ file: f, path });
          resolve();
        });
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const dirPath = basePath ? `${basePath}/${entry.name}` : entry.name;
        const allEntries = [];

        const readBatch = () => {
          reader.readEntries(async (batch) => {
            if (batch.length === 0) {
              await this._collectFiles(allEntries, files, dirPath);
              resolve();
            } else {
              allEntries.push(...batch);
              readBatch();
            }
          });
        };
        readBatch();
      } else {
        resolve();
      }
    });
  }

  destroy() {
    this._ac.abort();
  }
}
