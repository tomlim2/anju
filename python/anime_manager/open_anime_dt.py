import unreal
loaded_subsystem = unreal.get_editor_subsystem(unreal.AssetEditorSubsystem)
target = '/Game/Customizing/Blueprints/Structs/Lists/UniqueSet/DT_CM_Casual'
loaded = unreal.load_asset(target)
loaded_subsystem.open_editor_for_assets([loaded])