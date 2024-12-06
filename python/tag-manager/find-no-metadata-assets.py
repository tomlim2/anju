import unreal

# Get the Asset Registry
asset_registry_helper = unreal.AssetRegistryHelpers
asset_registry = asset_registry_helper.get_asset_registry()
asset_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)        

selected_assets = unreal.EditorUtilityLibrary.get_selected_assets()
error_message: str

if len(selected_assets) == 0:
    error_message = "에셋을 선택해주세요"
    quit()

assets_without_tags = []
for asset in selected_assets:
    asset_tag_value = asset_subsystem.get_metadata_tag(asset, '#')
    asset_class = asset.get_class().get_name()
    is_static_mesh = asset_class == 'StaticMesh'
    if not asset_tag_value:  # Check if metadata tags are empty
        if is_static_mesh:
            assets_without_tags.append(asset.get_path_name())

# Print assets with no tags
if len(assets_without_tags) == 0:
    error_message = "모든 에셋에 태그가 입력 되어 있습니다"
else:
    error_message = f"{len(assets_without_tags)}개의 에셋들이 메타태그 이슈가 있습니다"
