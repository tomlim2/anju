/**
 * MMD Toon Shader (stub for WebGPU pipeline)
 *
 * The original requires ShaderLib (WebGL-only, absent from three.core.js).
 * Materials are swapped to MeshToonNodeMaterial after loading, so this stub
 * only provides the uniform structure MMDToonMaterial expects.
 */

import { UniformsUtils, Color, Vector2 } from 'three';

const MMDToonShader = {

	name: 'MMDToonShader',

	defines: {
		TOON: true,
		MATCAP: true,
		MATCAP_BLENDING_ADD: true,
	},

	uniforms: UniformsUtils.merge( [ {
		specular:             { value: new Color( 0x111111 ) },
		shininess:            { value: 30 },
		opacity:              { value: 1.0 },
		diffuse:              { value: new Color( 0xffffff ) },
		emissive:             { value: new Color( 0x000000 ) },
		map:                  { value: null },
		matcap:               { value: null },
		gradientMap:          { value: null },
		lightMap:             { value: null },
		lightMapIntensity:    { value: 1.0 },
		aoMap:                { value: null },
		aoMapIntensity:       { value: 1.0 },
		emissiveMap:          { value: null },
		bumpMap:              { value: null },
		bumpScale:            { value: 1 },
		normalMap:            { value: null },
		normalScale:          { value: new Vector2( 1, 1 ) },
		displacemantMap:      { value: null },
		displacemantScale:    { value: 1 },
		displacemantBias:     { value: 0 },
		specularMap:          { value: null },
		alphaMap:             { value: null },
		reflectivity:         { value: 1.0 },
		refractionRatio:      { value: 0.98 },
	} ] ),

	vertexShader: '',
	fragmentShader: '',

};

export { MMDToonShader };
