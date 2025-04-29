import unreal

selected_assets = unreal.EditorUtilityLibrary.get_selected_assets()

asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
loaded_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)

target_asset_path_list = []
error_message = ""
asset_count = 0

for asset in selected_assets:
	path_name = asset.get_path_name().split('.')[0]
	list = loaded_subsystem.find_package_referencers_for_asset(path_name) 
	has_no_reference = len(list) == 0
	if has_no_reference:
		target_asset_path_list.append(path_name)
		error_message += f"{asset.get_name()}\n"

error_message = f"총 {len(target_asset_path_list)}개의 에셋들을 삭제할 예정입니다.\n대상 에셋 목록:\n" + error_message