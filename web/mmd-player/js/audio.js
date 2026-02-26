export class MMDAudio {
  constructor(animation) {
    this.animation = animation;
    this.audioElement = null;
  }

  loadFromFile(file) {
    if (this.audioElement) {
      this.audioElement.pause();
      URL.revokeObjectURL(this.audioElement.src);
    }

    const url = URL.createObjectURL(file);
    this.audioElement = new Audio(url);
    this.audioElement.preload = 'auto';
    return this.audioElement;
  }

  play() {
    if (this.audioElement) this.audioElement.play();
  }

  pause() {
    if (this.audioElement) this.audioElement.pause();
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
