import unreal

selected_assets = unreal.EditorUtilityLibrary.get_selected_assets()

asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
loaded_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
asset_registry = unreal.AssetRegistryHelpers.get_asset_registry()
counter = 0
deleted_assets = ""
for asset in selected_assets:
    path_name = asset.get_path_name().split('.')[0]
    list = asset_registry.get_dependencies(path_name, unreal.AssetRegistryDependencyOptions(include_soft_package_references = True,
                                          include_hard_package_references = True,include_searchable_names = True,
    include_soft_management_references = True,
    include_hard_management_references = True))    
    for dependency in list:
        print(str(dependency))