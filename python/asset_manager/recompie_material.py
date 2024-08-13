import unreal

recompile_targets = [
    '/Game/Materials/Base_Mat/M_Env_base_opaque'
]
material_editor = unreal.MaterialEditingLibrary
editor_asset = unreal.EditorAssetLibrary

for target in recompile_targets:
    loaded_material = editor_asset.load_asset(target)
    material_editor.recompile_material(loaded_material)
    
