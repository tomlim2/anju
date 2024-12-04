import unreal

asset_registry = unreal.AssetRegistryHelpers.get_asset_registry()
folder_path = "/Game/CineProps"
assets = asset_registry.get_assets_by_path(folder_path, recursive=True)
# print(assets)
print(f"Found {len(assets)} assets in {folder_path}")
# Filter assets by class type
# E:/CINEVStudio/CINEVStudio/Content/CineProps/Asset/Texture/T_blue_map_D.uasset
for asset in assets:
    if asset.get_class().get_name() == "StaticMesh":  # Filter textures
        print(f"StaticMesh: {asset.asset_name}")
        # print(f"Texture: {asset.asset_name}")