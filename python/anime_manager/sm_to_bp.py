import unreal

taget_bp = '/Game/TA/Users/Deemo/AnimeSwitcher/BP_SMtoAnime.BP_SMtoAnime'
selected_asset = unreal.EditorUtilityLibrary.get_selected_assets()[0]

editor_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)

selected_static_mesh:unreal.StaticMesh = selected_asset

if selected_asset.__class__ != unreal.StaticMesh:
    print('Selected asset is not a static mesh')
    exit()

path_array = selected_static_mesh.get_path_name().split('/')
new_file_name = "BP_" + selected_static_mesh.get_name()
path_array[len(path_array) - 1] = new_file_name + "." + new_file_name
target_destination_path = '/'.join(path_array)

duplicated_bp = editor_subsystem.duplicate_asset(taget_bp, target_destination_path)