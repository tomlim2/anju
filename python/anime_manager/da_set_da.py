import unreal

selected_assets: list[unreal.Object] = unreal.EditorUtilityLibrary.get_selected_assets()
loaded_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)

selected_sm:unreal.SkeletalMesh = selected_assets[0]

## set data asset
target_da_path = "/Game/RnD/Common/DataAsset/DA_Target"
destination_path_array = selected_sm.get_path_name().split('/')
new_da_path = '/'.join(destination_path_array[:-1]) + '/DA_' + selected_sm.get_name()

## duplicate and save
loaded_subsystem.duplicate_asset(target_da_path, new_da_path)
loaded_subsystem.save_asset(new_da_path)

print('data asset set done')