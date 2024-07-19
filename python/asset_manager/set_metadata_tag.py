import unreal
#asset_name = "/Game/ProductViewer/SampleMesh/Gears/Transmission_part_10"
selected_asset:unreal.Object = unreal.EditorUtilityLibrary.get_selected_assets()[0]
asset_path = selected_asset.get_path_name()

print(asset_path)
tag_name = "CreatedBy"
value_to_set = "HeyThere"

loaded_asset = unreal.EditorAssetLibrary.load_asset(asset_path)
unreal.EditorAssetLibrary.set_metadata_tag(loaded_asset, tag_name, value_to_set)

tag_name = "Category"
value_to_set = "Chair"

unreal.EditorAssetLibrary.set_metadata_tag(loaded_asset, tag_name, value_to_set)
unreal.EditorAssetLibrary.save_asset(asset_path)