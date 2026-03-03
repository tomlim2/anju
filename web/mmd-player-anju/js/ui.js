import { MMDLoader } from '../vendor/MMDLoader.js';
import { hasHumanoidBones } from './pmx-check.js';
import { remapClipBones } from './bone-remap.js';
import { validateClip } from './vmd-validator.js';
import { retargetClip } from './bone-retarget.js';
import { extractVmdMeta } from './vmd-meta.js';
import { precomputeSparkEvents } from './effects/spark-precompute.js';

export class UI {
  constructor({ mmdScene, loader, animation, audio, riseFx, fallFx }) {
    this.mmdScene = mmdScene;
    this.loader = loader;
    this.animation = animation;
    this.audio = audio;
    this.riseFx = riseFx;
    this.fallFx = fallFx;
    this._ac = new AbortController();
    this._manifest = null;
    this._zipEntries = null;
    this._zipName = '';
    this._pmxPath = '';
    this._vmdPath = '';
    this._currentVmd = null;   // {vmdPath, audioPath} of currently playing song
    this._pendingVmd = null;   // VMD blob fetched before mesh is available

    this._initZipUpload();
    this._initVMDDropdowns();
    this._initPlayback();
    this._initTimeline();
    this._initFxSelectors();
    this._loadDefaultModel();

    this.audio.onEnded(() => this._playRandomSong());
  }

