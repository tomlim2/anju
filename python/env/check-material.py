import unreal

subsystem_level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
subsystem_actor = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
subsystem_editor = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
all_actors = subsystem_actor.get_all_level_actors()
current_level_name = unreal.GameplayStatics.get_current_level_name(unreal.EditorLevelLibrary.get_editor_world())
error_messages = ""
to_engine_actor_list = []

def check_material(material, material_index):
	if material is None:
		return f"[{material_index}] <<<<< 마테리얼이 비어있습니다!"
	elif isinstance(material, unreal.Material):
		return f"[{material_index}] {material.get_name()} <<<<< 베이스 마테리얼을 사용중입니다. 교체 작업 혹은 TA에게 문의주세요 ({material.get_path_name()})"


for actor in all_actors:
	if isinstance(actor, unreal.StaticMeshActor):
		static_mesh_component = actor.static_mesh_component
		static_mesh = static_mesh_component.static_mesh
		static_mesh_name = static_mesh.get_name()
		materials = static_mesh_component.get_materials()
		for material_index, material in enumerate(materials):
			result = check_material(material, material_index)
			if result:
				to_engine_actor_list.append(actor)
				error_messages += f"--\n[({actor.get_name()})] {static_mesh_name}\n{result}\n"

print("Check completed.")
if error_messages:
	error_messages = f"{current_level_name}의 레벨의 스태틱 메시 엑터의 마테리얼 할당 여부 확인 결과\n" + error_messages
else:
	error_messages = f"🎉 {current_level_name}의 레벨 스태틱 메시 마테리얼 확인 결과: 잘 할당되어 있습니다 🐣✨\n"

print(error_messages)
