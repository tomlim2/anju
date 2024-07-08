import unreal

selected_assets = unreal.EditorUtilityLibrary.get_selected_assets()

for asset in selected_assets:
    loaded_material_instance: unreal.MaterialInstanceConstant = asset
    if loaded_material_instance.__class__ == unreal.MaterialInstanceConstant:
        main_material = asset.get_base_material()
        loaded_subsystem = unreal.get_editor_subsystem(unreal.AssetEditorSubsystem)        
        loaded_subsystem.open_editor_for_assets([main_material])