  async _loadDefaultModel() {
    const path = 'data/model/Hatsune Miku.pmx';
    const statusEl = document.getElementById('loading-status');
    statusEl.textContent = 'Loading...';

    try {
      await this.loader.loadPMXFromPath(path);
      this._pmxPath = path;
      document.getElementById('title').style.display = 'none';

      // Apply pending VMD if autoplay already fetched one
      if (this._pendingVmd) {
        await this._applyVmdToMesh(this._pendingVmd.vmdBlob);
        this._currentVmd = this._pendingVmd;
        this._pendingVmd = null;

        if (this.animation.helper && this.animation.mesh) {
          const obj = this.animation.helper.objects.get(this.animation.mesh);
          if (obj && obj.mixer) {
            const t = this.audio.currentTime;
            obj.mixer.setTime(t);
            this.riseFx.seekTo(t);
          }
        }
        this.animation.playing = true;
      }

      statusEl.textContent = '';
    } catch (err) {
      console.error('Default model load error:', err);
      statusEl.textContent = '';
    }
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
      this._zipName = file.name;

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
      document.getElementById('title').style.display = 'none';

      // Auto-load first humanoid PMX
      if (count > 0) {
        selectPmx.selectedIndex = 1;
        await this._loadPmxFromZip(selectPmx.value);
      }
    } catch (err) {
      console.error('ZIP error:', err);
    }
  }

  async _loadPmxFromZip(pmxPath) {
    const pmxName = pmxPath.split('/').pop();
    const statusEl = document.getElementById('loading-status');
    statusEl.textContent = 'Loading...';

    // Save current audio time for re-sync
    const savedTime = this.audio.currentTime;
    const wasPlaying = this.animation.playing;

    // Clean up model state (but keep audio playing)
    this.animation.destroy();
    this.riseFx.resetTime();

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

      // Re-apply VMD: use _currentVmd (playing) or _pendingVmd (pre-loaded)
      const vmdToApply = this._currentVmd || this._pendingVmd;
      if (vmdToApply) {
        await this._applyVmdToMesh(vmdToApply.vmdBlob);
        this._currentVmd = vmdToApply;
        this._pendingVmd = null;

        // Sync animation to audio time
        if (this.animation.helper && this.animation.mesh) {
          const obj = this.animation.helper.objects.get(this.animation.mesh);
          if (obj && obj.mixer) {
            obj.mixer.setTime(savedTime);
            this.riseFx.seekTo(savedTime);
          }
        }
        this.animation.playing = true;
      }

      statusEl.textContent = '';
    } catch (err) {
      console.error('PMX load error:', err);
      statusEl.textContent = '';
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

    // Auto-play on manifest load
    this._initAutoPlay();
  }

  _initAutoPlay() {
    if (!this._manifest || !this._manifest.artists.length) return;
    this._playFirstSong();
  }

  _playFirstSong() {
    const targetVmd = 'vmd/[Seto]/[NEW]/Summer Idol/Summer Idol/mmd_SummerIdol_RIN.vmd';

    for (const artist of this._manifest.artists) {
      const song = artist.songs.find(s => s.vmd === targetVmd);
      if (!song) continue;

      const artistSelect = document.getElementById('select-artist');
      const songSelect = document.getElementById('select-song');

      artistSelect.value = artist.name;
      artistSelect.dispatchEvent(new Event('change'));

      for (const opt of songSelect.options) {
        if (!opt.value) continue;
        const parsed = JSON.parse(opt.value);
        if (parsed.vmd === targetVmd) {
          songSelect.value = opt.value;
          break;
        }
      }

      this._loadVMDFromManifest(song.vmd, song.audio);
      return;
    }

    // Fallback if target not found
    this._playRandomSong();
  }

  _playRandomSong() {
    if (!this._manifest || !this._manifest.artists.length) return;

    // Build flat list of all songs
    const allSongs = [];
    for (const artist of this._manifest.artists) {
      for (const song of artist.songs) {
        allSongs.push({ artist: artist.name, song });
      }
    }
    if (allSongs.length === 0) return;

    // Pick random, excluding current song if possible
    let candidates = allSongs;
    if (this._currentVmd && allSongs.length > 1) {
      candidates = allSongs.filter(s => s.song.vmd !== this._currentVmd.vmdPath);
    }
    const pick = candidates[Math.floor(Math.random() * candidates.length)];

    // Reflect selection in dropdowns
    const artistSelect = document.getElementById('select-artist');
    const songSelect = document.getElementById('select-song');

    artistSelect.value = pick.artist;
    artistSelect.dispatchEvent(new Event('change'));

    // Find the matching option in song select
    for (const opt of songSelect.options) {
      if (!opt.value) continue;
      const parsed = JSON.parse(opt.value);
      if (parsed.vmd === pick.song.vmd) {
        songSelect.value = opt.value;
        break;
      }
    }

    this._loadVMDFromManifest(pick.song.vmd, pick.song.audio);
  }

  async _loadVMDFromManifest(vmdPath, audioPath) {
    try {
      // Fetch VMD and audio in parallel
      const [vmdRes, audioRes] = await Promise.all([
        fetch('data/' + vmdPath),
        fetch('data/' + audioPath),
      ]);
      if (!vmdRes.ok) throw new Error(`Failed to fetch VMD: ${vmdRes.status}`);
      if (!audioRes.ok) throw new Error(`Failed to fetch audio: ${audioRes.status}`);

      const vmdBlob = await vmdRes.blob();
      const vmdFile = new File([vmdBlob], vmdPath.split('/').pop());
      const audioBlob = await audioRes.blob();
      const audioFile = new File([audioBlob], audioPath.split('/').pop());

      // Load audio source (but don't play yet — wait for VMD to be ready)
      this.audio.loadFromFile(audioFile);

      this._vmdPath = vmdPath;
      this._updateDebugPaths();

      if (this.loader.mesh) {
        // Mesh available: apply VMD, then start both together
        this.animation.destroy();
        this.riseFx.resetTime();
        await this._applyVmdToMesh(vmdFile);
        this._currentVmd = { vmdPath, audioPath, vmdBlob: vmdFile };
        this._pendingVmd = null;

        // Start audio + animation at the same time
        this.animation.playing = true;
        try {
          await this.audio.audioElement.play();
          this._updatePlayPauseButton(true);
        } catch {
          // Autoplay blocked — wait for first user interaction
          this.animation.playing = false;
          this._updatePlayPauseButton(false);
          const resume = () => {
            this.audio.play();
            this.animation.playing = true;
            this._updatePlayPauseButton(true);
            document.removeEventListener('click', resume);
            document.removeEventListener('keydown', resume);
          };
          document.addEventListener('click', resume, { once: true });
          document.addEventListener('keydown', resume, { once: true });
        }
      } else {
        // No mesh yet: store VMD for later, play audio immediately
        this._pendingVmd = { vmdPath, audioPath, vmdBlob: vmdFile };
        this._currentVmd = null;
        try {
          await this.audio.audioElement.play();
          this._updatePlayPauseButton(true);
        } catch {
          this._updatePlayPauseButton(false);
        }
      }
    } catch (err) {
      console.error('VMD manifest load error:', err);
    }
  }

  async _applyVmdToMesh(vmdFile) {
    const mesh = this.loader.mesh;
    const loader = new MMDLoader();

    // Extract VMD metadata before loading
    const buffer = await vmdFile.arrayBuffer();
    const vmdMeta = extractVmdMeta(buffer);

    const url = URL.createObjectURL(vmdFile);

    return new Promise((resolve, reject) => {
      loader.loadAnimation(url, mesh, (clip) => {
        URL.revokeObjectURL(url);

        this._prepareAnimation(clip, mesh, vmdMeta);

        this.animation.initHelper(mesh, { vmd: clip, physics: false });
        this.animation.playing = false;
        resolve(clip);
      }, undefined, (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      });
    });
  }

  _prepareAnimation(clip, mesh, vmdMeta = null) {
    // ① Bone remap
    const remap = remapClipBones(clip, mesh.skeleton);

    // ② Validate compatibility
    const validation = validateClip(clip, mesh, remap, vmdMeta);

    // ③ Retarget (source model detection → offset correction)
    const retarget = retargetClip(clip, remap.trackBones, new Set(remap.dropped));

    // ④ Precompute effect events
    const wrists = ['左手首', '右手首'];
    const motionEvents = precomputeSparkEvents(mesh, clip, wrists);
    this.riseFx.setEvents(motionEvents);

    this._showBoneDebug(remap, validation, retarget, vmdMeta);
    return { remap, validation, retarget };
  }

  _showBoneDebug({ remapped, dropped, ignored }, validation, retarget, vmdMeta) {
    const el = document.getElementById('debug-info');
    const lines = [];

    // Line 1: bone/morph counts + score
    if (validation) {
      const { boneMatch, morphMatch, score } = validation;
      const bonePart = `${boneMatch.matched}/${boneMatch.total} bones`;
      const morphPart = morphMatch
        ? ` · ${morphMatch.matched}/${morphMatch.total} morphs`
        : '';
      const scoreClass = score >= 80 ? 'score-good' : score >= 50 ? 'score-fair' : 'score-poor';
      const scoreLabel = score >= 80 ? '' : score >= 50 ? ' FAIR' : ' POOR';
      lines.push(`${bonePart}${morphPart} · <span class="${scoreClass}">${Math.round(score)}%${scoreLabel}</span>`);
    }

    // Line 2: Source + Retarget
    const infoParts = [];
    if (validation?.sourceModel) {
      infoParts.push(`Source: ${validation.sourceModel}`);
    }
    if (retarget?.applied.length) {
      infoParts.push(`Retarget: ${retarget.applied.join(', ')}`);
    }
    if (infoParts.length) lines.push(infoParts.join(' · '));

    // Warnings
    if (validation?.isCamera) {
      lines.push('<span class="warn">WARN Camera VMD loaded on character slot</span>');
    }
    if (validation?.semiStdCoverage?.missing.length) {
      lines.push(`<span class="warn">WARN 準標準ボーン: ${validation.semiStdCoverage.missing.join(', ')}</span>`);
    }
    if (validation?.zenoyaPosition) {
      lines.push('<span class="warn">WARN 全ての親 has position keyframes</span>');
    }
    if (validation?.translationWarns?.length) {
      lines.push(`<span class="warn">WARN Large translation: ${validation.translationWarns.join(', ')}</span>`);
    }

    // Arm extremes
    if (validation && Object.keys(validation.armExtremes).length > 0) {
      const warns = Object.entries(validation.armExtremes)
        .map(([bone, v]) => `${bone} ${v.peakAngle}°`);
      lines.push(`<span class="drop">Arm peak: ${warns.join(', ')}</span>`);
    }

    // Missing bones
    if (dropped.length) {
      lines.push(`<span class="drop">Missing: ${dropped.join(', ')}</span>`);
    }

    // Morph missing
    if (validation?.morphMatch?.missing?.length) {
      const miss = validation.morphMatch.missing;
      const display = miss.length > 5
        ? miss.slice(0, 5).join(', ') + ` +${miss.length - 5} more`
        : miss.join(', ');
      lines.push(`<span class="warn">Morph missing: ${display}</span>`);
    }

    // Paths
    if (this._pmxPath) {
      const pmxDisplay = this._zipName ? `${this._zipName}/${this._pmxPath}` : this._pmxPath;
      lines.push(`PMX: ${pmxDisplay}`);
    }
    if (this._vmdPath) {
      lines.push(`VMD: ${this._vmdPath}`);
    }

    el.innerHTML = lines.length ? lines.join('<br>') : '';
  }

  // --- Debug Paths (renders path-only until validation overwrites) ---

  _updateDebugPaths() {
    const el = document.getElementById('debug-info');
    const lines = [];
    if (this._pmxPath) {
      const pmxDisplay = this._zipName ? `${this._zipName}/${this._pmxPath}` : this._pmxPath;
      lines.push(`PMX: ${pmxDisplay}`);
    }
    if (this._vmdPath) lines.push(`VMD: ${this._vmdPath}`);
    el.innerHTML = lines.length ? lines.join('<br>') : '';
  }

  // --- Playback Controls (Play/Pause toggle) ---

  _initPlayback() {
    const sig = { signal: this._ac.signal };
    const btn = document.getElementById('btn-playpause');
    const muteBtn = document.getElementById('btn-mute');
    const volumeEl = document.getElementById('volume');

    // Start muted — slider stays at 0.5 but audio is silent
    this._muted = true;
    this._prevVolume = parseFloat(volumeEl.value);
    this.audio.setVolume(0);

    btn.addEventListener('click', () => {
      if (this.audio.audioElement && !this.audio.audioElement.paused) {
        this.animation.playing = false;
        this.audio.pause();
        this._updatePlayPauseButton(false);
      } else {
        this.animation.playing = true;
        this.audio.play();
        this._updatePlayPauseButton(true);
      }
    }, sig);

    muteBtn.addEventListener('click', () => {
      this._muted = !this._muted;
      if (this._muted) {
        this.audio.setVolume(0);
      } else {
        this.audio.setVolume(parseFloat(volumeEl.value));
      }
      this._updateMuteButton();
    }, sig);

    volumeEl.addEventListener('input', () => {
      const v = parseFloat(volumeEl.value);
      if (!this._muted) {
        this.audio.setVolume(v);
      }
      if (v > 0) this._prevVolume = v;
    }, sig);
  }

  _updateMuteButton() {
    const btn = document.getElementById('btn-mute');
    btn.innerHTML = this._muted ? '&#128263;' : '&#128264;';
    btn.classList.toggle('active', !this._muted);
  }

  _updatePlayPauseButton(isPlaying) {
    const btn = document.getElementById('btn-playpause');
    btn.innerHTML = isPlaying ? '&#9646;&#9646;' : '&#9655;';
  }

  // --- Timeline Scrubber ---

  _initTimeline() {
    this._tlTrack = document.getElementById('tl-track');
    this._tlFill = document.getElementById('tl-fill');
    this._tlThumb = document.getElementById('tl-thumb');
    this._tlCurrent = document.getElementById('tl-current');
    this._tlTotal = document.getElementById('tl-total');
    this._tlContainer = document.getElementById('timeline');
    this._tlDragging = false;
    this._tlWasPlaying = false;

    const FPS = 30;
    const sig = { signal: this._ac.signal };

    const seekFromEvent = (e) => {
      const rect = this._tlTrack.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      const duration = this.audio.duration;
      if (duration <= 0) return;
      const time = Math.round(ratio * duration * FPS) / FPS;
      this.animation.seekTo(time);
      this.audio.seekTo(time);
      this.riseFx.seekTo(time);
      this._updateTimelineDisplay(time, duration);
    };

    const onStart = (e) => {
      this._tlDragging = true;
      this._tlWasPlaying = this.animation.playing;
      if (this._tlWasPlaying) {
        this.animation.playing = false;
        this.audio.pause();
      }
      this._tlContainer.classList.add('dragging');
      this._tlTrack.setPointerCapture(e.pointerId);
      seekFromEvent(e);
    };

    const onMove = (e) => {
      if (!this._tlDragging) return;
      seekFromEvent(e);
    };

    const onEnd = (e) => {
      if (!this._tlDragging) return;
      this._tlDragging = false;
      this._tlContainer.classList.remove('dragging');
      this._tlTrack.releasePointerCapture(e.pointerId);
      if (this._tlWasPlaying) {
        this.animation.playing = true;
        this.audio.play();
      }
    };

    this._tlTrack.addEventListener('pointerdown', onStart, sig);
    this._tlTrack.addEventListener('pointermove', onMove, sig);
    this._tlTrack.addEventListener('pointerup', onEnd, sig);
    this._tlTrack.addEventListener('lostpointercapture', onEnd, sig);

    // Continuous update loop
    const updateLoop = () => {
      if (!this._tlDragging) {
        const duration = this.audio.duration;
        const time = this.audio.currentTime;
        this._updateTimelineDisplay(time, duration);
      }
      this._tlRAF = requestAnimationFrame(updateLoop);
    };
    this._tlRAF = requestAnimationFrame(updateLoop);
  }

  _updateTimelineDisplay(time, duration) {
    const FPS = 30;
    const ratio = duration > 0 ? time / duration : 0;
    this._tlFill.style.transform = `scaleX(${ratio})`;
    this._tlThumb.style.left = (ratio * 100) + '%';
    this._tlCurrent.textContent = this._formatTimeline(time, FPS);
    this._tlTotal.textContent = this._formatTimeline(duration, FPS);
  }

  _formatTimeline(seconds, fps) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const f = Math.round(seconds * fps);
    return `${m}:${String(s).padStart(2, '0')} f${f}`;
  }

  _initFxSelectors() {
    const sig = { signal: this._ac.signal };

    document.getElementById('select-bg-fx').addEventListener('change', (e) => {
      const val = e.target.value;
      this.riseFx.enabled = false;
      this.fallFx.enabled = false;
      if (val === 'rise') this.riseFx.enabled = true;
      else if (val === 'fall') this.fallFx.enabled = true;
    }, sig);
  }

  destroy() {
    this._ac.abort();
    if (this._tlRAF) cancelAnimationFrame(this._tlRAF);
  }
}
