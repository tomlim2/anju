import unreal
import os

asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
loaded_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
target_asset_path_list: list[str]
error_path_message = ""
error_message = ""
failed_delete_asset_count = 0

print("에셋 삭제 스크립트")
if len(target_asset_path_list) == 0:
	error_message = "삭제할 에셋 경로가 없습니다."
else:
	for asset_path in target_asset_path_list:
		# Removed file permission modification as __file__ is not defined in Unreal's Python environment
		pass
		if(loaded_subsystem.delete_asset(asset_path) is False):
			error_path_message += f"{asset_path} 삭제 실패\n"
			failed_delete_asset_count += 1

	if len(error_path_message) == 0:
		error_message = f"삭제 완료되었습니다"
	else:
		error_message = f"총 {len(target_asset_path_list) - failed_delete_asset_count}개의 에셋들을 삭제했습니다.\n" + error_path_message