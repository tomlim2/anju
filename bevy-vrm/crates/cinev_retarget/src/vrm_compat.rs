#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VrmVersion {
    V0x,
    V1_0,
}

impl VrmVersion {
    pub fn config_key(&self) -> &'static str {
        match self {
            VrmVersion::V0x => "0.x",
            VrmVersion::V1_0 => "1.0",
        }
    }

    pub fn detect_from_gltf_json(json_str: &str) -> Option<Self> {
        if json_str.contains("\"VRMC_vrm\"") {
            Some(VrmVersion::V1_0)
        } else if json_str.contains("\"VRM\"") {
            Some(VrmVersion::V0x)
        } else {
            None
        }
    }
}
