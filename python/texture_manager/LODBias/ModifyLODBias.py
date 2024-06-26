import unreal

selected_assets: list[unreal.Object] = unreal.EditorUtilityLibrary.get_selected_assets()

for asset in selected_assets:
    is_texture = asset.__class__ == unreal.Texture2D
    if is_texture:
        asset.set_editor_property("lod_bias", 0) 