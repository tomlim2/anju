import unreal

selected_assets = unreal.EditorUtilityLibrary.get_selected_assets()

asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
loaded_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
counter = 0
deleted_assets = ""
for asset in selected_assets:
    path_name = asset.get_path_name().split('.')[0]
    list = loaded_subsystem.find_package_referencers_for_asset(path_name)    
    hasNoReference = len(list) == 0
    if hasNoReference:
        if(unreal.EditorAssetLibrary.delete_loaded_asset(asset)):
            deleted_assets += path_name + '\n'
            counter += 1
        else: 
            print('failed to delete: ', path_name)
        
print('Deleted asset list: \n', deleted_assets)
print('Deleted ', counter, ' unused assets')