import unreal

anime_material = "/Game/TA/Users/Deemo/AnimeSwitcher/MI_CA_Test.MI_CA_Test"

selected_assets = unreal.EditorUtilityLibrary.get_selected_assets()

editor_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)

for selected_asset in selected_assets:
    if selected_asset.__class__ != unreal.StaticMesh:
        print('Selected asset is not a static mesh')
        continue

    selected_static_mesh:unreal.StaticMesh = selected_asset

    new_materials = []
    index = 1
    for material in selected_static_mesh.get_editor_property('static_materials'):
        
        path_array = selected_static_mesh.get_path_name().split('/')
        new_file_name = selected_static_mesh.get_name() + "_" + str(index) + '_CA'
        path_array[len(path_array) - 1] = new_file_name + "." + new_file_name
        target_destination_path = '/'.join(path_array)

        print(target_destination_path)
        is_exist = editor_subsystem.does_asset_exist(target_destination_path)
        if is_exist:
            duplicated_material = editor_subsystem.load_asset(target_destination_path)
        else:
            duplicated_material = editor_subsystem.duplicate_asset(anime_material, target_destination_path)
        material.material_interface = duplicated_material
        new_materials.append(material)
        index += 1

    selected_asset.set_editor_property('static_materials', new_materials)
    editor_subsystem.save_asset(selected_static_mesh.get_path_name())