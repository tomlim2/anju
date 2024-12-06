import unreal
input_list:list[list[str, str]]
selected_assets:list[unreal.Object] = unreal.EditorUtilityLibrary.get_selected_assets()

input_list = [["CreatedBy","HeyThere"],["Category","Chair"]]

for asset in selected_assets:
    asset_path = asset.get_path_name().split('.')[0]
    loaded_asset = unreal.EditorAssetLibrary.load_asset(asset_path)
    for item in input_list:
        unreal.EditorAssetLibrary.set_metadata_tag(loaded_asset, item[0], item[1])
    unreal.EditorAssetLibrary.save_asset(asset_path)
print('set metadata done')