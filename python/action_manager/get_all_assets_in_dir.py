import unreal

def get_all_assets_in_dir(directory_path):
    asset_registry = unreal.AssetRegistryHelpers.get_asset_registry()
    assets = asset_registry.get_assets_by_path(directory_path, recursive=True)
    return assets

selected_assets = unreal.EditorUtilityLibrary.get_selected_assets()

new_UAGDA = []
old_UAGDA = []

for asset in selected_assets:
    asset_class = asset.get_class().get_name()
    if asset_class != 'CinevUnitActionDataAsset':
        continue
    selected_asset_package_name = asset.get_path_name().split('.')[0].replace('/UnitActionDataAssets/', '/UnitActionGeneratedDataAssets/')
    new_UAGDA.append(selected_asset_package_name)

directory_path = "/Game/Core/DataTable/UnitAction/UnitActionGeneratedDataAssets/"
directory_assets = get_all_assets_in_dir(directory_path)

for asset in directory_assets:    
    old_UAGDA.append(asset.package_name)

## create
need_to_create_uadas = []
for asset in new_UAGDA:
    if asset not in old_UAGDA:
        package_name = asset.replace('/UnitActionGeneratedDataAssets/', '/UnitActionDataAssets/')
        loaded_asset = unreal.EditorAssetLibrary.load_asset(package_name)
        need_to_create_uadas.append(loaded_asset)


## delete
need_to_delete_uadas = []
for package_name in old_UAGDA:
    if package_name not in new_UAGDA:
        # unreal.EditorAssetLibrary.delete_asset(asset)
        loaded_asset = unreal.EditorAssetLibrary.load_asset(package_name)
        need_to_delete_uadas.append(loaded_asset)