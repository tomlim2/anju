/**
 * Energy-based onset/beat detection from audio buffer.
 * Returns timestamps (seconds) where beats/onsets are detected.
 */

const WINDOW = 1024;
const HOP = 512;
const ADAPTIVE_HALF = 21;   // ~1s of analysis windows for running average
const ONSET_MULT = 1.5;     // flux must exceed local average × this
const MIN_GAP = 0.1;        // minimum seconds between onsets

const AudioCtx = window.AudioContext || window.webkitAudioContext;

export async function detectBeatsFromBuffer(arrayBuffer) {
  try {
    const ctx = new AudioCtx();
    const buf = await ctx.decodeAudioData(arrayBuffer);
    ctx.close();
    return detectBeats(buf);
  } catch (e) {
    console.warn('[audio] beat detection failed:', e);
    return [];
  }
}

function detectBeats(buf) {
  const rate = buf.sampleRate;
  const length = buf.length;
  const channels = buf.numberOfChannels;

  // Mix to mono
  const mono = new Float32Array(length);
  for (let ch = 0; ch < channels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < length; i++) mono[i] += d[i] / channels;
  }

  // Windowed energy
  const numWin = Math.floor((length - WINDOW) / HOP) + 1;
  if (numWin < 3) return [];

  const energy = new Float64Array(numWin);
  for (let w = 0; w < numWin; w++) {
    const start = w * HOP;
    let e = 0;
    for (let i = 0; i < WINDOW; i++) e += mono[start + i] * mono[start + i];
    energy[w] = e;
  }

  // Spectral flux: positive energy difference only
  const flux = new Float64Array(numWin);
  for (let w = 1; w < numWin; w++) {
    const d = energy[w] - energy[w - 1];
    flux[w] = d > 0 ? d : 0;
  }

  // Adaptive threshold onset detection
  const raw = [];
  for (let w = 1; w < numWin - 1; w++) {
    let sum = 0, cnt = 0;
    for (let j = w - ADAPTIVE_HALF; j <= w + ADAPTIVE_HALF; j++) {
      if (j >= 0 && j < numWin) { sum += flux[j]; cnt++; }
    }
    const avg = sum / cnt;
    if (flux[w] > avg * ONSET_MULT && flux[w] > flux[w - 1] && flux[w] >= flux[w + 1]) {
      raw.push((w * HOP) / rate);
    }
  }

  // Min gap filter
  const beats = [];
  for (const t of raw) {
    if (beats.length === 0 || t - beats[beats.length - 1] > MIN_GAP) {
      beats.push(t);
    }
  }

  console.log(`[audio] detected ${beats.length} onsets`);
  return beats;
}
