import unreal

selected_assets = unreal.EditorUtilityLibrary.get_selected_assets()
loaded_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
saturation: float
error_message = ""
error_messages = []
asset_count = 0
selected_assets_count = len(selected_assets)
is_success = True

def make_error_message(messages:list[str]) -> str:
	return "\n".join(messages)

for asset in selected_assets:
	if not isinstance(asset, unreal.Texture2D):
		error_message = f"{asset.get_name()}은 텍스처 파일이 아닙니다.\n"
		error_messages.append(error_message)
		continue
	asset.set_editor_property('adjust_saturation', saturation)
	path = asset.get_path_name().split('.')[0]
	loaded_subsystem.save_asset(path)
	asset_count += 1

if len(error_messages) > 0:
	failed_asset_count = selected_assets_count - asset_count
	failed_asset_message = f"총 {selected_assets_count}개 에셋들 중 {failed_asset_count}개 에셋에 오류가 발생했습니다.\n\n"
	error_message = make_error_message(error_messages)
	error_message = failed_asset_message + error_message
	is_success = False
else:
	error_message = f"모든 {asset_count}개 텍스처들에 {saturation:.2f}의 채도를 적용했습니다."