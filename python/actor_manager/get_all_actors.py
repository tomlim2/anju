import unreal

editor_world = unreal.EditorLevelLibrary.get_editor_world()
all_actors = unreal.GameplayStatics.get_all_actors_of_class(editor_world, unreal.Actor)

def get_all_actors():
	return all_actors

for actor in get_all_actors():
	print(actor.get_name())
	print(actor.get_path_name())
	print(actor.get_class().get_name())
	print(actor.get_actor_label())
	print(actor.get_actor_location())
	print(actor.get_actor_rotation())
	print(actor.get_actor_scale3d())
	print("-----")

