// Phrase → seamless repeating texture.
//
// The phrase is drawn once to a canvas whose width is exactly one tile
// (text + gap), so RepeatWrapping tiles it around the ribbon with no seam.
// Only the alpha channel matters — the shader inks the glyphs itself, which
// is what lets one texture serve every palette.

import * as THREE from "three";

const TILE_HEIGHT = 256;
const FONT_STACK = '"SUIT", "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", "Noto Sans SC", sans-serif';

export function createPhraseTexture(text, { weight = 900 } = {}) {
  const value = String(text ?? "").trim() || "안주";
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const fontSize = TILE_HEIGHT * 0.64;
  const font = `${weight} ${fontSize}px ${FONT_STACK}`;
  ctx.font = font;
  const metrics = ctx.measureText(value);
  const gap = fontSize * 0.75;
  const tileWidth = Math.max(64, Math.ceil(metrics.width + gap));

  canvas.width = tileWidth;
  canvas.height = TILE_HEIGHT;

  // Canvas resize resets state, so the font is set again before drawing.
  ctx.font = font;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.clearRect(0, 0, tileWidth, TILE_HEIGHT);
  ctx.fillStyle = "#fff";
  ctx.fillText(value, gap / 2, TILE_HEIGHT / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  // aspect = how many tile-heights long one tile is; the scene uses it to
  // keep the glyphs' proportions when wrapping a given circumference.
  return { texture, aspect: tileWidth / TILE_HEIGHT };
}
