export class MMDAudio {
  constructor(animation) {
    this.animation = animation;
    this.audioElement = null;
    this._volume = 0.5;
    this._onEnded = null;
  }

  loadFromFile(file) {
    if (this.audioElement) {
      this.audioElement.pause();
      URL.revokeObjectURL(this.audioElement.src);
    }

    const url = URL.createObjectURL(file);
    this.audioElement = new Audio(url);
    this.audioElement.preload = 'auto';
    this.audioElement.volume = this._volume;
    this.audioElement.addEventListener('ended', () => {
      if (this._onEnded) this._onEnded();
    });
    return this.audioElement;
  }

  onEnded(cb) { this._onEnded = cb; }

  setVolume(v) {
    this._volume = v;
    if (this.audioElement) this.audioElement.volume = v;
  }

  play() {
    if (this.audioElement) this.audioElement.play().catch(() => {});
  }

  pause() {
    if (this.audioElement) this.audioElement.pause();
  }

  stop() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }
  }

  seekTo(time) {
    if (this.audioElement) {
      this.audioElement.currentTime = time;
    }
  }

  get currentTime() {
    return this.audioElement ? this.audioElement.currentTime : 0;
  }

  get duration() {
    return this.audioElement ? this.audioElement.duration : 0;
  }

  destroy() {
    if (this.audioElement) {
      this.audioElement.pause();
      URL.revokeObjectURL(this.audioElement.src);
      this.audioElement = null;
    }
  }
}
