import unreal

selected_asset = unreal.EditorUtilityLibrary.get_selected_assets()[0]

asset_path = selected_asset.get_path_name()
referencer_paths = unreal.EditorAssetLibrary.find_package_referencers_for_asset(asset_path, False)

referencer_assets = []
for path in referencer_paths:
	asset = unreal.EditorAssetLibrary.load_asset(path)
	if asset:
		referencer_assets.append(asset)

unreal.log(f"Found {len(referencer_assets)} referencers for {asset_path}:")
for a in referencer_assets:
	unreal.log(a.get_path_name())