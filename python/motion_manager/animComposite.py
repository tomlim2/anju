import unreal

selected_asset = unreal.EditorUtilityLibrary.get_selected_assets()[0]

sg = selected_asset.get_editor_property("animation_segment")

print(sg)