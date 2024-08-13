import unreal

selected_assets = unreal.EditorUtilityLibrary.get_selected_assets()

asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
loaded_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)

for asset in selected_assets:
    path_name = asset.get_path_name().split('.')[0]
    list = loaded_subsystem.find_package_referencers_for_asset(path_name)    
    hasNoReference = len(list) == 0
    if hasNoReference:
        loaded_subsystem.delete_asset(path_name)
        print('deleted: ', path_name)
