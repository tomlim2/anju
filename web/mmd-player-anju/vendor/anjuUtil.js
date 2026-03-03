/**
 * anjuUtil.js — Custom MMD patches for anju player
 *
 * After updating Three.js vendor files, re-apply inline patches
 * marked with "// [anju]". Run: grep -n '\[anju\]' vendor/*.js
 *
 * PATCH GUIDE:
 *
 * CCDIKSolver.js
 *   - import { clampBySingleAxis } from './anjuUtil.js'
 *   - update(): skip ikEnabled === false chains
 *   - updateOne(): single-axis detection → clampBySingleAxis
 *
 * MMDAnimationHelper.js
 *   - import { updateIKEnabled } from './anjuUtil.js'
 *   - _setupMeshAnimation(): reset ikEnabled flags + extract ikStates from clip
 *   - _animateMesh(): call updateIKEnabled() each frame
 *   - _removeMesh(): mixer.stopAllAction() + physics.reset()
 *   - updateOne(): ikEnabled !== false condition
 *
 * animation.js
 *   - import { disableUnusedIK } from '../vendor/anjuUtil.js'
 *   - initHelper(): call disableUnusedIK() after helper.add() for FK VMDs
 *
 * ui.js
 *   - _prepareAnimation(): bone remap → validate → retarget → effects
 *   - imports: bone-remap.js, vmd-validator.js, bone-retarget.js
 *
 * MMDLoader.js
 *   - build(): attach clip.ikStates
 *   - constructor: remove deprecation warning
 *
 * mmdparser.module.js
 *   - parseVmd(): parseLights, parseSelfShadows, parseIKStates functions
 *   - mergeVmds(): ikStates init + merge
 *
 * MMDPhysics.js
 *   - constructor: remove deprecation warning
 */

// Swing-Twist decomposition: clamp rotation around a single primary axis
export function clampBySingleAxis( q, axisIdx, min, max ) {

	// Ensure canonical form (w >= 0) to avoid quaternion double-cover issue
	const sign = q.w < 0 ? - 1 : 1;
	const comp = sign * ( axisIdx === 0 ? q.x : axisIdx === 1 ? q.y : q.z );
	const w = sign * q.w;
	const len = Math.sqrt( comp * comp + w * w );

	if ( len < 1e-10 ) {

		q.set( 0, 0, 0, 1 );
		return;

	}

	// Signed angle: 2 * atan2( twist_axis_component, w )
	let angle = 2 * Math.atan2( comp / len, w / len );

	// Clamp
	angle = Math.max( angle, min );
	angle = Math.min( angle, max );

	// Reconstruct quaternion from clamped angle
	const half = angle * 0.5;
	const s = Math.sin( half );
	const c = Math.cos( half );

	q.set(
		axisIdx === 0 ? s : 0,
		axisIdx === 1 ? s : 0,
		axisIdx === 2 ? s : 0,
		c
	);

}

// Apply VMD IK enable/disable states for current animation frame
export function updateIKEnabled( mesh, time, ikStates ) {

	// Convert animation time to VMD frame number (30fps)
	const frame = time * 30;

	// Find the most recent IK state entry (step interpolation)
	let stateIndex = - 1;

	for ( let i = ikStates.length - 1; i >= 0; i -- ) {

		if ( ikStates[ i ].frameNum <= frame ) {

			stateIndex = i;
			break;

		}

	}

	// No applicable state yet — keep all IK enabled (default)
	if ( stateIndex < 0 ) return;

	const state = ikStates[ stateIndex ];
	const iks = mesh.geometry.userData.MMD.iks;
	const bones = mesh.geometry.userData.MMD.bones;

	// Build bone name to enabled lookup from the IK state
	for ( let i = 0, il = state.iks.length; i < il; i ++ ) {

		const ikState = state.iks[ i ];

		// Match IK state bone name against IK chain target bones
		for ( let j = 0, jl = iks.length; j < jl; j ++ ) {

			if ( bones[ iks[ j ].target ] && bones[ iks[ j ].target ].name === ikState.boneName ) {

				iks[ j ].ikEnabled = ikState.enabled;
				break;

			}

		}

	}

}

// Disable IK chains whose target bone has no animation tracks in the clip.
// FK-only VMDs animate leg bones directly (左足, 右ひざ, etc.) without
// IK target tracks (左足ＩＫ, 右足ＩＫ). If IK stays enabled, CCDIKSolver
// overwrites FK rotations every frame, locking legs in rest pose.
// Must be called AFTER helper.add() since _setupMeshAnimation resets ikEnabled.
export function disableUnusedIK( mesh, clip ) {

	const iks = mesh.geometry.userData.MMD.iks;
	const bones = mesh.geometry.userData.MMD.bones;
	if ( !iks || !clip ) return;

	const animatedBones = new Set();
	for ( const track of clip.tracks ) {

		const m = track.name.match( /\.bones\[(.+?)\]\./ );
		if ( m ) animatedBones.add( m[ 1 ] );

	}

	for ( const ik of iks ) {

		const targetBone = bones[ ik.target ];
		if ( targetBone && !animatedBones.has( targetBone.name ) ) {

			ik.ikEnabled = false;

		}

	}

}
