import unreal

selected_asset = unreal.EditorUtilityLibrary.get_selected_assets()[0]
anim_length = unreal.AnimationLibrary.get_sequence_length(selected_asset)
notify_event = unreal.AnimationLibrary.get_animation_notify_event_names(selected_asset)
track = unreal.AnimationLibrary.get_animation_track_names(selected_asset)
# curve_names = unreal.AnimationLibrary.get_animation_curve_names(selected_asset, 'RCT_FLOAT')

# unreal.AnimationLibrary.remove_all_curve_data(selected_asset)
notify_events = unreal.AnimationLibrary.get_animation_notify_events(selected_asset)
# print(notify_event)
# print(curve_names, 'curve_names')

print(notify_events, 'notify_events')
# print(track, 'selected_asset')