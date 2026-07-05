use bevy::prelude::*;
use bevy::render::render_resource::AsBindGroup;
use bevy::shader::ShaderRef;

use crate::params::ToonParams;

#[derive(Asset, TypePath, AsBindGroup, Clone, Debug)]
pub struct ToonMaterial {
    #[uniform(0)]
    pub params: ToonParams,
}

impl Default for ToonMaterial {
    fn default() -> Self {
        Self {
            params: ToonParams::default(),
        }
    }
}

impl Material for ToonMaterial {
    fn fragment_shader() -> ShaderRef {
        "shaders/toon.wgsl".into()
    }
}
