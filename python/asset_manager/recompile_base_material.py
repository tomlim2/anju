import unreal

selected_assets = unreal.EditorUtilityLibrary.get_selected_assets()

material_editor = unreal.MaterialEditingLibrary
editor_asset = unreal.EditorAssetLibrary


for asset in selected_assets:
    if isinstance(asset, unreal.MaterialInstance):
        loaded_material = editor_asset.load_asset(asset.get_path_name())
        material_editor.get_parent

for target in recompile_targets:
    loaded_material = editor_asset.load_asset(target)
    material_editor.recompile_material(loaded_material)
    
unreal.EditorDialog.show_message("Recompile Material", "Successfully recompiled.", unreal.AppMsgType.OK)
