import unreal

selected_assets: list[unreal.Object] = unreal.EditorUtilityLibrary.get_selected_assets()
loaded_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)

## set sm materials
sm_materials = []
selected_sm:unreal.SkeletalMesh = selected_assets[0]
sm_mats_length = len(selected_sm.materials)

for material in selected_sm.materials:
    mic:unreal.MaterialInstanceConstant = material.material_interface
    sm_materials.append(mic)

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

### set materials to data asset
property_info = {'Materials': sm_materials}
blueprint_asset.set_editor_properties(property_info)
loaded_subsystem.save_asset(new_da_path)