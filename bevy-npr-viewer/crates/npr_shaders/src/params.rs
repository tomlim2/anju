use bevy::prelude::*;
use bevy::render::render_resource::ShaderType;
use serde::{Deserialize, Serialize};

#[derive(ShaderType, Clone, Debug, Serialize, Deserialize)]
pub struct ToonParams {
    pub base_color: Vec4,
    pub shadow_color: Vec4,
    pub rim_color: Vec4,
    pub bands: u32,
    pub softness: f32,
    pub rim_power: f32,
    pub _padding: f32,
}

impl Default for ToonParams {
    fn default() -> Self {
        Self {
            base_color: Vec4::new(1.0, 0.9, 0.85, 1.0),
            shadow_color: Vec4::new(0.3, 0.1, 0.2, 1.0),
            rim_color: Vec4::new(1.0, 1.0, 1.0, 0.5),
            bands: 2,
            softness: 0.02,
            rim_power: 3.0,
            _padding: 0.0,
        }
    }
}

#[derive(ShaderType, Clone, Debug, Serialize, Deserialize)]
pub struct OutlineParams {
    pub outline_color: Vec4,
    pub outline_width: f32,
    pub _padding0: f32,
    pub _padding1: f32,
    pub _padding2: f32,
}

impl Default for OutlineParams {
    fn default() -> Self {
        Self {
            outline_color: Vec4::new(0.0, 0.0, 0.0, 1.0),
            outline_width: 0.003,
            _padding0: 0.0,
            _padding1: 0.0,
            _padding2: 0.0,
        }
    }
}
