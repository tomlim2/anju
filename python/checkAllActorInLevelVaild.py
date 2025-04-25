import unreal

error_messages = ""

def does_material_path_match(material_instance, target_dir_path):
	if material_instance is None:
		return ""
	mi_path = material_instance.get_path_name()
	if not mi_path.startswith(target_dir_path):
		unreal.log(f"Material Path: {mi_path}")
		unreal.log(f"Target Path: {target_dir_path}")
	return material_instance.get_name() if not mi_path.startswith(target_dir_path) else ""

def check_materials(materials, target_dir_path):
	return [
		does_material_path_match(material, target_dir_path)
		for material in materials if material is not None
		if does_material_path_match(material, target_dir_path)
	]

def process_static_mesh_actor(actor, target_dir_path):
	sm_component = actor.static_mesh_component
	return check_materials(sm_component.get_materials(), target_dir_path)

def process_blueprint_actor(actor, target_dir_path):
	invalid_materials = []
	actor_components = actor.get_components_by_class(unreal.ActorComponent)
	for comp in actor_components:
		if isinstance(comp, (unreal.StaticMeshComponent, unreal.InstancedStaticMeshComponent)):
			invalid_materials.extend(check_materials(comp.get_materials(), target_dir_path))
	return invalid_materials

def process_decal_actor(actor, target_dir_path):
	decal_comp = actor.decal
	material = decal_comp.get_decal_material()
	return check_materials([material], target_dir_path) if material else []

def process_actor(actor, target_dir_path):
	if isinstance(actor, unreal.StaticMeshActor):
		return process_static_mesh_actor(actor, target_dir_path)
	elif isinstance(actor.get_class(), unreal.BlueprintGeneratedClass):
		return process_blueprint_actor(actor, target_dir_path)
	elif isinstance(actor, unreal.DecalActor):
		return process_decal_actor(actor, target_dir_path)
	return []

def get_cinev_level_material_path():
	subsystem_level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
	level_path = subsystem_level.get_current_level().get_path_name()
	level_material_path = level_path.replace("01_MainLevel", "06_Material").rsplit("/", 1)[0] + "/"
	return level_material_path

all_actors = unreal.EditorLevelLibrary.get_all_level_actors()
level_material_path = get_cinev_level_material_path()
collected_error_messages = []

for actor in all_actors:
	invalid_materials = process_actor(actor, level_material_path)
	if invalid_materials:
		collected_error_messages.append({
			"actor_label": actor.get_actor_label(),
			"material_list": invalid_materials
		})

error_messages_str = "\n".join(
	[f"엑터 이름: {error['actor_label']}\n마테리얼 이름: {', '.join(error['material_list'])}\n" for error in collected_error_messages]
)
error_messages = error_messages_str