import unreal
from typing import TypedDict

subsystem_level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
subsystem_actor = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
subsystem_editor = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
current_level_name = unreal.GameplayStatics.get_current_level_name(unreal.EditorLevelLibrary.get_editor_world())
error_messages: str = ""
issue_message: str = ""
is_passed = False

to_engine_actor_list: list[unreal.Actor] = []
paths_to_check: list[str] = ["/Game/CineProps/", "/Game/CineMaps/"]

class IssueDict(TypedDict):
	message: str
	has_issue: bool

class BasicForm(TypedDict):
	key: str
	name: str
	path: str
	issue: IssueDict

class MIForm (BasicForm):
	textures: list[BasicForm]

class IssuedActorForm(BasicForm):
	actor_has_issue: bool
	materials: list[MIForm]

issued_actor_list: list[IssuedActorForm] = []

def check_path_condition(path):
	if not any(path.startswith(prefix) for prefix in paths_to_check):
		return "<"
	return ""

def add_to_engine_actor_list(actor):
	if actor not in to_engine_actor_list:
		to_engine_actor_list.append(actor)

def check_textures_in_material(material_path):
	issued_textures: list[BasicForm] = []
	material = subsystem_editor.load_asset(material_path)
	if isinstance(material, unreal.MaterialInstance):
		texture_parameter_values = material.get_editor_property('texture_parameter_values')
		for texture_param in texture_parameter_values:
			texture = texture_param.get_editor_property('parameter_value')
			if texture and isinstance(texture, unreal.Texture):
				texture_path = texture.get_path_name()
				check_path = check_path_condition(texture_path)
				if bool(check_path):
					issued: BasicForm = {
						'key': texture_param.get_editor_property('parameter_info').get_editor_property('name'),
						'name': texture.get_name(),
						'path': texture_path,
						'issue': {
							'message': check_path,
							'has_issue': True,
						}
					}
					issued_textures.append(issued)
	return {
		'has_issue': bool(issued_textures),
		'issued_textures': issued_textures
	}

def check_materials_in_sm_actor (static_mesh_component: unreal.StaticMeshComponent):
	issued_materials: list[MIForm] = []
	materials = static_mesh_component.get_materials()
	if materials:	
		for material in materials:
			if isinstance(material, unreal.MaterialInstance):
				check_path = check_path_condition(material.get_path_name())
				material_index = materials.index(material)
				issued: MIForm = {
					'key': str(material_index),
					'name': material.get_name(),
					'path': "",
					'issue': {
						'message': "",
						'has_issue': False,
					},
					'textures': []
				}
				if check_path:
					issued['path'] = material.get_path_name()
					issued['issue']['has_issue'] = True
					issued['issue']['message'] = check_path
				check_result = check_textures_in_material(material.get_path_name())
				if check_result['has_issue']:
					issued['textures'] = check_result['issued_textures']				
				if check_path or check_result['has_issue']:
					issued_materials.append(issued)
	return {
		'has_issue': bool(issued_materials),
		'issued_materials': issued_materials
	}

def clean_asset_path(path):
	if '.' in path:
		return path.rsplit('.', 1)[0]
	return path

def format_error_message (BasicForm: BasicForm):
	clean_path = clean_asset_path(BasicForm['path'])
	return f"[{BasicForm['key']}] '{BasicForm['name']}' {BasicForm['issue']['message']} {clean_path}"

def format_material_lines(material: MIForm):
	lines = []
	lines.append(format_error_message(material))
	if material['textures']:
		for texture in material['textures']:
			if texture['issue']['has_issue']:
				lines.append(format_error_message(texture))
	return lines

def format_material_texture_issue_actor(actor: IssuedActorForm):
	lines = []
	if actor['materials']:
		header = "--\n" + format_error_message(actor)
		lines.append(header)
		for material_error in actor['materials']:
			lines.extend(format_material_lines(material_error))
	return lines

def issued_list_to_message(actors: list[IssuedActorForm]):
	lines = []
	for actor in actors:
		lines.extend(format_material_texture_issue_actor(actor))
	return "\n".join(lines)

def process_static_mesh_actor(actor: unreal.StaticMeshActor) -> IssuedActorForm | None:
	static_mesh_component = actor.static_mesh_component
	static_mesh_path = static_mesh_component.static_mesh.get_path_name()
	check_path = check_path_condition(static_mesh_path)
	issue_actor: IssuedActorForm = {
		'key': actor.get_name(),
		'name': static_mesh_component.static_mesh.get_name(),
		'path': static_mesh_path if check_path else "",
		'issue': {
			'message': check_path,
			'has_issue': bool(check_path),
		},
		'actor_has_issue': bool(check_path),
		'materials': [],
	}
	check_material_result = check_materials_in_sm_actor(static_mesh_component)
	if check_material_result['has_issue']:
		issue_actor['actor_has_issue'] = True
		issue_actor['materials'] = check_material_result['issued_materials']
	return issue_actor if issue_actor['actor_has_issue'] else None

all_actors = subsystem_actor.get_all_level_actors()
for actor in all_actors:
	if isinstance(actor, unreal.StaticMeshActor):
		issue_actor = process_static_mesh_actor(actor)
		if issue_actor:
			add_to_engine_actor_list(actor)
			issued_actor_list.append(issue_actor)

if issued_actor_list:
	error_messages += f"{current_level_name}의 레벨 스태틱 매시, 마테리얼, 텍스처 경로 확인 결과\n"
	issue_messages = issued_list_to_message(issued_actor_list)
	print(issue_messages)
	issue_message = issue_messages
else:
	error_messages = f"🎉 {current_level_name}의 레벨 스태틱 매시, 마테리얼, 텍스처 경로 체크 결과: 모든 경로는 완벽해요! 🐣✨\n"
	print(error_messages)
	issue_message = error_messages

