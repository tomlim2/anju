use serde::Deserialize;
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
pub struct RetargetConfig {
    pub name: String,
    #[serde(default)]
    pub source_prefix: Vec<String>,
    pub direct_map: HashMap<String, String>,
    #[serde(default)]
    pub accumulate: HashMap<String, Vec<String>>,
    #[serde(default)]
    pub twist_fold: HashMap<String, Vec<String>>,
    #[serde(default)]
    pub root_bone: Option<String>,
    /// A-pose → T-pose rest pose offsets (Euler radians [x, y, z])
    #[serde(default)]
    pub rest_pose_offsets: HashMap<String, [f32; 3]>,
    #[serde(default)]
    pub ignore_patterns: Vec<String>,
    #[serde(default)]
    pub vrm_version_overrides: HashMap<String, HashMap<String, String>>,
}

impl RetargetConfig {
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }

    pub fn should_ignore(&self, bone_name: &str) -> bool {
        for pattern in &self.ignore_patterns {
            if glob_match(pattern, bone_name) {
                return true;
            }
        }
        false
    }

    pub fn resolve_vrm_bone(&self, src_bone: &str, vrm_version: &str) -> Option<String> {
        if let Some(overrides) = self.vrm_version_overrides.get(vrm_version) {
            if let Some(vrm_bone) = overrides.get(src_bone) {
                return Some(vrm_bone.clone());
            }
        }
        self.direct_map.get(src_bone).cloned()
    }
}

fn glob_match(pattern: &str, text: &str) -> bool {
    let pattern = pattern.trim_matches('*');
    text.contains(pattern)
}
