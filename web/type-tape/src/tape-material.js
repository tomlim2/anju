// Ribbon shader: printed type on a moving strip.
//
// Same print language as cel-lab — banded lighting, device-space halftone in
// the shade, hard rules — but here the ink comes from a phrase texture whose
// alpha the shader colours itself. The ribbon is double-sided; gl_FrontFacing
// flips the normal so the back of the strip shades correctly, and a rule
// along each edge frames the tape like a printed film strip.

import * as THREE from "three";

const VERT = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vPositionW;
varying vec2 vUv;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vPositionW = worldPosition.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const FRAG = /* glsl */ `
precision highp float;

varying vec3 vNormalW;
varying vec3 vPositionW;
varying vec2 vUv;

uniform sampler2D uPhrase;
uniform float uRepeat;
uniform float uFlow;
uniform vec3 uPaperColor;
uniform vec3 uInkColor;
uniform vec3 uLightDirection;
uniform float uToneCover;
uniform float uEdgeRule;
uniform vec2 uResolution;

float screentone(float darkness) {
  vec2 grid = gl_FragCoord.xy / uResolution.y * 150.0;
  grid = mat2(0.7071, -0.7071, 0.7071, 0.7071) * grid;
  vec2 cellCentre = fract(grid) - 0.5;
  float radius = sqrt(clamp(darkness, 0.0, 1.0)) * 0.68;
  return smoothstep(radius + fwidth(grid.x), radius - fwidth(grid.x), length(cellCentre));
}

void main() {
  vec3 normal = normalize(vNormalW) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 toLight = normalize(uLightDirection);

  // Three fixed bands; the tape is thin so a full ramp would just flicker.
  float lambert = dot(normal, toLight) * 0.5 + 0.5;
  float band = floor(clamp(lambert + 0.1, 0.0, 1.0) * 3.0) / 2.0;
  band = clamp(band, 0.0, 1.0);

  float glyph = texture2D(uPhrase, vec2(vUv.x * uRepeat + uFlow, vUv.y)).a;

  // Paper strip, inked glyphs; shade bands add halftone over the paper only,
  // so the letterforms stay solid ink whatever the light does.
  float darkness = (1.0 - band) * uToneCover * 1.4;
  float tone = screentone(darkness);
  vec3 paper = mix(uPaperColor, uInkColor, tone * 0.85);

  vec3 surface = mix(paper, uInkColor, glyph);

  // Film-strip rules along the ribbon edges.
  float rule = step(vUv.y, uEdgeRule) + step(1.0 - uEdgeRule, vUv.y);
  surface = mix(surface, uInkColor, clamp(rule, 0.0, 1.0));

  gl_FragColor = vec4(surface, 1.0);
  #include <colorspace_fragment>
}
`;

export function createTapeMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.DoubleSide,
    uniforms: {
      uPhrase: { value: null },
      uRepeat: { value: 2 },
      uFlow: { value: 0 },
      uPaperColor: { value: new THREE.Color("#f2f3ef") },
      uInkColor: { value: new THREE.Color("#16181a") },
      uLightDirection: { value: new THREE.Vector3(0.5, 0.8, 0.6) },
      uToneCover: { value: 0.5 },
      uEdgeRule: { value: 0.04 },
      uResolution: { value: new THREE.Vector2(1, 1) }
    }
  });
}
