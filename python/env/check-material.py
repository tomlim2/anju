import unreal

subsystem_level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
subsystem_actor = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
subsystem_editor = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
all_actors = subsystem_actor.get_all_level_actors()
current_level_name = unreal.GameplayStatics.get_current_level_name(unreal.EditorLevelLibrary.get_editor_world())

error_messages = ""
error_messages += f"레벨의 모든 액터 확인 중: {current_level_name}\n"

for actor in all_actors:
	if isinstance(actor, unreal.StaticMeshActor):
		static_mesh_compoent = actor.static_mesh_component
		static_mesh = static_mesh_compoent.static_mesh
		materials = static_mesh_compoent.get_materials()
		for material_index, material in enumerate(materials):
			if material is None:
				print(f"Actor: {actor.get_name()}, Material Index: {material_index} - Missing Material")
			elif isinstance(material, unreal.Material):
				print(f"Actor: {actor.get_name()}, Material Index: {material_index} - Material: {material.get_name()}")

print("Check completed.")
print(error_messages)