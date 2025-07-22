import unreal

subsystem_level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
subsystem_actor = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
subsystem_editor = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
all_actors = subsystem_actor.get_all_level_actors()
current_level_name = unreal.GameplayStatics.get_current_level_name(unreal.EditorLevelLibrary.get_editor_world())

issue = {
	'message': "",
	'has_issue': False,
}

texture_path_issue_item = {
	'texture_parameter_name': "",
	'texture_name': "",
	'texture_path': "",
	'issue': issue
}

material_path_issue_item = {
	'material_index': 0,
	'material_name': "",
	'material_path': "",
	'issue': issue,
	'texture_errors': []
}

static_mesh_path_issue_item = {
	'actor_name': "",
	'static_mesh_name': "",
	'static_mesh_path': "",
	'has_issue': False,
	'issue': issue,
	'material_errors': [],
}

def check_path_condition(path):
	project_path = "/Game/"
	condition1_path = "/Game/Customizing/"
	messages = ""

	if not path.startswith(project_path):
		messages = "프로젝트 경로가 아닙니다."
	elif path.startswith(condition1_path):
		messages = "커스터마이징 폴더에 있습니다."
	return messages

def issue_list_to_message (issue_list):
	messages = ""
	for issue_item in issue_list:
		if issue_item['issue']['has_issue']:
			messages += f"스태틱 메시: {issue_item['static_mesh_name']} | 액터: {issue_item['actor_name']} | 문제: {issue_item['issue']['message']}\n"
			for material_error in issue_item['material_errors']:
				if material_error['issue']['has_issue']:
					messages += f"  머티리얼 경로: {material_error['material_path']}\n"
					messages += f"  머티리얼 인덱스: {material_error['material_index']} | 머티리얼 이름: {material_error['material_name']} | 문제: {material_error['issue']['message']}\n"
				for texture_error in material_error['texture_errors']:
					if texture_error['issue']['has_issue']:
						messages += f"    텍스처 이름: {texture_error['texture_name']} | 텍스처 파라미터: {texture_error['texture_parameter_name']} | {texture_error['issue']['message']}\n"
	return messages

error_messages = ""
error_messages += f"레벨의 모든 액터 확인 중: {current_level_name}\n"
issue_list = []

for actor in all_actors:
	if isinstance(actor, unreal.StaticMeshActor):
		static_mesh_component = actor.static_mesh_component
		static_mesh_component_name = static_mesh_component.static_mesh.get_name()
		static_mesh_path = static_mesh_component.static_mesh.get_path_name()
		check_sm = check_path_condition(static_mesh_path)
		sm_issue_item = static_mesh_path_issue_item.copy()
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
				if material:
					check_material = check_path_condition(material.get_path_name())
					if check_material:
						m_issue_item = material_path_issue_item.copy()
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
									txt_issue_item = texture_path_issue_item.copy()
									txt_issue_item['texture_parameter_name'] = texture_param.get_editor_property('parameter_info').get_editor_property('name')
									txt_issue_item['texture_name'] = texture_value.get_name()
									txt_issue_item['texture_path'] = texture_path
									txt_issue_item['issue']['message'] = check_texture
									txt_issue_item['issue']['has_issue'] = True
									m_issue_item['texture_errors'].append(txt_issue_item)
			if sm_issue_item['has_issue']:
				issue_list.append(sm_issue_item)

print("Check completed.")
print(error_messages)
if issue_list:
	issue_messages = issue_list_to_message(issue_list)
	print(issue_messages)