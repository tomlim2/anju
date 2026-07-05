pub mod outline;
pub mod params;
pub mod toon;

use bevy::prelude::*;

use outline::OutlineMaterial;
use toon::ToonMaterial;

pub use outline::OutlineOf;
pub use params::{OutlineParams, ToonParams};

pub struct NprShaderPlugin;

impl Plugin for NprShaderPlugin {
    fn build(&self, app: &mut App) {
        app.add_plugins(MaterialPlugin::<ToonMaterial>::default())
            .add_plugins(MaterialPlugin::<OutlineMaterial>::default())
            .init_resource::<ShaderLibrary>();
    }
}

#[derive(Resource)]
pub struct ShaderLibrary {
    pub entries: Vec<ShaderEntry>,
    pub active_index: usize,
}

impl Default for ShaderLibrary {
    fn default() -> Self {
        Self {
            entries: vec![
                ShaderEntry {
                    name: "Toon 2-Tone".into(),
                    toon_params: ToonParams::default(),
                    outline_params: OutlineParams::default(),
                },
                ShaderEntry {
                    name: "Toon 3-Tone".into(),
                    toon_params: ToonParams {
                        bands: 3,
                        ..ToonParams::default()
                    },
                    outline_params: OutlineParams::default(),
                },
                ShaderEntry {
                    name: "Flat".into(),
                    toon_params: ToonParams {
                        bands: 1,
                        softness: 0.0,
                        rim_power: 0.0,
                        ..ToonParams::default()
                    },
                    outline_params: OutlineParams::default(),
                },
            ],
            active_index: 0,
        }
    }
}

impl ShaderLibrary {
    pub fn active(&self) -> &ShaderEntry {
        &self.entries[self.active_index]
    }

    pub fn next(&mut self) {
        self.active_index = (self.active_index + 1) % self.entries.len();
    }

    pub fn prev(&mut self) {
        if self.active_index == 0 {
            self.active_index = self.entries.len() - 1;
        } else {
            self.active_index -= 1;
        }
    }
}

pub struct ShaderEntry {
    pub name: String,
    pub toon_params: ToonParams,
    pub outline_params: OutlineParams,
}
