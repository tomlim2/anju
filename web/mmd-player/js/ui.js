import { MMDLoader } from '../vendor/MMDLoader.js';
import { hasHumanoidBones } from './pmx-check.js';
import { remapClipBones } from './bone-remap.js';

export class UI {
  constructor({ mmdScene, loader, animation, audio }) {
    this.mmdScene = mmdScene;
    this.loader = loader;
    this.animation = animation;
    this.audio = audio;
    this._ac = new AbortController();
    this._manifest = null;
    this._zipEntries = null;
    this._pmxPath = '';
    this._vmdPath = '';

    this._initZipUpload();
    this._initVMDDropdowns();
    this._initTransport();
  }

  // --- ZIP Upload + PMX Selection ---

  _initZipUpload() {
    const inputZip = document.getElementById('input-zip');
    const selectPmx = document.getElementById('select-pmx');
    const sig = { signal: this._ac.signal };

    document.getElementById('btn-upload-zip').addEventListener('click', () => {
      inputZip.click();
    }, sig);

    inputZip.addEventListener('change', async () => {
      if (inputZip.files.length > 0) {
        await this._handleZipFile(inputZip.files[0]);
        inputZip.value = '';
      }
    }, sig);

    selectPmx.addEventListener('change', async () => {
      if (!selectPmx.value || !this._zipEntries) return;
      await this._loadPmxFromZip(selectPmx.value);
    }, sig);
  }

  async _handleZipFile(file) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = 'Extracting ZIP...';

    try {
      const zip = await JSZip.loadAsync(file);
      const entries = new Map();
      const pmxPaths = [];

      for (const [path, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue;
        const blob = await entry.async('blob');
        entries.set(path, blob);
        if (/\.pmx$/i.test(path)) pmxPaths.push(path);
      }

      this._zipEntries = entries;

      const selectPmx = document.getElementById('select-pmx');
      selectPmx.innerHTML = '<option value="">PMX</option>';

      for (const pmxPath of pmxPaths) {
        const blob = entries.get(pmxPath);
        const buffer = await blob.arrayBuffer();
        if (hasHumanoidBones(buffer)) {
          const opt = document.createElement('option');
          opt.value = pmxPath;
          opt.textContent = pmxPath.split('/').pop();
          selectPmx.appendChild(opt);
        }
      }

      selectPmx.disabled = false;
      const count = selectPmx.options.length - 1;
      statusEl.textContent = `ZIP: ${count} humanoid PMX found`;
      document.getElementById('title').style.display = 'none';

      // Auto-load first humanoid PMX
      if (count > 0) {
        selectPmx.selectedIndex = 1;
        await this._loadPmxFromZip(selectPmx.value);
      }
    } catch (err) {
      console.error('ZIP error:', err);
      statusEl.textContent = `Error: ${err.message}`;
    }
  }

  async _loadPmxFromZip(pmxPath) {
    const statusEl = document.getElementById('status');
    const pmxName = pmxPath.split('/').pop();
    statusEl.textContent = `Loading ${pmxName}...`;

    // Clean up existing animation and audio before loading new model
    this.animation.destroy();
    this.audio.stop();
    this._setTransportEnabled(false);

    try {
      const pmxBlob = this._zipEntries.get(pmxPath);
      const pmxFile = new File([pmxBlob], pmxName);

      const blobs = new Map();
      for (const [path, blob] of this._zipEntries) {
        blobs.set(path, new File([blob], path.split('/').pop()));
      }

      await this.loader.loadPMXFromBlobs(pmxFile, blobs);
      this._pmxPath = pmxPath;
      this._updateDebugPaths();
      statusEl.textContent = `Loaded: ${pmxName}`;

      // Re-apply currently selected song if any
      const songSelect = document.getElementById('select-song');
      if (songSelect.value) {
        const { vmd, audio } = JSON.parse(songSelect.value);
        await this._loadVMDFromManifest(vmd, audio);
      }
    } catch (err) {
      console.error('PMX load error:', err);
      statusEl.textContent = `Error: ${err.message}`;
    }
  }

  // --- VMD Artist/Song Dropdowns ---

  async _initVMDDropdowns() {
    const artistSelect = document.getElementById('select-artist');
    const songSelect = document.getElementById('select-song');
    const sig = { signal: this._ac.signal };

    try {
      const res = await fetch('data/vmd-manifest.json');
      if (!res.ok) return;
      this._manifest = await res.json();
    } catch {
      return;
    }

    for (const artist of this._manifest.artists) {
      const opt = document.createElement('option');
      opt.value = artist.name;
      opt.textContent = artist.name;
      artistSelect.appendChild(opt);
    }

    artistSelect.addEventListener('change', () => {
      songSelect.innerHTML = '<option value="">Song</option>';
      const artist = this._manifest.artists.find(a => a.name === artistSelect.value);
      if (!artist) {
        songSelect.disabled = true;
        return;
      }
      for (const song of artist.songs) {
        const opt = document.createElement('option');
        opt.value = JSON.stringify({ vmd: song.vmd, audio: song.audio });
        opt.textContent = song.name;
        songSelect.appendChild(opt);
      }
      songSelect.disabled = false;
    }, sig);

    songSelect.addEventListener('change', async () => {
      if (!songSelect.value) return;
      const { vmd, audio } = JSON.parse(songSelect.value);
      await this._loadVMDFromManifest(vmd, audio);
    }, sig);
  }

