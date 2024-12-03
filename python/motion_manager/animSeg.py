import unreal

selected_asset = unreal.EditorUtilityLibrary.get_selected_assets()[0]

anim_segment = unreal.EditorAnimSegment(selected_asset).get_editor_property("anim_segment")

loaded_anim_segment =anim_segment.get_editor_property("anim_reference")
print(loaded_anim_segment)