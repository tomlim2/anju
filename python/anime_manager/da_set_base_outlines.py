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

### set outline materials to data asset
basic_outline_material = blueprint_asset.get_editor_property('BasicOutlineMaterial')
outline_materials = []
for i in range(sm_mats_length):
    outline_materials.append(basic_outline_material)

property_info = {'Outline_Materials': outline_materials}
blueprint_asset.set_editor_properties(property_info)
loaded_subsystem.save_asset(new_da_path)