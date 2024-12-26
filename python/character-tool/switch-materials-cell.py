import unreal

def check_and_load_asset(source_path:str, target_path:str):
    loaded_asset:unreal.Object
    does_exist = unreal.EditorAssetLibrary.does_asset_exist(target_path)
    if(does_exist):
        print(target_path + " Asset already exists, loading...")
        loaded_asset = unreal.EditorAssetLibrary.load_asset(target_path)
    else:
        print(target_path + " Asset does not exist, duplicating...")
        loaded_asset = unreal.EditorAssetLibrary.duplicate_asset(source_path, target_path)
    return loaded_asset

selected_assets = unreal.EditorUtilityLibrary.get_selected_assets()

if(len(selected_assets) == 0 or len(selected_assets) >1):
    print("Please select a single material")
    exit()

selected_asset = selected_assets[0]

if(selected_assets[0].get_class().get_name() != "StaticMesh"):
    print("Please select a static mesh")
    exit()

static_mesh: unreal.StaticMesh = selected_assets[0]

mi_cell_path:str = "/Game/RnD/Chloe/Materials/MI_Body.MI_Body"
selected_sm_path:str = selected_asset.get_path_name()
selected_dir_path:str = selected_sm_path.rsplit("/", 1)[0] + "/"
print(selected_dir_path)

static_materials: list[unreal.StaticMaterial] = static_mesh.get_editor_property("static_materials")
new_static_materials: list[unreal.StaticMaterial] = []
for material_interface in static_materials:
    duplicated_mi_cell_name = str(material_interface.material_slot_name) + "_cell"
    duplicated_mi_cell_path = selected_dir_path + duplicated_mi_cell_name
    duplicated_mi_cell = check_and_load_asset(mi_cell_path, duplicated_mi_cell_path)
    material_interface.set_editor_property("material_interface", duplicated_mi_cell)
    new_static_materials.append(material_interface)

static_mesh.set_editor_property("static_materials", new_static_materials)
unreal.EditorAssetLibrary.save_asset(static_mesh.get_path_name())

# outline
mi_outline_path:str = "/Game/RnD/Chloe/Materials/MI_Chloe_Outline.MI_Chloe_Outline"
target_outline_path:str = selected_dir_path + "/MI_Outline"
loaded_mi_outline = check_and_load_asset(mi_outline_path, target_outline_path)

new_duplicated_static_mesh_path:str = selected_dir_path + "/" + static_mesh.get_name() + "_Outline"
loaded_static_mesh = check_and_load_asset(selected_sm_path, new_duplicated_static_mesh_path)

static_materials_outline: list[unreal.StaticMaterial] = loaded_static_mesh.get_editor_property("static_materials")
new_static_materials_outline: list[unreal.StaticMaterial] = []
for material_interface in static_materials_outline:

    material_interface.set_editor_property("material_interface", loaded_mi_outline)
    new_static_materials_outline.append(material_interface)

loaded_static_mesh.set_editor_property("static_materials", new_static_materials_outline)
unreal.EditorAssetLibrary.save_asset(loaded_static_mesh.get_path_name())

#Mi_Clear
mi_clear_path:str = "/Game/RnD/ProjectVamBo/Materials/MI_Clear.MI_Clear"
target_mi_clear_path:str = selected_dir_path + "/__MI_Clear"
check_and_load_asset(mi_clear_path, target_mi_clear_path)

#MI_Eye_shadow
mi_eyeshadow:str = "/Game/RnD/Common/Materials/MI_EyeShadow.MI_EyeShadow"
target_mi_eyeshadow_path:str = selected_dir_path + "/__MI_EyeShadow"
check_and_load_asset(mi_eyeshadow, target_mi_eyeshadow_path)
