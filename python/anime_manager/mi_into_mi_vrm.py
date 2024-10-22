import unreal

loaded_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)

target_params:str = "TextureBase"
target_vrm_mi_path:str = "/Game/RnD/Common/Materials/MI_CVAnime_Base"

destination_params_a:str = "gltf_tex_diffuse"
destination_params_b:str = "mtoon_tex_ShadeTexture"

selected_assets: list[unreal.Object] = unreal.EditorUtilityLibrary.get_selected_assets()
selected_sm: unreal.SkeletalMesh = selected_assets[0]

if selected_sm.__class__ != unreal.SkeletalMesh:
    print('select skeletal mesh')
    exit()

sm_materials: list[unreal.MaterialInstanceConstant] = []
sm_path = selected_sm.get_path_name()

for material in selected_sm.materials:
    mic:unreal.MaterialInstanceConstant = material.material_interface
    sm_materials.append(mic)

# set sub mi
destination_path_array = selected_sm.get_path_name().split('/')
sub_mi_path = '/'.join(destination_path_array[:-1]) + '/MI_CVAnime_' + selected_sm.get_name()

## duplicate and save
if loaded_subsystem.does_asset_exist(sub_mi_path):
    print('already exist')
else:
    loaded_subsystem.duplicate_asset(target_vrm_mi_path, sub_mi_path)
    loaded_subsystem.save_asset(sub_mi_path)


# surgery
loaded_sub_mi = loaded_subsystem.load_asset(sub_mi_path)
anime_mats = []

for material in sm_materials:
    mi_path = loaded_sub_mi.get_path_name()
    mi_path_array = mi_path.split('/')
    destination_mi_path = '/'.join(mi_path_array[:-1]) + '/' + material.get_name() + '_CVAnime'
    if loaded_subsystem.does_asset_exist(destination_mi_path):
        print('already exist')
        loaded_destination_mi:unreal.MaterialInstanceConstant = loaded_subsystem.load_asset(destination_mi_path)
        anime_mats.append(loaded_destination_mi)
        continue
    loaded_subsystem.duplicate_asset(mi_path, destination_mi_path)
    loaded_subsystem.save_asset(destination_mi_path)
    
    loaded_destination_mi:unreal.MaterialInstanceConstant = loaded_subsystem.load_asset(destination_mi_path)
    target_property = loaded_destination_mi.get_editor_property('texture_parameter_values')
    texture_path
    material_textures = material.get_editor_property('texture_parameter_values')
    new_property = []

    for texture in material_textures:
        if texture.parameter_info.name == target_params:
            texture_path = texture.get_editor_property('parameter_value') 
            break

    for prop in target_property:
        prop.set_editor_property('parameter_value', texture_path)
        print(prop,'prop')
        new_property.append(prop)

    loaded_destination_mi.set_editor_property('texture_parameter_values', new_property)
    loaded_subsystem.save_asset(destination_mi_path)
    anime_mats.append(loaded_destination_mi)

new_anime_mats = []
mat_index = 0
for material in selected_sm.materials:
    material.material_interface = anime_mats[mat_index]
    new_anime_mats.append(material)
    mat_index += 1

selected_sm.materials = new_anime_mats  

print("done")