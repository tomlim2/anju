import unreal

selected_assets = unreal.EditorUtilityLibrary.get_selected_assets()

output_list:list[list[str, str]] = [[]]
selected_assets:list[unreal.Object] = unreal.EditorUtilityLibrary.get_selected_assets()

length = len(selected_assets)
if length < 1:
    print('No asset selected')
    exit()

for asset in selected_assets:
    asset_path = asset.get_path_name().split('.')[0]
    loaded_asset = unreal.EditorAssetLibrary.load_asset(asset_path)
    all_metadata = unreal.EditorAssetLibrary.get_metadata_tag_values(loaded_asset)
    all_tag_names = []
    if len(all_metadata) < 1:
        print('No metadata to remove')
        exit()  
    for tag_name, value in all_metadata.items():
        all_tag_names.append(str(tag_name))
    print(all_tag_names)
    for tag_name in all_tag_names:
        unreal.EditorAssetLibrary.remove_metadata_tag(loaded_asset, tag_name)
    
    unreal.EditorAssetLibrary.save_asset(asset_path)
    print('remove asset tag')

print('remove all metadata done')