import unreal

def load_assets(folder_path, does_hard_load):
    asset_registry = unreal.AssetRegistryHelpers.get_asset_registry()
    assets = asset_registry.get_assets_by_path(folder_path, recursive=True)
    error_message: str
    if assets is not None:
        static_meshes = []
        for asset_data in assets:
            asset_data_class: unreal.Class = asset_data.get_class()
            if not asset_data_class:
                continue
            class_name = asset_data_class.get_name()
            is_static_mesh = class_name == 'StaticMesh'
            if is_static_mesh:
                if does_hard_load:
                    print(f"Found asset: {asset_data.package_name}")
                static_meshes.append(asset_data)
        error_message = f"{folder_path}의 스태틱 매시 {len(static_meshes)}개"
        return error_message
    else:
        error_message = f"{folder_path}에서 에셋을 찾을 수 없습니다"
        return error_message

folder_pathes = ["/Game/CineProps", "/Game/Market_Purchase"]
error_messages = []
does_hard_load: bool

for folder_path in folder_pathes:
    result = load_assets(folder_path, does_hard_load)
    print(result)
    error_messages.append(unreal.Name(result))