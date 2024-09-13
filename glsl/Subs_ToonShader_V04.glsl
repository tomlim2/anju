import lib-sampler.glsl
import lib-env.glsl
import lib-vectors.glsl
import lib-utils.glsl

#define DISABLE_FRAMEBUFFER_SRGB_CONVERSION


//: param auto main_light
uniform vec4 light_main;

//: param custom { "default": false, "label": "   ★ V04 MIR Toon Shader 2021.11.10 （ ÒㅅÓ)★   " }
uniform bool u_bool;


//: param custom { "default": true, "label": "OS_R (Shadow)" }
uniform bool u_bool_2;

//: param custom { "default": true, "label": "OS_G (Specular)" }
uniform bool u_bool_4;

//: param custom { "default": true, "label": "OS_B (Self Illumination)" }
uniform bool u_bool_3;

//: param custom { "default": true, "label": "Shadow " }
uniform bool u_bool_1;

//: param custom { "default": true, "label": "Line_S (Base line)" }
uniform bool u_bool_5;

//: param custom { "default": 1, "label": "Flat Lighting Weight", "min": 0.0, "max": 1.0 }
uniform float u_slider_1;

//: param custom { "default": 0.1, "label": "Shadow Sensitivity", "min": 0.0, "max": 1.0 }
uniform float u_slider_2;

//: param custom { "default": 0, "label": "OS_R Mask (shadow) ", "min": 0.0, "max": 1.0 }
uniform float u_slider_r;

//: param custom { "default": 0, "label": "OS_G Mask (specular) ", "min": 0.0, "max": 1.0 }
uniform float u_slider_g;

//: param custom { "default": 0, "label": "OS_B Mask (Self Illumination)", "min": 0.0, "max": 1.0 }
uniform float u_slider_b;

//: param custom { "default": 0, "label": "Line Mask (Base Line)", "min": 0.0, "max": 1.0 }
uniform float u_slider_a;

//: param auto channel_user0
uniform SamplerSparse color_tex;

//: param auto channel_user1
uniform SamplerSparse shadowcolor_tex;

//: param auto channel_user2
uniform SamplerSparse os_tex;

//: param auto channel_user3
uniform SamplerSparse deepshadow_tex;

//: param auto channel_user4
uniform SamplerSparse reflectcolor_tex;

//: param auto channel_user6
uniform SamplerSparse linecolor_tex;

//: param auto channel_user7
uniform SamplerSparse lines_tex;

vec2 mx_transform_uv(vec2 uv, vec2 uv_scale, vec2 uv_offset)
{
    uv = uv * uv_scale + uv_offset;
    return uv;
}

void mx_image_color3(sampler2D tex_sampler, int layer, vec3 defaultval, vec2 texcoord, int uaddressmode, int vaddressmode, int filtertype, int framerange, int frameoffset, int frameendaction, vec2 uv_scale, vec2 uv_offset, out vec3 result)
{
    // TODO: Fix handling of addressmode
    if(textureSize(tex_sampler, 0).x > 1)
    {
        vec2 uv = mx_transform_uv(texcoord, uv_scale, uv_offset);
        result = texture(tex_sampler, uv).rgb;
    }
    else
    {
        result = defaultval;
    }
}

void getTexture(out vec3 color_output, out vec3 shadowcolor_output, out vec3 os_output, out vec3 deepshadow_output, out vec3 reflectcolor_output, out vec3 linecolor_output, out vec3 lines_output)
{
    vec2 geomprop_UV0_out = var_tex_coord0;
    vec3 color_out = vec3(0.0);
    mx_image_color3(color_tex.tex, 0, vec3(0.500000, 0.500000, 0.500000), geomprop_UV0_out, 2, 2, 1, 0, 0, 0, vec2(1.000000, 1.000000), vec2(0.000000, 0.000000), color_out);
    vec3 shadowcolor_out = vec3(0.0);
    mx_image_color3(shadowcolor_tex.tex, 0, vec3(0.400000, 0.400000, 0.400000), geomprop_UV0_out, 2, 2, 1, 0, 0, 0, vec2(1.000000, 1.000000), vec2(0.000000, 0.000000), shadowcolor_out);
    vec3 os_out = vec3(0.0);
    mx_image_color3(os_tex.tex, 0, vec3(0.000000, 0.000000, 0.000000), geomprop_UV0_out, 2, 2, 1, 0, 0, 0, vec2(1.000000, 1.000000), vec2(0.000000, 0.000000), os_out);
    vec3 deepshadow_out = vec3(0.0);
    mx_image_color3(deepshadow_tex.tex, 0, vec3(0.300000, 0.300000, 0.300000), geomprop_UV0_out, 2, 2, 1, 0, 0, 0, vec2(1.000000, 1.000000), vec2(0.000000, 0.000000), deepshadow_out);
    vec3 reflectcolor_out = vec3(0.0);
    mx_image_color3(reflectcolor_tex.tex, 0, vec3(0.200000, 0.200000, 0.200000), geomprop_UV0_out, 2, 2, 1, 0, 0, 0, vec2(1.000000, 1.000000), vec2(0.000000, 0.000000), reflectcolor_out);
     vec3 linecolor_out = vec3(0.0);
    mx_image_color3(linecolor_tex.tex, 0, vec3(0.200000, 0.200000, 0.200000), geomprop_UV0_out, 2, 2, 1, 0, 0, 0, vec2(1.000000, 1.000000), vec2(0.000000, 0.000000), linecolor_out);
     vec3 lines_out = vec3(0.0);
    mx_image_color3(lines_tex.tex, 0, vec3(0.200000, 0.200000, 0.200000), geomprop_UV0_out, 2, 2, 1, 0, 0, 0, vec2(1.000000, 1.000000), vec2(0.000000, 0.000000), lines_out);
    color_output = color_out;
    shadowcolor_output = shadowcolor_out;
	os_output = os_out;
	deepshadow_output = deepshadow_out;
	reflectcolor_output = reflectcolor_out;
    linecolor_output = linecolor_out;
    lines_output = lines_out;
}

