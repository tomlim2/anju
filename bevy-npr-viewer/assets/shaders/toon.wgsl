#import bevy_pbr::forward_io::VertexOutput
#import bevy_pbr::mesh_view_bindings::view

struct ToonParams {
    base_color: vec4<f32>,
    shadow_color: vec4<f32>,
    rim_color: vec4<f32>,
    bands: u32,
    softness: f32,
    rim_power: f32,
    _padding: f32,
}

@group(3) @binding(0) var<uniform> params: ToonParams;

fn cel_shade(n_dot_l: f32) -> f32 {
    let b = f32(params.bands);
    let stepped = floor(n_dot_l * b + 0.5) / b;
    return mix(stepped, n_dot_l, params.softness);
}

@fragment
fn fragment(in: VertexOutput) -> @location(0) vec4<f32> {
    let n = normalize(in.world_normal);

    // Directional light (top-right-front)
    let light_dir = normalize(vec3<f32>(0.5, 1.0, 0.8));
    let n_dot_l = max(dot(n, light_dir), 0.0);

    let shade = cel_shade(n_dot_l);
    let lit_color = mix(params.shadow_color, params.base_color, shade);

    // Rim light
    let camera_pos = view.world_position;
    let v = normalize(camera_pos - in.world_position.xyz);
    let rim_factor = pow(1.0 - max(dot(n, v), 0.0), params.rim_power);
    let final_color = lit_color.rgb + params.rim_color.rgb * params.rim_color.a * rim_factor;

    return vec4<f32>(final_color, 1.0);
}
