import unreal
loaded_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem) 

selected_assets: list[unreal.Object] = unreal.EditorUtilityLibrary.get_selected_assets()
selected_sm:unreal.SkeletalMesh = selected_assets[0]

target_diffuse_name = 'gltf_tex_diffuse'

sm_materials = selected_sm.materials
sm_mats_length = len(selected_sm.materials)
sm_path = selected_sm.get_path_name()
sm_folder = '/'.join(sm_path.split('/')[:-1])
outline_folder_path = sm_folder + '/Materials/Outlines/Vrm4u'

duplicate_this_outline = outline_folder_path + '/' + selected_sm.get_name() + '_Outline_Vrm4u'

does_main_outline_exist = loaded_subsystem.does_asset_exist(duplicate_this_outline)

if does_main_outline_exist == False:
    print('Character main vrm4u outline does not exist')
    exit()
loaded_be_duplicated = unreal.load_asset(duplicate_this_outline)

## duplicate outline materials
outline_materials = []

for sm_material in sm_materials:
    sm_material: unreal.SkeletalMaterial
    loaded_sm_mat = sm_material.material_interface # .get_path_name().split('/')[0] + '_Outline'
    outline_mat_name = loaded_sm_mat.get_name() + '_Outline_Vrm4u'

    outline_path_name = outline_folder_path + '/' + outline_mat_name
    check = loaded_subsystem.does_asset_exist(outline_path_name)
    print(check)
    if check == False:
        ducplicated_outline = loaded_subsystem.duplicate_asset(duplicate_this_outline, outline_path_name)
        loaded_subsystem.save_asset(outline_path_name)

    
    loaded_new_outline = unreal.load_asset(outline_path_name)

    parent_mat = loaded_new_outline.get_editor_property('parent')
    if parent_mat != loaded_be_duplicated:
        loaded_new_outline.set_editor_property('parent', loaded_be_duplicated)
    txts = loaded_sm_mat.get_editor_property('texture_parameter_values')
    hi_jack_txt:str
    for txt in txts:
        txt:unreal.TextureParameterValue
        if txt.parameter_info.name == target_diffuse_name:
            hi_jack_txt = txt.parameter_value
            break
    new_txts = txts
    for new_txt in new_txts:
        new_txt:unreal.TextureParameterValue
        if new_txt.parameter_info.name == 'gltf_tex_diffuse':
            new_txt.parameter_value = hi_jack_txt
            break
    loaded_new_outline.set_editor_property('texture_parameter_values', new_txts)
    loaded_subsystem.save_asset(outline_path_name)