void detailMap(out vec3 normal_output, out vec3 tangent_output)
{
    vec3 onthefly_1_out = normalize(var_normal);
    vec3 onthefly_2_out = normalize(var_tangent);
    normal_output = onthefly_1_out;
    tangent_output = onthefly_2_out;
}

void shade(V2F inputs)
{
	const vec3 DEFAULT_USER1 = vec3(0.0);
	vec3 base_color;
	vec3 shadow_color;
	vec3 os_color;
    vec3 deepshadow_color;
	vec3 reflect_color;
    vec3 line_color;
    vec3 lines_color;
    vec3 finalcolor;
    
    
    getTexture(base_color, shadow_color, os_color, deepshadow_color, reflect_color, line_color, lines_color);
    
   
	shadow_color = sRGB2linear(shadow_color);
	deepshadow_color = sRGB2linear(deepshadow_color);
    reflect_color = sRGB2linear(reflect_color);
    line_color = sRGB2linear(line_color);
    base_color = sRGB2linear(base_color);
    
    
	 if (u_bool_4 ==  true) {
    base_color = base_color = mix(base_color,reflect_color,os_color.y);
    }
     if (u_bool_2 ==  true) {
    base_color = mix(base_color,shadow_color,os_color.x);
    }
     if (u_bool_3 ==  true) {
    base_color = mix(base_color,deepshadow_color,os_color.z);
    }
     if (u_bool_3 ==  true) {
    shadow_color = mix(shadow_color,deepshadow_color,os_color.z);
    }
     if (u_bool_5 ==  true) {
    base_color = mix(line_color,base_color,lines_color.x);
    }
      if (u_bool_5 ==  true) {
    shadow_color = mix(line_color,shadow_color,lines_color.x);
    }
    
    
    
    vec3 osMaskred = vec3(os_color.x+0.1);
	vec3 osMaskgreen = vec3(os_color.y+0.1);
	vec3 osMaskblue = vec3(os_color.z+0.1);
    vec3 lineMask = vec3(lines_color.x+0.1);
	
    
    
	
	vec3 normal;
    vec3 tangent;
	detailMap(normal, tangent);
    mat3 to_ts = transpose(mat3(inputs.tangent, inputs.bitangent, inputs.normal));
    vec3 channel_normal_ts_unpacked = normalize(to_ts * normal);
    vec3 texture_normal_ts = texture(base_normal_texture.tex, var_tex_coord0).xyz;
    texture_normal_ts = normalUnpack(vec4(texture_normal_ts, 1.0), base_normal_y_coeff);
    vec3 normal_blended = normalBlendOriented(texture_normal_ts, channel_normal_ts_unpacked) ;
    vec3 blended_normal_ws = normalize(normal_blended.x * inputs.tangent + normal_blended.y * inputs.bitangent + normal_blended.z * inputs.normal);
	
	LocalVectors vectors = computeLocalFrame(inputs);
    float ndl = max(0.0, dot(vectors.normal, light_main.xyz));

    if (u_bool_1  == false) {
    finalcolor = base_color;
    } else if (ndl > u_slider_2) {
    finalcolor = base_color;
    }
    else
    finalcolor = shadow_color;
		
	finalcolor = mix(finalcolor,osMaskred, u_slider_r * 0.9);
	finalcolor = mix(finalcolor,osMaskgreen, u_slider_g * 0.9);
	finalcolor = mix(finalcolor,osMaskblue, u_slider_b * 0.9);
    finalcolor = mix(finalcolor,lineMask, u_slider_a * 0.9);
	
	vec3 diffuseWeight = clamp((envIrradiance(blended_normal_ws)*0.9 + u_slider_1), 0.0, 1.0);
	    finalcolor = finalcolor;

    diffuseShadingOutput(finalcolor * diffuseWeight);
    
    
}