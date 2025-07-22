import unreal

subsystem_level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
subsystem_actor = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
subsystem_editor = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
all_actors = subsystem_actor.get_all_level_actors()
current_level_name = unreal.GameplayStatics.get_current_level_name(unreal.EditorLevelLibrary.get_editor_world())


def check_path_condition(path):
	project_path = "/Game/"
	condition1_path = "/Game/Market_Purchase/"
	messages = ""

	if not path.startswith(project_path):
		messages = "프로젝트 경로가 아닙니다."
		print(f"Path: {path} - {messages}")
	elif not path.startswith(condition1_path):
		messages = "Market_Purchase 폴더에 없습니다."
	return messages

def issue_list_to_message (issue_list):
	messages = ""
	for issue_actor in issue_list:
		if issue_actor['issue']['has_issue']:
			messages += f"\n{issue_actor['static_mesh_name']} | {issue_actor['actor_name']}"
			if not issue_actor['material_errors']:
				messages += f" | {issue_actor['issue']['message']}\n"
			else:
				messages += f"\n"
				for material_error in issue_actor['material_errors']:
					if material_error['issue']['has_issue']:
						messages += f"  머티리얼 인덱스: {material_error['material_index']} | 머티리얼 이름: {material_error['material_name']} | 문제: {material_error['issue']['message']}\n"
						messages += f"  머티리얼 경로: {material_error['material_path']}\n"
					else:
						messages += f"  머티리얼 인덱스: {material_error['material_index']} | 머티리얼 이름: {material_error['material_name']}\n"
					if material_error['texture_errors']:
						for texture_error in material_error['texture_errors']:
							if texture_error['issue']['has_issue']:
								messages += f"    텍스처 이름: {texture_error['texture_name']} | 텍스처 파라미터: {texture_error['texture_parameter_name']} | {texture_error['issue']['message']}\n"
	return messages

error_messages = ""
error_messages += f"레벨의 모든 액터 확인 중: {current_level_name}\n"
issue_actor_list = []

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
			if sm_issue_item['has_issue']:
				issue_actor_list.append(sm_issue_item)

print("Check completed.")
print(error_messages)
if issue_actor_list:
	issue_messages = issue_list_to_message(issue_actor_list)
	print(issue_messages)