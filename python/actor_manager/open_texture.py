import unreal

selected_assets = unreal.EditorUtilityLibrary.get_selected_assets()
saturation: float = 0.0

for asset in selected_assets:
    asset.set_editor_property('adjust_saturation', 0.0)
    path = asset.get_path_name().split('.')[0]
    loaded_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)        
        
    loaded_subsystem.save_asset(path)