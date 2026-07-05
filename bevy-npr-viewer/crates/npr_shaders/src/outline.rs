use bevy::mesh::MeshVertexBufferLayoutRef;
use bevy::pbr::{MaterialPipeline, MaterialPipelineKey};
use bevy::prelude::*;
use bevy::render::render_resource::{
    AsBindGroup, Face, RenderPipelineDescriptor, SpecializedMeshPipelineError,
};
use bevy::shader::ShaderRef;

use crate::params::OutlineParams;

#[derive(Asset, TypePath, AsBindGroup, Clone, Debug)]
pub struct OutlineMaterial {
    #[uniform(0)]
    pub params: OutlineParams,
}

impl Default for OutlineMaterial {
    fn default() -> Self {
        Self {
            params: OutlineParams::default(),
        }
    }
}

impl Material for OutlineMaterial {
    fn fragment_shader() -> ShaderRef {
        "shaders/outline.wgsl".into()
    }

    fn specialize(
        _pipeline: &MaterialPipeline,
        descriptor: &mut RenderPipelineDescriptor,
        _layout: &MeshVertexBufferLayoutRef,
        _key: MaterialPipelineKey<Self>,
    ) -> Result<(), SpecializedMeshPipelineError> {
        // Inverted hull: cull front faces, render only back faces
        descriptor.primitive.cull_mode = Some(Face::Front);
        Ok(())
    }
}

/// Marker linking an outline entity back to its base mesh entity.
#[derive(Component)]
pub struct OutlineOf(pub Entity);
