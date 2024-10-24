import unreal
loaded_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem) 

selected_assets: list[unreal.Object] = unreal.EditorUtilityLibrary.get_selected_assets()
selected_sm:unreal.SkeletalMesh = selected_assets[0]

duplicate_this_outline = '/Game/RnD/Common/Materials/Outlines/MI_VRM4U_Outline'
loaded_be_duplicated = unreal.load_asset(duplicate_this_outline)
target_diffuse_name = 'gltf_tex_diffuse'

sm_materials = selected_sm.materials
sm_mats_length = len(selected_sm.materials)
sm_path = selected_sm.get_path_name()
sm_folder = '/'.join(sm_path.split('/')[:-1])
outlines_folder_path = sm_folder + '/Materials/Outlines/Vrm4u/' + selected_sm.get_name() + '_Outline_Vrm4u'
ducplicated_outline = loaded_subsystem.duplicate_asset(duplicate_this_outline, outlines_folder_path)

loaded_subsystem.save_asset(outlines_folder_path)