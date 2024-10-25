import unreal

selected_assets: list[unreal.Object] = unreal.EditorUtilityLibrary.get_selected_assets()
loaded_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)

## set sm materials
selected_sm:unreal.SkeletalMesh = selected_assets[0]
sm_mats_length = len(selected_sm.materials)

# set data asset
destination_path_array = selected_sm.get_path_name().split('/')
new_da_path = '/'.join(destination_path_array[:-1]) + '/DA_' + selected_sm.get_name()
does_da_exist = loaded_subsystem.does_asset_exist(new_da_path)

if(does_da_exist == False):
    ## set data asset
    target_da_path = "/Game/RnD/Common/DataAsset/DA_Target"
    ## duplicate and save
    loaded_subsystem.duplicate_asset(target_da_path, new_da_path)
    loaded_subsystem.save_asset(new_da_path)

blueprint_asset = unreal.EditorAssetLibrary.load_asset(new_da_path)

sm_path = selected_sm.get_path_name()
sm_folder = '/'.join(sm_path.split('/')[:-1])
outlines_folder_path = sm_folder + '/Materials/Outlines/' + selected_sm.get_name() + '_Outline_Vambo'

outline_material = unreal.load_asset(outlines_folder_path)

### set outline materials to data asset
property_info = {'BasicOutlineMaterial': outline_material}
blueprint_asset.set_editor_properties(property_info)
loaded_subsystem.save_asset(new_da_path)