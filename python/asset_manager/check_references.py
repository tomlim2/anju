import unreal

selected_assets = unreal.EditorUtilityLibrary.get_selected_assets()
asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
loaded_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)

for asset in selected_assets:
	# Get the asset's package path
	package_path = asset.get_path_name()
	# Get the asset's references
	references = loaded_subsystem.find_package_referencers_for_asset(package_path)
	for reference in references:
		path_to_check = "/Game/Customizing/"
		if reference.startswith(path_to_check):
			print(f"Asset: {package_path}")
			print(f"Reference found in {path_to_check}: {reference}")