  async _loadVMDFromManifest(vmdPath, audioPath) {
    if (!this.loader.mesh) {
      document.getElementById('status').textContent = 'Load a PMX model first';
      return;
    }

    const statusEl = document.getElementById('status');
    statusEl.textContent = 'Loading animation...';

    try {
      const vmdRes = await fetch('data/' + vmdPath);
      if (!vmdRes.ok) throw new Error(`Failed to fetch VMD: ${vmdRes.status}`);
      const vmdBlob = await vmdRes.blob();
      const vmdFile = new File([vmdBlob], vmdPath.split('/').pop());

      await this._loadVMD(this.loader.mesh, vmdFile);
      this._vmdPath = vmdPath;
      this._updateDebugPaths();

      const audioRes = await fetch('data/' + audioPath);
      if (!audioRes.ok) throw new Error(`Failed to fetch audio: ${audioRes.status}`);
      const audioBlob = await audioRes.blob();
      const audioFile = new File([audioBlob], audioPath.split('/').pop());
      this.audio.loadFromFile(audioFile);

      const songName = vmdPath.split('/').slice(-2, -1)[0] || vmdPath;
      statusEl.textContent = `Animation: ${songName}`;
      this._setTransportEnabled(true);
    } catch (err) {
      console.error('VMD manifest load error:', err);
      statusEl.textContent = `Error: ${err.message}`;
    }
  }

  async _loadVMD(mesh, vmdFile) {
    // Stop current playback and reset pose before loading new animation
    this.audio.stop();
    this.animation.destroy();

    const loader = new MMDLoader();
    const url = URL.createObjectURL(vmdFile);

    return new Promise((resolve, reject) => {
      loader.loadAnimation(url, mesh, (clip) => {
        URL.revokeObjectURL(url);

        // Remap missing bones and show debug info
        const result = remapClipBones(clip, mesh.skeleton);
        this._showBoneDebug(result);

        this.animation.initHelper(mesh, { vmd: clip, physics: false });
        this.animation.playing = false;
        resolve(clip);
      }, undefined, (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      });
    });
  }

  _showBoneDebug({ remapped, dropped, ignored }) {
    const el = document.getElementById('debug-info');
    const parts = [];
    if (remapped.length) {
      parts.push(`<span class="remap">Remapped: ${remapped.join(', ')}</span>`);
    }
    if (dropped.length) {
      parts.push(`<span class="drop">Missing: ${dropped.join(', ')}</span>`);
    }
    if (ignored.length) {
      parts.push(`Ignored: ${ignored.length} cosmetic bones`);
    }
    el.innerHTML = parts.length ? parts.join(' · ') : '';
  }

  // --- Debug Paths Panel ---

  _updateDebugPaths() {
    const el = document.getElementById('debug-paths');
    if (!this._pmxPath && !this._vmdPath) {
      el.style.display = 'none';
      return;
    }
    const lines = [];
    if (this._pmxPath) lines.push(`<span class="label">PMX:</span> <span class="path">${this._pmxPath}</span>`);
    if (this._vmdPath) lines.push(`<span class="label">VMD:</span> <span class="path">${this._vmdPath}</span>`);
    el.innerHTML = lines.join('<br>') + '<button id="btn-copy-paths">Copy</button>';
    el.style.display = 'block';

    document.getElementById('btn-copy-paths').addEventListener('click', () => {
      const text = [this._pmxPath && `PMX: ${this._pmxPath}`, this._vmdPath && `VMD: ${this._vmdPath}`].filter(Boolean).join('\n');
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('btn-copy-paths');
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1000);
      });
    });
  }

  // --- Transport Controls (Play / Pause / Stop) ---

  _initTransport() {
    const sig = { signal: this._ac.signal };

    document.getElementById('btn-play').addEventListener('click', () => {
      this.animation.playing = true;
      this.audio.play();
    }, sig);

    document.getElementById('btn-pause').addEventListener('click', () => {
      this.animation.playing = false;
      this.audio.pause();
    }, sig);

    document.getElementById('btn-stop').addEventListener('click', () => {
      this.animation.playing = false;
      this.audio.stop();
      // Reset animation mixer time
      if (this.animation.helper && this.animation.mesh) {
        const obj = this.animation.helper.objects.get(this.animation.mesh);
        if (obj && obj.mixer) obj.mixer.setTime(0);
      }
    }, sig);

    const volumeEl = document.getElementById('volume');
    this.audio.setVolume(parseFloat(volumeEl.value));
    volumeEl.addEventListener('input', () => {
      this.audio.setVolume(parseFloat(volumeEl.value));
    }, sig);
  }

  _setTransportEnabled(enabled) {
    document.getElementById('btn-play').disabled = !enabled;
    document.getElementById('btn-pause').disabled = !enabled;
    document.getElementById('btn-stop').disabled = !enabled;
  }

  destroy() {
    this._ac.abort();
  }
}
