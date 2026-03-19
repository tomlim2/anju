use glam::Quat;
use std::collections::HashMap;

pub struct RestPoseCorrector {
    corrections: HashMap<String, PoseCorrection>,
}

struct PoseCorrection {
    src_rest_inv: Quat,
    tgt_rest: Quat,
}

impl RestPoseCorrector {
    pub fn new(
        src_rest_poses: &HashMap<String, Quat>,
        tgt_rest_poses: &HashMap<String, Quat>,
        bone_mapping: &[(String, String)],
    ) -> Self {
        let mut corrections = HashMap::new();

        for (src_bone, vrm_bone) in bone_mapping {
            let src_rest = src_rest_poses
                .get(src_bone)
                .copied()
                .unwrap_or(Quat::IDENTITY);
            let tgt_rest = tgt_rest_poses
                .get(vrm_bone)
                .copied()
                .unwrap_or(Quat::IDENTITY);

            corrections.insert(
                vrm_bone.clone(),
                PoseCorrection {
                    src_rest_inv: src_rest.inverse(),
                    tgt_rest,
                },
            );
        }

        Self { corrections }
    }

    pub fn correct(&self, vrm_bone: &str, animated_rotation: Quat) -> Quat {
        if let Some(correction) = self.corrections.get(vrm_bone) {
            let delta = correction.src_rest_inv * animated_rotation;
            correction.tgt_rest * delta
        } else {
            animated_rotation
        }
    }
}
