import unreal

subsystem_level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
subsystem_actor = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
subsystem_editor = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
all_actors = subsystem_actor.get_all_level_actors()
current_level_name = unreal.GameplayStatics.get_current_level_name(unreal.EditorLevelLibrary.get_editor_world())
error_messages = ""
issue_message = ""
is_passed = False
issued_actor_list = []
to_engine_actor_list = []
paths_to_check = ["/Game/", "/Game/CineProps/"]

def check_path_condition(path):
	messages = ""
	for path_to_check in paths_to_check:
		if not path.startswith(path_to_check):
			if path_to_check == "/Game/":
				messages = "엔진 경로에 있는 에셋입니다."
			else:
				messages = "경로 확인이 필요합니다."
			return messages
	return messages

def issued_list_to_message(issue_list):
	lines = []
	for issue_actor in issue_list:
		if issue_actor['issue']['has_issue']:
			header = f"--\n[{issue_actor['actor_name']}] {issue_actor['static_mesh_name']}"
			if not issue_actor['material_errors']:
				header += f" <<<<< {issue_actor['issue']['message']} ({issue_actor['static_mesh_path']})"
				lines.append(header)
			else:
				lines.append(header)
				for material_error in issue_actor['material_errors']:
					mat_line = f"  [{material_error['material_index']}] {material_error['material_name']}"
					if material_error['issue']['has_issue']:
						mat_line += f" <<<<< {material_error['issue']['message']} ({material_error['material_path']})"
					lines.append(mat_line)
					for texture_error in material_error.get('texture_errors', []):
						if texture_error['issue']['has_issue']:
							tex_line = (
								f"    [{texture_error['texture_parameter_name']}] "
								f"{texture_error['texture_name']} <<<<< {texture_error['issue']['message']} "
								f"({texture_error['texture_path']})"
							)
							lines.append(tex_line)
	return "\n".join(lines)

def add_to_engine_actor_list(actor):
	if actor not in to_engine_actor_list:
		to_engine_actor_list.append(actor)

for actor in all_actors:
	if isinstance(actor, unreal.StaticMeshActor):
		static_mesh_component = actor.static_mesh_component
		static_mesh_component_name = static_mesh_component.static_mesh.get_name()
		static_mesh_path = static_mesh_component.static_mesh.get_path_name()
		check_sm = check_path_condition(static_mesh_path)
		sm_issue_item = {
			'actor_name': "",
			'static_mesh_name': "",
			'static_mesh_path': "",
			'has_issue': False,
			'issue': {
				'message': "",
				'has_issue': False,
			},
			'material_errors': [],
		}
		sm_issue_item['actor_name'] = actor.get_name()
		sm_issue_item['static_mesh_name'] = static_mesh_component_name
		if check_sm:
			sm_issue_item['static_mesh_path'] = static_mesh_path
			sm_issue_item['has_issue'] = True
			sm_issue_item['issue']['message'] = check_sm
			sm_issue_item['issue']['has_issue'] = True
			add_to_engine_actor_list(actor)
		materials = static_mesh_component.get_materials()
		if materials:	
			for material in materials:
				if isinstance(material, unreal.MaterialInstance):
					check_material = check_path_condition(material.get_path_name())
					if check_material:
						m_issue_item = {
							'material_index': 0,
							'material_name': "",
							'material_path': "",
							'issue': {
								'message': "",
								'has_issue': False,
							},
							'texture_errors': []
						}
						material_index = materials.index(material)
						m_issue_item['material_index'] = material_index
						m_issue_item['material_name'] = material.get_name()
						m_issue_item['material_path'] = material.get_path_name()
						m_issue_item['issue']['message'] = check_material
						m_issue_item['issue']['has_issue'] = True
						sm_issue_item['has_issue'] = True
						sm_issue_item['material_errors'].append(m_issue_item)
						add_to_engine_actor_list(actor)
					loaded_material = subsystem_editor.load_asset(material.get_path_name())
					if isinstance(loaded_material, unreal.MaterialInstance):
						texture_parameter_values = loaded_material.get_editor_property('texture_parameter_values')
						for texture_param in texture_parameter_values:
							texture_value = texture_param.get_editor_property('parameter_value')
							if texture_value and isinstance(texture_value, unreal.Texture):
								texture_path = texture_value.get_path_name()
								check_texture = check_path_condition(texture_path)
								if check_texture:
									txt_issue_item = {
										'texture_parameter_name': "",
										'texture_name': "",
										'texture_path': "",
										'issue': {
											'message': "",
											'has_issue': False,
										}
									}
									txt_issue_item['texture_parameter_name'] = texture_param.get_editor_property('parameter_info').get_editor_property('name')
									txt_issue_item['texture_name'] = texture_value.get_name()
									txt_issue_item['texture_path'] = texture_path
									txt_issue_item['issue']['message'] = check_texture
									txt_issue_item['issue']['has_issue'] = True
									m_issue_item['texture_errors'].append(txt_issue_item)
									sm_issue_item['has_issue'] = True
									add_to_engine_actor_list(actor)
			if sm_issue_item['has_issue']:
				issued_actor_list.append(sm_issue_item)

print("Check completed.")
if issued_actor_list:
	is_passed = False
	error_messages += f"{current_level_name}의 레벨 스태틱 매시, 마테리얼, 텍스처 경로 확인 결과\n"
	issue_messages = issued_list_to_message(issued_actor_list)
	print(issue_messages)
	issue_message = issue_messages
else:
	is_passed = True
	error_messages = f"🎉 {current_level_name}의 레벨 스태틱 매시, 마테리얼, 텍스처 경로 체크 결과: 모든 경로는 완벽해요! 🐣✨\n"
	print(error_messages)
	issue_message = error_messages
