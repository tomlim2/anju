import unreal

target_asset_path: str

loaded_subsystem = unreal.get_editor_subsystem(unreal.AssetEditorSubsystem)        
loaded_object = unreal.load_asset(target_asset_path)
loaded_subsystem.close_all_editors_for_asset(loaded_object)