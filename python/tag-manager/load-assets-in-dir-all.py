import unreal

asset_registry = unreal.AssetRegistryHelpers.get_asset_registry()
folder_path_1 = "/Game/CineProps"

assets = asset_registry.get_assets_by_path(folder_path_1, recursive=True)
if assets is not None:
    print(f"Found {len(assets)} assets in {folder_path_1}")
else:
    print(f"No assets found in {folder_path_1}")

folder_path_2 = "/Game/Market_Purchase/Abandoned_Library/Candlestick"
assets = asset_registry.get_assets_by_path(folder_path_2, recursive=True)
if assets is not None:
    print(f"Found {len(assets)} assets in {folder_path_2}")
else:
    print(f"No assets found in {folder_path_2}")


cached_paths = len(asset_registry.get_all_cached_paths())
print(f"Number of cached paths: {cached_paths}")    

unreal.AssetRegistryHelpers.get_asset_registry().scan_paths_synchronous(["/Game/Market_Purchase"], True)


#E:/CINEVStudio/CINEVStudio/Content//Materials/M_candlestick.uasset
