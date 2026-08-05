// Cel shader + inverted-hull outline.
//
// The lighting model is a web port of the knobs in glsl/Subs_ToonShader_V04:
// banded ramp with a shadow-sensitivity bias, a flat-lighting weight that
// pulls the ramp toward unlit colour, stepped specular, and a rim term.
// Shadow bands are filled with a screen-space halftone instead of a flat
// colour — the print-screentone look the micro-graphic generator uses in 2D.

import * as THREE from "three";

const VERT = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vPositionW;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vPositionW = worldPosition.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const FRAG = /* glsl */ `
precision highp float;

varying vec3 vNormalW;
varying vec3 vPositionW;

uniform vec3 uLightDirection;
uniform vec3 uBaseColor;
uniform vec3 uShadowColor;
uniform vec3 uPaperColor;
uniform float uBands;
uniform float uThreshold;   // shadow sensitivity: biases the ramp toward light or shadow
uniform float uFlatWeight;  // 1 = fully flat (unlit base colour everywhere)
uniform float uToneScale;   // halftone dots per screen height, roughly
uniform float uToneCover;   // how far the dots spread into the shadow bands
uniform float uSpecular;
uniform float uRim;
uniform vec2 uResolution;
uniform vec3 uCameraPositionW;

// 45-degree dot screen in device space, so the tone reads as printed on the
// image rather than wallpapered onto the mesh.
float screentone(float darkness) {
  vec2 grid = gl_FragCoord.xy / uResolution.y * uToneScale;
  grid = mat2(0.7071, -0.7071, 0.7071, 0.7071) * grid;
  vec2 cellCentre = fract(grid) - 0.5;
  float radius = sqrt(clamp(darkness, 0.0, 1.0)) * 0.68;
  // fwidth keeps the dot edge one pixel wide at any scale.
  return smoothstep(radius + fwidth(grid.x), radius - fwidth(grid.x), length(cellCentre));
}

void main() {
  vec3 normal = normalize(vNormalW);
  vec3 toCamera = normalize(uCameraPositionW - vPositionW);
  vec3 toLight = normalize(uLightDirection);

  float lambert = dot(normal, toLight) * 0.5 + 0.5;
  float biased = clamp(lambert + uThreshold, 0.0, 1.0);

  // Quantise into bands; band 1.0 is fully lit paper, band 0.0 deepest shadow.
  float band = floor(biased * uBands) / max(uBands - 1.0, 1.0);
  band = clamp(band, 0.0, 1.0);

  // Halftone strength grows as bands darken; coverage widens the spread.
  float darkness = (1.0 - band) * uToneCover * 1.6;
  float tone = screentone(darkness);

  vec3 litColor = mix(uShadowColor, uBaseColor, band);
  vec3 flatColor = uBaseColor;
  vec3 surface = mix(litColor, flatColor, uFlatWeight);

  // Ink the halftone dots with the shadow colour over whatever the band gave.
  surface = mix(surface, uShadowColor, tone * (1.0 - band * 0.55));

  // Stepped specular: one hard printed highlight, no gradient.
  vec3 halfway = normalize(toLight + toCamera);
  float specDot = max(dot(normal, halfway), 0.0);
  float highlight = step(1.0 - uSpecular * 0.08, specDot);
  surface = mix(surface, uPaperColor, highlight * step(0.35, band));

  // Rim: a hard paper-coloured edge on the lit side, manga flash-style.
  float rimDot = 1.0 - max(dot(normal, toCamera), 0.0);
  float rim = step(1.0 - uRim * 0.25, rimDot) * step(0.5, biased);
  surface = mix(surface, uPaperColor, rim);

  gl_FragColor = vec4(surface, 1.0);
  #include <colorspace_fragment>
}
`;

const OUTLINE_VERT = /* glsl */ `
uniform float uWidth;

void main() {
  // Push along the normal in clip space so the hull width is stable on
  // screen regardless of model scale or camera distance.
  vec4 clipPosition = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec3 clipNormal = normalize(mat3(projectionMatrix) * mat3(modelViewMatrix) * normal);
  clipPosition.xy += clipNormal.xy * uWidth * clipPosition.w;
  gl_Position = clipPosition;
}
`;

const OUTLINE_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uInkColor;

void main() {
  gl_FragColor = vec4(uInkColor, 1.0);
  #include <colorspace_fragment>
}
`;

export function createToonMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uLightDirection: { value: new THREE.Vector3(0.6, 0.8, 0.5) },
      uBaseColor: { value: new THREE.Color("#f2f3ef") },
      uShadowColor: { value: new THREE.Color("#16181a") },
      uPaperColor: { value: new THREE.Color("#ffffff") },
      uBands: { value: 3 },
      uThreshold: { value: 0.08 },
      uFlatWeight: { value: 0.35 },
      uToneScale: { value: 140 },
      uToneCover: { value: 0.55 },
      uSpecular: { value: 0.5 },
      uRim: { value: 0.45 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uCameraPositionW: { value: new THREE.Vector3() }
    }
  });
}

export function createOutlineMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: OUTLINE_VERT,
    fragmentShader: OUTLINE_FRAG,
    uniforms: {
      uWidth: { value: 0.02 },
      uInkColor: { value: new THREE.Color("#16181a") }
    },
    side: THREE.BackSide
  });
}
