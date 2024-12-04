import unreal

directory_path = "/Game/Core/DataTable/UnitAction/UnitActionGeneratedDataAssets/"
def delete_all_assets_in_directory(directory_path):
    asset_registry = unreal.AssetRegistryHelpers.get_asset_registry()
    assets = asset_registry.get_assets_by_path(directory_path, recursive=True)
    
    for asset_data in assets:
        asset_path = asset_data.package_name
        unreal.EditorAssetLibrary.delete_asset(asset_path)

delete_all_assets_in_directory(directory_path)