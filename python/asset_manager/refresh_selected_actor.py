import unreal

# Get EditorActorSubsystem
actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
selected_actors = actor_subsystem.get_selected_level_actors()

if selected_actors:
    selected_actor = selected_actors[0]

    # Workaround: Trigger refresh by modifying and resetting a property
    # This triggers PostEditChangeProperty which reruns construction scripts
    current_location = selected_actor.get_actor_location()
    selected_actor.set_actor_location(current_location, False, False)
    unreal.log(f"Actor refreshed: {selected_actor.get_name()}")
else:
    unreal.log_warning("No actors selected")