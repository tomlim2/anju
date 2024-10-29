import unreal
mat_mi_clear = "/Game/RnD/ProjectVamBo/Materials/MI_Clear.uasset"
loaded_mat_clear = unreal.load_asset(mat_mi_clear)

loaded_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem) 

selected_assets: list[unreal.Object] = unreal.EditorUtilityLibrary.get_selected_assets()
selected_sm:unreal.SkeletalMesh = selected_assets[0]

target_diffuse_display_name: str

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

    if check == True:
        outline_materials.append(unreal.load_asset(outline_path_name))
    else:
        outline_materials.append(loaded_mat_clear)



# find data asset
destination_path_array = selected_sm.get_path_name().split('/')
new_da_path = '/'.join(destination_path_array[:-1]) + '/DA_' + selected_sm.get_name()
blueprint_asset = unreal.EditorAssetLibrary.load_asset(new_da_path)


# set outline materials to data asset
property_info = {'Outline_Materials': outline_materials}
blueprint_asset.set_editor_properties(property_info)
loaded_subsystem.save_asset(new_da_path)