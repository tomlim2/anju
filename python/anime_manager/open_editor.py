import unreal

target_path: str

loaded_subsystem = unreal.get_editor_subsystem(unreal.AssetEditorSubsystem)        
loaded_object = unreal.load_asset(target_path)
loaded_subsystem.open_editor_for_assets([loaded_object])