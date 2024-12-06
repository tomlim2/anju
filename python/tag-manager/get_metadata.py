import unreal

output_list:list[list[str, str]] = [[]]
selected_assets:list[unreal.Object] = unreal.EditorUtilityLibrary.get_selected_assets()
asset_index = 0
for asset in selected_assets:
    loaded_asset = unreal.EditorAssetLibrary.load_asset(asset.get_path_name().split('.')[0])
    all_metadata = unreal.EditorAssetLibrary.get_metadata_tag_values(loaded_asset)
    for tag_name, value in all_metadata.items():
        output_list[asset_index]=[str(tag_name), value]
        unreal.log("Value of tag " + str(tag_name) + " for asset " + ": " + value)
    asset_index += 1
print(output_list)

