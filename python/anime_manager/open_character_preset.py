import unreal
loaded_subsystem = unreal.get_editor_subsystem(unreal.AssetEditorSubsystem)

target = '/Game/Core/DataTable/CharacterCustomize/DT_CinevCharacterPresetData'
loaded = unreal.load_asset(target)
loaded_subsystem.open_editor_for_assets([loaded])