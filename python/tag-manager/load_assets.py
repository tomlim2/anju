import unreal

# Step 1: Load all assets into memory
def load_assets_in_memory(asset_paths):
    loaded_assets = []
    for path in asset_paths:
        asset = unreal.EditorAssetLibrary.load_asset(path)
        if asset:
            loaded_assets.append(asset)
            print(f'Loaded asset: {asset.get_name()}')
        else:
            print(f'Failed to load asset: {path}')
    return loaded_assets


asset_paths:list[str] = []

selected_assets = unreal.EditorUtilityLibrary.get_selected_assets()

asset_paths = [asset.get_path_name() for asset in selected_assets]


loaded_assets = load_assets_in_memory(asset_paths)