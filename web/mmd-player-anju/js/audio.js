export class MMDAudio {
  constructor(animation) {
    this.animation = animation;
    this.audioElement = null;
    this._volume = 0.5;
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
    return this.audioElement;
  }

  setVolume(v) {
    this._volume = v;
    if (this.audioElement) this.audioElement.volume = v;
  }

  play() {
    if (this.audioElement) this.audioElement.play();
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
