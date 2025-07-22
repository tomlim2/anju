import unreal

subsystem_level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
subsystem_actor = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
subsystem_editor = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
all_actors = subsystem_actor.get_all_level_actors()
current_level_name = unreal.GameplayStatics.get_current_level_name(unreal.EditorLevelLibrary.get_editor_world())

def get_actor_material_info(actor):
	materials_info = []
	if isinstance(actor, unreal.StaticMeshActor):
		static_mesh_component = actor.static_mesh_component
		if static_mesh_component:
			materials = static_mesh_component.get_materials()
			if materials:
				for index, material in enumerate(materials):
					material_info = {
						'index': index,
						'material': material,
						'path': material.get_path_name() if material else None,
						'name': material.get_name() if material else "None"
					}
					materials_info.append(material_info)
	return materials_info

def get_actor_static_mesh_path(actor):
	if isinstance(actor, unreal.StaticMeshActor):
		static_mesh_component = actor.static_mesh_component
		if static_mesh_component and static_mesh_component.static_mesh:
			return static_mesh_component.static_mesh.get_path_name()
	return None

def get_texture_info_from_material(material):
	texture_info = []
	if material and isinstance(material, unreal.MaterialInstance):
		texture_parameter_values = material.get_editor_property('texture_parameter_values')
		for texture_param in texture_parameter_values:
			param_name = texture_param.get_editor_property('parameter_info').get_editor_property('name')
			texture_value = texture_param.get_editor_property('parameter_value')
			if texture_value and isinstance(texture_value, unreal.Texture):
				texture_info.append({
					'parameter_name': str(param_name),
					'texture_name': texture_value.get_name(),
					'texture_path': texture_value.get_path_name()
				})
	return texture_info

def check_path_condition(path):
	project_path = "/Game/"
	condition1_path = "/Game/Customizing/"
	
	if not path.startswith(project_path):
		return "path is wrong"
	elif path.startswith(condition1_path):
		return "path is in engine path"
	return None

def check_actor_errors(actor):
	actor_name = actor.get_name()
	static_mesh_name = actor.static_mesh_component.static_mesh.get_name()
	
	errors = {
		'actor_name': actor_name,
		'static_mesh_name': static_mesh_name,
		'static_mesh_path': None,
		'static_mesh_error': None,
		'material_errors': [],
		'texture_errors': []
	}
	
	# Check static mesh
	static_mesh_path = get_actor_static_mesh_path(actor)
	if static_mesh_path:
		errors['static_mesh_path'] = static_mesh_path
		static_mesh_error = check_path_condition(static_mesh_path)
		if static_mesh_error:
			errors['static_mesh_error'] = static_mesh_error
	
	# Check materials and textures
	materials_info = get_actor_material_info(actor)
	for material_info in materials_info:
		material_error = None
		if material_info['path']:
			material_error = check_path_condition(material_info['path'])
		
		if material_error:
			errors['material_errors'].append({
				'index': material_info['index'],
				'name': material_info['name'],
				'path': material_info['path'],
				'error': material_error
			})
		
		# Check textures for this material
		if material_info['material']:
			material = subsystem_editor.load_asset(material_info['path'])
			texture_info_list = get_texture_info_from_material(material)
			
			for texture_info in texture_info_list:
				texture_error = check_path_condition(texture_info['texture_path'])
				if texture_error:
					errors['texture_errors'].append({
						'material_index': material_info['index'],
						'material_name': material_info['name'],
						'material_path': material_info['path'],
						'parameter_name': texture_info['parameter_name'],
						'texture_name': texture_info['texture_name'],
						'texture_path': texture_info['texture_path'],
						'error': texture_error
					})
	
	return errors

def format_error_message(errors):
	if not any([errors['static_mesh_error'], errors['material_errors'], errors['texture_errors']]):
		return ""
	
	message = f"actor_name: \"{errors['actor_name']}\"\n"
	message += f"static_mesh_name: \"{errors['static_mesh_name']}\"\n"
	
	if errors['static_mesh_path']:
		message += f"static_mesh_path: {errors['static_mesh_path']}\n"
	
	if errors['static_mesh_error']:
		message += f"error_message: \"{errors['static_mesh_error']}\"\n"
	
	if errors['material_errors']:
		message += "\n"
		for mat_error in errors['material_errors']:
			message += f"material_index: {mat_error['index']}\n"
			message += f"material_name: {mat_error['name']}\n"
			message += f"material_path: {mat_error['path']}\n"
			message += f"error_message: \"{mat_error['error']}\"\n\n"
	
	if errors['texture_errors']:
		if not errors['material_errors']:
			message += "\n"
		
		current_material_index = None
		for tex_error in errors['texture_errors']:
			if current_material_index != tex_error['material_index']:
				if current_material_index is not None:
					message += "\n"
				message += f"material_index: {tex_error['material_index']}\n"
				message += f"material_name: {tex_error['material_name']}\n"
				message += f"material_path: {tex_error['material_path']}\n\n"
				current_material_index = tex_error['material_index']
			
			message += f"texture_parameter_name: \"{tex_error['parameter_name']}\"\n"
			message += f"texture_name: \"{tex_error['texture_name']}\"\n"
			message += f"texture_path: {tex_error['texture_path']}\n"
			message += f"error_message: \"{tex_error['error']}\"\n\n"
	
	return message

error_messages = f"Checking all actors in level: {current_level_name}\n\n"

for actor in all_actors:
	if isinstance(actor, unreal.StaticMeshActor):
		errors = check_actor_errors(actor)
		formatted_message = format_error_message(errors)
		if formatted_message:
			error_messages += formatted_message + "\n"

print("Check completed.")
if error_messages:
	print(error_messages)
