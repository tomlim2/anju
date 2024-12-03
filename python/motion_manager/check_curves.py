import unreal

selected_asset = unreal.EditorUtilityLibrary.get_selected_assets()[0]

print(selected_asset)

new_length = unreal.FrameNumber(50)
new_t0 = unreal.FrameNumber(0)
new_t1 = unreal.FrameNumber(50)

controller = unreal.AnimSequencerController(selected_asset)
