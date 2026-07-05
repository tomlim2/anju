#import bevy_pbr::forward_io::VertexOutput

struct OutlineParams {
    outline_color: vec4<f32>,
    outline_width: f32,
    _padding0: f32,
    _padding1: f32,
    _padding2: f32,
}

@group(3) @binding(0) var<uniform> params: OutlineParams;

@fragment
fn fragment(in: VertexOutput) -> @location(0) vec4<f32> {
    return params.outline_color;
}
