import unreal

target_tag_names:list[str] = ["CreatedBy"]

selected_assets = unreal.EditorUtilityLibrary.get_selected_assets()

for asset in selected_assets:
    asset_path = asset.get_path_name().split('.')[0]
    loaded_asset = unreal.EditorAssetLibrary.load_asset(asset_path)
    
    for tag_name in target_tag_names:
        unreal.EditorAssetLibrary.remove_metadata_tag(loaded_asset, tag_name)
    
    unreal.EditorAssetLibrary.save_asset(asset_path)