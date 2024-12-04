import unreal

selected_assets = unreal.EditorUtilityLibrary.get_selected_assets()

if len(selected_assets) == 0:
    unreal.log_warning("Please select an asset")
    quit()

dir_path = selected_assets[0].get_path_name().replace(selected_assets[0].get_name()+'.'+selected_assets[0].get_name(), "")

asset_registry = unreal.AssetRegistryHelpers.get_asset_registry()

assets_data = asset_registry.get_assets_by_path(dir_path, recursive=True)

for asset_data in assets_data:
    class_name = asset_data.get_class().get_name()
    if not class_name == 'StaticMesh':
        continue
    asset = unreal.EditorAssetLibrary.load_asset(asset_data.package_name)
    
    print(f"Loaded asset: {asset.get_name()}")